// Read-only successor evidence core. Inputs must be normalized from private receipts
// by the Mac adapter. Never treats a supplied observation as release authority.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
import {lstat,open,readdir,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const SHA=/^[a-f0-9]{64}$/;
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const identity=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
const keys=['documents','uploads','hrkeys'];
const name=/^[a-z_][a-z0-9_]*$/;
export async function inventory(root,{privateRoot=true}={}){
  need(resolve(root)===root,'M6_EVIDENCE_ROOT_INVALID');
  const rows=[];
  async function visit(path,rel){
    const before=await lstat(path);
    need(before.uid===process.getuid()&&!before.isSymbolicLink()&&!(before.mode&(privateRoot&&!rel?0o077:0o022)),'M6_EVIDENCE_UNSAFE_ENTRY');
    if(before.isDirectory()){
      need(await realpath(path)===path,'M6_EVIDENCE_DIRECTORY_ALIAS');
      rows.push([rel,'directory']);
      for(const child of (await readdir(path)).sort())await visit(join(path,child),rel?rel+'/'+child:child);
    }else{
      need(before.isFile()&&before.nlink===1,'M6_EVIDENCE_UNSAFE_FILE');
      const h=createHash('sha256'),f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
      try{
        need(identity(before,await f.stat()),'M6_EVIDENCE_FILE_DRIFT');
        for await(const chunk of f.createReadStream({autoClose:false}))h.update(chunk);
        need(identity(before,await f.stat()),'M6_EVIDENCE_FILE_DRIFT');
      }finally{await f.close();}
      rows.push([rel,before.size,h.digest('hex')]);
    }
    need(identity(before,await lstat(path)),'M6_EVIDENCE_ENTRY_DRIFT');
    need(rows.length<=10000,'M6_EVIDENCE_INVENTORY_LIMIT');
  }
  await visit(root,'');
  need(same(rows[0],['','directory']),'M6_EVIDENCE_ROOT_NOT_DIRECTORY');
  return rows;
}
export function verifyRuntimePair(expected,current,application,nodePath,uid){
  need(resolve(application)===application&&resolve(nodePath)===nodePath&&Number.isInteger(uid)&&uid>0,'M6_RUNTIME_CONTEXT_INVALID');
  const pids=[];
  for(const [kind,port,entry] of [['api',33071,'apps/api/dist/main.js'],['web',44171,'deploy/uat/serve-web.mjs']]){
    const e=expected?.[kind],c=current?.[kind];
    need(e&&c&&Number.isSafeInteger(e.pid)&&e.pid>1&&typeof e.born==='string'&&e.born.length>0&&
      e.port===port&&e.entry===join(application,entry)&&c.pid===e.pid&&c.born===e.born&&c.uid===uid&&
      c.command===nodePath+' '+e.entry&&same(c.listenerPids,[e.pid])&&same(c.listenAddresses,['127.0.0.1:'+port]),'M6_RUNTIME_PROCESS_DRIFT');
    pids.push(e.pid);
  }
  need(pids[0]!==pids[1]&&current.health?.status==='ok'&&current.health.database==='ok'&&current.health.documentStorage==='ok','M6_RUNTIME_HEALTH_OR_IDENTITY_INVALID');
  return true;
}
// Read-only full public-table snapshot, not a JS-number projection. Caller owns client lifetime.
// This is not a cutover/drain admission gate.
export async function readDatabaseEvidence(db,expectedTables){
  need(Array.isArray(expectedTables)&&expectedTables.length>0&&expectedTables.every(t=>name.test(t))&&new Set(expectedTables).size===expectedTables.length,'M6_DB_TABLE_BASELINE_INVALID');
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const id=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
    need(id.length===1&&id[0].db==='proto_a_01'&&id[0].role==='proto_runtime'&&id[0].ro==='on'&&id[0].isolation==='repeatable read','M6_DB_IDENTITY_INVALID');
    await requireNoLiveSessions(tx);
    const tableRows=await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename");
    const tables=tableRows.map(x=>x.tablename).sort();
    need(same(tables,[...expectedTables].sort()),'M6_DB_TABLE_SET_DRIFT');
    const snapshot={};
    for(const table of tables){
      const rows=await tx.$queryRawUnsafe('SELECT row_to_json(t)::text AS raw FROM public."'+table+'" AS t');
      need(rows.every(r=>typeof r.raw==='string'),'M6_DB_RAW_ROW_INVALID');
      snapshot[table]={count:rows.length,sha256:hash(rows.map(r=>r.raw).sort())};
    }
    return snapshot;
  },{isolationLevel:'RepeatableRead',timeout:60000});
}
export function verifyDatabaseEvidence(expected,current){
  need(expected&&current&&Object.keys(expected).length>0&&same(Object.keys(expected).sort(),Object.keys(current).sort()),'M6_DB_BASELINE_DRIFT');
  for(const t of Object.keys(expected))need(Number.isSafeInteger(expected[t]?.count)&&expected[t].count>=0&&SHA.test(expected[t].sha256)&&expected[t].count===current[t]?.count&&expected[t].sha256===current[t].sha256,'M6_DB_ROW_DRIFT');
  return true;
}
export async function inspectEvidence({root,application,nodePath,uid,baseline,observeRuntime,db}){
  need(typeof observeRuntime==='function'&&baseline?.database&&baseline?.files&&baseline?.artifacts,'M6_EVIDENCE_BASELINE_REQUIRED');
  const first=await observeRuntime();verifyRuntimePair(baseline.runtime,first,application,nodePath,uid);
  async function capture(){
    const dbNow=await readDatabaseEvidence(db,Object.keys(baseline.database));verifyDatabaseEvidence(baseline.database,dbNow);
    for(const kind of keys)need(same(await inventory(join(root,kind)),baseline.files[kind]),'M6_PROTECTED_FILE_DRIFT');
    for(const [key,path] of [['api','apps/api/dist'],['web','apps/web/dist']])need(same(await inventory(join(application,path),{privateRoot:false}),baseline.artifacts[key]),'M6_COMPILED_ARTIFACT_DRIFT');
  }
  await capture();await capture();
  const last=await observeRuntime();verifyRuntimePair(baseline.runtime,last,application,nodePath,uid);
  return {normalizedEvidenceMatched:true,readOnly:true,liveRuntimeVerified:false,mayMutate:false,milestone6Accepted:false,productionAuthorized:false};
}
