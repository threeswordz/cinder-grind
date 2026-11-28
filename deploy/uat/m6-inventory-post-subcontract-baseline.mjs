// Read-only projection of already consumed subcontract session authority.
import {projectPostHrBaseline} from './m6-subcontract-browser-proof.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_INVENTORY_BASELINE_'+c),{safeCode:'M6_INVENTORY_BASELINE_'+c});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const time=x=>typeof x==='string'?Date.parse(x):NaN;
export function projectPostSubcontractBaseline({baseline,current,auditRows,sessionRows,actorIds,koh,hrReceipt,subcontractReceipt,subcontractActorIds}){
 const r=subcontractReceipt;need(r?.status==='M6_SUBCONTRACT_TERMINAL_BROWSER_PASS'&&r.actors===2&&r.physicalAcceptedHeldVerified===true&&r.approvedCertificationVerified===true&&r.financeReferenceUiVerified===true&&r.benCertificationHidden===true&&r.businessMutationsPerformed===false&&r.canonicalBusinessAuditRowsAdded===0&&r.nonAuthTablesPreserved===171&&r.auditRowsPreserved===true&&r.priorHrAuditPreserved===true&&r.priorSessionsPreserved===true&&r.priorBatchSessionsPreserved===23&&r.revokedNewSessions===2&&r.productionAuthorized===false&&r.automaticRetryAllowed===false,'RECEIPT');
 need(Array.isArray(subcontractActorIds)&&subcontractActorIds.length===2&&new Set(subcontractActorIds).size===2&&subcontractActorIds.every(id=>actorIds.includes(id)&&id!==koh.actorId),'ACTORS');
 const old=new Set(baseline.user_sessions);need(old.size===baseline.user_sessions.length&&sessionRows.length===current.user_sessions.length&&same(sessionRows.map(s=>s.hash).sort(),current.user_sessions)&&new Set(current.user_sessions).size===current.user_sessions.length&&[...old].every(h=>current.user_sessions.includes(h)),'HISTORY');
 const fresh=sessionRows.filter(s=>!old.has(s.hash));need(fresh.length===14&&fresh.every(s=>s.revoked===true&&Number.isFinite(time(s.created))&&Number.isFinite(time(s.revokedAt))&&time(s.created)<=time(s.revokedAt))&&actorIds.every(id=>fresh.filter(s=>s.actor===id).length===(subcontractActorIds.includes(id)||id===koh.actorId?2:1)),'SESSION_DELTA');
 const newest=subcontractActorIds.map(id=>fresh.filter(s=>s.actor===id).sort((a,b)=>time(b.created)-time(a.created))[0]);const removed=new Set(newest.map(s=>s.hash)),earlier=sessionRows.filter(s=>!removed.has(s.hash));
 need(removed.size===2&&earlier.filter(s=>!old.has(s.hash)).every(s=>s.revoked===true&&Number.isFinite(time(s.revokedAt))&&time(s.revokedAt)<Math.min(...newest.map(s=>time(s.created)))),'SESSION_CHRONOLOGY');
 const projected={...current,user_sessions:current.user_sessions.filter(h=>!removed.has(h))};
 return projectPostHrBaseline({baseline,current:projected,auditRows,sessionRows:earlier,actorIds,koh,receipt:hrReceipt});
}
