// Integrated synthetic snapshot/filesystem contract only: no database, Mac, or release proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,lstat,cp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {verifyExactHistoricalRows} from './m6-exact-historical-rows.mjs';
import {verifyM6SubcontractRetention} from './m6-subcontract-retention.mjs';
import {verifyM6SiteMaterial,siteMaterialTables} from './m6-site-material-preservation.mjs';
import {verifyM6Procurement,procurementTables} from './m6-procurement-preservation.mjs';
import {verifyM6RecoveryCopy} from './m6-recovery-copy.mjs';
const subcontractTables=['subcontractors','subcontract_agreements','subcontract_agreement_versions','subcontract_work_orders','subcontract_claims','subcontract_claim_lines','subcontract_claim_assessments','subcontract_certifications','subcontract_action_replays','subcontract_physical_policies','subcontract_physical_claims','subcontract_physical_revisions','subcontract_physical_submissions','subcontract_physical_decisions','subcontract_physical_operations','retention_ledger_entries'];
const nullable={suppliers:['short_name'],purchase_request_lines:['review_decision','review_reason','reviewed_by_user_id','reviewed_at','correction_source_line_id'],purchase_orders:['delivery_location','delivery_contact','delivery_terms','payment_terms','credit_terms','discount_amount','freight_amount','additional_charge_amount','vat_rate_percent','supplier_quote_exception_reason','po_display_number','supplier_short_name_snapshot']};
const kinds=['documents','uploads','hrkeys'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const row=x=>({...x,__fm03_exact_row_json:JSON.stringify(x)});
// Actual test filesystem, using the production inventory tuple format.
async function inventory(root){
 const rows=[];
 async function visit(path,name){const s=await lstat(path);assert.ok(!s.isSymbolicLink());
  if(s.isDirectory()){rows.push([name,'directory']);for(const n of (await readdir(path)).sort())await visit(join(path,n),name?name+'/'+n:n);}
  else{assert.ok(s.isFile());const b=await readFile(path);rows.push([name,b.length,hash(b)]);}
 }
 await visit(root,'');return rows;
}
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'m6-combined-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const original=join(root,'original'),preserved=join(root,'preserved'),live=join(root,'live');
 await mkdir(original,{mode:0o700});for(const kind of kinds)await mkdir(join(original,kind),{mode:0o700});
 const tables=[...new Set([...subcontractTables,...siteMaterialTables,...procurementTables])];
 const before=Object.fromEntries(tables.map(k=>[k,[row({id:k+'-1'})]]));
 before.documents=[];before.document_links=[];
 for(const [target,table,name] of [['SUBCONTRACT_CLAIM','subcontract_claims','claim'],['MATERIAL_REQUEST','material_requests','request'],['RECEIVING_DELIVERY','receiving_deliveries','receiving'],['TRANSFER_RECEIPT','transfer_receipts','transfer']]){
  const bytes=Buffer.from('synthetic evidence '+name),doc={id:name+'-doc',storage_key:name+'.bin',file_size_bytes:bytes.length,checksum:hash(bytes)};
  await writeFile(join(original,'documents',doc.storage_key),bytes,{mode:0o600});before.documents.push(row(doc));
  before.document_links.push(row({id:name+'-link',document_id:doc.id,entity_type:target,entity_id:table+'-1'}));
  if(name==='receiving')before.receiving_delivery_evidence=[row({id:'receiving-evidence',delivery_id:table+'-1',document_id:doc.id,checksum:doc.checksum})];
  if(name==='transfer')before.transfer_receipts=[row({id:table+'-1',document_id:doc.id,checksum:doc.checksum})];
 }
 await writeFile(join(original,'uploads','old.tmp'),'synthetic upload',{mode:0o600});await writeFile(join(original,'hrkeys','keyring.json'),'synthetic placeholder, not a real key',{mode:0o600});
 await cp(original,preserved,{recursive:true});await cp(original,live,{recursive:true});
 const dump=Buffer.alloc(2048,31);await writeFile(join(preserved,'postgresql.custom'),dump,{mode:0o600});
 const expected=Object.fromEntries(await Promise.all(kinds.map(async k=>[k,await inventory(join(original,k))])));
 const after=structuredClone(before);
 for(const [table,cols] of Object.entries(nullable))after[table]=after[table].map(r=>row({...JSON.parse(r.__fm03_exact_row_json),...Object.fromEntries(cols.map(c=>[c,null]))}));
 return {before,after,expected,preserved,live,dumpSha:hash(dump),tableCount:tables.length};
}
async function verify(f){
 verifyExactHistoricalRows(f.before,f.after);
 const files=await inventory(join(f.live,'documents')),old=f.expected.documents;
 const proof={...verifyM6SubcontractRetention(f.before,f.after,old,files),...verifyM6SiteMaterial(f.before,f.after,old,files),...verifyM6Procurement(f.before,f.after,old,files)};
 await verifyM6RecoveryCopy({root:f.preserved,expected:f.expected,expectedDumpSha:f.dumpSha,readInventory:inventory});
 return proof;
}
async function addDocument(f,target='HR_ATTACHMENT',entity='synthetic-employee'){
 const b=Buffer.from('new synthetic document'),doc={id:'new-doc',storage_key:'new.bin',file_size_bytes:b.length,checksum:hash(b)};
 await writeFile(join(f.live,'documents',doc.storage_key),b,{mode:0o600});f.after.documents.push(row(doc));f.after.document_links.push(row({id:'new-link',document_id:doc.id,entity_type:target,entity_id:entity}));
}
test('all five preservation helpers agree on one populated snapshot and actual file copies; unrelated new HR file allowed',async t=>{
 const f=await fixture(t);assert.equal(f.tableCount,92);const first=await verify(f);await addDocument(f);assert.deepEqual(await verify(f),first);
 assert.equal(Object.values(first).filter(x=>x===true).length,6);
});
for(const [target,table,code] of [['SUBCONTRACT_CLAIM','subcontract_claims','M6_PA_HISTORICAL_ROW_DRIFT'],['MATERIAL_REQUEST','material_requests','M6_SM_HISTORICAL_DRIFT'],['RECEIVING_DELIVERY','receiving_deliveries','M6_PI_HISTORICAL_DRIFT']])test('combined guard rejects new evidence on '+target,async t=>{
 const f=await fixture(t);await addDocument(f,target,table+'-1');await assert.rejects(verify(f),{message:code});
});
test('combined guard rejects an extra stock posting even when all old rows survive',async t=>{const f=await fixture(t);f.after.stock_transactions.push(row({id:'extra'}));await assert.rejects(verify(f),{message:'M6_PI_HISTORICAL_DRIFT'});});
test('combined guard rejects non-null historical procurement backfill',async t=>{const f=await fixture(t);f.after.suppliers=[row({id:'suppliers-1',short_name:'BACKFILL'})];await assert.rejects(verify(f),{message:'M6_PI_UNEXPECTED_HISTORIC_BACKFILL'});});
test('combined guard rejects changed actual live receiving file bytes',async t=>{const f=await fixture(t);await writeFile(join(f.live,'documents','receiving.bin'),'changed evidence');await assert.rejects(verify(f),{message:'M6_PI_EVIDENCE_BYTES_DRIFT'});});
test('combined guard rejects changed actual preserved HR key bytes even if live documents pass',async t=>{const f=await fixture(t);await writeFile(join(f.preserved,'hrkeys','keyring.json'),'changed placeholder');await assert.rejects(verify(f),{message:'M6_RECOVERY_COPY_HRKEYS_DRIFT'});});
