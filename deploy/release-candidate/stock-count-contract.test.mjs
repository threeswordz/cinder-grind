import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { classifySchema } from './schema-contract.mjs';
import { stockCountCatalog, verifyStockCountCatalog } from './stock-count-catalog-contract.mjs';
import { stripStockCountSchema } from './stock-count-schema-contract.mjs';

test('OP-STOCK-COUNT-01 classifier admits exactly one model and ten parent/source additions', () => {
  const current = readFileSync(new URL('../../apps/api/prisma/schema.prisma', import.meta.url), 'utf8');
  const previous = execFileSync('git', ['show',
    'cb6abf378e903aa5c5a60be3a3d3db54e8c430d3:apps/api/prisma/schema.prisma'], { encoding: 'utf8' });
  assert.equal(classifySchema(previous, current), 'migration-aware-stock-count-thb-schema');
  assert.equal(stripStockCountSchema(current).present, true);
  for (const invalid of [
    current.replace('varianceQuantity         Decimal', 'varianceQuantity         Float'),
    current.replace('stockCounts         StockCount[]', ''),
    current.replace('stockCountId          String?   @unique', 'stockCountId          String?'),
    current.replace('stockCount          StockCount?          @relation', 'stockCount          StockCount[]         @relation'),
    current + '\nmodel UnreviewedStockThing {\n id String @id\n}',
  ]) assert.throws(() => classifySchema(previous, invalid));
  assert.throws(() => classifySchema(current, previous));
});

test('stock-count catalog is exactly five definitions and migration creates no retained role grants', () => {
  verifyStockCountCatalog(stockCountCatalog, true);
  assert.equal(new Set(stockCountCatalog.map(row => row.id)).size, 5);
  const sql = readFileSync(new URL(
    '../../apps/api/prisma/migrations/20261031163000_op_stock_count_01/migration.sql',
    import.meta.url,
  ), 'utf8').replace(/--[^\n]*/g, '');
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+"?(role_permissions|user_roles)"?/i);
  for (const row of stockCountCatalog) {
    for (const key of ['id','permission_code','description']) assert.ok(sql.includes(row[key]));
  }
});
