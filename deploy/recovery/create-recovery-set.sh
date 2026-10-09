#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

require_env RECOVERY_ROOT
[[ "$RECOVERY_ROOT" = /* ]] || fail "RECOVERY_ROOT must be an absolute path"
[[ "${RECOVERY_SITE_OFFLINE_CONFIRMED:-NO}" == "YES" ]] || fail "RECOVERY_SITE_OFFLINE_CONFIRMED must equal YES after traffic is drained and the API is stopped"

RECOVERY_ROOT="$(node "$RECOVERY_DIR/path-safety.mjs" recovery-root "$RECOVERY_ROOT" "$REPO_ROOT" "$STORAGE_ROOT")"
export RECOVERY_ROOT

for command_name in pg_dump psql tar node find; do
  command -v "$command_name" >/dev/null || fail "required command not found: $command_name"
done

set_dir=""
cleanup_recovery() {
  cleanup_native_postgres_auth
  if [[ -n "$set_dir" && -d "$set_dir" && ! -f "$set_dir/RECOVERY-SET.READY" ]]; then
    rm -rf "$set_dir"
  fi
}
trap cleanup_recovery EXIT

assert_source_storage_identity
DATABASE_URL="$DATABASE_URL" DOCUMENT_STORAGE_ROOT="$STORAGE_ROOT" node apps/api/scripts/verify-restored-documents.mjs

unsafe_storage_link="$(find "$STORAGE_ROOT" -type l -print -quit)"
[[ -z "$unsafe_storage_link" ]] || fail "Documents storage contains a symbolic link and cannot form a self-contained recovery set: $unsafe_storage_link"
unsafe_hardlink="$(find "$STORAGE_ROOT" -type f -links +1 -print -quit)"
[[ -z "$unsafe_hardlink" ]] || fail "Documents storage contains a multiply-linked file and cannot form a self-contained recovery set: $unsafe_hardlink"
unsafe_special="$(find "$STORAGE_ROOT" -mindepth 1 ! -type f ! -type d -print -quit)"
[[ -z "$unsafe_special" ]] || fail "Documents storage contains an unsupported special entry; only regular files and directories are allowed: $unsafe_special"

prepare_native_postgres_auth "$DATABASE_URL" native_database_url source_pgpass_file

mkdir -p "$RECOVERY_ROOT"
chmod 700 "$RECOVERY_ROOT"

created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
recovery_set_id="$(date -u +%Y%m%dT%H%M%SZ)-${RELEASE_COMMIT:0:12}"
set_dir="$RECOVERY_ROOT/$recovery_set_id"
[[ ! -e "$set_dir" ]] || fail "recovery set already exists: $set_dir"
mkdir -m 700 "$set_dir"

PGPASSFILE="$source_pgpass_file" pg_dump --format=custom --no-owner --no-privileges --dbname="$native_database_url" > "$set_dir/database.dump"
chmod 600 "$set_dir/database.dump"

tar --create --gzip --directory="$STORAGE_ROOT" --file="$set_dir/documents.tar.gz" .
chmod 600 "$set_dir/documents.tar.gz"

document_file_count="$(find "$STORAGE_ROOT" -type f | wc -l | tr -d ' ')"
postgres_server_version="$(
  PGPASSFILE="$source_pgpass_file"     psql "$native_database_url" --no-psqlrc --tuples-only --no-align --command='SHOW server_version' |
    tr -d '\r\n'
)"
pg_dump_version="$(pg_dump --version | tr -d '\r\n')"

RECOVERY_SET_ID="$recovery_set_id" RECOVERY_CREATED_AT="$created_at" RECOVERY_DOCUMENT_FILE_COUNT="$document_file_count" POSTGRES_SERVER_VERSION="$postgres_server_version" PG_DUMP_VERSION="$pg_dump_version" node "$RECOVERY_DIR/manifest.mjs" create "$set_dir" >/dev/null

printf '%s\n' "$recovery_set_id" > "$set_dir/RECOVERY-SET.READY"
chmod 600 "$set_dir/RECOVERY-SET.READY"
node "$RECOVERY_DIR/manifest.mjs" verify "$set_dir"

cleanup_native_postgres_auth
trap - EXIT
echo "Recovery set created: $set_dir"
printf '%s\n' "$set_dir"
