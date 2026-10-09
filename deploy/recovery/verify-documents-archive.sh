#!/usr/bin/env bash
set -euo pipefail

archive="${1:-}"
if [[ -z "$archive" || ! -f "$archive" ]]; then
  echo "Usage: $0 <documents.tar.gz>" >&2
  exit 1
fi

listing_file="$(mktemp)"
verbose_file="$(mktemp)"
cleanup() {
  rm -f "$listing_file" "$verbose_file"
}
trap cleanup EXIT

# Materialize the entire archive listing before matching. This deliberately avoids
# grep -q short-circuiting tar under pipefail and accidentally turning a match
# into a producer SIGPIPE that skips the rejection branch.
tar --list --gzip --file="$archive" > "$listing_file"
if grep -Eq '(^/|(^|/)\.\.(/|$))' "$listing_file"; then
  echo "Recovery Documents archive contains an unsafe path." >&2
  exit 1
fi

# LOCAL document storage is byte-file storage. Links are not valid recovery
# payloads because they can escape the restored storage boundary or depend on
# targets that are not present in the recovery set.
tar --list --verbose --gzip --file="$archive" > "$verbose_file"
if grep -Eq '^[lh]' "$verbose_file"; then
  echo "Recovery Documents archive contains a symbolic or hard link." >&2
  exit 1
fi
if grep -Ev '^[-d]' "$verbose_file" >/dev/null; then
  echo "Recovery Documents archive contains an unsupported special entry type; only regular files and directories are allowed." >&2
  exit 1
fi

echo "Recovery Documents archive paths and entry types verified."
