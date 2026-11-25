import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { assertHistoricalTables } from './historical-snapshot.mjs';

test('historical table hashes stay exact; only all five empty Customer BOQ tables may be added', () => {
  const before = { projects: { count: '2', digest: 'retained hash' }, audit_logs: { count: '1', digest: 'audit hash' } };
  const empty = { count: '0', digest: createHash('sha256').update('').digest('hex') };
  const additions = Object.fromEntries(['customer_boq_versions','customer_boq_edits','customer_boq_lines','customer_boq_mappings','customer_boq_replays'].map((name) => [name, empty]));
  assertHistoricalTables(before, before);
  assertHistoricalTables(before, { ...before, ...additions });
  for (const after of [
    { ...before, customer_boq_versions: empty },
    { ...before, ...additions, unexpected: empty },
    { ...before, ...additions, customer_boq_versions: { ...empty, count: '1' } },
    { ...before, ...additions, customer_boq_lines: { ...empty, digest: 'changed' } },
    { ...before, ...additions, projects: { ...before.projects, digest: 'changed' } },
    { ...additions, projects: before.projects },
  ]) assert.throws(() => assertHistoricalTables(before, after));
});

test('PUR07 allows only a newly verified empty dispatch table and keeps existing dispatch evidence in historical hash',()=>{
 const before={customer_boq_versions:{count:'1',digest:'retained'},purchase_orders:{count:'7',digest:'po'}};
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')};
 const check=(a,b,flag)=>assertHistoricalTables(a,b,...Array(14).fill(false),flag);
 check(before,{...before,po_dispatch_events:empty},true);
 assert.throws(()=>check(before,before,true));
 assert.throws(()=>check(before,{...before,po_dispatch_events:empty},false));
 assert.throws(()=>check(before,{...before,po_dispatch_events:{...empty,count:'1'}},true));
 const existing={...before,po_dispatch_events:{count:'3',digest:'retained events'}};
 check(existing,existing,false);
 assert.throws(()=>check(existing,{...existing,po_dispatch_events:empty},false));
});


test('equipment group is admitted only with its explicit verified increment, with no historical data changes',()=>{
 const old={customer_boq_versions:{count:'1',digest:'retained'},role_permissions:{count:'2',digest:'grants'}};
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')};
 const next={...old,equipment_asset_register_versions:empty,equipment_custody_loans:empty};
 const check=(a,b,flag)=>assertHistoricalTables(a,b,...Array(15).fill(false),flag);
 check(old,next,true);
 assert.throws(()=>check(old,next,false));
 assert.throws(()=>check(old,old,true));
 assert.throws(()=>check(old,{...next,role_permissions:{count:'3',digest:'added grant'}},true));
 assert.throws(()=>check(old,{...next,unrelated:empty},true));
 check(next,next,false);
 assert.throws(()=>check(next,next,true));
});
