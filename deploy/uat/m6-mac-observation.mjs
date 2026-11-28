// Read-only observation adapter for the closed M4 runtime; no deployment authority.
import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const TARGET='9417f07c609dbc091b5bbe2e09071c5e2c316459';
const DB='proto_a_01';
const roles=[['api',33071,'apps/api/dist/main.js'],['web',44171,'deploy/uat/serve-web.mjs']];
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const identity=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
async function directory(path){const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(path)===path,'M6_MAC_RECEIPT_DIRECTORY_INVALID');}
async function privateJson(path){
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const s=await f.stat();need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=1048576,'M6_MAC_PRIVATE_RECEIPT_INVALID');
    const bytes=await f.readFile();need(bytes.length===s.size&&identity(s,await f.stat())&&identity(s,await lstat(path)),'M6_MAC_RECEIPT_DRIFT');return JSON.parse(bytes.toString('utf8'));
  }finally{await f.close();}
}
export function normalizeProcessReceipt(r,application,kind){
  const spec=roles.find(x=>x[0]===kind);need(spec&&resolve(application)===application,'M6_MAC_PROCESS_CONTEXT_INVALID');
  const [,port,path]=spec;
  need(r?.releaseSha===TARGET&&r.databaseName===DB&&r.port===port&&r.entry===join(application,path)&&Number.isSafeInteger(r.pid)&&r.pid>1&&typeof r.born==='string'&&r.born.trim()===r.born&&r.born.length>0,'M6_MAC_PROCESS_RECEIPT_INVALID');
  return {pid:r.pid,born:r.born,port,entry:r.entry};
}
export function parseListeners(output){
  need(typeof output==='string'&&output.length>0,'M6_MAC_LISTENER_OUTPUT_INVALID');
  const pids=new Set(),addresses=new Set();let pid=null,fd=null;const entries=new Set();
  for(const line of output.trimEnd().split('\n')){
    if(/^p[1-9][0-9]*$/.test(line)){need(fd===null,'M6_MAC_LISTENER_OUTPUT_INVALID');pid=Number(line.slice(1));need(Number.isSafeInteger(pid)&&!pids.has(pid),'M6_MAC_LISTENER_OUTPUT_INVALID');pids.add(pid);}
    else if(/^f[0-9]+$/.test(line)){need(pid!==null&&fd===null,'M6_MAC_LISTENER_OUTPUT_INVALID');fd=line.slice(1);}
    else if(/^n[^\s]+$/.test(line)){need(pid!==null&&fd!==null&&!entries.has(pid+':'+fd),'M6_MAC_LISTENER_OUTPUT_INVALID');entries.add(pid+':'+fd);addresses.add(line.slice(1));fd=null;}
    else need(false,'M6_MAC_LISTENER_OUTPUT_INVALID');
  }
  need(fd===null&&entries.size>0&&[...pids].every(p=>[...entries].some(e=>e.startsWith(p+':'))),'M6_MAC_LISTENER_OUTPUT_INVALID');
  return {listenerPids:[...pids].sort((a,b)=>a-b),listenAddresses:[...addresses].sort()};
}
export async function loadM4ProcessReceipts(root,application){
  need(resolve(root)===root&&application===join(root,'m4-upgrade-9417f07c','rehearsal','application'),'M6_MAC_CUSTODY_PATH_INVALID');
  const stage=join(root,'m4-upgrade-9417f07c'),cutover=join(stage,'cutover');
  for(const path of [root,stage,cutover])await directory(path);
  const result={};for(const [kind] of roles)result[kind]=normalizeProcessReceipt(await privateJson(join(cutover,'source-'+kind+'-owned.json')),application,kind);
  need(result.api.pid!==result.web.pid,'M6_MAC_DUPLICATE_PROCESS');return result;
}
export async function collectRuntimeObservation({expected,application,containerReceipt,validateContainer,command,health}){
  need(typeof validateContainer==='function'&&typeof command==='function'&&typeof health==='function'&&/^[a-f0-9]{64}$/.test(containerReceipt?.id??''),'M6_MAC_OBSERVATION_INPUT_INVALID');
  const pod=JSON.parse(await command('podman',['inspect',containerReceipt.id]));
  need(Array.isArray(pod)&&pod.length===1&&validateContainer(pod[0],containerReceipt)===true,'M6_MAC_CONTAINER_IDENTITY_INVALID');
  const result={};
  for(const [kind,port,path] of roles){
    const p=expected?.[kind];need(p?.port===port&&p.entry===join(application,path)&&Number.isSafeInteger(p.pid)&&p.pid>1,'M6_MAC_OBSERVATION_PROCESS_INVALID');
    const id=String(p.pid),args=await command('/bin/ps',['-ww','-p',id,'-o','command=']),uid=await command('/bin/ps',['-p',id,'-o','uid=']),born=await command('/bin/ps',['-p',id,'-o','lstart=']);
    need(/^\d+$/.test(uid.trim())&&Number.isSafeInteger(Number(uid.trim())),'M6_MAC_OBSERVATION_UID_INVALID');
    const listeners=parseListeners(await command('/usr/sbin/lsof',['-nP','-iTCP:'+port,'-sTCP:LISTEN','-Fpfn']));
    result[kind]={pid:p.pid,command:args.trim(),uid:Number(uid.trim()),born:born.trim(),...listeners};
  }
  result.health=await health();return result;
}
export function createMacObservation({root,application,expected,containerReceipt,validContainer}){
  need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0','M6_MAC_NATIVE_ENVIRONMENT_REQUIRED');
  need(application===join(root,'m4-upgrade-9417f07c','rehearsal','application')&&typeof validContainer==='function','M6_MAC_CUSTODY_PATH_INVALID');
  const env=Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL'].filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]]));
  const command=async(exe,args)=>{try{return (await run(exe,args,{cwd:application,env,timeout:15000,maxBuffer:2097152})).stdout.trim();}catch{throw Object.assign(new Error('M6_MAC_OBSERVATION_COMMAND_FAILED'),{safeCode:'M6_MAC_OBSERVATION_COMMAND_FAILED'});}};
  const health=async()=>{const r=await fetch('http://127.0.0.1:33071/api/v1/health/ready',{redirect:'error',signal:AbortSignal.timeout(4000)});need(r.ok,'M6_MAC_HEALTH_HTTP_FAILED');return r.json();};
  return ()=>collectRuntimeObservation({expected,application,containerReceipt,validateContainer:(pod,receipt)=>validContainer(pod,receipt,join(root,'db')),command,health});
}
