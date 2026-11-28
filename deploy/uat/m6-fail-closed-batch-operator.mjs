#!/usr/bin/env node
// Exact-source Mac entry. No production, no migrations and no business replay.
// The only permitted mutation is four expressly authorized synthetic sessions.
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {realpath} from 'node:fs/promises';
import {readCheckoutIdentity} from './m6-post-m4-inspect.mjs';
import {runM6Batch} from './m6-fail-closed-batch.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const sha=/^[a-f0-9]{40}$/;
async function main(){
 const mode=process.argv[2],expected=process.argv[3];
 need(process.argv.length===4&&['--inspect-only','--authorize-four-synthetic-sessions'].includes(mode)&&sha.test(expected??''),'M6_BATCH_EXPLICIT_SCOPE_REQUIRED');
 need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(k)),'M6_BATCH_EXACT_MAC_REQUIRED');
 const source=resolve(fileURLToPath(new URL('../../',import.meta.url)));
 const check=async()=>{const x=await readCheckoutIdentity(source);need(x.sha===expected&&x.clean===true,'M6_BATCH_SOURCE_DRIFT');};
 await check();
 const result=await runM6Batch({sourceSha:expected,authorizeSessions:mode==='--authorize-four-synthetic-sessions',execute:async(id,args)=>{
  await check();
  const run=spawnSync(process.execPath,args,{cwd:source,env:process.env,stdio:'inherit',timeout:480000,windowsHide:true});
  await check();
  return {exitCode:run.error||run.signal||run.status!==0?1:0};
 }});
 return result;
}
const entry=process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null);
if(entry&&entry===await realpath(new URL(import.meta.url))){
 try{const result=await main();console.log(JSON.stringify(result));
  if(!['M6_BATCH_READ_ONLY_PASS','M6_BATCH_AUTHENTICATED_CD_PASS'].includes(result.status))process.exitCode=1;
 }catch(e){console.log(JSON.stringify({status:'M6_BATCH_BLOCKED',safeCode:/^M6_BATCH_[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'M6_BATCH_PRIVATE_FAILURE',sessionsStarted:false,milestone6Accepted:false,productionAuthorized:false}));process.exitCode=1;}
}
