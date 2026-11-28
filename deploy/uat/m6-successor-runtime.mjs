// Successor-only runtime construction. No launch on import, migration, login,
// database reset, or retained service stop. One owned attempt per native caller.
import {createServer} from 'node:http';
import {readFile,lstat,realpath,readdir,cp,mkdir,open} from 'node:fs/promises';
import {join,resolve,extname,relative,isAbsolute,dirname} from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {verifyResidualDocumentDelta} from './m6-residual-document-delta.mjs';
import {admitRecoveryRuntimeFiles} from './m6-residual-recovery-files.mjs';
const run=promisify(execFile);
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RUNTIME_'+c),{safeCode:'M6_RUNTIME_'+c});};
const API='http://127.0.0.1:33072',WEB='http://127.0.0.1:44172',DB='m6_successor_rehearsal';
const kinds=['documents','uploads','hrkeys'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const env=()=>Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL'].filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]]));
const within=(base,p)=>{const r=relative(base,p);return r!==''&&r!=='..'&&!r.startsWith('../')&&!isAbsolute(r);};
export function successorRuntimeEnvironment({password,stage,keyring}){
 need(/^[a-f0-9]{64}$/.test(password??'')&&typeof stage==='string'&&resolve(stage)===stage&&keyring&&typeof keyring==='object'&&!Array.isArray(keyring)&&typeof keyring.proto1==='string','ENVIRONMENT');
 return {...env(),NODE_ENV:'uat',API_HOST:'127.0.0.1',API_PORT:'33072',WEB_ORIGIN:WEB,DATABASE_URL:'postgresql://proto_runtime:'+password+'@127.0.0.1:55471/'+DB+'?schema=public',STORAGE_ROOT:join(stage,'documents'),DOCUMENT_UPLOAD_TEMP_ROOT:join(stage,'uploads'),HR_PRIVATE_KEYS:JSON.stringify(keyring),HR_PRIVATE_ACTIVE_KEY_ID:'proto1'};
}
export function assertSuccessorWebTarget(scripts){
 need(Array.isArray(scripts)&&scripts.length>0&&scripts.every(s=>typeof s==='string')&&scripts.some(s=>s.includes(API+'/api/v1'))&&!scripts.some(s=>s.includes('127.0.0.1:33071')||s.includes('localhost:3000/api/v1')),'WEB_TARGET');return true;
}
export function resolveWebAsset(root,path){
 need(typeof root==='string'&&resolve(root)===root&&typeof path==='string'&&path.startsWith('/')&&!path.startsWith('//'),'WEB_PATH');let p;try{p=decodeURIComponent(path.split('?')[0]);}catch{need(false,'WEB_PATH');}need(!p.includes('\\')&&!p.includes('\0')&&!p.split('/').some(x=>x==='..'||x==='.'),'WEB_PATH');const result=resolve(root,'.'+p);need(result===root||within(root,result),'WEB_PATH');return result===root?join(root,'index.html'):result;
}
async function privateDir(p){const s=await lstat(p);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(p)===p,'DIRECTORY');}
async function freePort(port){const server=createServer();try{await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});}catch{need(false,'PORT_IN_USE');}finally{if(server.listening)await new Promise(ok=>server.close(ok));}}
async function scripts(root){const out=[];async function walk(p){for(const n of await readdir(p)){const f=join(p,n),s=await lstat(f);need(!s.isSymbolicLink()&&s.uid===process.getuid(),'WEB_ARTIFACT');if(s.isDirectory())await walk(f);else if(n.endsWith('.js')){need(s.isFile()&&s.size<=33554432&&out.length<1000,'WEB_ARTIFACT');out.push(await readFile(f,'utf8'));}}}await walk(root);return out;}
// Reuse the already built successor web bundle; never overwrite the old stage.
export async function reuseSuccessorWebBuild({stage,prior,inventory}){
 need(typeof stage==='string'&&resolve(stage)===stage&&prior===join(dirname(stage),'operational-batch','web')&&typeof inventory==='function','PRIOR_WEB');
 await privateDir(dirname(prior));const before=await inventory(prior,{privateRoot:false});assertSuccessorWebTarget(await scripts(prior));const target=join(stage,'web');
 await cp(prior,target,{recursive:true,force:false,errorOnExist:true});need(same(before,await inventory(target,{privateRoot:false}))&&same(before,await inventory(prior,{privateRoot:false})),'PRIOR_WEB_DRIFT');return before;
}
async function startWeb(root){const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};const server=createServer(async(req,res)=>{try{need(['GET','HEAD'].includes(req.method),'WEB_METHOD');let file=resolveWebAsset(root,req.url??'/');let s=await lstat(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(!s?.isFile()){need(!extname(file),'WEB_ASSET');file=join(root,'index.html');s=await lstat(file);}need(s.isFile()&&!s.isSymbolicLink()&&await realpath(file)===file&&within(root,file),'WEB_FILE');res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:await readFile(file));}catch{if(!res.headersSent)res.writeHead(404);res.end();}});await new Promise((ok,fail)=>{server.once('error',fail);server.listen(44172,'127.0.0.1',ok);});return server;}
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
async function stopChild(child){if(!child||child.exitCode!==null||child.signalCode!==null)return;const done=new Promise(ok=>child.once('close',ok));child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);try{await done;}finally{clearTimeout(timer);}}
// Caller supplies independent retained/recovery and committed-database checks.
// No service starts until both checks succeed. Runtime is never detached; cleanup
// always closes just the owned web server and spawned API child.
export async function withSuccessorRuntime({application,stage,recovery,reuseWebRoot,password,readKeyring,inventory,verifyCustody,verifyBeforeSessions,callback,residualDocuments,recoveryContinuation,browserOnlyContinuation=false}){
 need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(k)),'MAC');
 need([application,stage,recovery].every(p=>typeof p==='string'&&resolve(p)===p)&&!within(recovery,stage)&&!within(application,stage)&&!within(stage,recovery)&&!within(stage,application)&&[readKeyring,inventory,verifyCustody,verifyBeforeSessions,callback].every(f=>typeof f==='function'),'CONTEXT');
 // Default remains immutable files; only the residual runtime may use exact
 // source-bound append-only document verification after initial admission.
 const recovering=recoveryContinuation!==undefined;
 need(browserOnlyContinuation===false||browserOnlyContinuation===true&&!recovering&&residualDocuments===undefined&&stage===join(dirname(stage),'event294-browser-only-runtime')&&recovery===join(dirname(stage),'event294-residual-continuation-runtime')&&reuseWebRoot===join(dirname(stage),'operational-batch','web'),'BROWSER_ONLY_CONTEXT');
 if(recovering)need(residualDocuments!==undefined,'RECOVERY_CONTEXT');
 if(residualDocuments!==undefined&&!recovering)need(stage===join(dirname(stage),'event266-residual-runtime')&&typeof residualDocuments.readDelta==='function'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(residualDocuments.companyId??''),'DOCUMENT_DELTA_CONTEXT');
 await verifyCustody();await verifyBeforeSessions();await freePort(33072);await freePort(44172);await privateDir(recovery);
 const adopted=recovering?await admitRecoveryRuntimeFiles({stage,recovery,priorRuntime:recoveryContinuation.priorRuntime,authorization:recoveryContinuation.authorization,inventory,residualDocuments}):null;
 await mkdir(stage,{mode:0o700});await privateDir(stage);
 const expected={};if(adopted)await adopted.copy();else for(const k of kinds){expected[k]=await inventory(join(recovery,k));await cp(join(recovery,k),join(stage,k),{recursive:true,force:false,errorOnExist:true});need(same(expected[k],await inventory(join(stage,k))),'COPY');}
 let mutationWindow=false;
 const files=async()=>{if(adopted)return adopted.verify();const result={},recoveryNow={};for(const k of kinds){result[k]=await inventory(join(stage,k));recoveryNow[k]=await inventory(join(recovery,k));need(same(expected[k],recoveryNow[k]),'RECOVERY_FILE_DRIFT');}
   if(mutationWindow&&residualDocuments){const delta=await residualDocuments.readDelta();verifyResidualDocumentDelta({before:expected,after:result,recovery:recoveryNow,expected:delta.expected,documents:delta.documents,companyId:residualDocuments.companyId});}
   else for(const k of kinds)need(same(expected[k],result[k]),'FILE_DRIFT');
   return result;};
 const webRoot=join(stage,'web');let child,web,primary,result,cleanupFailed=false;const cleanupCodes=[];
 const cleanup=async(code,fn)=>{try{await fn();}catch{cleanupFailed=true;cleanupCodes.push(code);}};
 try{
  let priorWebInventory;
  if(reuseWebRoot)priorWebInventory=await reuseSuccessorWebBuild({stage,prior:reuseWebRoot,inventory});
  else {
  // Only a port-targeted web build, never overwrite the sealed application dist.
  const buildLog=await open(join(stage,'web-build.log'),'wx',0o600);try{const p=spawn('pnpm',['--filter','@construction-erp/web','exec','vite','build','--outDir',webRoot],{cwd:application,env:{...env(),VITE_API_BASE_URL:API+'/api/v1'},stdio:['ignore',buildLog.fd,buildLog.fd]});const code=await new Promise((ok,fail)=>{p.once('error',fail);p.once('close',ok);});need(code===0,'WEB_BUILD');}finally{await buildLog.close();}
  }
  await assertSuccessorWebTarget(await scripts(webRoot));const webInventory=await inventory(webRoot,{privateRoot:false}),apiInventory=await inventory(join(application,'apps/api/dist'),{privateRoot:false});
  await verifyCustody();await verifyBeforeSessions();await freePort(33072);await freePort(44172);
  const entry=join(application,'apps/api/dist/main.js'),log=await open(join(stage,'api.log'),'wx',0o600);
  try{child=spawn(process.execPath,[entry],{cwd:join(application,'apps/api'),env:successorRuntimeEnvironment({password,stage,keyring:await readKeyring(join(stage,'hrkeys/keyring.json'))}),stdio:['ignore',log.fd,log.fd]});await new Promise((ok,fail)=>{child.once('spawn',ok);child.once('error',fail);});}finally{await log.close();}
  const born=(await run('/bin/ps',['-p',String(child.pid),'-o','lstart='],{env:env(),timeout:10000})).stdout.trim();need(born.length>0,'PROCESS_BIRTH');web=await startWeb(webRoot);
  const check=async()=>{await verifyCustody();need(child.exitCode===null&&child.signalCode===null&&web.listening&&web.address()?.address==='127.0.0.1'&&web.address()?.port===44172,'PROCESS');const cmd=async(exe,args)=>(await run(exe,args,{env:env(),timeout:10000,maxBuffer:1048576})).stdout.trim();need(await cmd('/bin/ps',['-ww','-p',String(child.pid),'-o','command='])===process.execPath+' '+entry&&await cmd('/bin/ps',['-p',String(child.pid),'-o','uid='])===String(process.getuid())&&await cmd('/bin/ps',['-p',String(child.pid),'-o','lstart='])===born,'PROCESS_IDENTITY');const listeners=await cmd('/usr/sbin/lsof',['-nP','-iTCP:33072','-sTCP:LISTEN','-Fpfn']);need(same(listeners.split('\n').filter(x=>x.startsWith('p')),['p'+child.pid])&&same(listeners.split('\n').filter(x=>x.startsWith('n')),['n127.0.0.1:33072']),'API_LISTENER');const health=await fetch(API+'/api/v1/health/ready',{redirect:'error',signal:AbortSignal.timeout(4000)});need(health.ok,'HEALTH');const h=await health.json();need(h.status==='ok'&&h.database==='ok'&&h.documentStorage==='ok','HEALTH');};
  let healthy=false;for(let i=0;i<60;i++){if(child.exitCode!==null||child.signalCode!==null)break;try{const r=await fetch(API+'/api/v1/health/ready',{redirect:'error',signal:AbortSignal.timeout(1000)});if(r.ok){const h=await r.json();if(h.status==='ok'&&h.database==='ok'&&h.documentStorage==='ok'){healthy=true;break;}}}catch{}await wait(500);}need(healthy,'STARTUP');
  await check();await verifyBeforeSessions();await files();mutationWindow=true;result=await callback({origin:API,webOrigin:WEB,verifyRuntime:check,readFiles:files});await check();await files();need(same(webInventory,await inventory(webRoot,{privateRoot:false}))&&same(apiInventory,await inventory(join(application,'apps/api/dist'),{privateRoot:false}))&&(!reuseWebRoot||same(priorWebInventory,await inventory(reuseWebRoot,{privateRoot:false}))),'ARTIFACT_DRIFT');
 }catch(e){primary=e;}finally{await cleanup('WEB_STOP',async()=>{if(web)await new Promise((ok,fail)=>web.close(e=>e?fail(e):ok()));});await cleanup('API_STOP',()=>stopChild(child));if(recovering||browserOnlyContinuation){await cleanup('API_PORT',()=>freePort(33072));await cleanup('WEB_PORT',()=>freePort(44172));await cleanup('CUSTODY',verifyCustody);await cleanup('FILES',files);}else await cleanup('CUSTODY_OR_FILES',async()=>{await freePort(33072);await freePort(44172);await verifyCustody();await files();});}
 if((recovering||browserOnlyContinuation)&&cleanupFailed){const primarySafeCode=/^(M6_|BROWSER_)[A-Z0-9_]{1,100}$/.test(primary?.safeCode??'')?primary.safeCode:(primary?'M6_RUNTIME_PRIMARY_UNKNOWN':null);throw Object.assign(Error('M6_RUNTIME_RECOVERY_CLEANUP'),{safeCode:'M6_RUNTIME_RECOVERY_CLEANUP',primarySafeCode,cleanupCodes:[...cleanupCodes]});}
 need(!cleanupFailed,'CLEANUP');if(primary)throw primary;return result;
}
