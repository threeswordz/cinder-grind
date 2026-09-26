#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

echo "This deletes ONLY the local V0.1 UAT PostgreSQL container and named volume:"
echo "  container: $UAT_DB_CONTAINER"
echo "  volume:    $UAT_DB_VOLUME"
echo
echo "Use this only before UAT business data/evidence must be retained."
read -r -p 'Type RESET-UAT-DB to continue: ' confirmation

if [[ "$confirmation" != "RESET-UAT-DB" ]]; then
  echo "Cancelled. No database data was deleted."
  exit 1
fi

if podman container exists "$UAT_DB_CONTAINER"; then
  podman rm -f "$UAT_DB_CONTAINER" >/dev/null
fi

if podman volume inspect "$UAT_DB_VOLUME" >/dev/null 2>&1; then
  podman volume rm "$UAT_DB_VOLUME" >/dev/null
fi

echo "Fresh UAT database state cleared."
echo "Next: bash deploy/uat/prepare-release.sh"
