import { spawnSync } from 'node:child_process';

const raw = process.argv[2];

function fail(message) {
  process.stderr.write(`PostgreSQL identity check failed: ${message}\n`);
  process.exit(1);
}

if (!raw) fail('URL argument is required');

let url;
try {
  url = new URL(raw);
} catch {
  fail('invalid URL');
}

if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
  fail('PostgreSQL protocol is required');
}

const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (!databaseName) fail('database name is required');

// Prisma's schema parameter is not part of database-level identity and is not
// understood by libpq tools. Resolve identity through a live PostgreSQL
// connection so hostname/DNS aliases cannot disguise the source database.
url.searchParams.delete('schema');

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
    url.toString(),
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

let identity;
try {
  identity = JSON.parse(lines[0]);
} catch {
  fail('database returned an invalid identity payload');
}

if (
  !Array.isArray(identity) ||
  identity.length !== 3 ||
  typeof identity[0] !== 'string' ||
  !Number.isInteger(identity[1]) ||
  typeof identity[2] !== 'string' ||
  !identity[0] ||
  !identity[2]
) {
  fail('database returned an incomplete identity payload');
}

process.stdout.write(JSON.stringify([identity[0].toLowerCase(), identity[1], identity[2]]));
