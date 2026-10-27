// Empty-store V12 UAT capture and disposable restore. No retained business writes/grants/migrations.
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, readdir, lstat, realpath, writeFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const toolsRoot = fileURLToPath(new URL('../..', import.meta.url));
export const candidate = 'f3a98a036e3376a0ec4e3e6e3acec9aa64832a1f';
export const retainedSourceId = '9954cbf9687f9c0fcab73c4442954ff20b7d48ca6de3a210bc2588d26de925bc';
const image = 'docker.io/library/postgres:17.11-alpine';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function safe(value, code) { if (!value) throw new Error(code); }

export async function runProcess(command, args, { env = cleanEnvironment(), outputFd, inputFd } = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    const child = spawn(command, args, { cwd: toolsRoot, env,
      stdio: [inputFd ?? 'ignore', outputFd ?? 'pipe', 'pipe'], signal: AbortSignal.timeout(300000) });
    if (outputFd === undefined) child.stdout.setEncoding('utf8').on('data', chunk => {
      stdout += chunk;
      if (stdout.length > 32_000_000) child.kill();
    });
    child.stderr.resume(); // Never expose raw engine output, credentials or DB contents.
    child.once('error', () => reject(new Error('COMMAND_UNAVAILABLE')));
    child.once('close', code => resolve({ code, stdout }));
  });
}

async function checked(run, command, args, options) {
  const result = await run(command, args, options);
  safe(result.code === 0, 'RECOVERY_COMMAND_FAILED');
  return result.stdout;
}

export async function loadContext(checkout, { home = homedir(), run = runProcess } = {}) {
  const retained = await realpath(checkout);
  safe(retained === await realpath(path.join(home, 'Construction-ERP-V12-UAT')), 'WRONG_CHECKOUT');
  safe((await checked(run, 'git', ['-C', retained, 'rev-parse', 'HEAD'])).trim() === candidate, 'WRONG_CANDIDATE');
  safe((await checked(run, 'git', ['-C', retained, 'status', '--porcelain', '--untracked-files=no'])).trim() === '', 'DIRTY_CHECKOUT');
  const configText = await readFile(path.join(retained, 'deploy/uat/.env'), 'utf8');
  const config = parseEnv(configText);
  safe(config.NODE_ENV === 'uat' && config.API_HOST === '127.0.0.1' && config.API_PORT === '3001' &&
    config.WEB_HOST === '127.0.0.1' && config.WEB_PORT === '4174', 'NOT_ISOLATED_V12_UAT');
  safe(config.UAT_DB_CONTAINER === 'construction-erp-v12-isolated-postgres', 'WRONG_CONTAINER_NAME');
  for (const key of ['UAT_DB_NAME', 'UAT_DB_USER']) safe(/^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(config[key] ?? ''), 'INVALID_DATABASE_ID');
  safe(/^[1-9]\d{0,4}$/.test(config.UAT_DB_PORT ?? '') && Number(config.UAT_DB_PORT) <= 65535, 'INVALID_DB_PORT');
  const dataRoot = (config.UAT_DATA_ROOT ?? '').replace(/^\$HOME(?=\/|$)|^\$\{HOME\}(?=\/|$)/, home);
  safe(path.resolve(dataRoot) === path.join(home, '.construction-erp-v12-isolated'), 'WRONG_DATA_ROOT');
  const storage = path.join(dataRoot, 'documents');
  safe(await realpath(storage) === storage, 'STORAGE_ALIAS');
  safe(config.UAT_DB_PASSWORD?.length > 0, 'MISSING_DATABASE_PASSWORD');
  return { retained, storage, config, home, configHash: digest(configText), expectedSourceId: retainedSourceId };
}

export async function assertEmptyStorage(root) {
  const visit = async target => {
    const info = await lstat(target);
    safe(info.isDirectory() && !info.isSymbolicLink(), 'DOCUMENTS_NOT_EMPTY_OR_UNSAFE');
    for (const name of await readdir(target)) await visit(path.join(target, name));
  };
  await visit(root); // Empty directories are allowed; all files/links/special entries fail.
}

