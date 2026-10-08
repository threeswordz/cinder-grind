#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

set_dir="${1:-}"
[[ -n "$set_dir" ]] || fail "usage: restore-drill.sh <recovery-set-dir>"
set_dir="$(cd "$set_dir" && pwd)"

for required_name in RESTORE_ENVIRONMENT RESTORE_DATABASE_URL RESTORE_STORAGE_ROOT RESTORE_RUNTIME_UID RESTORE_RUNTIME_GID; do
  require_env "$required_name"
done
[[ "$RESTORE_ENVIRONMENT" == "drill" ]] || fail "RESTORE_ENVIRONMENT must equal drill"
[[ "$RESTORE_STORAGE_ROOT" = /* ]] || fail "RESTORE_STORAGE_ROOT must be absolute"
[[ "$RESTORE_DATABASE_URL" != "$DATABASE_URL" ]] || fail "restore drill database must not equal the source database"
[[ "$RESTORE_RUNTIME_UID" =~ ^[0-9]+$ ]] || fail "RESTORE_RUNTIME_UID must be a numeric Unix uid"
[[ "$RESTORE_RUNTIME_GID" =~ ^[0-9]+$ ]] || fail "RESTORE_RUNTIME_GID must be a numeric Unix gid"

for command_name in pg_restore psql tar node pnpm find id chown; do
  command -v "$command_name" >/dev/null || fail "required command not found: $command_name"
done

trap cleanup_native_postgres_auth EXIT

restore_storage_root_raw="$RESTORE_STORAGE_ROOT"
RESTORE_STORAGE_ROOT="$(
  node "$RECOVERY_DIR/path-safety.mjs" restore-storage "$restore_storage_root_raw" "$STORAGE_ROOT"
)"
export RESTORE_STORAGE_ROOT

if [[ -e "$restore_storage_root_raw" ]]; then
  [[ ! -L "$restore_storage_root_raw" ]] || fail "RESTORE_STORAGE_ROOT must not be a symlink"
fi

prepare_native_postgres_auth "$DATABASE_URL" native_source_database_url source_pgpass_file
prepare_native_postgres_auth "$RESTORE_DATABASE_URL" native_restore_database_url restore_pgpass_file

source_database_identity="$(
  PGPASSFILE="$source_pgpass_file" node "$RECOVERY_DIR/postgres-identity.mjs" "$native_source_database_url"
)"
restore_database_identity="$(
  PGPASSFILE="$restore_pgpass_file" node "$RECOVERY_DIR/postgres-identity.mjs" "$native_restore_database_url"
)"
[[ "$source_database_identity" != "$restore_database_identity" ]] || fail "restore target resolves to the source PostgreSQL database; hostname aliases or Prisma schema changes do not isolate a database-level restore"
PGPASSFILE="$restore_pgpass_file" node "$RECOVERY_DIR/verify-empty-database.mjs" "$native_restore_database_url"

if [[ -e "$RESTORE_STORAGE_ROOT" ]]; then
  [[ -d "$RESTORE_STORAGE_ROOT" ]] || fail "RESTORE_STORAGE_ROOT exists and is not a directory"
  [[ -z "$(find "$RESTORE_STORAGE_ROOT" -mindepth 1 -print -quit)" ]] || fail "RESTORE_STORAGE_ROOT must be empty"
else
  mkdir -m 700 "$RESTORE_STORAGE_ROOT"
fi

EXPECTED_RECOVERY_RELEASE_COMMIT="$RELEASE_COMMIT" EXPECTED_STORAGE_DEPLOYMENT_ID="$STORAGE_DEPLOYMENT_ID" bash "$RECOVERY_DIR/verify-recovery-set.sh" "$set_dir"

DATABASE_URL="$RESTORE_DATABASE_URL" DEPLOYMENT_MODE=fresh node apps/api/scripts/verify-production-target.mjs

started_epoch="$(date +%s)"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

PGPASSFILE="$restore_pgpass_file" pg_restore --exit-on-error --no-owner --no-privileges --dbname="$native_restore_database_url" < "$set_dir/database.dump"

# Never preserve archive ownership implicitly. After extraction, assign the
# explicitly configured API runtime uid/gid (or require the operator to already
# be that account when not privileged).
tar --extract --gzip --no-same-owner --directory="$RESTORE_STORAGE_ROOT" --file="$set_dir/documents.tar.gz"

current_uid="$(id -u)"
current_gid="$(id -g)"
if [[ "$current_uid" != "$RESTORE_RUNTIME_UID" || "$current_gid" != "$RESTORE_RUNTIME_GID" ]]; then
  [[ "$current_uid" == "0" ]] || fail "restore must run as the configured runtime uid/gid or as root so restored Documents ownership can be assigned"
  chown --recursive --no-dereference "$RESTORE_RUNTIME_UID:$RESTORE_RUNTIME_GID" "$RESTORE_STORAGE_ROOT"
fi

ownership_mismatch="$(
  find "$RESTORE_STORAGE_ROOT" \( ! -uid "$RESTORE_RUNTIME_UID" -o ! -gid "$RESTORE_RUNTIME_GID" \) -print -quit
)"
[[ -z "$ownership_mismatch" ]] || fail "restored Documents ownership does not match configured runtime uid/gid: $ownership_mismatch"

DATABASE_URL="$RESTORE_DATABASE_URL" pnpm --filter @construction-erp/api exec prisma migrate status
DATABASE_URL="$RESTORE_DATABASE_URL" RESTORE_STORAGE_ROOT="$RESTORE_STORAGE_ROOT" node apps/api/scripts/verify-restored-documents.mjs

completed_epoch="$(date +%s)"
completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
duration_seconds="$((completed_epoch - started_epoch))"
evidence_file="$set_dir/restore-drill-evidence.json"

RESTORE_STARTED_AT="$started_at" RESTORE_COMPLETED_AT="$completed_at" RESTORE_DURATION_SECONDS="$duration_seconds" RESTORE_EVIDENCE_FILE="$evidence_file" node <<'NODE'
const { writeFileSync, chmodSync } = require('node:fs');
const evidence = {
  version: 1,
  environment: process.env.RESTORE_ENVIRONMENT,
  startedAt: process.env.RESTORE_STARTED_AT,
  completedAt: process.env.RESTORE_COMPLETED_AT,
  durationSeconds: Number(process.env.RESTORE_DURATION_SECONDS),
  databaseRestore: 'PASS',
  migrationStatus: 'PASS',
  documentMetadataContentConsistency: 'PASS',
  documentRuntimeOwnership: 'PASS',
};
writeFileSync(process.env.RESTORE_EVIDENCE_FILE, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
chmodSync(process.env.RESTORE_EVIDENCE_FILE, 0o600);
NODE

cleanup_native_postgres_auth
trap - EXIT
echo "Isolated restore drill passed in ${duration_seconds}s."
