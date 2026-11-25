// Paired Documents proof supplements the existing bounded equipment database recovery.
// Disposable runner only; this does not admit a release or certify HR key recovery.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile,realpath,lstat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
const [phase,storage,manifest]=process.argv.slice(2);
const url=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid/');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.equal(process.platform,'linux');
assert.ok(['seed','after','restored'].includes(phase));
assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
assert.equal(url.port,'5432');
assert.equal(url.pathname,phase==='restored'?'/erp_m4_equipment_restore':'/erp_m4_equipment_upgrade');
assert.ok(storage&&manifest&&process.env.RUNNER_TEMP);
const parent=await realpath(process.env.RUNNER_TEMP);
const root=await realpath(storage);
const within=(base,target)=>{
 const r=relative(base,target);
 return Boolean(r)&&r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r);
};
assert.ok(within(parent,root)&&within(parent,resolve(manifest)));
assert.equal(root,resolve(storage),'No symlinked storage root');
const req=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const {PrismaClient}=req('@prisma/client');
const db=new PrismaClient();
const hash=b=>createHash('sha256').update(b).digest('hex');
try{
 assert.equal((await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,url.pathname.slice(1));
 if(phase==='seed'){
  const c=await db.company.findUniqueOrThrow({where:{companyCode:'M4-EQUIPMENT-RECOVERY'}});
  const project=await db.project.findFirstOrThrow({where:{companyId:c.id,projectCode:'P'}});
  const user=await db.user.findFirstOrThrow({where:{companyId:c.id,email:'m4-equipment-recovery@example.invalid'}});
  const docType=await db.documentType.create({data:{companyId:c.id,documentTypeCode:'RECOVERY',documentTypeName:'Synthetic predecessor document'}});
  const records=[];
  for(const [name,active] of [['existing-site-note',true],['historical-site-note',false]]){
   const key=c.id+'/recovery/'+name+'.txt';
   const dest=resolve(root,key);
   assert.ok(within(root,dest));
   await mkdir(resolve(dest,'..'),{recursive:true,mode:0o700});
   const bytes=Buffer.from('Disposable pre-upgrade evidence: '+name+'\n','utf8');
   await writeFile(dest,bytes,{flag:'wx',mode:0o600});
   const document=await db.document.create({data:{companyId:c.id,documentTypeId:docType.id,
    fileName:name+'.txt',storageProvider:'LOCAL',storageKey:key,mimeType:'text/plain',
    fileSizeBytes:bytes.length,checksum:hash(bytes),uploadedByUserId:user.id,isActive:active}});
   const link=await db.documentLink.create({data:{documentId:document.id,entityType:'PROJECT',entityId:project.id,linkedByUserId:user.id}});
   records.push({id:document.id,linkId:link.id,key,hash:hash(bytes),size:bytes.length,active,
    companyId:c.id,projectId:project.id,uploader:user.id});
  }
  await writeFile(manifest,JSON.stringify(records),{flag:'wx',mode:0o600});
  console.log('EQUIPMENT_PREDECESSOR_PAIRED_DOCUMENTS_SEEDED count=2');
 }else{
  const records=JSON.parse(await readFile(manifest,'utf8'));
  assert.equal(records.length,2);
  for(const r of records){
   const doc=await db.document.findUniqueOrThrow({where:{id:r.id}});
   const link=await db.documentLink.findUniqueOrThrow({where:{id:r.linkId}});
   assert.equal(doc.companyId,r.companyId);assert.equal(doc.storageProvider,'LOCAL');
   assert.equal(doc.storageKey,r.key);assert.equal(doc.checksum,r.hash);
   assert.equal(doc.fileSizeBytes,r.size);assert.equal(doc.isActive,r.active);
   assert.equal(doc.uploadedByUserId,r.uploader);
   assert.equal(link.documentId,r.id);assert.equal(link.entityType,'PROJECT');
   assert.equal(link.entityId,r.projectId);assert.equal(link.linkedByUserId,r.uploader);
   const target=resolve(root,r.key);
   assert.ok(within(root,target)&&within(root,await realpath(target)));
   const stat=await lstat(target);
   assert.ok(stat.isFile()&&!stat.isSymbolicLink());assert.equal(stat.size,r.size);
   assert.equal(hash(await readFile(target)),r.hash);
  }
  assert.equal(await db.document.count({where:{companyId:records[0].companyId}}),2);
  console.log('EQUIPMENT_PAIRED_DOCUMENTS_'+(phase==='restored'?'INDEPENDENT_RESTORE':'FORWARD_RECHECK')+'_PASS count=2');
 }
}finally{await db.$disconnect();}
