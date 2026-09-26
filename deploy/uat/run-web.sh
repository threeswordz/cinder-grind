#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
cd "$REPO_ROOT"

echo "Starting web on http://127.0.0.1:$WEB_PORT"
node deploy/uat/serve-web.mjs
