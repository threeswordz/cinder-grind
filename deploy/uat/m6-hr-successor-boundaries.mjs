// HR-only successor evidence. Caller supplies independently pinned private
// snapshots, inventories and GET-only authenticated transport. No I/O here.
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_HR_SUCCESSOR_'+code),{safeCode:'M6_HR_SUCCESSOR_'+code});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const hrTables=Object.freeze(['employees','hr_company_access','hr_employments','hr_employment_revisions','hr_private_revisions','hr_people','hr_person_links','hr_document_attachments','hr_replays']);
function rows(snapshot,t){
 const r=snapshot?.[t];need(Array.isArray(r)&&r.length<=10000,'TABLE');
 return r.map(x=>{const raw=x?.__fm03_exact_row_json;need(typeof raw==='string'&&raw.length>0&&raw.length<=1048576,'RAW');let value;try{value=JSON.parse(raw);}catch{need(false,'RAW');}need(value&&typeof value==='object'&&!Array.isArray(value)&&uuid(value.id),'ROW_ID');return {raw,value};});
}
function exact(a,b){need(new Set(a.map(x=>x.value.id)).size===a.length&&new Set(b.map(x=>x.value.id)).size===b.length&&same(a.map(x=>x.raw).sort(),b.map(x=>x.raw).sort()),'PROTECTED_ROW_DRIFT');}
function files(inventory){
 need(Array.isArray(inventory)&&inventory.length>1&&inventory.length<=10000&&same(inventory[0],['','directory']),'INVENTORY');
 const map=new Map();for(const r of inventory){need(Array.isArray(r)&&typeof r[0]==='string'&&!map.has(r[0])&&(r[0]===''||r[0].split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.includes('\\')&&!p.includes('\0')))&&((r.length===2&&r[1]==='directory')||(r.length===3&&Number.isSafeInteger(r[1])&&r[1]>=0&&sha(r[2]))),'INVENTORY');map.set(r[0],r);}
 need([...map.values()].some(r=>r.length===3&&r[1]>0),'INVENTORY_EMPTY');return map;
}
export function verifyHrSuccessorCustody({before,after,oldDocuments,currentDocuments,oldKeys,currentKeys}){
 for(const t of hrTables){const a=rows(before,t),b=rows(after,t);if(['hr_company_access','hr_employment_revisions','hr_private_revisions','hr_document_attachments'].includes(t))need(a.length>0,'EMPTY_COVERAGE');exact(a,b);}
 const attachments=rows(before,'hr_document_attachments').map(x=>x.value);
 const ids=new Set(attachments.map(h=>h.document_id));need(ids.size===attachments.length&&[...ids].every(uuid),'ATTACHMENT_BINDING');
 const docRows=s=>rows(s,'documents').filter(x=>ids.has(x.value.id));
 const linkRows=s=>rows(s,'document_links').filter(x=>ids.has(x.value.document_id)||x.value.entity_type==='HR_ATTACHMENT');
 const docs=docRows(before),links=linkRows(before);exact(docs,docRows(after));exact(links,linkRows(after));
 need(docs.length===attachments.length&&links.length===attachments.length,'CUSTODY_CARDINALITY');
 const original=files(oldDocuments),current=files(currentDocuments),keys=files(oldKeys);files(currentKeys);
 need(same(oldKeys,currentKeys)&&keys.size>1,'KEY_DRIFT');
 const used=new Set();for(const h of attachments){
  const d=docs.find(x=>x.value.id===h.document_id)?.value,l=links.find(x=>x.value.document_id===h.document_id)?.value;
  need(uuid(h.company_id)&&uuid(h.employee_id)&&uuid(h.actor_user_id)&&Number.isSafeInteger(h.version)&&h.version>0&&typeof h.encrypted_metadata==='string'&&h.encrypted_metadata.length>0&&d&&l&&d.company_id===h.company_id&&d.uploaded_by_user_id===h.actor_user_id&&l.linked_by_user_id===h.actor_user_id&&l.entity_type==='HR_ATTACHMENT'&&l.entity_id===h.employee_id,'CUSTODY_SCOPE');
  need(d.is_active===true&&d.file_name==='hr-private.enc'&&d.mime_type==='application/octet-stream'&&d.storage_provider==='LOCAL'&&sha(d.checksum)&&Number.isSafeInteger(d.file_size_bytes)&&d.file_size_bytes>0&&!used.has(d.storage_key),'CIPHERTEXT_METADATA');
  used.add(d.storage_key);const expected=[d.storage_key,d.file_size_bytes,d.checksum];need(same(original.get(d.storage_key),expected)&&same(current.get(d.storage_key),expected),'CIPHERTEXT_DRIFT');
 }
 return {protectedHrTables:hrTables.length,protectedAttachments:attachments.length,encryptedFileChecksumsMatched:true,hrKeyInventoryMatched:true,authorizedPlaintextReadbackRepeated:false,mayMutate:false};
}
// No login, download of authorized HR bytes, POST, arbitrary URL or reveal.
// A known generic document and authenticated Project list are positive controls.
export async function assertHrSuccessorDenials({get,actors,companyId,foreignCompanyId,employeeId,otherEmployeeId,attachmentId,documentId,projectId,controlDocumentId}){
 need(typeof get==='function'&&[companyId,foreignCompanyId,employeeId,otherEmployeeId,attachmentId,documentId,projectId,controlDocumentId].every(uuid)&&companyId!==foreignCompanyId&&employeeId!==otherEmployeeId&&documentId!==controlDocumentId,'BINDING');
 const roles=['KOH','BEN','FOREMAN'];need(roles.every(k=>uuid(actors?.[k]?.userId)&&actors[k].companyId===companyId&&Array.isArray(actors[k].permissions))&&new Set(roles.map(k=>actors[k].userId)).size===3,'ACTORS');
 need(actors.KOH.permissions.includes('hr.documents.view')&&actors.BEN.permissions.includes('documents.document.view')&&!actors.BEN.permissions.includes('hr.documents.view')&&!actors.FOREMAN.permissions.some(p=>['hr.employment.view','hr.identity.view','hr.bank.view','hr.documents.view'].includes(p)),'ROLE_SCOPE');
 for(const k of roles){const r=await get(k,'/auth/me');need(r?.status===200&&r.data?.id===actors[k].userId&&r.data.companyId===companyId&&Array.isArray(r.data.permissions)&&same([...r.data.permissions].sort(),[...actors[k].permissions].sort()),'ACTOR_DRIFT');}
 const base=(c,e)=>'/hr/companies/'+c+'/employees/'+e,docs=base(companyId,employeeId)+'/documents',download=docs+'/'+attachmentId+'/download';
 const history=await get('KOH',docs);need(history?.status===200&&history.data?.nextCursor===null&&Array.isArray(history.data.items)&&history.data.items.some(x=>x.id===attachmentId)&&history.data.items.every(x=>Object.keys(x).length===3&&uuid(x.id)&&Number.isSafeInteger(x.version)&&x.version>0&&typeof x.createdAt==='string'&&Number.isFinite(Date.parse(x.createdAt))),'HR_CONTROL');
 const project='/documents/projects/'+projectId,list=await get('BEN',project);need(list?.status===200&&Array.isArray(list.data)&&list.data.some(x=>x.id===controlDocumentId)&&!list.data.some(x=>x.id===documentId),'GENERIC_CONTROL');
 const deny=async(k,p,statuses=[403,404])=>{const r=await get(k,p);need(statuses.includes(r?.status),'DENIAL');};
 await deny('KOH',base(foreignCompanyId,employeeId)+'/documents');
 await deny('KOH',base(foreignCompanyId,employeeId)+'/documents/'+attachmentId+'/download');
 await deny('KOH',base(companyId,otherEmployeeId)+'/documents/'+attachmentId+'/download');
 for(const k of ['BEN','FOREMAN']){await deny(k,docs);await deny(k,download);}
 for(const p of ['/employment','/private/identity','/private/identity/history','/private/bank','/private/bank/history'])await deny('FOREMAN',base(companyId,otherEmployeeId)+p);
 await deny('BEN',project+'/'+documentId+'/download');
 await deny('BEN',project+'/targets/HR_ATTACHMENT/'+employeeId,[422]);
 await deny('BEN',project+'/targets/HR_ATTACHMENT/'+employeeId+'/'+documentId+'/download',[422]);
 return {status:'M6_HR_SUCCESSOR_DENIAL_ASSERTIONS_PASS',denials:15,positiveControls:2,authenticatedTransportRequired:true,protectedBytesRead:false,mayMutate:false,milestone6Accepted:false,productionAuthorized:false};
}
