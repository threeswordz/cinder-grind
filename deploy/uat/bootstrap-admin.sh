#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"
cd "$REPO_ROOT"

if [[ "$BOOTSTRAP_ADMIN_PASSWORD" == replace-* ]]; then
  echo "Replace BOOTSTRAP_ADMIN_PASSWORD in deploy/uat/.env first."
  exit 1
fi

if (( ${#BOOTSTRAP_ADMIN_PASSWORD} < 12 )); then
  echo "BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters."
  echo "Generate a strong local UAT password, for example: openssl rand -hex 24"
  exit 1
fi

pnpm --filter @construction-erp/api bootstrap:admin
