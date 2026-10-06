#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

set_dir="${1:-}"
[[ -n "$set_dir" ]] || fail "usage: restore-drill.sh <recovery-set-dir>"
set_dir="$(cd "$set_dir" && pwd)"

for required_name in RESTORE_ENVIRONMENT RESTORE_DATABASE_URL RESTORE_STORAGE_ROOT; do
  require_env "$required_name"
done
[[ "$RESTORE_ENVIRONMENT" == "drill" ]] || fail "RESTORE_ENVIRONMENT must equal drill"
[[ "$RESTORE_STORAGE_ROOT" = /* ]] || fail "RESTORE_STORAGE_ROOT must be absolute"
[[ "$RESTORE_DATABASE_URL" != "$DATABASE_URL" ]] || fail "restore drill database must not equal the source database"
[[ "$RESTORE_STORAGE_ROOT" != "$STORAGE_ROOT" ]] || fail "restore drill storage must not equal the source Documents storage"

node - "$DATABASE_URL" "$RESTORE_DATABASE_URL" <<'NODE'
const [source, target] = process.argv.slice(2).map((raw) => new URL(raw));
const key = (url) => [
  url.hostname.toLowerCase(),
  url.port || '5432',
  decodeURIComponent(url.pathname.replace(/^\//, '')),
  url.searchParams.get('schema') || 'public',
].join('|');
if (key(source) === key(target)) {
  process.stderr.write('Recovery safety check failed: restore target resolves to the source PostgreSQL database/schema.\n');
  process.exit(1);
}
NODE

if [[ -e "$RESTORE_STORAGE_ROOT" ]]; then
  [[ ! -L "$RESTORE_STORAGE_ROOT" ]] || fail "RESTORE_STORAGE_ROOT must not be a symlink"
  [[ -d "$RESTORE_STORAGE_ROOT" ]] || fail "RESTORE_STORAGE_ROOT exists and is not a directory"
  [[ -z "$(find "$RESTORE_STORAGE_ROOT" -mindepth 1 -print -quit)" ]] || fail "RESTORE_STORAGE_ROOT must be empty"
else
  mkdir -m 700 "$RESTORE_STORAGE_ROOT"
fi

for command_name in pg_restore tar node pnpm; do
  command -v "$command_name" >/dev/null || fail "required command not found: $command_name"
done

EXPECTED_RECOVERY_RELEASE_COMMIT="$RELEASE_COMMIT" \
EXPECTED_STORAGE_DEPLOYMENT_ID="$STORAGE_DEPLOYMENT_ID" \
bash "$RECOVERY_DIR/verify-recovery-set.sh" "$set_dir"

DATABASE_URL="$RESTORE_DATABASE_URL" DEPLOYMENT_MODE=fresh \
node apps/api/scripts/verify-production-target.mjs

started_epoch="$(date +%s)"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

pg_restore --exit-on-error --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" < "$set_dir/database.dump"
tar --extract --gzip --directory="$RESTORE_STORAGE_ROOT" --file="$set_dir/documents.tar.gz"

DATABASE_URL="$RESTORE_DATABASE_URL" pnpm --filter @construction-erp/api exec prisma migrate status
DATABASE_URL="$RESTORE_DATABASE_URL" RESTORE_STORAGE_ROOT="$RESTORE_STORAGE_ROOT" \
node apps/api/scripts/verify-restored-documents.mjs

completed_epoch="$(date +%s)"
completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
duration_seconds="$((completed_epoch - started_epoch))"
evidence_file="$set_dir/restore-drill-evidence.json"

RESTORE_STARTED_AT="$started_at" \
RESTORE_COMPLETED_AT="$completed_at" \
RESTORE_DURATION_SECONDS="$duration_seconds" \
RESTORE_EVIDENCE_FILE="$evidence_file" \
node <<'NODE'
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
};
writeFileSync(process.env.RESTORE_EVIDENCE_FILE, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
chmodSync(process.env.RESTORE_EVIDENCE_FILE, 0o600);
NODE

echo "Isolated restore drill passed in ${duration_seconds}s."
