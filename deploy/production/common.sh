#!/usr/bin/env bash
set -euo pipefail

PROD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$PROD_DIR/../.." && pwd)"
ENV_FILE="${PRODUCTION_ENV_FILE:-$PROD_DIR/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing production environment file: $ENV_FILE"
  echo "Copy deploy/production/.env.example to a protected external .env file or set PRODUCTION_ENV_FILE."
  exit 1
fi

while IFS= read -r -d '' env_key && IFS= read -r -d '' env_value; do
  if [[ ! "$env_key" =~ ^[A-Z][A-Z0-9_]*$ ]]; then
    echo "Invalid Production environment key: $env_key"
    exit 1
  fi
  printf -v "$env_key" '%s' "$env_value"
  export "$env_key"
done < <(node "$PROD_DIR/load-env.mjs" "$ENV_FILE")

node "$PROD_DIR/validate-env.mjs"

cd "$REPO_ROOT"
actual_commit="$(git rev-parse HEAD)"
if [[ "$actual_commit" != "$RELEASE_COMMIT" ]]; then
  echo "Exact-release check failed: expected $RELEASE_COMMIT but checked out $actual_commit"
  exit 1
fi
