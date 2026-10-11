import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { LocalDocumentStorage } from './local-document-storage.service';

async function withStorageEnvironment(
  nodeEnv: string,
  run: (root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'construction-erp-storage-ready-'),
  );
  const previousRoot = process.env.STORAGE_ROOT;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDeploymentId = process.env.STORAGE_DEPLOYMENT_ID;

  process.env.STORAGE_ROOT = root;
  process.env.NODE_ENV = nodeEnv;
  try {
    await run(root);
  } finally {
    if (previousRoot === undefined) delete process.env.STORAGE_ROOT;
    else process.env.STORAGE_ROOT = previousRoot;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousDeploymentId === undefined) delete process.env.STORAGE_DEPLOYMENT_ID;
    else process.env.STORAGE_DEPLOYMENT_ID = previousDeploymentId;
    await rm(root, { recursive: true, force: true });
  }
}

test('local document storage readiness performs and cleans up a real write probe', async () => {
  await withStorageEnvironment('test', async (root) => {
    const storage = new LocalDocumentStorage();
    await storage.assertReady();
    assert.deepEqual(await readdir(root), []);
  });
});

test('production readiness keeps the deployment sentinel and cleans only its probe', async () => {
  await withStorageEnvironment('production', async (root) => {
    process.env.STORAGE_DEPLOYMENT_ID = 'readiness-spec';
    await writeFile(
      path.join(root, '.construction-erp-storage-ready'),
      'construction-erp-production-storage-v1:readiness-spec\n',
      { mode: 0o600 },
    );

    const storage = new LocalDocumentStorage();
    await storage.assertReady();

    assert.deepEqual(
      (await readdir(root)).sort(),
      ['.construction-erp-storage-ready'],
    );
  });
});


test('production reads validate storage identity without requiring write capacity', async () => {
  await withStorageEnvironment('production', async (root) => {
    process.env.STORAGE_DEPLOYMENT_ID = 'read-spec';
    await writeFile(
      path.join(root, '.construction-erp-storage-ready'),
      'construction-erp-production-storage-v1:read-spec\n',
      { mode: 0o600 },
    );

    const storageKey = '11111111-1111-4111-8111-111111111111';
    await writeFile(path.join(root, storageKey), 'existing-document');

    const storage = new LocalDocumentStorage();
    (
      storage as unknown as {
        probeWriteReadiness: () => Promise<void>;
      }
    ).probeWriteReadiness = async () => {
      throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
    };

    assert.equal((await storage.read(storageKey)).toString('utf8'), 'existing-document');
  });
});

test('production rollback removal validates storage identity without requiring a write probe', async () => {
  await withStorageEnvironment('production', async (root) => {
    process.env.STORAGE_DEPLOYMENT_ID = 'rollback-spec';
    await writeFile(
      path.join(root, '.construction-erp-storage-ready'),
      'construction-erp-production-storage-v1:rollback-spec\n',
      { mode: 0o600 },
    );

    const storageKey = '00000000-0000-4000-8000-000000000000';
    await writeFile(path.join(root, storageKey), 'rollback-me');

    const storage = new LocalDocumentStorage();
    (
      storage as unknown as {
        probeWriteReadiness: () => Promise<void>;
      }
    ).probeWriteReadiness = async () => {
      throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
    };

    await storage.remove(storageKey);

    assert.deepEqual(
      (await readdir(root)).sort(),
      ['.construction-erp-storage-ready'],
    );
  });
});

