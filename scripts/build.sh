#!/usr/bin/env bash
set -euo pipefail

echo "Packaging frontend build..."
zip -r neon-drift.zip index.html style.css game.js README.md config
echo "Created neon-drift.zip"
