#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

web_base="${WEB_ORIGIN%/}"
if [[ "$VITE_API_BASE_URL" == "/api/v1" ]]; then
  api_base="$web_base/api/v1"
else
  api_base="${VITE_API_BASE_URL%/}"
fi
health_body="$(mktemp)"
web_body="$(mktemp)"
cleanup_smoke() {
  rm -f "$health_body" "$web_body"
}
trap cleanup_smoke EXIT

echo "Checking HTTPS health endpoint: $api_base/health"
health_status="$(curl --silent --show-error --proto '=https' --output "$health_body" --write-out '%{http_code}' "$api_base/health")"
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

echo "Checking HTTPS web root: $web_base/"
web_status="$(curl --silent --show-error --proto '=https' --output "$web_body" --write-out '%{http_code}' "$web_base/")"
if [[ ! "$web_status" =~ ^2[0-9][0-9]$ ]]; then
  echo "Web root returned unexpected HTTP status: $web_status"
  exit 1
fi
if [[ ! -s "$web_body" ]]; then
  echo "Web root returned an empty response body."
  exit 1
fi
node - "$web_body" <<'NODE'
const fs = require('node:fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
if (!/<title[^>]*>\s*Construction ERP\s*<\/title>/i.test(html) || !/id=["']root["']/i.test(html)) {
  process.stderr.write('Web root did not contain the expected Construction ERP application markers.\n');
  process.exit(1);
}
NODE

echo "Production transport/process smoke checks passed."
