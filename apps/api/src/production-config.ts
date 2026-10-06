import path from 'node:path';

type Environment = NodeJS.ProcessEnv;

function required(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when NODE_ENV=production.`);
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

  boundedPositiveInteger(env, 'DOCUMENT_MAX_FILE_BYTES', 2_000_000_000);
  boundedPositiveInteger(env, 'SESSION_TTL_HOURS', 168);
  boundedPositiveInteger(env, 'LOGIN_RATE_LIMIT_MAX', 1000);
  boundedPositiveInteger(env, 'LOGIN_RATE_LIMIT_WINDOW_MINUTES', 1440);

  if (env.DOCUMENT_ALLOWED_MIME_TYPES !== undefined && !env.DOCUMENT_ALLOWED_MIME_TYPES.trim()) {
    throw new Error('DOCUMENT_ALLOWED_MIME_TYPES must not be empty when configured.');
  }
}