export async function readSource(context, run = runProcess) {
  const { config } = context;
  const rows = JSON.parse(await checked(run, 'podman', ['container', 'inspect', config.UAT_DB_CONTAINER]));
  safe(rows.length === 1, 'SOURCE_IDENTITY');
  const info = rows[0];
  safe(info.Id === context.expectedSourceId && info.Name.replace(/^\//, '') === config.UAT_DB_CONTAINER &&
    info.State?.Running === true && info.Config?.Image === image, 'SOURCE_IDENTITY');
  for (const client of ['psql', 'pg_dump', 'pg_restore']) {
    const version = (await checked(run, 'podman', ['exec', info.Id, client, '--version'])).trim();
    safe(version === client + ' (PostgreSQL) 17.11', 'CLIENT_VERSION_MISMATCH');
  }
  const ports = info.NetworkSettings?.Ports?.['5432/tcp'];
  safe(ports?.length === 1 && ports[0].HostIp === '127.0.0.1' && ports[0].HostPort === config.UAT_DB_PORT, 'SOURCE_PORT');
  const source = { id: info.Id, database: config.UAT_DB_NAME, user: config.UAT_DB_USER,
    port: config.UAT_DB_PORT, storage: context.storage, configHash: context.configHash };
  if (context.revalidate) await context.revalidate();
  const env = cleanEnvironment({ PGPASSWORD: config.UAT_DB_PASSWORD });
  const prefix = ['exec', '--env', 'PGPASSWORD', '--env', 'PGOPTIONS=-c default_transaction_read_only=on', source.id];
  const connection = ['--host=/var/run/postgresql', '--port=5432', '--username', source.user, '--dbname', source.database];
  const sql = `SELECT json_build_object('database',current_database(),'readOnly',current_setting('transaction_read_only'),
    'version',current_setting('server_version_num')::int,'systemIdentifier',(SELECT system_identifier::text FROM pg_control_system()),'localDocuments',(SELECT count(*) FROM public.documents WHERE storage_provider='LOCAL'),
    'company',EXISTS(SELECT 1 FROM public.companies WHERE company_code='V12UAT'),
    'project',EXISTS(SELECT 1 FROM public.projects p JOIN public.companies c ON c.id=p.company_id WHERE p.id='e30da8b5-315c-4c0f-946b-da56086e646c' AND c.company_code='V12UAT' AND p.project_code='V12-THB-001'),
    'otherClients',(SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND backend_type='client backend'));`;
  const observed = JSON.parse(await checked(run, 'podman', [...prefix, 'psql', ...connection,
    '--no-psqlrc', '--no-password', '--quiet', '--tuples-only', '--no-align', '--set=ON_ERROR_STOP=1', '--command', sql], { env }));
  safe(observed.database === source.database && observed.readOnly === 'on' && observed.version === 170011 &&
    observed.company === true && observed.project === true, 'SOURCE_DATABASE_MISMATCH');
  safe(observed.localDocuments === 0, 'LOCAL_DOCUMENTS_REQUIRE_BYTES');
  safe(/^[0-9]+$/.test(observed.systemIdentifier ?? ''), 'SOURCE_SYSTEM_IDENTITY');
  source.systemIdentifier = observed.systemIdentifier;
  await assertEmptyStorage(context.storage);
  return { source, observed, env, prefix, connection };
}

async function artifactPath(context, supplied, run) {
  const root = path.join(context.home, '.construction-erp-uat/evidence/v12-c-recovery');
  safe(path.dirname(path.resolve(supplied)) === root, 'ARTIFACT_PATH');
  const canonical = (await checked(run, 'node', ['deploy/recovery/path-safety.mjs', 'recovery-root', root, context.retained, context.storage])).trim();
  safe(canonical === root, 'ARTIFACT_ROOT_ALIAS');
  await mkdir(root, { recursive: true, mode: 0o700 });
  safe(((await lstat(root)).mode & 0o077) === 0, 'ARTIFACT_ROOT_NOT_PRIVATE');
  return path.resolve(supplied);
}

export async function createPlan(context, planFile, { run = runProcess, now = () => Date.now() } = {}) {
  const { source } = await readSource(context, run);
  const plan = { schema: 'v12-empty-recovery-plan-v1', candidate, createdAt: new Date(now()).toISOString(),
    source, sourceHash: digest(source), localDocuments: 0, documentFiles: 0, businessWrites: false,
    captureRequiresOffline: true, ownerUatAcceptance: false, productionAuthorized: false };
  const target = await artifactPath(context, planFile, run);
  await writeFile(target, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return plan;
}

export async function assertOffline() {
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 3001 });
    socket.setTimeout(2000);
    socket.once('connect', () => { socket.destroy(); reject(new Error('API_STILL_LISTENING')); });
    socket.once('timeout', () => { socket.destroy(); reject(new Error('API_OFFLINE_NOT_PROVEN')); });
    socket.once('error', error => error.code === 'ECONNREFUSED' ? resolve() : reject(new Error('API_OFFLINE_NOT_PROVEN')));
  });
}

