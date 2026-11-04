/**
 * Read-only local safety preflight for a proposed isolated synthetic ERP prototype.
 * It does NOT start a server, inspect a database, authenticate grants, prove that
 * caller declarations are true, certify a prototype or authorize Production.
 */
import {lstat, readFile, realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {isAbsolute, dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const run = promisify(execFile);
const SHA = /^[0-9a-f]{40}$/;
const PERSONAS = ['Ben', 'Nancy', 'Khaimook', 'Jai', 'Store Site', 'Foreman', 'Koh', 'Porn'];
const RESERVED_LOCAL_PORTS = new Set([3000, 3001, 3002, 4173, 4174, 4175, 5432, 55434]);
const fields = (v, expected) => v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length === expected.length && expected.every(k => Object.hasOwn(v, k));
const exactSet = (a, b) => Array.isArray(a) && a.length === b.length &&
  new Set(a).size === b.length && b.every(x => a.includes(x));
const safePath = p => typeof p === 'string' && isAbsolute(p) && resolve(p) === p &&
  p !== '/' && !p.split('/').includes('..');
function localOrigin(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' ||
        parsed.username || parsed.password || parsed.search || parsed.hash ||
        parsed.pathname !== '/' || !/^\d+$/.test(parsed.port)) return null;
    const port = Number(parsed.port);
    return port >= 1024 && port <= 65535 && !RESERVED_LOCAL_PORTS.has(port) ? port : null;
  } catch { return null; }
}
const result = gaps => ({
  status: gaps.length ? 'ISOLATED_TARGET_PREFLIGHT_BLOCKED' : 'LOCAL_SAFETY_PREREQUISITES_OBSERVED',
  gaps, networkRequests: 0, databasesOpened: 0, filesChanged: 0,
  credentialAccessed: false, retainedAccessVerified: false,
  authenticatedRoleMatrixVerified: false, runtimeRunningVerified: false,
  prototypeFreezeCertified: false, humanUatCompleted: false,
  productionAuthorized: false, evidenceIndependentlyVerified: false,
});

export async function assessPrototypeTarget(config, expectedMainSha, {
  inspectDir = async p => {
    const st = await lstat(p);
    return {directory: st.isDirectory(), symlink: st.isSymbolicLink(),
      uid: st.uid, mode: st.mode & 0o777, real: await realpath(p)};
  },
  inspectCheckout = async p => {
    const [head, status] = await Promise.all([
      run('git', ['-C', p, 'rev-parse', 'HEAD'], {timeout: 10000, maxBuffer: 65536}),
      run('git', ['-C', p, 'status', '--porcelain'], {timeout: 10000, maxBuffer: 65536}),
    ]);
    return {head: head.stdout.trim(), clean: status.stdout.trim() === ''};
  },
  uid = process.getuid?.(),
} = {}) {
  if (!SHA.test(expectedMainSha ?? '')) throw Error('EXPECTED_MAIN_SHA_INVALID');
  const gaps = [], add = x => {if (!gaps.includes(x)) gaps.push(x);};
  if (!fields(config, ['schemaVersion','purpose','mode','expectedMainSha','companyCodes',
    'projectCount','personas','productionConnected','retainedDataUsed',
    'realCompanyGrantsModified','runtime'])) return result(['TARGET_MANIFEST_SCHEMA_INVALID']);
  if (config.schemaVersion !== 1 || config.purpose !== 'ISOLATED_PROTOTYPE_TARGET_PREFLIGHT' ||
      config.mode !== 'isolated-synthetic' || config.expectedMainSha !== expectedMainSha ||
      !exactSet(config.companyCodes, ['PROTO_A','PROTO_B']) ||
      !Number.isInteger(config.projectCount) || config.projectCount < 2 ||
      !exactSet(config.personas, PERSONAS) || config.productionConnected !== false ||
      config.retainedDataUsed !== false || config.realCompanyGrantsModified !== false)
    add('ISOLATION_OR_RELEASE_DECLARATION_INVALID');
  const rt = config.runtime;
  if (!fields(rt, ['checkoutRoot','isolationRoot','databaseRoot','documentsRoot',
    'hrKeysRoot','apiOrigin','webOrigin','postgresHost','postgresPort','postgresDbName'])) {
    add('TARGET_RUNTIME_SCHEMA_INVALID'); return result(gaps);
  }
  const ports = [localOrigin(rt.apiOrigin), localOrigin(rt.webOrigin), rt.postgresPort];
  if (rt.postgresHost !== '127.0.0.1' || !Number.isInteger(rt.postgresPort) ||
      rt.postgresPort < 1024 || rt.postgresPort > 65535 ||
      RESERVED_LOCAL_PORTS.has(rt.postgresPort) || ports.some(x => x === null) ||
      new Set(ports).size !== 3 || !/^proto_[a-z0-9_]{1,40}$/.test(rt.postgresDbName ?? ''))
    add('NON_ISOLATED_ENDPOINT_OR_DATABASE_IDENTITY');
  const keys = ['checkoutRoot','isolationRoot','databaseRoot','documentsRoot','hrKeysRoot'];
  if (keys.some(k => !safePath(rt[k])) ||
      !['databaseRoot','documentsRoot','hrKeysRoot'].every(k =>
        typeof rt[k] === 'string' && dirname(rt[k]) === rt.isolationRoot) ||
      keys.some((key, i) => keys.slice(i + 1).some(next => rt[key] === rt[next])) ||
      (safePath(rt.checkoutRoot) && safePath(rt.isolationRoot) &&
        (rt.checkoutRoot.startsWith(rt.isolationRoot + '/') ||
         rt.isolationRoot.startsWith(rt.checkoutRoot + '/')))) {
    add('UNSAFE_OR_OVERLAPPING_TARGET_ROOTS');
    return result(gaps);
  }
  for (const key of keys) {
    try {
      const s = await inspectDir(rt[key]);
      if (!s.directory || s.symlink || s.real !== rt[key] ||
          (key !== 'checkoutRoot' && (s.mode & 0o077) !== 0) ||
          (key !== 'checkoutRoot' && uid !== undefined && s.uid !== uid))
        add('TARGET_DIRECTORY_IDENTITY_OR_PERMISSIONS_INVALID');
    } catch { add('TARGET_DIRECTORY_UNAVAILABLE'); }
  }
  try {
    const c = await inspectCheckout(rt.checkoutRoot);
    if (c.head !== expectedMainSha || c.clean !== true)
      add('EXACT_CLEAN_CHECKOUT_MISSING');
  } catch { add('EXACT_CLEAN_CHECKOUT_MISSING'); }
  return result(gaps);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [path, sha] = process.argv.slice(2);
  if (!path || !sha) {
    console.error('Usage: node deploy/uat/prototype-target-preflight.mjs PRIVATE_MANIFEST.json EXACT_MAIN_SHA');
    process.exitCode = 2;
  } else {
    try {
      // The manifest is private and contains only identifiers, never passwords.
      // Require owner-only file access to limit accidental disclosure.
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
          (process.getuid && info.uid !== process.getuid()))
        throw Error('PRIVATE_MANIFEST_UNSAFE');
      const data = JSON.parse(await readFile(path,'utf8'));
      const answer = await assessPrototypeTarget(data,sha);
      console.log(JSON.stringify(answer,null,2));
      if (answer.gaps.length) process.exitCode = 1;
    } catch {
      console.error('PROTOTYPE_TARGET_INPUT_OR_INSPECTION_ERROR');
      process.exitCode = 2;
    }
  }
}
