#!/usr/bin/env bash
set -Eeuo pipefail

# PostgreSQL maintenance helper.
# This is not part of normal startup: the backend migration runner handles
# versioned application migrations. Use this script only for explicit database
# initialization, reset, or legacy JSON-node migration work.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE=(docker compose)
RESET_VOLUME=false
RUN_MIGRATION=false

usage() {
  cat <<'EOF'
Usage: ./scripts/init-postgres.sh [--reset-volume] [--migrate-nodes]

  --reset-volume   Stop the stack and remove the named PostgreSQL volume.
                   This permanently deletes local database data.
  --migrate-nodes  Run the legacy backend/migrate-nodes.js import after schema.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset-volume)
      RESET_VOLUME=true
      ;;
    --migrate-nodes)
      RUN_MIGRATION=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 64
      ;;
  esac
  shift
done

command -v docker >/dev/null 2>&1 || {
  printf 'Docker is not installed or not in PATH.\n' >&2
  exit 127
}
"${COMPOSE[@]}" version >/dev/null 2>&1 || {
  printf 'Docker Compose v2 is required.\n' >&2
  exit 127
}
"${COMPOSE[@]}" config --quiet

if [[ "$RESET_VOLUME" == true ]]; then
  cat >&2 <<'EOF'
WARNING: --reset-volume permanently deletes the SandLabX PostgreSQL volume.
Set SANDLABX_CONFIRM_DATABASE_RESET=YES to confirm this destructive operation.
EOF
  if [[ "${SANDLABX_CONFIRM_DATABASE_RESET:-}" != "YES" ]]; then
    exit 64
  fi
  "${COMPOSE[@]}" down --volumes --remove-orphans
fi

printf 'Starting PostgreSQL...\n'
if "${COMPOSE[@]}" up --help 2>/dev/null | grep -q -- '--wait'; then
  "${COMPOSE[@]}" up -d --wait --wait-timeout "${SANDLABX_STARTUP_TIMEOUT:-180}" postgres
else
  "${COMPOSE[@]}" up -d postgres
fi

printf 'Waiting for PostgreSQL readiness...\n'
ready=false
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready \
      -U "${POSTGRES_USER:-guacamole_user}" \
      -d "${POSTGRES_DB:-guacamole_db}" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done

if [[ "$ready" != true ]]; then
  printf 'PostgreSQL did not become ready within 120 seconds.\n' >&2
  "${COMPOSE[@]}" logs --tail=100 postgres >&2
  exit 1
fi

printf 'Applying the current SandLabX base schema idempotently...\n'
"${COMPOSE[@]}" exec -T postgres \
  psql -v ON_ERROR_STOP=1 \
    -U "${POSTGRES_USER:-guacamole_user}" \
    -d "${POSTGRES_DB:-guacamole_db}" \
    -f /docker-entrypoint-initdb.d/20-sandlabx.sql

if [[ "$RUN_MIGRATION" == true ]]; then
  printf 'Running LEGACY JSON node migration...\n'
  "${COMPOSE[@]}" run --rm --no-deps --entrypoint node backend migrate-nodes.js
fi

printf 'PostgreSQL maintenance completed.\n'
