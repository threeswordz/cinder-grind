const materialUomStageCApproved=process.env.MATERIAL_UOM_STAGE_C_SCHEMA_UPGRADE==='YES';
import {materialUomCatalog,verifyMaterialUomCatalog} from './material-uom-catalog-contract.mjs';
import {dec054Catalog,verifyDec054MigrationState} from './dec054-permission-catalog.mjs';
const materialUomApproved=process.env.MATERIAL_UOM_SCHEMA_UPGRADE==='YES';
const materialUomEffectApproved=process.env.MATERIAL_UOM_EFFECT_SCHEMA_UPGRADE==='YES';
import {physicalCatalog,verifyPhysicalCatalog} from './subcontract-physical-catalog-contract.mjs';
const physicalApproved=process.env.SUBCONTRACT_PHYSICAL_SCHEMA_UPGRADE==='YES';
import {transferCatalog,verifyTransferCatalog} from './transfer-catalog-contract.mjs';
const transferApproved=process.env.TRANSFER_SCHEMA_UPGRADE==='YES';
import {receivingCatalog,verifyReceivingCatalog} from './receiving-catalog-contract.mjs';
const receivingApproved=process.env.RECEIVING_SCHEMA_UPGRADE==='YES';
import {siteIssueCatalog,verifySiteIssueCatalog} from './site-issue-catalog-contract.mjs';
const siteIssueApproved=process.env.SITE_ISSUE_SCHEMA_UPGRADE==='YES';
import {planIssueCatalog,verifyPlanIssueCatalog} from './material-plan-issue-catalog-contract.mjs';
const planIssueApproved=process.env.MATERIAL_PLAN_ISSUE_SCHEMA_UPGRADE==='YES';
import {materialPlanCatalog,verifyMaterialPlanCatalog} from './material-plan-catalog-contract.mjs';
const materialPlanApproved=process.env.MATERIAL_PLAN_SCHEMA_UPGRADE==='YES';
import {materialRequestCatalog,verifyMaterialRequestCatalog} from './material-request-catalog-contract.mjs';
import {hrCatalog,verifyHrCatalog} from './hr-catalog-contract.mjs';
import {stockCountCatalog,verifyStockCountCatalog} from './stock-count-catalog-contract.mjs';
import { boqCatalog, verifyBoqCatalog } from './boq-catalog-contract.mjs';
import { assertHistoricalTables } from './historical-snapshot.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { seedLegacyCorrections } from './legacy-corrections.mjs';

// Always use the real previous-release client, including after isolated restore.
const [mode, previousRoot, manifestPath, snapshotPath] = process.argv.slice(2);
if (!['early', 'late', 'snapshot', 'verify'].includes(mode) || !previousRoot || !manifestPath) {
  throw new Error('Usage: legacy-fixture.mjs <early|late|snapshot|verify> <previous-root> <manifest.json> [snapshot.json]');
}
const requirePrevious = createRequire(resolve(previousRoot, 'apps/api/package.json'));
const { PrismaClient } = requirePrevious('@prisma/client');
const prisma = new PrismaClient();
const provenanceColumns = ['contract_currency_code', 'currency_code'];
const protect = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
const load = (path) => JSON.parse(readFileSync(path, 'utf8'));

