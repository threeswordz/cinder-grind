// Before/after proof for one bounded metadata-only authenticated readback.
// No database mutations here. Historical audit rows and all non-auth tables
// must match exactly. Auth is restricted to the four expected successful logins.
import {createHash} from 'node:crypto';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_CD_PRESERVE_'+code),{safeCode:'M6_CD_PRESERVE_'+code});};
const sha=x=>createHash('sha256').update(x).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const tableName=/^[a-z_][a-z0-9_]*$/;
const auth=['users','user_sessions','login_rate_limit_buckets'];
const epoch=c=>'(extract(epoch FROM '+c+')*1000000)::numeric(30,0)::text';
const digest=x=>"encode(sha256(convert_to("+x+",'UTF8')),'hex')";
const full=digest('to_jsonb(t)::text');
const clock=x=>typeof x==='string'&&/^\d{1,30}$/.test(x);
const time=(a,b)=>clock(a)&&clock(b)&&BigInt(a)<=BigInt(b);
export async function captureCDPreservation(db){
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const ids=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation,"+epoch('CURRENT_TIMESTAMP')+" AS clock");
  const i=ids[0];need(ids.length===1&&i.db==='proto_a_01'&&i.role==='proto_runtime'&&i.ro==='on'&&i.isolation==='repeatable read'&&clock(i.clock),'DB');
  await requireNoLiveSessions(tx);
  const tables=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(x=>x.tablename);
  need(tables.length>100&&new Set(tables).size===tables.length&&tables.every(t=>tableName.test(t))&&[...auth,'audit_logs','_prisma_migrations'].every(t=>tables.includes(t)),'TABLES');
  const business={};
  for(const t of tables.filter(t=>!auth.includes(t))){
   const rows=await tx.$queryRawUnsafe('SELECT count(*)::text AS count,'+digest("coalesce(string_agg(h,'' ORDER BY h),'')")+' AS hash FROM (SELECT '+full+' AS h FROM public."'+t+'" t) q');
   need(rows.length===1&&/^\d+$/.test(rows[0].count)&&/^[a-f0-9]{64}$/.test(rows[0].hash),'FINGERPRINT');business[t]=rows[0];
  }
  const users=await tx.$queryRawUnsafe("SELECT id::text AS id,"+full+" AS hash,"+digest("(to_jsonb(t)-ARRAY['last_login_at','updated_at']::text[])::text")+" AS stable,"+epoch('last_login_at')+" AS login,"+epoch('updated_at')+" AS updated FROM public.users t ORDER BY id");
  const sessions=await tx.$queryRawUnsafe("SELECT id::text AS id,user_id::text AS actor,"+full+" AS hash,"+epoch('created_at')+" AS created,"+epoch('expires_at')+" AS expires,"+epoch('revoked_at')+" AS revoked FROM public.user_sessions t ORDER BY id");
  const buckets=await tx.$queryRawUnsafe("SELECT client_key AS key,"+full+" AS hash,"+epoch('reset_at')+" AS reset FROM public.login_rate_limit_buckets t ORDER BY client_key");
  need(users.length===9&&sessions.length<=10000&&buckets.length<=10000,'COUNTS');
  return {clock:i.clock,business,users,sessions,buckets};
 },{isolationLevel:'RepeatableRead',timeout:60000});
}
export function compareCDPreservation(before,after,actorIds){
 need(Array.isArray(actorIds)&&actorIds.length===4&&new Set(actorIds).size===4&&time(before.clock,after.clock),'CONTEXT');
 need(same(before.business,after.business),'NONAUTH_DRIFT');
 need(before.users.length===after.users.length&&new Set(before.users.map(x=>x.id)).size===before.users.length&&new Set(after.users.map(x=>x.id)).size===after.users.length,'USERS');
 for(const a of before.users){
  const b=after.users.find(x=>x.id===a.id);need(b&&a.stable===b.stable,'USER_PROJECTION');
  if(actorIds.includes(a.id))need(time(before.clock,b.login)&&time(b.login,after.clock)&&time(a.updated,b.updated)&&time(b.updated,after.clock)&&(!a.login||time(a.login,b.login)),'LOGIN_TIME');
  else need(a.hash===b.hash,'UNEXPECTED_USER_CHANGE');
 }
 need(actorIds.every(id=>before.users.some(u=>u.id===id)),'ACTORS');
 need(new Set(before.sessions.map(s=>s.id)).size===before.sessions.length&&new Set(after.sessions.map(s=>s.id)).size===after.sessions.length,'SESSION_KEYS');
 for(const a of before.sessions)need(after.sessions.some(b=>a.id===b.id&&a.hash===b.hash),'HISTORIC_SESSION_DRIFT');
 const fresh=after.sessions.filter(b=>!before.sessions.some(a=>a.id===b.id));
 need(fresh.length===4&&actorIds.every(id=>fresh.filter(s=>s.actor===id).length===1)&&fresh.every(s=>time(before.clock,s.created)&&time(s.created,s.revoked)&&time(s.revoked,after.clock)&&time(s.created,s.expires)),'SESSION_DELTA');
 // A successful login resets the direct IPv4 loopback bucket and purges
 // expired buckets (up to 100 each). No other bucket may change or appear.
 const local=sha('login:127.0.0.1');
 need(after.buckets.every(b=>b.key!==local&&before.buckets.some(a=>a.key===b.key&&a.hash===b.hash)),'RATE_BUCKET_CHANGE');
 const removed=before.buckets.filter(a=>!after.buckets.some(b=>a.key===b.key));
 need(removed.length<=401&&removed.every(a=>a.key===local||time(a.reset,after.clock)),'RATE_BUCKET_REMOVAL');
 return {nonAuthTablesPreserved:Object.keys(before.business).length,priorSessionsPreserved:true,revokedNewSessions:4,rateBucketLifecycleBounded:true,removedRateBuckets:removed.length,auditRowsPreserved:true};
}
