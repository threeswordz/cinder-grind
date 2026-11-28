import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open} from 'node:fs/promises';
import {join} from 'node:path';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const kinds=['documents','uploads','hrkeys'];
const sha=/^[a-f0-9]{64}$/;
const sameIdentity=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
// Recheck the immutable recovery copy after rehearsal and before final sealing.
export async function verifyM6RecoveryCopy({root,expected,expectedDumpSha,readInventory}={}){
  need(typeof root==='string'&&sha.test(expectedDumpSha??'')&&typeof readInventory==='function','M6_RECOVERY_COPY_INPUT_INVALID');
  const rootBefore=await lstat(root);
  need(rootBefore.isDirectory()&&!rootBefore.isSymbolicLink()&&rootBefore.uid===process.getuid()&&!(rootBefore.mode&0o077),'M6_RECOVERY_ROOT_UNSAFE');
  for(const kind of kinds){
    const prior=expected?.[kind];
    need(Array.isArray(prior)&&prior.length>0&&JSON.stringify(prior[0])==='["","directory"]','M6_RECOVERY_COPY_BASELINE_INVALID');
    const current=await readInventory(join(root,kind));
    need(JSON.stringify(current)===JSON.stringify(prior),'M6_RECOVERY_COPY_'+kind.toUpperCase()+'_DRIFT');
  }
  const dump=join(root,'postgresql.custom');
  const before=await lstat(dump);
  need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.uid===process.getuid()&&!(before.mode&0o077)&&before.size>1024,'M6_RECOVERY_DUMP_UNSAFE');
  const handle=await open(dump,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const hash=createHash('sha256');
  try{
    need(sameIdentity(before,await handle.stat()),'M6_RECOVERY_DUMP_CHANGED_DURING_READ');
    for await(const b of handle.createReadStream({autoClose:false}))hash.update(b);
    need(sameIdentity(before,await handle.stat())&&sameIdentity(before,await lstat(dump)),'M6_RECOVERY_DUMP_CHANGED_DURING_READ');
  }finally{await handle.close();}
  need(sameIdentity(rootBefore,await lstat(root)),'M6_RECOVERY_ROOT_CHANGED_DURING_READ');
  need(hash.digest('hex')===expectedDumpSha,'M6_RECOVERY_DUMP_DRIFT');
  return true;
}
