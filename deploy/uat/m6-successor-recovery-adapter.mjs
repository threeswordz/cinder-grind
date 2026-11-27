// M6-01 only: prepare a separate owned PostgreSQL rehearsal; never cut over.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {cp,lstat,mkdir,open,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const DB='m6_successor_rehearsal',ROLE='proto_runtime',SOURCE='proto_a_01';
const SHA=/^[a-f0-9]{40}$/,ID=/^[a-f0-9]{64}$/;
const kinds=['documents','uploads','hrkeys'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stable=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
async function privateDirectory(path){const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(path)===path,'M6_SUCCESSOR_ADAPTER_DIRECTORY');return s;}
async function absent(path){try{await lstat(path);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}}
async function privateHash(path){
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const s=await f.stat();need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>1024,'M6_SUCCESSOR_ADAPTER_ARCHIVE');
    const h=createHash('sha256');for await(const chunk of f.createReadStream({autoClose:false}))h.update(chunk);
    need(stable(s,await f.stat())&&stable(s,await lstat(path)),'M6_SUCCESSOR_ADAPTER_ARCHIVE_DRIFT');return h.digest('hex');
  }finally{await f.close();}
}
const catalogSql="SELECT oid::text || ':' || pg_get_userbyid(datdba) || ':' || datallowconn::text FROM pg_database WHERE datname='"+DB+"'";
const identitySql="SELECT current_database() || ':' || current_user";
// All mutation commands are fixed to DB, not supplied by caller. The concrete
// transport is selected by createNativeSuccessorRecoveryAdapter below.
export function createSuccessorRecoveryAdapter({candidate,sourceRoot,retainedRoot,containerId,password,sourceDatabase,verifyRetained,verifyContainer,readCheckout,inventory,command,databaseStream,makeClient,migrateDeploy}){
  need(SHA.test(candidate?.sha??'')&&SHA.test(candidate?.tree??'')&&candidate.syntheticOnly===true&&candidate.rehearsalOnly===true&&candidate.productionAuthorized===false&&ID.test(containerId??'')&&ID.test(password??''),'M6_SUCCESSOR_ADAPTER_PIN');
  need([sourceRoot,retainedRoot].every(p=>typeof p==='string'&&resolve(p)===p)&&sourceRoot!==retainedRoot,'M6_SUCCESSOR_ADAPTER_PATH');
  const stage=join(retainedRoot,'m6-successor-'+candidate.sha),root=join(stage,'recovery'),dump=join(root,'postgresql.custom');
  const expected={root,database:DB,role:ROLE,sha:candidate.sha,tree:candidate.tree};
  const url='postgresql://'+ROLE+':'+password+'@127.0.0.1:55471/'+DB+'?schema=public';
  let state='new',db,oid,stageIdentity,rootIdentity,dumpSha;
  const targetCheck=t=>need(t&&Object.keys(t).length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>t[k]===v),'M6_SUCCESSOR_ADAPTER_TARGET');
  const verifySource=async()=>{const id=await readCheckout(sourceRoot);need(id?.sha===candidate.sha&&id.tree===candidate.tree&&id.clean===true,'M6_SUCCESSOR_ADAPTER_SOURCE_DRIFT');await verifyRetained();await verifyContainer(containerId);};
  const pod=async args=>command('podman',['exec',containerId,...args],sourceRoot);
  const query=(database,sql)=>pod(['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',ROLE,'-d',database,'-c',sql]);
  const catalog=()=>query(SOURCE,catalogSql);
  const stageCheck=async()=>{const s=await privateDirectory(stage);need(s.dev===stageIdentity?.dev&&s.ino===stageIdentity?.ino,'M6_SUCCESSOR_ADAPTER_STAGE_DRIFT');};
  const recoveryCheck=async()=>{await verifySource();await stageCheck();const s=await privateDirectory(root);need(s.dev===rootIdentity?.dev&&s.ino===rootIdentity?.ino,'M6_SUCCESSOR_ADAPTER_ROOT_DRIFT');
    need(await catalog()===oid+':'+ROLE+':true'&&await query(DB,identitySql)===DB+':'+ROLE,'M6_SUCCESSOR_ADAPTER_DB_CUSTODY');};
  return {
    async verifyRetainedCustody(context){need(context?.candidate?.sha===candidate.sha&&context.candidate.tree===candidate.tree&&context.sourceDatabase===sourceDatabase,'M6_SUCCESSOR_ADAPTER_RETAINED_BINDING');await verifySource();},
    async claim(t){targetCheck(t);need(state==='new','M6_SUCCESSOR_ADAPTER_ALREADY_ATTEMPTED');state='claiming';await verifySource();await privateDirectory(retainedRoot);
      need(await absent(stage)&&await catalog()==='','M6_SUCCESSOR_ADAPTER_PRIOR_ATTEMPT');
      await mkdir(stage,{mode:0o700});stageIdentity=await privateDirectory(stage);state='claimed';},
    async restore(t){targetCheck(t);need(state==='claimed','M6_SUCCESSOR_ADAPTER_RESTORE_ORDER');state='restoring';await verifySource();await stageCheck();
      need(await absent(root)&&await catalog()==='','M6_SUCCESSOR_ADAPTER_PRIOR_RECOVERY');
      await mkdir(root,{mode:0o700});rootIdentity=await privateDirectory(root);
      for(const kind of kinds){const src=join(retainedRoot,kind),dst=join(root,kind);const before=await inventory(src);await cp(src,dst,{recursive:true,force:false,errorOnExist:true});need(same(before,await inventory(dst))&&same(before,await inventory(src)),'M6_SUCCESSOR_ADAPTER_COPY_DRIFT');}
      await verifySource();await stageCheck();
      await databaseStream(containerId,['pg_dump','-U',ROLE,'-d',SOURCE,'--format=custom','--no-owner','--no-acl'],sourceRoot,dump,false);
      dumpSha=await privateHash(dump);await verifySource();need(await catalog()==='','M6_SUCCESSOR_ADAPTER_PRIOR_RECOVERY');
      await pod(['createdb','-U',ROLE,'--owner='+ROLE,'--template=template0',DB]);
      const result=await catalog();need(/^[1-9][0-9]*:proto_runtime:true$/.test(result),'M6_SUCCESSOR_ADAPTER_DB_CUSTODY');oid=result.split(':')[0];
      await recoveryCheck();need(await privateHash(dump)===dumpSha,'M6_SUCCESSOR_ADAPTER_ARCHIVE_DRIFT');
      await databaseStream(containerId,['pg_restore','--exit-on-error','--no-owner','--no-privileges','-U',ROLE,'-d',DB],sourceRoot,dump,true);
      await recoveryCheck();need(await privateHash(dump)===dumpSha,'M6_SUCCESSOR_ADAPTER_ARCHIVE_DRIFT');
      db=makeClient(url);need(db&&db!==sourceDatabase,'M6_SUCCESSOR_ADAPTER_CLIENT');state='restored';return {db,dumpSha};},
    async verifyRecoveryCustody(t,client){targetCheck(t);need(['restored','migrated'].includes(state)&&db&&client===db,'M6_SUCCESSOR_ADAPTER_CLIENT');await recoveryCheck();},
    async migrate(t){targetCheck(t);need(state==='restored','M6_SUCCESSOR_ADAPTER_MIGRATE_ORDER');state='migrating';await recoveryCheck();
      await migrateDeploy(sourceRoot,url,stage);await recoveryCheck();state='migrated';},
    async close(){if(db){const client=db;db=undefined;await client.$disconnect();}},
  };
}
// Native adapter construction only. No command runs until the coordinator invokes
// the operator. The caller owns exact Mac admission, source DB client and release gates.
export async function createNativeSuccessorRecoveryAdapter({candidate,sourceRoot,retainedRoot,sourceDatabase,containerReceipt,config,verifyRetained}){
  need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(k)),'M6_SUCCESSOR_ADAPTER_MAC_REQUIRED');
  const {validConfig,validContainer}=await import('./prototype-actors.mjs');
  const {readCheckoutIdentity}=await import('./m6-post-m4-inspect.mjs');
  const {inventory}=await import('./m6-runtime-evidence.mjs');
  const {command,databaseStream,environment,stage:runStage}=await import('./prototype-transfer-upgrade.mjs');
  const {createRequire}=await import('node:module');
  need(validConfig(config)&&typeof verifyRetained==='function','M6_SUCCESSOR_ADAPTER_CONFIG');
  const verifyContainer=async id=>{const raw=JSON.parse(await command('podman',['inspect',id],sourceRoot));need(Array.isArray(raw)&&raw.length===1&&validContainer(raw[0],containerReceipt,join(retainedRoot,'db')),'M6_SUCCESSOR_ADAPTER_CONTAINER');};
  const makeClient=url=>{const {PrismaClient}=createRequire(join(sourceRoot,'apps/api/package.json'))('@prisma/client');return new PrismaClient({datasources:{db:{url}},log:[]});};
  const migrateDeploy=async (cwd,url,path)=>{await mkdir(join(path,'logs'),{mode:0o700});await runStage(path,'SUCCESSOR_REHEARSAL_MIGRATION','pnpm',['prisma:migrate:deploy'],cwd,{...environment(),DATABASE_URL:url},300000);};
  return createSuccessorRecoveryAdapter({candidate,sourceRoot,retainedRoot,sourceDatabase,containerId:containerReceipt?.id,password:config.databasePassword,verifyRetained,verifyContainer,readCheckout:readCheckoutIdentity,inventory,command,databaseStream,makeClient,migrateDeploy});
}
