const raw = process.argv[2];
if (!raw) {
  process.stderr.write('PostgreSQL URL normalization failed: URL argument is required.\n');
  process.exit(1);
}

let url;
try {
  url = new URL(raw);
} catch {
  process.stderr.write('PostgreSQL URL normalization failed: invalid URL.\n');
  process.exit(1);
}

if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
  process.stderr.write('PostgreSQL URL normalization failed: PostgreSQL protocol is required.\n');
  process.exit(1);
}

url.searchParams.delete('schema');
process.stdout.write(url.toString());
