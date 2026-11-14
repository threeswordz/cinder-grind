// #338: compare all emitted API and web files with fresh output in owned scratch.
// Never rebuild in-place, restart a process, run a migration or touch the DB.
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {lstat,realpath,readFile,readdir,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {join,resolve,relative,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {SOURCE,API,safeEnvironment} from './prototype-actors.mjs';

const execute=promisify(execFile);
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const hash=b=>createHash('sha256').update(b).digest('hex');
const digest=entries=>hash(JSON.stringify(entries));
async function command(exe,args,cwd,env=safeEnvironment()){
  try{return (await execute(exe,args,{cwd,env,timeout:180000,maxBuffer:2097152})).stdout.trim();}
  catch{throw Object.assign(new Error(),{safeCode:'MATERIAL_ARTIFACT_BUILD_FAILED'});}
}
// Names and every byte participate in the digest. Extra files, links, special
// files, shared writable output or a changed file during reading are refused.
export async function artifactInventory(root){
  demand(resolve(root)===root,'MATERIAL_ARTIFACT_PATH_INVALID');
  const entries=[];
  async function walk(path){
    const s=await lstat(path);
    demand(s.uid===process.getuid()&&!s.isSymbolicLink()&&!(s.mode&0o022)&&
      (s.isDirectory()||s.isFile()),'MATERIAL_ARTIFACT_UNSAFE_ENTRY');
    if(s.isDirectory()){
      demand(await realpath(path)===path,'MATERIAL_ARTIFACT_PATH_INVALID');
      for(const name of (await readdir(path)).sort())await walk(join(path,name));
    }else{
      demand(s.nlink===1&&s.size<=33554432,'MATERIAL_ARTIFACT_UNSAFE_ENTRY');
      const bytes=await readFile(path),after=await lstat(path);
      demand(s.dev===after.dev&&s.ino===after.ino&&s.size===after.size&&s.mtimeMs===after.mtimeMs&&
        s.ctimeMs===after.ctimeMs&&s.mode===after.mode&&after.nlink===1,
        'MATERIAL_ARTIFACT_CHANGED_DURING_READ');
      entries.push([relative(root,path).split(sep).join('/'),bytes.length,hash(bytes)]);
    }
  }
  await walk(root);
  demand(entries.length>0&&entries.length<=4096,'MATERIAL_ARTIFACT_INVENTORY_INVALID');
  return entries.sort(([a],[b])=>a<b?-1:a>b?1:0);
}
export function compareArtifactInventories(actual,expected){
  demand(Array.isArray(actual)&&Array.isArray(expected)&&expected.length>0&&
    JSON.stringify(actual)===JSON.stringify(expected),'MATERIAL_COMPILED_ARTIFACT_MISMATCH');
  return {files:actual.length,sha256:digest(actual)};
}

export async function verifyMaterialArtifacts(checkout){
  demand(resolve(checkout)===checkout&&await realpath(checkout)===checkout,'MATERIAL_ARTIFACT_PATH_INVALID');
  demand(process.versions.node==='24.21.0','NODE_24_21_0_REQUIRED');
  demand(await command('git',['rev-parse','HEAD'],checkout)===SOURCE&&
    await command('git',['status','--porcelain'],checkout)==='','SOURCE_CHANGED_STOP');
  for(const dir of ['', 'apps/api','apps/web']){
    const names=await readdir(join(checkout,dir));
    demand(!names.some(n=>['.env','.env.local','.env.production','.env.production.local'].includes(n)),'MATERIAL_BUILD_ENV_FILE_REFUSED');
  }
  const apiRoot=join(checkout,'apps/api'),webRoot=join(checkout,'apps/web');
  const apiRequire=createRequire(join(apiRoot,'package.json')),webRequire=createRequire(join(webRoot,'package.json'));
  demand(apiRequire('typescript/package.json').version==='5.9.3'&&
    webRequire('vite/package.json').version==='8.3.1','MATERIAL_ARTIFACT_TOOLCHAIN_CHANGED');
  const tsc=apiRequire.resolve('typescript/bin/tsc'),vite=join(webRequire.resolve('vite/package.json'),'../bin/vite.js');
  const apiBefore=await artifactInventory(join(apiRoot,'dist')),
    webBefore=await artifactInventory(join(webRoot,'dist'));
  const temporary=await mkdtemp(join(await realpath(tmpdir()),'erp-material-artifacts-'));
  try{
    const expectedApi=join(temporary,'api'),expectedWeb=join(temporary,'web');
    await mkdir(expectedApi,{mode:0o700});await mkdir(expectedWeb,{mode:0o700});
    // Disable incremental emission: an old tsbuildinfo must never suppress an
    // expected file. Output goes exclusively to this newly owned directory.
    await command(process.execPath,[tsc,'-p','tsconfig.build.json','--incremental','false',
      '--noEmitOnError','--outDir',expectedApi],apiRoot,{...safeEnvironment(),NODE_ENV:'production'});
    // Native config loader avoids .vite-temp output inside the live checkout.
    // No inherited VITE_/NODE_OPTIONS/DB/HR credentials enter either compiler.
    await command(process.execPath,[vite,'build','--configLoader','native','--outDir',expectedWeb],webRoot,
      {...safeEnvironment(),NODE_ENV:'production',VITE_API_BASE_URL:API});
    demand(await command('git',['rev-parse','HEAD'],checkout)===SOURCE&&
      await command('git',['status','--porcelain'],checkout)==='','SOURCE_CHANGED_STOP');
    const apiAfter=await artifactInventory(join(apiRoot,'dist')),
      webAfter=await artifactInventory(join(webRoot,'dist'));
    demand(digest(apiBefore)===digest(apiAfter)&&digest(webBefore)===digest(webAfter),
      'MATERIAL_RUNTIME_ARTIFACT_CHANGED_DURING_BUILD');
    const api=compareArtifactInventories(apiAfter,await artifactInventory(expectedApi)),
      web=compareArtifactInventories(webAfter,await artifactInventory(expectedWeb));
    return {status:'MATERIAL_API_WEB_ARTIFACT_BYTES_VERIFIED',sourceSha:SOURCE,
      api,web,comparison:'ALL_FILE_NAMES_AND_BYTES_AGAINST_FRESH_PINNED_SOURCE_OUTPUT',
      existingBuildsModified:false,runtimeRestarted:false,databaseAccessed:false,
      loadedProcessMemoryAttested:false,dependencyInstallationReattested:false,
      writeJourneyAuthorized:false,productionAuthorized:false};
  }finally{
    // Only the path returned by this invocation's mkdtemp is removed.
    demand(await realpath(temporary)===temporary,'MATERIAL_ARTIFACT_SCRATCH_CHANGED');
    await rm(temporary,{recursive:true,force:true});
  }
}
