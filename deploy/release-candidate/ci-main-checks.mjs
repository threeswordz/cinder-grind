// Short main checks on fresh GitHub-owned resources. No historical rehearsals.
import {execFileSync,spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,readdirSync,readFileSync,lstatSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
const need = (ok,code) => {if(!ok)throw new Error(code);};
const run = (program,args,options={}) => execFileSync(program,args,{stdio:'inherit',...options});
const git = (...args) => execFileSync('git',args,{encoding:'utf8'}).trim();

export function migrationInventory(root) {
  const hash=createHash('sha256');
  const visit=(directory,relative='')=>{
    for(const name of readdirSync(directory).sort()){
      const path=join(directory,name),key=relative+name,s=lstatSync(path);
      need(!s.isSymbolicLink(),'MIGRATION_LINK_DENIED');
      if(s.isDirectory())visit(path,key+'/');
      else {need(s.isFile(),'MIGRATION_FILE_REQUIRED');hash.update(key+'\0');hash.update(readFileSync(path));hash.update('\0');}
    }
  };
  visit(root);return hash.digest('hex');
}

async function smoke() {
  const storage=mkdtempSync(join(tmpdir(),'erp-main-smoke-'));
  writeFileSync(join(storage,'.construction-erp-storage-ready'),'construction-erp-production-storage-v1:ci-main-integration',{mode:0o600});
  const probe=createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const child=spawn(process.execPath,['apps/api/dist/main.js'],{env:{...process.env,NODE_ENV:'production',
    API_HOST:'127.0.0.1',API_PORT:String(port),WEB_ORIGIN:'https://erp.example.invalid',
    STORAGE_ROOT:storage,STORAGE_DEPLOYMENT_ID:'ci-main-integration'},stdio:['ignore','pipe','pipe']});
  let log='',exited=false,spawnFailed=false;
  child.on('error',()=>{spawnFailed=true;});child.on('exit',()=>{exited=true;});
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log=(log+chunk.toString()).slice(-1048576);});
  try{
    let ready=false;
    for(let attempt=0;attempt<100;attempt++){
      need(!spawnFailed&&!exited,'OWNED_API_EXITED');
      if(log.includes('"event":"service.start"')){
        try{
          const r=await fetch('http://127.0.0.1:'+port+'/api/v1/health/ready',{redirect:'error',signal:AbortSignal.timeout(2000)});
          const body=await r.json(),health=body.data??body;
          if(r.ok&&health.status==='ok'&&health.database==='ok'&&health.documentStorage==='ok'){ready=true;break;}
        }catch{ /* bounded readiness wait on this owned process */ }
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    need(ready&&!exited,'OWNED_API_NOT_READY');
  }finally{
    if(!exited&&!spawnFailed){
      child.kill('SIGTERM');
      for(let i=0;i<50&&!exited;i++)await new Promise(resolve=>setTimeout(resolve,100));
      if(!exited){child.kill('SIGKILL');throw new Error('OWNED_API_CLEANUP_FAILED');}
    }
    rmSync(storage,{recursive:true,force:true});
  }
}

async function main(){
  need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='threeswordz/cinder-grind'&&
    process.env.GITHUB_EVENT_NAME==='push'&&process.env.GITHUB_REF==='refs/heads/main','GITHUB_MAIN_ONLY');
  const target=new URL(process.env.DATABASE_URL??'');
  need(['localhost','127.0.0.1'].includes(target.hostname)&&target.port==='5432'&&target.pathname==='/construction_erp','DISPOSABLE_CI_DATABASE_REQUIRED');
  const sha=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
  need(sha===process.env.GITHUB_SHA&&!git('status','--porcelain'),'CLEAN_EXACT_MAIN_REQUIRED');
  const pnpm=execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim();
  need(process.version==='v24.21.0'&&pnpm==='12.6.0','PINNED_TOOLCHAIN_REQUIRED');
  run('pnpm',['install','--frozen-lockfile']);
  run('pnpm',['prisma:generate']);run('pnpm',['prisma:validate']);
  run('pnpm',['build']);
  run('pnpm',['audit','--prod','--audit-level','high']);
  const inventory=migrationInventory('apps/api/prisma/migrations');
  run('pnpm',['prisma:migrate:deploy']);
  run('pnpm',['--filter','@construction-erp/api','exec','prisma','migrate','status']);
  await smoke();
  need(sha===git('rev-parse','HEAD')&&tree===git('rev-parse','HEAD^{tree}')&&!git('status','--porcelain'),'MAIN_SOURCE_CHANGED');
  writeFileSync('/tmp/main-integration-checks.json',JSON.stringify({integratedSha:sha,tree,node:process.version,pnpm,
    runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,
    frozenBuild:'PASS',freshSecurityAudit:'PASS',freshMigrationStatus:'PASS',ownedApiReady:'PASS',migrationInventorySha256:inventory})+'\n',{mode:0o600});
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)main().catch(()=>{console.error('MAIN_INTEGRATION_CHECK_FAILED');process.exitCode=1;});
