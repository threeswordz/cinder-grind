// Owned restored API only. No source startup, web build, migrations or grants.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {m7RestorePortAllowed,isolatedM7Process} from './m7-source-process.mjs';
import {normalizeInventory} from './m6-backup-receipts.mjs';
const need=(ok,c)=>{if(!ok)throw Error('M7_API_'+c);};
const hex=(v,n=64)=>typeof v==='string'&&v.length===n&&/^[a-f0-9]+$/.test(v);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const env=()=>Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL'].filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]]));
const validKey=v=>typeof v==='string'&&/^[A-Za-z0-9+/]{43}=$/.test(v)&&Buffer.from(v,'base64').length===32&&Buffer.from(v,'base64').toString('base64')===v;
const appName=p=>'m7_api_'+p.database.slice('m7_restore_'.length);
export function m7ApiEnvironment({plan,dbPort,url,keyring,mode}){
 need(/^m7_restore_[a-f0-9]{12}$/.test(plan?.database??'')&&plan.role===plan.database.replace('m7_restore_','m7_restore_role_')&&m7RestorePortAllowed(plan.port)&&Number.isInteger(dbPort)&&dbPort>=55472&&dbPort<=55479&&plan.port!==dbPort&&['correct','missing','wrong'].includes(mode),'CONTEXT');
 const u=new URL(url);need(u.protocol==='postgresql:'&&u.hostname==='127.0.0.1'&&u.port===String(dbPort)&&u.username===plan.role&&hex(u.password)&&u.pathname==='/'+plan.database&&!u.hash&&u.search==='?schema=public&connection_limit=1','DATABASE_URL');
 const keyId=mode==='missing'?'m7missing':'proto1';need(keyring&&Object.keys(keyring).length===1&&validKey(keyring[keyId]),'KEYRING');u.searchParams.set('application_name',appName(plan));
 need(['documents','uploads','hrkeys'].every(k=>plan.storage?.[k]===join(plan.root,k)),'STORAGE');
 return {...env(),NODE_ENV:'uat',API_HOST:'127.0.0.1',API_PORT:String(plan.port),WEB_ORIGIN:'http://127.0.0.1:'+plan.port,DATABASE_URL:u.href,STORAGE_ROOT:plan.storage.documents,DOCUMENT_UPLOAD_TEMP_ROOT:plan.storage.uploads,HR_PRIVATE_KEYS:JSON.stringify(keyring),HR_PRIVATE_ACTIVE_KEY_ID:keyId};
}
const exec=promisify(execFile);
async function cmd(exe,args){try{return (await exec(exe,args,{env:env(),timeout:10000,maxBuffer:1048576})).stdout.trim();}catch{throw Error('M7_API_PROCESS_COMMAND');}}
export async function m7ApiPortFree(port){need(m7RestorePortAllowed(port),'PORT');try{await exec('/usr/sbin/lsof',['-nP','-iTCP:'+port,'-sTCP:LISTEN','-t'],{env:env(),timeout:10000,maxBuffer:65536});return false;}catch(e){return e.code===1&&!e.killed&&!e.signal&&!e.stdout&&!e.stderr;}}
async function privateKeyring(path){const s=await lstat(path);need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=4096&&await realpath(path)===path,'KEY_FILE');const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const t=await f.stat();need(s.dev===t.dev&&s.ino===t.ino&&s.ctimeMs===t.ctimeMs,'KEY_FILE');const bytes=await f.readFile();try{const a=await f.stat();need(a.ctimeMs===s.ctimeMs&&a.size===s.size&&await realpath(path)===path,'KEY_FILE');return JSON.parse(bytes.toString('utf8'));}finally{bytes.fill(0);}}finally{await f.close();}}
async function startOwned({entry,application,environment,log}){const f=await open(log,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{const child=spawn(process.execPath,[entry],{cwd:join(application,'apps/api'),env:environment,stdio:['ignore',f.fd,f.fd],shell:false});await new Promise((ok,no)=>{child.once('spawn',ok);child.once('error',no);});return child;}finally{await f.close();}}
async function stopOwned(child){if(!child||child.exitCode!==null||child.signalCode!==null)return;let timer,force;const ended=new Promise(ok=>child.once('close',ok));child.kill('SIGTERM');try{await Promise.race([ended,new Promise((_,no)=>{timer=setTimeout(()=>{child.kill('SIGKILL');force=setTimeout(()=>no(Error('M7_API_STOP_TIMEOUT')),3000);},5000);})]);}finally{clearTimeout(timer);clearTimeout(force);}}
async function observeProcess(child,port){const id=String(child.pid);const [command,uid,born,listeners]=await Promise.all([cmd('/bin/ps',['-ww','-p',id,'-o','command=']),cmd('/bin/ps',['-p',id,'-o','uid=']),cmd('/bin/ps',['-p',id,'-o','lstart=']),cmd('/usr/sbin/lsof',['-nP','-iTCP:'+port,'-sTCP:LISTEN','-Fpfn'])]);return {pid:child.pid,command,uid:Number(uid),born,listenerPids:listeners.split('\n').filter(x=>x.startsWith('p')).map(x=>Number(x.slice(1))),listenAddresses:listeners.split('\n').filter(x=>x.startsWith('n')).map(x=>x.slice(1))};}
async function health(port){try{const r=await fetch('http://127.0.0.1:'+port+'/api/v1/health/ready',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok){await r.body?.cancel();return false;}const h=await r.json();return h.status==='ok'&&h.database==='ok'&&h.documentStorage==='ok';}catch{return false;}}
export function createM7RestoredApi({claim,binding,application,buildSha256,dbPort,mode,expectedKeySha,targetConnection,inventory,checkout,readKeyring=privateKeyring,isPortFree=m7ApiPortFree,start=startOwned,stop=stopOwned,observe=observeProcess,probeHealth=health,wait=delay}){
 const plan=claim?.plan,capture=binding?.capture();need(plan?.sha===capture?.sha&&plan.tree===capture.tree&&hex(buildSha256)&&hex(expectedKeySha)&&hex(binding.manifestSha)&&['correct','missing','wrong'].includes(mode)&&isAbsolute(application)&&resolve(application)===application&&[claim.verifyPaths,targetConnection,inventory,checkout,readKeyring,isPortFree,start,stop,observe,probeHealth,wait].every(f=>typeof f==='function'),'CONTEXT');
 const entry=join(application,'apps/api/dist/main.js');let child,identity,attempted=false,stopped=false;
 const pinned=async()=>{await claim.verifyPaths();const c=await checkout(application);need(c.sha===plan.sha&&c.tree===plan.tree&&c.clean===true&&hash(await inventory(join(application,'apps/api/dist'),{privateRoot:false}))===buildSha256,'APP_DRIFT');need(hash(normalizeInventory(await inventory(plan.storage.hrkeys),false))===expectedKeySha,'KEY_DRIFT');};
 const owned=async()=>{need(child&&child.exitCode===null&&child.signalCode===null&&isolatedM7Process(capture.sourceProcess,child.pid,plan.port),'PROCESS');const x=await observe(child,plan.port);need(x.pid===child.pid&&x.command===process.execPath+' '+entry&&x.uid===process.getuid()&&typeof x.born==='string'&&x.born.length>0&&(!identity||x.born===identity.born)&&same(x.listenerPids,[child.pid])&&same(x.listenAddresses,['127.0.0.1:'+plan.port]),'PROCESS_IDENTITY');return x;};
 const inspectApi=async p=>{need(p===plan&&!stopped&&identity,'PLAN');await pinned();const o=await owned();need(await probeHealth(plan.port)===true,'HEALTH');return {...identity,listenerPids:o.listenerPids,listenAddresses:o.listenAddresses,sha:plan.sha,tree:plan.tree,database:plan.database,role:plan.role,storage:structuredClone(plan.storage),health:'ok',keyMode:mode,manifestSha:binding.manifestSha};};
 return Object.freeze({isPortFree,
   async launchPinnedApi(p){need(p===plan&&!attempted&&!stopped,'ALREADY_ATTEMPTED');attempted=true;await pinned();need(await isPortFree(plan.port)===true,'PORT_OCCUPIED');const environment=m7ApiEnvironment({plan,dbPort,url:targetConnection(),keyring:await readKeyring(join(plan.storage.hrkeys,'keyring.json')),mode});
     child=await start({entry,application,environment,log:join(plan.root,'api.log')});need(isolatedM7Process(capture.sourceProcess,child.pid,plan.port),'PROCESS');let ready=false;for(let i=0;i<60;i++){need(child.exitCode===null&&child.signalCode===null,'STARTUP_EXIT');if(await probeHealth(plan.port)){ready=true;break;}await wait(1000);}need(ready,'NOT_READY');const o=await owned();identity=Object.freeze({pid:o.pid,born:o.born,uid:o.uid,entry});await inspectApi(plan);return structuredClone(identity);},
   inspectApi,
   async verifyOwnedSessions(sessions){if(!identity||stopped)return sessions.length;await owned();const good=sessions.filter(s=>s.role===plan.role&&s.application===appName(plan)&&s.clientAddr==='127.0.0.1'&&s.type==='client backend'&&Number.isSafeInteger(s.pid)&&s.pid>0&&typeof s.backendStart==='string');return sessions.length-good.length+Math.max(0,good.length-1);},
   async stopOwnedApi(p,handle){need(p===plan&&!stopped&&(!handle||!identity||same(handle,identity)),'STOP_IDENTITY');stopped=true;await stop(child);need((!child||child.exitCode!==null||child.signalCode!==null)&&await isPortFree(plan.port)===true,'STOP');await pinned();return true;}
 });
}
