import { spawnSync } from 'node:child_process';
import { normalizePostgresUrl } from './postgres-url-lib.mjs';

function fail(message) {
  process.stderr.write(`Restore database emptiness check failed: ${message}\n`);
  process.exit(1);
}

let nativeUrl;
try {
  nativeUrl = normalizePostgresUrl(process.argv[2]);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const sql = `
  WITH findings(kind, object_name) AS (
    SELECT 'schema', nspname
    FROM pg_namespace
    WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'public')
      AND nspname NOT LIKE 'pg_toast%'
      AND nspname NOT LIKE 'pg_temp_%'

    UNION ALL

    SELECT 'relation', c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'routine', p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'type', t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype IN ('b', 'c', 'd', 'e', 'r', 'm')

    UNION ALL

    SELECT 'collation', c.collname
    FROM pg_collation c
    JOIN pg_namespace n ON n.oid = c.collnamespace
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'conversion', c.conname
    FROM pg_conversion c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public'

    UNION ALL

    SELECT 'extension', extname
    FROM pg_extension
    WHERE extname <> 'plpgsql'

    UNION ALL

    SELECT 'event-trigger', evtname
    FROM pg_event_trigger

    UNION ALL

    SELECT 'publication', pubname
    FROM pg_publication
  )
  SELECT kind || ':' || object_name
  FROM findings
  ORDER BY kind, object_name
  LIMIT 20
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

const findings = result.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

if (findings.length > 0) {
  fail(
    `target database must be empty at database scope; found existing user object(s): ${findings.join(', ')}`,
  );
}

process.stdout.write('Restore target database is empty at database scope.\n');
