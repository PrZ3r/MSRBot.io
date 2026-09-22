#!/usr/bin/env bash
# mergeMainForReports.sh <branch>
#
# Run inside a checkout of <branch>. Merges the latest origin/main into it so
# the PR's MSI/MRI reports can be rebuilt as "main + this PR" (issue #1266).
#
# Reports are generated from the data, never hand-edited, so conflicts that are
# ONLY in report files are resolved by taking main's version — the rebuild that
# follows overwrites them anyway. Any other conflict aborts the merge and exits
# non-zero so a human resolves it.
#
# Prints merged=true|false (and conflict details) to $GITHUB_OUTPUT when set.

set -euo pipefail
BRANCH="${1:?usage: mergeMainForReports.sh <branch>}"
REPORTS_RE='^src/main/reports/(masterSuiteIndex\.json|mri_presence_audit\.json|mri/)'
out() { [ -n "${GITHUB_OUTPUT:-}" ] && echo "$1" >> "$GITHUB_OUTPUT"; echo "$1"; }

git fetch --no-tags --depth=50 origin \
  "+refs/heads/main:refs/remotes/origin/main" \
  "+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}"
# Deepen until the branch and main share history (PR branches are short-lived).
tries=0
until git merge-base origin/main HEAD >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -gt 20 ]; then echo "::error::no merge base with main after deepening"; exit 1; fi
  git fetch --no-tags --deepen=200 origin \
    "+refs/heads/main:refs/remotes/origin/main" \
    "+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}"
done

if git merge-base --is-ancestor origin/main HEAD; then
  echo "Branch already contains main."
  out "merged=false"
  exit 0
fi

MSG="Merge main into ${BRANCH} (report refresh)"
if git merge --no-edit -m "$MSG" origin/main; then
  out "merged=true"
  exit 0
fi

CONFLICTS="$(git diff --name-only --diff-filter=U)"
OTHERS="$(printf '%s\n' "$CONFLICTS" | grep -Ev "$REPORTS_RE" || true)"
if [ -n "$OTHERS" ]; then
  git merge --abort
  echo "::error::Merging main into ${BRANCH} conflicts outside the generated reports — resolve by hand:"
  printf '  %s\n' $OTHERS
  exit 1
fi

echo "Report-only conflicts; taking main's version (the rebuild regenerates them):"
printf '%s\n' "$CONFLICTS" | while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo "  $f"
  if git cat-file -e "origin/main:$f" 2>/dev/null; then
    git checkout origin/main -- "$f"
  else
    git rm -q --cached -- "$f" 2>/dev/null || true
    rm -f -- "$f"
  fi
done
git add -A -- src/main/reports
git commit --no-edit -m "$MSG"
out "merged=true"
