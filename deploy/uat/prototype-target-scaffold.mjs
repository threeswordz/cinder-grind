/**
 * GL08 non-Production preparation only. Never starts a service or modifies an
 * existing checkout/database/role. Requires a separate authorized operator.
 * New directories are create-only; failure leaves new resources for inspection
 * rather than deleting anything which might have become somebody else's data.
 */
import {homedir} from 'node:os';
import {join,resolve,isAbsolute} from 'node:path';
import {lstat,mkdir,open,realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';

const run=promisify(execFile);
const SHA=/^[a-f0-9]{40}$/;
const CONFIRM='CREATE_FRESH_SYNTHETIC_ONLY';
const ALLOWED_ORIGINS=new Set([
  'https://github.com/threeswordz/cinder-grind.git',
  'https://github.com/threeswordz/cinder-grind',
  'git@github.com:threeswordz/cinder-grind.git',
  'git@github.com:threeswordz/cinder-grind',
]);
const getResult=(status,gaps,extra={})=>({
  purpose:'ISOLATED_PROTOTYPE_SCAFFOLD',status,gaps,
  originStringMatched:false,productionAuthorized:false,retainedDataUsed:false,
  realCompanyGrantsModified:false,applicationRunning:false,
  databaseStarted:false,portReserved:false,prototypeFrozen:false,
  ownerBusinessUatCompleted:false, ...extra,
});
const identity=async(path,uid)=>{
  const st=await lstat(path);
  if(!st.isDirectory()||st.isSymbolicLink()||(uid!==undefined&&st.uid!==uid)||
      (st.mode&0o022)!==0||await realpath(path)!==path)
    throw Error('TARGET_IDENTITY_UNSAFE');
};
const absent=async path=>{
  try {await lstat(path);return false;}
  catch(e){if(e?.code==='ENOENT')return true;throw e;}
};
async function sourceInspection(checkout,sha,{git=async args=>
  (await run('git',['-C',checkout,...args],{timeout:10000,maxBuffer:32768})).stdout.trim()}={}){
  const [toplevel,head,clean,origin]=await Promise.all([
    git(['rev-parse','--show-toplevel']),git(['rev-parse','HEAD']),
    git(['status','--porcelain']),git(['remote','get-url','origin']),
  ]);
  if(resolve(toplevel)!==checkout||head!==sha||clean!==''||!ALLOWED_ORIGINS.has(origin))
    throw Error('SOURCE_IDENTITY_OR_SHA_INVALID');
}

export function makeManifest(sha,checkout,root){
  return {
    schemaVersion:1,purpose:'ISOLATED_PROTOTYPE_TARGET_PREFLIGHT',mode:'isolated-synthetic',
    expectedMainSha:sha,companyCodes:['PROTO_A','PROTO_B'],projectCount:2,
    personas:['Ben','Nancy','Khaimook','Jai','Store Site','Foreman','Koh','Porn'],
    productionConnected:false,retainedDataUsed:false,realCompanyGrantsModified:false,
    runtime:{
      checkoutRoot:checkout,isolationRoot:root,
      databaseRoot:join(root,'db'),documentsRoot:join(root,'documents'),
      hrKeysRoot:join(root,'hrkeys'),
      apiOrigin:'http://127.0.0.1:33071',webOrigin:'http://127.0.0.1:44171',
      postgresHost:'127.0.0.1',postgresPort:55471,postgresDbName:'proto_a_01',
    },
  };
}

/**
 * run scaffolds a NEW empty target with an existing clean exact-SHA checkout.
 * All files created by this function are inside the new isolated runtime root.
 */
export async function scaffold({mode,sha,confirm='',home=homedir(),
  nodeVersion=process.versions.node,uid=process.getuid?.(),git}={}){
  if(!['plan','prepare'].includes(mode)||!SHA.test(sha??''))
    return getResult('SCAFFOLD_BLOCKED',['INVALID_ACTION_OR_SHA']);
  if(mode==='prepare'&&confirm!==CONFIRM)
    return getResult('SCAFFOLD_BLOCKED',['EXPLICIT_LOCAL_OPERATOR_OPT_IN_REQUIRED']);
  if(nodeVersion!=='24.21.0')return getResult('SCAFFOLD_BLOCKED',['PINNED_NODE_24_21_0_REQUIRED']);
  if(uid===0)return getResult('SCAFFOLD_BLOCKED',['ROOT_OPERATOR_NOT_ALLOWED']);
  try{
    if(!isAbsolute(home)||resolve(home)!==home||await realpath(home)!==home)
      return getResult('SCAFFOLD_BLOCKED',['HOME_IDENTITY_UNSAFE']);
    await identity(home,uid);
    const checkout=join(home,'Construction-ERP-Prototype-Checkout');
    const root=join(home,'Construction-ERP-Prototype-Runtime');
    if(!(await absent(root)))return getResult('SCAFFOLD_BLOCKED',['TARGET_ALREADY_EXISTS_NO_OVERWRITE']);
    await identity(checkout,uid);
    await sourceInspection(checkout,sha,{git});
    if(mode==='plan')return getResult('OPERATOR_PLAN_READY',[],{
      filesCreated:0,manifestCreated:false,liveGitHubCiVerified:false,originStringMatched:true,
      next:'CREATE_ONLY_AFTER_EXPLICIT_LOCAL_APPROVAL',
    });
    // The root MUST be absent at this instant, and mkdir MUST refuse an existing
    // directory; do not use recursive mkdir or touch any retained path.
    const oldUmask=process.umask(0o077);
    try{
      await mkdir(root,{mode:0o700});
      for(const name of ['db','documents','hrkeys'])await mkdir(join(root,name),{mode:0o700});
      const config=makeManifest(sha,checkout,root);
      const file=await open(join(root,'prototype-target.json'),'wx',0o600);
      try{await file.writeFile(JSON.stringify(config,null,2)+'\n','utf8');}
      finally{await file.close();}
      // Load the checker from the verified exact-SHA checkout, not this external operator kit.
      const checker=pathToFileURL(join(checkout,'deploy','uat','prototype-target-preflight.mjs')).href;
      const {assessPrototypeTarget}=await import(checker);
      const verdict=await assessPrototypeTarget(config,sha);
      if(verdict.status!=='LOCAL_SAFETY_PREREQUISITES_OBSERVED'||verdict.gaps.length)
        return getResult('SCAFFOLD_BLOCKED',['POST_CREATE_PREFLIGHT_FAILED_INSPECT_NEW_ROOT'],{
          filesCreated:true,manifestCreated:true,actualRuntimeVerified:false,originStringMatched:true,
        });
      return getResult('FRESH_PRIVATE_TARGET_PREPARED',[],{
        filesCreated:true,manifestCreated:true,actualRuntimeVerified:false,originStringMatched:true,
        effectivePermissionsVerified:false,liveGitHubCiVerified:false,
        next:'RUN_PORT_PREFLIGHT_AND_VERIFY_OPERATOR_ENVIRONMENT',
      });
    }finally{process.umask(oldUmask);}
  }catch{
    return getResult('SCAFFOLD_BLOCKED',['CHECKOUT_OR_TARGET_SAFETY_PRECONDITION_FAILED']);
  }
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const args=process.argv.slice(2);
  const mode=args[0]==='--plan'?'plan':args[0]==='--prepare'?'prepare':null;
  const expected=args[1]==='--sha'&&SHA.test(args[2]??'')?args[2]:null;
  const confirm=args[3]==='--confirm'?args[4]:'';
  const allowed=args.length===(mode==='plan'?3:5)&&
    (mode!=='prepare'||args[3]==='--confirm');
  if(!mode||!expected||!allowed){
    process.stderr.write('Usage: node deploy/uat/prototype-target-scaffold.mjs --plan --sha EXACT_MAIN_SHA\n'
      +'       node deploy/uat/prototype-target-scaffold.mjs --prepare --sha EXACT_MAIN_SHA --confirm CREATE_FRESH_SYNTHETIC_ONLY\n');
    process.exitCode=2;
  }else{
    const answer=await scaffold({mode,sha:expected,confirm});
    process.stdout.write(JSON.stringify(answer,null,2)+'\n');
    if(answer.gaps.length)process.exitCode=1;
  }
}