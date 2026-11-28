// Real disposable Chromium checks the integrated SS16 interface.
// Synthetic transport only; no retained Company, database, API or credentials.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const { createServer, transformWithOxc } = await import(pathToFileURL(require.resolve('vite')).href);
const chrome = [...(process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium'] : []), 'google-chrome', 'chromium', 'chromium-browser'].find(bin =>
  spawnSync(bin, ['--version'], { stdio: 'ignore' }).status === 0);
assert.ok(chrome, 'Actual Chromium required for SS16 UI proof; never substitute SSR');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'erp-ss16-correction-browser-'));
const harness = await readFile(new URL('./ss16-correction-browser-fixture.tsx', import.meta.url), 'utf8');
const vite = await createServer({
  root, configFile: false, server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{
    name: 'ss16-correction-browser-fixture',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/__ss16-correction') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__ss16-correction.tsx"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/__ss16-correction.tsx') return '\0ss16-correction.tsx'; },
    async load(id) {
      if (id === '\0ss16-correction.tsx') return transformWithOxc(harness,
        path.join(root, '__ss16-correction.tsx'), { lang: 'tsx', jsx: { runtime: 'automatic' } });
    },
  }],
});
try {
  await vite.listen();
  const address = vite.httpServer.address();
  const url = 'http://127.0.0.1:' + address.port + '/__ss16-correction';
  const result = await new Promise((resolve, reject) => {
    const child = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--no-proxy-server', '--user-data-dir=' + temporary, '--virtual-time-budget=65000', '--dump-dom', url],
    { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', chunk => out += chunk);
    child.stderr.on('data', chunk => err += chunk);
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(Error('SS16 browser timed out')); }, 85000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => { clearTimeout(timeout); resolve({ code, out, err }); });
  });
  assert.equal(result.code, 0, result.err.slice(-2500));
  assert.match(result.out, /data-result="PASS"/,
    (result.out.match(/data-error="[^"]*"/) ?? [result.out.slice(-6000)])[0]);
  console.log('M6_SS16_BROWSER_COMPONENT_PASS — actual Chromium, synthetic transport only: maker/checker actions, exact retry, revocation masking and three locales. Not authenticated native browser, retained UAT or release acceptance.');
} finally {
  await vite.close();
  await rm(temporary, { recursive: true, force: true });
}
