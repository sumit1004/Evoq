#!/usr/bin/env sh
set -eu

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:=3306}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"

test -f "$BACKUP_FILE"
printf 'Restoring %s into %s. This is destructive. Type RESTORE to continue: ' "$BACKUP_FILE" "$DB_NAME"
read confirmation
test "$confirmation" = RESTORE
MYSQL_PWD="$DB_PASSWORD" gzip -dc "$BACKUP_FILE" | mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME"
