#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
cd "$REPO_ROOT"

bash "$(dirname "$0")/start-postgres.sh"

pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:validate
pnpm audit --prod --audit-level=high
pnpm prisma:migrate:deploy
pnpm --filter @construction-erp/api exec prisma migrate status
pnpm validate

echo "Release candidate prepared successfully."
echo "Next: run deploy/uat/bootstrap-admin.sh once for a fresh database."
