// Real disposable regression, not a retained-UAT entry point.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadContext, createPlan, capture, restore, readSource, runProcess, cleanEnvironment, candidate } from './v12-empty-recovery.mjs';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.CI !== 'true') throw Error('CI_ONLY_DISPOSABLE_REGRESSION');
process.umask(0o077);
const tools = fileURLToPath(new URL('../..', import.meta.url));
const home = await mkdtemp(path.join(tmpdir(), 'v12-empty-recovery-ci-'));
const retained = path.join(home, 'Construction-ERP-V12-UAT');
const name = 'construction-erp-v12-isolated-postgres';
const token = randomBytes(16).toString('hex');
let id, worktree = false;
const run = (command, args, options) => runProcess(command === 'podman' ? 'docker' : command, args, options);
async function command(cmd, args, options) {
  const result = await run(cmd, args, options);
  assert.equal(result.code, 0, 'CI_COMMAND_FAILED: ' + cmd + ' ' + args[0]);
  return result.stdout;
}
try {
  await command('git', ['worktree', 'add', '--detach', retained, candidate]);
  worktree = true;
  // A name collision refuses; never remove/reuse a pre-existing source.
  id = (await command('docker', ['run', '--detach', '--name', name,
    '--label', 'io.construction-erp.recovery-ci=' + token,
    '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=1024m',
    '-p', '127.0.0.1::5432', '--env', 'POSTGRES_DB=erp_uat', '--env', 'POSTGRES_USER=erp_uat',
    '--env', 'POSTGRES_PASSWORD', 'docker.io/library/postgres:17.11-alpine'], { env: cleanEnvironment({ POSTGRES_PASSWORD: token }) })).trim();
  assert.match(id, /^[a-f0-9]{64}$/);
  const [info] = JSON.parse(await command('docker', ['container', 'inspect', id]));
  const port = info.NetworkSettings.Ports['5432/tcp'][0].HostPort;
  let ready = false;
  for (let n = 0; n < 60; n++) {
    if ((await run('docker', ['exec', id, 'pg_isready', '--host=127.0.0.1', '-U', 'erp_uat', '-d', 'erp_uat'])).code === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'CI_SOURCE_NOT_READY');
  // Only this new container receives migration/fixture writes.
  // Match this intentionally pinned historical fixture's migration chain exactly.
  // Current successor migrations are exercised by their own upgrade/recovery gate.
  await command('pnpm', ['--filter', '@construction-erp/api', 'exec', 'prisma', 'migrate', 'deploy',
    '--schema', path.join(retained, 'apps/api/prisma/schema.prisma')], { env: cleanEnvironment({
    DATABASE_URL: `postgresql://erp_uat:${token}@127.0.0.1:${port}/erp_uat?schema=public` }) });
  const sql = `INSERT INTO companies(id,company_code,company_name,updated_at) VALUES ('c5d2d5be-0e92-4e97-9038-6c387912d369','V12UAT','Disposable V12 recovery',now());
    INSERT INTO customers(id,company_id,customer_code,customer_name,updated_at) VALUES ('11111111-1111-4111-8111-111111111111','c5d2d5be-0e92-4e97-9038-6c387912d369','RECOVERY-CUSTOMER','Disposable recovery customer',now());
    INSERT INTO projects(id,company_id,project_code,project_name,customer_id,contract_value,contract_currency_code,planned_start_date,planned_completion_date,updated_at)
    VALUES ('e30da8b5-315c-4c0f-946b-da56086e646c','c5d2d5be-0e92-4e97-9038-6c387912d369','V12-THB-001','Disposable recovery project','11111111-1111-4111-8111-111111111111',1205,'THB','2026-10-01','2026-12-31',now());`;
  await command('docker', ['exec', id, 'psql', '-U', 'erp_uat', '-d', 'erp_uat', '--set=ON_ERROR_STOP=1', '--command', sql]);
  const storage = path.join(home, '.construction-erp-v12-isolated/documents');
  await mkdir(storage, { recursive: true });
  await writeFile(path.join(retained, 'deploy/uat/.env'), `NODE_ENV=uat\nAPI_HOST=127.0.0.1\nAPI_PORT=3001\nWEB_HOST=127.0.0.1\nWEB_PORT=4174\nUAT_DB_CONTAINER=${name}\nUAT_DB_NAME=erp_uat\nUAT_DB_USER=erp_uat\nUAT_DB_PASSWORD=${token}\nUAT_DB_PORT=${port}\nUAT_DATA_ROOT=${home}/.construction-erp-v12-isolated\n`);
  const context = await loadContext(retained, { home, run });
  // Only the imported test harness pins its own newly created source ID.
  // The Mac CLI has no source-ID/engine/candidate override.
  context.expectedSourceId = id;
  context.revalidate = async () => {
    const latest = await loadContext(retained, { home, run });
    assert.equal(latest.configHash, context.configHash);
  };
  const root = path.join(home, '.construction-erp-uat/evidence/v12-c-recovery');
  const plan = path.join(root, 'plan.json'), set = path.join(root, 'set');
  await createPlan(context, plan, { run });
  // Real connected-client refusal (separate idle query), then close it.
  const { spawn } = await import('node:child_process');
  const client = spawn('docker', ['exec', id, 'psql', '-U', 'erp_uat', '-d', 'erp_uat', '-c', 'SELECT pg_sleep(30);'], { stdio: 'ignore' });
  try {
    let connected = false;
    for (let n = 0; n < 60; n++) {
      if ((await readSource(context, run)).observed.otherClients > 0) { connected = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(connected);
    await assert.rejects(capture(context, plan, set, { run }), /DATABASE_CLIENTS_STILL_CONNECTED/);
  } finally {
    // Test-created backend only; never part of the user adapter/capture path.
    await command('docker', ['exec', id, 'psql', '-U', 'erp_uat', '-d', 'erp_uat', '-c',
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query='SELECT pg_sleep(30);' AND pid<>pg_backend_pid();"]);
    if (client.exitCode === null) await new Promise(resolve => client.once('exit', resolve));
  }
  console.log('V12_RECOVERY_CI_CAPTURE');
  await capture(context, plan, set, { run });
  console.log('V12_RECOVERY_CI_RESTORE');
  let evidence;
  try { evidence = await restore(context, plan, set, { run }); }
  catch (error) {
    const before = JSON.parse(await readFile(path.join(set, 'source-evidence.json'), 'utf8'));
    for (const name of await readdir(set)) if (name.startsWith('drill-')) {
      const after = JSON.parse(await readFile(path.join(set, name, 'restored-database-evidence.json'), 'utf8'));
      const map = new Map(after.schemaObjects.map(o => [o.kind + ':' + o.key, o]));
      // This CI-created schema contains public repository definitions only.
      // Never print routine bodies or retained row values.
      const differences = before.schemaObjects.filter(o => JSON.stringify(o) !== JSON.stringify(map.get(o.kind + ':' + o.key)))
        .map(o => ({ kind: o.kind, key: o.key, ...(o.kind === 'routine' ? {} : { before: o.definition, after: map.get(o.kind + ':' + o.key)?.definition }) }));
      console.log('V12_CI_SCHEMA_DIAGNOSTIC ' + JSON.stringify(differences.slice(0, 12)));
    }
    throw error;
  }
  assert.equal(evidence.status, 'EMPTY_STORE_RESTORE_PASS');
  assert.equal(evidence.cleanup, 'PASS');
  assert.equal(evidence.uploadedDocumentBytes, 'NOT_TESTED_EMPTY_STORE');
  // Actual post-restore schema/content tampering must still fail the comparisons.
  for (const [kind, sql, expected] of [
    ['schema', 'ALTER TABLE public.documents ADD COLUMN recovery_tamper TEXT;', /SCHEMAHASH/],
    ['row', "UPDATE public.companies SET company_name='Unexpected target change';", /TABLES/],
  ]) {
    const tamperedRun = async (cmd, args, options) => {
      const result = await run(cmd, args, options);
      if (cmd === 'podman' && args.includes('pg_restore') && result.code === 0) {
        const targetId = args[args.indexOf('--interactive') + 1];
        assert.notEqual(targetId, id);
        await command('docker', ['exec', targetId, 'psql', '-U', 'erp_restore', '-d', 'erp_restore', '--set=ON_ERROR_STOP=1', '--command', sql]);
      }
      return result;
    };
    await assert.rejects(restore(context, plan, set, { run: tamperedRun }), expected);
    console.log('V12_RECOVERY_CI_' + kind.toUpperCase() + '_TAMPER_REFUSED');
  }
  // An actual byte corruption must refuse before creating any target container.
  const dump = await open(path.join(set, 'database.dump'), 'r+');
  try { await dump.write(Buffer.from('bad'), 0, 3, 0); } finally { await dump.close(); }
  await assert.rejects(restore(context, plan, set, { run }));
  console.log(JSON.stringify({ regression: 'V12_EMPTY_CAPTURE_RESTORE_PASS',
    connectedClientRefusal: 'PASS', schemaTamperRefusal: 'PASS', rowTamperRefusal: 'PASS', corruptDumpRefusal: 'PASS', ...evidence }));
} finally {
  if (id) {
    const [info] = JSON.parse(await command('docker', ['container', 'inspect', id]));
    assert.equal(info.Id, id);
    assert.equal(info.Config.Labels['io.construction-erp.recovery-ci'], token);
    await command('docker', ['rm', '--force', id]);
  }
  if (worktree) await command('git', ['worktree', 'remove', '--force', retained]);
  await rm(home, { recursive: true, force: true });
}
