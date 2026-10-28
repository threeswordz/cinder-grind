#!/usr/bin/env bash
set -euo pipefail
# No common.sh/.env sourcing, psql, grants, migration or ERP business mutation.
# Do not enable shell tracing: credentials exist only in this short-lived process.
set +x
runner="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/v12-local-readback.mjs"
if [[ "${1:-}" == --plan ]]; then
  exec node "$runner" "$@"
fi
[[ "${1:-}" == --check || "${1:-}" == --verify ]] && [[ "$#" -eq 4 ]] || {
  echo 'Usage: --plan PLAN | --check PLAN RETAINED_CHECKOUT NEW_RECEIPT | --verify PLAN RETAINED_CHECKOUT PRIOR_RECEIPT' >&2
  exit 1
}
[[ -t 0 ]] || { echo 'Interactive terminal required for hidden credentials.' >&2; exit 1; }
trap 'unset V12_READBACK_PASSWORD V12_READBACK_EMAIL' EXIT
read -r -p 'Existing business test persona email: ' V12_READBACK_EMAIL
read -r -s -p 'Password (hidden, never saved): ' V12_READBACK_PASSWORD
printf '\n'
export V12_READBACK_EMAIL V12_READBACK_PASSWORD
node "$runner" "$@"
