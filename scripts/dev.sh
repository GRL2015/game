#!/usr/bin/env bash
set -euo pipefail

echo "[dev] Starting backend API..."
cd server
npm run dev
