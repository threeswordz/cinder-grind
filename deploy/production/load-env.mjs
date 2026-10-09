import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const file = process.argv[2];
if (!file) {
  process.stderr.write('Environment file path is required.\n');
  process.exit(1);
}

let parsed;
try {
  parsed = parseEnv(readFileSync(file, 'utf8'));
} catch (error) {
  process.stderr.write(`Unable to parse Production environment file: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

const allowed = new Set([
  'NODE_ENV',
  'RELEASE_COMMIT',
  'DEPLOYMENT_MODE',
  'UPGRADE_SITE_OFFLINE_CONFIRMED',
  'RECOVERY_POINT_VERIFIED',
  'RECOVERY_POINT_REFERENCE',
  'API_HOST',
  'API_PORT',
  'WEB_ORIGIN',
  'VITE_API_BASE_URL',
  'DATABASE_URL',
  'STORAGE_ROOT',
  'STORAGE_DEPLOYMENT_ID',
  'DOCUMENT_MAX_FILE_BYTES',
  'DOCUMENT_ALLOWED_MIME_TYPES',
  'SESSION_TTL_HOURS',
  'LOGIN_RATE_LIMIT_MAX',
  'LOGIN_RATE_LIMIT_WINDOW_MINUTES',
  'REQUEST_BODY_MAX_BYTES',
  'TRUSTED_PROXY_ADDRESSES',
  'OPENAPI_ENABLED',
]);

for (const [key, value] of Object.entries(parsed)) {
  if (!allowed.has(key)) {
    process.stderr.write(`Unsupported Production environment key: ${key}\n`);
    process.exit(1);
  }
  process.stdout.write(key);
  process.stdout.write('\0');
  process.stdout.write(value);
  process.stdout.write('\0');
}
