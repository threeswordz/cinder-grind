import { appendFileSync, chmodSync } from 'node:fs';
import { normalizePostgresUrl } from './postgres-url-lib.mjs';

function fail(message) {
  process.stderr.write(`PostgreSQL native-tool auth preparation failed: ${message}\n`);
  process.exit(1);
}

function decode(value, label) {
  try {
    return decodeURIComponent(value);
  } catch {
    fail(`invalid percent encoding in ${label}`);
  }
}

function escapePgpass(value) {
  return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
}

const raw = process.env.POSTGRES_RAW_URL;
const pgpassFile = process.env.PGPASSFILE;

if (!raw) {
  fail('POSTGRES_RAW_URL is required via the environment; credential-bearing URL arguments are prohibited');
}
if (!pgpassFile || !pgpassFile.startsWith('/')) {
  fail('PGPASSFILE must be an absolute protected temporary file');
}
if (process.argv.length > 2) {
  fail('URL arguments are prohibited; provide POSTGRES_RAW_URL through the environment');
}

try {
  const url = new URL(normalizePostgresUrl(raw));

  if (url.searchParams.has('sslpassword')) {
    fail('sslpassword must not be embedded in DATABASE_URL for recovery tooling');
  }

  const authorityPassword = url.password ? decode(url.password, 'password') : '';
  const queryPassword = url.searchParams.get('password') ?? '';
  if (authorityPassword && queryPassword && authorityPassword !== queryPassword) {
    fail('conflicting PostgreSQL passwords are present in the URL');
  }
  const password = authorityPassword || queryPassword;

  const authorityUser = url.username ? decode(url.username, 'username') : '';
  const queryUser = url.searchParams.get('user') ?? '';
  if (authorityUser && queryUser && authorityUser !== queryUser) {
    fail('conflicting PostgreSQL users are present in the URL');
  }
  const username = authorityUser || queryUser;

  const configuredHost = url.searchParams.get('host') || url.hostname;
  const host =
    configuredHost.startsWith('[') && configuredHost.endsWith(']')
      ? configuredHost.slice(1, -1)
      : configuredHost;
  const port = url.searchParams.get('port') || url.port || '5432';
  const databaseName = decode(url.pathname.replace(/^\//, ''), 'database name');

  if (password && (!host || !username || !databaseName)) {
    fail('host, username and database name are required when password authentication is configured');
  }

  url.password = '';
  url.searchParams.delete('password');
  url.searchParams.delete('passfile');

  if (password) {
    const line = [host, port, databaseName, username, password]
      .map((value) => escapePgpass(value))
      .join(':');
    appendFileSync(pgpassFile, `${line}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  chmodSync(pgpassFile, 0o600);

  if (url.password || url.searchParams.has('password')) {
    fail('credential stripping failed');
  }

  process.stdout.write(url.toString());
} catch (error) {
  if (error instanceof Error && error.message.startsWith('PostgreSQL native-tool auth preparation failed:')) {
    throw error;
  }
  fail(error instanceof Error ? error.message : String(error));
}
