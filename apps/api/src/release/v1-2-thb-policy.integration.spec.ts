import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaService } from '../prisma/prisma.service';
import { verifyThbUpgrade } from './thb-upgrade-verification';

test('V1.2 new Company and monetary roots are THB-only at the database boundary', async () => {
  const prisma = new PrismaService();
  try {
    const token = randomUUID();
    const company = await prisma.company.create({ data: { companyCode: token, companyName: 'Disposable THB policy' } });
    assert.equal(company.baseCurrencyCode, 'THB');
    for (const baseCurrencyCode of ['SGD','USD']) {
      await assert.rejects(prisma.company.create({ data: { companyCode: randomUUID(), companyName: 'Denied foreign policy', baseCurrencyCode } }), /ERP_THB/);
      await assert.rejects(prisma.company.update({ where: { id: company.id }, data: { baseCurrencyCode } }), /ERP_THB/);
    }
    const customer = await prisma.customer.create({ data: { companyId: company.id, customerCode: token, customerName: 'Policy customer' } });
    const input = { companyId: company.id, customerId: customer.id, projectCode: token, projectName: 'THB contract', contractValue: '123.45', plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2026-12-31') };
    await assert.rejects(prisma.project.create({ data: { ...input, contractCurrencyCode: 'SGD' } }), /ERP_THB/);
    const project = await prisma.project.create({ data: { ...input, contractCurrencyCode: null } });
    assert.equal(project.contractCurrencyCode, 'THB');
    for (const currency of [null,'SGD','USD']) await assert.rejects(prisma.project.update({ where: { id: project.id }, data: { contractCurrencyCode: currency } }));
    const boq = await prisma.boq.create({ data: { companyId: company.id, projectId: project.id, currencyCode: null } });
    assert.equal(boq.currencyCode, 'THB');
    await assert.rejects(prisma.boq.update({ where: { id: boq.id }, data: { currencyCode: 'SGD' } }));
    const race = await Promise.allSettled([
      prisma.project.create({ data: { ...input, projectCode: randomUUID() } }),
      prisma.company.update({ where: { id: company.id }, data: { baseCurrencyCode: 'SGD' } }),
    ]);
    assert.equal(race[0]!.status, 'fulfilled');
    assert.equal(race[1]!.status, 'rejected');
    assert.equal((await prisma.company.findUniqueOrThrow({ where: { id: company.id } })).baseCurrencyCode, 'THB');
  } finally { await prisma.$disconnect(); }
});

test('V1.2 genuine previous-release SGD/NULL history supports only exact original-currency corrections', async () => {
  const prisma = new PrismaService();
  try { await verifyThbUpgrade(prisma, false); } finally { await prisma.$disconnect(); }
});
