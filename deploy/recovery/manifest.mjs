import { createHash } from 'node:crypto';
import {
  chmodSync,
  createReadStream,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

function fail(message) {
  process.stderr.write(`Recovery manifest check failed: ${message}\n`);
  process.exit(1);
}

async function sha256(file) {
  const hash = createHash('sha256');
  try {
    for await (const chunk of createReadStream(file)) {
      hash.update(chunk);
    }
  } catch (error) {
    fail(
      `unable to checksum ${path.basename(file)}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return hash.digest('hex');
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is required`);
  return value;
}

async function artifact(setDir, name) {
  const target = path.join(setDir, name);
  let stat;
  try {
    stat = statSync(target);
  } catch {
    fail(`missing recovery artifact: ${name}`);
  }
  if (!stat.isFile()) fail(`recovery artifact is not a regular file: ${name}`);
  return { file: name, bytes: stat.size, sha256: await sha256(target) };
}

const [command, rawSetDir] = process.argv.slice(2);
if (!command || !rawSetDir) fail('usage: manifest.mjs <create|verify> <recovery-set-dir>');
const setDir = path.resolve(rawSetDir);
const manifestPath = path.join(setDir, 'manifest.json');

if (command === 'create') {
  const databaseUrl = new URL(required('DATABASE_URL'));
  if (!['postgresql:', 'postgres:'].includes(databaseUrl.protocol)) fail('DATABASE_URL must use PostgreSQL');

  const manifest = {
    version: 1,
    recoverySetId: required('RECOVERY_SET_ID'),
    createdAt: required('RECOVERY_CREATED_AT'),
    releaseCommit: required('RELEASE_COMMIT'),
    storageDeploymentId: required('STORAGE_DEPLOYMENT_ID'),
    postgresServerVersion: required('POSTGRES_SERVER_VERSION'),
    pgDumpVersion: required('PG_DUMP_VERSION'),
    database: {
      host: databaseUrl.hostname,
      port: databaseUrl.port || '5432',
      name: decodeURIComponent(databaseUrl.pathname.replace(/^\//, '')),
      schema: databaseUrl.searchParams.get('schema') || 'public',
    },
    documentFileCount: Number(required('RECOVERY_DOCUMENT_FILE_COUNT')),
    artifacts: {
      database: await artifact(setDir, 'database.dump'),
      documents: await artifact(setDir, 'documents.tar.gz'),
    },
  };

  if (!Number.isSafeInteger(manifest.documentFileCount) || manifest.documentFileCount < 1) {
    fail('RECOVERY_DOCUMENT_FILE_COUNT must be at least 1');
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  chmodSync(manifestPath, 0o600);
  process.stdout.write(`${manifest.recoverySetId}\n`);
  process.exit(0);
}

if (command === 'verify') {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail(`unable to read manifest.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (manifest.version !== 1) fail('unsupported manifest version');
  if (!/^[0-9a-f]{40}$/i.test(manifest.releaseCommit ?? '')) fail('manifest releaseCommit is invalid');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(manifest.storageDeploymentId ?? '')) fail('manifest storageDeploymentId is invalid');

  for (const [key, filename] of [['database', 'database.dump'], ['documents', 'documents.tar.gz']]) {
    const current = await artifact(setDir, filename);
    const expected = manifest.artifacts?.[key];
    if (!expected || expected.file !== filename || expected.bytes !== current.bytes || expected.sha256 !== current.sha256) {
      fail(`${filename} does not match manifest evidence`);
    }
  }

  const ready = path.join(setDir, 'RECOVERY-SET.READY');
  let readyId;
  try {
    readyId = readFileSync(ready, 'utf8').trim();
  } catch {
    fail('RECOVERY-SET.READY is missing');
  }
  if (readyId !== manifest.recoverySetId) fail('RECOVERY-SET.READY does not match manifest recoverySetId');

  if (process.env.EXPECTED_RECOVERY_RELEASE_COMMIT && process.env.EXPECTED_RECOVERY_RELEASE_COMMIT !== manifest.releaseCommit) {
    fail('recovery set release commit does not match EXPECTED_RECOVERY_RELEASE_COMMIT');
  }
  if (process.env.EXPECTED_STORAGE_DEPLOYMENT_ID && process.env.EXPECTED_STORAGE_DEPLOYMENT_ID !== manifest.storageDeploymentId) {
    fail('recovery set storage identity does not match EXPECTED_STORAGE_DEPLOYMENT_ID');
  }

  process.stdout.write(`Recovery set ${manifest.recoverySetId} verified.\n`);
  process.exit(0);
}

fail(`unsupported command: ${command}`);
