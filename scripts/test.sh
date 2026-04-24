#!/usr/bin/env bash
set -euo pipefail

echo "Running backend tests..."
(
  cd server
  npm test
)

echo "Checking frontend JS syntax..."
node --check game.js

echo "All checks passed."
