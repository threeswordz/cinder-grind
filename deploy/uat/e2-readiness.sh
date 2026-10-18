#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
cd "$REPO_ROOT"

export UAT_API_BASE_URL="${UAT_API_BASE_URL:-http://127.0.0.1:${API_PORT}/api/v1}"

echo "Checking V1.1-E2 configuration readiness against the approved local API"
echo "This check is read-only: it does not create users, roles, permissions, Project memberships or approval workflows."
node deploy/uat/e2-readiness.mjs
