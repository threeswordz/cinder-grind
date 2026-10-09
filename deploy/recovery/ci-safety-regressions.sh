#!/usr/bin/env bash
set -euo pipefail

source_storage="${1:-}"
env_file="${2:-}"
[[ -n "$source_storage" && -n "$env_file" ]] || {
  echo "usage: ci-safety-regressions.sh <source-storage> <production-env-file>" >&2
  exit 2
}

source_url="${DATABASE_URL:?DATABASE_URL is required}"
declare -a auth_files=()

cleanup_auth_files() {
  local auth_file
  for auth_file in "${auth_files[@]:-}"; do
    [[ -n "$auth_file" ]] && rm -f "$auth_file"
  done
}
trap cleanup_auth_files EXIT

prepare_native_auth() {
  local raw_url="$1"
  local url_var="$2"
  local pgpass_var="$3"
  local pgpass_file
  local native_url

  pgpass_file="$(mktemp)"
  chmod 600 "$pgpass_file"
  native_url="$(POSTGRES_RAW_URL="$raw_url" PGPASSFILE="$pgpass_file" node deploy/recovery/postgres-url.mjs)"
  auth_files+=("$pgpass_file")
  printf -v "$url_var" '%s' "$native_url"
  printf -v "$pgpass_var" '%s' "$pgpass_file"
}

expect_failure() {
  local log_file="$1"
  local expected="$2"
  shift 2

  set +e
  "$@" >"$log_file" 2>&1
  local status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    echo "Expected command to fail but it succeeded: $*" >&2
    exit 1
  fi
  if ! grep -q "$expected" "$log_file"; then
    echo "Command failed for an unexpected reason: $*" >&2
    cat "$log_file" >&2
    exit 1
  fi
}

run_restore_failure_case() {
  local restore_url="$1"
  local restore_storage="$2"
  local production_env="$3"

  RESTORE_ENVIRONMENT=drill \
  RESTORE_DATABASE_URL="$restore_url" \
  RESTORE_STORAGE_ROOT="$restore_storage" \
  RESTORE_RUNTIME_UID="$(id -u)" \
  RESTORE_RUNTIME_GID="$(id -g)" \
  PRODUCTION_ENV_FILE="$production_env" \
    bash deploy/recovery/restore-drill.sh /tmp/v10-unsafe-empty-recovery-set
}

credential_probe_url='postgresql://recovery_user:argv-secret%3Awith%5Cchars@localhost:5432/recovery_db?schema=public&connection_limit=3'
prepare_native_auth "$credential_probe_url" credential_probe_native credential_probe_pgpass
node - "$credential_probe_native" "$credential_probe_pgpass" <<'NODE'
const { readFileSync, statSync } = require('node:fs');
const native = new URL(process.argv[2]);
if (native.password || native.searchParams.has('password') || process.argv[2].includes('argv-secret')) {
  throw new Error('credential leaked into native PostgreSQL URL');
}
const mode = statSync(process.argv[3]).mode & 0o777;
if (mode !== 0o600) {
  throw new Error(`PGPASSFILE mode must be 0600, received ${mode.toString(8)}`);
}
const pgpass = readFileSync(process.argv[3], 'utf8');
if (pgpass !== 'localhost:5432:recovery_db:recovery_user:argv-secret\\:with\\\\chars\n') {
  throw new Error('PGPASSFILE did not contain the expected escaped credential');
}
NODE

expect_failure   /tmp/v10-identity-credential-argv.log   'credential-bearing URL arguments are prohibited'   node deploy/recovery/postgres-identity.mjs "$credential_probe_url"

expect_failure   /tmp/v10-emptydb-credential-argv.log   'credential-bearing URL arguments are prohibited'   node deploy/recovery/verify-empty-database.mjs "$credential_probe_url"

ipv6_credential_probe_url='postgresql://recovery_user:ipv6-secret@[::1]:5432/recovery_db'
prepare_native_auth "$ipv6_credential_probe_url" ipv6_credential_probe_native ipv6_credential_probe_pgpass
node - "$ipv6_credential_probe_pgpass" <<'NODE'
const { readFileSync } = require('node:fs');
const pgpass = readFileSync(process.argv[2], 'utf8');
if (pgpass !== '\\:\\:1:5432:recovery_db:recovery_user:ipv6-secret\n') {
  throw new Error(`PGPASSFILE IPv6 host was not normalized correctly: ${JSON.stringify(pgpass)}`);
}
NODE

