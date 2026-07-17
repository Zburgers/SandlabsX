#!/bin/sh
set -eu

SOURCE_DIR="/opt/guacamole/extensions/guacamole-auth-jdbc/postgresql/schema"
TARGET_DIR="/schema-output"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "[guacamole-schema] schema directory not found: $SOURCE_DIR" >&2
  exit 1
fi

first_sql="$(find "$SOURCE_DIR" -maxdepth 1 -type f -name '*.sql' -print -quit)"
if [ -z "$first_sql" ]; then
  echo "[guacamole-schema] no PostgreSQL schema files found in $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
rm -f "$TARGET_DIR"/*.sql
cp "$SOURCE_DIR"/*.sql "$TARGET_DIR"/

count="$(find "$TARGET_DIR" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
echo "[guacamole-schema] exported $count vendor schema file(s)"
