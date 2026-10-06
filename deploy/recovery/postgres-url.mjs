import { normalizePostgresUrl } from './postgres-url-lib.mjs';

try {
  process.stdout.write(normalizePostgresUrl(process.argv[2]));
} catch (error) {
  process.stderr.write(
    `PostgreSQL URL normalization failed: ${error instanceof Error ? error.message : String(error)}.\n`,
  );
  process.exit(1);
}
