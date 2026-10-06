#!/usr/bin/env bash
set -euo pipefail

RECOVERY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set_dir="${1:-}"
if [[ -z "$set_dir" ]]; then
  echo "Usage: $0 <recovery-set-dir>" >&2
  exit 1
fi

node "$RECOVERY_DIR/manifest.mjs" verify "$set_dir"

if tar --list --gzip --file="$set_dir/documents.tar.gz" \
  | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  echo "Recovery Documents archive contains an unsafe path." >&2
  exit 1
fi

echo "Recovery set archive paths verified."
