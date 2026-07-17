#!/usr/bin/env bash
set -Eeuo pipefail

# Canonical SandLabX stack controller.
#
# All normal local startup/shutdown commands should delegate here. This avoids
# the old split-brain runtime where Compose started containers and shell scripts
# launched additional host Node/Next processes with broad pkill cleanup.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE=(docker compose)
WAIT_TIMEOUT="${SANDLABX_STARTUP_TIMEOUT:-180}"

usage() {
  cat <<'EOF'
Usage: ./scripts/stack.sh <command>

Commands:
  up         Start existing images and wait for healthy dependencies
  rebuild    Rebuild application images, start, and wait for health
  down       Stop the stack without deleting persistent data
  restart    Restart running services
  logs       Follow bounded service logs
  status     Show service state
  config     Validate and print the resolved Compose configuration
EOF
}

require_compose() {
  command -v docker >/dev/null 2>&1 || {
    printf 'Docker is not installed or not in PATH.\n' >&2
    exit 127
  }
  "${COMPOSE[@]}" version >/dev/null 2>&1 || {
    printf 'The Docker Compose v2 plugin is required.\n' >&2
    exit 127
  }
}

prepare_runtime_dirs() {
  mkdir -p images/custom overlays vms pids checkpoints
}

compose_up() {
  local build_flag="${1:-}"
  prepare_runtime_dirs
  "${COMPOSE[@]}" config --quiet

  local args=(up -d --remove-orphans)
  if [[ "$build_flag" == "--build" ]]; then
    args+=(--build)
  fi

  # Modern Compose waits on declared health checks and exits non-zero when a
  # dependency cannot become ready. Fall back to detached startup only for an
  # older v2 plugin that does not expose --wait.
  if "${COMPOSE[@]}" up --help 2>/dev/null | grep -q -- '--wait'; then
    args+=(--wait --wait-timeout "$WAIT_TIMEOUT")
  else
    printf 'WARNING: this Compose version lacks --wait; startup health is not synchronously verified.\n' >&2
  fi

  "${COMPOSE[@]}" "${args[@]}"
  "${COMPOSE[@]}" ps
}

require_compose

case "${1:-}" in
  up)
    compose_up
    ;;
  rebuild)
    compose_up --build
    ;;
  down)
    "${COMPOSE[@]}" down --remove-orphans
    ;;
  restart)
    "${COMPOSE[@]}" restart
    "${COMPOSE[@]}" ps
    ;;
  logs)
    "${COMPOSE[@]}" logs -f --tail="${SANDLABX_LOG_TAIL:-200}"
    ;;
  status)
    "${COMPOSE[@]}" ps
    ;;
  config)
    "${COMPOSE[@]}" config
    ;;
  -h|--help|help|'')
    usage
    ;;
  *)
    printf 'Unknown command: %s\n\n' "$1" >&2
    usage >&2
    exit 64
    ;;
esac
