import { spawnSync } from 'node:child_process';
import { normalizePostgresUrl } from './postgres-url-lib.mjs';

function fail(message) {
  process.stderr.write(`PostgreSQL identity check failed: ${message}\n`);
  process.exit(1);
}

let nativeUrl;
try {
  const supplied = new URL(process.argv[2] ?? '');
  if (supplied.password || supplied.searchParams.has('password')) {
    fail('credential-bearing URL arguments are prohibited; use a protected PGPASSFILE');
  }
  nativeUrl = normalizePostgresUrl(supplied.toString());
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const sql = `
  SELECT json_build_array(
    COALESCE(inet_server_addr()::text, 'local-socket'),
    COALESCE(inet_server_port(), current_setting('port')::int),
    current_database()
  )::text
`;

const result = spawnSync(
  'psql',
  [
    nativeUrl,
    '--no-psqlrc',
    '--set=ON_ERROR_STOP=1',
    '--tuples-only',
    '--no-align',
    '--command',
    sql,
  ],
  { encoding: 'utf8' },
);

if (result.error) {
  fail(`unable to run psql: ${result.error.message}`);
}
if (result.status !== 0) {
  const detail = (result.stderr || result.stdout || '').trim();
  fail(detail || `psql exited with status ${result.status}`);
}

const lines = result.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
if (lines.length !== 1) {
  fail(`expected one identity row, received ${lines.length}`);
}

let databaseIdentity;
try {
  databaseIdentity = JSON.parse(lines[0]);
} catch {
  fail('database returned an invalid identity payload');
}

if (
  !Array.isArray(databaseIdentity) ||
  databaseIdentity.length !== 3 ||
  typeof databaseIdentity[0] !== 'string' ||
  !Number.isInteger(databaseIdentity[1]) ||
  typeof databaseIdentity[2] !== 'string' ||
  !databaseIdentity[0] ||
  !databaseIdentity[2]
) {
  fail('database returned an incomplete identity payload');
}

process.stdout.write(
  JSON.stringify([
    databaseIdentity[0].toLowerCase(),
    databaseIdentity[1],
    databaseIdentity[2],
  ]),
);
