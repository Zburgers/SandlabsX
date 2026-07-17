#!/usr/bin/env bash
set -Eeuo pipefail

# LEGACY COMMAND ALIAS
#
# The former helper always tore down the complete stack before rebuilding one
# service. That added avoidable downtime and did not actually repair host KVM
# permissions. Rebuild in place and report access instead.
#
# Canonical command: make rebuild
# Remove this wrapper after old troubleshooting documentation is retired.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

printf 'NOTICE: fix-kvm-and-rebuild.sh is a LEGACY alias; rebuilding without destructive teardown.\n'
bash ./scripts/stack.sh rebuild

if docker compose exec -T backend test -r /dev/kvm -a -w /dev/kvm; then
  printf 'KVM is readable and writable inside the backend container.\n'
else
  printf 'WARNING: /dev/kvm is not usable inside the backend container; VMs may fall back to TCG or reject KVM-only images.\n' >&2
  exit 1
fi
