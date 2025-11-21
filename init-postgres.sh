#!/bin/bash

# Reinitialize the SandlabX PostgreSQL database and ensure the sandlabx_nodes
# schema exists. Optionally reset the volume and migrate JSON state into
# Postgres.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RESET_VOLUME=false
RUN_MIGRATION=false

usage() {
  cat <<'EOF'
Usage: ./init-postgres.sh [--reset-volume] [--migrate-nodes]

  --reset-volume   Stop containers, remove the pgdata volume, and start fresh.
  --migrate-nodes  Run backend/migrate-nodes.js inside the backend container
                   after the schema has been applied.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset-volume)
      RESET_VOLUME=true
      shift
      ;;
    --migrate-nodes)
      RUN_MIGRATION=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac

done

if command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
elif command -v docker >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
else
  echo "❌ Docker is not installed or not in PATH" >&2
  exit 1
fi

if [[ "$RESET_VOLUME" == "true" ]]; then
  echo "🧹 Resetting PostgreSQL volume..."
  $DOCKER_COMPOSE down --volumes --remove-orphans
  rm -rf pgdata
fi

echo "🐘 Starting PostgreSQL container..."
$DOCKER_COMPOSE up -d postgres

echo "⏳ Waiting for PostgreSQL to become ready..."
until $DOCKER_COMPOSE exec -T postgres pg_isready -U guacamole_user -d guacamole_db >/dev/null 2>&1; do
  sleep 2
done

echo "🗂️  Applying sandlabx_nodes schema..."
$DOCKER_COMPOSE exec -T postgres \
  psql -U guacamole_user -d guacamole_db \
  -f /docker-entrypoint-initdb.d/nodes-schema.sql

echo "✅ sandlabx_nodes schema ensured"

if [[ "$RUN_MIGRATION" == "true" ]]; then
  echo "📦 Migrating nodes from JSON state file..."
  $DOCKER_COMPOSE run --rm backend node migrate-nodes.js
  echo "✅ Migration complete"
fi

echo "🎉 PostgreSQL init finished"