unix_socket_probe_url="$(SOURCE_DATABASE_URL="$source_url" node <<'NODE'
const url = new URL(process.env.SOURCE_DATABASE_URL);
url.searchParams.set('host', '/var/run/postgresql');
process.stdout.write(url.toString());
NODE
)"
prepare_native_auth "$unix_socket_probe_url" unix_socket_probe_native unix_socket_probe_pgpass
node - "$unix_socket_probe_native" "$unix_socket_probe_pgpass" <<'NODE'
const { readFileSync } = require('node:fs');
const native = new URL(process.argv[2]);
if (native.searchParams.get('host') !== '/var/run/postgresql') {
  throw new Error('Unix-socket host was not preserved in the native PostgreSQL URL');
}
const pgpass = readFileSync(process.argv[3], 'utf8');
if (!pgpass.startsWith('*:')) {
  throw new Error(`PGPASSFILE Unix-socket host was not scoped through a wildcard entry: ${JSON.stringify(pgpass)}`);
}
NODE

prepare_native_auth "$source_url" native_source_url source_pgpass

document_storage_key="$(
  PGPASSFILE="$source_pgpass" \
    psql "$native_source_url" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
      --command="SELECT storage_key FROM documents WHERE storage_provider = 'LOCAL' ORDER BY id LIMIT 1"
)"
if [[ -n "$document_storage_key" ]]; then
  document_path="$source_storage/$document_storage_key"
  [[ -f "$document_path" ]] || {
    echo "Expected coherent LOCAL document fixture is missing: $document_path" >&2
    exit 1
  }
  external_document=/tmp/v10-symlink-external-document
  original_document=/tmp/v10-symlink-original-document
  cp "$document_path" "$external_document"
  mv "$document_path" "$original_document"
  ln -s "$external_document" "$document_path"

  run_document_verifier() {
    DOCUMENT_STORAGE_ROOT="$source_storage" node apps/api/scripts/verify-restored-documents.mjs
  }
  expect_failure \
    /tmp/v10-document-symlink.log \
    'storage target must not be a symbolic link' \
    run_document_verifier

  rm -f "$document_path" "$external_document"
  mv "$original_document" "$document_path"
fi

rm -rf /tmp/v10-archive-safety
mkdir -p /tmp/v10-archive-safety/input
printf '%s\n' unsafe > /tmp/v10-archive-safety/input/first
for i in $(seq 1 2500); do
  printf '%s\n' "$i" > "/tmp/v10-archive-safety/input/filler-$i"
done
tar --create --gzip --file=/tmp/v10-archive-safety/unsafe-path.tar.gz \
  --transform='s|^first$|../escape|' \
  --directory=/tmp/v10-archive-safety/input .
# Rebuild with the unsafe member first so the historical grep -q + pipefail bug
# would short-circuit tar before it consumed the large remainder.
tar --create --gzip --file=/tmp/v10-archive-safety/unsafe-path.tar.gz \
  --transform='s|^first$|../escape|' \
  --directory=/tmp/v10-archive-safety/input first $(printf 'filler-%s ' $(seq 1 2500))
expect_failure \
  /tmp/v10-unsafe-archive-path.log \
  'contains an unsafe path' \
  bash deploy/recovery/verify-documents-archive.sh /tmp/v10-archive-safety/unsafe-path.tar.gz

ln -s /tmp/v10-link-target /tmp/v10-archive-safety/input/link-entry
tar --create --gzip --file=/tmp/v10-archive-safety/symlink.tar.gz \
  --directory=/tmp/v10-archive-safety/input link-entry
expect_failure \
  /tmp/v10-unsafe-archive-link.log \
  'contains a symbolic or hard link' \
  bash deploy/recovery/verify-documents-archive.sh /tmp/v10-archive-safety/symlink.tar.gz

rm -f /tmp/v10-archive-safety/input/link-entry
mkfifo /tmp/v10-archive-safety/input/fifo-entry
tar --create --gzip --file=/tmp/v10-archive-safety/fifo.tar.gz \
  --directory=/tmp/v10-archive-safety/input fifo-entry
expect_failure \
  /tmp/v10-unsafe-archive-fifo.log \
  'unsupported special entry type' \
  bash deploy/recovery/verify-documents-archive.sh /tmp/v10-archive-safety/fifo.tar.gz

