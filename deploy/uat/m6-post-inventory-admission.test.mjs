import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projectPostInventoryBaseline} from './m6-post-inventory-admission.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const hash=x=>createHash('sha256').update(String(x)).digest('hex');
function fixture(){
 const roster={STORE_SITE:{userId:id(2)},KHAIMOOK:{userId:id(3)},PORN:{userId:id(4)}},rosterSha256=hash('roster');
 const started={applicationSha:'70013b5139292ef33563447f8937c8f132feabd2',applicationTree:'8152b5ac627325c91c36ed65875791966a1a8874',operatorSha:'b0cdc10c88cce746a240c35fcbbaab95dd30464c',priorOperatorSha:'6cbb39d3647af785551bbee5c967b25c0083b9a4',actorIds:[id(2),id(3),id(4)],rosterSha256,productionAuthorized:false,automaticRetryAllowed:false};
 const receipt={status:'M6_INVENTORY_TERMINAL_BROWSER_PASS',applicationSha:started.applicationSha,operatorSha:started.operatorSha,actors:3,revokedNewSessions:3,priorBatchSessionsPreserved:25,nonAuthTablesPreserved:171,canonicalBusinessAuditRowsAdded:0,additionalLogins:0,removedRateBuckets:0};
 for(const k of ['receivingCanonicalGrVerified','convertedSourceAndStockRendered','partialDestinationCustodyVerified','ss16MakerCheckerControlsVerified','supplierAdvisoryScopeVerified','priorSessionsPreserved','rateBucketLifecycleBounded','auditRowsPreserved','priorHrAuditPreserved','priorSubcontractEvidencePreserved'])receipt[k]=true;
 for(const k of ['jaiCanonicalRolePresent','supplierFullLifecycleBrowserVerified','businessMutationsPerformed','fullAffectedBrowserJourneysVerified','productionAuthorized','milestone6Accepted','secretsPrinted','automaticRetryAllowed'])receipt[k]=false;
 const session=(n,a,created,revokedAt)=>({hash:hash(n),actor:id(a),created,revokedAt,revoked:true});
 const prior=Array.from({length:25},(_,i)=>session(i,i%11+1,'2026-11-28T10:00:00Z','2026-11-28T10:01:00Z'));
 const fresh=[2,3,4].map((a,i)=>session(i+25,a,'2026-11-28T11:00:00Z','2026-11-28T11:01:00Z'));
 const sessionRows=[...prior,...fresh],baseline={user_sessions:prior.slice(0,11).map(s=>s.hash).sort()},current={user_sessions:sessionRows.map(s=>s.hash).sort(),audit_logs:[hash('audit')],stock_transactions:[hash('stock')]};
 return {baseline,current,sessionRows,roster,rosterSha256,receipt,started,prior};
}
test('projects only three consumed inventory sessions; preserves stock and audit for downstream checks',()=>{const a=fixture(),p=projectPostInventoryBaseline(a);assert.equal(p.sessionRows.length,25);assert.deepEqual(p.current.user_sessions,a.prior.map(s=>s.hash).sort());assert.deepEqual(p.current.stock_transactions,a.current.stock_transactions);assert.deepEqual(p.current.audit_logs,a.current.audit_logs);assert.equal(a.current.user_sessions.length,28);});
for(const [name,change] of [['wrong receipt source',a=>a.receipt.operatorSha='wrong'],['wrong started roster',a=>a.started.rosterSha256=hash('other')],['wrong actor',a=>a.started.actorIds[0]=id(9)],['new business mutation',a=>a.receipt.businessMutationsPerformed=true],['overclaimed supplier evidence',a=>a.receipt.supplierFullLifecycleBrowserVerified=true],['missing prior session',a=>a.current.user_sessions.shift()],['duplicate session hash',a=>a.sessionRows[27].hash=a.sessionRows[26].hash],['active session',a=>a.sessionRows[27].revoked=false],['ambiguous chronology',a=>a.sessionRows[27].created='2026-11-28T09:00:00Z'],['overlapping prior session',a=>a.sessionRows[24].revokedAt='2026-11-28T11:00:00Z']])test('rejects '+name,()=>{const a=fixture();change(a);assert.throws(()=>projectPostInventoryBaseline(a),/M6_POST_INVENTORY_/);});
