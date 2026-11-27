// Project the consumed inventory batch for the existing post-subcontract verifier.
// Read-only; no role/session changes, no replay, no release authority.
const OP='b0cdc10c88cce746a240c35fcbbaab95dd30464c';
const APP='70013b5139292ef33563447f8937c8f132feabd2';
const TREE='8152b5ac627325c91c36ed65875791966a1a8874';
const PREV='6cbb39d3647af785551bbee5c967b25c0083b9a4';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_POST_INVENTORY_'+c),{safeCode:'M6_POST_INVENTORY_'+c});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
export function projectPostInventoryBaseline({baseline,current,sessionRows,roster,rosterSha256,receipt,started}){
 const actors=['STORE_SITE','KHAIMOOK','PORN'].map(k=>roster?.[k]?.userId).sort();
 need(actors.every(uuid)&&new Set(actors).size===3&&hex(rosterSha256),'ACTORS');
 need(started?.applicationSha===APP&&started.applicationTree===TREE&&started.operatorSha===OP&&started.priorOperatorSha===PREV&&started.rosterSha256===rosterSha256&&same(started.actorIds,actors)&&started.productionAuthorized===false&&started.automaticRetryAllowed===false,'STARTED');
 const r=receipt;
 need(r?.status==='M6_INVENTORY_TERMINAL_BROWSER_PASS'&&r.applicationSha===APP&&r.operatorSha===OP&&r.actors===3&&r.revokedNewSessions===3&&r.priorBatchSessionsPreserved===25&&r.nonAuthTablesPreserved===171&&r.canonicalBusinessAuditRowsAdded===0&&r.additionalLogins===0&&r.removedRateBuckets===0,'RECEIPT');
 for(const k of ['receivingCanonicalGrVerified','convertedSourceAndStockRendered','partialDestinationCustodyVerified','ss16MakerCheckerControlsVerified','supplierAdvisoryScopeVerified','priorSessionsPreserved','rateBucketLifecycleBounded','auditRowsPreserved','priorHrAuditPreserved','priorSubcontractEvidencePreserved'])need(r[k]===true,'RECEIPT_'+k.toUpperCase());
 for(const k of ['jaiCanonicalRolePresent','supplierFullLifecycleBrowserVerified','businessMutationsPerformed','fullAffectedBrowserJourneysVerified','productionAuthorized','milestone6Accepted','secretsPrinted','automaticRetryAllowed'])need(r[k]===false,'RECEIPT_'+k.toUpperCase());
 // batch-ready.json lacks the two final stdout-only preservation flags; caller must recheck retained custody.
 const old=baseline?.user_sessions,now=current?.user_sessions;
 need(Array.isArray(old)&&Array.isArray(now)&&Array.isArray(sessionRows)&&old.every(hex)&&new Set(old).size===old.length&&now.length===28&&sessionRows.length===28&&new Set(now).size===28&&now.every(hex)&&old.every(h=>now.includes(h)),'SESSION_CENSUS');
 need(same(sessionRows.map(s=>s.hash).sort(),[...now].sort())&&sessionRows.every(s=>uuid(s.actor)&&s.revoked===true&&Number.isFinite(Date.parse(s.created))&&Number.isFinite(Date.parse(s.revokedAt))&&Date.parse(s.created)<=Date.parse(s.revokedAt)),'SESSION_ROWS');
 const oldSet=new Set(old),fresh=sessionRows.filter(s=>!oldSet.has(s.hash));
 const newest=actors.map(a=>fresh.filter(s=>s.actor===a).sort((x,y)=>Date.parse(y.created)-Date.parse(x.created))[0]);
 need(newest.every(Boolean)&&new Set(newest.map(s=>s.hash)).size===3,'SESSION_ACTORS');
 const removed=new Set(newest.map(s=>s.hash)),earlier=sessionRows.filter(s=>!removed.has(s.hash));
 need(earlier.length===25&&earlier.every(s=>Date.parse(s.revokedAt)<Math.min(...newest.map(x=>Date.parse(x.created)))),'SESSION_CHRONOLOGY');
 return {current:{...current,user_sessions:now.filter(h=>!removed.has(h))},sessionRows:earlier};
}
