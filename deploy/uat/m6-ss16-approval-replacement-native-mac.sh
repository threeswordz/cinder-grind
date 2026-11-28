#!/usr/bin/env bash
# Validate the consolidated SS16 lifecycle/API/UI compilation; optionally include old replacement group.
# Previously successful native groups and FM02 are deliberately not repeated.
set -euo pipefail
umask 077
expected=${1:-}
mode=${2:-both}
[[ "$mode" = both || "$mode" = ss16-only || "$mode" = regressions-only || "$mode" = ss16-review || "$mode" = ss16-terminal ]] || { echo M6_FOCUSED_MODE_INVALID; exit 1; }
[[ "$expected" =~ ^[0-9a-f]{40}$ ]] || { echo M6_FOCUSED_EXACT_SHA_REQUIRED; exit 1; }
cd "$(git rev-parse --show-toplevel)"
test "$(git rev-parse HEAD)" = "$expected"
test -z "$(git status --porcelain --untracked-files=all)"
test "$(uname -s)" = Darwin
test "$(id -u)" != 0
test "$(node --version)" = v24.21.0
test "$(pnpm --version)" = 12.6.0
unset GITHUB_ACTIONS M4_NON_PRODUCTION_CONFIRMED PUR0814_NON_PRODUCTION_CONFIRMED NODE_OPTIONS NODE_PATH PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE PGSERVICEFILE PGPASSFILE PGOPTIONS DIRECT_URL SHADOW_DATABASE_URL
export NODE_ENV=test CI=true
export DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused?schema=public'
TMP=$(mktemp -d)
TMP=$(cd "$TMP" && pwd -P)
mkdir -m 700 "$TMP/build-storage"
export STORAGE_ROOT="$TMP/build-storage"
echo "===== M6 FOCUSED API BUILD ====="
pnpm install --offline --frozen-lockfile
pnpm --filter @construction-erp/api exec prisma validate
pnpm prisma:generate
pnpm build:api
if [[ "$mode" = both || "$mode" = ss16-only ]]; then
  echo "===== M6 FOCUSED WEB BUILD ====="
  pnpm --filter @construction-erp/web build
  echo "M6_FOCUSED_WEB_BUILD_PASS"
  echo "===== M6 SS16 AUTHORITY POLICY ====="
  node --test apps/api/dist/inventory/movement-correction-authority.spec.js
  echo "M6_SS16_AUTHORITY_PASS"
else
  echo M6_PRIOR_WEB_AND_AUTHORITY_NOT_RERUN
fi
if [[ "$mode" = ss16-terminal ]]; then
  echo M6_PRIOR_ACCEPTANCE_CONTRACTS_NOT_RERUN
fi
if [[ "$mode" = ss16-review ]]; then
  echo "===== CHANGED ACCEPTANCE CONTRACTS ====="
  for file in runtime-acceptance prototype-material-http prototype-material-run prototype-material-journey prototype-uom-plan-source ss16-disposable-corrections ss16-correction-acceptance; do
    node --check "deploy/uat/$file.mjs"
  done
  node --test deploy/uat/ss16-correction-acceptance.test.mjs
  echo M6_SS16_CHANGED_ACCEPTANCE_CONTRACTS_PASS
fi
SUFFIX=$(openssl rand -hex 4)
PW=$(openssl rand -hex 24)
[[ "$SUFFIX" =~ ^[0-9a-f]{8}$ && "$PW" =~ ^[0-9a-f]{48}$ ]]
CID=$(podman run --pull=never --rm -d --name "erp-m6b-$SUFFIX" \
  --label erp.validation=m6b-disposable \
  -e POSTGRES_USER=m6_test -e POSTGRES_PASSWORD="$PW" -e POSTGRES_DB=postgres \
  -p 127.0.0.1::5432 postgres:17.11-alpine)
[[ "$CID" =~ ^[0-9a-f]{64}$ ]]
trap 'podman rm -f "$CID" >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 60); do
  if podman exec "$CID" pg_isready -h 127.0.0.1 -U m6_test -d postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
podman exec "$CID" pg_isready -h 127.0.0.1 -U m6_test -d postgres
ADDRESS=$(podman port "$CID" 5432/tcp)
[[ "$ADDRESS" =~ ^127\.0\.0\.1:[0-9]+$ && "$ADDRESS" != 127.0.0.1:55471 ]]
SEED="m6_seed_$SUFFIX"
podman exec "$CID" createdb -U m6_test "$SEED"
export DATABASE_URL="postgresql://m6_test:$PW@$ADDRESS/$SEED?schema=public"
echo "===== M6 FOCUSED MIGRATION TEMPLATE ====="
pnpm prisma:migrate:deploy
FAIL=0
run_test() {
  local label=$1 db=$2 path=$3
  podman exec "$CID" createdb -U m6_test -T "$SEED" "$db"
  export DATABASE_URL="postgresql://m6_test:$PW@$ADDRESS/$db?schema=public"
  export STORAGE_ROOT="$TMP/storage-$label"
  mkdir -m 700 "$STORAGE_ROOT"
  echo "===== NATIVE $label ====="
  if node --test --test-concurrency=1 "$path"; then
    echo "M6_NATIVE_${label}_PASS"
  else
    echo "M6_NATIVE_${label}_BLOCKED"
    FAIL=1
  fi
}
if [[ "$mode" = both ]]; then
  run_test PUR14_REPLACEMENT "m6_replacement_$SUFFIX" apps/api/dist/procurement/supplier-replacement-posted.native.integration.spec.js
else
  echo M6_PRIOR_PUR14_REPLACEMENT_NOT_RERUN
fi
if [[ "$mode" = regressions-only ]]; then
  # Old preserved journey guards accept this disposable upgrade namespace.
  # Every clone is created from the fresh seed in this new isolated container.
  for group in RECEIVING TRANSFER_CUSTODY MATERIAL_JOURNEY; do
    nonce=$(openssl rand -hex 6)
    [[ "$nonce" =~ ^[0-9a-f]{12}$ ]]
    case "$group" in
      RECEIVING) file=receiving.integration.spec.js ;;
      TRANSFER_CUSTODY) file=transfer-custody.integration.spec.js ;;
      MATERIAL_JOURNEY) file=prototype-material-journey.integration.spec.js ;;
    esac
    run_test "$group" "construction_erp_v10e_upgrade_$nonce" "apps/api/dist/inventory/$file"
  done
  echo M6_PRIOR_SS16_CONSOLIDATED_NOT_RERUN
else
  export M6_SS16_DISPOSABLE_DB="m6_ss16_$SUFFIX"
  run_test SS16_CONSOLIDATED "$M6_SS16_DISPOSABLE_DB" apps/api/dist/inventory/movement-correction-posted.native.m6.js
fi
echo "M6_FOCUSED_CANDIDATE=$expected"
echo "M6_PRIOR_SIX_NATIVE_GROUPS_AND_FM02_NOT_RERUN"
exit "$FAIL"
