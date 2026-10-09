import path from 'node:path';
import { isIP } from 'node:net';

const env = process.env;

function fail(message) {
  process.stderr.write(`Production environment validation failed: ${message}\n`);
  process.exit(1);
}

function required(name) {
  const value = env[name];
  if (!value || !value.trim()) fail(`${name} is required`);
  if (value !== value.trim()) fail(`${name} must not contain surrounding whitespace`);
  return value;
}

function boundedPositiveInteger(name, maximum) {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    fail(`${name} must be an integer from 1 to ${maximum}`);
  }
}

const nodeEnv = required('NODE_ENV');
if (env.NODE_ENV !== nodeEnv) fail('NODE_ENV must not contain surrounding whitespace');
if (nodeEnv !== 'production') fail('NODE_ENV must equal production');

const deploymentMode = required('DEPLOYMENT_MODE');
if (deploymentMode !== 'fresh' && deploymentMode !== 'upgrade') {
  fail('DEPLOYMENT_MODE must be fresh or upgrade');
}
const upgradeSiteOffline = required('UPGRADE_SITE_OFFLINE_CONFIRMED');
if (upgradeSiteOffline !== 'YES' && upgradeSiteOffline !== 'NO') {
  fail('UPGRADE_SITE_OFFLINE_CONFIRMED must be YES or NO');
}
if (deploymentMode === 'upgrade' && upgradeSiteOffline !== 'YES') {
  fail('UPGRADE_SITE_OFFLINE_CONFIRMED must equal YES before preparing a Production upgrade');
}
if (required('RECOVERY_POINT_VERIFIED') !== 'YES') {
  fail('RECOVERY_POINT_VERIFIED must equal YES before Production migrations');
}
const recoveryReference = required('RECOVERY_POINT_REFERENCE');
if (!/^[A-Za-z0-9._:/-]{3,200}$/.test(recoveryReference)) {
  fail('RECOVERY_POINT_REFERENCE must be a non-secret evidence identifier using safe characters');
}
if (recoveryReference === 'replace-with-verified-recovery-point-reference') {
  fail('RECOVERY_POINT_REFERENCE must be replaced with actual verified recovery evidence');
}
if (deploymentMode === 'upgrade' && recoveryReference === 'fresh-empty-database-and-storage') {
  fail('Production upgrades require a matching database + Documents recovery-set reference, not the fresh-empty reference');
}

const releaseCommit = required('RELEASE_COMMIT');
if (!/^[0-9a-f]{40}$/i.test(releaseCommit)) fail('RELEASE_COMMIT must be a full 40-character Git SHA');

required('API_HOST');
const port = Number(required('API_PORT'));
if (!Number.isInteger(port) || port <= 0 || port > 65535) fail('API_PORT must be a valid TCP port');

const webOrigin = required('WEB_ORIGIN');
if (env.WEB_ORIGIN !== webOrigin) fail('WEB_ORIGIN must not contain surrounding whitespace');
let origin;
try {
  origin = new URL(webOrigin);
} catch {
  fail('WEB_ORIGIN must be a valid absolute URL');
}
if (origin.protocol !== 'https:') fail('WEB_ORIGIN must use HTTPS');
if (origin.username || origin.password || origin.search || origin.hash) fail('WEB_ORIGIN must be a clean origin');
if (origin.pathname !== '/' && origin.pathname !== '') fail('WEB_ORIGIN must not include a path');
if (webOrigin !== origin.origin) {
  fail('WEB_ORIGIN must equal its canonical HTTPS origin without a trailing slash');
}

const apiBase = required('VITE_API_BASE_URL');
if (env.VITE_API_BASE_URL !== apiBase) fail('VITE_API_BASE_URL must not contain surrounding whitespace');
if (apiBase !== '/api/v1') {
  let apiUrl;
  try {
    apiUrl = new URL(apiBase);
  } catch {
    fail('VITE_API_BASE_URL must be /api/v1 or an absolute HTTPS URL ending in /api/v1');
  }
  if (
    apiUrl.protocol !== 'https:' ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash ||
    apiUrl.pathname !== '/api/v1' ||
    apiBase !== `${apiUrl.origin}/api/v1`
  ) {
    fail('absolute VITE_API_BASE_URL must be a clean canonical HTTPS URL ending exactly in /api/v1');
  }
  if (apiUrl.origin !== origin.origin) {
    fail('absolute VITE_API_BASE_URL must use the same origin as WEB_ORIGIN under the current SameSite=Lax session-cookie policy');
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

const storageDeploymentId = required('STORAGE_DEPLOYMENT_ID');
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(storageDeploymentId)) {
  fail('STORAGE_DEPLOYMENT_ID must be 3-64 characters using letters, numbers, dot, underscore or hyphen');
}

boundedPositiveInteger('DOCUMENT_MAX_FILE_BYTES', 2_000_000_000);
boundedPositiveInteger('SESSION_TTL_HOURS', 168);
boundedPositiveInteger('LOGIN_RATE_LIMIT_MAX', 1000);
boundedPositiveInteger('LOGIN_RATE_LIMIT_WINDOW_MINUTES', 1440);
boundedPositiveInteger('REQUEST_BODY_MAX_BYTES', 10_485_760);

if (env.TRUSTED_PROXY_ADDRESSES !== undefined) {
  const trustedProxyAddresses = env.TRUSTED_PROXY_ADDRESSES
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    trustedProxyAddresses.length === 0 ||
    trustedProxyAddresses.some((value) => isIP(value) === 0)
  ) {
    fail('TRUSTED_PROXY_ADDRESSES must contain only comma-separated IP addresses');
  }
}

if (
  env.OPENAPI_ENABLED !== undefined &&
  env.OPENAPI_ENABLED.trim().toLowerCase() !== 'false'
) {
  fail('OPENAPI_ENABLED must be false when NODE_ENV=production');
}

if (env.DOCUMENT_ALLOWED_MIME_TYPES !== undefined && !env.DOCUMENT_ALLOWED_MIME_TYPES.trim()) {
  fail('DOCUMENT_ALLOWED_MIME_TYPES must not be empty when configured');
}

process.stdout.write('Production environment contract is valid.\n');
