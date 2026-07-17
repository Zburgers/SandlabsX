#!/usr/bin/env bash
set -Eeuo pipefail

# LEGACY COMMAND ALIAS
#
# Historical versions of this script started the complete Compose stack and then
# launched second host copies of the backend and frontend with nohup. That caused
# port conflicts, duplicate runtimes, stale PID files, and unsafe broad pkill
# cleanup. Keep this filename only for developer muscle memory.
#
# Canonical command: ./scripts/stack.sh rebuild
# Remove this wrapper after documentation and downstream automation stop using it.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

printf 'NOTICE: run-all.sh is a LEGACY alias; delegating to the Compose-only stack controller.\n'
exec bash ./scripts/stack.sh rebuild
