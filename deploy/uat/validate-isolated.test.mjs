import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { childEnvironment, inspectOwned, validateIsolated } from './validate-isolated.mjs';

const retained = 'postgresql://retained:do-not-expose@127.0.0.1:55432/retained?schema=public';
const source = { PATH: process.env.PATH, DATABASE_URL: retained, STORAGE_ROOT: '/retained/documents',
  UAT_DB_PORT: '55432', UAT_DB_CONTAINER: 'retained-container', UAT_DB_PASSWORD: 'do-not-expose',
  E2_ADMIN_PASSWORD: 'do-not-expose', BOOTSTRAP_ADMIN_PASSWORD: 'do-not-expose', PGPASSWORD: 'do-not-expose' };

function harness({ fault, port = '61234', readyFailures = 0, hostReadyFailures = 0, mountFault = false, identityFault = false } = {}) {
  const calls = [];
  const id = 'a'.repeat(64);
  let name, token;
  let removedStorage = false;
  let removedContainer = false;
  const run = async (command, args, options) => {
    calls.push({ command, args, env: options.env });
    if (command === 'bash' && args[0] === 'deploy/uat/prepare-legacy-validation.sh') {
      assert.notEqual(options.env.DATABASE_URL, retained);
      assert.equal(options.env.LEGACY_NON_PRODUCTION_CONFIRMED, 'YES');
      return { code: fault === 'legacy-fixture' ? 7 : 0, stdout: '' };
    }
    if (command === 'pnpm') return { code: fault === args[0] ? 7 : 0, stdout: '' };
    if (args[0] === 'run') {
      if (fault === 'run') return { code: 1, stdout: '' };
      name = args[args.indexOf('--name') + 1];
      token = args[args.indexOf('--label') + 1].split('=')[1];
      assert.ok(!args.some((arg) => arg.includes('do-not-expose')));
      assert.ok(!args.includes('-v') && !args.includes('--volume'));
      return { code: 0, stdout: id + '\n' };
    }
    if (args[0] === 'inspect') return { code: 0, stdout: JSON.stringify([{
      Id: identityFault ? 'b'.repeat(64) : id, Name: name,
      Config: { Labels: { 'io.construction-erp.validation': token } },
      Mounts: mountFault ? [{ Type: 'bind', Source: '/retained/documents' }] : [],
      HostConfig: { Tmpfs: { '/var/lib/postgresql/data': 'rw,nosuid,size=1024m' } },
      NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: port }] } },
    }]) };
    if (args[0] === 'exec') return { code: readyFailures-- > 0 ? 1 : 0, stdout: '' };
    if (args[0] === 'rm') {
      assert.deepEqual(args, ['rm', '--force', id]);
      removedContainer = true;
      return { code: fault === 'cleanup' ? 1 : 0, stdout: '' };
    }
    throw new Error('Unexpected test command');
  };
  return { calls, run, engine: 'docker', env: source, sleep: async () => {},
    probeHost: async port => { calls.push({ command: 'host-probe', args: [port], env: {} }); return hostReadyFailures-- <= 0; },
    makeStorage: async () => '/temporary/owned', protectStorage: async () => {},
    removeStorage: async (path) => { assert.equal(path, '/temporary/owned'); removedStorage = true; },
    log: () => {}, removed: () => ({ removedStorage, removedContainer }) };
}

test('full workspace gate gets only the new database/storage and retains original env', async () => {
  const fixture = harness({ readyFailures: 2 });
  await validateIsolated(fixture);
  const pnpm = fixture.calls.filter((call) => call.command === 'pnpm');
  assert.deepEqual(pnpm.map((call) => call.args), [['prisma:migrate:deploy'], ['typecheck'], ['test'], ['build']]);
  for (const call of pnpm) {
    assert.match(call.env.DATABASE_URL, /^postgresql:\/\/erp_validation:[a-f0-9]+@127\.0\.0\.1:61234\/erp_validation\?schema=public$/);
    assert.equal(call.env.STORAGE_ROOT, '/temporary/owned');
    assert.equal(call.env.NODE_ENV, call.args[0] === 'build' ? 'production' : 'test');
    assert.ok(!JSON.stringify(call.env).includes('do-not-expose'));
  }
  assert.equal(source.DATABASE_URL, retained);
  assert.deepEqual(fixture.removed(), { removedStorage: true, removedContainer: true });
});

for (const fault of ['prisma:migrate:deploy', 'typecheck', 'test', 'build']) {
  test('failed ' + fault + ' stops and cleans only owned resources', async () => {
    const fixture = harness({ fault });
    await assert.rejects(validateIsolated(fixture), /command failed/);
    assert.deepEqual(fixture.removed(), { removedStorage: true, removedContainer: true });
    const phases = ['prisma:migrate:deploy', 'typecheck', 'test', 'build'];
    assert.deepEqual(fixture.calls.filter((call) => call.command === 'pnpm').map((call) => call.args[0]),
      phases.slice(0, phases.indexOf(fault) + 1));
  });
}

