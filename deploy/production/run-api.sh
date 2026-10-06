#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

echo "Starting Production API for release $RELEASE_COMMIT on $API_HOST:$API_PORT"
exec pnpm --filter @construction-erp/api start
