// Synthetic final HR/recovery contract; no database, real HR keys, or runtime acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,lstat,cp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {hrFinalTables,verifyM6HrFinalPreservation} from './m6-hr-final-preservation.mjs';
import {verifyM6RecoveryCopy} from './m6-recovery-copy.mjs';
const kinds=['documents','uploads','hrkeys'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const row=v=>({...v,__fm03_exact_row_json:JSON.stringify(v)});
async function inventory(root){
 const result=[];
 async function visit(path,name){const s=await lstat(path);assert.ok(!s.isSymbolicLink());
  if(s.isDirectory()){result.push([name,'directory']);for(const n of (await readdir(path)).sort())await visit(join(path,n),name?name+'/'+n:n);}
  else{assert.ok(s.isFile());const b=await readFile(path);result.push([name,b.length,hash(b)]);}
 }
 await visit(root,'');return result;
}
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'m6-hr-recovery-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'source'),preserved=join(root,'preserved');await mkdir(source,{mode:0o700});
 for(const k of kinds)await mkdir(join(source,k),{mode:0o700});
 const old=Buffer.from('synthetic old protected file'),next=Buffer.from('synthetic new protected file');
 await writeFile(join(source,'documents','old.bin'),old,{mode:0o600});
 await writeFile(join(source,'hrkeys','placeholder'),'not an actual key',{mode:0o600});
 await writeFile(join(source,'uploads','prior.tmp'),'synthetic upload',{mode:0o600});
 await cp(source,preserved,{recursive:true});
 const dump=Buffer.alloc(2048,17);await writeFile(join(preserved,'postgresql.custom'),dump,{mode:0o600});
 const expected=Object.fromEntries(await Promise.all(kinds.map(async k=>[k,await inventory(join(source,k))])));
 const before=Object.fromEntries(hrFinalTables.map(k=>[k,[row({id:k+'-prior'})]]));
 before.documents=[row({id:'old-doc',company_id:'company-a',storage_key:'old.bin',file_size_bytes:old.length,checksum:hash(old)})];
 before.hr_document_attachments=[row({id:'old-attachment',company_id:'company-a',document_id:'old-doc',encrypted_metadata:'synthetic-old-envelope'})];
 before.document_links=[row({id:'old-link',document_id:'old-doc',entity_type:'HR_ATTACHMENT',entity_id:'old-attachment'})];
 const after=structuredClone(before);
 after.documents.push(row({id:'new-doc',company_id:'company-a',storage_key:'new.bin',file_size_bytes:next.length,checksum:hash(next)}));
 after.hr_document_attachments.push(row({id:'new-attachment',company_id:'company-a',document_id:'new-doc',encrypted_metadata:'synthetic-new-envelope'}));
 after.document_links.push(row({id:'new-link',document_id:'new-doc',entity_type:'HR_ATTACHMENT',entity_id:'new-attachment'}));
 after.hr_replays.push(row({id:'new-replay'}));
 await writeFile(join(source,'documents','new.bin'),next,{mode:0o600});
 return {source,preserved,before,after,expected,dumpSha:hash(dump)};
}
// Require both production helper outcomes in the final runtime's ordering.
async function verify(f){
 const hr=verifyM6HrFinalPreservation(f.before,f.after,'new-attachment','new.bin');
 await verifyM6RecoveryCopy({root:f.preserved,expected:f.expected,expectedDumpSha:f.dumpSha,readInventory:inventory});
 return hr;
}
test('new HR attachment and immutable original recovery copy agree',async t=>{
 const f=await fixture(t);assert.deepEqual(await verify(f),{historicalHrRowsPreserved:true,oneNewHrAttachmentVerified:true});
 assert.equal((await inventory(join(f.source,'documents'))).length,(await inventory(join(f.preserved,'documents'))).length+1);
});
test('intact recovery copy does not excuse historical HR metadata drift',async t=>{
 const f=await fixture(t);f.after.hr_document_attachments[0]=row({...JSON.parse(f.before.hr_document_attachments[0].__fm03_exact_row_json),encrypted_metadata:'changed-envelope'});
 assert.equal(await verifyM6RecoveryCopy({root:f.preserved,expected:f.expected,expectedDumpSha:f.dumpSha,readInventory:inventory}),true);
 await assert.rejects(verify(f),/M6_EXACT_HISTORICAL_ROW_DRIFT/);
});
test('valid HR successor does not excuse a modified preserved HR key file',async t=>{
 const f=await fixture(t);await writeFile(join(f.preserved,'hrkeys','placeholder'),'tampered placeholder');
 assert.equal(verifyM6HrFinalPreservation(f.before,f.after,'new-attachment','new.bin').oneNewHrAttachmentVerified,true);
 await assert.rejects(verify(f),/M6_RECOVERY_COPY_HRKEYS_DRIFT/);
});
test('valid HR successor does not excuse an altered preserved database dump',async t=>{
 const f=await fixture(t);await writeFile(join(f.preserved,'postgresql.custom'),Buffer.alloc(2048,18));
 assert.equal(verifyM6HrFinalPreservation(f.before,f.after,'new-attachment','new.bin').historicalHrRowsPreserved,true);
 await assert.rejects(verify(f),/M6_RECOVERY_DUMP_DRIFT/);
});
test('unrelated company document cannot satisfy the new HR attachment binding even with intact recovery',async t=>{
 const f=await fixture(t);f.after.documents[1]=row({...JSON.parse(f.after.documents[1].__fm03_exact_row_json),company_id:'company-b'});
 await assert.rejects(verify(f),/M6_HR_FINAL_DOCUMENT_BINDING_INVALID/);
});
