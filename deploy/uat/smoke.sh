#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

api="http://127.0.0.1:${API_PORT}/api/v1/health"
web="http://127.0.0.1:${WEB_PORT}/"

echo "Checking $api"
curl --fail --silent --show-error "$api" >/dev/null

echo "Checking $web"
curl --fail --silent --show-error "$web" >/dev/null

echo "Basic process smoke checks passed."
echo "Continue with the manual authenticated/project/document checks in docs/V0.1-DEPLOYMENT-ROLLBACK.md and docs/V0.1-UAT.md."
