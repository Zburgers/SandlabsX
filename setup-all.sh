#!/usr/bin/env bash
set -Eeuo pipefail

# LEGACY COMMAND ALIAS
#
# The former script mixed dependency installation, Compose startup, and source
# file mutation (it rewrote postcss.config.js at runtime). Setup must not modify
# tracked application code. Keep this filename only for compatibility.
#
# Canonical flow:
#   make prepare
#   make doctor
#   make rebuild
#
# Remove this wrapper after old documentation and automation are migrated.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

printf 'NOTICE: setup-all.sh is a LEGACY alias; running safe preparation and diagnostics only.\n'
make prepare
make doctor
printf '\nPreparation complete. Start with: make rebuild\n'