async function snapshot() {
  const tables = await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename`);
  const hashes = {};
  for (const { tablename } of tables) {
    if (!/^[a-z_]+$/.test(tablename)) throw new Error('Unexpected fixture table name');
    // The old and upgraded rows must be byte-for-byte equal after excluding
    // ONLY the new nullable columns, not amounts, labels, states or audit.
    const hrApproved = process.env.HR_SCHEMA_UPGRADE === 'YES';
    const stockCountApproved = process.env.STOCK_COUNT_SCHEMA_UPGRADE === 'YES';
const materialRequestApproved=process.env.MATERIAL_REQUEST_SCHEMA_UPGRADE==='YES';
    const catalogIds = [...boqCatalog,...(hrApproved ? hrCatalog : []),
      ...(stockCountApproved ? stockCountCatalog : []),...(materialRequestApproved ? materialRequestCatalog : []),...(materialPlanApproved ? materialPlanCatalog : []),...(planIssueApproved ? planIssueCatalog : []),...(siteIssueApproved ? siteIssueCatalog : []),...(receivingApproved ? receivingCatalog : []),...(transferApproved ? transferCatalog : []),...(physicalApproved ? physicalCatalog : []),...(materialUomApproved ? materialUomCatalog : []),...dec054Catalog].map(row => row.id);
    if (tablename === 'permissions') {
      if(materialUomApproved)verifyMaterialUomCatalog(await prisma.$queryRawUnsafe('SELECT * FROM permissions WHERE id = ANY($1::uuid[])',materialUomCatalog.map(p=>p.id)));
      if(physicalApproved)verifyPhysicalCatalog(await prisma.$queryRawUnsafe('SELECT * FROM permissions WHERE id = ANY($1::uuid[])',physicalCatalog.map(p=>p.id)));
      if(transferApproved)verifyTransferCatalog(await prisma.$queryRawUnsafe('SELECT * FROM permissions WHERE id = ANY($1::uuid[])',transferCatalog.map(p=>p.id)));
      const additions = await prisma.$queryRawUnsafe('SELECT * FROM permissions WHERE id = ANY($1::uuid[])', catalogIds);
      verifyBoqCatalog(additions.filter(row => boqCatalog.some(x=>x.id===row.id)));
      if(hrApproved) verifyHrCatalog(additions.filter(row=>hrCatalog.some(x=>x.id===row.id)));
      if(stockCountApproved) verifyStockCountCatalog(additions.filter(row=>stockCountCatalog.some(x=>x.id===row.id)));
      if(materialRequestApproved)verifyMaterialRequestCatalog(additions.filter(row=>materialRequestCatalog.some(x=>x.id===row.id)));
      if(materialPlanApproved)verifyMaterialPlanCatalog(additions.filter(row=>materialPlanCatalog.some(x=>x.id===row.id)));
      if(planIssueApproved)verifyPlanIssueCatalog(additions.filter(row=>planIssueCatalog.some(x=>x.id===row.id)));
      if(receivingApproved)verifyReceivingCatalog(additions.filter(row=>receivingCatalog.some(x=>x.id===row.id)));
      if(siteIssueApproved)verifySiteIssueCatalog(additions.filter(row=>siteIssueCatalog.some(x=>x.id===row.id)));
      // DEC-054: the upgraded target alone may add these TWO exact definitions.
      // The pre-upgrade baseline/rollback still hashes every original permission
      // and all historical role_permissions without modification.
      if(mode==='verify'){
        // The same "verify" command also inspects the restored PRE-upgrade
        // rollback database. Bind the rule to authoritative schema migration
        // provenance, not to a user flag or an assumed stage name.
        const migration = await prisma.$queryRawUnsafe(
          "SELECT migration_name FROM \"_prisma_migrations\" WHERE migration_name='20261121170000_dec054_cost_boq_self_approval_permission' AND finished_at IS NOT NULL AND rolled_back_at IS NULL"
        );
        assert.ok(migration.length<=1,'DEC-054 migration history is ambiguous');
        verifyDec054MigrationState(
          additions.filter(row=>dec054Catalog.some(x=>x.id===row.id)),
          migration.length===1,
        );
      }
    }
    if(receivingApproved&&tablename==='goods_receipts'){const cols=await prisma.$queryRawUnsafe("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='goods_receipts' AND column_name='delivery_id'");if(cols.length)assert.equal((await prisma.$queryRawUnsafe('SELECT count(*)::text AS n FROM goods_receipts WHERE delivery_id IS NOT NULL'))[0].n,'0','Historical GR must not acquire fabricated custody');}
    let excludedColumns = tablename === 'goods_receipts' && receivingApproved ? ['delivery_id'] : tablename === 'projects' ? ['contract_currency_code'] :
      ['boqs','supplier_quotations','quotation_awards'].includes(tablename) ? ['currency_code'] :
      (tablename === 'stock_transactions' && stockCountApproved ? ['stock_count_id'] : []);
    if(transferApproved && tablename==='stock_transactions')excludedColumns=[...excludedColumns,'transfer_receipt_line_id'];
    const [row] = await prisma.$queryRawUnsafe(`SELECT count(*)::text AS count,
      encode(sha256(convert_to(coalesce(string_agg((to_jsonb(t) - $1::text[])::text, E'\n' ORDER BY (to_jsonb(t) - $1::text[])::text), ''), 'UTF8')), 'hex') AS digest
      FROM "${tablename}" t ${tablename === 'permissions' ? 'WHERE id <> ALL($2::uuid[])' : ''}`,
      ...(tablename === 'permissions' ? [excludedColumns, catalogIds] : [excludedColumns]));
    hashes[tablename] = row;
  }
  const migrations = await prisma.$queryRawUnsafe(`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`);
  return { tables: hashes, migrations };
}

try {
  if (mode === 'early') {
    // Run on the genuine historical schema BEFORE the existing provenance
    // migration. No trigger disable, migration rewrite or candidate bypass.
    const suffix = randomUUID();
    const company = await prisma.company.create({ data: { companyCode: 'V12-' + suffix, companyName: 'Disposable legacy currency fixture', baseCurrencyCode: 'SGD' } });
    const customer = await prisma.customer.create({ data: { companyId: company.id, customerCode: 'C-' + suffix, customerName: 'Legacy customer' } });
    const supplier = await prisma.supplier.create({ data: { companyId: company.id, supplierCode: 'S-' + suffix, supplierName: 'Legacy supplier' } });
    // Explicit disposable identity is part of the genuine pre-upgrade fixture.
    const employee = await prisma.employee.create({ data: { companyId: company.id, employeeCode: 'LEGACY-MAKER', employeeName: 'Legacy fixture creator' } });
    const user = await prisma.user.create({ data: { companyId: company.id, employeeId: employee.id, email: suffix + '@example.invalid', displayName: 'Legacy fixture creator', passwordHash: 'x' } });
    const project = await prisma.project.create({ data: { companyId: company.id, customerId: customer.id, projectCode: 'P-' + suffix, projectName: 'Legacy unknown source', contractValue: '123456.78', plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2026-12-31') } });
    const boq = await prisma.boq.create({ data: { companyId: company.id, projectId: project.id } });
    // Explicit select avoids referencing columns that do not exist yet.
    const unknownPo = await prisma.purchaseOrder.create({ data: { companyId: company.id, projectId: project.id, supplierId: supplier.id, poNumber: 'LEGACY-NULL-PO', createdByUserId: user.id }, select: { id: true } });
    const unknownBudget = await prisma.budgetRevision.create({ data: { companyId: company.id, projectId: project.id, revisionNo: 1, revisionNumber: 'LEGACY-NULL-BUDGET', createdByUserId: user.id }, select: { id: true } });
    protect(manifestPath, { companyId: company.id, customerId: customer.id, supplierId: supplier.id, userId: user.id, projectId: project.id, boqId: boq.id, unknownPoId: unknownPo.id, unknownBudgetId: unknownBudget.id });
  } else if (mode === 'late') {
    const fixture = load(manifestPath);
    const knownPo = await prisma.purchaseOrder.create({ data: { companyId: fixture.companyId, projectId: fixture.projectId, supplierId: fixture.supplierId, poNumber: 'LEGACY-SGD-PO', createdByUserId: fixture.userId } });
    assert.equal(knownPo.currencyCode, 'SGD');
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: fixture.unknownPoId } })).currencyCode, null);
    assert.equal((await prisma.budgetRevision.findUniqueOrThrow({ where: { id: fixture.unknownBudgetId } })).currencyCode, null);
    const project = await prisma.project.create({ data: { companyId: fixture.companyId, customerId: fixture.customerId, projectCode: 'KNOWN-SGD', projectName: 'Known historical budget', contractValue: '100', plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2026-12-31') } });
    await prisma.boq.create({ data: { companyId: fixture.companyId, projectId: project.id } });
    const budget = await prisma.budgetRevision.create({ data: { companyId: fixture.companyId, projectId: project.id, revisionNo: 1, revisionNumber: 'LEGACY-SGD-BUDGET', createdByUserId: fixture.userId } });
    assert.equal(budget.currencyCode, 'SGD');
    const corrections = await seedLegacyCorrections(prisma, fixture);
    protect(manifestPath, { ...fixture, ...corrections, knownPoId: knownPo.id, knownBudgetId: budget.id });
  } else if (mode === 'snapshot') {
    if (!snapshotPath) throw new Error('Snapshot path required');
    protect(snapshotPath, await snapshot());
  } else {
    const before = load(snapshotPath);
    const after = await snapshot();
    assertHistoricalTables(before.tables, after.tables,
      process.env.HR_SCHEMA_UPGRADE === 'YES', process.env.HR_DOCUMENT_SCHEMA_UPGRADE === 'YES',
      process.env.STOCK_COUNT_SCHEMA_UPGRADE === 'YES', process.env.MATERIAL_REQUEST_SCHEMA_UPGRADE === 'YES',materialPlanApproved,planIssueApproved,siteIssueApproved,receivingApproved,transferApproved,physicalApproved,materialUomApproved,materialUomEffectApproved,materialUomStageCApproved);
    for (const migration of before.migrations) assert.deepEqual(after.migrations.find((row) => row.migration_name === migration.migration_name), migration, 'Historical migration checksum changed');
    const fixture = load(manifestPath);
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: fixture.unknownPoId } })).currencyCode, null);
    assert.equal((await prisma.budgetRevision.findUniqueOrThrow({ where: { id: fixture.unknownBudgetId } })).currencyCode, null);
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: fixture.knownPoId } })).currencyCode, 'SGD');
    // Column checks are possible only on the upgraded candidate. Restored old
    // schema deliberately has no such columns and is checked by the old client.
    const columns = await prisma.$queryRawUnsafe(`SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND ((table_name = 'projects' AND column_name = 'contract_currency_code') OR (table_name IN ('boqs','supplier_quotations','quotation_awards') AND column_name = 'currency_code'))`);
    if (columns.length) {
      assert.equal(columns.length, 4);
      for (const { table_name: table, column_name: column, data_type: dataType,
        character_maximum_length: length, is_nullable: nullable, column_default: defaultValue } of columns) {
        assert.ok(provenanceColumns.includes(column));
        assert.equal(dataType, 'character varying');
        assert.equal(length, 3);
        assert.equal(nullable, 'YES');
        assert.equal(defaultValue, null, 'New provenance must not infer a default for old rows');
        const [result] = await prisma.$queryRawUnsafe(`SELECT count(*)::text AS count FROM "${table}" WHERE "${column}" IS NOT NULL`);
        assert.equal(result.count, '0', 'Legacy monetary provenance must remain unknown');
        const [source] = await prisma.$queryRawUnsafe(`SELECT id FROM "${table}" LIMIT 1`);
        assert.ok(source, 'Genuine previous runtime must create every provenance-root fixture');
        await assert.rejects(prisma.$executeRawUnsafe(`UPDATE "${table}" SET "${column}" = 'THB' WHERE id = $1::uuid`, source.id), /Retained monetary root currency is immutable/);
      }
    }
    console.log('Legacy fixture verified: unchanged source/approval/ledger/audit rows, SGD/NULL identity, migration checksums and immutable unknown provenance.');
  }
} finally {
  await prisma.$disconnect();
}
