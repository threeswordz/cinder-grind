#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

if podman container exists "$UAT_DB_CONTAINER"; then
  if [[ "$(podman inspect -f '{{.State.Running}}' "$UAT_DB_CONTAINER")" != "true" ]]; then
    podman start "$UAT_DB_CONTAINER" >/dev/null
  fi
else
  podman volume inspect "$UAT_DB_VOLUME" >/dev/null 2>&1 || podman volume create "$UAT_DB_VOLUME" >/dev/null
  podman run -d     --name "$UAT_DB_CONTAINER"     -e POSTGRES_DB="$UAT_DB_NAME"     -e POSTGRES_USER="$UAT_DB_USER"     -e POSTGRES_PASSWORD="$UAT_DB_PASSWORD"     -p "127.0.0.1:${UAT_DB_PORT}:5432"     -v "${UAT_DB_VOLUME}:/var/lib/postgresql/data"     docker.io/library/postgres:17.11-alpine >/dev/null
fi

for _ in {1..30}; do
  if podman exec "$UAT_DB_CONTAINER" pg_isready -U "$UAT_DB_USER" -d "$UAT_DB_NAME" >/dev/null 2>&1; then
    echo "UAT PostgreSQL is ready on 127.0.0.1:$UAT_DB_PORT"
    exit 0
  fi
  sleep 1
done

echo "UAT PostgreSQL did not become ready."
exit 1
