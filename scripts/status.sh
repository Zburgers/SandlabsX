#!/usr/bin/env bash
set -Eeuo pipefail

# LEGACY COMMAND ALIAS
#
# The previous status script inspected host PID files created by run-all.sh.
# Those processes no longer exist; Compose health is the single runtime source
# of truth. Keep this filename temporarily for compatibility.
#
# Canonical command: ./scripts/stack.sh status

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

printf 'NOTICE: scripts/status.sh is a LEGACY alias; showing Compose-owned services.\n'
exec bash ./scripts/stack.sh status
