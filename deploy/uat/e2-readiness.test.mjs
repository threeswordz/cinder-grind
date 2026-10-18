import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('./e2-readiness.mjs', import.meta.url));

function runChecker(overrides, { script = checker, runtime = process.execPath } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(runtime, [script], {
      env: {
        ...process.env,
        UAT_DATA_ROOT: '',
        API_PORT: '3000',
        E2_ADMIN_EMAIL: 'uat-admin@example.test',
        E2_ADMIN_PASSWORD: 'dummy-secret-never-send',
        ...overrides,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('reject unsafe UAT API URLs before attempting administrator login', async () => {
  const forbidden = [
    'https://127.0.0.1:3000/api/v1',
    'http://localhost:3000/api/v1',
    'http://198.51.100.10:3000/api/v1',
    'http://127.0.0.1:3001/api/v1',
    'http://127.0.0.1:3000/auth',
    'http://some-user:secret@127.0.0.1:3000/api/v1',
    'http://127.0.0.1:3000/api/v1?password=hidden',
    'http://127.0.0.1:3000/api/v1#secret',
    'http://127.0.0.1:3000/api/v1?',
    'http://127.0.0.1:3000/api/v1#',
    'not a URL',
  ];
  for (const url of forbidden) {
    const result = await runChecker({ UAT_API_BASE_URL: url });
    assert.equal(result.code, 2, 'expected blocked result for ' + url);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'BLOCKED');
    assert.equal(report.baseUrl, null, 'unsafe URL must not be recorded');
    assert.ok(report.blocked.some((item) => item.code === 'UNSAFE_UAT_API_URL'));
    assert.ok(!result.stdout.includes('some-user:secret'));
    assert.ok(!result.stdout.includes('password=hidden'));
  }
});

test('accepts the canonical loopback API on HTTP default port 80 without a network request', async () => {
  const result = await runChecker({
    API_PORT: '80',
    UAT_API_BASE_URL: 'http://127.0.0.1:80/api/v1',
    E2_ADMIN_EMAIL: '',
    E2_ADMIN_PASSWORD: '',
    BOOTSTRAP_ADMIN_EMAIL: '',
    BOOTSTRAP_ADMIN_PASSWORD: '',
  });
  assert.equal(result.code, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.baseUrl, 'http://127.0.0.1:80/api/v1');
  assert.ok(report.blocked.some((item) => item.code === 'ADMIN_CREDENTIALS_MISSING'));
  assert.ok(!report.blocked.some((item) => item.code === 'UNSAFE_UAT_API_URL'));
});

test('documented shell entrypoint never echoes an unsafe URL or credential', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'erp-e2-shell-'));
  const path = join(fixture, 'deploy', 'uat');
  try {
    await mkdir(path, { recursive: true });
    for (const name of ['common.sh', 'e2-readiness.sh', 'e2-readiness.mjs']) {
      await copyFile(join(dirname(checker), name), join(path, name));
    }
    await writeFile(
      join(path, '.env'),
      [
        'UAT_DB_CONTAINER=fixture',
        'UAT_DB_VOLUME=fixture-volume',
        'UAT_DB_PORT=55432',
        'UAT_DB_NAME=fixture',
        'UAT_DB_USER=fixture',
        'UAT_DB_PASSWORD=dummy',
        'API_HOST=127.0.0.1',
        'API_PORT=3000',
        'WEB_HOST=127.0.0.1',
        'WEB_PORT=4173',
        'UAT_DATA_ROOT=' + join(fixture, 'data'),
        'UAT_API_BASE_URL=http://some-user:secret@127.0.0.1:3000/api/v1?password=hidden',
        'E2_ADMIN_EMAIL=uat-admin@example.test',
        'E2_ADMIN_PASSWORD=dummy-secret-never-send',
      ].join('\n') + '\n',
      { mode: 0o600 },
    );
    const result = await runChecker({}, {
      script: join(path, 'e2-readiness.sh'),
      runtime: 'bash',
    });
    assert.equal(result.code, 2);
    assert.match(result.stdout, /UNSAFE_UAT_API_URL/);
    assert.ok(!result.stdout.includes('some-user:secret'));
    assert.ok(!result.stdout.includes('password=hidden'));
    assert.ok(!result.stderr.includes('some-user:secret'));
    assert.ok(!result.stderr.includes('password=hidden'));
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('refuses HTTP redirect on administrator login instead of forwarding credentials', async () => {
  let redirectedRequests = 0;
  let loginRequests = 0;
  const redirected = createServer((_req, res) => {
    redirectedRequests++;
    res.writeHead(200);
    res.end('should never be reached');
  });
  const local = createServer((req, res) => {
    loginRequests++;
    assert.equal(req.url, '/api/v1/auth/login');
    res.writeHead(307, {
      Location: 'http://127.0.0.1:' + redirected.address().port + '/steal',
    });
    res.end();
  });
  try {
    redirected.listen(0, '127.0.0.1');
    await once(redirected, 'listening');
    local.listen(0, '127.0.0.1');
    await once(local, 'listening');
    const port = String(local.address().port);
    const result = await runChecker({
      API_PORT: port,
      UAT_API_BASE_URL: 'http://127.0.0.1:' + port + '/api/v1',
    });
    assert.equal(result.code, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'BLOCKED');
    assert.ok(report.blocked.some((item) => item.code === 'READINESS_CHECK_ERROR'));
    assert.equal(loginRequests, 1);
    assert.equal(redirectedRequests, 0, 'no administrator credentials may reach the redirect target');
  } finally {
    await Promise.all(
      [local, redirected].filter((server) => server.listening).map(
        (server) => new Promise((resolve) => server.close(resolve)),
      ),
    );
  }
});
