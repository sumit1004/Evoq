#!/usr/bin/env sh
set -eu

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:=3306}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${BACKUP_DIR:=./backups}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$BACKUP_DIR/${DB_NAME}-${timestamp}.sql.gz"
MYSQL_PWD="$DB_PASSWORD" mysqldump --single-transaction --routines --triggers --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME" | gzip > "$output"
printf '%s\n' "$output"
