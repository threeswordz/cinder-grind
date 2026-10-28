#!/usr/bin/env bash
set -euo pipefail

RECOVERY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set_dir="${1:-}"
if [[ -z "$set_dir" ]]; then
  echo "Usage: $0 <recovery-set-dir>" >&2
  exit 1
fi

node "$RECOVERY_DIR/manifest.mjs" verify "$set_dir"
bash "$RECOVERY_DIR/verify-documents-archive.sh" "$set_dir/documents.tar.gz"

echo "Recovery set archive paths verified."

# A declared empty UAT payload must contain directories only. Reuse tar's
# materialized verbose listing and the entry-type convention above.
if [[ "$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(process.argv[1])).documentFileCount))" "$set_dir/manifest.json")" == "0" ]]; then
  listing="$(mktemp)"
  trap 'rm -f "$listing"' EXIT
  tar --list --verbose --gzip --file="$set_dir/documents.tar.gz" > "$listing"
  if grep -Ev '^d' "$listing" >/dev/null; then
    echo "Empty recovery payload contains a non-directory entry." >&2
    exit 1
  fi
fi
