import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalSs16RecoveryConstraints as normalize} from './ss16-recovery-constraints.mjs';
const row={name:"movement_correction_requests_source_kind_check",kind:'c',validated:true,no_inherit:false,deferrable:false,deferred:false};
const original="CHECK (((source_kind)::text = ANY ((ARRAY['GOODS_RECEIPT'::character varying, 'MATERIAL_ISSUE'::character varying, 'MATERIAL_RETURN'::character varying, 'STOCK_TRANSFER'::character varying])::text[])))";
const restored="CHECK (((source_kind)::text = ANY (ARRAY[('GOODS_RECEIPT'::character varying)::text, ('MATERIAL_ISSUE'::character varying)::text, ('MATERIAL_RETURN'::character varying)::text, ('STOCK_TRANSFER'::character varying)::text])))";
const unrelated={name:'movement_correction_exact_source_pin',kind:'c',validated:true,no_inherit:false,deferrable:false,deferred:false,definition:'CHECK ((source_id IS NOT NULL))'};
test('only the two PostgreSQL 17.11 source-kind CHECK deparse forms compare equal',()=>{
 const a=[{...row,definition:original},unrelated];
 const b=[{...row,definition:restored},unrelated];
 assert.deepEqual(normalize(a),normalize(b));
 assert.equal(normalize(b)[1],unrelated);
 assert.equal(b[0].definition,restored,'Do not mutate source receipt');
 assert.notDeepEqual(normalize(a),normalize([b[0],{...unrelated,definition:'CHECK (true)'}]));
});
test('missing, duplicate, unvalidated, or changed CHECK fails closed',()=>{
 const good={...row,definition:original};
 for(const bad of [
  original.replace("'GOODS_RECEIPT'","'UNKNOWN'"),
  original.replace(", 'STOCK_TRANSFER'::character varying",""),
  original.replace("'STOCK_TRANSFER'::character varying","'STOCK_TRANSFER'::character varying, 'EXTRA'::character varying"),
  original.replace(' = ANY',' <> ALL'),
  original.replace('source_kind','reason'),
  'CHECK (true)',
  original+' NO INHERIT',
  restored.replace("'STOCK_TRANSFER'","'MATERIAL_RETURN'"),
 ])assert.throws(()=>normalize([{...row,definition:bad}]));
 for(const bad of [{validated:false},{kind:'f'},{no_inherit:true},{deferrable:true},{deferred:true},{name:'other_check'}])
  assert.throws(()=>normalize([{...good,...bad}]));
 assert.throws(()=>normalize([]));
 assert.throws(()=>normalize([good,good]));
});