rm -rf /tmp/v10-archive-safety

prisma_parameter_url="$(SOURCE_DATABASE_URL="$source_url" node <<'NODE'
const url = new URL(process.env.SOURCE_DATABASE_URL);
for (const [key, value] of [
  ['schema', 'alternate'],
  ['connection_limit', '7'],
  ['pool_timeout', '11'],
  ['socket_timeout', '13'],
  ['pgbouncer', 'true'],
  ['statement_cache_size', '0'],
  ['sslidentity', '/tmp/client-identity.p12'],
  ['sslaccept', 'strict'],
  ['connect_timeout', '17'],
  ['sslmode', 'prefer'],
  ['application_name', 'construction-erp-recovery'],
  ['channel_binding', 'prefer'],
  ['options', '-c statement_timeout=30000'],
]) {
  url.searchParams.set(key, value);
}
process.stdout.write(url.toString());
NODE
)"
prepare_native_auth "$prisma_parameter_url" native_parameter_url parameter_pgpass
node - "$native_parameter_url" <<'NODE'
const url = new URL(process.argv[2]);
if (url.password || url.searchParams.has('password')) {
  throw new Error('database password leaked into native PostgreSQL URL');
}
for (const key of [
  'schema',
  'connection_limit',
  'pool_timeout',
  'socket_timeout',
  'pgbouncer',
  'statement_cache_size',
  'sslidentity',
  'sslaccept',
]) {
  if (url.searchParams.has(key)) {
    throw new Error(`Prisma-only parameter leaked into libpq URL: ${key}`);
  }
}
for (const [key, expected] of [
  ['connect_timeout', '17'],
  ['sslmode', 'prefer'],
  ['application_name', 'construction-erp-recovery'],
  ['channel_binding', 'prefer'],
  ['options', '-c statement_timeout=30000'],
]) {
  if (url.searchParams.get(key) !== expected) {
    throw new Error(`libpq-compatible parameter was not preserved: ${key}`);
  }
}
NODE

schema_alias_url="$(SOURCE_DATABASE_URL="$source_url" node <<'NODE'
const url = new URL(process.env.SOURCE_DATABASE_URL);
url.searchParams.set('schema', 'alternate');
process.stdout.write(url.toString());
NODE
)"
prepare_native_auth "$schema_alias_url" native_schema_alias_url schema_alias_pgpass
source_identity="$(PGPASSFILE="$source_pgpass" node deploy/recovery/postgres-identity.mjs "$native_source_url")"
schema_alias_identity="$(PGPASSFILE="$schema_alias_pgpass" node deploy/recovery/postgres-identity.mjs "$native_schema_alias_url")"
if [[ "$source_identity" != "$schema_alias_identity" ]]; then
  echo "Database identity unexpectedly changed when only Prisma schema changed." >&2
  exit 1
fi

host_alias_url="$(SCHEMA_ALIAS_DATABASE_URL="$schema_alias_url" node <<'NODE'
const url = new URL(process.env.SCHEMA_ALIAS_DATABASE_URL);
if (url.hostname === 'localhost') {
  url.hostname = '127.0.0.1';
} else if (url.hostname === '127.0.0.1') {
  url.hostname = 'localhost';
} else {
  throw new Error(`CI alias regression requires localhost/127.0.0.1, received ${url.hostname}`);
}
process.stdout.write(url.toString());
NODE
)"
prepare_native_auth "$host_alias_url" native_host_alias_url host_alias_pgpass
host_alias_identity="$(PGPASSFILE="$host_alias_pgpass" node deploy/recovery/postgres-identity.mjs "$native_host_alias_url")"
if [[ "$source_identity" != "$host_alias_identity" ]]; then
  echo "Live database identity unexpectedly changed across localhost/127.0.0.1 aliases." >&2
  exit 1
fi

mkdir -p /tmp/v10-unsafe-empty-recovery-set
expect_failure   /tmp/v10-same-database-restore.log   'restore target resolves to the source PostgreSQL database'   run_restore_failure_case "$host_alias_url" /tmp/v10-unsafe-restored-documents "$env_file"

expect_failure   /tmp/v10-restore-storage-inside-source.log   'RESTORE_STORAGE_ROOT must be outside live Documents storage'   run_restore_failure_case "$schema_alias_url" "$source_storage/drill" "$env_file"

