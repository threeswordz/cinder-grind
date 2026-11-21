import {stripMaterialUomStageCSchema} from './material-uom-stage-c-schema-contract.mjs';
import {stripMaterialUomEffectSchema} from './material-uom-effect-schema-contract.mjs';
import {stripMaterialUomSchema} from './material-uom-schema-contract.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { classifySchema } from './schema-contract.mjs';
import { physicalMigrations, physicalMode, physicalTables, stripPhysicalSchema } from './subcontract-physical-schema-contract.mjs';
import { physicalCatalog, verifyPhysicalCatalog } from './subcontract-physical-catalog-contract.mjs';
import { assertHistoricalTables } from './historical-snapshot.mjs';
const current = stripMaterialUomSchema(stripMaterialUomEffectSchema(stripMaterialUomStageCSchema(readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8')).text).text).text;
const previous = execFileSync('git', ['show', '97db9151b1059e5f134529deb25b78fc714fa683:apps/api/prisma/schema.prisma'], { encoding: 'utf8' });

test('DEC-048 admits exactly six additive facts and preserves all prior canonical models', () => {
  assert.equal(classifySchema(previous, current), 'migration-aware-subcontract-physical-schema');
  assert.equal(stripPhysicalSchema(current).text.replace(/\s+/g, ' ').trim(), previous.replace(/\s+/g, ' ').trim());
  assert.deepEqual(physicalMode('migration-aware-subcontract-physical-transfer-schema'), { present: true, prior: 'migration-aware-transfer-schema' });
  for (const bad of [current.replace('model SubcontractPhysicalDecision {', 'model OtherDecision {'),
    current.replace('observations Json', 'observations String'), current.replace('assessedAmount Decimal @map("assessed_amount")', 'assessedAmount Float @map("assessed_amount")'),
    current + '\nmodel Unapproved {\n id String @id\n}', current.replace('originalValue   Decimal', 'originalValue   Float')]) {
    if (bad !== current) assert.throws(() => classifySchema(previous, bad));
  }
  assert.throws(() => classifySchema(current, previous));
});
test('physical catalog is exact, capability-only, and owns every forward migration identity', () => {
  verifyPhysicalCatalog(physicalCatalog, true);
  assert.throws(() => verifyPhysicalCatalog(physicalCatalog.slice(1), true));
  assert.throws(() => verifyPhysicalCatalog(physicalCatalog.map((p, i) => i ? p : { ...p, module_code: 'FINANCE' }), true));
  const names = readdirSync(new URL('../../apps/api/prisma/migrations/', import.meta.url)).filter(n => n.includes('_subcontract_physical_'));
  assert.deepEqual(names.sort(), [...physicalMigrations].sort());
  const sql = physicalMigrations.map(name => readFileSync(new URL('../../apps/api/prisma/migrations/' + name + '/migration.sql', import.meta.url), 'utf8')).join('\n');
  for (const row of physicalCatalog) for (const value of Object.values(row)) assert.ok(sql.includes(value));
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+"?(role_permissions|user_roles|stock_transactions|payments|direct_cost_postings)"?/i);
});
test('physical upgrade permits only empty new facts and exact retained row fingerprints', () => {
  const empty = { count: '0', digest: createHash('sha256').update('').digest('hex') };
  const before = { customer_boq_versions: empty, subcontract_claims: { count: '4', digest: 'original' }, role_permissions: { count: '20', digest: 'retained' } };
  const added = Object.fromEntries(physicalTables.map(name => [name, empty]));
  const verify = after => assertHistoricalTables(before, after, false, false, false, false, false, false, false, false, false, true);
  verify({ ...before, ...added });
  assert.throws(() => verify({ ...before, ...added, subcontract_claims: empty }));
  assert.throws(() => verify({ ...before, ...added, role_permissions: empty }));
  assert.throws(() => verify({ ...before, ...added, subcontract_physical_claims: { count: '1', digest: 'fabricated' } }));
  delete added.subcontract_physical_operations; assert.throws(() => verify({ ...before, ...added }));
});
