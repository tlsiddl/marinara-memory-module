#!/bin/sh
# Copies the built extension (deliverable/) to the root of the "extension" branch and pushes it.
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
git fetch -q origin +extension:refs/remotes/origin/extension
git worktree add -q "$TMP" origin/extension
cp deliverable/manifest.json deliverable/extension.js deliverable/extension.css "$TMP/"
cd "$TMP"
git add -A
git commit -qm "기억 서재 (기억 모듈판) 확장 $(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' manifest.json | tail -1)" || true
git push -q origin HEAD:extension
cd - >/dev/null
git worktree remove --force "$TMP"
