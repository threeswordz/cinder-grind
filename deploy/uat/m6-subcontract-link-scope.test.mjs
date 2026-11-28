import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyM6SubcontractRetention} from './m6-subcontract-retention.mjs';
const tables=['subcontractors','subcontract_agreements','subcontract_agreement_versions','subcontract_work_orders','subcontract_claims','subcontract_claim_lines','subcontract_claim_assessments','subcontract_certifications','subcontract_action_replays','subcontract_physical_policies','subcontract_physical_claims','subcontract_physical_revisions','subcontract_physical_submissions','subcontract_physical_decisions','subcontract_physical_operations','retention_ledger_entries'];
const row=x=>({__fm03_exact_row_json:JSON.stringify(x)});
const hash='a'.repeat(64);
function fixture(){
 const before=Object.fromEntries(tables.map(t=>[t,[row({id:'claim-1'})]]));
 before.documents=[row({id:'doc-1',storage_key:'old.pdf',file_size_bytes:42,checksum:hash}),row({id:'other-doc',storage_key:'other.pdf',file_size_bytes:10,checksum:hash})];
 before.document_links=[row({id:'link-1',document_id:'doc-1',entity_type:'SUBCONTRACT_CLAIM',entity_id:'claim-1'})];
 const files=[['old.pdf',42,hash],['other.pdf',10,hash]];
 return {before,after:structuredClone(before),files,next:structuredClone(files)};
}
const verify=f=>verifyM6SubcontractRetention(f.before,f.after,f.files,f.next);
test('refuses new link from a previously unrelated document to a historical claim',()=>{
 const f=fixture();
 f.after.document_links.push(row({id:'new-link',document_id:'other-doc',entity_type:'SUBCONTRACT_CLAIM',entity_id:'claim-1'}));
 assert.throws(()=>verify(f),{message:'M6_PA_HISTORICAL_ROW_DRIFT'});
});
test('refuses new document and link to a historical claim',()=>{
 const f=fixture();
 f.after.documents.push(row({id:'new-doc',storage_key:'new.pdf',file_size_bytes:10,checksum:hash}));
 f.next.push(['new.pdf',10,hash]);
 f.after.document_links.push(row({id:'new-link',document_id:'new-doc',entity_type:'SUBCONTRACT_CLAIM',entity_id:'claim-1'}));
 assert.throws(()=>verify(f),{message:'M6_PA_HISTORICAL_ROW_DRIFT'});
});
test('permits wholly unrelated new HR attachment and link',()=>{
 const f=fixture();
 f.after.documents.push(row({id:'hr-doc',storage_key:'hr.enc',file_size_bytes:10,checksum:hash}));
 f.next.push(['hr.enc',10,hash]);
 f.after.document_links.push(row({id:'hr-link',document_id:'hr-doc',entity_type:'HR_ATTACHMENT',entity_id:'employee-1'}));
 assert.equal(verify(f).protectedEvidenceMetadataAndBytesPreserved,true);
});
