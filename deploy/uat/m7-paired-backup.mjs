// M7-01 preparation only: validate an already staged private paired capture.
// Never stop a process, invoke pg_dump, read live roots or admit M7 here.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,readdir,realpath} from 'node:fs/promises';
import {isAbsolute,resolve,join} from 'node:path';
import {normalizeInventory} from './m6-backup-receipts.mjs';
import {verifyM6RecoveryCopy} from './m6-recovery-copy.mjs';
const kinds=['documents','uploads','hrkeys'];
const manifestName='m7-paired-manifest.json';
const digest=b=>createHash('sha256').update(b).digest('hex');
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const stable=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
const sort=(a,b)=>a<b?-1:a>b?1:0;
async function privateStat(p,dir){
  const s=await lstat(p);
  need((dir?s.isDirectory():s.isFile()&&s.nlink===1)&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(p)===p,'M7_BACKUP_PATH_UNSAFE');
  return s;
}
async function readPrivate(p,{custom=false}={}){
  const before=await privateStat(p,false);
  const f=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    need(stable(before,await f.stat()),'M7_BACKUP_FILE_DRIFT');
    if(custom){const magic=Buffer.alloc(5);const {bytesRead}=await f.read(magic,0,5,0);need(bytesRead===5&&magic.toString()==='PGDMP','M7_BACKUP_DUMP_FORMAT');}
    const h=createHash('sha256');
    for await(const b of f.createReadStream({start:0,autoClose:false})){h.update(b);}
    need(stable(before,await f.stat())&&stable(before,await privateStat(p,false)),'M7_BACKUP_FILE_DRIFT');
    return {size:before.size,sha256:h.digest('hex')};
  }finally{await f.close();}
}
async function inventory(root){
  const rows=[];
  async function walk(p,rel){
    const before=await privateStat(p,true);rows.push([rel,'directory']);
    for(const name of (await readdir(p)).sort(sort)){
      need(!name.includes('\\')&&!name.includes('\0'),'M7_BACKUP_PATH_UNSAFE');
      const child=join(p,name),r=rel?`${rel}/${name}`:name,s=await lstat(child);
      if(s.isDirectory())await walk(child,r);
      else{const f=await readPrivate(child);rows.push([r,f.size,f.sha256]);}
    }
    need(stable(before,await privateStat(p,true)),'M7_BACKUP_DIRECTORY_DRIFT');
  }
  await walk(root,'');return normalizeInventory(rows,false);
}
function binding(e){
  need(e&&typeof e.applicationSha==='string'&&/^[a-f0-9]{40}$/.test(e.applicationSha)&&sha(e.databaseIdentitySha256)&&sha(e.storageIdentitySha256)&&sha(e.quiescenceReceiptSha256)&&sha(e.beforeStateSha256)&&e.beforeStateSha256===e.afterStateSha256&&sha(e.dumpSha256),'M7_BACKUP_BINDING_INVALID');
  // These are supplied receipt bindings, not independent proof of quiescence.
  return {applicationSha:e.applicationSha,databaseIdentitySha256:e.databaseIdentitySha256,storageIdentitySha256:e.storageIdentitySha256,quiescenceReceiptSha256:e.quiescenceReceiptSha256,beforeStateSha256:e.beforeStateSha256,afterStateSha256:e.afterStateSha256,dumpSha256:e.dumpSha256};
}
async function inspect(root,e,expected,withManifest){
  need(typeof root==='string'&&isAbsolute(root)&&resolve(root)===root&&root!=='/','M7_BACKUP_PATH_UNSAFE');
  const s=await privateStat(root,true);
  const names=[...kinds,'postgresql.custom',...(withManifest?[manifestName]:[])].sort(sort);
  need(JSON.stringify((await readdir(root)).sort(sort))===JSON.stringify(names),'M7_BACKUP_SET_CONTENTS_INVALID');
  const source=binding(e),inventories={};
  need(expected&&Object.keys(expected).sort(sort).join(',')===kinds.slice().sort(sort).join(','),'M7_BACKUP_INVENTORY_INVALID');
  for(const k of kinds)inventories[k]=normalizeInventory(expected[k],false);
  const dump=await readPrivate(join(root,'postgresql.custom'),{custom:true});
  need(dump.sha256===source.dumpSha256,'M7_BACKUP_DUMP_DRIFT');
  await verifyM6RecoveryCopy({root,expected:inventories,expectedDumpSha:source.dumpSha256,readInventory:inventory});
  need(stable(s,await privateStat(root,true)),'M7_BACKUP_DIRECTORY_DRIFT');
  return {version:1,status:'M7_PAIRED_BACKUP_PREPARATION_ONLY',source,dump,inventories,actualCaptureVerified:false,milestone7Accepted:false,productionAuthorized:false};
}
export async function prepareM7PairedManifest({root,evidence,expectedInventories}){
  const manifest=await inspect(root,evidence,expectedInventories,false);
  const bytes=Buffer.from(JSON.stringify(manifest)+'\n');
  const f=await open(join(root,manifestName),'wx',0o400);
  try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}
  const manifestSha256=digest(bytes);
  await verifyM7PairedManifest({root,evidence,expectedInventories,manifestSha256});
  return {status:manifest.status,manifestSha256,actualCaptureVerified:false,milestone7Accepted:false,productionAuthorized:false};
}
export async function verifyM7PairedManifest({root,evidence,expectedInventories,manifestSha256}){
  need(sha(manifestSha256),'M7_BACKUP_MANIFEST_BINDING_INVALID');
  const expected=await inspect(root,evidence,expectedInventories,true);
  const actual=await readPrivate(join(root,manifestName));
  need(actual.sha256===manifestSha256&&digest(Buffer.from(JSON.stringify(expected)+'\n'))===manifestSha256,'M7_BACKUP_MANIFEST_DRIFT');
  return true;
}
