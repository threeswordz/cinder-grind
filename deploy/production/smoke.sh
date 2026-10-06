#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

base="${WEB_ORIGIN%/}"
echo "Checking HTTPS health endpoint: $base/api/v1/health"
curl --fail --silent --show-error --proto '=https' "$base/api/v1/health" >/dev/null

echo "Checking HTTPS web root: $base/"
curl --fail --silent --show-error --proto '=https' "$base/" >/dev/null

echo "Production transport/process smoke checks passed."
