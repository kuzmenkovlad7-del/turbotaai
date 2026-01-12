#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
OUT="$HOME/Downloads/myitra-support-pack-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"

git status > "$OUT/git-status.txt" || true
git diff > "$OUT/git-diff.patch" || true
git diff --stat > "$OUT/git-diff-stat.txt" || true

if [ -f .env.local ]; then
  sed -E 's/=(.*)$/=*** /' .env.local > "$OUT/env-keys-only.txt"
fi

tar -czf "${OUT}.tgz" -C "$(dirname "$OUT")" "$(basename "$OUT")"
echo "OK: ${OUT}.tgz"
