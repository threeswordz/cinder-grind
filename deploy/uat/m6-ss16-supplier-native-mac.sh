#!/usr/bin/env bash
# One isolated build and one migrated template for outstanding integrated tests only.
# FM02 already passed on its unchanged test/service files; do not replay it here.
set -euo pipefail
umask 077
expected=${1:-}
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
pnpm prisma:generate
pnpm build:api
echo "===== M6 FOCUSED POLICY REGRESSIONS ====="
node --test apps/api/dist/inventory/movement-reversal-replay.spec.js apps/api/dist/inventory/movement-correction-authority.spec.js
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
export M6_SS08_DISPOSABLE_DB="m6_ss08_$SUFFIX"
run_test SS08 "$M6_SS08_DISPOSABLE_DB" apps/api/dist/inventory/m6-ss08-dimensions.integration.spec.js
run_test SS16_ISSUE "m6_issue_$SUFFIX" apps/api/dist/inventory/prototype-material-journey.integration.spec.js
run_test SS16_RETURN "m6_return_$SUFFIX" apps/api/dist/inventory/material-plan-issue.integration.spec.js
# Existing native transfer guard admits this name; this database exists only in CID.
run_test SS16_TRANSFER construction_erp apps/api/dist/inventory/transfer-custody.integration.spec.js
run_test PUR0814_CASE "m6_case_$SUFFIX" apps/api/dist/procurement/supplier-delivery-case.native.integration.spec.js
run_test PUR14_CUSTODY "m6_custody_$SUFFIX" apps/api/dist/procurement/supplier-return-custody.native.integration.spec.js
run_test PUR14_REPLACEMENT "m6_replacement_$SUFFIX" apps/api/dist/procurement/supplier-replacement-posted.native.integration.spec.js
echo "M6_FOCUSED_CANDIDATE=$expected"
echo "M6_FM02_PRIOR_NATIVE_PASS_RETAINED_NOT_RERUN"
exit "$FAIL"
