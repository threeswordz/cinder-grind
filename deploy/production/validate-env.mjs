import path from 'node:path';

const env = process.env;

function fail(message) {
  process.stderr.write(`Production environment validation failed: ${message}\n`);
  process.exit(1);
}

function required(name) {
  const value = env[name]?.trim();
  if (!value) fail(`${name} is required`);
  return value;
}

function positiveInteger(name) {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) fail(`${name} must be a positive integer`);
}

if (required('NODE_ENV') !== 'production') fail('NODE_ENV must equal production');

const releaseCommit = required('RELEASE_COMMIT');
if (!/^[0-9a-f]{40}$/i.test(releaseCommit)) fail('RELEASE_COMMIT must be a full 40-character Git SHA');

required('API_HOST');
const port = Number(required('API_PORT'));
if (!Number.isInteger(port) || port <= 0 || port > 65535) fail('API_PORT must be a valid TCP port');

let origin;
try {
  origin = new URL(required('WEB_ORIGIN'));
} catch {
  fail('WEB_ORIGIN must be a valid absolute URL');
}
if (origin.protocol !== 'https:') fail('WEB_ORIGIN must use HTTPS');
if (origin.username || origin.password || origin.search || origin.hash) fail('WEB_ORIGIN must be a clean origin');
if (origin.pathname !== '/' && origin.pathname !== '') fail('WEB_ORIGIN must not include a path');

const apiBase = required('VITE_API_BASE_URL');
if (apiBase !== '/api/v1') {
  let apiUrl;
  try {
    apiUrl = new URL(apiBase);
  } catch {
    fail('VITE_API_BASE_URL must be /api/v1 or an absolute HTTPS URL ending in /api/v1');
  }
  if (apiUrl.protocol !== 'https:' || !apiUrl.pathname.endsWith('/api/v1')) {
    fail('absolute VITE_API_BASE_URL must use HTTPS and end in /api/v1');
  }
}

let db;
try {
  db = new URL(required('DATABASE_URL'));
} catch {
  fail('DATABASE_URL must be a valid PostgreSQL URL');
}
if (db.protocol !== 'postgresql:' && db.protocol !== 'postgres:') fail('DATABASE_URL must use PostgreSQL');

const storageRoot = required('STORAGE_ROOT');
if (!path.isAbsolute(storageRoot)) fail('STORAGE_ROOT must be an absolute path');

positiveInteger('DOCUMENT_MAX_FILE_BYTES');
positiveInteger('SESSION_TTL_HOURS');
positiveInteger('LOGIN_RATE_LIMIT_MAX');
positiveInteger('LOGIN_RATE_LIMIT_WINDOW_MINUTES');

if (env.DOCUMENT_ALLOWED_MIME_TYPES !== undefined && !env.DOCUMENT_ALLOWED_MIME_TYPES.trim()) {
  fail('DOCUMENT_ALLOWED_MIME_TYPES must not be empty when configured');
}

process.stdout.write('Production environment contract is valid.\n');