export async function capture(context, planFile, setDir, { run = runProcess, offline = assertOffline, now = () => Date.now() } = {}) {
  const input = await artifactPath(context, planFile, run);
  const planStat = await lstat(input);
  safe(planStat.isFile() && planStat.nlink === 1 && !planStat.isSymbolicLink() && (planStat.mode & 0o077) === 0, 'PLAN_NOT_PRIVATE');
  const plan = JSON.parse(await readFile(input, 'utf8'));
  safe(plan.schema === 'v12-empty-recovery-plan-v1' && plan.candidate === candidate && plan.businessWrites === false &&
    plan.localDocuments === 0 && plan.documentFiles === 0 && plan.captureRequiresOffline === true, 'INVALID_PLAN');
  const age = now() - Date.parse(plan.createdAt);
  safe(Number.isFinite(age) && age >= 0 && age <= 3600000, 'STALE_PLAN');
  await offline();
  const before = await readSource(context, run);
  safe(digest(before.source) === plan.sourceHash && digest(plan.source) === plan.sourceHash, 'SOURCE_CHANGED');
  safe(before.observed.otherClients === 0, 'DATABASE_CLIENTS_STILL_CONNECTED');
  const baseline = await databaseEvidence(before, run);
  await verifyMigrations(context, baseline);
  const target = await artifactPath(context, setDir, run);
  await writeFile(input + '.capture-attempt', JSON.stringify({ startedAt: new Date(now()).toISOString(), target }) + '\n', { flag: 'wx', mode: 0o600 });
  await mkdir(target, { mode: 0o700 }); // Never overwrite a previous set or remove retained resources.
  const journal = path.join(target, 'capture.json');
  const evidence = { schema: 'v12-empty-recovery-capture-v1', candidate, sourceHash: plan.sourceHash,
    generatedAt: new Date(now()).toISOString(), status: 'INCOMPLETE', businessWrites: false,
    ownerUatAcceptance: false, productionAuthorized: false, restoredRuntime: 'NOT_TESTED' };
  await writeFile(journal, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  let ready = false;
  try {
    const dump = await open(path.join(target, 'database.dump'), 'wx', 0o600);
    try {
      await checked(run, 'podman', [...before.prefix, 'pg_dump', ...before.connection, '--no-password', '--format=custom',
        '--no-owner', '--no-privileges', '--no-tablespaces', '--serializable-deferrable'], { env: before.env, outputFd: dump.fd });
      await dump.sync();
    } finally { await dump.close(); }
    const archive = await open(path.join(target, 'documents.tar.gz'), 'wx', 0o600);
    await archive.close();
    await checked(run, 'tar', ['--create', '--gzip', '--directory=' + context.storage, '--file=' + path.join(target, 'documents.tar.gz'), '.']);
    // External writers invalidate the claimed quiet capture. Never mutate source to pass.
    await offline();
    const after = await readSource(context, run);
    safe(digest(after.source) === plan.sourceHash && after.observed.otherClients === 0, 'SOURCE_CHANGED_DURING_CAPTURE');
    safe(digest(await databaseEvidence(after, run)) === digest(baseline), 'DATABASE_CHANGED_DURING_CAPTURE');
    await writeFile(path.join(target, 'source-evidence.json'), JSON.stringify(baseline, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await checked(run, 'bash', ['deploy/recovery/verify-documents-archive.sh', path.join(target, 'documents.tar.gz')]);
    const version = (await checked(run, 'podman', [...before.prefix, 'pg_dump', '--version'], { env: before.env })).trim();
    safe(/^pg_dump \(PostgreSQL\) 17\.11$/.test(version), 'CLIENT_VERSION_MISMATCH');
    const setId = 'v12-' + digest({ target, time: evidence.generatedAt }).slice(0, 24);
    const identity = 'v12uat-' + plan.sourceHash.slice(0, 32); // UAT capture identity; no live sentinel is created.
    const env = { ...cleanEnvironment(), DATABASE_URL: 'postgresql://127.0.0.1:' + before.source.port + '/' + before.source.database,
      RELEASE_COMMIT: candidate, STORAGE_DEPLOYMENT_ID: identity, RECOVERY_SET_ID: setId,
      RECOVERY_CREATED_AT: evidence.generatedAt, RECOVERY_DOCUMENT_FILE_COUNT: '0', RECOVERY_EMPTY_LOCAL_STORE: 'uat-empty-local-v1', POSTGRES_SERVER_VERSION: '17.11', PG_DUMP_VERSION: version };
    await checked(run, 'node', ['deploy/recovery/manifest.mjs', 'create', target], { env });
    await writeFile(path.join(target, 'RECOVERY-SET.READY'), setId + '\n', { flag: 'wx', mode: 0o600 });
    ready = true;
    await checked(run, 'bash', ['deploy/recovery/verify-recovery-set.sh', target], { env: {
      ...cleanEnvironment(), EXPECTED_RECOVERY_RELEASE_COMMIT: candidate, EXPECTED_STORAGE_DEPLOYMENT_ID: identity } });
    evidence.status = 'CAPTURED_RESTORE_NOT_TESTED';
    await writeFile(journal, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
    return evidence;
  } catch {
    if (ready) await unlink(path.join(target, 'RECOVERY-SET.READY'));
    throw new Error('CAPTURE_INCOMPLETE_KEEP_EVIDENCE');
  }
}


// Do not inherit ambient DATABASE_URL, PGHOST/PGSERVICE or UAT/Production secrets.
export function cleanEnvironment(extra = {}) {
  return Object.assign(Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'XDG_RUNTIME_DIR',
    'CONTAINER_HOST', 'DOCKER_HOST', 'CONTAINER_CONNECTION', 'SSH_AUTH_SOCK'].filter(k => process.env[k])
    .map(k => [k, process.env[k]])), { LC_ALL: 'C', TZ: 'UTC' }, extra);
}

async function query(source, sql, run) {
  return JSON.parse(await checked(run, 'podman', [...source.prefix, 'psql', ...source.connection,
    '--no-psqlrc', '--no-password', '--quiet', '--tuples-only', '--no-align', '--set=ON_ERROR_STOP=1', '--command', sql], { env: source.env }));
}

export async function databaseEvidence(source, run = runProcess) {
  const tables = await query(source, `SELECT coalesce(json_agg(tablename ORDER BY tablename),'[]') FROM pg_tables WHERE schemaname='public';`, run);
  safe(tables.length > 0 && tables.includes('_prisma_migrations') && tables.includes('documents'), 'SOURCE_SCHEMA_MISSING');
  const quote = name => '"' + name.replaceAll('"', '""') + '"';
  const pieces = tables.map(name => {
    safe(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name), 'UNSUPPORTED_TABLE_NAME');
    return `SELECT json_build_object('table','${name}','rows',count(*),'hash',encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex')) AS evidence FROM (SELECT encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h FROM public.${quote(name)} t) rows`;
  });
  const rows = await query(source, `SELECT json_agg(evidence ORDER BY evidence->>'table') FROM (${pieces.join(' UNION ALL ')}) all_tables;`, run);
  const sequences = await query(source, `SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY sequencename),'[]') FROM (SELECT schemaname,sequencename,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text,last_value::text FROM pg_sequences WHERE schemaname='public') s;`, run);
  const migrations = await query(source, `SELECT coalesce(json_agg(json_build_object('name',migration_name,'checksum',checksum,'finished',finished_at IS NOT NULL,'rolledBack',rolled_back_at IS NOT NULL) ORDER BY migration_name),'[]') FROM public._prisma_migrations;`, run);
  const schema = await checked(run, 'podman', [...source.prefix, 'pg_dump', ...source.connection,
    '--no-password', '--schema-only', '--no-owner', '--no-privileges', '--no-tablespaces'], { env: source.env });
  // PG17.11 emits random psql restrict keys. Ignore these and comments only.
  const canonicalSchema = schema.split('\n').filter(line => !/^(--|\\(?:un)?restrict\b)/.test(line)).join('\n');
  return { schema: 'v12-database-evidence-v1', tables: rows, sequences, migrations,
    schemaHash: createHash('sha256').update(canonicalSchema).digest('hex') };
}

async function verifyMigrations(context, evidence) {
  const root = path.join(context.retained, 'apps/api/prisma/migrations');
  const names = (await readdir(root, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name).sort();
  safe(names.length === evidence.migrations.length, 'MIGRATION_HISTORY_MISMATCH');
  for (const [index, name] of names.entries()) {
    const recorded = evidence.migrations[index];
    const checksum = createHash('sha256').update(await readFile(path.join(root, name, 'migration.sql'))).digest('hex');
    safe(recorded.name === name && recorded.checksum === checksum && recorded.finished === true && recorded.rolledBack === false, 'MIGRATION_HISTORY_MISMATCH');
  }
}

export async function assertOwnedTarget(id, name, token, run = runProcess) {
  safe(/^[a-f0-9]{64}$/.test(id), 'TARGET_IDENTITY');
  const [info] = JSON.parse(await checked(run, 'podman', ['container', 'inspect', id]));
  safe(info?.Id === id && info.Name?.replace(/^\//, '') === name &&
    info.Config?.Labels?.['io.construction-erp.recovery'] === token &&
    info.Config?.Image === image && info.HostConfig?.NetworkMode === 'none' &&
    Object.values(info.NetworkSettings?.Ports ?? {}).every(value => !value?.length) &&
    info.HostConfig?.Tmpfs?.['/var/lib/postgresql/data'] &&
    (info.Mounts ?? []).every(m => m.Type === 'tmpfs' && m.Destination === '/var/lib/postgresql/data'), 'TARGET_NOT_ISOLATED');
}

export async function restore(context, planFile, setDir, { run = runProcess, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  // Restore never opens the source DB. It checks retained checkout/config only.
  const plan = JSON.parse(await readFile(await artifactPath(context, planFile, run), 'utf8'));
  safe(plan.schema === 'v12-empty-recovery-plan-v1' && plan.candidate === candidate && digest(plan.source) === plan.sourceHash &&
    plan.source.id === context.expectedSourceId && plan.source.configHash === context.configHash, 'INVALID_PLAN');
  const target = await artifactPath(context, setDir, run);
  const targetStat = await lstat(target);
  safe(targetStat.isDirectory() && !targetStat.isSymbolicLink() && (targetStat.mode & 0o077) === 0, 'SET_NOT_PRIVATE');
  const identity = 'v12uat-' + plan.sourceHash.slice(0, 32);
  await checked(run, 'bash', ['deploy/recovery/verify-recovery-set.sh', target], { env: cleanEnvironment({
    EXPECTED_RECOVERY_RELEASE_COMMIT: candidate, EXPECTED_STORAGE_DEPLOYMENT_ID: identity }) });
  const manifest = JSON.parse(await readFile(path.join(target, 'manifest.json'), 'utf8'));
  safe(manifest.documentFileCount === 0 && manifest.emptyLocalStore === 'uat-empty-local-v1', 'NOT_EMPTY_UAT_SET');
  const baseline = JSON.parse(await readFile(path.join(target, 'source-evidence.json'), 'utf8'));
  safe(manifest.sourceEvidenceHash === digest(baseline), 'SOURCE_EVIDENCE_MISMATCH');
  await verifyMigrations(context, baseline);
  const token = randomBytes(16).toString('hex');
  const name = 'erp-v12-restore-' + token;
  const drill = path.join(target, 'drill-' + token);
  await mkdir(drill, { mode: 0o700 });
  const storage = path.join(drill, 'documents');
  await mkdir(storage, { mode: 0o700 });
  const evidenceFile = path.join(drill, 'restore.json');
  const evidence = { schema: 'v12-empty-restore-v1', status: 'INCOMPLETE', candidate,
    backupIntegrity: 'PASS', databaseRestore: 'NOT_TESTED', databaseEvidenceMatch: 'NOT_TESTED',
    emptyDocuments: 'NOT_TESTED', uploadedDocumentBytes: 'NOT_TESTED_EMPTY_STORE',
    restoredRuntime: 'NOT_TESTED', humanAcceptance: false, productionAuthorized: false,
    cleanup: 'NOT_TESTED' };
  let id;
  let failure;
  await writeFile(evidenceFile, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  try {
    evidence.disposableContainer = { name, token };
    await writeFile(evidenceFile, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
    const env = cleanEnvironment({ POSTGRES_PASSWORD: randomBytes(32).toString('hex') });
    // No published ports, networks, existing volumes, host mounts or retained credentials.
    id = (await checked(run, 'podman', ['run', '--detach', '--name', name,
      '--label', 'io.construction-erp.recovery=' + token, '--network=none',
      '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=1024m',
      '--env', 'POSTGRES_DB=erp_restore', '--env', 'POSTGRES_USER=erp_restore',
      '--env', 'POSTGRES_PASSWORD', image], { env })).trim();
    evidence.disposableContainer = { id, name, token };
    safe(id !== context.expectedSourceId, 'RESTORE_TARGET_IS_SOURCE');
    await assertOwnedTarget(id, name, token, run);
    let ready = false;
    for (let n = 0; n < 60; n++) {
      if ((await run('podman', ['exec', id, 'pg_isready', '--host=127.0.0.1', '-U', 'erp_restore', '-d', 'erp_restore'], { env: cleanEnvironment() })).code === 0) { ready = true; break; }
      await sleep(500);
    }
    safe(ready, 'RESTORE_DATABASE_NOT_READY');
    const restored = { prefix: ['exec', '--env', 'PGOPTIONS=-c default_transaction_read_only=on', id],
      connection: ['--host=/var/run/postgresql', '--port=5432', '--username', 'erp_restore', '--dbname', 'erp_restore'], env: cleanEnvironment() };
    const empty = await query(restored, `SELECT to_json((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%')=0);`, run);
    safe(empty === true, 'RESTORE_DATABASE_NOT_EMPTY');
    await assertOwnedTarget(id, name, token, run);
    const dump = await open(path.join(target, 'database.dump'), 'r');
    try {
      await checked(run, 'podman', ['exec', '--interactive', id, 'pg_restore', ...restored.connection,
        '--no-password', '--exit-on-error', '--no-owner', '--no-privileges'], { env: cleanEnvironment(), inputFd: dump.fd });
    } finally { await dump.close(); }
    evidence.databaseRestore = 'PASS';
    const actual = await databaseEvidence(restored, run);
    await writeFile(path.join(drill, 'restored-database-evidence.json'), JSON.stringify(actual, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const differences = Object.keys(baseline).filter(key => digest(actual[key]) !== digest(baseline[key]));
    safe(digest(actual) === digest(baseline), 'RESTORED_DATABASE_MISMATCH_' + differences.join('_').toUpperCase());
    safe(await query(restored, `SELECT count(*) FROM public.documents WHERE storage_provider='LOCAL';`, run) === 0, 'RESTORED_LOCAL_DOCUMENTS_NOT_EMPTY');
    evidence.databaseEvidenceMatch = 'PASS';
    await checked(run, 'tar', ['--extract', '--gzip', '--no-same-owner', '--directory=' + storage, '--file=' + path.join(target, 'documents.tar.gz')], { env: cleanEnvironment() });
    await assertEmptyStorage(storage);
    evidence.emptyDocuments = 'PASS';
  } catch (error) { failure = error; }
  finally {
    // Only destroy an exact ID this invocation created AND still proves ownership/isolation.
    if (id && id !== context.expectedSourceId) {
      try {
        await assertOwnedTarget(id, name, token, run);
        await checked(run, 'podman', ['rm', '--force', id], { env: cleanEnvironment() });
        evidence.cleanup = 'PASS';
      } catch { failure = new Error('OWNED_TARGET_CLEANUP_FAILED'); evidence.cleanup = 'FAILED_PRESERVE_FOR_INSPECTION'; }
    }
    if (!failure && evidence.cleanup === 'PASS') evidence.status = 'EMPTY_STORE_RESTORE_PASS';
    await writeFile(evidenceFile, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  }
  if (failure) throw failure;
  return evidence;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  try {
    const [mode, checkout, planFile, setDir, confirmation] = process.argv.slice(2);
    safe(mode === '--plan' && process.argv.length === 5 || mode === '--capture' && process.argv.length === 7 && confirmation === '--api-stopped' ||
      mode === '--restore' && process.argv.length === 6, 'USAGE_PLAN_CAPTURE_OR_RESTORE');
    const context = await loadContext(checkout);
    context.revalidate = async () => {
      const latest = await loadContext(checkout);
      safe(latest.configHash === context.configHash, 'SOURCE_CONFIGURATION_CHANGED');
    };
    console.log(JSON.stringify(mode === '--plan' ? await createPlan(context, planFile) :
      mode === '--capture' ? await capture(context, planFile, setDir) : await restore(context, planFile, setDir), null, 2));
  } catch (error) {
    console.error('BLOCKED: ' + (/^[A-Z_]+$/.test(error.message) ? error.message : 'RECOVERY_PREREQUISITE_OR_EVIDENCE_ERROR'));
    process.exitCode = 2;
  }
}
