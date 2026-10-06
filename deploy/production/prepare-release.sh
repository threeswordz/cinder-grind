#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Production release preparation requires a clean Git working tree."
  exit 1
fi

if [[ ! -d "$STORAGE_ROOT" || ! -w "$STORAGE_ROOT" ]]; then
  echo "STORAGE_ROOT must already exist and be writable by the application account: $STORAGE_ROOT"
  exit 1
fi

pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:validate
pnpm audit --prod --audit-level=high

# Never execute the repository integration test suite against Production data.
# Full tests are a required CI gate against isolated CI PostgreSQL. The target
# host performs only non-destructive compile/type validation before migrations.
pnpm typecheck
pnpm build

echo "Verified recovery point: $RECOVERY_POINT_REFERENCE (deployment mode: $DEPLOYMENT_MODE)"
pnpm prisma:migrate:deploy
pnpm --filter @construction-erp/api exec prisma migrate status

echo "Production release $RELEASE_COMMIT prepared successfully."
echo "The web build uses VITE_API_BASE_URL=$VITE_API_BASE_URL."
