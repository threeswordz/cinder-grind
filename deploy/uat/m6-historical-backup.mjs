// Compare retained historical backup custody, never restore or alter the runtime.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {verifyBackupReceipts,verifyProtectedInventories} from './m6-backup-receipts.mjs';
import {lstat,open,realpath,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const sha=/^[a-f0-9]{64}$/;
const name=/^[a-zA-Z0-9_-]{1,200}$/;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sorted=rows=>[...rows].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
const stable=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
export function verifyMigrationChecksums(plan,live,sources){
  const normalize=rows=>{
    need(Array.isArray(rows),'M6_HISTORICAL_MIGRATION_SHAPE_INVALID');
    const pairs=rows.map(r=>[r?.migration_name,r?.checksum]);
    need(pairs.every(([n,h])=>name.test(n??'')&&sha.test(h??''))&&new Set(pairs.map(r=>r[0])).size===pairs.length,'M6_HISTORICAL_MIGRATION_SHAPE_INVALID');
    return sorted(pairs);
  };
  const old=normalize(plan?.oldLedger),next=normalize(plan?.newLedger);
  need(old.length===166&&next.length===177&&Array.isArray(plan.additions)&&plan.additions.length===11,'M6_HISTORICAL_MIGRATION_COUNT_INVALID');
  const now=normalize(live.map(([migration_name,checksum])=>({migration_name,checksum})));
  const sql=normalize(sources);
  need(same(next,now)&&same(next,sql),'M6_HISTORICAL_MIGRATION_CHECKSUM_DRIFT');
  const lookup=new Map(next);
  need(old.every(([n,h])=>lookup.get(n)===h),'M6_HISTORICAL_MIGRATION_PREDECESSOR_DRIFT');
  return {historicalMigrationChecksumsMatched:166,liveMigrationChecksumsMatched:177,additiveMigrationNames:11};
}
async function hashFile(path,privateOnly){
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const s=await f.stat();need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&(privateOnly?0o077:0o022))&&s.size>0&&await realpath(path)===path,'M6_HISTORICAL_FILE_UNSAFE');
    const h=createHash('sha256');for await(const b of f.createReadStream({autoClose:false}))h.update(b);
    need(stable(s,await f.stat())&&stable(s,await lstat(path)),'M6_HISTORICAL_FILE_DRIFT');return h.digest('hex');
  }finally{await f.close();}
}
export async function migrationSources(application){
  const path=join(application,'apps/api/prisma/migrations');
  const dirs=(await readdir(path,{withFileTypes:true})).filter(d=>d.isDirectory());
  need(dirs.length===177&&dirs.every(d=>name.test(d.name)),'M6_HISTORICAL_SQL_SOURCE_COUNT_INVALID');
  return Promise.all(dirs.map(async d=>({migration_name:d.name,checksum:await hashFile(join(path,d.name,'migration.sql'),false)})));
}
export async function verifyProtectedBackup({root,stage,receipt,rehearsal,baseline,readInventory}){
  need(stage===join(root,'m4-upgrade-9417f07c'),'M6_HISTORICAL_BACKUP_ROOT_UNSAFE');
  verifyBackupReceipts(receipt,rehearsal);
  need(baseline&&Object.keys(baseline).sort().join(',')==='documents,hrkeys,uploads','M6_HISTORICAL_INVENTORY_INVALID');
  const preserved=join(stage,'preserved'),s=await lstat(preserved);
  need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(preserved)===preserved,'M6_HISTORICAL_BACKUP_ROOT_UNSAFE');
  need(await hashFile(join(preserved,'postgresql.custom'),true)===receipt.databaseArchiveSha256,'M6_HISTORICAL_ARCHIVE_CHECKSUM_DRIFT');
  for(const kind of ['documents','uploads','hrkeys']){
    const original=await readInventory(join(preserved,kind)),current=await readInventory(join(root,kind));
    verifyProtectedInventories(baseline[kind],original,current);
  }
  return {retainedArchiveChecksumMatched:true,protectedCopiesMatchCurrent:true,historicalDatabaseRowsVerified:false,historicalCompiledArtifactBytesVerified:false};
}
