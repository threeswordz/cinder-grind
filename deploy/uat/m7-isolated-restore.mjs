// M7-02 preparation only. No CLI, native transport, migration or deployment.
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
const need = (ok, code) => { if (!ok) throw new Error('M7_RESTORE_' + code); };
const sha = /^[a-f0-9]{40}$/;
const kinds = ['documents', 'uploads', 'hrkeys'];
const protectedKinds = ['application', 'database', 'documents', 'uploads', 'hrkeys', 'capture'];
const contains = (a, b) => { const r = relative(a, b); return r === '' || (!isAbsolute(r) && r !== '..' && !r.startsWith('../')); };
const disjoint = (a, b) => !contains(a, b) && !contains(b, a);
async function directory(path, privateOnly = false) {
  need(typeof path === 'string' && isAbsolute(path) && resolve(path) === path, 'PATH');
  const s = await lstat(path);
  need(s.isDirectory() && !s.isSymbolicLink() && await realpath(path) === path, 'ALIAS');
  if (privateOnly) need(s.uid === process.getuid() && !(s.mode & 0o077), 'PRIVATE');
  return s;
}
const sameDir = (a, b) => a.dev === b.dev && a.ino === b.ino;
const dbIdentity = d => typeof d?.cluster === 'string' && /^\d+$/.test(d.cluster) && Number.isSafeInteger(d.oid) && d.oid > 0 && typeof d.database === 'string' && typeof d.role === 'string';
const sameDb = (a, b) => a.cluster === b.cluster && a.oid === b.oid;
export function verifyRestoreDatabase(source, target, plan, empty = false) {
  need(dbIdentity(source) && dbIdentity(target) && !sameDb(source, target), 'DB_ALIAS');
  need(target.database === plan.database && target.role === plan.role && target.owner === plan.role && target.database !== source.database && target.role !== source.role, 'DB_OWNER');
  need(target.roleIsolated === true && target.canConnectSource === false && target.privileged === false && target.otherSessions === 0, 'DB_ROLE_OR_SESSION');
  if (empty) need(target.emptyAtDatabaseScope === true, 'DB_NOT_EMPTY');
  return true;
}
export async function claimRestoreTarget({ parent, runId, protectedRoots, candidate, sourcePort, port }) {
  need(/^[a-f0-9]{12}$/.test(runId ?? '') && sha.test(candidate?.sha ?? '') && sha.test(candidate?.tree ?? '') && candidate.clean === true, 'PIN');
  need(Number.isInteger(sourcePort) && sourcePort > 1023 && sourcePort <= 65535 && Number.isInteger(port) && port > 1023 && port <= 65535 && port !== sourcePort, 'PORT');
  const parentId = await directory(parent, true);
  need(protectedKinds.every(k => typeof protectedRoots?.[k] === 'string'), 'PROTECTED_ROOTS');
  const roots = protectedKinds.map(k => protectedRoots[k]);
  for (const path of roots) { await directory(path); need(disjoint(parent, path), 'PATH_OVERLAP'); }
  const root = join(parent, 'm7-restore-' + runId);
  // Atomic exclusive claim: never accept an existing directory, even if empty.
  await mkdir(root, { mode: 0o700 });
  const rootId = await directory(root, true);
  const storage = Object.freeze(Object.fromEntries(kinds.map(k => [k, join(root, k)])));
  // No cleanup on errors; a partial claim is retained and cannot be retried.
  for (const path of Object.values(storage)) await mkdir(path, { mode: 0o700 });
  const ids = await Promise.all(Object.values(storage).map(p => directory(p, true)));
  const plan = Object.freeze({ root, storage, database: 'm7_restore_' + runId, role: 'm7_restore_role_' + runId, sha: candidate.sha, tree: candidate.tree, port });
  const verifyPaths = async () => {
    need(sameDir(parentId, await directory(parent, true)) && sameDir(rootId, await directory(root, true)), 'PATH_DRIFT');
    for (const [i, p] of Object.values(storage).entries()) need(sameDir(ids[i], await directory(p, true)), 'PATH_DRIFT');
    for (const p of roots) { await directory(p); need(disjoint(root, p), 'PATH_OVERLAP'); }
  };
  await verifyPaths();
  return Object.freeze({ plan, verifyPaths });
}
export function verifyRestoredApi(plan, expected, observed, source) {
  need(Number.isSafeInteger(expected?.pid) && expected.pid > 1 && expected.pid !== source?.pid && expected.born && expected.entry && expected.uid === process.getuid(), 'API_EXPECTED');
  need(observed?.pid === expected.pid && observed.born === expected.born && observed.uid === expected.uid && observed.entry === expected.entry && observed.sha === plan.sha && observed.tree === plan.tree && observed.database === plan.database && observed.role === plan.role, 'API_IDENTITY');
  need(observed.listenerPids?.length === 1 && observed.listenerPids[0] === expected.pid && observed.listenAddresses?.length === 1 && observed.listenAddresses[0] === '127.0.0.1:' + plan.port, 'API_LISTENER');
  need(kinds.every(k => observed.storage?.[k] === plan.storage[k]) && observed.health === 'ok', 'API_STORAGE_OR_HEALTH');
  return true;
}
// Fixed, non-destructive pg_restore flags; caller must use a verified credential-free
// target transport, pinned custom dump and fresh DB, not shell interpolation.
export function restoreArguments(plan) {
  need(/^m7_restore_[a-f0-9]{12}$/.test(plan?.database ?? '') && plan.role === plan.database.replace('m7_restore_', 'm7_restore_role_'), 'DB_PLAN');
  return ['pg_restore', '--exit-on-error', '--single-transaction', '--no-owner', '--no-privileges', '-U', plan.role, '-d', plan.database];
}
