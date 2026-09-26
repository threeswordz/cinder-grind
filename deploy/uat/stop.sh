#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

if podman container exists "$UAT_DB_CONTAINER"; then
  podman stop "$UAT_DB_CONTAINER" >/dev/null || true
fi

echo "UAT PostgreSQL stopped. API/web foreground processes should be stopped with Ctrl+C in their terminals."
