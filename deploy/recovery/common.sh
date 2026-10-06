#!/usr/bin/env bash
set -euo pipefail

RECOVERY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$RECOVERY_DIR/../.." && pwd)"
PROD_DIR="$REPO_ROOT/deploy/production"
ENV_FILE="${PRODUCTION_ENV_FILE:-$PROD_DIR/.env}"

fail() {
  echo "Recovery safety check failed: $*" >&2
  exit 1
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    fail "$name is required"
  fi
}

if [[ ! -f "$ENV_FILE" ]]; then
  fail "missing Production environment file: $ENV_FILE"
fi

umask 077
env_dump="$(mktemp)"
cleanup_env_dump() {
  rm -f "$env_dump"
}
trap cleanup_env_dump EXIT

node "$PROD_DIR/load-env.mjs" "$ENV_FILE" > "$env_dump"
while IFS= read -r -d '' env_key && IFS= read -r -d '' env_value; do
  if [[ ! "$env_key" =~ ^[A-Z][A-Z0-9_]*$ ]]; then
    fail "invalid Production environment key: $env_key"
  fi
  printf -v "$env_key" '%s' "$env_value"
  export "$env_key"
done < "$env_dump"

cleanup_env_dump
trap - EXIT

for required_name in NODE_ENV RELEASE_COMMIT DATABASE_URL STORAGE_ROOT STORAGE_DEPLOYMENT_ID; do
  require_env "$required_name"
done

[[ "$NODE_ENV" == "production" ]] || fail "NODE_ENV must equal production"
[[ "$RELEASE_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || fail "RELEASE_COMMIT must be a full Git SHA"
[[ "$STORAGE_ROOT" = /* ]] || fail "STORAGE_ROOT must be absolute"
[[ "$STORAGE_DEPLOYMENT_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$ ]] || fail "STORAGE_DEPLOYMENT_ID is invalid"

cd "$REPO_ROOT"
actual_commit="$(git rev-parse HEAD)"
[[ "$actual_commit" == "$RELEASE_COMMIT" ]] || fail "exact-release check failed: expected $RELEASE_COMMIT but checked out $actual_commit"

assert_source_storage_identity() {
  local sentinel="$STORAGE_ROOT/.construction-erp-storage-ready"
  local expected="construction-erp-production-storage-v1:$STORAGE_DEPLOYMENT_ID"
  [[ -d "$STORAGE_ROOT" ]] || fail "STORAGE_ROOT does not exist: $STORAGE_ROOT"
  [[ -r "$STORAGE_ROOT" ]] || fail "STORAGE_ROOT is not readable: $STORAGE_ROOT"
  [[ -f "$sentinel" ]] || fail "Production Documents sentinel is missing: $sentinel"
  [[ "$(cat "$sentinel")" == "$expected" ]] || fail "Production Documents sentinel does not match STORAGE_DEPLOYMENT_ID"
}
