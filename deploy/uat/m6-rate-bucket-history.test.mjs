import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compareHistoricalRateBuckets,rateSnapshotSql} from './m6-rate-bucket-history.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const start=BigInt(Date.parse('2026-11-26T00:00:00Z'))*1000n;
const time=n=>String(start+BigInt(n)*1000000n);
const local=sha('login:127.0.0.1');
const row=(key,reset=60)=>({key,hash:sha(key+'-row'),attempts:1,created:time(-50),updated:time(-10),reset:time(reset)});
function snapshot(database,rows,clock=100){return {database,role:'proto_runtime',readOnly:'on',isolation:'repeatable read',clock:time(clock),fingerprint:{table:'login_rate_limit_buckets',rows:rows.length,sha256:sha(rows.map(r=>r.hash).sort().join(''))},rows};}
function fixture(){
 const rows=[row(local,200),row(sha('expired'),10),row(sha('active'),200)];
 const original=snapshot('m4_rehearsal_9417f07c',rows),current=snapshot('proto_a_01',[rows[2]]);
 return {baseline:[original.fingerprint],original,current,capturedAt:'2026-11-26T00:00:00Z'};
}
test('recognize exact local reset and expired removal without claiming historical acceptance',()=>{
 const result=compareHistoricalRateBuckets(fixture());
 assert.equal(result.status,'M6_HISTORICAL_RATE_BUCKET_DELTA_BOUNDED');
 assert.equal(result.localReset,1);assert.equal(result.expiredRemoved,1);assert.equal(result.unchanged,1);assert.equal(result.causationProven,false);assert.equal(result.historicalBaselineVerified,false);assert.equal(result.mayMutate,false);
});
test('active foreign bucket removal blocked',()=>{
 const f=fixture();f.current=snapshot('proto_a_01',[]);
 const result=compareHistoricalRateBuckets(f);assert.equal(result.lifecycleConsistent,false);assert.equal(result.unexplainedRemoved,1);
});
test('new and modified buckets are not silently accepted',()=>{
 const f=fixture();f.current=snapshot('proto_a_01',[{...f.original.rows[2],hash:sha('modified')},row(sha('new'))]);
 const result=compareHistoricalRateBuckets(f);assert.equal(result.lifecycleConsistent,false);assert.equal(result.changed,1);assert.equal(result.added,1);
});
test('historical fingerprint must equal original capture',()=>{
 const f=fixture();f.baseline=[{...f.baseline[0],sha256:'0'.repeat(64)}];
 assert.throws(()=>compareHistoricalRateBuckets(f),/ORIGINAL_BASELINE_MISMATCH/);
});
test('reject missing rows, duplicates and altered fingerprint',()=>{
 const f=fixture();f.current.rows=[];assert.throws(()=>compareHistoricalRateBuckets(f),/ROW_CENSUS/);
 f.current=snapshot('proto_a_01',[f.original.rows[2],f.original.rows[2]]);assert.throws(()=>compareHistoricalRateBuckets(f),/ROW_CENSUS/);
 f.current=snapshot('proto_a_01',[f.original.rows[2]]);f.current.fingerprint.sha256='0'.repeat(64);assert.throws(()=>compareHistoricalRateBuckets(f),/ROW_FINGERPRINT/);
});
test('reject invalid database identity, times and attempts',()=>{
 const f=fixture();f.current.readOnly='off';assert.throws(()=>compareHistoricalRateBuckets(f),/SNAPSHOT_IDENTITY/);
 f.current=snapshot('proto_a_01',[{...f.original.rows[2],updated:time(200)}]);assert.throws(()=>compareHistoricalRateBuckets(f),/ROW_STRUCTURE/);
 f.current=snapshot('proto_a_01',[{...f.original.rows[2],attempts:-1}]);assert.throws(()=>compareHistoricalRateBuckets(f),/ROW_STRUCTURE/);
});
test('reject future original update and future capture',()=>{
 const f=fixture();f.original=snapshot('m4_rehearsal_9417f07c',[{...f.original.rows[0],updated:time(1)},...f.original.rows.slice(1)]);
 f.baseline=[f.original.fingerprint];assert.throws(()=>compareHistoricalRateBuckets(f),/CAPTURE_TIME/);
});
test('snapshot SQL is limited to rate bucket source and fingerprint',()=>{
 assert.ok(rateSnapshotSql.includes('public.login_rate_limit_buckets'));assert.ok(rateSnapshotSql.includes('to_jsonb(t)::text'));
 assert.ok(!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i.test(rateSnapshotSql));
 assert.ok(!rateSnapshotSql.includes('user_sessions')&&!rateSnapshotSql.includes('public.users'));
});
