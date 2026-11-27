import test from 'node:test';
import assert from 'node:assert/strict';
import {hrTables,verifyHrSuccessorCustody,assertHrSuccessorDenials} from './m6-hr-successor-boundaries.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const row=v=>({__fm03_exact_row_json:JSON.stringify(v)});
const value=r=>JSON.parse(r.__fm03_exact_row_json);
const hash='a'.repeat(64), otherHash='b'.repeat(64);
function custody(){
 const before=Object.fromEntries(hrTables.map((t,i)=>[t,[row({id:id(100+i),ciphertext:'synthetic'})]]));
 before.hr_document_attachments=[row({id:id(1),document_id:id(2),company_id:id(3),employee_id:id(4),actor_user_id:id(5),version:1,encrypted_metadata:'synthetic-envelope'})];
 before.documents=[row({id:id(2),company_id:id(3),uploaded_by_user_id:id(5),is_active:true,file_name:'hr-private.enc',mime_type:'application/octet-stream',storage_provider:'LOCAL',storage_key:'hr/file.enc',file_size_bytes:72,checksum:hash})];
 before.document_links=[row({id:id(6),document_id:id(2),linked_by_user_id:id(5),entity_type:'HR_ATTACHMENT',entity_id:id(4)})];
 const oldDocuments=[['','directory'],['hr','directory'],['hr/file.enc',72,hash]],oldKeys=[['','directory'],['synthetic-key',32,otherHash]];
 return {before,after:structuredClone(before),oldDocuments,currentDocuments:structuredClone(oldDocuments),oldKeys,currentKeys:structuredClone(oldKeys)};
}
function edit(f,table,patch,which='after'){f[which][table][0]=row({...value(f[which][table][0]),...patch});}
test('preserves exact HR scope, one canonical ciphertext and original key inventory, allowing unrelated new project docs',()=>{
 const f=custody();f.after.documents.push(row({id:id(200)}));f.after.document_links.push(row({id:id(201),document_id:id(200),entity_type:'PROJECT'}));f.currentDocuments.push(['project.pdf',5,otherHash]);
 assert.deepEqual(verifyHrSuccessorCustody(f),{protectedHrTables:9,protectedAttachments:1,encryptedFileChecksumsMatched:true,hrKeyInventoryMatched:true,authorizedPlaintextReadbackRepeated:false,mayMutate:false});
});
for(const t of hrTables)test('rejects changed protected row: '+t,()=>{const f=custody();edit(f,t,{changed:true});assert.throws(()=>verifyHrSuccessorCustody(f),/PROTECTED_ROW_DRIFT/);});
test('rejects missing tables, empty evidence, duplicate identities and forged HR source links',()=>{
 let f=custody();delete f.after.hr_private_revisions;assert.throws(()=>verifyHrSuccessorCustody(f),/TABLE/);
 f=custody();f.before.hr_company_access=[];f.after.hr_company_access=[];assert.throws(()=>verifyHrSuccessorCustody(f),/EMPTY_COVERAGE/);
 f=custody();f.before.hr_replays.push(f.before.hr_replays[0]);f.after.hr_replays.push(f.after.hr_replays[0]);assert.throws(()=>verifyHrSuccessorCustody(f),/PROTECTED_ROW_DRIFT/);
 f=custody();f.after.document_links.push(row({id:id(202),document_id:id(2),entity_type:'PROJECT'}));assert.throws(()=>verifyHrSuccessorCustody(f),/PROTECTED_ROW_DRIFT/);
 f=custody();f.after.document_links.push(row({id:id(203),document_id:id(204),entity_type:'HR_ATTACHMENT'}));assert.throws(()=>verifyHrSuccessorCustody(f),/PROTECTED_ROW_DRIFT/);
});
test('rejects already-invalid baseline with wrong company, employee, actor or plaintext generic metadata',()=>{
 for(const [t,p] of [['documents',{company_id:id(9)}],['document_links',{entity_id:id(9)}],['document_links',{linked_by_user_id:id(9)}],['documents',{uploaded_by_user_id:id(9)}],['documents',{file_name:'identity.pdf'}],['documents',{mime_type:'text/plain'}]]){const f=custody();edit(f,t,p,'before');edit(f,t,p);assert.throws(()=>verifyHrSuccessorCustody(f),/CUSTODY_SCOPE|CIPHERTEXT_METADATA/);}
});
test('rejects altered ciphertext, missing key, aliased path and empty key inventory',()=>{
 let f=custody();f.currentDocuments[2][2]=otherHash;assert.throws(()=>verifyHrSuccessorCustody(f),/CIPHERTEXT_DRIFT/);
 f=custody();f.currentKeys[1][2]=hash;assert.throws(()=>verifyHrSuccessorCustody(f),/KEY_DRIFT/);
 f=custody();f.currentDocuments.push(['../escape',2,hash]);assert.throws(()=>verifyHrSuccessorCustody(f),/INVENTORY/);
 f=custody();f.oldKeys=[['','directory'],['empty',0,hash]];f.currentKeys=structuredClone(f.oldKeys);assert.throws(()=>verifyHrSuccessorCustody(f),/INVENTORY_EMPTY/);
});
function http(){
 const companyId=id(3),foreignCompanyId=id(30),employeeId=id(4),otherEmployeeId=id(40),attachmentId=id(1),documentId=id(2),projectId=id(50),controlDocumentId=id(60);
 const actors={KOH:{userId:id(5),companyId,permissions:['hr.documents.view']},BEN:{userId:id(7),companyId,permissions:['documents.document.view']},FOREMAN:{userId:id(8),companyId,permissions:['hr.operational.view']}};
 const calls=[],docs='/hr/companies/'+companyId+'/employees/'+employeeId+'/documents',project='/documents/projects/'+projectId;
 const get=async(k,p)=>{calls.push([k,p]);if(p==='/auth/me')return {status:200,data:{...actors[k],id:actors[k].userId}};if(k==='KOH'&&p===docs)return {status:200,data:{items:[{id:attachmentId,version:1,createdAt:'2026-11-22T00:00:00Z'}],nextCursor:null}};if(k==='BEN'&&p===project)return {status:200,data:[{id:controlDocumentId}]};return {status:p.includes('/targets/HR_ATTACHMENT/')?422:404};};
 return {args:{get,actors,companyId,foreignCompanyId,employeeId,otherEmployeeId,attachmentId,documentId,projectId,controlDocumentId},calls,docs,project};
}
test('bound actors, positive controls and all fifteen scoped denials, no authorized HR download',async()=>{
 const f=http(),r=await assertHrSuccessorDenials(f.args);assert.equal(r.denials,15);assert.equal(f.calls.length,20);assert.equal(r.protectedBytesRead,false);assert.ok(!f.calls.some(([k,p])=>k==='KOH'&&p===f.docs+'/'+f.args.attachmentId+'/download'));
});
test('every negative probe must actually deny, not return success, 401 or server error',async()=>{
 const baseline=http();await assertHrSuccessorDenials(baseline.args);for(const [k,p] of baseline.calls.slice(5)){for(const status of [200,401,500]){const f=http(),original=f.args.get;f.args.get=(a,b)=>a===k&&b===p?Promise.resolve({status}):original(a,b);await assert.rejects(assertHrSuccessorDenials(f.args),/DENIAL/);}}
});
test('wrong actor, wrong permission and fake generic control fail closed',async()=>{
 let f=http(),get=f.args.get;f.args.get=async(k,p)=>p==='/auth/me'?{status:200,data:{id:id(999),companyId:f.args.companyId,permissions:[]}}:get(k,p);await assert.rejects(assertHrSuccessorDenials(f.args),/ACTOR_DRIFT/);
 f=http();f.args.actors.BEN.permissions=[];await assert.rejects(assertHrSuccessorDenials(f.args),/ROLE_SCOPE/);assert.equal(f.calls.length,0);
 f=http();get=f.args.get;f.args.get=(k,p)=>p===f.project?Promise.resolve({status:200,data:[{id:f.args.documentId}]}):get(k,p);await assert.rejects(assertHrSuccessorDenials(f.args),/GENERIC_CONTROL/);
});
test('rejects unmasked control and mismatched subjects before claiming denial proof',async()=>{
 let f=http(),get=f.args.get;f.args.get=(k,p)=>p===f.docs?Promise.resolve({status:200,data:{items:[{id:f.args.attachmentId,version:1,createdAt:'2026-11-22T00:00:00Z',fileName:'private'}],nextCursor:null}}):get(k,p);await assert.rejects(assertHrSuccessorDenials(f.args),/HR_CONTROL/);
 f=http();f.args.otherEmployeeId=f.args.employeeId;await assert.rejects(assertHrSuccessorDenials(f.args),/BINDING/);assert.equal(f.calls.length,0);
});
