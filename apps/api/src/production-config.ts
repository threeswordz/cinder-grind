import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { isIP } from 'node:net';

type Environment = NodeJS.ProcessEnv;

function required(env: Environment, name: string): string {
  const value = env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is required when NODE_ENV=production.`);
  }
  if (value !== value.trim()) {
    throw new Error(`${name} must not contain surrounding whitespace when NODE_ENV=production.`);
  }
  return value;
}

function boundedPositiveInteger(
  env: Environment,
  name: string,
  maximum: number,
): void {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}.`);
  }
}

export function requestBodyMaxBytes(env: Environment = process.env): number {
  const raw = env.REQUEST_BODY_MAX_BYTES?.trim();
  if (!raw) return 1_048_576;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 10_485_760) {
    throw new Error('REQUEST_BODY_MAX_BYTES must be an integer from 1 to 10485760.');
  }
  return value;
}

export function trustedProxyAddresses(env: Environment = process.env): Set<string> {
  const raw = env.TRUSTED_PROXY_ADDRESSES?.trim() || '127.0.0.1,::1';
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
  if (values.length === 0 || values.some((value) => isIP(value) === 0)) {
    throw new Error('TRUSTED_PROXY_ADDRESSES must contain only comma-separated IP addresses.');
  }
  return new Set(values);
}

function validateWebOrigin(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('WEB_ORIGIN must be a valid absolute URL.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('WEB_ORIGIN must use HTTPS when NODE_ENV=production.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('WEB_ORIGIN must be a clean HTTPS origin without credentials, query or fragment.');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('WEB_ORIGIN must not include a path.');
  }
  if (raw !== url.origin) {
    throw new Error('WEB_ORIGIN must equal its canonical HTTPS origin without a trailing slash.');
  }
}

const PRODUCTION_STORAGE_SENTINEL = '.construction-erp-storage-ready';
const PRODUCTION_STORAGE_SENTINEL_PREFIX = 'construction-erp-production-storage-v1:';

function validateProductionStorage(storageRoot: string, deploymentId: string): void {
  try {
    if (!statSync(storageRoot).isDirectory()) throw new Error('not a directory');
    accessSync(storageRoot, constants.W_OK);
  } catch {
    throw new Error('STORAGE_ROOT must exist and be writable when NODE_ENV=production.');
  }
  let sentinel: string;
  try {
    sentinel = readFileSync(path.join(storageRoot, PRODUCTION_STORAGE_SENTINEL), 'utf8').trim();
  } catch {
    throw new Error('Production document storage sentinel is missing; refusing startup because persistent storage may be unavailable.');
  }
  if (sentinel !== `${PRODUCTION_STORAGE_SENTINEL_PREFIX}${deploymentId}`) {
    throw new Error('Production document storage sentinel is invalid for STORAGE_DEPLOYMENT_ID; refusing startup because persistent storage identity is not verified.');
  }
}

function validateDatabaseUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL must use postgresql:// or postgres://.');
  }
}

export function validateProductionConfig(env: Environment): void {
  const rawNodeEnv = env.NODE_ENV;
  if (rawNodeEnv?.trim() === 'production' && rawNodeEnv !== 'production') {
    throw new Error('NODE_ENV must equal production exactly without surrounding whitespace.');
  }
  if (rawNodeEnv !== 'production') return;

  required(env, 'API_HOST');
  const apiPort = required(env, 'API_PORT');
  const port = Number(apiPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('API_PORT must be a valid TCP port.');
  }

  const webOrigin = required(env, 'WEB_ORIGIN');
  if (env.WEB_ORIGIN !== webOrigin) {
    throw new Error('WEB_ORIGIN must not contain surrounding whitespace.');
  }
  validateWebOrigin(webOrigin);
  validateDatabaseUrl(required(env, 'DATABASE_URL'));

  const storageRoot = required(env, 'STORAGE_ROOT');
  if (!path.isAbsolute(storageRoot)) {
    throw new Error('STORAGE_ROOT must be an absolute path when NODE_ENV=production.');
  }
  if (
    env.DOCUMENT_UPLOAD_TEMP_ROOT !== undefined &&
    !path.isAbsolute(env.DOCUMENT_UPLOAD_TEMP_ROOT.trim())
  ) {
    throw new Error(
      'DOCUMENT_UPLOAD_TEMP_ROOT must be an absolute path when configured.',
    );
  }
  const storageDeploymentId = required(env, 'STORAGE_DEPLOYMENT_ID');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(storageDeploymentId)) {
    throw new Error('STORAGE_DEPLOYMENT_ID must be 3-64 characters using letters, numbers, dot, underscore or hyphen.');
  }
  validateProductionStorage(storageRoot, storageDeploymentId);

  boundedPositiveInteger(env, 'DOCUMENT_MAX_FILE_BYTES', 2_000_000_000);
  requestBodyMaxBytes(env);
  boundedPositiveInteger(env, 'SESSION_TTL_HOURS', 168);
  boundedPositiveInteger(env, 'LOGIN_RATE_LIMIT_MAX', 1000);
  boundedPositiveInteger(env, 'LOGIN_RATE_LIMIT_WINDOW_MINUTES', 1440);
  trustedProxyAddresses(env);

  if (
    env.OPENAPI_ENABLED !== undefined &&
    env.OPENAPI_ENABLED.trim().toLowerCase() !== 'false'
  ) {
    throw new Error('OPENAPI_ENABLED must be false when NODE_ENV=production.');
  }

  if (env.DOCUMENT_ALLOWED_MIME_TYPES !== undefined && !env.DOCUMENT_ALLOWED_MIME_TYPES.trim()) {
    throw new Error('DOCUMENT_ALLOWED_MIME_TYPES must not be empty when configured.');
  }
}
