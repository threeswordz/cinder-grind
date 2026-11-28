import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyExactHistoricalRows as verify} from './m6-exact-historical-rows.mjs';
const row=raw=>({...JSON.parse(raw),__fm03_exact_row_json:raw});
const snapshot=(...rows)=>({financial_rows:rows});
const old=row('{"id":"a","amount":9007199254740992.01,"nested":{"amount":0.12345678901234567891},"note":"quote \\" comma, } ["}');
test('permits added columns, new rows and reordered top-level keys without changing old bytes',()=>{
 const next=row('{"note":"quote \\" comma, } [","new_column":null,"nested":{"amount":0.12345678901234567891},"amount":9007199254740992.01,"id":"a"}');
 assert.equal(verify(snapshot(old),{...snapshot(row('{"id":"new","amount":1}'),next),new_table:[]}),true);
});
test('rejects decimal drift that parsed JavaScript numbers conceal',()=>{
 const changed=row(old.__fm03_exact_row_json.replace('9007199254740992.01','9007199254740992.02'));
 assert.equal(old.amount,changed.amount);
 assert.throws(()=>verify(snapshot(old),snapshot(changed)),/M6_EXACT_HISTORICAL_ROW_DRIFT/);
});
test('rejects nested numeric drift even if parsed value is identical',()=>{
 const changed=row(old.__fm03_exact_row_json.replace('0.12345678901234567891','0.12345678901234567892'));
 assert.deepEqual(old.nested,changed.nested);
 assert.throws(()=>verify(snapshot(old),snapshot(changed)),/M6_EXACT_HISTORICAL_ROW_DRIFT/);
});
test('rejects missing historical column or changed timestamp/string',()=>{
 const missing=row('{"id":"a","amount":9007199254740992.01,"nested":{"amount":0.12345678901234567891}}');
 assert.throws(()=>verify(snapshot(old),snapshot(missing)),/M6_EXACT_HISTORICAL_ROW_DRIFT/);
 assert.throws(()=>verify(snapshot(row('{"date":"2026-11-25T01:00:00Z"}')),snapshot(row('{"date":"2026-11-25T01:00:01Z"}'))),/M6_EXACT_HISTORICAL_ROW_DRIFT/);
});
test('requires row multiplicity and rejects removed tables',()=>{
 assert.throws(()=>verify(snapshot(old,old),snapshot(old)),/M6_EXACT_HISTORICAL_ROW_DRIFT/);
 assert.throws(()=>verify(snapshot(old),{}),/M6_EXACT_HISTORICAL_TABLE_MISSING/);
 assert.equal(verify(snapshot(old,old),snapshot(old,old)),true);
});
test('fails closed on missing raw bytes, malformed JSON, or duplicate member keys',()=>{
 assert.throws(()=>verify(snapshot({id:'a'}),snapshot(old)),/M6_EXACT_HISTORICAL_SQL_REQUIRED/);
 assert.throws(()=>verify(snapshot(old),snapshot({__fm03_exact_row_json:'{' })),/M6_EXACT_HISTORICAL_SQL_INVALID/);
 assert.throws(()=>verify(snapshot(old),snapshot(row('{"id":"a","id":"b"}'))),/M6_EXACT_HISTORICAL_SQL_INVALID/);
});
