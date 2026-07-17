#!/usr/bin/env bash
set -Eeuo pipefail

# PostgreSQL maintenance helper.
#
# SandLabX schema changes are owned exclusively by node-pg-migrate. This script
# starts PostgreSQL, initializes the version-matched Guacamole vendor schema,
# applies pending SandLabX migrations, and optionally imports legacy JSON nodes.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE=(docker compose)
RESET_VOLUME=false
RUN_NODE_IMPORT=false

usage() {
  cat <<'EOF'
Usage: ./scripts/init-postgres.sh [--reset-volume] [--migrate-nodes]

  --reset-volume   Stop the stack and remove all named project volumes.
                   This permanently deletes local database data.
  --migrate-nodes  Run the LEGACY backend/migrate-nodes.js JSON import after
                   the versioned schema migrations complete.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset-volume)
      RESET_VOLUME=true
      ;;
    --migrate-nodes)
      RUN_NODE_IMPORT=true
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
WARNING: --reset-volume permanently deletes SandLabX project volumes.
Set SANDLABX_CONFIRM_DATABASE_RESET=YES to confirm this destructive operation.
EOF
  if [[ "${SANDLABX_CONFIRM_DATABASE_RESET:-}" != "YES" ]]; then
    exit 64
  fi
  "${COMPOSE[@]}" down --volumes --remove-orphans
fi

printf 'Starting PostgreSQL...\n'
"${COMPOSE[@]}" up -d postgres

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

printf 'Preparing Guacamole vendor schema files...\n'
"${COMPOSE[@]}" run --rm --no-deps guacamole-schema

printf 'Ensuring Guacamole vendor schema...\n'
"${COMPOSE[@]}" run --rm --no-deps guacamole-db-init

printf 'Applying versioned SandLabX migrations...\n'
"${COMPOSE[@]}" run --rm --no-deps --build migrate

if [[ "$RUN_NODE_IMPORT" == true ]]; then
  printf 'Running LEGACY JSON node import...\n'
  "${COMPOSE[@]}" run --rm --no-deps --entrypoint node backend migrate-nodes.js
fi

printf 'PostgreSQL maintenance completed successfully.\n'
