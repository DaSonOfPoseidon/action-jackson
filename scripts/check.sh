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

# Server (.NET, run in a container by scripts/dotnet.sh): runs only when the solution exists.
if [ -f server/ActionJackson.slnx ]; then
  echo "== .NET"
  # -m:1 keeps the SDK container under the host's 1 GiB container cap (/srv/compose/mem-guard).
  scripts/dotnet.sh build server/ActionJackson.slnx
  scripts/dotnet.sh format server/ActionJackson.slnx --verify-no-changes --no-restore
  # The data tests need a Postgres: start the throwaway one (scripts/dotnet.sh then joins its network).
  scripts/test-db.sh up >/dev/null
  scripts/dotnet.sh test server/ActionJackson.slnx --no-build -m:1
fi

# PC deploy files (compose, env template): static checks, no running stack needed.
if [ -f deploy/pc/compose.yml ]; then
  echo "== deploy lint"
  scripts/deploy-lint.sh
fi

# Web (Angular workspace, run in a container by scripts/node.sh: the host's Node is older than Angular's engines).
if [ -f apps/web/package.json ]; then
  echo "== web"
  # Install exact lockfile versions, without package scripts, when node_modules is missing or older than the lockfile.
  if [ ! -d apps/web/node_modules ] || [ apps/web/package-lock.json -nt apps/web/node_modules ]; then
    scripts/node.sh npm ci --ignore-scripts
    touch apps/web/node_modules
  fi
  scripts/node.sh npm audit signatures
  scripts/node.sh npm test
  scripts/node.sh npm run build
  scripts/node.sh npm run test:dist
  scripts/web-e2e.sh
fi
