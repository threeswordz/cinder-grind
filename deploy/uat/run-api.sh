#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
cd "$REPO_ROOT"

echo "Starting API on http://127.0.0.1:$API_PORT/api/v1"
pnpm --filter @construction-erp/api start
