// Restore only a sealed staged capture into a separately claimed private target.
// No live source access, database operation, deletion, overwrite, or automatic retry.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,mkdir,readdir,realpath} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve} from 'node:path';
import {normalizeInventory} from './m6-backup-receipts.mjs';
const kinds=['documents','uploads','hrkeys'];
const need=(ok,code)=>{if(!ok)throw new Error('M7_STORAGE_'+code);};
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino;
const stable=(a,b)=>same(a,b)&&['size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
const within=(a,b)=>{const r=relative(a,b);return r===''||(!isAbsolute(r)&&r!=='..'&&!r.startsWith('../'));};
async function statPrivate(path,directory){
  need(isAbsolute(path)&&resolve(path)===path&&await realpath(path)===path,'PATH');
  const s=await lstat(path);
  need((directory?s.isDirectory():s.isFile()&&s.nlink===1)&&s.uid===process.getuid()&&!(s.mode&0o077),'PRIVATE');
  return s;
}
async function readFileHash(path,out,expected){
  const before=await statPrivate(path,false);
  const fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const buf=Buffer.alloc(65536),h=createHash('sha256');let size=0;
  try{
    need(stable(before,await fd.stat()),'SOURCE_DRIFT');
    if(expected)need(before.size===expected[1],'SIZE');
    for(;;){const {bytesRead:n}=await fd.read(buf,0,buf.length,null);if(!n)break;
      size+=n;need(Number.isSafeInteger(size)&&size<=before.size,'SIZE');h.update(buf.subarray(0,n));
      if(out){let written=0;while(written<n){const {bytesWritten}=await out.write(buf,written,n-written,null);need(bytesWritten>0,'WRITE');written+=bytesWritten;}}
      buf.fill(0,0,n);
    }
    need(size===before.size&&stable(before,await fd.stat())&&stable(before,await statPrivate(path,false)),'SOURCE_DRIFT');
    return [size,h.digest('hex')];
  }finally{buf.fill(0);await fd.close();}
}
async function inventory(root){
  const rows=[];
  async function walk(path,rel){const before=await statPrivate(path,true);rows.push([rel,'directory']);
    for(const name of (await readdir(path)).sort()){
      const p=join(path,name),r=rel?rel+'/'+name:name,s=await lstat(p);
      if(s.isDirectory())await walk(p,r);else rows.push([r,...await readFileHash(p)]);
    }
    need(stable(before,await statPrivate(path,true)),'DIRECTORY_DRIFT');
  }
  await walk(root,'');return normalizeInventory(rows,false);
}
const compare=(a,b)=>need(JSON.stringify(a)===JSON.stringify(b),'INVENTORY_DRIFT');
export function createM7StorageRestore({claim,captureRoot,expectedInventories,reverifyCapture}){
  need(typeof claim?.verifyPaths==='function'&&typeof reverifyCapture==='function'&&typeof captureRoot==='string','CONTEXT');
  need(Object.keys(expectedInventories??{}).sort().join(',')===kinds.slice().sort().join(','),'INVENTORY_KINDS');
  const expected=Object.fromEntries(kinds.map(k=>[k,normalizeInventory(expectedInventories[k],false)]));
  const storage=structuredClone(claim.plan?.storage), dirs=new Map();let attempted=false;
  return async function restoreStorageOnce(){
    need(!attempted,'ALREADY_ATTEMPTED');attempted=true;
    await reverifyCapture();await claim.verifyPaths();
    const captureId=await statPrivate(captureRoot,true);
    const roots=kinds.map(k=>storage?.[k]);
    need(roots.every(p=>typeof p==='string'&&!within(p,captureRoot)&&!within(captureRoot,p))&&roots.every((p,i)=>roots.every((q,j)=>i===j||!within(p,q)&&!within(q,p))),'ROOT_ALIAS');
    // Preflight all three roots before creating any entry.
    for(const k of kinds){const root=storage[k];dirs.set(root,await statPrivate(root,true));need((await readdir(root)).length===0,'TARGET_NOT_EMPTY');compare(await inventory(join(captureRoot,k)),expected[k]);}
    const checkDir=async p=>need(dirs.has(p)&&same(dirs.get(p),await statPrivate(p,true)),'TARGET_DIRECTORY_DRIFT');
    for(const k of kinds){const root=storage[k];
      for(const row of expected[k].slice(1)){
        await claim.verifyPaths();need(same(captureId,await statPrivate(captureRoot,true)),'CAPTURE_DRIFT');
        const src=join(captureRoot,k,row[0]),dst=join(root,row[0]);await checkDir(dirname(dst));
        if(row[1]==='directory'){
          await statPrivate(src,true);await mkdir(dst,{mode:0o700});dirs.set(dst,await statPrivate(dst,true));
        }else{
          const fd=await open(dst,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
          try{compare(await readFileHash(src,fd,row),row.slice(1));await fd.sync();need(same(await fd.stat(),await statPrivate(dst,false)),'TARGET_FILE_DRIFT');}
          finally{await fd.close();}
          compare(await readFileHash(dst),row.slice(1));
        }
        await checkDir(dirname(dst));
      }
    }
    await claim.verifyPaths();
    for(const k of kinds){await checkDir(storage[k]);compare(await inventory(storage[k]),expected[k]);}
    await reverifyCapture();await claim.verifyPaths();
    return Object.freeze({status:'M7_STORAGE_RESTORE_BYTES_VERIFIED',rootsVerified:3,nativeDatabaseVerified:false,milestone7Accepted:false,productionAuthorized:false});
  };
}
