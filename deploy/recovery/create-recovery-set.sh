#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

require_env RECOVERY_ROOT
[[ "$RECOVERY_ROOT" = /* ]] || fail "RECOVERY_ROOT must be an absolute path"
[[ "${RECOVERY_SITE_OFFLINE_CONFIRMED:-NO}" == "YES" ]] || fail "RECOVERY_SITE_OFFLINE_CONFIRMED must equal YES after traffic is drained and the API is stopped"

case "$RECOVERY_ROOT/" in
  "$REPO_ROOT/"*|"$STORAGE_ROOT/"*) fail "RECOVERY_ROOT must be outside the repository and Documents storage" ;;
esac
case "$STORAGE_ROOT/" in
  "$RECOVERY_ROOT/"*) fail "STORAGE_ROOT must not be inside RECOVERY_ROOT" ;;
esac

for command_name in pg_dump psql tar node find; do
  command -v "$command_name" >/dev/null || fail "required command not found: $command_name"
done

assert_source_storage_identity
native_database_url="$(node "$RECOVERY_DIR/postgres-url.mjs" "$DATABASE_URL")"
mkdir -p "$RECOVERY_ROOT"
chmod 700 "$RECOVERY_ROOT"

created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
recovery_set_id="$(date -u +%Y%m%dT%H%M%SZ)-${RELEASE_COMMIT:0:12}"
set_dir="$RECOVERY_ROOT/$recovery_set_id"
[[ ! -e "$set_dir" ]] || fail "recovery set already exists: $set_dir"
mkdir -m 700 "$set_dir"

cleanup_incomplete() {
  if [[ -d "$set_dir" && ! -f "$set_dir/RECOVERY-SET.READY" ]]; then
    rm -rf "$set_dir"
  fi
}
trap cleanup_incomplete EXIT

pg_dump --format=custom --no-owner --no-privileges --dbname="$native_database_url" > "$set_dir/database.dump"
chmod 600 "$set_dir/database.dump"

tar --create --gzip --directory="$STORAGE_ROOT" --file="$set_dir/documents.tar.gz" .
chmod 600 "$set_dir/documents.tar.gz"

document_file_count="$(find "$STORAGE_ROOT" -type f | wc -l | tr -d ' ')"
postgres_server_version="$(psql "$native_database_url" --no-psqlrc --tuples-only --no-align --command='SHOW server_version' | tr -d '\r\n')"
pg_dump_version="$(pg_dump --version | tr -d '\r\n')"

RECOVERY_SET_ID="$recovery_set_id" \
RECOVERY_CREATED_AT="$created_at" \
RECOVERY_DOCUMENT_FILE_COUNT="$document_file_count" \
POSTGRES_SERVER_VERSION="$postgres_server_version" \
PG_DUMP_VERSION="$pg_dump_version" \
node "$RECOVERY_DIR/manifest.mjs" create "$set_dir" >/dev/null

printf '%s\n' "$recovery_set_id" > "$set_dir/RECOVERY-SET.READY"
chmod 600 "$set_dir/RECOVERY-SET.READY"
node "$RECOVERY_DIR/manifest.mjs" verify "$set_dir"

trap - EXIT
echo "Recovery set created: $set_dir"
printf '%s\n' "$set_dir"
