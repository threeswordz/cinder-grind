import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {classifySchema} from './schema-contract.mjs';
import {hrTables} from './hr-schema-contract.mjs';
import {stripStockCountSchema} from './stock-count-schema-contract.mjs';
import {hrCatalog,verifyHrCatalog} from './hr-catalog-contract.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';

test('HR schema is exactly seven protected models and eighteen parent additions; earlier modes remain separate',()=>{
  const current=stripStockCountSchema(readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8')).text;
  const previous=execFileSync('git',['show','e86ed846f30ac3feeb09f74ba9084571b9955520:apps/api/prisma/schema.prisma'],{encoding:'utf8'});
  const older=execFileSync('git',['show','fc52a867c96a8b3a369b480b9799bad1a5e9f399:apps/api/prisma/schema.prisma'],{encoding:'utf8'});
  assert.equal(classifySchema(previous,current),'migration-aware-hr-document-hr-schema');
  assert.equal(classifySchema(older,current),'migration-aware-hr-document-hr-customer-boq-schema');
  assert.equal(classifySchema(previous,previous),'migration-aware-sql-only');
  for(const invalid of [
    current.replace('model HrReplay {','model ArbitraryReplay {'),
    current.replace('reasonCode String @map("reason_code") @db.VarChar(40)','reasonCode Json'),
    current.replace('hrEmployment HrEmployment?','hrEmployment HrEmployment[]'),
    current.replace('  @@unique([companyId, id])\n  id           String   @id','  id           String   @id'),
    current.replace('model Employee {','model Employee {\n salary String?'),
    current.replace('contractValue      Decimal','contractValue      Float'),
    current+'\nmodel Unapproved {\n id String @id\n}',
  ])assert.throws(()=>classifySchema(previous,invalid));
  assert.throws(()=>classifySchema(current,previous));
});

test('HR additions require the explicit bounded mode, all seven empty tables and unchanged historical rows',()=>{
  const empty={count:'0',digest:createHash('sha256').update('').digest('hex')};
  const boq=Object.fromEntries(['customer_boq_versions','customer_boq_edits','customer_boq_lines','customer_boq_mappings','customer_boq_replays'].map(name=>[name,empty]));
  const before={employees:{count:'1',digest:'retained-employee'},...boq};
  const additions=Object.fromEntries(hrTables.map(name=>[name,empty]));
  assertHistoricalTables(before,{...before,...additions},true);
  assert.throws(()=>assertHistoricalTables(before,{...before,...additions}));
  for(const after of [{...before}, {...before,...additions,hr_private_revisions:{...empty,count:'1'}},
    {...before,...additions,employees:{count:'1',digest:'changed'}}, {...before,...additions,unexpected:empty}]) {
    assert.throws(()=>assertHistoricalTables(before,after,true));
  }
  const missing={...before,...additions};delete missing.hr_replays;
  assert.throws(()=>assertHistoricalTables(before,missing,true));
});

test('HR catalog is exactly ten capability definitions and creates no role or user assignments',()=>{
  verifyHrCatalog(hrCatalog,true);verifyHrCatalog([]);
  assert.equal(new Set(hrCatalog.map(x=>x.id)).size,10);
  for(const field of ['id','permission_code','module_code','description'])assert.throws(()=>verifyHrCatalog([{...hrCatalog[0],[field]:'unapproved'}]));
  assert.throws(()=>verifyHrCatalog(hrCatalog.slice(1),true));
  const sql=readFileSync(new URL('../../apps/api/prisma/migrations/20261029140000_hr1_a_employee_access/migration.sql',import.meta.url),'utf8').replace(/--[^\n]*/g,'');
  assert.doesNotMatch(sql,/INSERT\s+INTO\s+"?(role_permissions|user_roles|hr_company_access|employees)"?/i);
  for(const row of hrCatalog)for(const key of ['permission_code','description'])assert.ok(sql.includes("'"+row[key]+"'"));
});


test('pre-upgrade rollback uses original-table verification and upgraded HR requires its complete new group',()=>{
  const script=readFileSync(new URL('./rehearse-migration.sh',import.meta.url),'utf8');
  assert.ok(script.includes('HR_SCHEMA_UPGRADE=NO HR_DOCUMENT_SCHEMA_UPGRADE=NO STOCK_COUNT_SCHEMA_UPGRADE=NO DATABASE_URL="$rollback_url" node "$RC_DIR/legacy-fixture.mjs" verify'));
  const original={employees:{count:'1',digest:'original'}};
  assertHistoricalTables(original,original);
  assert.throws(()=>assertHistoricalTables(original,original,true));
});
