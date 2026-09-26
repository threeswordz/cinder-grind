import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const root = path.resolve(repoRoot, 'apps/web/dist');
const host = process.env.WEB_HOST ?? '127.0.0.1';
const port = Number(process.env.WEB_PORT ?? '4173');

if (host !== '127.0.0.1') {
  throw new Error('V0.1 local UAT web server is intentionally loopback-only.');
}
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error('WEB_PORT must be a valid TCP port.');
}

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function safePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const candidate = path.resolve(root, '.' + decoded);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  return candidate;
}

async function existingFile(candidate) {
  try {
    const info = await stat(candidate);
    return info.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  const candidate = safePath(req.url ?? '/');
  if (!candidate) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  let file = await existingFile(candidate);
  if (!file) file = await existingFile(path.join(root, 'index.html'));
  if (!file) {
    res.writeHead(503);
    res.end('Web build is missing. Run deploy/uat/prepare-release.sh first.');
    return;
  }

  res.setHeader('Cache-Control', file.endsWith('index.html') ? 'no-store' : 'public, max-age=3600');
  res.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
  if (req.method === 'HEAD') {
    res.writeHead(200);
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  process.stdout.write(`UAT web is available at http://${host}:${port}\n`);
});
