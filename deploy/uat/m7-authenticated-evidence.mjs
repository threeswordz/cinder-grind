// Preparation: bind actual issued-session digest observations to persisted proof.
import {verifyM7PersistedEvidence} from './m7-persisted-evidence.mjs';
const need=(ok,c)=>{if(!ok)throw Error('M7_AUTH_PROBE_'+c);};
const safe=e=>/^M7_[A-Z0-9_]+$/.test(e?.message??'')?e.message:'M7_AUTH_PROBE_UNEXPECTED';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const sortRows=(rows,k)=>rows.slice().sort((a,b)=>a[k]<b[k]?-1:a[k]>b[k]?1:0).map(canonical);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function checkBaseline(s,b){
  need(['businessRowsSha256','grantsSha256','sourceStateSha256'].every(k=>sha(s?.[k])&&s[k]===b?.[k]),'BASELINE_DIGEST');
  for(const [k,id] of [['sessions','id'],['audits','id'],['users','id'],['buckets','key']])need(Array.isArray(s[k])&&Array.isArray(b[k])&&same(sortRows(s[k],id),sortRows(b[k],id)),'BASELINE_ROWS');
  need(typeof b.clock==='string'&&Number.isFinite(Date.parse(b.clock))&&b.sessions.every(r=>r.revokedAt!==null||Date.parse(r.expiresAt)<=Date.parse(b.clock)),'BASELINE_ACTIVE');
}
export function createM7AuthenticatedEvidenceProbe({sourceSnapshot,expectedAudits,readSnapshot,verifyHttp,actors}){
  need(typeof readSnapshot==='function'&&typeof verifyHttp==='function'&&Array.isArray(expectedAudits),'CONTEXT');
  const ids=Object.values(actors??{}).map(a=>a.id);need(ids.length===4&&new Set(ids).size===4,'ACTORS');
  const source=structuredClone(sourceSnapshot),audits=structuredClone(expectedAudits);let attempted=false;
  return async function runOnce(args){
    need(!attempted,'ALREADY_ATTEMPTED');attempted=true;let http=null,persisted=null,code=null;const sessions=[];
    try{
      const before=await readSnapshot();checkBaseline(source,before);
      http=await verifyHttp({...args,onIssuedSession:d=>{
        need(d&&Object.keys(d).sort().join(',')==='csrfTokenHash,tokenHash,userId'&&ids.includes(d.userId)&&sha(d.tokenHash)&&sha(d.csrfTokenHash)&&!sessions.some(s=>s.userId===d.userId||s.tokenHash===d.tokenHash),'ISSUED_BINDING');sessions.push(structuredClone(d));
      }});
      // Always inspect persisted state after the probe returns, even if HTTP failed.
      const after=await readSnapshot();
      persisted=verifyM7PersistedEvidence({source,baseline:before,after,expectedSessions:sessions,expectedAudits:audits,startedAt:before.clock,finishedAt:after.clock});
      need(http?.status==='M7_VERIFICATION_PREPARATION_CHECK_PASS'&&http.sessionsRevoked===true&&http.preservationMatched===true,'HTTP');
      need(persisted.status==='M7_PERSISTED_PREPARATION_CHECK_PASS'&&persisted.activeSessions===0,'PERSISTED');
    }catch(e){code=safe(e);}
    finally{sessions.length=0;}
    return Object.freeze({status:code?'M7_AUTHENTICATED_EVIDENCE_BLOCKED':'M7_AUTHENTICATED_EVIDENCE_PASS',code,httpCode:/^M7_VERIFY_[A-Z_]+$/.test(http?.code??'')?http.code:null,sessionProof:!code?{newRevokedSessions:persisted.newRevokedSessions,newAudits:persisted.newAudits,activeSessions:persisted.activeSessions}:null,nativeRecoveryVerified:false,milestone7Accepted:false,productionAuthorized:false});
  };
}
