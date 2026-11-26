// Narrow preflight: no HTTP, database, full CI or original-Mac rehearsal.
// Asserts the older V1.0-E legacy witness and rollback call sites are FM02-aware.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fm02Tables} from './fm02-schema-contract.mjs';
import {fm02Catalog,verifyFm02Catalog} from './fm02-permission-catalog.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const legacy=read('./legacy-fixture.mjs');
const rehearsal=read('./rehearse-migration.sh');
const migration=read('../../apps/api/prisma/migrations/20261122140000_fm02_weighted_project_progress/migration.sql');
const verifyHistorical=(before,after,enabled)=>assertHistoricalTables(before,after,...Array(13).fill(false),enabled);

test('legacy historical verifier explicitly gates FM02 using the signed migration history',()=>{
  assert.match(legacy,/const fm02Approved=process\.env\.FM02_SCHEMA_UPGRADE==='YES'/);
  assert.match(legacy,/if\(fm02Approved\)assert\.equal\(fm02Migration\.length,1/);
  assert.match(legacy,/20261122140000_fm02_weighted_project_progress/);
  assert.match(legacy,/if\(fm02Migration\.length===1\)verifyFm02Catalog\(fm02Rows\)/);
  assert.match(legacy,/else assert\.equal\(fm02Rows\.length,0/);
  assert.match(legacy,/\.\.\.\(fm02Approved \? fm02Catalog : \[\]\)/);
  // Subsequent releases retain the FM02 rows in the old-row digest when
  // the migration was already part of the previous release.
  assert.match(legacy,/FM02 can already be a legitimate part of a LATER predecessor/);
  assert.match(legacy,/materialUomEffectApproved,materialUomStageCApproved,fm02Approved,successors\.pur07,after\.equipmentPresent\)/);
});

test('legacy audit excludes exactly nullable FM02 progress columns while rejecting any backfill',()=>{
  for(const column of ['completed_quantity','source_budget_revision_line_id','source_uom_id'])
    assert.match(legacy,new RegExp(column));
  assert.match(legacy,/if\(fm02Approved && tablename==='activity_progress'\)/);
  assert.match(legacy,/assert\.deepEqual\(columns\.map\(c=>c\.column_name\)\.sort\(\)/);
  assert.match(legacy,/c\.is_nullable==='YES'&&c\.column_default===null/);
  assert.match(legacy,/WHERE completed_quantity IS NOT NULL OR source_budget_revision_line_id IS NOT NULL OR source_uom_id IS NOT NULL/);
  assert.match(legacy,/excludedColumns=\[\.\.\.excludedColumns,\.\.\.fm02Names\]/);
});

test('FM02 new permissions require exact definitions and never extend historical grants',()=>{
  assert.equal(fm02Catalog.length,2);
  assert.doesNotThrow(()=>verifyFm02Catalog(fm02Catalog.map(p=>({...p}))));
  assert.throws(()=>verifyFm02Catalog(fm02Catalog.slice(0,1)));
  assert.throws(()=>verifyFm02Catalog([...fm02Catalog,{...fm02Catalog[0],id:'00000000-0000-0000-0000-000000000000'}]));
  assert.throws(()=>verifyFm02Catalog(fm02Catalog.map((p,i)=>i===0?{...p,permission_code:'finance.admin'}:p)));
  assert.doesNotMatch(migration,/INSERT\s+INTO\s+"?(role_permissions|user_roles|approval_actions)"?/i);
  for(const row of fm02Catalog)assert.ok(migration.includes(row.id),'Missing exact FM02 permission ID '+row.id);
});

test('FM02 historical comparison only allows two empty new tables; prior rows and grants immutable',()=>{
  const empty={count:'0',digest:createHash('sha256').update('').digest('hex')};
  const previous={companies:{count:'2',digest:'old-company'},activity_progress:{count:'1',digest:'old-progress'},role_permissions:{count:'3',digest:'old-grants'},customer_boq_versions:{...empty}};
  const candidate={...previous,...Object.fromEntries(fm02Tables.map(t=>[t,{...empty}]))};
  assert.deepEqual(fm02Tables,['project_progress_plans','project_progress_plan_lines']);
  assert.doesNotThrow(()=>verifyHistorical(previous,candidate,true));
  assert.throws(()=>verifyHistorical(previous,candidate,false));
  assert.throws(()=>verifyHistorical(previous,{...previous,[fm02Tables[0]]:{...empty}},true));
  assert.throws(()=>verifyHistorical(previous,{...candidate,role_permissions:{count:'4',digest:'changed'}},true));
  assert.throws(()=>verifyHistorical(previous,{...candidate,activity_progress:{count:'1',digest:'changed'}},true));
  assert.throws(()=>verifyHistorical(previous,{...candidate,unapproved_extra:{...empty}},true));
  assert.throws(()=>verifyHistorical(previous,{...candidate,[fm02Tables[0]]:{count:'1',digest:'changed'}},true));
});

test('both rollback legacy and HR witnesses disable FM02 while keeping candidate recognition',()=>{
  assert.match(rehearsal,/export FM02_SCHEMA_UPGRADE=NO/);
  assert.match(rehearsal,/export FM02_SCHEMA_UPGRADE=YES/);
  const rollbackFlags=[...rehearsal.matchAll(/FM02_SCHEMA_UPGRADE=NO MATERIAL_UOM_STAGE_C_SCHEMA_UPGRADE=NO/g)];
  assert.equal(rollbackFlags.length,2,'Both legacy and HR rollback witnesses must disable FM02');
  assert.match(rehearsal,/FM02_SCHEMA_UPGRADE=NO[^\n]*legacy-fixture\.mjs" verify/);
  assert.match(rehearsal,/FM02_SCHEMA_UPGRADE=NO[^\n]*hr-upgrade\.mjs" rollback/);
  execFileSync('bash',['-n',new URL('./rehearse-migration.sh',import.meta.url).pathname]);
});

test('negative contract: out-of-scope FM02 acceptance remains prohibited in old snapshots',()=>{
  assert.match(legacy,/if\(mode==='verify'\)/);
  assert.match(legacy,/if\(fm02Approved && tablename==='activity_progress'\)/);
  assert.match(legacy,/Restored predecessor retains FM02 permissions/);
  assert.match(rehearsal,/20261122140000_fm02_weighted_project_progress/);
});
