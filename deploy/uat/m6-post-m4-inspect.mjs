#!/usr/bin/env node
// Read-only successor entry: no database, runtime launch, grants, replay or release authority.
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {inspectM4HistoricalCustody,M4_CUSTODY} from './m6-post-m4-custody.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const sha40=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
export async function readCheckoutIdentity(application){
  need(await realpath(application)===application,'M6_M4_CHECKOUT_PATH_INVALID');
  const env={...Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL'].filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]])),
    GIT_OPTIONAL_LOCKS:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'};
  const git=(...args)=>execFileSync('git',['-c','core.fsmonitor=false','-c','core.untrackedCache=false',...args],
    {cwd:application,env,encoding:'utf8',timeout:15000,maxBuffer:1048576,stdio:['ignore','pipe','pipe']}).trim();
  need(git('rev-parse','--show-toplevel')===application,'M6_M4_CHECKOUT_ROOT_INVALID');
  const sha=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
  need(sha40(sha)&&sha40(tree),'M6_M4_CHECKOUT_IDENTITY_INVALID');
  return {sha,tree,clean:git('status','--porcelain=v1','--untracked-files=normal')===''};
}
export function verifyM4Checkout(identity){
  need(identity?.sha===M4_CUSTODY.target&&identity.tree===M4_CUSTODY.tree&&identity.clean===true,
    'M6_M4_CHECKOUT_IDENTITY_MISMATCH');
  return true;
}
export async function inspectPostM4(root){
  const {application,...receipt}=await inspectM4HistoricalCustody(root);
  verifyM4Checkout(await readCheckoutIdentity(application));
  return {...receipt,status:'M6_POST_M4_HISTORICAL_CUSTODY_AND_CHECKOUT_PASS',
    checkoutIdentityVerified:true,liveRuntimeVerified:false,mayMutate:false};
}
async function main(){
  need(process.argv.length===4&&process.argv[2]==='--inspect-receipts'&&sha40(process.argv[3]),'M6_PINNED_INSPECT_MODE_REQUIRED');
  need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&
    !Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_/.test(k)),
    'M6_ORIGINAL_MAC_INSPECTION_REQUIRED');
  const source=resolve(fileURLToPath(new URL('../../',import.meta.url)));
  const candidate=await readCheckoutIdentity(source);
  need(candidate.sha===process.argv[3]&&candidate.clean,'M6_INSPECTOR_SOURCE_NOT_EXACT');
  const result=await inspectPostM4(join(homedir(),'Construction-ERP-Prototype-Runtime'));
  console.log(JSON.stringify({...result,inspectorSha:candidate.sha}));
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===await realpath(new URL(import.meta.url))){
  try{await main();}catch(e){console.log(JSON.stringify({status:'M6_POST_M4_INSPECTION_BLOCKED',
    safeCode:/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'M6_PRIVATE_INSPECTION_FAILURE',
    liveRuntimeVerified:false,mayMutate:false,productionAuthorized:false}));process.exitCode=1;}
}
