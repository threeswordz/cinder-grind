import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPlan, capture, readSource, loadContext, assertEmptyStorage, assertOffline, assertOwnedTarget,
  candidate, retainedSourceId, runProcess, cleanEnvironment, canonicalSchemaObjects } from './v12-empty-recovery.mjs';

async function fixture(t, fault) {
  const home = await mkdtemp(path.join(tmpdir(), 'v12-recovery-test-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const retained = path.join(home, 'Construction-ERP-V12-UAT');
  const storage = path.join(home, '.construction-erp-v12-isolated/documents');
  await mkdir(path.join(retained, 'deploy/uat'), { recursive: true });
  await mkdir(storage, { recursive: true });
  const text = `NODE_ENV=uat\nAPI_HOST=127.0.0.1\nAPI_PORT=3001\nWEB_HOST=127.0.0.1\nWEB_PORT=4174\nUAT_DB_CONTAINER=construction-erp-v12-isolated-postgres\nUAT_DB_NAME=erp_uat\nUAT_DB_USER=erp_uat\nUAT_DB_PASSWORD=never-print-this\nUAT_DB_PORT=55433\nUAT_DATA_ROOT=${home}/.construction-erp-v12-isolated\n`;
  await writeFile(path.join(retained, 'deploy/uat/.env'), text);
  let dumps = 0;
  const run = async (command, args, options) => {
    if (command === 'git') return { code: 0, stdout: args.includes('rev-parse') ? (fault === 'candidate' ? '0'.repeat(40) : candidate) : fault === 'dirty' ? ' M tracked' : '' };
    if (command === 'node' && args[0].endsWith('path-safety.mjs')) return runProcess(command, args, options);
    assert.equal(command, 'podman');
    assert.ok(!args.join(' ').includes('never-print-this'));
    if (args[0] === 'container') return { code: 0, stdout: JSON.stringify([{ Id: fault === 'identity' ? 'a'.repeat(64) : retainedSourceId,
      Name: 'construction-erp-v12-isolated-postgres', Config: { Image: fault === 'image' ? 'postgres:latest' : 'docker.io/library/postgres:17.11-alpine' },
      State: { Running: fault !== 'stopped' }, NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: fault === 'port' ? '0.0.0.0' : '127.0.0.1', HostPort: '55433' }] } } }]) };
    if (args.includes('--version')) return { code: 0, stdout: args[2] + ' (PostgreSQL) 17.11' };
    if (args.includes('pg_dump')) { dumps++; throw Error('Unexpected dump'); }
    assert.ok(args.includes('PGOPTIONS=-c default_transaction_read_only=on'));
    return { code: 0, stdout: JSON.stringify({ database: 'erp_uat', readOnly: fault === 'readwrite' ? 'off' : 'on', version: 170011, systemIdentifier: '1234567890123456789',
      company: fault !== 'company', project: true, localDocuments: fault === 'metadata' ? 1 : 0, otherClients: fault === 'clients' ? 1 : 0 }) };
  };
  const context = await loadContext(retained, { home, run });
  const root = path.join(home, '.construction-erp-uat/evidence/v12-c-recovery');
  const plan = path.join(root, 'plan.json');
  return { home, retained, storage, context, root, plan, run, dumps: () => dumps };
}

