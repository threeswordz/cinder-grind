#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

base="${WEB_ORIGIN%/}"
health_body="$(mktemp)"
web_body="$(mktemp)"
cleanup_smoke() {
  rm -f "$health_body" "$web_body"
}
trap cleanup_smoke EXIT

echo "Checking HTTPS health endpoint: $base/api/v1/health"
health_status="$(curl --silent --show-error --proto '=https' --output "$health_body" --write-out '%{http_code}' "$base/api/v1/health")"
if [[ ! "$health_status" =~ ^2[0-9][0-9]$ ]]; then
  echo "Health endpoint returned unexpected HTTP status: $health_status"
  exit 1
fi
node - "$health_body" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
let payload;
try {
  payload = JSON.parse(fs.readFileSync(path, 'utf8'));
} catch {
  process.stderr.write('Health endpoint did not return valid JSON.\n');
  process.exit(1);
}
if (payload?.status !== 'ok' || payload?.database !== 'ok') {
  process.stderr.write('Health endpoint did not report status=ok and database=ok.\n');
  process.exit(1);
}
NODE

echo "Checking HTTPS web root: $base/"
web_status="$(curl --silent --show-error --proto '=https' --output "$web_body" --write-out '%{http_code}' "$base/")"
if [[ ! "$web_status" =~ ^2[0-9][0-9]$ ]]; then
  echo "Web root returned unexpected HTTP status: $web_status"
  exit 1
fi
if [[ ! -s "$web_body" ]]; then
  echo "Web root returned an empty response body."
  exit 1
fi

echo "Production transport/process smoke checks passed."
