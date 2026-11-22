// Exact FM02 preserved-rehearsal regression: pure contract, no DB, no Mac.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fm02Tables} from './fm02-schema-contract.mjs';
import {fm02Catalog,verifyFm02Catalog} from './fm02-permission-catalog.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';

const source=readFileSync(new URL('./hr-upgrade.mjs',import.meta.url),'utf8');
test('HR upgrade verifier explicitly recognizes only reviewed FM02 schema additions',()=>{
  assert.match(source,/process\.env\.FM02_SCHEMA_UPGRADE==='YES'/);
  assert.match(source,/\.\.\.\(fm02Approved \? fm02Catalog : \[\]\)/);
  assert.match(source,/activity_progress:\['completed_quantity','source_budget_revision_line_id','source_uom_id'\]/);
  assert.match(source,/if\(fm02Approved&&mode==='verify'\)verifyFm02Catalog/);
  assert.match(source,/assert\.deepEqual\(\[\.\.\.added\]\.sort\(\),\['completed_quantity','source_budget_revision_line_id','source_uom_id'\]\.sort\(\)/);
  assert.match(source,/WHERE completed_quantity IS NOT NULL OR source_budget_revision_line_id IS NOT NULL OR source_uom_id IS NOT NULL/);
  assert.match(source,/materialUomStageCApproved,fm02Approved,/);
  assert.match(source,/if\(name==='activity_progress'&&fm02Approved&&mode==='verify'\)/);
});

test('FM02 permission catalogue excludes only exact new definitions, never grants',()=>{
  assert.equal(fm02Catalog.length,2);
  const migration=readFileSync(new URL('../../apps/api/prisma/migrations/20261122140000_fm02_weighted_project_progress/migration.sql',import.meta.url),'utf8');
  for(const row of fm02Catalog)for(const value of Object.values(row))assert.ok(migration.includes(value));
  assert.doesNotMatch(migration,/INSERT\s+INTO\s+"?(role_permissions|user_roles|approval_actions)"?/i);
  assert.doesNotThrow(()=>verifyFm02Catalog(fm02Catalog.map(p=>({...p}))));
  assert.throws(()=>verifyFm02Catalog(fm02Catalog.slice(1)));
  assert.throws(()=>verifyFm02Catalog(fm02Catalog.map((p,i)=>i?{...p,description:'changed'}:p)));
  assert.throws(()=>verifyFm02Catalog(fm02Catalog.map((p,i)=>i?{...p,module_code:'FINANCE'}:p)));
});

test('FM02 upgrade requires both empty tables and exact preserved historical row/grant digests',()=>{
  const empty={count:'0',digest:createHash('sha256').update('').digest('hex')};
  const previous={companies:{count:'1',digest:'before-company'},role_permissions:{count:'2',digest:'before-grants'},activity_progress:{count:'1',digest:'before-progress'},customer_boq_versions:{...empty}};
  const candidate={...previous,...Object.fromEntries(fm02Tables.map(name=>[name,{...empty}]))};
  const verify=after=>assertHistoricalTables(previous,after,...Array(13).fill(false),true);
  assert.doesNotThrow(()=>verify(candidate));
  assert.throws(()=>verify({...candidate,role_permissions:{count:'3',digest:'changed'}}));
  assert.throws(()=>verify({...candidate,activity_progress:{count:'1',digest:'changed'}}));
  assert.throws(()=>verify({...candidate,[fm02Tables[0]]:{count:'1',digest:'changed'}}));
  assert.throws(()=>verify({...previous,[fm02Tables[0]]:{...empty}}));
});
