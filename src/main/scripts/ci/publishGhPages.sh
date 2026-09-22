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

# publishGhPages.sh — publish to the gh-pages branch as a single commit with no
# history (issue #1265). gh-pages only holds build output; every version is
# rebuildable from main, and Pages serves only the tip, so history is dead
# weight (~1,400 commits / ~6.5 GB before this change).
#
#   publishGhPages.sh site <build_dir>              # replace the site root (keeps pr/, CNAME, .nojekyll)
#   publishGhPages.sh preview <pr_number> <build_dir>  # replace pr/<pr_number>/
#   publishGhPages.sh remove-previews <pr_number>...   # delete pr/<n>/ directories
#
# Env: GH_PAGES_REPO_URL (authenticated clone URL, required), GH_PAGES_BRANCH
# (default gh-pages), GH_PAGES_MESSAGE (commit message), GH_PAGES_CNAME
# (default msrbot.io; site mode only).
#
# How it stays fast and safe:
#   - Nothing on gh-pages is checked out: a blob-less, depth-1 clone gives the
#     current tree, and the new tree is assembled in git's index (the build dir
#     is hashed once; untouched paths are carried over by tree id).
#   - Content-identical files hash to existing blobs, so the push uploads only
#     files that actually changed.
#   - Pushes with --force-with-lease against the tip it read. If another deploy
#     landed first, the lease fails and it re-reads the new tip and rebuilds —
#     no deploy can overwrite another's work, without needing a global lock.

set -euo pipefail

MODE="${1:?usage: publishGhPages.sh site|preview|remove-previews ...}"
shift
: "${GH_PAGES_REPO_URL:?GH_PAGES_REPO_URL is required}"
BRANCH="${GH_PAGES_BRANCH:-gh-pages}"
CNAME="${GH_PAGES_CNAME:-msrbot.io}"
MAX_ATTEMPTS=5

case "$MODE" in
  site)            BUILD_DIR="$(cd "${1:?build dir required}" && pwd)"; MESSAGE="${GH_PAGES_MESSAGE:-deploy site}" ;;
  preview)         PR="${1:?pr number required}"; BUILD_DIR="$(cd "${2:?build dir required}" && pwd)"; MESSAGE="${GH_PAGES_MESSAGE:-deploy preview for PR #$PR}" ;;
  remove-previews) [ "$#" -gt 0 ] || { echo "no PR numbers given"; exit 0; }; PRS=("$@"); MESSAGE="${GH_PAGES_MESSAGE:-remove previews: ${PRS[*]}}" ;;
  *) echo "unknown mode: $MODE" >&2; exit 2 ;;
esac

WORK="$(mktemp -d)"
# Cleanup must never decide this step's exit status: git may still be finishing
# a background task in the throwaway clone, and a failed rm would fail an
# already-successful deploy.
trap 'rm -rf "$WORK" 2>/dev/null || true' EXIT
git init -q "$WORK/repo"
cd "$WORK/repo"
git config user.name "${GIT_AUTHOR_NAME:-PrZ3 Unit}"
git config user.email "${GIT_AUTHOR_EMAIL:-prz3-unit[bot]@users.noreply.github.com}"
# No housekeeping in a clone we delete seconds later: hashing ~50k files trips
# git's auto-gc, which repacks in the background and races the cleanup above.
git config gc.auto 0
git config gc.autoDetach false
git config maintenance.auto false
git remote add origin "$GH_PAGES_REPO_URL"

# Hash a directory into a tree object (without touching the main index).
tree_of_dir() {
  local dir="$1" idx="$WORK/idx-$RANDOM"
  GIT_INDEX_FILE="$idx" git --work-tree="$dir" add -A . >/dev/null
  GIT_INDEX_FILE="$idx" git write-tree
  rm -f "$idx"
}

BUILD_TREE=""
if [ -n "${BUILD_DIR:-}" ]; then
  BUILD_TREE="$(tree_of_dir "$BUILD_DIR")"
fi

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  git fetch -q --depth=1 --filter=blob:none origin "+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}"
  OLD="$(git rev-parse "refs/remotes/origin/${BRANCH}")"
  export GIT_INDEX_FILE="$WORK/index"
  rm -f "$GIT_INDEX_FILE"

  case "$MODE" in
    site)
      # New root = build output + the entries a site deploy must keep.
      git read-tree "$BUILD_TREE"
      git rm -r -q --cached --ignore-unmatch -- pr CNAME .nojekyll >/dev/null
      if git cat-file -e "${OLD}:pr" 2>/dev/null; then git read-tree --prefix=pr/ "${OLD}:pr"; fi
      for keep in .gitignore .gitattributes .github; do
        if git cat-file -e "${OLD}:${keep}" 2>/dev/null; then
          git rm -r -q --cached --ignore-unmatch -- "$keep" >/dev/null
          if [ "$(git cat-file -t "${OLD}:${keep}")" = tree ]; then
            git read-tree --prefix="${keep}/" "${OLD}:${keep}"
          else
            git update-index --add --cacheinfo "$(git ls-tree "$OLD" -- "$keep" | awk '{print $1","$3}')","$keep"
          fi
        fi
      done
      git update-index --add --cacheinfo "100644,$(printf '%s\n' "$CNAME" | git hash-object -w --stdin),CNAME"
      git update-index --add --cacheinfo "100644,$(git hash-object -w --stdin </dev/null),.nojekyll"
      ;;
    preview)
      git read-tree "$OLD"
      git rm -r -q --cached --ignore-unmatch -- "pr/${PR}" >/dev/null
      git read-tree --prefix="pr/${PR}/" "$BUILD_TREE"
      ;;
    remove-previews)
      git read-tree "$OLD"
      for n in "${PRS[@]}"; do git rm -r -q --cached --ignore-unmatch -- "pr/${n}" >/dev/null; done
      ;;
  esac

  NEW_TREE="$(git write-tree)"
  unset GIT_INDEX_FILE
  # (Parent check reads the raw commit: a depth-1 clone grafts the tip as
  # parentless, so OLD^1 would always look empty.)
  if [ "$NEW_TREE" = "$(git rev-parse "${OLD}^{tree}")" ] && ! git cat-file -p "$OLD" | grep -q '^parent '; then
    echo "gh-pages already up to date (single commit, identical tree)."
    exit 0
  fi

  NEW="$(git commit-tree "$NEW_TREE" -m "$MESSAGE")"
  if [ -n "${GH_PAGES_BEFORE_PUSH:-}" ]; then eval "$GH_PAGES_BEFORE_PUSH"; fi   # test hook
  if git push -q --force-with-lease="refs/heads/${BRANCH}:${OLD}" origin "${NEW}:refs/heads/${BRANCH}"; then
    CHANGED="$(git diff --name-only "$OLD" "$NEW" | wc -l | tr -d ' ')"
    echo "✅ Published ${BRANCH} ${NEW:0:12} (${MODE}; ${CHANGED} path(s) changed vs previous tip; attempt ${attempt})"
    exit 0
  fi
  echo "⚠️ ${BRANCH} moved since it was read (attempt ${attempt}/${MAX_ATTEMPTS}); rebuilding on the new tip…"
  sleep $((attempt * 3))
done

echo "::error::Failed to publish ${BRANCH} after ${MAX_ATTEMPTS} attempts"
exit 1
