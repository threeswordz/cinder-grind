// Native read-only M7 source observation. No capture, restore, process stop or grants.
import {createHash} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import {realpath,lstat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const need=(ok,c)=>{if(!ok)throw Error('M7_SOURCE_'+c);};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const kinds=['documents','uploads','hrkeys'];
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/.test(x);
export async function inspectM7SourceDatabase(db,database,extras){
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const ids=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation,(SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid");
  need(ids.length===1&&ids[0].db===database&&ids[0].role==='proto_runtime'&&ids[0].ro==='on'&&ids[0].isolation==='repeatable read'&&/^\d+$/.test(ids[0].oid),'DATABASE');
  const clients=await tx.$queryRawUnsafe("SELECT count(*)::text AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'");
  need(clients.length===1&&clients[0].n==='0','OTHER_CLIENTS');
  const docs=await tx.document.findMany({where:{storageKey:{in:extras.map(r=>r[0])}},select:{storageKey:true,checksum:true,fileSizeBytes:true,storageProvider:true,isActive:true}});
  need(docs.length===extras.length&&new Set(docs.map(d=>d.storageKey)).size===extras.length&&extras.every(([key,size,sha])=>docs.some(d=>d.storageKey===key&&d.fileSizeBytes===size&&d.checksum===sha&&d.storageProvider==='LOCAL'&&d.isActive===true)),'DOCUMENT_BINDING');
  return ids[0].oid;
 },{isolationLevel:'RepeatableRead',timeout:120000});
}
export function createM7SourceInspector({root,application,db,anchor,paths,inventory,checkout,verifyCustody,portFree,inspectDirectories}){
 need([inventory,checkout,verifyCustody,portFree,inspectDirectories].every(f=>typeof f==='function'),'CONTEXT');
 const expected=structuredClone(paths),pin=structuredClone(anchor),parent=dirname(expected.stage),prior=join(parent,'event294-residual-continuation-runtime'),recovery=join(parent,'recovery');
 need(expected.stage===join(parent,'event294-browser-only-runtime')&&parent===join(root,'m6-successor-70013b5139292ef33563447f8937c8f132feabd2')&&kinds.every(k=>expected[k]===join(expected.stage,k)),'PATHS');
 let first=null;
 return async observedPaths=>{
  need(same(observedPaths,expected),'PATHS');await verifyCustody();
  need(await portFree(33072)&&await portFree(44172),'LISTENERS');
  const app=await checkout(application);need(app.sha===pin.applicationSha&&app.tree===pin.applicationTree&&app.clean===true,'APPLICATION');
  need(digest(await inventory(join(application,'apps/api/dist'),{privateRoot:false}))===pin.buildSha256,'BUILD');
  const dirs=[root,parent,expected.stage,prior,recovery,...[expected.stage,prior,recovery,root].flatMap(p=>kinds.map(k=>join(p,k)))];await inspectDirectories(dirs);
  const all={};for(const k of kinds){const current=await inventory(expected[k]),previous=await inventory(join(prior,k)),backup=await inventory(join(recovery,k)),retained=await inventory(join(root,k));need(same(current,previous)&&same(backup,retained),'STORAGE_COPIES');const map=new Map(current.map(r=>[r[0],r]));need(map.size===current.length&&backup.every(r=>same(r,map.get(r[0]))),'HISTORICAL_FILES');const old=new Set(backup.map(r=>r[0]));const added=current.filter(r=>!old.has(r[0]));need(k==='documents'?added.length===6&&added.every(r=>r.length===3&&uuid(r[0])&&Number.isSafeInteger(r[1])&&r[1]>0&&/^[a-f0-9]{64}$/.test(r[2])):added.length===0,'STORAGE_DELTA');all[k]={current,backup,added};}
  const oid=await inspectM7SourceDatabase(db,pin.database,all.documents.added);
  await verifyCustody();need(await portFree(33072)&&await portFree(44172)&&same(app,await checkout(application)),'SOURCE_DRIFT');
  const storageSha256=digest(kinds.map(k=>[k,all[k].current]));const fingerprint=digest({oid,storageSha256,backup:kinds.map(k=>all[k].backup)});need(first===null||first===fingerprint,'SOURCE_DRIFT');first=fingerprint;
  return Object.freeze({applicationSha:app.sha,applicationTree:app.tree,buildSha256:pin.buildSha256,database:pin.database,quiescent:true,pathsMatch:true,priorStorageMatched:true,storageSha256});
 };
}
export async function inspectM7PrivateDirectories(paths){
 const seen=new Set();for(const p of paths){const s=await lstat(p);const key=s.dev+':'+s.ino;need(resolve(p)===p&&await realpath(p)===p&&s.isDirectory()&&s.uid===process.getuid()&&!(s.mode&0o077)&&!seen.has(key),'DIRECTORY');seen.add(key);}
}
export async function m7PortFree(port,run=promisify(execFile)){
 need([33072,44172].includes(port),'PORT');try{await run('/usr/sbin/lsof',['-nP','-iTCP:'+port,'-sTCP:LISTEN','-t'],{timeout:10000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin:/usr/sbin:/sbin'}});return false;}catch(e){return e.code===1&&!e.killed&&!e.signal&&!e.stdout&&!e.stderr;}
}
// The only native factory uses the existing independently reviewed M6 custody observers.
export async function createM7NativeSourceInspector({root,application,db}){
 const {homedir}=await import('node:os');need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&root===join(await realpath(homedir()),'Construction-ERP-Prototype-Runtime')&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_/.test(k)),'MAC');
 const [{terminalAnchor,terminalPaths,readM7PrivateTerminalReceipt},{inventory,verifyRuntimePair},{inspectPostM4,readCheckoutIdentity},{loadM4ProcessReceipts,createMacObservation},{validContainer}]=await Promise.all([import('./m7-terminal-source.mjs'),import('./m6-runtime-evidence.mjs'),import('./m6-post-m4-inspect.mjs'),import('./m6-mac-observation.mjs'),import('./prototype-actors.mjs')]);
 const historical=join(root,'m4-upgrade-9417f07c','rehearsal','application'),containerReceipt=await readM7PrivateTerminalReceipt(join(root,'container-owned.json')),expected=await loadM4ProcessReceipts(root,historical),observe=createMacObservation({root,application:historical,expected,containerReceipt,validContainer});
 const verifyCustody=async()=>{await inspectPostM4(root);verifyRuntimePair(expected,await observe(),historical,process.execPath,process.getuid());};
 return createM7SourceInspector({root,application,db,anchor:terminalAnchor,paths:terminalPaths(root),inventory,checkout:readCheckoutIdentity,verifyCustody,portFree:m7PortFree,inspectDirectories:inspectM7PrivateDirectories});
}
