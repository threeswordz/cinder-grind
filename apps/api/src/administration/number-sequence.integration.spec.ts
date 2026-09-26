import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

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

    const stored = await prisma.numberSequence.findUniqueOrThrow({
      where: { id: sequence.id },
    });
    assert.equal(stored.lastPeriodKey, '202605');
    assert.equal(stored.nextValue, 2);
  } finally {
    await prisma.$disconnect();
  }
});
