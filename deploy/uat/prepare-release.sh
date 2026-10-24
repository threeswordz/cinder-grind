#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
cd "$REPO_ROOT"

pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:validate
pnpm audit --prod --audit-level=high
node deploy/uat/validate-isolated.mjs

# Only the intended migration/status operations use the retained UAT URL.
# Integration tests above never run against that database or its Documents.
bash "$(dirname "$0")/start-postgres.sh"
pnpm prisma:migrate:deploy
pnpm --filter @construction-erp/api exec prisma migrate status

echo "Release candidate prepared successfully."
echo "Next: run deploy/uat/bootstrap-admin.sh once for a fresh database."
