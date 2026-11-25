import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyM6SubcontractRetention } from './m6-subcontract-retention.mjs';
const tableNames = ['subcontractors','subcontract_agreements','subcontract_agreement_versions','subcontract_work_orders','subcontract_claims','subcontract_claim_lines','subcontract_claim_assessments','subcontract_certifications','subcontract_action_replays','subcontract_physical_policies','subcontract_physical_claims','subcontract_physical_revisions','subcontract_physical_submissions','subcontract_physical_decisions','subcontract_physical_operations','retention_ledger_entries'];
const row = x => ({...x, __fm03_exact_row_json: JSON.stringify(x)});
const hash = 'a'.repeat(64);
function fixture() {
  const before = Object.fromEntries(tableNames.map(t => [t,[row({id:'claim-1',amount:'731.25'})]]));
  before.document_links = [row({id:'link-1',document_id:'doc-1',entity_type:'SUBCONTRACT_CLAIM',entity_id:'claim-1'}),row({id:'link-2',document_id:'doc-1',entity_type:'PROJECT',entity_id:'project-1'})];
  before.documents = [row({id:'doc-1',storage_key:'work.pdf',file_size_bytes:42,checksum:hash})];
  const files = [['work.pdf',42,hash]];
  return { before, after:structuredClone(before), files, nextFiles:structuredClone(files) };
}
const verify = f => verifyM6SubcontractRetention(f.before,f.after,f.files,f.nextFiles);
const rejects = (mutate, code) => { const f=fixture(); mutate(f); assert.throws(()=>verify(f), {message:code}); };
test('M6 preserves prior subcontract rows and bytes while allowing unrelated new documents',()=>{
  const f=fixture(); f.after.documents.push(row({id:'other',storage_key:'new.pdf'})); f.nextFiles.push(['new.pdf',1,hash]);
  assert.deepEqual(verify(f),{historicalSubcontractRowsPreserved:true,protectedEvidenceMetadataAndBytesPreserved:true,evidenceFileCount:1});
});
test('M6 refuses an empty or missing predecessor table',()=>{
  rejects(f=>{f.before.subcontract_claims=[];},'M6_PA_POPULATED_PREDECESSOR_REQUIRED');
  rejects(f=>{delete f.after.subcontract_physical_decisions;},'M6_PA_MISSING_TABLE');
});
test('M6 refuses exact financial or physical row drift and duplicate rows',()=>{
  rejects(f=>{f.after.subcontract_certifications=[row({id:'claim-1',amount:'731.26'})];},'M6_PA_HISTORICAL_ROW_DRIFT');
  rejects(f=>{f.after.subcontract_physical_decisions.push(f.after.subcontract_physical_decisions[0]);},'M6_PA_HISTORICAL_ROW_DRIFT');
});
test('M6 refuses missing exact SQL bytes',()=>rejects(f=>{delete f.after.subcontract_claims[0].__fm03_exact_row_json;},'M6_PA_MISSING_EXACT_SQL_BYTES'));
test('M6 refuses removed claim evidence or changed generic alias',()=>{
  rejects(f=>{f.before.document_links=[];},'M6_PA_CLAIM_EVIDENCE_REQUIRED');
  rejects(f=>{f.after.document_links.pop();},'M6_PA_HISTORICAL_ROW_DRIFT');
});
test('M6 refuses metadata changes and missing or modified bytes',()=>{
  rejects(f=>{f.after.documents=[];},'M6_PA_HISTORICAL_ROW_DRIFT');
  rejects(f=>{f.nextFiles=[];},'M6_PA_EVIDENCE_BYTES_DRIFT');
  rejects(f=>{f.nextFiles[0][2]='b'.repeat(64);},'M6_PA_EVIDENCE_BYTES_DRIFT');
});
test('M6 refuses ambiguous duplicate inventory paths',()=>rejects(f=>{f.nextFiles.push(f.nextFiles[0]);},'M6_PA_INVALID_FILE_INVENTORY'));
