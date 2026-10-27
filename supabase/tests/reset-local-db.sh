#!/usr/bin/env bash
# Recreate a throwaway database on a plain PostgreSQL, load the Supabase shim
# and apply every migration in order. Used by `npm run test:db` and CI.
set -euo pipefail
: "${DATABASE_ADMIN_URL:=postgres://postgres:postgres@localhost:5432/postgres}"
DB_NAME="${TEST_DB_NAME:-training_test}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB_NAME with (force)" -c "create database $DB_NAME"
DB_URL="${DATABASE_ADMIN_URL%/*}/$DB_NAME"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$DIR/tests/local-auth-shim.sql"
for f in "$DIR"/migrations/*.sql; do
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "$DB_URL"