admin_url="$(SOURCE_DATABASE_URL="$source_url" node <<'NODE'
const url = new URL(process.env.SOURCE_DATABASE_URL);
url.pathname = '/postgres';
url.search = '';
process.stdout.write(url.toString());
NODE
)"
shared_restore_url="$(SOURCE_DATABASE_URL="$source_url" node <<'NODE'
const url = new URL(process.env.SOURCE_DATABASE_URL);
url.pathname = '/v10_shared_restore';
url.searchParams.set('schema', 'public');
url.searchParams.set('connection_limit', '3');
url.searchParams.set('pool_timeout', '5');
url.searchParams.set('socket_timeout', '7');
process.stdout.write(url.toString());
NODE
)"
prepare_native_auth "$admin_url" native_admin_url admin_pgpass
prepare_native_auth "$shared_restore_url" native_shared_restore_url shared_restore_pgpass

PGPASSFILE="$admin_pgpass" psql "$native_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 --command='DROP DATABASE IF EXISTS v10_shared_restore WITH (FORCE)'
PGPASSFILE="$admin_pgpass" psql "$native_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 --command='CREATE DATABASE v10_shared_restore'
PGPASSFILE="$shared_restore_pgpass" psql "$native_shared_restore_url" --no-psqlrc --set=ON_ERROR_STOP=1 --command='CREATE SCHEMA occupied; CREATE TABLE occupied.guard (id integer)'

expect_failure \
  /tmp/v10-nonempty-database-restore.log \
  'target database must be empty at database scope' \
  run_restore_failure_case "$shared_restore_url" /tmp/v10-nonempty-database-documents "$env_file"

PGPASSFILE="$shared_restore_pgpass" \
  psql "$native_shared_restore_url" --no-psqlrc --set=ON_ERROR_STOP=1 \
    --command='DROP SCHEMA occupied CASCADE; SELECT lo_create(424242);'

expect_failure \
  /tmp/v10-large-object-database-restore.log \
  'large-object:424242' \
  run_restore_failure_case "$shared_restore_url" /tmp/v10-large-object-database-documents "$env_file"

PGPASSFILE="$shared_restore_pgpass" \
  psql "$native_shared_restore_url" --no-psqlrc --set=ON_ERROR_STOP=1 \
    --command='SELECT lo_unlink(424242); CREATE TEXT SEARCH CONFIGURATION public.restore_probe (COPY = pg_catalog.english);'

expect_failure \
  /tmp/v10-text-search-config-database-restore.log \
  'target database must be empty at database scope' \
  run_restore_failure_case "$shared_restore_url" /tmp/v10-text-search-config-database-documents "$env_file"

PGPASSFILE="$admin_pgpass" psql "$native_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 --command='DROP DATABASE v10_shared_restore WITH (FORCE)'

expect_failure   /tmp/v10-recovery-root-dotdot.log   'RECOVERY_ROOT must be outside the repository'   env RECOVERY_ROOT="$GITHUB_WORKSPACE/../cinder-grind/recovery-artifacts"       RECOVERY_SITE_OFFLINE_CONFIRMED=YES       PRODUCTION_ENV_FILE="$env_file"       bash deploy/recovery/create-recovery-set.sh

external_storage=/tmp/v10-external-source-storage
path_test_env=/tmp/v10-recovery-path-test.env
rm -rf "$external_storage"
mkdir -p "$external_storage"
cp "$env_file" "$path_test_env"
sed -i "s|^STORAGE_ROOT=.*|STORAGE_ROOT=$external_storage|" "$path_test_env"

expect_failure   /tmp/v10-restore-storage-contains-source.log   'RESTORE_STORAGE_ROOT must not contain live Documents storage'   run_restore_failure_case "$schema_alias_url" /tmp "$path_test_env"

rm -f /tmp/v10-storage-link
ln -s "$external_storage" /tmp/v10-storage-link
expect_failure   /tmp/v10-recovery-root-symlink.log   'RECOVERY_ROOT must be outside Documents storage'   env RECOVERY_ROOT=/tmp/v10-storage-link/recovery-root       RECOVERY_SITE_OFFLINE_CONFIRMED=YES       PRODUCTION_ENV_FILE="$path_test_env"       bash deploy/recovery/create-recovery-set.sh
rm -f /tmp/v10-storage-link "$path_test_env"
rm -rf "$external_storage"

echo "V1.0-B recovery safety regressions passed."
