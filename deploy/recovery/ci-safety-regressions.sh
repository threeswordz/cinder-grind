#!/usr/bin/env bash
set -euo pipefail

source_storage="${1:-}"
env_file="${2:-}"
[[ -n "$source_storage" && -n "$env_file" ]] || {
  echo "usage: ci-safety-regressions.sh <source-storage> <production-env-file>" >&2
  exit 2
}

source_url="${DATABASE_URL:?DATABASE_URL is required}"

prisma_parameter_url="$(node - "$source_url" <<'NODE'
const url = new URL(process.argv[2]);
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
native_parameter_url="$(node deploy/recovery/postgres-url.mjs "$prisma_parameter_url")"
node - "$native_parameter_url" <<'NODE'
const url = new URL(process.argv[2]);
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

schema_alias_url="$(node - "$source_url" <<'NODE'
const url = new URL(process.argv[2]);
url.searchParams.set('schema', 'alternate');
process.stdout.write(url.toString());
NODE
)"
source_identity="$(node deploy/recovery/postgres-identity.mjs "$source_url")"
schema_alias_identity="$(node deploy/recovery/postgres-identity.mjs "$schema_alias_url")"
if [[ "$source_identity" != "$schema_alias_identity" ]]; then
  echo "Database identity unexpectedly changed when only Prisma schema changed." >&2
  exit 1
fi

host_alias_url="$(node - "$schema_alias_url" <<'NODE'
const url = new URL(process.argv[2]);
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
host_alias_identity="$(node deploy/recovery/postgres-identity.mjs "$host_alias_url")"
if [[ "$source_identity" != "$host_alias_identity" ]]; then
  echo "Live database identity unexpectedly changed across localhost/127.0.0.1 aliases." >&2
  exit 1
fi

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

mkdir -p /tmp/v10-unsafe-empty-recovery-set
expect_failure \
  /tmp/v10-same-database-restore.log \
  'restore target resolves to the source PostgreSQL database' \
  env RESTORE_ENVIRONMENT=drill \
      RESTORE_DATABASE_URL="$host_alias_url" \
      RESTORE_STORAGE_ROOT=/tmp/v10-unsafe-restored-documents \
      PRODUCTION_ENV_FILE="$env_file" \
      bash deploy/recovery/restore-drill.sh /tmp/v10-unsafe-empty-recovery-set

expect_failure \
  /tmp/v10-restore-storage-inside-source.log \
  'RESTORE_STORAGE_ROOT must be outside live Documents storage' \
  env RESTORE_ENVIRONMENT=drill \
      RESTORE_DATABASE_URL="$schema_alias_url" \
      RESTORE_STORAGE_ROOT="$source_storage/drill" \
      PRODUCTION_ENV_FILE="$env_file" \
      bash deploy/recovery/restore-drill.sh /tmp/v10-unsafe-empty-recovery-set

admin_url="$(node - "$source_url" <<'NODE'
const url = new URL(process.argv[2]);
url.pathname = '/postgres';
url.search = '';
process.stdout.write(url.toString());
NODE
)"
shared_restore_url="$(node - "$source_url" <<'NODE'
const url = new URL(process.argv[2]);
url.pathname = '/v10_shared_restore';
url.searchParams.set('schema', 'public');
url.searchParams.set('connection_limit', '3');
url.searchParams.set('pool_timeout', '5');
url.searchParams.set('socket_timeout', '7');
process.stdout.write(url.toString());
NODE
)"
native_admin_url="$(node deploy/recovery/postgres-url.mjs "$admin_url")"
native_shared_restore_url="$(node deploy/recovery/postgres-url.mjs "$shared_restore_url")"
psql "$native_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 --command='DROP DATABASE IF EXISTS v10_shared_restore WITH (FORCE)'
psql "$native_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 --command='CREATE DATABASE v10_shared_restore'
psql "$native_shared_restore_url" --no-psqlrc --set=ON_ERROR_STOP=1 --command='CREATE SCHEMA occupied; CREATE TABLE occupied.guard (id integer)'

expect_failure \
  /tmp/v10-nonempty-database-restore.log \
  'target database must be empty at database scope' \
  env RESTORE_ENVIRONMENT=drill \
      RESTORE_DATABASE_URL="$shared_restore_url" \
      RESTORE_STORAGE_ROOT=/tmp/v10-nonempty-database-documents \
      PRODUCTION_ENV_FILE="$env_file" \
      bash deploy/recovery/restore-drill.sh /tmp/v10-unsafe-empty-recovery-set

psql "$native_admin_url" --no-psqlrc --set=ON_ERROR_STOP=1 --command='DROP DATABASE v10_shared_restore WITH (FORCE)'

expect_failure \
  /tmp/v10-recovery-root-dotdot.log \
  'RECOVERY_ROOT must be outside the repository' \
  env RECOVERY_ROOT="$GITHUB_WORKSPACE/../cinder-grind/recovery-artifacts" \
      RECOVERY_SITE_OFFLINE_CONFIRMED=YES \
      PRODUCTION_ENV_FILE="$env_file" \
      bash deploy/recovery/create-recovery-set.sh

external_storage=/tmp/v10-external-source-storage
path_test_env=/tmp/v10-recovery-path-test.env
rm -rf "$external_storage"
mkdir -p "$external_storage"
cp "$env_file" "$path_test_env"
sed -i "s|^STORAGE_ROOT=.*|STORAGE_ROOT=$external_storage|" "$path_test_env"

expect_failure \
  /tmp/v10-restore-storage-contains-source.log \
  'RESTORE_STORAGE_ROOT must not contain live Documents storage' \
  env RESTORE_ENVIRONMENT=drill \
      RESTORE_DATABASE_URL="$schema_alias_url" \
      RESTORE_STORAGE_ROOT=/tmp \
      PRODUCTION_ENV_FILE="$path_test_env" \
      bash deploy/recovery/restore-drill.sh /tmp/v10-unsafe-empty-recovery-set

rm -f /tmp/v10-storage-link
ln -s "$external_storage" /tmp/v10-storage-link
expect_failure \
  /tmp/v10-recovery-root-symlink.log \
  'RECOVERY_ROOT must be outside Documents storage' \
  env RECOVERY_ROOT=/tmp/v10-storage-link/recovery-root \
      RECOVERY_SITE_OFFLINE_CONFIRMED=YES \
      PRODUCTION_ENV_FILE="$path_test_env" \
      bash deploy/recovery/create-recovery-set.sh
rm -f /tmp/v10-storage-link "$path_test_env"
rm -rf "$external_storage"

echo "V1.0-B recovery safety regressions passed."
