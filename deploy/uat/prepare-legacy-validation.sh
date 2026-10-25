#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
[[ "${LEGACY_NON_PRODUCTION_CONFIRMED:-}" == YES ]] || { echo 'Disposable fixture confirmation required' >&2; exit 1; }
: "${DATABASE_URL:?}" "${ERP_LEGACY_FIXTURE:?}"
# This never targets a retained schema: refuse any non-empty database first.
DEPLOYMENT_MODE=fresh node apps/api/scripts/verify-production-target.mjs
previous_commit=65857a384005e1734028ffb6945b1077ed3449e5
temporary="$(mktemp -d /tmp/erp-legacy-validation.XXXXXX)"
previous="$temporary/previous"
cleanup() { git worktree remove --force "$previous" >/dev/null 2>&1 || true; rm -rf "$temporary"; }
trap cleanup EXIT
git worktree add --detach "$previous" "$previous_commit"
(
  cd "$previous"
  pnpm install --frozen-lockfile --ignore-scripts
  pnpm prisma:generate
)
prefix="$temporary/prisma"
mkdir -p "$prefix/migrations"
cp "$previous/apps/api/prisma/schema.prisma" "$prefix/schema.prisma"
cp "$previous/apps/api/prisma/migrations/migration_lock.toml" "$prefix/migrations/"
for directory in "$previous"/apps/api/prisma/migrations/*/; do
  name="$(basename "$directory")"
  if [[ "$name" < 20261003083000_v0_7_a_source_currency_provenance ]]; then cp -a "$directory" "$prefix/migrations/$name"; fi
done
pnpm --filter @construction-erp/api exec prisma migrate deploy --schema "$prefix/schema.prisma"
node deploy/release-candidate/legacy-fixture.mjs early "$previous" "$ERP_LEGACY_FIXTURE"
pnpm --filter @construction-erp/api exec prisma migrate deploy --schema "$previous/apps/api/prisma/schema.prisma"
node deploy/release-candidate/legacy-fixture.mjs late "$previous" "$ERP_LEGACY_FIXTURE"
echo 'Genuine previous-release SGD/NULL validation fixture created before policy upgrade.'
