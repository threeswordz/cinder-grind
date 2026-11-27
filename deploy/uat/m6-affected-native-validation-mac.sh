#!/usr/bin/env bash
# Exact-head affected regression batch only. No retained DB, deployment or old journey replay.
set -euo pipefail
umask 077
[[ $# = 2 && "$1" =~ ^[0-9a-f]{40}$ && "$2" =~ ^[0-9a-f]{40}$ ]] || { echo M6_AFFECTED_EXACT_SHA_TREE_REQUIRED; exit 1; }
expected=$1; tree=$2
[[ "$(uname -s)" = Darwin && "$(id -u)" != 0 ]] || { echo M6_AFFECTED_MAC_REQUIRED; exit 1; }
cd "$(git rev-parse --show-toplevel)"
test "$(git rev-parse HEAD)" = "$expected"
test "$(git rev-parse 'HEAD^{tree}')" = "$tree"
test -z "$(git status --porcelain --untracked-files=all)"
unset GITHUB_ACTIONS M4_NON_PRODUCTION_CONFIRMED PUR0814_NON_PRODUCTION_CONFIRMED NODE_OPTIONS NODE_PATH NODE_TLS_REJECT_UNAUTHORIZED PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE PGSERVICEFILE PGPASSFILE PGOPTIONS DIRECT_URL SHADOW_DATABASE_URL
[[ "$(node --version)" = v24.21.0 && "$(pnpm --version)" = 12.6.0 ]] || { echo M6_AFFECTED_TOOLCHAIN_REQUIRED; exit 1; }
export NODE_ENV=test CI=true
export DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused?schema=public'
TMP=$(mktemp -d); TMP=$(cd "$TMP" && pwd -P)
mkdir -m 700 "$TMP/build-storage"
export STORAGE_ROOT="$TMP/build-storage"
echo '===== ONE AFFECTED API AND WEB BUILD ====='
pnpm install --offline --frozen-lockfile
pnpm prisma:validate
pnpm prisma:generate
pnpm build:api
pnpm --filter @construction-erp/web build
echo M6_AFFECTED_API_WEB_BUILD_PASS
# Changed adapter database boundaries and common ordering require fresh targeted proof.
node --test deploy/uat/m6-common-successor.test.mjs deploy/uat/m6-parallel-03-ss16-config.test.mjs deploy/uat/m6-hr-successor-adapter.test.mjs deploy/uat/m6-hr-successor-exit.test.mjs
# New browser command-gate units are not browser event/role acceptance.
node --experimental-strip-types --test apps/web/src/inventory/m6-parallel-02-material-plan-command-gate.test.mjs apps/web/src/inventory/m6-parallel-02-material-request-command-gate.test.mjs apps/web/src/site-execution/m6-parallel-02-site-issue-command-scope.test.mjs
SUFFIX=$(openssl rand -hex 6); PW=$(openssl rand -hex 24)
[[ "$SUFFIX" =~ ^[0-9a-f]{12}$ && "$PW" =~ ^[0-9a-f]{48}$ ]]
CID=$(podman run --pull=never --rm -d --name "erp-m6-affected-$SUFFIX" --label "erp.validation=m6-affected-$SUFFIX" -e POSTGRES_USER=erp_validation -e POSTGRES_PASSWORD="$PW" -e POSTGRES_DB=postgres -p 127.0.0.1::5432 postgres:17.11-alpine)
[[ "$CID" =~ ^[0-9a-f]{64}$ ]]
cleanup() { if [[ "$(podman inspect --format '{{ index .Config.Labels "erp.validation" }}' "$CID" 2>/dev/null || true)" = "m6-affected-$SUFFIX" ]]; then podman rm -f "$CID" >/dev/null 2>&1 || true; fi; }
trap cleanup EXIT
for i in $(seq 1 60); do
  if podman exec "$CID" pg_isready -h 127.0.0.1 -U erp_validation -d postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
podman exec "$CID" pg_isready -h 127.0.0.1 -U erp_validation -d postgres
ADDRESS=$(podman port "$CID" 5432/tcp)
[[ "$ADDRESS" =~ ^127\.0\.0\.1:[0-9]+$ && "$ADDRESS" != 127.0.0.1:55471 ]]
SEED="m6_affected_seed_$SUFFIX"
podman exec "$CID" createdb -U erp_validation "$SEED"
export DATABASE_URL="postgresql://erp_validation:$PW@$ADDRESS/$SEED?schema=public"
pnpm prisma:migrate:deploy
FAIL=0
run_case() {
  local label=$1 db=$2 path=$3 pattern=$4 log="$TMP/$1.tap"
  test -f "$path"
  podman exec "$CID" createdb -U erp_validation -T "$SEED" "$db"
  export DATABASE_URL="postgresql://erp_validation:$PW@$ADDRESS/$db?schema=public"
  export STORAGE_ROOT="$TMP/storage-$label"
  mkdir -m 700 "$STORAGE_ROOT"
  echo "===== NATIVE $label ====="
  # Require a real positive test count, never accept an empty name filter.
  if node --test --test-reporter=tap --test-concurrency=1 --test-name-pattern="$pattern" "$path" >"$log" 2>&1 && grep -Eq '^# pass [1-9][0-9]*$' "$log"; then
    grep -E '^# (tests|pass|fail|skipped|cancelled|duration_ms) ' "$log" || true
    echo "M6_AFFECTED_${label}_PASS"
  else
    echo "M6_AFFECTED_${label}_BLOCKED (private log: $log)"
    FAIL=1
  fi
}
for group in OPERATIONAL TRANSFER RECEIPT; do
  nonce=$(openssl rand -hex 6); [[ "$nonce" =~ ^[0-9a-f]{12}$ ]]
  case "$group" in
    OPERATIONAL) file=material-uom-operational-http.integration.spec.js; pattern='DEC-050 B authenticated HTTP' ;;
    TRANSFER) file=transfer-custody.integration.spec.js; pattern='DEC-050 B actual controlled conversion' ;;
    RECEIPT) file=material-uom-receipt-source.integration.spec.js; pattern='DEC-050 B actual PostgreSQL receipt freeze' ;;
  esac
  run_case "$group" "construction_erp_v10e_upgrade_$nonce" "apps/api/dist/inventory/$file" "$pattern"
done
run_case CERTIFICATION erp_physical_validation_01 apps/api/dist/subcontracts/m6-parallel-04-certification-finance.integration.spec.js 'M6-04 physical acceptance to cancelled allocation'
echo "M6_AFFECTED_CANDIDATE=$expected"
echo "M6_AFFECTED_TREE=$tree"
echo M6_PRIOR_SS16_AND_SIX_NATIVE_GROUPS_NOT_RERUN
echo M6_POPULATED_SUCCESSOR_AND_BROWSER_NOT_RUN
exit "$FAIL"
