#!/usr/bin/env bash
set -Eeuo pipefail

# Canonical SandLabX stack controller.
#
# Normal startup targets the frontend and lets Compose traverse the dependency
# graph: PostgreSQL -> vendor schema -> application migrations -> API -> UI.
# One-shot schema/migration services are expected to exit successfully and are
# never restarted as long-running daemons.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE=(docker compose)
WAIT_TIMEOUT="${SANDLABX_STARTUP_TIMEOUT:-180}"
LONG_RUNNING_SERVICES=(postgres guacd guacamole backend frontend)

usage() {
  cat <<'EOF'
Usage: ./scripts/stack.sh <command>

Commands:
  up         Start existing images and wait for the application stack
  rebuild    Rebuild application images, migrate, and start
  down       Stop the stack without deleting persistent data
  restart    Restart only long-running services
  logs       Follow bounded service logs
  status     Show running and completed one-shot services
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

  if "${COMPOSE[@]}" up --help 2>/dev/null | grep -q -- '--wait'; then
    args+=(--wait --wait-timeout "$WAIT_TIMEOUT")
  else
    printf 'WARNING: this Compose version lacks --wait; run make verify after startup.\n' >&2
  fi

  # Targeting frontend starts the full dependency graph while allowing the
  # schema and migration jobs to complete before backend/frontend readiness.
  args+=(frontend)
  "${COMPOSE[@]}" "${args[@]}"
  "${COMPOSE[@]}" ps --all
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
    "${COMPOSE[@]}" restart "${LONG_RUNNING_SERVICES[@]}"
    "${COMPOSE[@]}" ps --all
    ;;
  logs)
    "${COMPOSE[@]}" logs -f --tail="${SANDLABX_LOG_TAIL:-200}"
    ;;
  status)
    "${COMPOSE[@]}" ps --all
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
