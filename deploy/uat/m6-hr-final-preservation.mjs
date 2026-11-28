import {verifyExactHistoricalRows} from './m6-exact-historical-rows.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
// The new journey uploads one document; it must not change HR identity or history.
const unchanged=['employees','hr_company_access','hr_employments','hr_employment_revisions','hr_private_revisions','hr_people','hr_person_links'];
const appendOnly=['hr_document_attachments','hr_replays','documents','document_links'];
export const hrFinalTables=Object.freeze([...unchanged,...appendOnly]);
export function verifyM6HrFinalPreservation(before,after,attachmentId,storageKey){
  need(typeof attachmentId==='string'&&attachmentId.length>0&&typeof storageKey==='string'&&storageKey.length>0,'M6_HR_FINAL_ATTACHMENT_BINDING_REQUIRED');
  const subset={};
  for(const table of hrFinalTables){
    need(Array.isArray(before?.[table])&&Array.isArray(after?.[table]),'M6_HR_FINAL_TABLE_REQUIRED');
    subset[table]=before[table];
    if(unchanged.includes(table))need(after[table].length===before[table].length,'M6_HR_FINAL_UNEXPECTED_IDENTITY_DELTA');
  }
  verifyExactHistoricalRows(subset,after);
  // No HR/Document schema addition in the pinned migration set. Require full
  // historical SQL bytes, not merely projection onto the old columns.
  for(const table of hrFinalTables){
    const available=new Map();
    for(const r of after[table]){const raw=r.__fm03_exact_row_json;need(typeof raw==='string','M6_HR_FINAL_EXACT_SQL_REQUIRED');available.set(raw,(available.get(raw)??0)+1);}
    for(const r of before[table]){const raw=r.__fm03_exact_row_json;need(typeof raw==='string'&&(available.get(raw)??0)>0,'M6_HR_FINAL_HISTORICAL_ROW_DRIFT');available.set(raw,available.get(raw)-1);}
  }
  const decode=r=>JSON.parse(r.__fm03_exact_row_json);
  const prior=before.hr_document_attachments.map(decode),current=after.hr_document_attachments.map(decode);
  need(new Set(prior.map(r=>r.id)).size===prior.length&&new Set(current.map(r=>r.id)).size===current.length,'M6_HR_FINAL_DUPLICATE_ATTACHMENT');
  const ids=new Set(prior.map(r=>r.id)),added=current.filter(r=>!ids.has(r.id));
  need(added.length===1&&added[0].id===attachmentId,'M6_HR_FINAL_UNEXPECTED_ATTACHMENT_DELTA');
  const matching=after.documents.map(decode).filter(d=>d.id===added[0].document_id&&d.storage_key===storageKey&&d.company_id===added[0].company_id);
  need(matching.length===1&&!before.documents.map(decode).some(d=>d.id===matching[0].id||d.storage_key===storageKey),'M6_HR_FINAL_DOCUMENT_BINDING_INVALID');
  return {historicalHrRowsPreserved:true,oneNewHrAttachmentVerified:true};
}