for (const fault of ['candidate', 'dirty']) test('refuse ' + fault + ' checkout before database access', async t => {
  await assert.rejects(fixture(t, fault), fault === 'candidate' ? /WRONG_CANDIDATE/ : /DIRTY_CHECKOUT/);
});
for (const fault of ['identity', 'image', 'port', 'stopped', 'readwrite', 'company', 'metadata']) test('refuse source ' + fault + ' before capture', async t => {
  const f = await fixture(t, fault);
  await assert.rejects(createPlan(f.context, f.plan, { run: f.run }));
  assert.equal(f.dumps(), 0);
});
for (const kind of ['file', 'symlink', 'fifo']) test('refuse Documents ' + kind, async t => {
  const f = await fixture(t);
  if (kind === 'file') await writeFile(path.join(f.storage, 'unexpected'), 'private bytes');
  if (kind === 'symlink') await symlink(f.retained, path.join(f.storage, 'alias'));
  if (kind === 'fifo') assert.equal((await runProcess('mkfifo', [path.join(f.storage, 'pipe')])).code, 0);
  await assert.rejects(assertEmptyStorage(f.storage), /DOCUMENTS_NOT_EMPTY_OR_UNSAFE/);
});
test('empty folders need no fabricated sentinel or file', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.storage, 'empty'));
  const plan = await createPlan(f.context, f.plan, { run: f.run });
  assert.equal(plan.localDocuments, 0);
  assert.equal(plan.businessWrites, false);
  assert.ok(!JSON.stringify(plan).includes('never-print-this'));
  assert.equal(f.dumps(), 0);
});
for (const reason of ['offline', 'clients', 'stale', 'identity', 'config']) test('capture refuses ' + reason + ' before pg_dump', async t => {
  const f = await fixture(t, reason === 'clients' ? 'clients' : undefined);
  const plan = await createPlan(f.context, f.plan, { run: f.run });
  if (reason === 'identity') { plan.sourceHash = 'a'.repeat(64); await writeFile(f.plan, JSON.stringify(plan)); }
  if (reason === 'config') f.context.revalidate = async () => { throw Error('SOURCE_CONFIGURATION_CHANGED'); };
  await assert.rejects(capture(f.context, f.plan, path.join(f.root, 'set'), { run: f.run,
    offline: async () => { if (reason === 'offline') throw Error('API_STILL_LISTENING'); },
    now: () => Date.parse(plan.createdAt) + (reason === 'stale' ? 3600001 : 1) }));
  assert.equal(f.dumps(), 0);
});
test('a live loopback listener fails the real offline probe', async () => {
  const net = await import('node:net');
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(3001, '127.0.0.1', resolve));
  try { await assert.rejects(assertOffline(), /API_STILL_LISTENING/); }
  finally { await new Promise(resolve => server.close(resolve)); }
});
test('unsafe restore identities/mounts/networks refuse before destruction', async () => {
  const id = 'a'.repeat(64), name = 'owned', token = 'token';
  const valid = { Id: id, Name: name, Config: { Image: 'docker.io/library/postgres:17.11-alpine', Labels: { 'io.construction-erp.recovery': token } },
    HostConfig: { NetworkMode: 'none', Tmpfs: { '/var/lib/postgresql/data': 'rw' } }, Mounts: [], NetworkSettings: { Ports: {} } };
  for (const mutate of [i => i.Id = 'b'.repeat(64), i => i.Config.Labels = {}, i => i.HostConfig.NetworkMode = 'bridge',
    i => i.Mounts.push({ Type: 'bind', Source: '/retained', Destination: '/var/lib/postgresql/data' }),
    i => i.NetworkSettings.Ports = { '5432/tcp': [{ HostPort: '55433' }] }]) {
    const info = structuredClone(valid); mutate(info);
    await assert.rejects(assertOwnedTarget(id, name, token, async () => ({ code: 0, stdout: JSON.stringify([info]) })));
  }
});
test('ambient database/service settings never reach PostgreSQL subprocesses', () => {
  process.env.PGSERVICE = 'unrelated-service';
  process.env.DATABASE_URL = 'must-not-propagate';
  const env = cleanEnvironment();
  assert.equal(env.PGSERVICE, undefined);
  assert.equal(env.DATABASE_URL, undefined);
  delete process.env.PGSERVICE; delete process.env.DATABASE_URL;
});
test('empty manifest is explicit, checksum-bound and rejects disguised nonempty archive', async t => {
  const home = await mkdtemp(path.join(tmpdir(), 'manifest-test-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const storage = path.join(home, 'docs'), set = path.join(home, 'set');
  await mkdir(storage); await mkdir(set);
  await writeFile(path.join(set, 'database.dump'), 'test-dump');
  await writeFile(path.join(set, 'source-evidence.json'), '{}');
  await runProcess('tar', ['-czf', path.join(set, 'documents.tar.gz'), '-C', storage, '.']);
  const env = cleanEnvironment({ DATABASE_URL: 'postgresql://127.0.0.1/test', RELEASE_COMMIT: candidate,
    STORAGE_DEPLOYMENT_ID: 'uat-test', RECOVERY_SET_ID: 'test-set', RECOVERY_CREATED_AT: new Date().toISOString(),
    RECOVERY_DOCUMENT_FILE_COUNT: '0', POSTGRES_SERVER_VERSION: '17.11', PG_DUMP_VERSION: '17.11' });
  assert.notEqual((await runProcess('node', ['deploy/recovery/manifest.mjs', 'create', set], { env })).code, 0);
  env.RECOVERY_EMPTY_LOCAL_STORE = 'uat-empty-local-v1';
  assert.equal((await runProcess('node', ['deploy/recovery/manifest.mjs', 'create', set], { env })).code, 0);
  await writeFile(path.join(set, 'RECOVERY-SET.READY'), 'test-set\n');
  assert.equal((await runProcess('bash', ['deploy/recovery/verify-recovery-set.sh', set])).code, 0);
  await writeFile(path.join(storage, 'not-empty'), 'data');
  await runProcess('tar', ['-czf', path.join(set, 'documents.tar.gz'), '-C', storage, '.']);
  const manifest = JSON.parse(await readFile(path.join(set, 'manifest.json'), 'utf8'));
  const bytes = await readFile(path.join(set, 'documents.tar.gz'));
  manifest.artifacts.documents.bytes = bytes.length;
  manifest.artifacts.documents.sha256 = createHash('sha256').update(bytes).digest('hex');
  await writeFile(path.join(set, 'manifest.json'), JSON.stringify(manifest));
  assert.notEqual((await runProcess('bash', ['deploy/recovery/verify-recovery-set.sh', set])).code, 0);
});

for (const reason of ['appeared-file', 'appeared-metadata', 'configuration-file']) test('capture rechecks ' + reason + ' after plan', async t => {
  const f = await fixture(t);
  await createPlan(f.context, f.plan, { run: f.run });
  let run = f.run;
  if (reason === 'appeared-file') await writeFile(path.join(f.storage, 'later-upload'), 'bytes');
  if (reason === 'appeared-metadata') run = async (cmd, args, options) => {
    const result = await f.run(cmd, args, options);
    if (args.includes('--command')) { const data = JSON.parse(result.stdout); data.localDocuments = 1; result.stdout = JSON.stringify(data); }
    return result;
  };
  if (reason === 'configuration-file') {
    f.context.revalidate = async () => {
      const latest = await loadContext(f.retained, { home: f.home, run: f.run });
      assert.equal(latest.configHash, f.context.configHash, 'SOURCE_CONFIGURATION_CHANGED');
    };
    await writeFile(path.join(f.retained, 'deploy/uat/.env'), (await readFile(path.join(f.retained, 'deploy/uat/.env'), 'utf8')) + '\n# configuration changed\n');
  }
  await assert.rejects(capture(f.context, f.plan, path.join(f.root, 'set'), { run, offline: async () => {} }));
  assert.equal(f.dumps(), 0);
});

for (const fault of ['restore', 'restored-metadata', 'fingerprint', 'cleanup']) test('restore failure ' + fault + ' never reports success or removes source', async t => {
  const { restore } = await import('./v12-empty-recovery.mjs');
  const f = await fixture(t);
  const plan = await createPlan(f.context, f.plan, { run: f.run });
  await mkdir(path.join(f.retained, 'apps/api/prisma/migrations'), { recursive: true });
  const set = path.join(f.root, 'set'); await mkdir(set, { mode: 0o700 });
  const baseline = { schema: 'v12-database-evidence-v1', tables: [], sequences: [], migrations: [], schemaObjects: [{ kind: 'relation', key: 'documents' }],
    schemaHash: createHash('sha256').update(JSON.stringify([{ kind: 'relation', key: 'documents' }])).digest('hex') };
  await writeFile(path.join(set, 'source-evidence.json'), JSON.stringify(baseline));
  await writeFile(path.join(set, 'database.dump'), 'mock dump');
  await runProcess('tar', ['-czf', path.join(set, 'documents.tar.gz'), '-C', f.storage, '.']);
  const env = cleanEnvironment({ DATABASE_URL: 'postgresql://127.0.0.1/erp_uat', RELEASE_COMMIT: candidate,
    STORAGE_DEPLOYMENT_ID: 'v12uat-' + plan.sourceHash.slice(0, 32), RECOVERY_SET_ID: 'mock-set', RECOVERY_CREATED_AT: new Date().toISOString(),
    RECOVERY_DOCUMENT_FILE_COUNT: '0', RECOVERY_EMPTY_LOCAL_STORE: 'uat-empty-local-v1', POSTGRES_SERVER_VERSION: '17.11', PG_DUMP_VERSION: '17.11' });
  assert.equal((await runProcess('node', ['deploy/recovery/manifest.mjs', 'create', set], { env })).code, 0);
  await writeFile(path.join(set, 'RECOVERY-SET.READY'), 'mock-set\n');
  const targetId = 'b'.repeat(64);
  let name, token, removed = false;
  const run = async (command, args, options) => {
    if (command !== 'podman') return runProcess(command, args, options);
    assert.ok(!args.includes(retainedSourceId), 'No target command may address source');
    assert.ok(!JSON.stringify(options?.env ?? {}).includes('never-print-this'));
    if (args[0] === 'run') {
      name = args[args.indexOf('--name') + 1]; token = args[args.indexOf('--label') + 1].split('=')[1];
      assert.ok(args.includes('--network=none'));
      return { code: 0, stdout: targetId };
    }
    if (args[0] === 'container') return { code: 0, stdout: JSON.stringify([{ Id: targetId, Name: name,
      Config: { Image: 'docker.io/library/postgres:17.11-alpine', Labels: { 'io.construction-erp.recovery': token } },
      HostConfig: { NetworkMode: 'none', Tmpfs: { '/var/lib/postgresql/data': 'rw' } }, Mounts: [], NetworkSettings: { Ports: {} } }]) };
    if (args[0] === 'rm') { assert.deepEqual(args, ['rm', '--force', targetId]); removed = true; return { code: fault === 'cleanup' ? 1 : 0, stdout: '' }; }
    if (args.includes('pg_restore')) return { code: fault === 'restore' ? 1 : 0, stdout: '' };

    if (args.includes('pg_isready')) return { code: 0, stdout: '' };
    const sql = args[args.indexOf('--command') + 1];
    const data = sql.includes('WITH objects') ? (fault === 'fingerprint' ? [{ kind: 'changed' }] : [{ kind: 'relation', key: 'documents' }]) : sql.includes('pg_class') ? true : sql.includes('pg_tables') ? ['_prisma_migrations', 'documents'] :
      sql.includes('count(*) FROM public.documents') ? (fault === 'restored-metadata' ? 1 : 0) : [];
    return { code: 0, stdout: JSON.stringify(data) };
  };
  await assert.rejects(restore(f.context, f.plan, set, { run }), fault === 'restore' ? /RECOVERY_COMMAND_FAILED/ : fault === 'cleanup' ? /OWNED_TARGET_CLEANUP_FAILED/ : /RESTORED_/);
  assert.equal(removed, true);
});


test('observed PostgreSQL varchar literal-array round trip preserves exact checks and validation', () => {
  const source = "CHECK (((state)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying])::text[])))";
  const restored = "CHECK (((state)::text = ANY (ARRAY[('DRAFT'::character varying)::text, ('SUBMITTED'::character varying)::text])))";
  const entry = (definition, validated = true) => [{ kind: 'constraint', key: 'full.constraint.name', definition: { definition, validated } }];
  assert.deepEqual(canonicalSchemaObjects(entry(source)), canonicalSchemaObjects(entry(restored)));
  assert.notDeepEqual(canonicalSchemaObjects(entry(source)), canonicalSchemaObjects(entry(restored.replace('DRAFT', 'OTHER'))));
  assert.notDeepEqual(canonicalSchemaObjects(entry(source)), canonicalSchemaObjects(entry(restored, false)));
  const bounded = source.replaceAll('character varying', 'character varying(2)');
  assert.deepEqual(canonicalSchemaObjects(entry(bounded)), entry(bounded));
  const expression = source.replace("'DRAFT'::character varying", "lower('DRAFT'::character varying)");
  assert.deepEqual(canonicalSchemaObjects(entry(expression)), entry(expression));
});


test('known scalar Work Order conjunction round trip preserves every bound and operator', () => {
  const source = "CHECK ((((sequence_no >= 1) AND (sequence_no <= 999)) AND ((work_order_number)::text = ('WO-'::text || lpad((sequence_no)::text, 3, '0'::text)))))";
  const restored = "CHECK (((sequence_no >= 1) AND (sequence_no <= 999) AND ((work_order_number)::text = ('WO-'::text || lpad((sequence_no)::text, 3, '0'::text)))))";
  const entry = definition => [{ kind: 'constraint', key: 'subcontract_work_orders.work_orders_number_check', definition: { definition, validated: true } }];
  assert.deepEqual(canonicalSchemaObjects(entry(source)), canonicalSchemaObjects(entry(restored)));
  for (const changed of [restored.replace('999', '998'), restored.replace('>= 1', '> 1'), restored.replace("'WO-'", "'OTHER-'"), restored.replace('3,', '4,')]) {
    assert.notDeepEqual(canonicalSchemaObjects(entry(source)), canonicalSchemaObjects(entry(changed)));
  }
  const index = definition => [{ kind: 'index', key: 'index', definition: { definition: 'CREATE UNIQUE INDEX idx WHERE ' + definition } }];
  const arraySource = "(state = ANY ((ARRAY['DRAFT'::character varying])::text[]))";
  const arrayRestored = "(state = ANY (ARRAY[('DRAFT'::character varying)::text]))";
  assert.deepEqual(canonicalSchemaObjects(index(arraySource)), canonicalSchemaObjects(index(arrayRestored)));
  assert.notDeepEqual(canonicalSchemaObjects(index(arraySource)), canonicalSchemaObjects(index(arrayRestored.replace('DRAFT', 'APPROVED'))));
});
