// Read-only recovery contract for the actual Event292 committed prefix. Never replays a phase.
import {createHash} from 'node:crypto';
import {syntheticResidualPdf} from './m6-residual-executable-contract.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RECOVERY_'+c),{safeCode:'M6_RECOVERY_'+c});};
const hash=x=>createHash('sha256').update(x).digest('hex'),digest=x=>hash(JSON.stringify(x));
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
export const applicationSha='70013b5139292ef33563447f8937c8f132feabd2', failedOperatorSha='a67eb73e7c1a144e31b6e6735d7ffa8d510f0181';
export const committedPrefix=Object.freeze(['roles','sessions','fixtures','ss08','fm02']);
const ss08={status:'M6_SS08_TERMINAL_READBACK_VERIFIED',workDimensionsBound:true,boqLineageBound:true,signedEvidenceBytesVerified:true,stockHistoryBound:true,issueReversed:false,humanUatCompleted:false,canonicalApiVerified:true,foreignProjectDenied:true,browserVerified:false,productionAuthorized:false,automaticRetryAllowed:false};
const fm02={status:'M6_FM02_TERMINAL_READBACK_VERIFIED',weightedPercent:'40.00',planSourceBound:true,quantitySourceBound:true,milestoneSourceBound:true,humanUatCompleted:false,independentConfirmationVerified:true,missingSourceBlocked:true,staleMeasurementDenied:true,foreignProjectDenied:true,canonicalApiVerified:true,browserVerified:false,productionAuthorized:false,automaticRetryAllowed:false};
export function verifyFailedAttemptChain({attempt,started,committed,blocked,ready}){
 need(attempt?.applicationSha===applicationSha&&attempt.operatorSha===failedOperatorSha&&attempt.discoverySha==='840477f8c18665953ed3285635adc81f5091fadb'&&attempt.database==='m6_successor_rehearsal'&&hex(attempt.planSha256)&&hex(attempt.baselineSha256)&&attempt.productionAuthorized===false&&attempt.automaticRetryAllowed===false&&ready===false,'ATTEMPT');
 const keys=Object.keys(attempt),bound=r=>r&&keys.every(k=>r[k]===attempt[k]);
 need(same(Object.keys(started).sort(),[...committedPrefix,'supplier'].sort())&&same(Object.keys(committed).sort(),[...committedPrefix].sort()),'PREFIX');
 let prior=null;for(const p of committedPrefix){const a=started[p],b=committed[p];need(bound(a)&&bound(b)&&a.phase===p&&b.phase===p&&a.previous===prior&&b.previous===prior&&hex(b.proofSha256),'CHAIN');prior=b.proofSha256;}
 need(committed.ss08.proofSha256===digest(ss08)&&committed.fm02.proofSha256===digest(fm02),'TERMINAL_PROOFS');
 need(bound(started.supplier)&&started.supplier.phase==='supplier'&&started.supplier.previous===prior&&bound(blocked)&&blocked.phase==='supplier'&&same(blocked.completed,committedPrefix)&&blocked.safeCode==='M6_RUNTIME_CLEANUP'&&blocked.mayHaveMutated===true,'BLOCKED');
 return {committedPhases:[...committedPrefix],ss08ProofHashVerified:true,fm02ProofHashVerified:true,supplierUncommitted:true,attemptSha256:digest(attempt),blockedSha256:digest(blocked)};
}
const labels={receipt:'M6 SS08 SIGNED RECEIPT REHEARSAL',dispatch:'M6 SUPPLIER DISPATCH REHEARSAL',ack:'M6 SUPPLIER ACK REHEARSAL',transit:'M6 SUPPLIER TRANSIT REHEARSAL',delay:'M6 SUPPLIER DELAY AND CLAIM CORRESPONDENCE REHEARSAL',handover:'M6 SUPPLIER HANDOVER REHEARSAL'};
export function expectedRecoveryArtifacts(){return Object.fromEntries(Object.entries(labels).map(([key,label])=>{const bytes=syntheticResidualPdf(label);return [key,{sha256:hash(bytes),size:bytes.length}];}));}
export function identifyRecoveredArtifacts({recovery,current,documents,fixture,actorIds}){
 need(Array.isArray(recovery)&&Array.isArray(current)&&Array.isArray(documents)&&documents.length===2&&uuid(fixture?.companyId)&&uuid(fixture.projectId)&&uuid(actorIds?.JAI)&&uuid(actorIds.STORE_SITE),'FILES');
 const old=new Map(recovery.map(r=>[r[0],r])),now=new Map(current.map(r=>[r[0],r]));need(old.size===recovery.length&&now.size===current.length&&current.length===recovery.length+2&&[...old].every(([k,v])=>same(v,now.get(k))),'HISTORY');
 const expected=expectedRecoveryArtifacts(),result={};for(const d of documents){const file=now.get(d.storageKey);const key=Object.keys(expected).find(k=>expected[k].sha256===d.checksum&&expected[k].size===d.fileSizeBytes);need(['receipt','dispatch'].includes(key)&&!result[key]&&uuid(d.id)&&uuid(d.storageKey)&&!old.has(d.storageKey)&&same(file,[d.storageKey,d.fileSizeBytes,d.checksum])&&d.companyId===fixture.companyId&&d.isActive===true&&d.storageProvider==='LOCAL'&&d.uploadedByUserId===actorIds[key==='receipt'?'STORE_SITE':'JAI']&&d.links.length===2&&d.links.every(l=>l.documentId===d.id&&l.linkedByUserId===d.uploadedByUserId)&&d.links.some(l=>l.entityType==='PROJECT'&&l.entityId===fixture.projectId),'DOCUMENT');const target=d.links.find(l=>l.entityType===(key==='receipt'?'MATERIAL_REQUEST':'PURCHASE_ORDER'));need(uuid(target?.entityId),'TARGET');result[key]={id:d.id,entityId:target.entityId,storageKey:d.storageKey,sha256:d.checksum,size:d.fileSizeBytes};}
 need(result.receipt&&result.dispatch&&result.receipt.id!==result.dispatch.id,'ARTIFACT_SET');return result;
}
// Public output is a fixed vocabulary and numeric HTTP statuses only. No URL, payload, identity or raw log.
export function summarizeRecoveryLog(log){
 need(typeof log==='string'&&Buffer.byteLength(log)<=16777216,'LOG');const events=[],auth={login201:0,logout204:0,me401:0};
 for(const line of log.split('\n')){const i=line.indexOf('{"timestamp"');if(i<0)continue;let e;try{e=JSON.parse(line.slice(i,line.lastIndexOf('}')+1));}catch{continue;}if(typeof e.path!=='string'||!Number.isInteger(e.status)||e.status<100||e.status>599)continue;const p=e.path,m=e.method;if(p==='/api/v1/auth/login'&&m==='POST'&&e.status===201)auth.login201++;if(p==='/api/v1/auth/logout'&&m==='POST'&&e.status===204)auth.logout204++;if(p==='/api/v1/auth/me'&&m==='GET'&&e.status===401)auth.me401++;let route=null;if(/^\/api\/v1\/procurement\/purchase-orders\/[^/]+\/dispatch-events$/.test(p)&&['GET','POST'].includes(m))route='PUR07_'+m;else if(/^\/api\/v1\/documents\/projects\/[^/]+\/targets\/(PURCHASE_ORDER|RECEIVING_DELIVERY)\/[^/]+$/.test(p)&&m==='POST')route='SUPPLIER_UPLOAD';else if(/^\/api\/v1\/documents\/projects\/[^/]+\/targets\/(PURCHASE_ORDER|RECEIVING_DELIVERY)\/[^/]+\/[^/]+\/download$/.test(p)&&m==='GET')route='SUPPLIER_DOWNLOAD';else if(/^\/api\/v1\/procurement\/purchase-orders\/[^/]+\/supplier-case(?:\/events)?$/.test(p)&&['GET','POST'].includes(m))route='SUPPLIER_CASE_'+m;if(route)events.push({route,status:e.status});}
 need(events.length<=100,'LOG_BOUND');return {auth,supplierHttp:events};
}
