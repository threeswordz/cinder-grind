import assert from 'node:assert/strict';
import test from 'node:test';
import {dec054Catalog,verifyDec054Catalog,verifyDec054MigrationState} from './dec054-permission-catalog.mjs';

test('DEC-054 two additive permission definitions are accepted, unordered, without grants',()=>{
  assert.doesNotThrow(()=>verifyDec054Catalog([...dec054Catalog].reverse()));
  assert.equal(dec054Catalog.length,2);
  assert.equal(dec054Catalog.every(r=>r.module_code==='BUDGET'),true);
});

test('DEC-054 permission snapshot refuses missing, forged, changed-module and additional catalog rows',()=>{
  for(const rows of [
    dec054Catalog.slice(0,1),
    dec054Catalog.map((x,i)=>i===0?{...x,permission_code:'finance.payment.approve'}:x),
    dec054Catalog.map((x,i)=>i===1?{...x,module_code:'FINANCE'}:x),
    [...dec054Catalog,{...dec054Catalog[0],id:'b0540000-0000-4000-8000-000000000003'}],
    [{id:dec054Catalog[0].id,permission_code:dec054Catalog[0].permission_code,module_code:'BUDGET'},dec054Catalog[0]],
  ])assert.throws(()=>verifyDec054Catalog(rows));
});

test('DEC-054 upgraded vs restored predecessor are distinguished by migration provenance',()=>{
  assert.doesNotThrow(()=>verifyDec054MigrationState(dec054Catalog,true));
  assert.doesNotThrow(()=>verifyDec054MigrationState([],false));
  assert.throws(()=>verifyDec054MigrationState([],true),'upgrade missing catalog must fail');
  assert.throws(()=>verifyDec054MigrationState(dec054Catalog,false),'rollback containing new permissions must fail');
  assert.throws(()=>verifyDec054MigrationState(dec054Catalog,'yes'),'untrusted migration state must fail');
});
