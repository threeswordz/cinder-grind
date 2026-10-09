#!/usr/bin/env bash
set -euo pipefail

RECOVERY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$RECOVERY_DIR/../.." && pwd)"
PROD_DIR="$REPO_ROOT/deploy/production"
ENV_FILE="${PRODUCTION_ENV_FILE:-$PROD_DIR/.env}"

fail() {
  echo "Application rollback compatibility check failed: $*" >&2
  exit 1
}

[[ -f "$ENV_FILE" ]] || fail "missing Production environment file: $ENV_FILE"
[[ -n "${ROLLBACK_RELEASE_COMMIT:-}" ]] || fail "ROLLBACK_RELEASE_COMMIT is required"
[[ -n "${CURRENT_RELEASE_COMMIT:-}" ]] || fail "CURRENT_RELEASE_COMMIT is required"
[[ "$ROLLBACK_RELEASE_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || fail "ROLLBACK_RELEASE_COMMIT must be a full Git SHA"
[[ "$CURRENT_RELEASE_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || fail "CURRENT_RELEASE_COMMIT must be a full Git SHA"

umask 077
env_dump="$(mktemp)"
trap 'rm -f "$env_dump"' EXIT
node "$PROD_DIR/load-env.mjs" "$ENV_FILE" > "$env_dump"
while IFS= read -r -d '' env_key && IFS= read -r -d '' env_value; do
  printf -v "$env_key" '%s' "$env_value"
  export "$env_key"
done < "$env_dump"
rm -f "$env_dump"
trap - EXIT

[[ "${NODE_ENV:-}" == "production" ]] || fail "NODE_ENV must equal production"
[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL is required"

cd "$REPO_ROOT"
actual_commit="$(git rev-parse HEAD)"
[[ "$actual_commit" == "$ROLLBACK_RELEASE_COMMIT" ]] || fail "check must run from the exact rollback release checkout"
[[ -z "$(git status --porcelain)" ]] || fail "rollback compatibility check requires a clean working tree"

if ! git cat-file -e "$CURRENT_RELEASE_COMMIT^{commit}" 2>/dev/null; then
  fail "CURRENT_RELEASE_COMMIT is not available in the local Git history"
fi

if ! git diff --quiet "$ROLLBACK_RELEASE_COMMIT" "$CURRENT_RELEASE_COMMIT" -- apps/api/prisma/migrations; then
  fail "Prisma migration history differs between rollback and current releases; application-only rollback is not authorized. Use the matching database + Documents recovery set."
fi

pnpm prisma:validate
pnpm --filter @construction-erp/api exec prisma migrate status

echo "Application-only rollback compatibility check PASSED: migration history is unchanged and Prisma reports the current database compatible with the rollback release."
