// Event294: the already-created dispatch and its links/audits are history,
// not additions. The native census must still prove every historical row.
import {validateRecoveredDispatch} from './m6-residual-recovery-authority.mjs';
import {verifyResidualNativeAppendDelta} from './m6-residual-native-evidence.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RECOVERY_SOURCE_DELTA_'+c),{safeCode:'M6_RECOVERY_SOURCE_DELTA_'+c});};
export function verifyRecoverySupplierSourceDelta({before,evidence,plan,expectedFiles,addedEvents,authorization,recoveredDispatch,recoveredDispatchId}){
 const d=validateRecoveredDispatch(plan,authorization,recoveredDispatch);
 need(d.id===recoveredDispatchId&&expectedFiles.length===5&&addedEvents.length===2&&expectedFiles.filter(x=>x.id===d.id&&x.key==='dispatch'&&x.entityId===d.entityId&&x.sha256===d.sha256&&x.size===d.size).length===1,'BINDING');
 need(new Set(expectedFiles.map(x=>x.id)).size===5&&new Set(expectedFiles.map(x=>x.key)).size===5&&plan.uploads.every(spec=>expectedFiles.filter(x=>x.projectId===plan.projectId&&['key','actorUserId','entityType','entityId','sha256','size'].every(k=>x[k]===spec[k])).length===1),'FILE_SET');
 const dispatch=addedEvents.find(x=>x.kind==='DISPATCH'),ack=addedEvents.find(x=>x.kind==='ACKNOWLEDGMENT');need(dispatch?.evidenceDocumentId===d.id&&dispatch.acknowledgesEventId===null&&ack?.evidenceDocumentId===expectedFiles.find(x=>x.key==='ack').id&&ack.acknowledgesEventId===dispatch.id,'DISPATCH_CHAIN');
 const oldDoc=evidence.documents.filter(x=>x.id===d.id);need(oldDoc.length===1&&oldDoc[0].storageKey===d.storageKey&&oldDoc[0].checksum===d.sha256&&oldDoc[0].fileSizeBytes===d.size&&oldDoc[0].links.length===2,'ADOPTED_DOCUMENT');
 const linkIds=oldDoc[0].links.map(x=>x.id);need(new Set(linkIds).size===2,'LINKS');
 const auditIds=evidence.auditRows.filter(x=>x.action==='CREATE'&&((x.entityType==='DOCUMENT'&&x.entityId===d.id)||(x.entityType==='DOCUMENT_LINK'&&linkIds.includes(x.entityId)))).map(x=>x.id);
 need(auditIds.length===3&&new Set(auditIds).size===3&&[d.id,...linkIds].every(id=>evidence.auditRows.filter(x=>auditIds.includes(x.id)&&x.entityId===id&&x.entityType===(id===d.id?'DOCUMENT':'DOCUMENT_LINK')).length===1),'AUDITS');
 const historical={documents:[d.id],document_links:linkIds,audit_logs:auditIds};
 const addedRows=Object.fromEntries(Object.entries(evidence.addedRows).map(([t,rows])=>{
  const ids=historical[t]??[],old=rows.filter(r=>ids.includes(r.id));
  need(old.length===ids.length&&ids.every(id=>old.filter(r=>r.id===id).length===1)&&old.every(r=>before[t].includes(r.hash)),'HISTORICAL_ROW');
  return [t,rows.filter(r=>!ids.includes(r.id))];
 }));
 return verifyResidualNativeAppendDelta({before,evidence:{...evidence,addedRows},expected:{documents:4,document_links:8,po_dispatch_events:2,audit_logs:14}});
}
