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
schema_mode="migration-aware-sql-only"
if ! git diff --quiet "$RC_PREVIOUS_RELEASE_COMMIT" "$RELEASE_COMMIT" -- apps/api/prisma/schema.prisma; then
  previous_schema_check="$(mktemp)"
  git show "$RC_PREVIOUS_RELEASE_COMMIT:apps/api/prisma/schema.prisma" > "$previous_schema_check"
  if ! schema_mode="$(node "$RC_DIR/schema-contract.mjs" "$previous_schema_check" apps/api/prisma/schema.prisma)"; then
    rm -f "$previous_schema_check"
    fail "schema evolution is outside the bounded reviewed contracts"
  fi
  rm -f "$previous_schema_check"
fi

legacy_upgrade=false
if ! git cat-file -e "$RC_PREVIOUS_RELEASE_COMMIT:apps/api/prisma/migrations/20261025120000_v1_2_thb_monetary_policy/migration.sql" 2>/dev/null; then
  legacy_upgrade=true
fi

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

for command_name in git node pnpm tar curl openssl; do
  command -v "$command_name" >/dev/null || fail "required command not found: $command_name"
done

tmp_root="$(mktemp -d /tmp/construction-erp-v10e-migration.XXXXXX)"
tool_dir="$tmp_root/pg-bin"
previous_root="$tmp_root/previous-release"
storage_root="$tmp_root/documents"
rollback_storage="$tmp_root/rollback-documents"
recovery_root="$tmp_root/recovery"
tls_dir="$tmp_root/tls"
production_env="$tmp_root/production.env"
recovery_env="$tmp_root/recovery.env"
mkdir -p "$tool_dir" "$previous_root" "$storage_root" "$rollback_storage" "$recovery_root" "$tls_dir"

api_pid=""
proxy_pid=""
admin_pgpass=""
upgrade_pgpass=""
rollback_pgpass=""
previous_worktree=false
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
openssl_version="$(openssl version)"

database_url() {
  RC_BASE_DATABASE_URL="$RC_BASE_DATABASE_URL" node "$RC_DIR/database-url.mjs" "$1"
}

run_token="$(node -e "process.stdout.write(require('node:crypto').randomBytes(6).toString('hex'))")"
read -r api_port proxy_port < <(
  RUN_TOKEN="$run_token" node <<'NODE'
const token = process.env.RUN_TOKEN;
const apiPort = 20000 + (Number.parseInt(token.slice(0, 8), 16) % 20000);
const proxyPort = 40000 + (Number.parseInt(token.slice(4, 12), 16) % 20000);
process.stdout.write(`${apiPort} ${proxyPort}\n`);
NODE
)

assert_loopback_port_available() {
  local port="$1"
  PORT="$port" node <<'NODE'
const net = require('node:net');
const port = Number(process.env.PORT);
const server = net.createServer();
server.unref();
server.once('error', () => process.exit(1));
server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
  server.close((error) => process.exit(error ? 1 : 0));
});
NODE
}

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
  if [[ -n "$proxy_pid" ]]; then
    kill "$proxy_pid" >/dev/null 2>&1 || true
    wait "$proxy_pid" 2>/dev/null || true
    proxy_pid=""
  fi
  if [[ -n "$api_pid" ]]; then
    kill "$api_pid" >/dev/null 2>&1 || true
    wait "$api_pid" 2>/dev/null || true
    api_pid=""
  fi
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
  if [[ "$previous_worktree" == "true" ]]; then
    git worktree remove --force "$previous_root" >/dev/null 2>&1 || failed=1
  fi
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
if [[ "$schema_mode" != "migration-aware-sql-only" ]]; then
  git worktree add --detach "$previous_root" "$RC_PREVIOUS_RELEASE_COMMIT"
  previous_worktree=true
  (
    cd "$previous_root"
    [[ "$(git rev-parse HEAD)" == "$RC_PREVIOUS_RELEASE_COMMIT" ]] || fail "previous runtime checkout mismatch"
    pnpm install --frozen-lockfile --ignore-scripts
    pnpm prisma:generate
    pnpm build:api
  )
else
  git archive "$RC_PREVIOUS_RELEASE_COMMIT" apps/api/prisma | tar --extract --directory="$previous_root"
