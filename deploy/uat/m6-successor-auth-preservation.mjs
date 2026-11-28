// Successor-only auth delta: no writes, grants or authority to create sessions.
import {createHash} from 'node:crypto';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_SUCCESSOR_PRESERVE_'+code),{safeCode:'M6_SUCCESSOR_PRESERVE_'+code});};
const digest=x=>"encode(sha256(convert_to("+x+",'UTF8')),'hex')";
const full=digest('to_jsonb(t)::text');
const epoch=c=>'(extract(epoch FROM '+c+')*1000000)::numeric(30,0)::text';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clock=x=>typeof x==='string'&&/^\d{1,30}$/.test(x);
const time=(a,b)=>clock(a)&&clock(b)&&BigInt(a)<=BigInt(b);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(x);
const auth=['users','user_sessions','login_rate_limit_buckets'];
export async function captureSuccessorAuthPreservation(db){
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const ids=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation,"+epoch('CURRENT_TIMESTAMP')+" AS clock");
  const i=ids[0];need(ids.length===1&&i.db==='m6_successor_rehearsal'&&i.role==='proto_runtime'&&i.ro==='on'&&i.isolation==='repeatable read'&&clock(i.clock),'DATABASE');
  await requireNoLiveSessions(tx);
  const tables=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(r=>r.tablename);
  need(tables.length===174&&new Set(tables).size===174&&tables.every(t=>/^[a-z_][a-z0-9_]*$/.test(t))&&[...auth,'audit_logs','_prisma_migrations','movement_correction_requests'].every(t=>tables.includes(t)),'TABLES');
  const business={};
  for(const t of tables.filter(t=>!auth.includes(t))){
   const rows=await tx.$queryRawUnsafe('SELECT count(*)::text AS count,'+digest("coalesce(string_agg(h,'' ORDER BY h),'')")+' AS hash FROM (SELECT '+full+' AS h FROM public."'+t+'" t) q');
   need(rows.length===1&&/^\d+$/.test(rows[0].count)&&hash(rows[0].hash),'FINGERPRINT');business[t]=rows[0];
  }
  const users=await tx.$queryRawUnsafe("SELECT id::text AS id,"+full+" AS hash,"+digest("(to_jsonb(t)-ARRAY['last_login_at','updated_at']::text[])::text")+" AS stable,"+epoch('last_login_at')+" AS login,"+epoch('updated_at')+" AS updated FROM public.users t ORDER BY id");
  const sessions=await tx.$queryRawUnsafe("SELECT id::text AS id,user_id::text AS actor,"+full+" AS hash,"+epoch('created_at')+" AS created,"+epoch('expires_at')+" AS expires,"+epoch('revoked_at')+" AS revoked FROM public.user_sessions t ORDER BY id");
  const buckets=await tx.$queryRawUnsafe("SELECT client_key AS key,"+full+" AS hash,"+epoch('reset_at')+" AS reset FROM public.login_rate_limit_buckets t ORDER BY client_key");
  need(users.length<=100&&sessions.length<=10000&&buckets.length<=10000,'LIMIT');
  return {clock:i.clock,business,users,sessions,buckets};
 },{isolationLevel:'RepeatableRead',timeout:120000});
}
function unique(rows,key,valid){need(Array.isArray(rows)&&rows.every(r=>valid(r?.[key])&&hash(r.hash))&&new Set(rows.map(r=>r[key])).size===rows.length,'ROW_SHAPE');return new Map(rows.map(r=>[r[key],r]));}
export function verifySuccessorAuthPreservation(before,after,{actorIds,allowBoundedRehearsalRateBucketChanges=false}={}){
 need(Array.isArray(actorIds)&&actorIds.length>=1&&actorIds.length<=12&&actorIds.every(uuid)&&new Set(actorIds).size===actorIds.length&&time(before?.clock,after?.clock),'ACTORS');
 need(Object.keys(before.business??{}).length===171&&same(before.business,after.business),'BUSINESS_DRIFT');
 const u=unique(before.users,'id',uuid),v=unique(after.users,'id',uuid),actors=new Set(actorIds);
 need(u.size===v.size&&actorIds.every(id=>u.has(id)),'USER_CENSUS');
 for(const [id,a] of u){const b=v.get(id);need(b&&hash(a.stable)&&a.stable===b.stable,'USER_PROJECTION');
  if(actors.has(id))need(time(before.clock,b.login)&&time(b.login,after.clock)&&time(a.updated,b.updated)&&time(b.updated,after.clock)&&(!a.login||time(a.login,b.login)),'LOGIN_TIME');
  else need(a.hash===b.hash,'UNEXPECTED_USER_CHANGE');}
 const old=unique(before.sessions,'id',uuid),next=unique(after.sessions,'id',uuid);
 for(const [id,a] of old)need(next.get(id)?.hash===a.hash,'HISTORIC_SESSION_DRIFT');
 const fresh=[...next.values()].filter(s=>!old.has(s.id));
 need(fresh.length===actorIds.length&&actorIds.every(id=>fresh.filter(s=>s.actor===id).length===1)&&fresh.every(s=>time(before.clock,s.created)&&time(s.created,s.revoked)&&time(s.revoked,after.clock)&&time(s.created,s.expires)),'SESSION_DELTA');
 const b=unique(before.buckets,'key',hash),a=unique(after.buckets,'key',hash);
 const local=createHash('sha256').update('login:127.0.0.1').digest('hex');
 need([...a].every(([key,row])=>key!==local&&b.get(key)?.hash===row.hash),'RATE_BUCKET_CHANGE');
 const removed=[...b.values()].filter(row=>!a.has(row.key));
 need(removed.length===0||allowBoundedRehearsalRateBucketChanges===true,'RATE_BUCKET_AUTHORIZATION');
 need(removed.length<=actorIds.length*100+1&&removed.every(row=>row.key===local||time(row.reset,after.clock)),'RATE_BUCKET_REMOVAL');
 return {status:'M6_SUCCESSOR_AUTH_PRESERVATION_PASS',nonAuthTablesPreserved:171,priorSessionsPreserved:true,revokedNewSessions:fresh.length,removedRateBuckets:removed.length,rateBucketLifecycleBounded:true,auditRowsPreserved:true,productionAuthorized:false,milestone6Accepted:false};
}
