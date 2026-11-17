import {stripPhysicalSchema} from './subcontract-physical-schema-contract.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { classifySchema } from './schema-contract.mjs';
import { stripTransferSchema, transferTables, transferMode } from './transfer-schema-contract.mjs';
import { transferCatalog, verifyTransferCatalog } from './transfer-catalog-contract.mjs';
import { assertHistoricalTables } from './historical-snapshot.mjs';
const current = stripPhysicalSchema(readFileSync(new URL('../../apps/api/prisma/schema.prisma', import.meta.url), 'utf8')).text;
const previous = execFileSync('git', ['show', 'a8dad66fbcef22079060efe0105225e29260a411:apps/api/prisma/schema.prisma'], { encoding: 'utf8' });
test('DEC-046 exact eight-model transfer contract admits partial receipt provenance without unrelated old-field changes', () => {
  assert.equal(classifySchema(previous, current), 'migration-aware-transfer-schema');
  assert.equal(stripTransferSchema(current).text.replace(/\s+/g,' ').trim(), previous.replace(/\s+/g,' ').trim());
  for (const invalid of [current.replace('model TransferOperation {', 'model OtherOperation {'), current.replace('transferReceiptLineId String?', 'transferReceiptLineId String'), current.replace('@@index([stockTransferItemId, movementType])', '@@unique([stockTransferItemId, movementType])'), current.replace('quantity Decimal @db.Decimal(18,4)', 'quantity Float'), current + '\nmodel Unapproved {\n id String @id\n}']) assert.throws(() => classifySchema(previous, invalid));
  assert.throws(() => classifySchema(current, previous));
  assert.deepEqual(transferMode('migration-aware-transfer-receiving-schema'), { present: true, prior: 'migration-aware-receiving-schema' });
});
test('transfer catalog defines only explicit capabilities and never assigns roles or business effects', () => {
  verifyTransferCatalog(transferCatalog, true);
  assert.throws(() => verifyTransferCatalog(transferCatalog.slice(1), true));
  assert.throws(() => verifyTransferCatalog(transferCatalog.map((p,i) => i ? p : { ...p, module_code: 'FINANCE' }), true));
  const sql = readFileSync(new URL('../../apps/api/prisma/migrations/20261117001000_transfer_dispatch_receipt/migration.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+"?(role_permissions|user_roles|stock_transactions|payments|direct_cost_postings)"?/i);
});
test('historical transfer upgrade accepts only eight empty new tables and exact retained row fingerprints', () => {
  const empty = { count: '0', digest: createHash('sha256').update('').digest('hex') }, before = { customer_boq_versions: empty, stock_transactions: { count: '4', digest: 'immutable-stock-history' } };
  const added = Object.fromEntries(transferTables.map(table => [table, empty]));
  const verify = after => assertHistoricalTables(before, after, false, false, false, false, false, false, false, false, true);
  verify({ ...before, ...added });
  assert.throws(() => verify({ ...before, ...added, stock_transactions: empty }));
  assert.throws(() => verify({ ...before, ...added, transfer_receipts: { count: '1', digest: 'fabricated-physical-receipt' } }));
  delete added.transfer_custody_events; assert.throws(() => verify({ ...before, ...added }));
});
