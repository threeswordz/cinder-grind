const raw = process.argv[2];

function fail(message) {
  process.stderr.write(`PostgreSQL identity check failed: ${message}\n`);
  process.exit(1);
}

if (!raw) fail('URL argument is required');

let url;
try {
  url = new URL(raw);
} catch {
  fail('invalid URL');
}

if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
  fail('PostgreSQL protocol is required');
}

const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (!databaseName) fail('database name is required');

const identity = [
  url.hostname.toLowerCase(),
  url.port || '5432',
  databaseName,
].join('|');

process.stdout.write(identity);
