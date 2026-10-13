import process from 'node:process';

function fail(message) {
  process.stderr.write('V1.0-E database URL preparation failed: ' + message + '\n');
  process.exit(1);
}

const raw = process.env.RC_BASE_DATABASE_URL;
const databaseName = process.argv[2];

if (!raw) fail('RC_BASE_DATABASE_URL is required');
if (!databaseName || !/^[a-z][a-z0-9_]{2,62}$/.test(databaseName)) {
  fail('database name must be 3-63 lowercase letters, numbers or underscores and start with a letter');
}

let url;
try {
  url = new URL(raw);
} catch {
  fail('RC_BASE_DATABASE_URL must be a valid URL');
}
if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
  fail('RC_BASE_DATABASE_URL must use PostgreSQL');
}
url.pathname = '/' + databaseName;
url.searchParams.set('schema', 'public');
process.stdout.write(url.toString());
