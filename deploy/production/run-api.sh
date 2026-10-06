#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

storage_sentinel="$STORAGE_ROOT/.construction-erp-storage-ready"
storage_sentinel_value="construction-erp-production-storage-v1:$STORAGE_DEPLOYMENT_ID"
if [[ ! -f "$storage_sentinel" || "$(cat "$storage_sentinel")" != "$storage_sentinel_value" ]]; then
  echo "Refusing Production API startup: persistent document storage sentinel is missing or invalid."
  exit 1
fi

echo "Starting Production API for release $RELEASE_COMMIT on $API_HOST:$API_PORT"
exec pnpm --filter @construction-erp/api start