fi
previous_schema="$previous_root/apps/api/prisma/schema.prisma"
[[ -f "$previous_schema" ]] || fail "previous-release Prisma schema archive is missing"
DATABASE_URL="$upgrade_url" DEPLOYMENT_MODE=fresh node apps/api/scripts/verify-production-target.mjs
if [[ "$schema_mode" != "migration-aware-sql-only" && "$legacy_upgrade" == true ]]; then
  # Genuine unknown sources are created before the historical provenance
  # migration, then brought through the untouched previous migration chain.
  prefix_prisma="$tmp_root/historical-prisma"
  mkdir -p "$prefix_prisma/migrations"
  cp "$previous_schema" "$prefix_prisma/schema.prisma"
  cp "$previous_root/apps/api/prisma/migrations/migration_lock.toml" "$prefix_prisma/migrations/"
  for directory in "$previous_root"/apps/api/prisma/migrations/*/; do
    name="$(basename "$directory")"
    if [[ "$name" < "20261003083000_v0_7_a_source_currency_provenance" ]]; then
      cp -a "$directory" "$prefix_prisma/migrations/$name"
    fi
  done
  DATABASE_URL="$upgrade_url" pnpm --filter @construction-erp/api exec prisma migrate deploy --schema "$prefix_prisma/schema.prisma"
  DATABASE_URL="$upgrade_url" node "$RC_DIR/legacy-fixture.mjs" early "$previous_root" "$tmp_root/legacy.json"
fi
DATABASE_URL="$upgrade_url" pnpm --filter @construction-erp/api exec prisma migrate deploy --schema "$previous_schema"
DATABASE_URL="$upgrade_url" pnpm --filter @construction-erp/api exec prisma migrate status --schema "$previous_schema"

bootstrap_root="$REPO_ROOT"
if [[ "$schema_mode" != "migration-aware-sql-only" ]]; then bootstrap_root="$previous_root"; fi
if [[ ! -f "$bootstrap_root/apps/api/dist/scripts/bootstrap-admin.js" ]]; then pnpm --dir "$bootstrap_root" build:api; fi
DATABASE_URL="$upgrade_url" \
BOOTSTRAP_COMPANY_CODE=V10ERC \
BOOTSTRAP_COMPANY_NAME="V1.0-E RC Migration Rehearsal" \
BOOTSTRAP_ADMIN_EMAIL=rc-admin@example.invalid \
BOOTSTRAP_ADMIN_DISPLAY_NAME="RC System Administrator" \
BOOTSTRAP_ADMIN_PASSWORD='Rc-Admin-Password-2026!' \
pnpm --dir "$bootstrap_root" --filter @construction-erp/api bootstrap:admin

storage_deployment_id="v10e-${GITHUB_RUN_ID:-local}"
printf 'construction-erp-production-storage-v1:%s\n' "$storage_deployment_id" > "$storage_root/.construction-erp-storage-ready"
chmod 600 "$storage_root/.construction-erp-storage-ready"

start_previous_runtime() {
  local database="$1" documents="$2"
  [[ "$(git -C "$previous_root" rev-parse HEAD)" == "$RC_PREVIOUS_RELEASE_COMMIT" ]] || fail "restored runtime checkout mismatch"
  assert_loopback_port_available "$api_port" || fail "previous runtime API port is occupied"
  DATABASE_URL="$database" STORAGE_ROOT="$documents" NODE_ENV=test \
    API_HOST=127.0.0.1 API_PORT="$api_port" WEB_ORIGIN=http://localhost:5173 \
    LOGIN_RATE_LIMIT_MAX=1000 LOGIN_RATE_LIMIT_WINDOW_MINUTES=15 \
    node "$previous_root/apps/api/dist/main.js" > "$tmp_root/previous-api.log" 2>&1 &
  api_pid=$!
  local ready=false
  for attempt in {1..30}; do
    if ! kill -0 "$api_pid" >/dev/null 2>&1; then cat "$tmp_root/previous-api.log"; fail "previous runtime exited"; fi
    if curl --fail --silent "http://127.0.0.1:$api_port/api/v1/health" >/dev/null; then ready=true; break; fi
    sleep 1
  done
  [[ "$ready" == "true" ]] || { cat "$tmp_root/previous-api.log"; fail "previous runtime not healthy"; }
}

if [[ "$schema_mode" != "migration-aware-sql-only" ]]; then
  if [[ "$legacy_upgrade" == true ]]; then
    DATABASE_URL="$upgrade_url" node "$RC_DIR/legacy-fixture.mjs" late "$previous_root" "$tmp_root/legacy.json"
  fi
  start_previous_runtime "$upgrade_url" "$storage_root"
  UAT_API_BASE_URL="http://127.0.0.1:$api_port/api/v1" \
    BOOTSTRAP_ADMIN_EMAIL=rc-admin@example.invalid BOOTSTRAP_ADMIN_PASSWORD='Rc-Admin-Password-2026!' \
    node "$previous_root/deploy/uat/runtime-acceptance.mjs"
  kill "$api_pid"
  wait "$api_pid" 2>/dev/null || true
  api_pid=""
  DATABASE_URL="$upgrade_url" RESTORE_STORAGE_ROOT="$storage_root" node "$previous_root/apps/api/scripts/verify-restored-documents.mjs"
  if [[ "$legacy_upgrade" == true ]]; then
    DATABASE_URL="$upgrade_url" node "$RC_DIR/legacy-fixture.mjs" snapshot "$previous_root" "$tmp_root/legacy.json" "$tmp_root/legacy-snapshot.json"
  fi
fi

recovery_tool_root="$REPO_ROOT"
recovery_release="$RELEASE_COMMIT"
if [[ "$schema_mode" != "migration-aware-sql-only" ]]; then
  recovery_tool_root="$previous_root"
  recovery_release="$RC_PREVIOUS_RELEASE_COMMIT"
fi
cat > "$recovery_env" <<EOF
NODE_ENV=production
RELEASE_COMMIT=$recovery_release
DATABASE_URL=$upgrade_url
STORAGE_ROOT=$storage_root
STORAGE_DEPLOYMENT_ID=$storage_deployment_id
EOF
chmod 600 "$recovery_env"

echo "[V1.0-E migration-aware] Create paired pre-upgrade recovery set"
RECOVERY_ROOT="$recovery_root" \
RECOVERY_SITE_OFFLINE_CONFIRMED=YES \
PRODUCTION_ENV_FILE="$recovery_env" \
bash "$recovery_tool_root/deploy/recovery/create-recovery-set.sh" | tee "$tmp_root/recovery-create.log"
recovery_set="$(tail -n 1 "$tmp_root/recovery-create.log")"
[[ -d "$recovery_set" ]] || fail "recovery set was not created"
EXPECTED_RECOVERY_RELEASE_COMMIT="$recovery_release" bash "$recovery_tool_root/deploy/recovery/verify-recovery-set.sh" "$recovery_set"
recovery_reference="$(basename "$recovery_set")"

cat > "$production_env" <<EOF
NODE_ENV=production
RELEASE_COMMIT=$RELEASE_COMMIT
DEPLOYMENT_MODE=upgrade
UPGRADE_SITE_OFFLINE_CONFIRMED=YES
RECOVERY_POINT_VERIFIED=YES
RECOVERY_POINT_REFERENCE=$recovery_reference
API_HOST=127.0.0.1
API_PORT=$api_port
WEB_ORIGIN=https://127.0.0.1:$proxy_port
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



candidate_admin_email=rc-admin@example.invalid
if [[ "$schema_mode" != "migration-aware-sql-only" && "$legacy_upgrade" == true ]]; then
  DATABASE_URL="$upgrade_url" node "$RC_DIR/legacy-fixture.mjs" verify "$previous_root" "$tmp_root/legacy.json" "$tmp_root/legacy-snapshot.json"
  DATABASE_URL="$upgrade_url" ERP_LEGACY_FIXTURE="$tmp_root/legacy.json" node "$RC_DIR/verify-thb-upgrade.mjs"
fi
if [[ "$schema_mode" == "migration-aware-customer-boq-schema" ]]; then
  # Exercise persisted source mappings/replay/approvals on the upgraded database,
  # using disposable records, before claiming the successor persistence contract.
  DATABASE_URL="$upgrade_url" node --test apps/api/dist/budget/customer-boq.integration.spec.js
fi

if [[ "$schema_mode" != "migration-aware-sql-only" ]]; then
  # The acceptance runner deliberately creates Company-unique numbering and
  # approval configuration. Do not rerun it over the retained legacy Company,
  # clear its configuration, or rewrite historical SGD sources for new policy.
  candidate_admin_email=rc-candidate-admin@example.invalid
  DATABASE_URL="$upgrade_url" BOOTSTRAP_COMPANY_CODE=V12RCNEW \
    BOOTSTRAP_COMPANY_NAME="V1.2 Candidate Acceptance" \
    BOOTSTRAP_ADMIN_EMAIL="$candidate_admin_email" \
    BOOTSTRAP_ADMIN_DISPLAY_NAME="Candidate System Administrator" \
    BOOTSTRAP_ADMIN_PASSWORD='Rc-Admin-Password-2026!' \
    pnpm --filter @construction-erp/api bootstrap:admin
fi

upgrade_pgpass="$(mktemp)"
chmod 600 "$upgrade_pgpass"
native_upgrade_url="$(POSTGRES_RAW_URL="$upgrade_url" PGPASSFILE="$upgrade_pgpass" node deploy/recovery/postgres-url.mjs)"
for migration_name in "${new_migrations[@]}"; do
  applied_count="$(PGPASSFILE="$upgrade_pgpass" psql "$native_upgrade_url" --no-psqlrc --tuples-only --no-align \
    --command="SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE \"migration_name\" = '${migration_name}' AND \"finished_at\" IS NOT NULL AND \"rolled_back_at\" IS NULL" | tr -d '\r\n ')"
  [[ "$applied_count" == "1" ]] || fail "candidate migration was not applied exactly once: $migration_name"
done

echo "[V1.0-E migration-aware] Start exact candidate on upgraded previous-release data"
assert_loopback_port_available "$api_port" || fail "run-specific API port $api_port is already occupied"
PRODUCTION_ENV_FILE="$production_env" bash deploy/production/run-api.sh > "$tmp_root/api.log" 2>&1 &
api_pid=$!
api_ready=false
for attempt in {1..30}; do
  if ! kill -0 "$api_pid" >/dev/null 2>&1; then
    cat "$tmp_root/api.log"
    fail "Production-mode candidate API exited before becoming healthy on upgraded data"
  fi
  if curl --fail --silent --show-error "http://127.0.0.1:$api_port/api/v1/health" >/dev/null; then
    sleep 0.2
    if ! kill -0 "$api_pid" >/dev/null 2>&1; then
      cat "$tmp_root/api.log"
      fail "candidate API exited after upgraded-data readiness probe"
    fi
    api_ready=true
    break
  fi
  sleep 1
done
[[ "$api_ready" == "true" ]] || { cat "$tmp_root/api.log"; fail "candidate API did not become healthy on upgraded data"; }

echo "[V1.0-E migration-aware] Run authenticated acceptance against upgraded previous-release data"
UAT_API_BASE_URL="http://127.0.0.1:$api_port/api/v1" \
API_PORT="$api_port" \
BOOTSTRAP_ADMIN_EMAIL="$candidate_admin_email" \
BOOTSTRAP_ADMIN_PASSWORD='Rc-Admin-Password-2026!' \
bash deploy/uat/runtime-acceptance.sh

echo "[V1.0-E migration-aware] Run Production-safe HTTPS smoke against upgraded previous-release data"
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$tls_dir/key.pem" -out "$tls_dir/cert.pem" -days 1 \
  -subj '/CN=127.0.0.1' -addext 'subjectAltName=IP:127.0.0.1' >/dev/null 2>&1
assert_loopback_port_available "$proxy_port" || fail "run-specific HTTPS proxy port $proxy_port is already occupied"
RC_PROXY_HOST=127.0.0.1 \
RC_PROXY_PORT="$proxy_port" \
RC_API_ORIGIN="http://127.0.0.1:$api_port" \
RC_WEB_ROOT="$REPO_ROOT/apps/web/dist" \
RC_TLS_KEY="$tls_dir/key.pem" \
RC_TLS_CERT="$tls_dir/cert.pem" \
node "$RC_DIR/https-proxy.mjs" > "$tmp_root/proxy.log" 2>&1 &
proxy_pid=$!
proxy_ready=false
for attempt in {1..30}; do
  if ! kill -0 "$proxy_pid" >/dev/null 2>&1; then
    cat "$tmp_root/proxy.log"
    fail "loopback HTTPS proxy exited before becoming healthy"
  fi
  if CURL_CA_BUNDLE="$tls_dir/cert.pem" curl --fail --silent --show-error "https://127.0.0.1:$proxy_port/" >/dev/null; then
    sleep 0.2
    if ! kill -0 "$proxy_pid" >/dev/null 2>&1; then
      cat "$tmp_root/proxy.log"
      fail "loopback HTTPS proxy exited after readiness probe"
    fi
    proxy_ready=true
    break
  fi
  sleep 1
done
[[ "$proxy_ready" == "true" ]] || { cat "$tmp_root/proxy.log"; fail "loopback HTTPS proxy did not become healthy"; }
CURL_CA_BUNDLE="$tls_dir/cert.pem" PRODUCTION_ENV_FILE="$production_env" bash deploy/production/smoke.sh

kill "$proxy_pid" >/dev/null 2>&1 || true
wait "$proxy_pid" 2>/dev/null || true
proxy_pid=""
kill "$api_pid" >/dev/null 2>&1 || true
wait "$api_pid" 2>/dev/null || true
api_pid=""

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

if [[ "$schema_mode" != "migration-aware-sql-only" ]]; then
  if [[ "$legacy_upgrade" == true ]]; then
    DATABASE_URL="$rollback_url" node "$RC_DIR/legacy-fixture.mjs" verify "$previous_root" "$tmp_root/legacy.json" "$tmp_root/legacy-snapshot.json"
  fi
  start_previous_runtime "$rollback_url" "$rollback_storage"
  RESTORED_API_BASE_URL="http://127.0.0.1:$api_port/api/v1" DATABASE_URL="$rollback_url" \
    BOOTSTRAP_ADMIN_EMAIL=rc-admin@example.invalid BOOTSTRAP_ADMIN_PASSWORD='Rc-Admin-Password-2026!' \
    node "$previous_root/apps/api/scripts/verify-restored-runtime.mjs"
  kill "$api_pid"
  wait "$api_pid" 2>/dev/null || true
  api_pid=""
fi

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
  "$recovery_reference" "$git_version" "$node_version" "$pnpm_version" "$postgresql_client_version" "$openssl_version" \
  "$ci_provider" "$ci_workflow" "$ci_workflow_ref" "$ci_run_id" "$ci_run_number" "$ci_run_attempt" \
  "$ci_job" "$ci_repository" "$migration_list" "$schema_mode" "$legacy_upgrade" <<'NODE'
const { writeFileSync } = require('node:fs');
const [
  path, releaseCommit, previousReleaseCommit, environment, recoveryReference,
  gitVersion, nodeVersion, pnpmVersion, postgresqlClientVersion, opensslVersion,
  ciProvider, ciWorkflow, ciWorkflowRef, ciRunId, ciRunNumber, ciRunAttempt,
  ciJob, ciRepository, migrationList, schemaMode, legacyUpgrade,
] = process.argv.slice(2);
const nullable = (value) => value === '' ? null : value;
writeFileSync(path, JSON.stringify({
  version: schemaMode === 'migration-aware-customer-boq-schema' ? 5 : schemaMode === 'migration-aware-thb-schema' ? 4 : 3,
  releaseMode: schemaMode,
  releaseCommit,
  previousReleaseCommit,
  environment,
  toolVersions: {
    git: gitVersion,
    node: nodeVersion,
    pnpm: pnpmVersion,
    postgresqlClient: postgresqlClientVersion,
    openssl: opensslVersion,
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
  ...(schemaMode !== 'migration-aware-sql-only' ? {
    boundedSchemaContract: 'PASS',
    previousRuntimeCommit: previousReleaseCommit,
    previousRuntimeClientBuild: 'PASS',
    ...(legacyUpgrade === 'true' ? { genuineLegacySgdNullFixture: 'PASS', historicalRowsUnchanged: 'PASS', thbPolicyUpgrade: 'PASS' } : {}),
    restoredPreviousRuntimeAuthenticationDownload: 'PASS',
  } : { prismaSchemaUnchanged: 'PASS' }),
  ...(schemaMode === 'migration-aware-customer-boq-schema' ? { customerBoqPersistenceUpgrade: 'PASS' } : {}),
  forwardOnlyNewMigrations: 'PASS',
  migrationNames: migrationList.split(',').filter(Boolean),
  freshMigration: 'PASS',
  previousReleaseFixture: 'PASS',
  verifiedRecoveryPoint: 'PASS',
  recoveryReference,
  productionPreparation: 'PASS',
  migrationAwareUpgrade: 'PASS',
  authenticatedLiveAcceptance: 'PASS',
  productionSafeSmoke: 'PASS',
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
