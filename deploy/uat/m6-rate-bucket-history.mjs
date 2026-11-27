// Narrow historical login-rate-limit disposition. No changes to authentication
// policy, no database writes and no blanket exemption for mutable auth rows.
import {createHash} from 'node:crypto';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_RATE_'+code),{safeCode:'M6_RATE_'+code});};
const hex=/^[a-f0-9]{64}$/;
const micros=x=>typeof x==='string'&&/^\d{1,30}$/.test(x);
const digest=x=>"encode(sha256(convert_to("+x+",'UTF8')),'hex')";
const epoch=c=>'(extract(epoch FROM '+c+')*1000000)::numeric(30,0)::text';
const rowHash=digest('to_jsonb(t)::text');
export const rateSnapshotSql=`SELECT jsonb_build_object(
 'database',current_database(),'role',current_user,'readOnly',current_setting('transaction_read_only'),
 'isolation',current_setting('transaction_isolation'),'clock',${epoch('CURRENT_TIMESTAMP')},
 'fingerprint',(SELECT jsonb_build_object('table','login_rate_limit_buckets','rows',count(*),'sha256',${digest("coalesce(string_agg(h,'' ORDER BY h),'')")}) FROM (SELECT ${rowHash} AS h FROM public.login_rate_limit_buckets t) f),
 'rows',(SELECT coalesce(jsonb_agg(jsonb_build_object('key',client_key,'hash',${rowHash},'attempts',attempt_count,'reset',${epoch('reset_at')},'created',${epoch('created_at')},'updated',${epoch('updated_at')}) ORDER BY client_key),'[]'::jsonb) FROM (SELECT * FROM public.login_rate_limit_buckets LIMIT 10001) t)
 )::text AS payload`;
function validate(s,db){
 need(s?.database===db&&s.role==='proto_runtime'&&s.readOnly==='on'&&s.isolation==='repeatable read'&&micros(s.clock),'SNAPSHOT_IDENTITY');
 need(s.fingerprint?.table==='login_rate_limit_buckets'&&Number.isSafeInteger(s.fingerprint.rows)&&s.fingerprint.rows>=0&&hex.test(s.fingerprint.sha256??''),'FINGERPRINT');
 need(Array.isArray(s.rows)&&s.rows.length===s.fingerprint.rows&&s.rows.length<=10000&&new Set(s.rows.map(r=>r.key)).size===s.rows.length,'ROW_CENSUS');
 need(s.rows.every(r=>typeof r.key==='string'&&hex.test(r.key)&&hex.test(r.hash??'')&&Number.isSafeInteger(r.attempts)&&r.attempts>=0&&[r.created,r.updated,r.reset].every(micros)&&BigInt(r.created)<=BigInt(r.updated)&&BigInt(r.created)<=BigInt(r.reset)&&BigInt(r.updated)<=BigInt(s.clock)),'ROW_STRUCTURE');
 const aggregate=createHash('sha256').update(s.rows.map(r=>r.hash).sort().join('')).digest('hex');
 need(aggregate===s.fingerprint.sha256,'ROW_FINGERPRINT');
}
export function compareHistoricalRateBuckets({baseline,original,current,capturedAt}){
 validate(original,'m4_rehearsal_9417f07c');validate(current,'proto_a_01');
 const entries=Array.isArray(baseline)?baseline.filter(r=>r.table==='login_rate_limit_buckets'):[];
 need(entries.length===1&&entries[0].rows===original.fingerprint.rows&&entries[0].sha256===original.fingerprint.sha256,'ORIGINAL_BASELINE_MISMATCH');
 need(typeof capturedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(capturedAt)&&Number.isFinite(Date.parse(capturedAt)),'CAPTURE_TIME');
 const captured=BigInt(Date.parse(capturedAt))*1000n;
 need(captured<=BigInt(current.clock)&&captured<=BigInt(original.clock)&&original.rows.every(r=>BigInt(r.updated)<=captured),'CAPTURE_TIME');
 const local=createHash('sha256').update('login:127.0.0.1').digest('hex');
 const old=new Map(original.rows.map(r=>[r.key,r])),now=new Map(current.rows.map(r=>[r.key,r]));
 let unchanged=0,localReset=0,expiredRemoved=0,unexplainedRemoved=0,changed=0,added=0;
 for(const a of original.rows){
  const b=now.get(a.key);
  if(b){if(a.hash===b.hash)unchanged++;else changed++;continue;}
  if(a.key===local)localReset++;
  else if(BigInt(a.reset)<=BigInt(current.clock))expiredRemoved++;
  else unexplainedRemoved++;
 }
 for(const b of current.rows)if(!old.has(b.key))added++;
 const lifecycleConsistent=unexplainedRemoved===0&&changed===0&&added===0;
 return {status:lifecycleConsistent?'M6_HISTORICAL_RATE_BUCKET_DELTA_BOUNDED':'M6_HISTORICAL_RATE_BUCKET_DELTA_UNEXPLAINED',originalBaselineMatched:true,originalCount:original.rows.length,currentCount:current.rows.length,unchanged,localReset,expiredRemoved,unexplainedRemoved,changed,added,lifecycleConsistent,
 // Consistency alone does not establish who caused a deletion or authorize
 // acceptance of a non-identical historical fingerprint.
 causationProven:false,historicalBaselineVerified:false,mayMutate:false,productionAuthorized:false};
}
