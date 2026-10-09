const PRISMA_ONLY_QUERY_PARAMETERS = [
  'schema',
  'connection_limit',
  'pool_timeout',
  'socket_timeout',
  'pgbouncer',
  'statement_cache_size',
  'sslidentity',
  'sslaccept',
];

export function normalizePostgresUrl(raw) {
  if (!raw) {
    throw new Error('URL argument is required');
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('invalid URL');
  }

  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error('PostgreSQL protocol is required');
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!databaseName) {
    throw new Error('database name is required');
  }

  for (const parameter of PRISMA_ONLY_QUERY_PARAMETERS) {
    url.searchParams.delete(parameter);
  }

  return url.toString();
}

export { PRISMA_ONLY_QUERY_PARAMETERS };
