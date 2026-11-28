// Preparation only: compare independently read private DB snapshots. No writes,
// database connections, token hashing assumptions or native acceptance here.
import {createHash} from 'node:crypto';
const need=(ok,code)=>{if(!ok)throw Error('M7_PERSISTED_'+code);};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hashText=v=>createHash('sha256').update(v).digest('hex');
const localBucket=hashText('login:127.0.0.1');
export function bindM7Session(userId,cookie,csrf){
  need(uuid(userId)&&/^erp_session=[A-Za-z0-9_-]{20,256}$/.test(cookie??'')&&/^[A-Za-z0-9_-]{20,256}$/.test(csrf??''),'ISSUED_SESSION');
  return Object.freeze({userId,tokenHash:hashText(cookie.slice(12)),csrfTokenHash:hashText(csrf)});
}
// Canonicalize JSON object order but retain array order and value types.
function canonical(v){
  if(v===null||typeof v==='string'||typeof v==='boolean'||Number.isFinite(v))return v;
  if(Array.isArray(v))return v.map(canonical);
  need(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype,'JSON');
  return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));
}
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const timestamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
function indexed(rows){
  need(Array.isArray(rows),'ROWS');const out=new Map();
  for(const r of rows){need(uuid(r?.id)&&!out.has(r.id),'ROW_ID');out.set(r.id,canonical(r));}
  return out;
}
function delta(before,after){
  const a=indexed(before),b=indexed(after);
  for(const [id,row] of a)need(b.has(id)&&equal(row,b.get(id)),'HISTORICAL_DRIFT');
  return [...b].filter(([id])=>!a.has(id)).map(([,r])=>r);
}
function session(r){
  need(Object.keys(r).sort().join(',')==='createdAt,csrfTokenHash,expiresAt,id,lastSeenAt,revokedAt,tokenHash,userId'&&uuid(r.userId)&&digest(r.tokenHash)&&digest(r.csrfTokenHash)&&timestamp(r.createdAt)&&timestamp(r.expiresAt)&&(r.lastSeenAt===null||timestamp(r.lastSeenAt))&&(r.revokedAt===null||timestamp(r.revokedAt)),'SESSION_SHAPE');
}
const auditFields=['companyId','entityType','entityId','action','actorUserId','oldValues','newValues','correlationId'];
function audit(r){
  need(Object.keys(r).sort().join(',')==='action,actorUserId,companyId,correlationId,entityId,entityType,id,newValues,occurredAt,oldValues'&&[r.companyId,r.entityId,r.actorUserId].every(uuid)&&typeof r.entityType==='string'&&r.entityType.length>0&&typeof r.action==='string'&&r.action.length>0&&timestamp(r.occurredAt),'AUDIT_SHAPE');
}
const inWindow=(t,start,end)=>timestamp(t)&&Date.parse(t)>=start&&Date.parse(t)<=end;
function authRows(s){
  const users=indexed(s.users),buckets=new Map();
  for(const r of users.values())need(digest(r.hash)&&digest(r.stable)&&(r.login===null||timestamp(r.login))&&timestamp(r.updated),'USER_SHAPE');
  need(Array.isArray(s.buckets),'BUCKET_ROWS');for(const r of s.buckets){need(digest(r.key)&&digest(r.hash)&&timestamp(r.reset)&&!buckets.has(r.key),'BUCKET_SHAPE');buckets.set(r.key,r);}
  return {users,buckets};
}
function verifyAuth(s,b,a,actors,start,end){
  const old=authRows(s),base=authRows(b),next=authRows(a);
  need(old.users.size===base.users.size&&[...old.users].every(([k,r])=>base.users.has(k)&&equal(r,base.users.get(k)))&&old.buckets.size===base.buckets.size&&[...old.buckets].every(([k,r])=>base.buckets.has(k)&&equal(r,base.buckets.get(k))),'AUTH_BASELINE');
  need(base.users.size===next.users.size&&actors.every(id=>base.users.has(id)),'USER_CENSUS');
  for(const [id,r] of base.users){const n=next.users.get(id);need(n&&r.stable===n.stable,'USER_STABLE');if(actors.includes(id))need(inWindow(n.login,start,end)&&inWindow(n.updated,Math.max(start,Date.parse(r.updated),Date.parse(n.login)),end),'USER_CLOCK');else need(equal(r,n),'USER_DRIFT');}
  need([...next.buckets].every(([k,r])=>k!==localBucket&&base.buckets.has(k)&&equal(base.buckets.get(k),r)),'RATE_BUCKET_DRIFT');
  const removed=[...base.buckets].filter(([k])=>!next.buckets.has(k));need(removed.length<=501&&removed.every(([k,r])=>k===localBucket||Date.parse(r.reset)<=end),'RATE_BUCKET_REMOVAL');
}
function snapshot(s){
  need(s&&Array.isArray(s.sessions)&&Array.isArray(s.audits)&&digest(s.businessRowsSha256)&&digest(s.grantsSha256)&&digest(s.sourceStateSha256),'SNAPSHOT');
  indexed(s.sessions);indexed(s.audits);s.sessions.forEach(session);s.audits.forEach(audit);authRows(s);
  need(new Set(s.sessions.map(r=>r.tokenHash)).size===s.sessions.length,'TOKEN_ALIAS');return structuredClone(s);
}
// Expected token hashes must originate from the real issued cookies through the
// application's exact hashing implementation. Expected audit payloads must come
// from the reviewed route contract, never the after-snapshot being verified.
export function verifyM7PersistedEvidence({source,baseline,after,expectedSessions,expectedAudits,startedAt,finishedAt}){
  const s=snapshot(source),b=snapshot(baseline),a=snapshot(after);
  const start=Date.parse(startedAt),end=Date.parse(finishedAt);
  need(timestamp(startedAt)&&timestamp(finishedAt)&&start<=end,'WINDOW');
  for(const k of ['businessRowsSha256','grantsSha256','sourceStateSha256'])need(s[k]===b[k]&&b[k]===a[k],'PRESERVATION');
  need(delta(s.sessions,b.sessions).length===0&&delta(s.audits,b.audits).length===0,'BASELINE_DRIFT');
  need(b.sessions.every(r=>r.revokedAt!==null||Date.parse(r.expiresAt)<=start),'BASELINE_ACTIVE');
  const sessions=delta(b.sessions,a.sessions),audits=delta(b.audits,a.audits);
  need(Array.isArray(expectedSessions)&&expectedSessions.length===4&&new Set(expectedSessions.map(r=>r.userId)).size===4&&new Set(expectedSessions.map(r=>r.tokenHash)).size===4&&expectedSessions.every(r=>uuid(r.userId)&&digest(r.tokenHash)&&digest(r.csrfTokenHash)),'EXPECTED_SESSIONS');
  verifyAuth(s,b,a,expectedSessions.map(r=>r.userId),start,end);
  need(sessions.length===expectedSessions.length,'SESSION_COUNT');
  for(const e of expectedSessions){const r=sessions.find(x=>x.tokenHash===e.tokenHash);
    need(r&&r.userId===e.userId&&r.csrfTokenHash===e.csrfTokenHash&&inWindow(r.createdAt,start,end)&&inWindow(r.revokedAt,Date.parse(r.createdAt),end)&&Date.parse(r.expiresAt)>Date.parse(r.createdAt),'SESSION_BINDING');}
  need(a.sessions.every(r=>r.revokedAt!==null||Date.parse(r.expiresAt)<=end),'ACTIVE_SESSION');
  need(Array.isArray(expectedAudits)&&expectedAudits.every(r=>r&&Object.keys(r).sort().join(',')===auditFields.slice().sort().join(','))&&audits.length===expectedAudits.length,'AUDIT_COUNT');
  const remaining=audits.slice();for(const e of expectedAudits){const i=remaining.findIndex(r=>inWindow(r.occurredAt,start,end)&&auditFields.every(k=>equal(r[k],e[k])));need(i>=0,'AUDIT_BINDING');remaining.splice(i,1);}
  return Object.freeze({status:'M7_PERSISTED_PREPARATION_CHECK_PASS',historicalSessionsPreserved:b.sessions.length,historicalAuditsPreserved:b.audits.length,newRevokedSessions:sessions.length,newAudits:audits.length,activeSessions:0,sessionCensusSha256:hash(a.sessions.slice().sort((x,y)=>x.id.localeCompare(y.id)).map(canonical)),nativeRecoveryVerified:false,milestone7Accepted:false,productionAuthorized:false});
}
