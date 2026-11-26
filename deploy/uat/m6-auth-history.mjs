// Compare authentication history against a verified original snapshot; no writes or waivers.
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export const authTables=Object.freeze(['users','user_sessions','login_rate_limit_buckets']);
const hex=/^[a-f0-9]{64}$/;
const validDigest=r=>r&&Number.isSafeInteger(r.rows)&&r.rows>=0&&typeof r.sha256==='string'&&hex.test(r.sha256);
const epoch=c=>`(extract(epoch FROM ${c})*1000000)::numeric(30,0)::text`;
const digest=s=>`encode(sha256(convert_to(${s},'UTF8')),'hex')`;
const fingerprint=t=>`(SELECT jsonb_build_object('table','${t}','rows',count(*),'sha256',${digest("coalesce(string_agg(h,'' ORDER BY h),'')")}) FROM (SELECT ${digest('to_jsonb(t)::text')} AS h FROM public.${t} t) f)`;
const items=(table,columns,extra)=>`(SELECT coalesce(jsonb_agg(jsonb_build_object('id',${digest('t.id::text')},'stable',${digest(`(to_jsonb(t) - ARRAY[${columns.map(x=>`'${x}'`).join(',')}]::text[])::text`)},${extra})), '[]'::jsonb) FROM (SELECT * FROM public.${table} LIMIT 10001) t)`;
export const snapshotSql=`SELECT jsonb_build_object('database',current_database(),'role',current_user,'readOnly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'),'clock',${epoch('CURRENT_TIMESTAMP')},'fingerprints',jsonb_build_array(${authTables.map(fingerprint).join(',')}),'users',${items('users',['last_login_at','updated_at'],`'login',${epoch('t.last_login_at')},'updated',${epoch('t.updated_at')}`)},'sessions',${items('user_sessions',['revoked_at','last_seen_at'],`'revoked',${epoch('t.revoked_at')},'seen',${epoch('t.last_seen_at')},'expires',${epoch('t.expires_at')},'created',${epoch('t.created_at')}`)},'invalidRateBuckets',(SELECT count(*) FROM public.login_rate_limit_buckets WHERE attempt_count<0 OR reset_at<created_at))::text AS payload`;
const time=v=>typeof v==='string'&&/^-?\d{1,30}$/.test(v);
const monotonic=(a,b)=>a===null?(b===null||time(b)):time(b)&&BigInt(b)>=BigInt(a);
function validate(s,db){
  need(s?.database===db&&s.role==='proto_runtime'&&s.readOnly==='on'&&s.isolation==='repeatable read'&&time(s.clock),'M6_AUTH_SNAPSHOT_IDENTITY_INVALID');
  need(Array.isArray(s.fingerprints)&&s.fingerprints.length===3&&authTables.every(t=>s.fingerprints.filter(r=>r.table===t&&validDigest(r)).length===1),'M6_AUTH_SNAPSHOT_FINGERPRINT_INVALID');
  for(const [kind,table] of [['users','users'],['sessions','user_sessions']]){
    const rows=s[kind];need(Array.isArray(rows)&&rows.length<=10000&&rows.length===s.fingerprints.find(r=>r.table===table).rows&&rows.every(r=>hex.test(r?.id??'')&&hex.test(r?.stable??''))&&new Set(rows.map(r=>r.id)).size===rows.length,'M6_AUTH_SNAPSHOT_ROWS_INVALID');
    need(rows.every(r=>kind==='users'?(r.login===null||time(r.login))&&time(r.updated):(r.revoked===null||time(r.revoked))&&(r.seen===null||time(r.seen))&&time(r.expires)&&time(r.created)),'M6_AUTH_SNAPSHOT_TIME_INVALID');
  }
  need(Number.isSafeInteger(s.invalidRateBuckets)&&s.invalidRateBuckets>=0,'M6_AUTH_RATE_BUCKETS_INVALID');return s;
}
const sameDigest=(a,b)=>a?.rows===b?.rows&&a?.sha256===b?.sha256;
export function compareAuthHistory({baseline,original,current,capturedAt}){
  validate(original,'m4_rehearsal_9417f07c');validate(current,'proto_a_01');
  need(Array.isArray(baseline)&&authTables.every(t=>baseline.filter(r=>r.table===t&&validDigest(r)).length===1),'M6_AUTH_BASELINE_INVALID');
  const unmatchedSource=authTables.filter(t=>!sameDigest(baseline.find(r=>r.table===t),original.fingerprints.find(r=>r.table===t)));
  if(unmatchedSource.length)return {status:'M6_AUTH_ORIGINAL_FINGERPRINT_MISMATCH',unmatchedSource,historicalDatabaseRowsVerified:false,mayMutate:false};
  need(typeof capturedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(capturedAt)&&Number.isFinite(Date.parse(capturedAt)), 'M6_AUTH_CAPTURE_TIME_INVALID');
  const captureMicros=BigInt(Date.parse(capturedAt))*1000n;
  need(captureMicros<=BigInt(current.clock),'M6_AUTH_CAPTURE_TIME_INVALID');
  const users=new Map(current.users.map(r=>[r.id,r])),sessions=new Map(current.sessions.map(r=>[r.id,r]));
  const userDifferences=original.users.filter(a=>{const b=users.get(a.id);return !b||a.stable!==b.stable||!monotonic(a.login,b.login)||!monotonic(a.updated,b.updated)||(a.login===b.login&&a.updated!==b.updated)||(b.login!==null&&BigInt(b.login)>BigInt(current.clock));}).length+current.users.filter(b=>!original.users.some(a=>a.id===b.id)).length;
  const sessionDifferences=original.sessions.filter(a=>{const b=sessions.get(a.id);return !b||a.stable!==b.stable||!monotonic(a.seen,b.seen)||(a.revoked!==null&&a.revoked!==b.revoked);}).length;
  const originalIds=new Set(original.sessions.map(r=>r.id));
  const newSessions=current.sessions.filter(r=>!originalIds.has(r.id));
  const invalidNewSessions=newSessions.filter(r=>BigInt(r.created)<captureMicros||BigInt(r.expires)<BigInt(r.created)||(r.revoked!==null&&BigInt(r.revoked)<BigInt(r.created))).length;
  const activeSessions=current.sessions.filter(r=>r.revoked===null&&BigInt(r.expires)>BigInt(current.clock)).length;
  const rateBucketsExact=sameDigest(original.fingerprints.find(r=>r.table==='login_rate_limit_buckets'),current.fingerprints.find(r=>r.table==='login_rate_limit_buckets'));
  return {status:'M6_AUTH_HISTORY_OBSERVED',originalFingerprintsMatched:3,usersOutsideLoginTimestampChanges:userDifferences,historicalSessionsMissingOrChanged:sessionDifferences,newSessions:newSessions.length,invalidNewSessions,activeSessions,rateBucketsExact,invalidRateBuckets:current.invalidRateBuckets,accountAndSessionProjectionMatches:userDifferences===0&&sessionDifferences===0&&invalidNewSessions===0&&activeSessions===0,rateLimitLifecycleRequiresDisposition:!rateBucketsExact,historicalDatabaseRowsVerified:false,mayMutate:false};
}
