#!/usr/bin/env bash
# TurbotaAI – iPad App Store screenshot generator
# Input:  apps/mobile/appstore-screenshots/       (1284×2778 iPhone PNGs)
# Output: apps/mobile/appstore-screenshots-ipad/  (2048×2732 iPad PNGs)
#
# Usage:
#   cd <repo-root>
#   bash apps/mobile/scripts/generate-ipad-screenshots.sh
#
# Requires: python3 + Pillow  (pip3 install Pillow)

set -e
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/apps/mobile/scripts/generate-ipad-screenshots.py"

echo "Checking dependencies..."
python3 -c "from PIL import Image" 2>/dev/null || {
    echo "Installing Pillow..."
    pip3 install Pillow --quiet
}

echo "Generating iPad screenshots..."
python3 "$SCRIPT"

echo ""
echo "Files saved to: $REPO_ROOT/apps/mobile/appstore-screenshots-ipad/"
ls -lh "$REPO_ROOT/apps/mobile/appstore-screenshots-ipad/"
