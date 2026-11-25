import test from 'node:test';
import assert from 'node:assert/strict';
import {siteMaterialTables,verifyM6SiteMaterial} from './m6-site-material-preservation.mjs';
const row=x=>({...x,__fm03_exact_row_json:JSON.stringify(x)});
const hash='a'.repeat(64);
function fixture(){
  const before=Object.fromEntries(siteMaterialTables.map(t=>[t,[row({id:'source-1',quantity:'12.0000'})]]));
  before.daily_site_report_delays=[];
  before.document_links=[row({id:'link-1',entity_type:'MATERIAL_REQUEST',entity_id:'source-1',document_id:'doc-1'}),row({id:'link-2',entity_type:'PROJECT',entity_id:'site-1',document_id:'doc-1'})];
  before.documents=[row({id:'doc-1',storage_key:'proof.pdf',file_size_bytes:42,checksum:hash})];
  const files=[['proof.pdf',42,hash]];
  return {before,after:structuredClone(before),files,next:structuredClone(files)};
}
const run=f=>verifyM6SiteMaterial(f.before,f.after,f.files,f.next);
const reject=(change,code)=>{const f=fixture();change(f);assert.throws(()=>run(f),{message:code});};
test('exact preserved rows admit unrelated HR document and empty optional table',()=>{
  const f=fixture();f.after.documents.push(row({id:'hr'}));f.after.document_links.push(row({document_id:'hr',entity_type:'HR_ATTACHMENT',entity_id:'employee'}));
  assert.deepEqual(run(f),{historicalSiteMaterialRowsPreserved:true,materialRequestEvidencePreserved:true});
});
test('completed predecessor cannot be missing or empty',()=>{
  reject(f=>{delete f.after.material_usage_plans;},'M6_SM_TABLE_MISSING');
  reject(f=>{f.before.site_issues=[];},'M6_SM_COMPLETED_PREDECESSOR_REQUIRED');
});
test('refuses altered site events or extra issue and unexpected child history',()=>{
  reject(f=>{f.after.site_issue_events=[row({id:'source-1',quantity:'13.0000'})];},'M6_SM_HISTORICAL_DRIFT');
  reject(f=>{f.after.material_issues.push(row({id:'extra'}));},'M6_SM_HISTORICAL_DRIFT');
  reject(f=>{f.after.daily_site_report_delays.push(row({id:'extra'}));},'M6_SM_HISTORICAL_DRIFT');
});
test('raw numeric SQL precision and source pin cannot drift',()=>{
  const a='{"id":"source-1","quantity":9007199254740992.01}',b='{"id":"source-1","quantity":9007199254740992.02}';
  assert.deepEqual(JSON.parse(a),JSON.parse(b));
  reject(f=>{f.before.material_uom_request_line_pins=[{__fm03_exact_row_json:a}];f.after.material_uom_request_line_pins=[{__fm03_exact_row_json:b}];},'M6_SM_HISTORICAL_DRIFT');
  reject(f=>{delete f.after.material_usage_plan_lines[0].__fm03_exact_row_json;},'M6_SM_EXACT_SQL_REQUIRED');
});
test('reject new attachment to prior request and changed alias',()=>{
  reject(f=>{f.after.document_links.push(row({document_id:'other',entity_type:'MATERIAL_REQUEST',entity_id:'source-1'}));},'M6_SM_HISTORICAL_DRIFT');
  reject(f=>{f.after.document_links.pop();},'M6_SM_HISTORICAL_DRIFT');
});
test('reject modified metadata and evidence file bytes',()=>{
  reject(f=>{f.after.documents=[];},'M6_SM_HISTORICAL_DRIFT');
  reject(f=>{f.next[0][2]='b'.repeat(64);},'M6_SM_EVIDENCE_BYTES_DRIFT');
  reject(f=>{f.next.push(f.next[0]);},'M6_SM_INVENTORY_INVALID');
});
