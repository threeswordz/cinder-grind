// Successor-only protected download evidence. No session issuance, upload or grant changes.
import {createHash} from 'node:crypto';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_HR_DOWNLOAD_'+c),{safeCode:'M6_HR_DOWNLOAD_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const synthetic='CONSTRUCTION_ERP_SYNTHETIC_M6_ENCRYPTED_HR_FILE_PROOF_20261122\n';
export function bindHrDownload(sealed,cd){
 const read=t=>{need(Array.isArray(sealed?.[t]),'SOURCE');return sealed[t].map(r=>{try{return JSON.parse(r.__fm03_exact_row_json);}catch{need(false,'SOURCE');}});};
 const h=cd?.hr,k=cd?.actors?.KOH;need([h?.companyId,h?.attachmentEmployeeId,k?.userId].every(uuid)&&h.attachments?.length===1&&h.attachments[0].version===1&&uuid(h.attachments[0].id),'BINDING');
 const a=read('hr_document_attachments').filter(x=>x.id===h.attachments[0].id),e=read('employees').filter(x=>x.id===h.attachmentEmployeeId&&x.company_id===h.companyId);
 need(a.length===1&&a[0].company_id===h.companyId&&a[0].employee_id===h.attachmentEmployeeId&&a[0].actor_user_id===k.userId&&a[0].version===1&&e.length===1&&typeof e[0].employee_code==='string'&&e[0].employee_code.length>0&&e[0].employee_code.length<=80,'SOURCE_SCOPE');
 const d=read('documents').filter(x=>x.id===a[0].document_id);need(d.length===1&&d[0].company_id===h.companyId&&d[0].file_name==='hr-private.enc'&&d[0].is_active===true&&/^[a-f0-9]{64}$/.test(d[0].checksum??''),'CIPHERTEXT');
 return Object.freeze({companyId:h.companyId,employeeId:h.attachmentEmployeeId,employeeCode:e[0].employee_code,actorId:k.userId,attachmentId:a[0].id,version:1,path:'/hr/companies/'+h.companyId+'/employees/'+h.attachmentEmployeeId+'/documents/'+a[0].id+'/download',expectedName:'synthetic-m6-hr-proof.txt',expectedSize:Buffer.byteLength(synthetic),expectedSha256:hash(synthetic)});
}
export function verifyHrBrowserDownload(binding,{status,headers,name,bytes,requests}){
 const cache=String(headers?.['cache-control']??'').toLowerCase().split(',').map(x=>x.trim());
 need(requests===1&&status===200&&cache.includes('private')&&cache.includes('no-store')&&!cache.includes('public')&&headers['x-content-type-options']?.toLowerCase()==='nosniff'&&headers['content-type']?.split(';')[0].trim().toLowerCase()==='text/plain','HTTP');
 need(name===binding.expectedName&&bytes instanceof Uint8Array&&bytes.length===binding.expectedSize&&hash(bytes)===binding.expectedSha256,'BYTES');
 return {status:'M6_HR_BROWSER_AUTHORIZED_DOWNLOAD_VERIFIED',downloadRequests:1,exactBytesVerified:true,privateHeadersVerified:true,protectedDataPrinted:false,productionAuthorized:false};
}
// Audit snapshots are exact PostgreSQL to_jsonb(t)::text values, not JS-reencoded rows.
function audit(rows){need(Array.isArray(rows)&&rows.length<=10000,'AUDIT_ROWS');const out=new Map();for(const raw of rows){need(typeof raw==='string'&&raw.length<=1048576,'AUDIT_ROW');let r;try{r=JSON.parse(raw);}catch{need(false,'AUDIT_ROW');}need(uuid(r.id)&&!out.has(r.id),'AUDIT_ID');out.set(r.id,{raw,r});}return out;}
const fingerprint=map=>({count:String(map.size),hash:hash([...map.values()].map(x=>hash(x.raw)).sort().join(''))});
export function projectAuthorizedHrDownloadAudit({binding,before,after,beforeAudit,afterAudit,authorization}){
 need(authorization?.database==='m6_successor_rehearsal'&&authorization.ownerAuthorizedHrDownloadAudit===true&&authorization.retainedMutationAuthorized===false&&authorization.productionAuthorized===false,'AUTHORIZATION');
 const a=audit(beforeAudit),b=audit(afterAudit);need(same(fingerprint(a),before?.business?.audit_logs)&&same(fingerprint(b),after?.business?.audit_logs),'AUDIT_FINGERPRINT');
 need(b.size===a.size+1&&[...a].every(([id,row])=>b.get(id)?.raw===row.raw),'AUDIT_HISTORY');
 const [{r}]=[...b].filter(([id])=>!a.has(id)).map(([,row])=>row);const v=r.new_values;
 need(r.entity_type==='HR'&&r.action==='DOCUMENT_DOWNLOAD'&&r.company_id===binding.companyId&&r.entity_id===binding.employeeId&&r.actor_user_id===binding.actorId&&r.old_values===null&&r.correlation_id===null&&v&&Object.keys(v).sort().join(',')==='attachmentId,targetCompanyId,version'&&v.attachmentId===binding.attachmentId&&v.targetCompanyId===binding.companyId&&v.version===binding.version,'AUDIT_SCOPE');
 const at=Date.parse(r.occurred_at);need(Number.isFinite(at)&&/^\d+$/.test(before.clock??'')&&/^\d+$/.test(after.clock??'')&&BigInt(at)*1000n+999n>=BigInt(before.clock)&&BigInt(at)*1000n<=BigInt(after.clock),'AUDIT_TIME');
 // Caller MUST run the existing complete auth-preservation verifier with this
 // projected after-snapshot; every other table and historical session is intact.
 return {...after,business:{...after.business,audit_logs:before.business.audit_logs}};
}
