import {quiescentSourceProcess} from './m7-source-process.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile, symlink, rename, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claimRestoreTarget, verifyRestoreDatabase, verifyRestoredApi, restoreArguments } from './m7-isolated-restore.mjs';
async function fixture(t) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'm7-test-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const protectedRoots = {};
  for (const k of ['application', 'database', 'documents', 'uploads', 'hrkeys', 'capture']) { protectedRoots[k] = join(base, k); await mkdir(protectedRoots[k], { mode: 0o700 }); }
  const parent = join(base, 'target'); await mkdir(parent, { mode: 0o700 });
  return { parent, protectedRoots, runId: 'abcdef012345', candidate: { sha: 'a'.repeat(40), tree: 'b'.repeat(40), clean: true }, sourcePort: 33071, port: 33073 };
}
const source = { cluster: '12345', oid: 42, database: 'proto_a_01', role: 'proto_runtime' };
const target = plan => ({ cluster: '67890', oid: 43, database: plan.database, role: plan.role, owner: plan.role, roleIsolated: true, canConnectSource: false, privileged: false, otherSessions: 0, emptyAtDatabaseScope: true });
test('fresh claim creates private distinct roots and rejects repeat without overwriting bytes', async t => {
  const f = await fixture(t), c = await claimRestoreTarget(f);
  await c.verifyPaths(); const file = join(c.plan.storage.documents, 'record'); await writeFile(file, 'original');
  await assert.rejects(claimRestoreTarget(f), { code: 'EEXIST' }); assert.equal(await readFile(file, 'utf8'), 'original');
});
test('pre-existing empty target and dangling symlink are never claimed', async t => {
  const f = await fixture(t), p = join(f.parent, 'm7-restore-' + f.runId); await mkdir(p);
  await assert.rejects(claimRestoreTarget(f), { code: 'EEXIST' }); await rm(p, { recursive: true }); await symlink(join(p, 'missing'), p);
  await assert.rejects(claimRestoreTarget(f), { code: 'EEXIST' });
});
test('protected source overlap and parent alias denied', async t => {
  const f = await fixture(t); await assert.rejects(claimRestoreTarget({ ...f, parent: f.protectedRoots.hrkeys }), /PATH_OVERLAP/);
  const alias = join(f.parent, 'alias'); await symlink(f.protectedRoots.capture, alias); await assert.rejects(claimRestoreTarget({ ...f, parent: alias }), /ALIAS/);
});
test('replaced private storage directory detected even with same path', async t => {
  const f = await fixture(t), c = await claimRestoreTarget(f); const p = c.plan.storage.hrkeys; await rename(p, p + '-old'); await mkdir(p, { mode: 0o700 }); await assert.rejects(c.verifyPaths(), /PATH_DRIFT/);
});
test('concurrent attempts have exactly one successful claim', async t => {
  const f = await fixture(t); const r = await Promise.allSettled([claimRestoreTarget(f), claimRestoreTarget(f)]); assert.equal(r.filter(x => x.status === 'fulfilled').length, 1); assert.equal(r.find(x => x.status === 'rejected').reason.code, 'EEXIST');
});
test('wrong application pin, invalid run ID and source port fail', async t => {
  const f = await fixture(t); for (const patch of [{ candidate: { ...f.candidate, clean: false } }, { runId: '../bad' }, { port: f.sourcePort }]) await assert.rejects(claimRestoreTarget({ ...f, ...patch }), /M7_RESTORE_/);
});
test('database identity, distinct role, emptiness and session checks fail closed', async t => {
  const { plan } = await claimRestoreTarget(await fixture(t)), d = target(plan); assert.equal(verifyRestoreDatabase(source, d, plan, true), true); assert.equal(verifyRestoreDatabase(source, { ...d, oid: source.oid }, plan, true), true);
  for (const patch of [{ cluster: source.cluster }, { role: source.role }, { owner: source.role }, { database: source.database }, { privileged: true }, { roleIsolated: false }, { canConnectSource: true }, { otherSessions: 1 }, { emptyAtDatabaseScope: false }, { cluster: undefined }]) assert.throws(() => verifyRestoreDatabase(source, { ...d, ...patch }, plan, true), /M7_RESTORE_/);
});
test('restore flags use fixed target only, no clean/create/migrate', async t => {
  const { plan } = await claimRestoreTarget(await fixture(t)); assert.deepEqual(restoreArguments(plan), ['pg_restore', '--exit-on-error', '--single-transaction', '--no-owner', '--no-privileges', '-U', plan.role, '-d', plan.database]); assert.throws(() => restoreArguments({ ...plan, database: source.database }), /DB_PLAN/);
});
test('loopback API must match process, app, role and all three private roots', async t => {
  const { plan } = await claimRestoreTarget(await fixture(t)); const e = { pid: 222, born: 'start', uid: process.getuid(), entry: '/isolated/main.js' }; const o = { ...e, sha: plan.sha, tree: plan.tree, database: plan.database, role: plan.role, listenerPids: [222], listenAddresses: ['127.0.0.1:' + plan.port], storage: plan.storage, health: 'ok' };
  assert.equal(verifyRestoredApi(plan, e, o, quiescentSourceProcess({api:{port:33071,pid:111,born:'retained api'},web:{port:44171,pid:112,born:'retained web'}})), true);
  for (const patch of [{ pid: 111 }, { pid: 112 }, { born: 'changed' }, { sha: 'c'.repeat(40) }, { role: source.role }, { listenerPids: [222, 333] }, { listenAddresses: ['0.0.0.0:' + plan.port] }, { storage: { ...plan.storage, hrkeys: '/source/keys' } }, { health: 'bad' }]) assert.throws(() => verifyRestoredApi(plan, e, { ...o, ...patch }, quiescentSourceProcess({api:{port:33071,pid:111,born:'retained api'},web:{port:44171,pid:112,born:'retained web'}})), /M7_RESTORE_/);
});
test('all retained and offline source ports are reserved',async t=>{const f=await fixture(t);for(const port of [33071,33072,44171,44172])await assert.rejects(claimRestoreTarget({...f,port}),/M7_RESTORE_PORT/);});
