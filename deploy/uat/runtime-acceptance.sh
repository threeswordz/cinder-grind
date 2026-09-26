#!/usr/bin/env bash
set -euo pipefail

UAT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$UAT_DIR/../.." && pwd)"
ENV_FILE="$UAT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

cd "$REPO_ROOT"
node deploy/uat/runtime-acceptance.mjs
