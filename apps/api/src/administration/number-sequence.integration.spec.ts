import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

import { ConflictException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { NumberSequenceService } from './number-sequence.service';

test('number sequence preserves starting value and resets on a new month', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'SEQ-' + suffix,
        companyName: 'Number Sequence Integration Test',
      },
    });

    const sequence = await prisma.numberSequence.create({
      data: {
        companyId: company.id,
        entityType: 'PURCHASE_ORDER',
        sequenceCode: 'PO_' + suffix,
        formatTemplate: 'POYYMM-###',
        resetRule: 'MONTHLY',
        nextValue: 4,
      },
    });

    const service = new NumberSequenceService(prisma);

    assert.equal(
      await service.next(
        company.id,
        sequence.sequenceCode,
        new Date('2026-04-15T00:00:00Z'),
      ),
      'PO2604-004',
    );

    assert.equal(
      await service.next(
        company.id,
        sequence.sequenceCode,
        new Date('2026-04-20T00:00:00Z'),
      ),
      'PO2604-005',
    );

    assert.equal(
      await service.next(
        company.id,
        sequence.sequenceCode,
        new Date('2026-05-01T00:00:00Z'),
      ),
      'PO2605-001',
    );

    const invalidReserved = await prisma.numberSequence.create({
      data: {
        companyId: company.id,
        entityType: 'SUBCONTRACT_AGREEMENT',
        sequenceCode: 'SUBCONTRACT_AGREEMENT',
        formatTemplate: 'BAD-###',
        resetRule: 'NONE',
        nextValue: 1,
      },
    });
    await assert.rejects(
      () =>
        service.next(
          company.id,
          invalidReserved.sequenceCode,
          new Date('2026-05-01T00:00:00Z'),
        ),
      (error: unknown) => error instanceof ConflictException,
    );
    const unchangedReserved = await prisma.numberSequence.findUniqueOrThrow({
      where: { id: invalidReserved.id },
    });
    assert.equal(unchangedReserved.nextValue, 1);
    assert.equal(unchangedReserved.lastPeriodKey, null);

    const concurrentSequence = await prisma.numberSequence.create({
      data: {
        companyId: company.id,
        entityType: 'TEST_CONCURRENT',
        sequenceCode: 'CONCURRENT_' + suffix,
        formatTemplate: 'TYYMM-###',
        resetRule: 'MONTHLY',
        nextValue: 1,
      },
    });
    const concurrent = await Promise.all([
      service.next(
        company.id,
        concurrentSequence.sequenceCode,
        new Date('2026-06-01T00:00:00Z'),
      ),
      service.next(
        company.id,
        concurrentSequence.sequenceCode,
        new Date('2026-06-01T00:00:00Z'),
      ),
    ]);
    assert.deepEqual([...concurrent].sort(), ['T2606-001', 'T2606-002']);
    const concurrentStored = await prisma.numberSequence.findUniqueOrThrow({
      where: { id: concurrentSequence.id },
    });
    assert.equal(concurrentStored.lastPeriodKey, '202606');
    assert.equal(concurrentStored.nextValue, 3);

    const boundarySequence = await prisma.numberSequence.create({
      data: {
        companyId: company.id,
        entityType: 'TEST_PERIOD_BOUNDARY',
        sequenceCode: 'PERIOD_BOUNDARY_' + suffix,
        formatTemplate: 'BYYMM-###',
        resetRule: 'MONTHLY',
        nextValue: 1,
      },
    });
    assert.equal(
      await service.next(
        company.id,
        boundarySequence.sequenceCode,
        new Date('2026-07-01T00:00:00Z'),
      ),
      'B2607-001',
    );
    await assert.rejects(
      () =>
        service.next(
          company.id,
          boundarySequence.sequenceCode,
          new Date('2026-06-30T23:59:59Z'),
        ),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.getResponse() !== null &&
        (error.getResponse() as { code?: string }).code ===
          'NUMBER_SEQUENCE_PERIOD_REGRESSION',
      'an older-period waiter must not move the reset period backward',
    );
    assert.equal(
      await service.next(
        company.id,
        boundarySequence.sequenceCode,
        new Date('2026-07-01T00:00:01Z'),
      ),
      'B2607-002',
    );
    const boundaryStored = await prisma.numberSequence.findUniqueOrThrow({
      where: { id: boundarySequence.id },
    });
    assert.equal(boundaryStored.lastPeriodKey, '202607');
    assert.equal(boundaryStored.nextValue, 3);

    const stored = await prisma.numberSequence.findUniqueOrThrow({
      where: { id: sequence.id },
    });
    assert.equal(stored.lastPeriodKey, '202605');
    assert.equal(stored.nextValue, 2);
  } finally {
    await prisma.$disconnect();
  }
});
