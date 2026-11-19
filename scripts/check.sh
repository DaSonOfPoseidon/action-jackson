#!/bin/sh
# Runs every check for the stacks present in this checkout.
# The PR loop, CI and humans all run this one command.
set -e

# Always work from the repo root, wherever the script is called from.
cd "$(dirname "$0")/.."

# Legacy API (Express + Jest): runs only when a root package.json exists.
if [ -f package.json ]; then
  echo "== legacy api tests"
  # Install exact lockfile versions, without running package scripts, when deps are missing.
  if [ ! -d node_modules ]; then
    npm ci --ignore-scripts
  fi
  npm test
fi

# Legacy frontend (Next.js + Vitest): runs only when frontend/package.json exists.
if [ -f frontend/package.json ]; then
  echo "== legacy frontend tests"
  # A whole subshell command, so a failure's exit status reaches set -e.
  if [ ! -d frontend/node_modules ]; then
    (cd frontend && npm ci --ignore-scripts)
  fi
  (cd frontend && npm test)
fi

# Later units add the server/ (.NET) and apps/web/ (Angular) blocks here,
# in the same "only when present" style.
