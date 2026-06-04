#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Checking Node..."
node --version
npm --version

echo "Checking Python..."
python3 --version

echo "Installing dependencies..."
npm install
npm --prefix frontend install
python3 -m pip install -r backend/requirements.txt

echo "Building desktop package..."
npm run dist

echo "Desktop build complete. Check dist-electron/."
