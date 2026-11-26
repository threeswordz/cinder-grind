import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyM6HrFinalPreservation as verify,hrFinalTables} from './m6-hr-final-preservation.mjs';
const row=v=>({...v,__fm03_exact_row_json:JSON.stringify(v)});
function fixture(){
 const before=Object.fromEntries(hrFinalTables.map(t=>[t,[row({id:t+'-old'})]]));
 before.hr_document_attachments=[row({id:'old-attachment',document_id:'old-doc',encrypted_metadata:'old-envelope'})];
 before.documents=[row({id:'old-doc',storage_key:'old.bin',company_id:'company-a',checksum:'old-checksum'})];
 const after=structuredClone(before);
 after.hr_document_attachments.push(row({id:'new-attachment',document_id:'new-doc',company_id:'company-a'}));
 after.documents.push(row({id:'new-doc',storage_key:'new.bin',company_id:'company-a'}));
 after.hr_replays.push(row({id:'new-replay'}));
 return {before,after,run:()=>verify(before,after,'new-attachment','new.bin')};
}
test('allows exactly one newly bound HR attachment with historical rows preserved',()=>{assert.deepEqual(fixture().run(),{historicalHrRowsPreserved:true,oneNewHrAttachmentVerified:true});});
for(const table of ['hr_private_revisions','hr_employment_revisions','hr_company_access','hr_document_attachments','documents','document_links','hr_replays'])test('rejects historical mutation in '+table,()=>{const f=fixture();f.after[table][0]=row({...JSON.parse(f.after[table][0].__fm03_exact_row_json),changed:'unexpected'});assert.throws(f.run,/M6_HR_FINAL_HISTORICAL_ROW_DRIFT/);});
test('rejects extra HR identity and extra attachment',()=>{let f=fixture();f.after.hr_people.push(row({id:'extra-person'}));assert.throws(f.run,/M6_HR_FINAL_UNEXPECTED_IDENTITY_DELTA/);f=fixture();f.after.hr_document_attachments.push(row({id:'extra-attachment'}));assert.throws(f.run,/M6_HR_FINAL_UNEXPECTED_ATTACHMENT_DELTA/);});
test('rejects mismatched company or reused historical document',()=>{let f=fixture();f.after.documents[1]=row({id:'new-doc',storage_key:'new.bin',company_id:'company-b'});assert.throws(f.run,/M6_HR_FINAL_DOCUMENT_BINDING_INVALID/);f=fixture();f.after.hr_document_attachments[1]=row({id:'new-attachment',document_id:'old-doc',company_id:'company-a'});assert.throws(()=>verify(f.before,f.after,'new-attachment','old.bin'),/M6_HR_FINAL_DOCUMENT_BINDING_INVALID/);});
test('rejects missing source table and duplicate attachment identity',()=>{let f=fixture();delete f.before.hr_people;assert.throws(f.run,/M6_HR_FINAL_TABLE_REQUIRED/);f=fixture();f.after.hr_document_attachments.push(f.after.hr_document_attachments[0]);assert.throws(f.run,/M6_HR_FINAL_DUPLICATE_ATTACHMENT/);});
