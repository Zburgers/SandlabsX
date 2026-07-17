#!/bin/sh
set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

DB_HOST="${DB_HOST:-postgres}"
SCHEMA_DIR="${GUACAMOLE_SCHEMA_DIR:-/guacamole-schema}"

psql_query() {
  psql -h "$DB_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "$1"
}

entity_exists="$(psql_query "SELECT to_regclass('public.guacamole_entity') IS NOT NULL")"
connection_exists="$(psql_query "SELECT to_regclass('public.guacamole_connection') IS NOT NULL")"

if [ "$entity_exists" = "t" ] && [ "$connection_exists" = "t" ]; then
  echo '[guacamole-db-init] existing Guacamole schema is complete'
  exit 0
fi

if [ "$entity_exists" != "f" ] || [ "$connection_exists" != "f" ]; then
  echo '[guacamole-db-init] partial Guacamole schema detected; refusing automatic repair' >&2
  exit 1
fi

first_sql="$(find "$SCHEMA_DIR" -maxdepth 1 -type f -name '*.sql' -print -quit)"
if [ -z "$first_sql" ]; then
  echo "[guacamole-db-init] no vendor schema files found in $SCHEMA_DIR" >&2
  exit 1
fi

echo '[guacamole-db-init] applying version-matched Guacamole vendor schema'
for file in "$SCHEMA_DIR"/*.sql; do
  echo "[guacamole-db-init] applying $file"
  psql -v ON_ERROR_STOP=1 \
    -h "$DB_HOST" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -f "$file"
done

echo '[guacamole-db-init] vendor schema initialized successfully'
