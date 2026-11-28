// Read-only successor migration proof. The historical M4 inspector remains unchanged.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,realpath,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const names=[
  '20261127041000_ss16_movement_correction_request',
  '20261127050000_ss16_unposted_cancellation_pin',
  '20261127060000_ss16_controlled_submitted_cancellation',
  '20261127070000_ss16_terminal_controlled_cancellation',
  '20261127080000_ss16_plan_cancel_decision_proof',
  '20261127150000_ss16_reciprocal_decision_integrity',
  '20261127160000_ss16_terminal_outcome_ledger_proof',
];
function manifest(rows,count){
  need(Array.isArray(rows)&&rows.length===count,'M6_SUCCESSOR_MIGRATION_COUNT');
  const map=new Map();
  for(const r of rows){
    need(typeof r?.migration_name==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(r.migration_name)&&typeof r.checksum==='string'&&/^[a-f0-9]{64}$/.test(r.checksum)&&!map.has(r.migration_name),'M6_SUCCESSOR_MIGRATION_SHAPE');
    map.set(r.migration_name,r.checksum);
  }
  return map;
}
export function verifySuccessorMigrations({predecessor,sources,live}){
  const old=manifest(predecessor,177),next=manifest(sources,184),applied=manifest(live,184);
  need([...old].every(([n,h])=>next.get(n)===h),'M6_SUCCESSOR_PREDECESSOR_DRIFT');
  const additions=[...next.keys()].filter(n=>!old.has(n)).sort();
  need(JSON.stringify(additions)===JSON.stringify(names),'M6_SUCCESSOR_ADDITIONS_DRIFT');
  need(live.every(r=>r.finished_at instanceof Date&&Number.isFinite(r.finished_at.valueOf())&&r.rolled_back_at===null),'M6_SUCCESSOR_UNFINISHED_MIGRATION');
  need([...next].every(([n,h])=>applied.get(n)===h),'M6_SUCCESSOR_LEDGER_DRIFT');
  return {status:'M6_SUCCESSOR_MIGRATION_PROOF_PASS',predecessorChecksumsMatched:177,additionsMatched:7,appliedChecksumsMatched:184,mayMutate:false,releaseAccepted:false,productionAuthorized:false};
}
const stable=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
export async function readSuccessorSources(application){
  const root=join(application,'apps/api/prisma/migrations');
  need(await realpath(root)===root,'M6_SUCCESSOR_SOURCE_PATH');
  const entries=await readdir(root,{withFileTypes:true});
  need(entries.every(e=>e.isDirectory()||(e.name==='migration_lock.toml'&&e.isFile())),'M6_SUCCESSOR_SOURCE_ENTRY');
  const dirs=entries.filter(e=>e.isDirectory());
  need(dirs.length===184,'M6_SUCCESSOR_MIGRATION_COUNT');
  return Promise.all(dirs.map(async d=>{
    const path=join(root,d.name,'migration.sql');
    need(await realpath(path)===path,'M6_SUCCESSOR_SOURCE_PATH');
    const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    try{
      const s=await f.stat();
      need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o022)&&s.size>0,'M6_SUCCESSOR_SOURCE_FILE');
      const h=createHash('sha256');for await(const b of f.createReadStream({autoClose:false}))h.update(b);
      need(stable(s,await f.stat())&&stable(s,await lstat(path)),'M6_SUCCESSOR_SOURCE_DRIFT');
      return {migration_name:d.name,checksum:h.digest('hex')};
    }finally{await f.close();}
  }));
}
// Caller must separately establish exact checkout, runtime identity and retained receipt custody.
export async function observeSuccessorMigrations({db,expectedDatabase,expectedRole,predecessor,sources}){
  need(typeof expectedDatabase==='string'&&expectedDatabase.length>0&&typeof expectedRole==='string'&&expectedRole.length>0,'M6_SUCCESSOR_DB_IDENTITY');
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const id=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
    need(id.length===1&&id[0].db===expectedDatabase&&id[0].role===expectedRole&&id[0].ro==='on'&&id[0].isolation==='repeatable read','M6_SUCCESSOR_DB_IDENTITY');
    const live=await tx.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name');
    return verifySuccessorMigrations({predecessor,sources,live});
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