test('in-container readiness is insufficient until the isolated published loopback port is reachable', async () => {
  const fixture = harness({ hostReadyFailures: 2 });
  await validateIsolated(fixture);
  const probes = fixture.calls.filter(call => call.command === 'host-probe');
  assert.equal(probes.length, 3);
  assert.ok(probes.every(call => call.args[0] === '61234'));
  const lastProbe = fixture.calls.lastIndexOf(probes.at(-1));
  const legacy = fixture.calls.findIndex(call => call.command === 'bash');
  assert.ok(lastProbe < legacy, 'No migration/fixture may start before loopback verification');
  assert.deepEqual(fixture.removed(), { removedStorage: true, removedContainer: true });
});

test('unreachable published loopback port fails closed and cleans owned resources before fixture', async () => {
  const fixture = harness({ hostReadyFailures: 70 });
  await assert.rejects(validateIsolated(fixture), /loopback port is unreachable/);
  assert.equal(fixture.calls.filter(call => call.command === 'host-probe').length, 60);
  assert.equal(fixture.calls.some(call => call.command === 'bash' || call.command === 'pnpm'), false);
  assert.deepEqual(fixture.removed(), { removedStorage: true, removedContainer: true });
});

test('port collision and persistent mounts fail before tests, but owned cleanup remains safe', async () => {
  for (const options of [{ port: '55432' }, { mountFault: true }]) {
    const fixture = harness(options);
    await assert.rejects(validateIsolated(fixture));
    assert.ok(!fixture.calls.some((call) => call.command === 'pnpm'));
    assert.deepEqual(fixture.removed(), { removedStorage: true, removedContainer: true });
  }
});

test('identity mismatch never removes the unexpected container', async () => {
  const fixture = harness({ identityFault: true });
  await assert.rejects(validateIsolated(fixture), /identity mismatch/);
  assert.ok(!fixture.calls.some((call) => call.args[0] === 'rm'));
});

test('cleanup failure cannot report a successful gate', async () => {
  await assert.rejects(validateIsolated(harness({ fault: 'cleanup' })), /cleanup/);
});

test('legacy fixture failure stops before candidate migrations/tests and cleans only disposable resources', async () => {
  const fixture = harness({ fault: 'legacy-fixture' });
  await assert.rejects(validateIsolated(fixture), /command failed/);
  assert.ok(!fixture.calls.some((call) => call.command === 'pnpm'));
  assert.deepEqual(fixture.removed(), { removedStorage: true, removedContainer: true });
});

test('engine creation failure never runs tests or removes a retained container', async () => {
  const fixture = harness({ fault: 'run' });
  await assert.rejects(validateIsolated(fixture));
  assert.ok(!fixture.calls.some((call) => call.command === 'pnpm' || call.args[0] === 'rm'));
});

test('child environment removes alternative database/credential fallback variables', () => {
  const env = childEnvironment({ ...source, DIRECT_URL: retained, SHADOW_DATABASE_URL: retained, PGHOST: 'retained' }, 'new-db', 'new-storage');
  assert.equal(env.DATABASE_URL, 'new-db');
  for (const name of ['DIRECT_URL', 'SHADOW_DATABASE_URL', 'PGHOST', 'PGPASSWORD', 'UAT_DB_PASSWORD', 'E2_ADMIN_PASSWORD']) assert.equal(env[name], undefined);
});

test('non-loopback and ambiguous port bindings are refused', () => {
  const expected = { id: 'a'.repeat(64), name: 'test', token: 'token' };
  const info = { Id: expected.id, Name: expected.name, Config: { Labels: { 'io.construction-erp.validation': 'token' } },
    Mounts: [], HostConfig: { Tmpfs: { '/var/lib/postgresql/data': '' } },
    NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '60000' }] } } };
  assert.throws(() => inspectOwned(info, expected), /loopback/);
});

test('documented preparation shell does not start/migrate retained UAT when isolation fails', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'erp-prepare-isolation-test-'));
  try {
    const scripts = join(folder, 'deploy/uat');
    const bin = join(folder, 'bin');
    await mkdir(scripts, { recursive: true });
    await mkdir(bin);
    await copyFile(new URL('./prepare-release.sh', import.meta.url), join(scripts, 'prepare-release.sh'));
    await writeFile(join(scripts, 'common.sh'), 'REPO_ROOT=' + JSON.stringify(folder) + '\n');
    const log = join(folder, 'commands');
    await writeFile(join(bin, 'pnpm'), '#!/bin/sh\necho "pnpm $*" >> "$COMMAND_LOG"\n', { mode: 0o700 });
    await writeFile(join(bin, 'node'), '#!/bin/sh\necho "node $*" >> "$COMMAND_LOG"\nexit 7\n', { mode: 0o700 });
    await writeFile(join(scripts, 'start-postgres.sh'), '#!/bin/sh\necho "retained-start" >> "$COMMAND_LOG"\n', { mode: 0o700 });
    await assert.rejects(promisify(execFile)('bash', [join(scripts, 'prepare-release.sh')],
      { env: { ...process.env, PATH: bin + ':' + process.env.PATH, COMMAND_LOG: log } }));
    const commands = await readFile(log, 'utf8');
    assert.match(commands, /node deploy\/uat\/validate-isolated.mjs/);
    assert.ok(!commands.includes('retained-start') && !commands.includes('prisma:migrate:deploy'));
  } finally { await rm(folder, { recursive: true, force: true }); }
});
