import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat} from 'node:fs/promises';
import {join} from 'node:path';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const kinds=['documents','uploads','hrkeys'];
const sha=/^[a-f0-9]{64}$/;
// Recheck the immutable recovery copy after rehearsal and before final sealing.
export async function verifyM6RecoveryCopy({root,expected,expectedDumpSha,readInventory}={}){
  need(typeof root==='string'&&sha.test(expectedDumpSha??'')&&typeof readInventory==='function','M6_RECOVERY_COPY_INPUT_INVALID');
  for(const kind of kinds){
    const prior=expected?.[kind];
    need(Array.isArray(prior)&&prior.length>0&&JSON.stringify(prior[0])==='["","directory"]','M6_RECOVERY_COPY_BASELINE_INVALID');
    const current=await readInventory(join(root,kind));
    need(JSON.stringify(current)===JSON.stringify(prior),'M6_RECOVERY_COPY_'+kind.toUpperCase()+'_DRIFT');
  }
  const dump=join(root,'postgresql.custom');
  const before=await lstat(dump);
  need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.uid===process.getuid()&&!(before.mode&0o077)&&before.size>1024,'M6_RECOVERY_DUMP_UNSAFE');
  const hash=createHash('sha256');for await(const b of createReadStream(dump))hash.update(b);
  const after=await lstat(dump);
  need(['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>before[k]===after[k]),'M6_RECOVERY_DUMP_CHANGED_DURING_READ');
  need(hash.digest('hex')===expectedDumpSha,'M6_RECOVERY_DUMP_DRIFT');
  return true;
}
