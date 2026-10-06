#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Use the committed lockfile; fail rather than silently changing dependencies.
npm ci --no-audit --no-fund
npm run check
npm run build

# No automatic database push: this hook must not approve destructive schema
# changes or touch production. Apply schema changes through the documented
# development/publish flow when a merge actually requires them.
