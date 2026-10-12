import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:https';
import { request as httpRequest } from 'node:http';
import { extname, resolve, sep } from 'node:path';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + ' is required');
  return value;
}

const host = process.env.RC_PROXY_HOST ?? '127.0.0.1';
const port = Number(process.env.RC_PROXY_PORT ?? '3443');
const apiOrigin = new URL(required('RC_API_ORIGIN'));
const webRoot = resolve(required('RC_WEB_ROOT'));
const key = readFileSync(required('RC_TLS_KEY'));
const cert = readFileSync(required('RC_TLS_CERT'));

if (host !== '127.0.0.1') throw new Error('RC proxy is intentionally loopback-only');
if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('RC_PROXY_PORT is invalid');
if (apiOrigin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(apiOrigin.hostname)) {
  throw new Error('RC_API_ORIGIN must be a loopback HTTP origin');
}

const types = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
]);

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = resolve(webRoot, relative);
  if (candidate !== webRoot && !candidate.startsWith(webRoot + sep)) return null;
  return candidate;
}

const server = createServer({ key, cert }, (req, res) => {
  if ((req.url ?? '').startsWith('/api/v1')) {
    const upstream = httpRequest(
      {
        protocol: apiOrigin.protocol,
        hostname: apiOrigin.hostname,
        port: apiOrigin.port,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: apiOrigin.host },
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on('error', (error) => {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('upstream error: ' + error.message);
    });
    req.pipe(upstream);
    return;
  }

  let filePath;
  try {
    filePath = safeStaticPath(req.url ?? '/');
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (!filePath) {
    res.writeHead(403);
    res.end();
    return;
  }

  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) throw new Error('not file');
  } catch {
    filePath = resolve(webRoot, 'index.html');
  }

  res.writeHead(200, {
    'content-type': types.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  process.stdout.write('V1.0-E loopback HTTPS proxy ready at https://' + host + ':' + port + '\n');
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
