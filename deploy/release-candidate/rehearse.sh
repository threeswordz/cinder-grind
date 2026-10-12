#!/usr/bin/env bash
set -euo pipefail

RC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$RC_DIR/../.." && pwd)"
cd "$REPO_ROOT"

fail() {
  echo "V1.0-E release-candidate rehearsal failed: $*" >&2
  exit 1
}

: "${RC_NON_PRODUCTION_CONFIRMED:?RC_NON_PRODUCTION_CONFIRMED is required}"
: "${RC_PREVIOUS_RELEASE_COMMIT:?RC_PREVIOUS_RELEASE_COMMIT is required}"
: "${RC_BASE_DATABASE_URL:=${DATABASE_URL:-}}"
: "${RELEASE_COMMIT:=${GITHUB_SHA:-}}"
: "${RC_ENVIRONMENT:=ci}"
: "${RC_EVIDENCE_FILE:=/tmp/v1-0-e-rehearsal.json}"
: "${RC_POSTGRES_TOOL_MODE:=docker}"

[[ "$RC_NON_PRODUCTION_CONFIRMED" == "YES" ]] || fail "RC_NON_PRODUCTION_CONFIRMED must equal YES"
[[ "$RC_ENVIRONMENT" != "production" ]] || fail "rehearsal must not run in Production"
[[ "$RELEASE_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || fail "RELEASE_COMMIT must be a full Git SHA"
[[ "$RC_PREVIOUS_RELEASE_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || fail "RC_PREVIOUS_RELEASE_COMMIT must be a full Git SHA"
[[ -n "$RC_BASE_DATABASE_URL" ]] || fail "RC_BASE_DATABASE_URL or DATABASE_URL is required"

actual_commit="$(git rev-parse HEAD)"
[[ "$actual_commit" == "$RELEASE_COMMIT" ]] || fail "exact checkout mismatch: expected $RELEASE_COMMIT, got $actual_commit"
[[ -z "$(git status --porcelain)" ]] || fail "rehearsal requires a clean Git working tree"
git cat-file -e "$RC_PREVIOUS_RELEASE_COMMIT^{commit}" 2>/dev/null || fail "previous release commit is unavailable; use full Git history"
git merge-base --is-ancestor "$RC_PREVIOUS_RELEASE_COMMIT" "$RELEASE_COMMIT" || fail "previous release commit is not an ancestor of the candidate"

git diff --quiet "$RC_PREVIOUS_RELEASE_COMMIT" "$RELEASE_COMMIT" -- apps/api/prisma/migrations \
  || fail "migration history changed; this zero-migration V1.0-E rehearsal cannot claim application-only rollback readiness"
git diff --quiet "$RC_PREVIOUS_RELEASE_COMMIT" "$RELEASE_COMMIT" -- apps/api/prisma/schema.prisma \
  || fail "Prisma schema changed; add an explicitly reviewed migration-aware upgrade/rollback fixture before continuing"

for command_name in git node pnpm curl openssl; do
  command -v "$command_name" >/dev/null || fail "required command not found: $command_name"
done

tmp_root="$(mktemp -d /tmp/construction-erp-v10e.XXXXXX)"
tool_dir="$tmp_root/pg-bin"
storage_root="$tmp_root/documents"
recovery_root="$tmp_root/recovery"
tls_dir="$tmp_root/tls"
production_env="$tmp_root/production.env"
recovery_env="$tmp_root/recovery.env"
mkdir -p "$tool_dir" "$storage_root" "$recovery_root" "$tls_dir"

api_pid=""
proxy_pid=""
admin_pgpass=""

cleanup() {
  set +e
  [[ -n "$proxy_pid" ]] && kill "$proxy_pid" >/dev/null 2>&1
  [[ -n "$api_pid" ]] && kill "$api_pid" >/dev/null 2>&1
  if [[ -n "$admin_pgpass" && -f "$admin_pgpass" && -n "${native_admin_url:-}" ]]; then
    for db in construction_erp_v10e_restore construction_erp_v10e_upgrade construction_erp_v10e_fresh; do
      PGPASSFILE="$admin_pgpass" psql "$native_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 \
        --command="DROP DATABASE IF EXISTS \"$db\" WITH (FORCE)" >/dev/null 2>&1
    done
  fi
  [[ -n "$admin_pgpass" ]] && rm -f "$admin_pgpass"
  rm -rf "$tmp_root"
}
trap cleanup EXIT

if [[ "$RC_POSTGRES_TOOL_MODE" == "docker" ]]; then
  command -v docker >/dev/null || fail "required command not found: docker"
  cat > "$tool_dir/psql" <<'PSQL'
#!/usr/bin/env bash
set -euo pipefail
docker_args=(--rm --network host)
if [[ -n "${PGPASSFILE:-}" ]]; then
  docker_args+=(--volume "$PGPASSFILE:/tmp/construction-erp-pgpass:ro" --env PGPASSFILE=/tmp/construction-erp-pgpass)
fi
exec docker run "${docker_args[@]}" postgres:17.11-alpine psql "$@"
PSQL

  cat > "$tool_dir/pg_dump" <<'PG_DUMP'
#!/usr/bin/env bash
set -euo pipefail
docker_args=(--rm --network host)
if [[ -n "${PGPASSFILE:-}" ]]; then
  docker_args+=(--volume "$PGPASSFILE:/tmp/construction-erp-pgpass:ro" --env PGPASSFILE=/tmp/construction-erp-pgpass)
fi
exec docker run "${docker_args[@]}" postgres:17.11-alpine pg_dump "$@"
PG_DUMP
  cat > "$tool_dir/pg_restore" <<'PG_RESTORE'
#!/usr/bin/env bash
set -euo pipefail
docker_args=(--rm -i --network host)
if [[ -n "${PGPASSFILE:-}" ]]; then
  docker_args+=(--volume "$PGPASSFILE:/tmp/construction-erp-pgpass:ro" --env PGPASSFILE=/tmp/construction-erp-pgpass)
fi
exec docker run "${docker_args[@]}" postgres:17.11-alpine pg_restore "$@"
PG_RESTORE
  chmod +x "$tool_dir/psql" "$tool_dir/pg_dump" "$tool_dir/pg_restore"
  export PATH="$tool_dir:$PATH"
else
  for command_name in psql pg_dump pg_restore; do
    command -v "$command_name" >/dev/null || fail "native PostgreSQL command not found: $command_name"
  done
fi

database_url() {
  RC_BASE_DATABASE_URL="$RC_BASE_DATABASE_URL" node "$RC_DIR/database-url.mjs" "$1"
}
fresh_url="$(database_url construction_erp_v10e_fresh)"
upgrade_url="$(database_url construction_erp_v10e_upgrade)"
admin_url="$(database_url postgres)"

admin_pgpass="$(mktemp)"
chmod 600 "$admin_pgpass"
native_admin_url="$(POSTGRES_RAW_URL="$admin_url" PGPASSFILE="$admin_pgpass" node deploy/recovery/postgres-url.mjs)"

reset_database() {
  local database_name="$1"
  PGPASSFILE="$admin_pgpass" psql "$native_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 \
    --command="DROP DATABASE IF EXISTS \"$database_name\" WITH (FORCE)"
  PGPASSFILE="$admin_pgpass" psql "$native_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 \
    --command="CREATE DATABASE \"$database_name\""
}

reset_database construction_erp_v10e_fresh
reset_database construction_erp_v10e_upgrade

echo "[V1.0-E] Fresh migration-from-zero rehearsal"
DATABASE_URL="$fresh_url" DEPLOYMENT_MODE=fresh node apps/api/scripts/verify-production-target.mjs
DATABASE_URL="$fresh_url" pnpm prisma:migrate:deploy
DATABASE_URL="$fresh_url" pnpm --filter @construction-erp/api exec prisma migrate status

echo "[V1.0-E] Build supported pre-RC upgrade fixture"
DATABASE_URL="$upgrade_url" DEPLOYMENT_MODE=fresh node apps/api/scripts/verify-production-target.mjs
DATABASE_URL="$upgrade_url" pnpm prisma:migrate:deploy
DATABASE_URL="$upgrade_url" pnpm --filter @construction-erp/api exec prisma migrate status
if [[ ! -f apps/api/dist/scripts/bootstrap-admin.js ]]; then
  pnpm build:api
fi
DATABASE_URL="$upgrade_url" \
BOOTSTRAP_COMPANY_CODE=V10ERC \
BOOTSTRAP_COMPANY_NAME="V1.0-E RC Rehearsal" \
BOOTSTRAP_ADMIN_EMAIL=rc-admin@example.invalid \
BOOTSTRAP_ADMIN_DISPLAY_NAME="RC System Administrator" \
BOOTSTRAP_ADMIN_PASSWORD='Rc-Admin-Password-2026!' \
pnpm --filter @construction-erp/api bootstrap:admin

storage_deployment_id="v10e-${GITHUB_RUN_ID:-local}"
printf 'construction-erp-production-storage-v1:%s\n' "$storage_deployment_id" \
  > "$storage_root/.construction-erp-storage-ready"
chmod 600 "$storage_root/.construction-erp-storage-ready"

cat > "$recovery_env" <<EOF
NODE_ENV=production
RELEASE_COMMIT=$RELEASE_COMMIT
DATABASE_URL=$upgrade_url
STORAGE_ROOT=$storage_root
STORAGE_DEPLOYMENT_ID=$storage_deployment_id
EOF
chmod 600 "$recovery_env"

echo "[V1.0-E] Create verified paired pre-upgrade recovery point"
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
API_PORT=3003
WEB_ORIGIN=https://127.0.0.1:3443
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

echo "[V1.0-E] Run actual Production preparation path as an offline upgrade"
PRODUCTION_ENV_FILE="$production_env" bash deploy/production/prepare-release.sh

echo "[V1.0-E] Start exact candidate in Production mode"
PRODUCTION_ENV_FILE="$production_env" bash deploy/production/run-api.sh > "$tmp_root/api.log" 2>&1 &
api_pid=$!
api_ready=false
for attempt in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:3003/api/v1/health >/dev/null; then
    api_ready=true
    break
  fi
  if ! kill -0 "$api_pid" >/dev/null 2>&1; then
    cat "$tmp_root/api.log"
    fail "Production-mode candidate API exited before becoming healthy"
  fi
  sleep 1
done
[[ "$api_ready" == "true" ]] || { cat "$tmp_root/api.log"; fail "candidate API did not become healthy"; }

echo "[V1.0-E] Run authenticated full-system live acceptance"
UAT_API_BASE_URL=http://127.0.0.1:3003/api/v1 \
API_PORT=3003 \
BOOTSTRAP_ADMIN_EMAIL=rc-admin@example.invalid \
BOOTSTRAP_ADMIN_PASSWORD='Rc-Admin-Password-2026!' \
bash deploy/uat/runtime-acceptance.sh

echo "[V1.0-E] Run canonical Production-safe smoke through loopback HTTPS"
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$tls_dir/key.pem" -out "$tls_dir/cert.pem" -days 1 \
  -subj '/CN=127.0.0.1' -addext 'subjectAltName=IP:127.0.0.1' >/dev/null 2>&1
RC_PROXY_HOST=127.0.0.1 \
RC_PROXY_PORT=3443 \
RC_API_ORIGIN=http://127.0.0.1:3003 \
RC_WEB_ROOT="$REPO_ROOT/apps/web/dist" \
RC_TLS_KEY="$tls_dir/key.pem" \
RC_TLS_CERT="$tls_dir/cert.pem" \
node "$RC_DIR/https-proxy.mjs" > "$tmp_root/proxy.log" 2>&1 &
proxy_pid=$!
proxy_ready=false
for attempt in {1..30}; do
  if CURL_CA_BUNDLE="$tls_dir/cert.pem" curl --fail --silent --show-error https://127.0.0.1:3443/ >/dev/null; then
    proxy_ready=true
    break
  fi
  if ! kill -0 "$proxy_pid" >/dev/null 2>&1; then
    cat "$tmp_root/proxy.log"
    fail "loopback HTTPS proxy exited before becoming healthy"
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

node - "$RC_EVIDENCE_FILE" "$RELEASE_COMMIT" "$RC_PREVIOUS_RELEASE_COMMIT" "$RC_ENVIRONMENT" "$recovery_reference" <<'NODE'
const { writeFileSync } = require('node:fs');
const [path, releaseCommit, previousReleaseCommit, environment, recoveryReference] = process.argv.slice(2);
const evidence = {
  version: 1,
  releaseCommit,
  previousReleaseCommit,
  environment,
  exactCheckout: 'PASS',
  cleanTree: 'PASS',
  migrationHistoryUnchanged: 'PASS',
  prismaSchemaUnchanged: 'PASS',
  freshMigration: 'PASS',
  upgradeRehearsal: 'PASS',
  verifiedRecoveryPoint: 'PASS',
  recoveryReference,
  productionPreparation: 'PASS',
  authenticatedLiveAcceptance: 'PASS',
  productionSafeSmoke: 'PASS',
  rollbackReadiness: 'PASS',
  rollbackDecision: 'application-only rollback is schema-compatible because migration history and Prisma schema are unchanged; otherwise the rehearsal fails closed',
  humanReleaseGates: {
    'AC-V10-039': 'NOT_COMPLETED',
    'AC-V10-040': 'NOT_COMPLETED',
  },
};
writeFileSync(path, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
NODE

echo "V1.0-E exact release-candidate Production-like rehearsal PASSED for $RELEASE_COMMIT"
echo "Evidence: $RC_EVIDENCE_FILE"
