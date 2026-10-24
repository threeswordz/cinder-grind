import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const image = 'docker.io/library/postgres:17.11-alpine';
const label = 'io.construction-erp.validation';
const dataPath = '/var/lib/postgresql/data';
const root = fileURLToPath(new URL('../..', import.meta.url));

function requireSafe(condition, message) {
  if (!condition) throw new Error(message);
}

export function childEnvironment(source, databaseUrl, storageRoot) {
  const env = { ...source };
  for (const key of Object.keys(env)) {
    if (/^(UAT_|E2_|BOOTSTRAP_|PG)/.test(key) || ['DIRECT_URL', 'SHADOW_DATABASE_URL'].includes(key)) delete env[key];
  }
  return { ...env, DATABASE_URL: databaseUrl, STORAGE_ROOT: storageRoot, NODE_ENV: 'test' };
}

function assertIdentity(info, expected) {
  requireSafe(info?.Id === expected.id && info.Name?.replace(/^\//, '') === expected.name &&
    info.Config?.Labels?.[label] === expected.token, 'Disposable validation container identity mismatch.');
}

export function inspectOwned(info, expected) {
  assertIdentity(info, expected);
  const mounts = info.Mounts ?? [];
  requireSafe(mounts.every((mount) => mount.Type === 'tmpfs'), 'Validation container has an unexpected persistent/bind mount.');
  requireSafe(Object.hasOwn(info.HostConfig?.Tmpfs ?? {}, dataPath) ||
    mounts.some((mount) => mount.Type === 'tmpfs' && mount.Destination === dataPath),
  'Validation PostgreSQL must use disposable tmpfs storage.');
  const bindings = info.NetworkSettings?.Ports?.['5432/tcp'];
  requireSafe(Array.isArray(bindings) && bindings.length === 1 && bindings[0].HostIp === '127.0.0.1' &&
    /^[1-9]\d{0,4}$/.test(bindings[0].HostPort) && Number(bindings[0].HostPort) <= 65535,
  'Validation PostgreSQL must have one loopback-only port binding.');
  return bindings[0].HostPort;
}

// No shell is used. Engine setup output is captured rather than echoing env/URLs.
export async function runProcess(command, args, { env, inherit = false, signal } = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    const child = spawn(command, args, { cwd: root, env, signal,
      stdio: inherit ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'] });
    if (!inherit) {
      child.stdout.setEncoding('utf8').on('data', (chunk) => {
        stdout += chunk;
        if (stdout.length > 1_000_000) child.kill('SIGTERM');
      });
      child.stderr.resume();
    }
    child.once('error', () => reject(new Error('Validation command could not run or was interrupted.')));
    child.once('close', (code) => resolve({ code, stdout }));
  });
}

export async function validateIsolated({ engine = 'podman', env = process.env,
  run = runProcess, signal, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  makeStorage = () => mkdtemp(join(tmpdir(), 'erp-validation-')),
  removeStorage = (path) => rm(path, { recursive: true, force: true }),
  protectStorage = (path) => chmod(path, 0o700), log = console.log } = {}) {
  requireSafe(['podman', 'docker'].includes(engine), 'Unsupported validation container engine.');
  const token = randomUUID();
  const name = 'erp-validation-' + token;
  requireSafe(name !== env.UAT_DB_CONTAINER, 'Validation container must differ from retained UAT.');
  const user = 'erp_validation';
  const database = 'erp_validation';
  const password = randomBytes(24).toString('hex');
  const setupEnv = childEnvironment(env, '', '');
  Object.assign(setupEnv, { POSTGRES_USER: user, POSTGRES_DB: database, POSTGRES_PASSWORD: password });
  let storage;
  let id;
  let expected;
  let failure;
  async function checked(command, args, options = {}) {
    const result = await run(command, args, { env: setupEnv, signal, ...options });
    requireSafe(result.code === 0, 'Isolated validation command failed: ' + command + ' ' + args[0]);
    return result.stdout;
  }
  try {
    storage = await makeStorage();
    await protectStorage(storage);
    const output = await checked(engine, ['run', '--detach', '--rm', '--name', name,
      '--label', label + '=' + token,
      '--env', 'POSTGRES_USER', '--env', 'POSTGRES_DB', '--env', 'POSTGRES_PASSWORD',
      '--publish', '127.0.0.1::5432', '--tmpfs', dataPath + ':rw,nosuid,size=1024m', image]);
    id = output.trim();
    requireSafe(/^[a-f0-9]{64}$/.test(id), 'Unexpected validation container ID; inspect ' + name + ' before retrying.');
    expected = { id, name, token };
    const inspect = JSON.parse(await checked(engine, ['inspect', id]));
    requireSafe(Array.isArray(inspect) && inspect.length === 1, 'Unexpected validation inspect response.');
    const port = inspectOwned(inspect[0], expected);
    const retainedPort = env.DATABASE_URL ? new URL(env.DATABASE_URL).port || '5432' : env.UAT_DB_PORT;
    requireSafe(port !== retainedPort && port !== env.UAT_DB_PORT, 'Validation port overlaps retained database configuration.');
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const result = await run(engine, ['exec', id, 'pg_isready', '-U', user, '-d', database], { env: setupEnv, signal });
      if (result.code === 0) { ready = true; break; }
      await sleep(500);
    }
    requireSafe(ready, 'Disposable validation PostgreSQL did not become ready.');
    const databaseUrl = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}?schema=public`;
    const testEnv = childEnvironment(env, databaseUrl, storage);
    log('Running migrations and full workspace validation on disposable PostgreSQL/storage.');
    await checked('pnpm', ['prisma:migrate:deploy'], { env: testEnv, inherit: true });
    await checked('pnpm', ['validate'], { env: testEnv, inherit: true });
  } catch (error) {
    failure = error;
  } finally {
    // Cleanup ignores the interrupted test signal, but removes only the exact
    // newly created, label-verified container; no volume or UAT name is accepted.
    if (expected) {
      try {
        const result = await run(engine, ['inspect', id], { env: setupEnv });
        if (result.code === 0) {
          const rows = JSON.parse(result.stdout);
          requireSafe(rows.length === 1, 'Cleanup identity could not be confirmed.');
          assertIdentity(rows[0], expected);
          const removed = await run(engine, ['rm', '--force', id], { env: setupEnv });
          requireSafe(removed.code === 0, 'Disposable validation container cleanup failed.');
        } else {
          // --rm can remove a failed/exited container. Confirm absence rather
          // than accepting an unavailable engine/inspect command as cleanup.
          const exists = await run(engine, ['ps', '--all', '--quiet', '--no-trunc', '--filter', 'id=' + id], { env: setupEnv });
          requireSafe(exists.code === 0 && exists.stdout.trim() === '',
            'Validation cleanup could not confirm container absence. Inspect ' + name + '.');
        }
      } catch {
        failure ??= new Error('Validation cleanup could not verify/remove its container. Inspect ' + name + '.');
      }
    }
    if (storage) {
      try { await removeStorage(storage); } catch { failure ??= new Error('Disposable validation storage cleanup failed.'); }
    }
  }
  if (failure) throw failure;
  log('ISOLATED_WORKSPACE_VALIDATION_PASS — full gate passed; disposable resources removed.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (!(args.length === 0 || args.length === 2 && args[0] === '--engine' && ['podman', 'docker'].includes(args[1]))) {
    console.error('Usage: node deploy/uat/validate-isolated.mjs [--engine podman|docker]');
    process.exitCode = 2;
  } else {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    try { await validateIsolated({ engine: args[1] ?? 'podman', signal: controller.signal }); }
    catch (error) {
      // Do not print arbitrary child output, retained env, stack traces or URLs.
      console.error(error instanceof SyntaxError || error instanceof TypeError
        ? 'Isolated validation configuration/metadata was invalid.' : error.message);
      process.exitCode = 1;
    } finally {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
    }
  }
}
