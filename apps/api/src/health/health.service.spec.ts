import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

test('health reports ok when PostgreSQL query succeeds', async () => {
  const prisma = { $queryRaw: async () => [{ one: 1 }] } as unknown as PrismaService;
  const service = new HealthService(prisma);
  const result = await service.check();

  assert.equal(result.status, 'ok');
  assert.equal(result.database, 'ok');
  assert.match(result.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('health returns service unavailable when PostgreSQL query fails', async () => {
  const prisma = {
    $queryRaw: async () => { throw new Error('database unavailable'); },
  } as unknown as PrismaService;
  const service = new HealthService(prisma);

  await assert.rejects(
    () => service.check(),
    (error: unknown) => error instanceof ServiceUnavailableException,
  );
});
