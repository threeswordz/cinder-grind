#!/usr/bin/env bash
set -euo pipefail

UAT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$UAT_DIR/../.." && pwd)"
ENV_FILE="$UAT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy deploy/uat/.env.example to deploy/uat/.env and replace the placeholders."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${UAT_DB_CONTAINER:?UAT_DB_CONTAINER is required}"
: "${UAT_DB_VOLUME:?UAT_DB_VOLUME is required}"
: "${UAT_DB_PORT:?UAT_DB_PORT is required}"
: "${UAT_DB_NAME:?UAT_DB_NAME is required}"
: "${UAT_DB_USER:?UAT_DB_USER is required}"
: "${UAT_DB_PASSWORD:?UAT_DB_PASSWORD is required}"
: "${API_HOST:?API_HOST is required}"
: "${API_PORT:?API_PORT is required}"
: "${WEB_HOST:?WEB_HOST is required}"
: "${WEB_PORT:?WEB_PORT is required}"
: "${UAT_DATA_ROOT:?UAT_DATA_ROOT is required}"

if [[ "$API_HOST" != "127.0.0.1" || "$WEB_HOST" != "127.0.0.1" ]]; then
  echo "V0.1 local UAT scripts are intentionally loopback-only."
  echo "Do not expose them to a LAN/Internet without a separately reviewed HTTPS deployment."
  exit 1
fi

export DATABASE_URL="postgresql://${UAT_DB_USER}:${UAT_DB_PASSWORD}@127.0.0.1:${UAT_DB_PORT}/${UAT_DB_NAME}?schema=public"
export WEB_ORIGIN="http://127.0.0.1:${WEB_PORT}"
export VITE_API_BASE_URL="http://127.0.0.1:${API_PORT}/api/v1"
export STORAGE_ROOT="${UAT_DATA_ROOT}/documents"

mkdir -p "$STORAGE_ROOT"
