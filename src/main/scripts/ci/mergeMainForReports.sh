#!/usr/bin/env bash
# /*
# Copyright (c) 2025-26 PrZ3 LLC (d/b/a [PrZ3](https://github.com/PrZ3r))
#
# Redistribution and use in source and binary forms, with or without modification,
# are permitted provided that the following conditions are met:
#
# 1. Redistributions of source code must retain the above copyright notice, this
#    list of conditions and the following disclaimer.
#
# 3. Redistributions in binary form must reproduce the above copyright notice, this
#    list of conditions and the following disclaimer in the documentation and/or
#    other materials provided with the distribution.
#
# 4. Neither the name of the copyright holder nor the names of its contributors may
#    be used to endorse or promote products derived from this software without specific
#    prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND
# ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
# WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
# DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
# FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
# DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
# SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
# CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
# TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
# THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
# */

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
