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

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

node "$PROD_DIR/validate-env.mjs"

cd "$REPO_ROOT"
actual_commit="$(git rev-parse HEAD)"
if [[ "$actual_commit" != "$RELEASE_COMMIT" ]]; then
  echo "Exact-release check failed: expected $RELEASE_COMMIT but checked out $actual_commit"
  exit 1
fi
