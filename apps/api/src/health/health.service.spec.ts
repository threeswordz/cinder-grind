import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';

import { DocumentStorage } from '../documents/document-storage';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

function storageWith(assertReady: () => Promise<void>): DocumentStorage {
  return { assertReady } as unknown as DocumentStorage;
}

test('readiness reports ok when PostgreSQL and document storage are available', async () => {
  const prisma = { $queryRaw: async () => [{ one: 1 }] } as unknown as PrismaService;
  let storageChecks = 0;
  const storage = storageWith(async () => { storageChecks += 1; });
  const service = new HealthService(prisma, storage);
  const result = await service.ready();

  assert.equal(result.status, 'ok');
  assert.equal(result.database, 'ok');
  assert.equal(result.documentStorage, 'ok');
  assert.equal(storageChecks, 1);
  assert.match(result.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('health root remains a readiness alias', async () => {
  const prisma = { $queryRaw: async () => [{ one: 1 }] } as unknown as PrismaService;
  const service = new HealthService(prisma, storageWith(async () => undefined));
  const result = await service.check();

  assert.equal(result.status, 'ok');
  assert.equal(result.database, 'ok');
  assert.equal(result.documentStorage, 'ok');
});

test('liveness does not query external dependencies', () => {
  const prisma = {
    $queryRaw: async () => { throw new Error('must not run'); },
  } as unknown as PrismaService;
  const storage = storageWith(async () => { throw new Error('must not run'); });
  const service = new HealthService(prisma, storage);
  const result = service.live();

  assert.equal(result.status, 'ok');
  assert.match(result.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('readiness returns service unavailable when PostgreSQL query fails', async () => {
  const prisma = {
    $queryRaw: async () => { throw new Error('database unavailable'); },
  } as unknown as PrismaService;
  let storageChecks = 0;
  const service = new HealthService(
    prisma,
    storageWith(async () => { storageChecks += 1; }),
  );

  await assert.rejects(
    () => service.ready(),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
  assert.equal(storageChecks, 0);
});

test('readiness returns service unavailable when document storage is unavailable', async () => {
  const prisma = { $queryRaw: async () => [{ one: 1 }] } as unknown as PrismaService;
  const service = new HealthService(
    prisma,
    storageWith(async () => { throw new Error('storage unavailable'); }),
  );

  await assert.rejects(
    () => service.ready(),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
});
