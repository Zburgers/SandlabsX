#!/usr/bin/env bash
set -Eeuo pipefail

# LEGACY COMMAND ALIAS
#
# The old implementation used broad pkill patterns such as `node.*server.js`
# and `next dev`, which could terminate unrelated projects on the workstation.
# SandLabX now runs one Compose-owned stack and shuts it down by project scope.
#
# Canonical command: ./scripts/stack.sh down
# Remove this wrapper when callers no longer depend on the historical filename.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

printf 'NOTICE: scripts/stop-all.sh is a LEGACY alias; stopping only the SandLabX Compose project.\n'
exec bash ./scripts/stack.sh down
