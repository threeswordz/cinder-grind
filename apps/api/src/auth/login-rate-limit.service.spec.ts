import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { HttpException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { LoginRateLimitService } from './login-rate-limit.service';

test('login rate limiter persists attempts and survives service recreation', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  const previousMax = process.env.LOGIN_RATE_LIMIT_MAX;
  const previousWindow = process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES;
  process.env.LOGIN_RATE_LIMIT_MAX = '2';
  process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES = '15';
  const key = randomUUID().replaceAll('-', '');

  try {
    const first = new LoginRateLimitService(prisma);
    await first.consume(key);
    await first.consume(key);

    const recreated = new LoginRateLimitService(prisma);
    await assert.rejects(
      () => recreated.consume(key),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === 429,
    );

    await recreated.reset(key);
    await assert.doesNotReject(() => recreated.consume(key));
  } finally {
    await prisma.loginRateLimitBucket.deleteMany({ where: { clientKey: key } });
    await prisma.$disconnect();
    if (previousMax === undefined) delete process.env.LOGIN_RATE_LIMIT_MAX;
    else process.env.LOGIN_RATE_LIMIT_MAX = previousMax;
    if (previousWindow === undefined) delete process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES;
    else process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES = previousWindow;
  }
});


test('login rate limiter opportunistically purges expired buckets in bounded batches', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  const prefix = randomUUID().replaceAll('-', '').slice(0, 20);
  const expiredKeys = Array.from(
    { length: 105 },
    (_, index) => prefix + '-expired-' + String(index).padStart(3, '0'),
  );
  const activeKey = prefix + '-active';
  const consumeKey = prefix + '-consume';

  try {
    await prisma.loginRateLimitBucket.deleteMany({
      where: { resetAt: { lte: new Date() } },
    });
    await prisma.loginRateLimitBucket.createMany({
      data: expiredKeys.map((clientKey) => ({
        clientKey,
        attemptCount: 1,
        resetAt: new Date(Date.now() - 60_000),
      })),
    });
    await prisma.loginRateLimitBucket.create({
      data: {
        clientKey: activeKey,
        attemptCount: 1,
        resetAt: new Date(Date.now() + 60_000),
      },
    });

    await new LoginRateLimitService(prisma).consume(consumeKey);

    assert.equal(
      await prisma.loginRateLimitBucket.count({
        where: { clientKey: { in: expiredKeys } },
      }),
      5,
    );
    assert.equal(
      await prisma.loginRateLimitBucket.count({ where: { clientKey: activeKey } }),
      1,
    );
  } finally {
    await prisma.loginRateLimitBucket.deleteMany({
      where: { clientKey: { in: [...expiredKeys, activeKey, consumeKey] } },
    });
    await prisma.$disconnect();
  }
});
