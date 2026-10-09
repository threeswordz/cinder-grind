import { spawnSync } from 'node:child_process';
import { normalizePostgresUrl } from './postgres-url-lib.mjs';

function fail(message) {
  process.stderr.write(`Restore database emptiness check failed: ${message}\n`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) {
    fail(`unable to run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    fail(detail || `${command} exited with status ${result.status}`);
  }
  return result.stdout;
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

const schemaDump = run('pg_dump', [
  '--schema-only',
  '--format=plain',
  '--no-owner',
  '--no-privileges',
  '--no-comments',
  nativeUrl,
]);

const schemaFindings = schemaDump
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => {
    if (!line || line.startsWith('--')) {
      return false;
    }
    if (line.startsWith('\\restrict ') || line.startsWith('\\unrestrict ')) {
      return false;
    }
    if (/^SET\s+.+;$/.test(line)) {
      return false;
    }
    if (/^SELECT pg_catalog\.set_config\(.+;$/.test(line)) {
      return false;
    }
    return true;
  })
  .slice(0, 20)
  .map((line) => `schema-object:${line}`);

const largeObjectSql = `
  SELECT 'large-object:' || oid::text
  FROM pg_largeobject_metadata
  ORDER BY oid
  LIMIT 20
`;

const largeObjectFindings = run('psql', [
  nativeUrl,
  '--no-psqlrc',
  '--set=ON_ERROR_STOP=1',
  '--tuples-only',
  '--no-align',
  '--command',
  largeObjectSql,
])
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const findings = [...schemaFindings, ...largeObjectFindings].slice(0, 20);

if (findings.length > 0) {
  fail(
    `target database must be empty at database scope; found existing user object(s): ${findings.join(', ')}`,
  );
}

process.stdout.write('Restore target database is empty at database scope.\n');
