#!/usr/bin/env bash
# TurbotaAI – iOS App Store screenshot generator
# Output: apps/mobile/appstore-screenshots/
# Sizes:  1284×2778 (iPhone 14 Pro Max / 6.7-inch) – accepted by App Store Connect
#
# Usage:
#   cd <repo-root>
#   bash apps/mobile/scripts/generate-ios-screenshots.sh
#
# Requires: python3 + Pillow
#   pip3 install Pillow

set -e
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/apps/mobile/scripts/generate-ios-screenshots.py"

echo "Checking dependencies..."
python3 -c "from PIL import Image" 2>/dev/null || {
    echo "Installing Pillow..."
    pip3 install Pillow --quiet
}

echo "Generating screenshots..."
python3 "$SCRIPT"

echo ""
echo "Files saved to: $REPO_ROOT/apps/mobile/appstore-screenshots/"
ls -lh "$REPO_ROOT/apps/mobile/appstore-screenshots/"
