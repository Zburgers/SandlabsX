#!/bin/sh
set -eu

INITDB_SCRIPT="/opt/guacamole/bin/initdb.sh"
TARGET_DIR="/schema-output"
TARGET_FILE="$TARGET_DIR/001-guacamole-postgresql.sql"
TEMP_FILE="$TARGET_FILE.tmp"

if [ ! -x "$INITDB_SCRIPT" ]; then
  echo "[guacamole-schema] initdb utility is unavailable: $INITDB_SCRIPT" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
rm -f "$TARGET_DIR"/*.sql "$TEMP_FILE"

"$INITDB_SCRIPT" --postgresql > "$TEMP_FILE"

if [ ! -s "$TEMP_FILE" ]; then
  echo '[guacamole-schema] generated PostgreSQL schema is empty' >&2
  rm -f "$TEMP_FILE"
  exit 1
fi

mv "$TEMP_FILE" "$TARGET_FILE"
echo "[guacamole-schema] generated vendor schema: $TARGET_FILE"
