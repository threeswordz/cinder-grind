#!/usr/bin/env bash
set -euo pipefail

RC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$RC_DIR/../.." && pwd)"
cd "$REPO_ROOT"

fail() {
  echo "V1.0-E migration-aware rehearsal failed: $*" >&2
  exit 1
}

: "${RC_NON_PRODUCTION_CONFIRMED:=}"
: "${RC_PREVIOUS_RELEASE_COMMIT:=}"
: "${RC_BASE_DATABASE_URL:=${DATABASE_URL:-}}"
: "${RELEASE_COMMIT:=${GITHUB_SHA:-}}"
: "${RC_ENVIRONMENT:=ci}"
: "${RC_EVIDENCE_FILE:=/tmp/v1-0-e-rehearsal.json}"
: "${RC_POSTGRES_TOOL_MODE:=docker}"

printf '%s\n' '{"version":1,"rehearsalStatus":"INCOMPLETE"}' > "$RC_EVIDENCE_FILE"
chmod 600 "$RC_EVIDENCE_FILE"

[[ "$RC_NON_PRODUCTION_CONFIRMED" == "YES" ]] || fail "RC_NON_PRODUCTION_CONFIRMED must equal YES"
[[ "$RELEASE_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || fail "RELEASE_COMMIT must be a full Git SHA"
[[ "$RC_PREVIOUS_RELEASE_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || fail "RC_PREVIOUS_RELEASE_COMMIT must be a full Git SHA"
[[ -n "$RC_BASE_DATABASE_URL" ]] || fail "RC_BASE_DATABASE_URL or DATABASE_URL is required"

normalized_environment="${RC_ENVIRONMENT,,}"
normalized_environment="${normalized_environment#"${normalized_environment%%[![:space:]]*}"}"
normalized_environment="${normalized_environment%"${normalized_environment##*[![:space:]]}"}"
[[ -n "$normalized_environment" && "$normalized_environment" != "production" ]] || fail "rehearsal must use a non-Production environment"
RC_ENVIRONMENT="$normalized_environment"

actual_commit="$(git rev-parse HEAD)"
[[ "$actual_commit" == "$RELEASE_COMMIT" ]] || fail "exact checkout mismatch: expected $RELEASE_COMMIT, got $actual_commit"
[[ -z "$(git status --porcelain)" ]] || fail "rehearsal requires a clean Git working tree"
git cat-file -e "$RC_PREVIOUS_RELEASE_COMMIT^{commit}" 2>/dev/null || fail "previous release commit is unavailable"
git merge-base --is-ancestor "$RC_PREVIOUS_RELEASE_COMMIT" "$RELEASE_COMMIT" || fail "previous release is not an ancestor of candidate"

if git diff --quiet "$RC_PREVIOUS_RELEASE_COMMIT" "$RELEASE_COMMIT" -- apps/api/prisma/migrations; then
  fail "migration-aware rehearsal requires at least one forward migration"
fi
git diff --quiet "$RC_PREVIOUS_RELEASE_COMMIT" "$RELEASE_COMMIT" -- apps/api/prisma/schema.prisma \
  || fail "bounded migration-aware rehearsal supports SQL-only migrations with unchanged Prisma schema"

migration_change_lines=()
while IFS= read -r line; do
  [[ -n "$line" ]] && migration_change_lines+=("$line")
done < <(git diff --name-status "$RC_PREVIOUS_RELEASE_COMMIT" "$RELEASE_COMMIT" -- apps/api/prisma/migrations)

new_migrations=()
for migration_change in "${migration_change_lines[@]}"; do
  status="${migration_change%%$'\t'*}"
  path="${migration_change#*$'\t'}"
  [[ "$status" == "A" ]] || fail "only additive forward migrations are permitted; found $status for $path"
  [[ "$path" == apps/api/prisma/migrations/*/migration.sql ]] || fail "unexpected migration artifact changed: $path"
  migration_name="${path#apps/api/prisma/migrations/}"
  migration_name="${migration_name%%/*}"
  [[ "$migration_name" =~ ^[0-9]{14}_[A-Za-z0-9_]+$ ]] || fail "invalid migration directory: $migration_name"
  new_migrations+=("$migration_name")
done
mapfile -t new_migrations < <(printf '%s\n' "${new_migrations[@]}" | sort -u)
(( ${#new_migrations[@]} > 0 )) || fail "no new forward migrations detected"
migration_list="$(IFS=,; printf '%s' "${new_migrations[*]}")"

for command_name in git node pnpm tar; do
  command -v "$command_name" >/dev/null || fail "required command not found: $command_name"
done

tmp_root="$(mktemp -d /tmp/construction-erp-v10e-migration.XXXXXX)"
tool_dir="$tmp_root/pg-bin"
previous_root="$tmp_root/previous-release"
storage_root="$tmp_root/documents"
rollback_storage="$tmp_root/rollback-documents"
recovery_root="$tmp_root/recovery"
production_env="$tmp_root/production.env"
recovery_env="$tmp_root/recovery.env"
mkdir -p "$tool_dir" "$previous_root" "$storage_root" "$rollback_storage" "$recovery_root"

admin_pgpass=""
upgrade_pgpass=""
rollback_pgpass=""
created_databases=()

if [[ "$RC_POSTGRES_TOOL_MODE" == "docker" ]]; then
  command -v docker >/dev/null || fail "required command not found: docker"
  cat > "$tool_dir/psql" <<'PSQL'
#!/usr/bin/env bash
set -euo pipefail
args=(--rm --network host)
if [[ -n "${PGPASSFILE:-}" ]]; then
  args+=(--volume "$PGPASSFILE:/tmp/construction-erp-pgpass:ro" --env PGPASSFILE=/tmp/construction-erp-pgpass)
fi
exec docker run "${args[@]}" postgres:17.11-alpine psql "$@"
PSQL
  cat > "$tool_dir/pg_dump" <<'PG_DUMP'
#!/usr/bin/env bash
set -euo pipefail
args=(--rm --network host)
if [[ -n "${PGPASSFILE:-}" ]]; then
  args+=(--volume "$PGPASSFILE:/tmp/construction-erp-pgpass:ro" --env PGPASSFILE=/tmp/construction-erp-pgpass)
fi
exec docker run "${args[@]}" postgres:17.11-alpine pg_dump "$@"
PG_DUMP
  cat > "$tool_dir/pg_restore" <<'PG_RESTORE'
#!/usr/bin/env bash
set -euo pipefail
args=(--rm -i --network host)
if [[ -n "${PGPASSFILE:-}" ]]; then
  args+=(--volume "$PGPASSFILE:/tmp/construction-erp-pgpass:ro" --env PGPASSFILE=/tmp/construction-erp-pgpass)
fi
exec docker run "${args[@]}" postgres:17.11-alpine pg_restore "$@"
PG_RESTORE
  chmod +x "$tool_dir/psql" "$tool_dir/pg_dump" "$tool_dir/pg_restore"
  export PATH="$tool_dir:$PATH"
else
  for command_name in psql pg_dump pg_restore; do
    command -v "$command_name" >/dev/null || fail "native PostgreSQL command not found: $command_name"
  done
fi

git_version="$(git --version)"
node_version="$(node --version)"
pnpm_version="$(pnpm --version)"
postgresql_client_version="$(psql --version)"

database_url() {
  RC_BASE_DATABASE_URL="$RC_BASE_DATABASE_URL" node "$RC_DIR/database-url.mjs" "$1"
}

run_token="$(node -e "process.stdout.write(require('node:crypto').randomBytes(6).toString('hex'))")"
fresh_database="construction_erp_v10e_fresh_${run_token}"
upgrade_database="construction_erp_v10e_upgrade_${run_token}"
rollback_database="construction_erp_v10e_rollback_${run_token}"
fresh_url="$(database_url "$fresh_database")"
upgrade_url="$(database_url "$upgrade_database")"
rollback_url="$(database_url "$rollback_database")"
admin_url="$(database_url postgres)"

admin_pgpass="$(mktemp)"
chmod 600 "$admin_pgpass"
native_admin_url="$(POSTGRES_RAW_URL="$admin_url" PGPASSFILE="$admin_pgpass" node deploy/recovery/postgres-url.mjs)"

create_database() {
  local name="$1"
  [[ "$name" =~ ^construction_erp_v10e_(fresh|upgrade|rollback)_[a-f0-9]{12}$ ]] || fail "invalid rehearsal database name"
  PGPASSFILE="$admin_pgpass" psql "$native_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 \
    --command="CREATE DATABASE \"$name\""
  created_databases+=("$name")
}

cleanup_resources() {
  local failed=0
  set +e
  for db in "${created_databases[@]}"; do
    if [[ "$db" =~ ^construction_erp_v10e_(fresh|upgrade|rollback)_[a-f0-9]{12}$ ]]; then
      PGPASSFILE="$admin_pgpass" psql "$native_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 \
        --command="DROP DATABASE IF EXISTS \"$db\" WITH (FORCE)" >/dev/null 2>&1 || failed=1
    else
      failed=1
    fi
  done
  [[ -n "$admin_pgpass" ]] && rm -f "$admin_pgpass"
  [[ -n "$upgrade_pgpass" ]] && rm -f "$upgrade_pgpass"
  [[ -n "$rollback_pgpass" ]] && rm -f "$rollback_pgpass"
  rm -rf "$tmp_root"
  set -e
  return "$failed"
}

on_exit() {
  local status=$?
  trap - EXIT
  cleanup_resources || true
  exit "$status"
}
trap on_exit EXIT

create_database "$fresh_database"
create_database "$upgrade_database"
create_database "$rollback_database"

echo "[V1.0-E migration-aware] Fresh candidate migration-from-zero"
DATABASE_URL="$fresh_url" DEPLOYMENT_MODE=fresh node apps/api/scripts/verify-production-target.mjs
DATABASE_URL="$fresh_url" pnpm prisma:migrate:deploy
DATABASE_URL="$fresh_url" pnpm --filter @construction-erp/api exec prisma migrate status

echo "[V1.0-E migration-aware] Build exact previous-release schema fixture"
git archive "$RC_PREVIOUS_RELEASE_COMMIT" apps/api/prisma | tar --extract --directory="$previous_root"
previous_schema="$previous_root/apps/api/prisma/schema.prisma"
[[ -f "$previous_schema" ]] || fail "previous-release Prisma schema archive is missing"
DATABASE_URL="$upgrade_url" DEPLOYMENT_MODE=fresh node apps/api/scripts/verify-production-target.mjs
DATABASE_URL="$upgrade_url" pnpm --filter @construction-erp/api exec prisma migrate deploy --schema "$previous_schema"
DATABASE_URL="$upgrade_url" pnpm --filter @construction-erp/api exec prisma migrate status --schema "$previous_schema"

if [[ ! -f apps/api/dist/scripts/bootstrap-admin.js ]]; then
  pnpm build:api
fi
DATABASE_URL="$upgrade_url" \
BOOTSTRAP_COMPANY_CODE=V10ERC \
BOOTSTRAP_COMPANY_NAME="V1.0-E RC Migration Rehearsal" \
BOOTSTRAP_ADMIN_EMAIL=rc-admin@example.invalid \
BOOTSTRAP_ADMIN_DISPLAY_NAME="RC System Administrator" \
BOOTSTRAP_ADMIN_PASSWORD='Rc-Admin-Password-2026!' \
pnpm --filter @construction-erp/api bootstrap:admin

storage_deployment_id="v10e-${GITHUB_RUN_ID:-local}"
printf 'construction-erp-production-storage-v1:%s\n' "$storage_deployment_id" > "$storage_root/.construction-erp-storage-ready"
chmod 600 "$storage_root/.construction-erp-storage-ready"

cat > "$recovery_env" <<EOF
NODE_ENV=production
RELEASE_COMMIT=$RELEASE_COMMIT
DATABASE_URL=$upgrade_url
STORAGE_ROOT=$storage_root
STORAGE_DEPLOYMENT_ID=$storage_deployment_id
EOF
chmod 600 "$recovery_env"

echo "[V1.0-E migration-aware] Create paired pre-upgrade recovery set"
RECOVERY_ROOT="$recovery_root" \
RECOVERY_SITE_OFFLINE_CONFIRMED=YES \
PRODUCTION_ENV_FILE="$recovery_env" \
bash deploy/recovery/create-recovery-set.sh | tee "$tmp_root/recovery-create.log"
recovery_set="$(tail -n 1 "$tmp_root/recovery-create.log")"
[[ -d "$recovery_set" ]] || fail "recovery set was not created"
bash deploy/recovery/verify-recovery-set.sh "$recovery_set"
recovery_reference="$(basename "$recovery_set")"

cat > "$production_env" <<EOF
NODE_ENV=production
RELEASE_COMMIT=$RELEASE_COMMIT
DEPLOYMENT_MODE=upgrade
UPGRADE_SITE_OFFLINE_CONFIRMED=YES
RECOVERY_POINT_VERIFIED=YES
RECOVERY_POINT_REFERENCE=$recovery_reference
API_HOST=127.0.0.1
API_PORT=3001
WEB_ORIGIN=https://erp.example.invalid
VITE_API_BASE_URL=/api/v1
DATABASE_URL=$upgrade_url
STORAGE_ROOT=$storage_root
STORAGE_DEPLOYMENT_ID=$storage_deployment_id
DOCUMENT_UPLOAD_TEMP_ROOT=$tmp_root/uploads
DOCUMENT_MAX_FILE_BYTES=26214400
DOCUMENT_ALLOWED_MIME_TYPES=application/pdf,image/jpeg,image/png,text/plain,text/csv
SESSION_TTL_HOURS=8
LOGIN_RATE_LIMIT_MAX=100
LOGIN_RATE_LIMIT_WINDOW_MINUTES=15
REQUEST_BODY_MAX_BYTES=1048576
TRUSTED_PROXY_ADDRESSES=127.0.0.1
OPENAPI_ENABLED=false
EOF
chmod 600 "$production_env"
mkdir -p "$tmp_root/uploads"

echo "[V1.0-E migration-aware] Execute actual Production preparation path"
PRODUCTION_ENV_FILE="$production_env" bash deploy/production/prepare-release.sh

upgrade_pgpass="$(mktemp)"
chmod 600 "$upgrade_pgpass"
native_upgrade_url="$(POSTGRES_RAW_URL="$upgrade_url" PGPASSFILE="$upgrade_pgpass" node deploy/recovery/postgres-url.mjs)"
for migration_name in "${new_migrations[@]}"; do
  applied_count="$(PGPASSFILE="$upgrade_pgpass" psql "$native_upgrade_url" --no-psqlrc --tuples-only --no-align \
    --command="SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE \"migration_name\" = '${migration_name}' AND \"finished_at\" IS NOT NULL AND \"rolled_back_at\" IS NULL" | tr -d '\r\n ')"
  [[ "$applied_count" == "1" ]] || fail "candidate migration was not applied exactly once: $migration_name"
done

echo "[V1.0-E migration-aware] Restore paired pre-upgrade recovery into isolated rollback target"
rollback_pgpass="$(mktemp)"
chmod 600 "$rollback_pgpass"
native_rollback_url="$(POSTGRES_RAW_URL="$rollback_url" PGPASSFILE="$rollback_pgpass" node deploy/recovery/postgres-url.mjs)"
PGPASSFILE="$rollback_pgpass" pg_restore --exit-on-error --no-owner --no-privileges \
  --dbname="$native_rollback_url" < "$recovery_set/database.dump"
tar --extract --gzip --no-same-owner --directory="$rollback_storage" --file="$recovery_set/documents.tar.gz"

DATABASE_URL="$rollback_url" pnpm --filter @construction-erp/api exec prisma migrate status --schema "$previous_schema"
DATABASE_URL="$rollback_url" RESTORE_STORAGE_ROOT="$rollback_storage" node apps/api/scripts/verify-restored-documents.mjs
[[ -f "$rollback_storage/.construction-erp-storage-ready" ]] || fail "restored Documents sentinel is missing"
[[ "$(cat "$rollback_storage/.construction-erp-storage-ready")" == "construction-erp-production-storage-v1:$storage_deployment_id" ]] \
  || fail "restored Documents sentinel does not match pre-upgrade recovery"

restored_admin_count="$(PGPASSFILE="$rollback_pgpass" psql "$native_rollback_url" --no-psqlrc --tuples-only --no-align \
  --command="SELECT COUNT(*) FROM \"users\" WHERE \"email\" = 'rc-admin@example.invalid'" | tr -d '\r\n ')"
[[ "$restored_admin_count" == "1" ]] || fail "pre-upgrade application data was not restored"

for migration_name in "${new_migrations[@]}"; do
  rollback_count="$(PGPASSFILE="$rollback_pgpass" psql "$native_rollback_url" --no-psqlrc --tuples-only --no-align \
    --command="SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE \"migration_name\" = '${migration_name}'" | tr -d '\r\n ')"
  [[ "$rollback_count" == "0" ]] || fail "rollback database still contains candidate migration: $migration_name"
done

set +e
DATABASE_URL="$rollback_url" pnpm --filter @construction-erp/api exec prisma migrate status \
  > "$tmp_root/candidate-status-on-rollback.log" 2>&1
candidate_status=$?
set -e
[[ "$candidate_status" -ne 0 ]] || fail "candidate migration status unexpectedly treats pre-upgrade restore as current"

ci_provider="native"
ci_workflow=""
ci_workflow_ref=""
ci_run_id=""
ci_run_number=""
ci_run_attempt=""
ci_job=""
ci_repository=""
if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  ci_provider="github-actions"
  ci_workflow="${GITHUB_WORKFLOW:?}"
  ci_workflow_ref="${GITHUB_WORKFLOW_REF:?}"
  ci_run_id="${GITHUB_RUN_ID:?}"
  ci_run_number="${GITHUB_RUN_NUMBER:?}"
  ci_run_attempt="${GITHUB_RUN_ATTEMPT:?}"
  ci_job="${GITHUB_JOB:?}"
  ci_repository="${GITHUB_REPOSITORY:?}"
fi

if ! cleanup_resources; then
  fail "database cleanup was incomplete"
fi
trap - EXIT

node - "$RC_EVIDENCE_FILE" "$RELEASE_COMMIT" "$RC_PREVIOUS_RELEASE_COMMIT" "$RC_ENVIRONMENT" \
  "$recovery_reference" "$git_version" "$node_version" "$pnpm_version" "$postgresql_client_version" \
  "$ci_provider" "$ci_workflow" "$ci_workflow_ref" "$ci_run_id" "$ci_run_number" "$ci_run_attempt" \
  "$ci_job" "$ci_repository" "$migration_list" <<'NODE'
const { writeFileSync } = require('node:fs');
const [
  path, releaseCommit, previousReleaseCommit, environment, recoveryReference,
  gitVersion, nodeVersion, pnpmVersion, postgresqlClientVersion,
  ciProvider, ciWorkflow, ciWorkflowRef, ciRunId, ciRunNumber, ciRunAttempt,
  ciJob, ciRepository, migrationList,
] = process.argv.slice(2);
const nullable = (value) => value === '' ? null : value;
writeFileSync(path, JSON.stringify({
  version: 3,
  releaseMode: 'migration-aware-sql-only',
  releaseCommit,
  previousReleaseCommit,
  environment,
  toolVersions: {
    git: gitVersion,
    node: nodeVersion,
    pnpm: pnpmVersion,
    postgresqlClient: postgresqlClientVersion,
  },
  ci: {
    provider: ciProvider,
    workflow: nullable(ciWorkflow),
    workflowRef: nullable(ciWorkflowRef),
    runId: nullable(ciRunId),
    runNumber: nullable(ciRunNumber),
    runAttempt: nullable(ciRunAttempt),
    job: nullable(ciJob),
    repository: nullable(ciRepository),
  },
  exactCheckout: 'PASS',
  cleanTree: 'PASS',
  migrationHistoryChanged: 'PASS',
  prismaSchemaUnchanged: 'PASS',
  forwardOnlyNewMigrations: 'PASS',
  migrationNames: migrationList.split(',').filter(Boolean),
  freshMigration: 'PASS',
  previousReleaseFixture: 'PASS',
  verifiedRecoveryPoint: 'PASS',
  recoveryReference,
  productionPreparation: 'PASS',
  migrationAwareUpgrade: 'PASS',
  rollbackRestore: 'PASS',
  rollbackPreviousMigrationStatus: 'PASS',
  rollbackCandidateMigrationsAbsent: 'PASS',
  rollbackDocuments: 'PASS',
  applicationOnlyRollbackProhibited: 'PASS',
  rollbackReadiness: 'PASS',
  rollbackDecision:
    'migration-bearing rollback requires the matching pre-upgrade database + Documents recovery set; application-only rollback is prohibited',
  humanReleaseGates: {
    'AC-V10-039': 'NOT_COMPLETED',
    'AC-V10-040': 'NOT_COMPLETED',
  },
}, null, 2) + '\n', { mode: 0o600 });
NODE

echo "V1.0-E migration-aware release-candidate rehearsal PASSED for $RELEASE_COMMIT"
echo "Evidence: $RC_EVIDENCE_FILE"
