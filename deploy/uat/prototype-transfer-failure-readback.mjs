#!/usr/bin/env node
// The existing failed Mac target is READ ONLY. No startup, configuration,
// migration, DDL/DML, reset, replay, receipt write or continuation is possible.
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,lstat,realpath,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {verifyFailedTransferState} from './prototype-transfer-failure-state.mjs';
import {privateInventory,verifyDocumentInventory} from './prototype-transfer-upgrade.mjs';
import {validContainer} from './prototype-actors.mjs';
import {transferTables} from '../release-candidate/transfer-schema-contract.mjs';
const FAILED='97db9151b1059e5f134529deb25b78fc714fa683',ORIGINAL='6fe8c4c22b002f66f00593975d381a284581f058';
const APP='1addb385e402037d052a6542151e7c2e8bdb417d',ORIGIN='https://github.com/threeswordz/cinder-grind.git';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const hash=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const execute=promisify(execFile);
const env=()=>Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL'].filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]]));
async function command(exe,args,cwd){try{return (await execute(exe,args,{cwd,env:env(),timeout:60000,maxBuffer:32*1024*1024})).stdout.trim();}catch{demand(false,'TR_READBACK_COMMAND_FAILED');}}
async function directory(path,privateOnly=true){const s=await lstat(path);demand(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&(privateOnly?0o077:0o022))&&await realpath(path)===path,'TR_READBACK_UNSAFE_DIRECTORY');}
async function privateBytes(path,limit=32*1024*1024){const s=await lstat(path);demand(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===process.getuid()&&!(s.mode&0o077)&&s.size<=limit,'TR_READBACK_UNSAFE_PRIVATE_FILE');return readFile(path);}
const privateJson=async path=>JSON.parse(await privateBytes(path));
async function absent(path){try{await lstat(path);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}}
async function previousInventory(path){
 await directory(path);const rows=[];
 for(const name of (await readdir(path)).sort()){
  if(name==='application')continue;
  const full=join(path,name),s=await lstat(full);
  demand(!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o022),'TR_READBACK_UNSAFE_HISTORY_ENTRY');
  if(s.isDirectory()){
   demand(['logs','preserved'].includes(name),'TR_READBACK_UNKNOWN_HISTORY_DIRECTORY');rows.push([name,'directory']);
   for(const item of await privateInventory(full))rows.push([name+(item[0]?'/'+item[0]:''),...item.slice(1)]);
  }else{demand(s.isFile()&&s.nlink===1,'TR_READBACK_UNSAFE_HISTORY_FILE');rows.push([name,s.size,hash(await privateBytes(full))]);}
 }
 return rows;
}
export function readbackSql(tables){
 demand(Array.isArray(tables)&&tables.length>0&&tables.length<=200&&new Set(tables).size===tables.length&&tables.every(t=>/^[a-z_]+$/.test(t)),'TR_READBACK_INVALID_TABLE_INVENTORY');
 const rows=tables.map(t=>`SELECT '${t}' AS name,COALESCE(json_agg(to_jsonb(t)::text),'[]'::json) AS rows FROM "${t}" t`).join(' UNION ALL ');
 return `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='30s'; SELECT json_build_object(
 'database',current_database(),'server',current_setting('server_version'),'readOnly',current_setting('transaction_read_only'),
 'otherConnections',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()),
 'tables',(SELECT array_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'),
 'snapshot',(SELECT json_object_agg(name,rows) FROM (${rows}) s)); COMMIT;`;
}
export async function inspectFailedTransfer(operatorSha){
 demand(process.platform==='darwin'&&process.getuid()>0,'TR_READBACK_NONROOT_MAC_REQUIRED');
 demand(process.versions.node==='24.21.0','TR_READBACK_NODE_24_21_0_REQUIRED');
 demand(!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_/.test(k)),'TR_READBACK_OVERRIDE_REFUSED');
 demand(/^[a-f0-9]{40}$/.test(operatorSha??''),'TR_READBACK_PINNED_SOURCE_REQUIRED');
 const own=fileURLToPath(new URL('../../',import.meta.url)),home=homedir(),root=join(home,'Construction-ERP-Prototype-Runtime'),stage=join(root,'transfer-upgrade'),repo=join(stage,'application');
 await directory(home,false);await directory(root);await directory(stage);await directory(repo,false);
 demand(await command('git',['rev-parse','HEAD'],own)===operatorSha&&await command('git',['status','--porcelain'],own)===''&&
  [ORIGIN,ORIGIN.slice(0,-4)].includes(await command('git',['remote','get-url','origin'],own)),'TR_READBACK_OWN_SOURCE_DRIFT');
 demand(await command('git',['rev-parse','HEAD'],repo)===FAILED&&await command('git',['status','--porcelain'],repo)===''&&
  [ORIGIN,ORIGIN.slice(0,-4)].includes(await command('git',['remote','get-url','origin'],repo)),'TR_READBACK_FAILED_SOURCE_DRIFT');
 const started=await privateJson(join(stage,'started.json')),failure=await privateJson(join(stage,'failure-private.json'));
 demand(started.operatorMain===FAILED&&started.reviewedApp===APP&&started.originalSource===ORIGINAL&&failure.phase==='SOURCE_API'&&
  failure.code==='PROBE_TR_CREATE_HTTP_500'&&failure.sourceMayBeStoppedOrMigrated===true&&failure.automaticRetryAllowed===false,
  'TR_READBACK_DIFFERENT_FAILURE');
 demand(await absent(join(stage,'source-private.json'))&&await absent(join(stage,'ready.json')),'TR_READBACK_PARTIAL_SUCCESS_REQUIRES_DIFFERENT_CONTINUATION');
 // Stop nothing. Any remaining listener is an explicit handoff blocker.
 for(const port of [33071,44171]){
  let clear=false;
  try{await execute('lsof',['-nP','-iTCP:'+port,'-sTCP:LISTEN'],{cwd:repo,env:env(),timeout:10000});}
  catch(e){clear=e.code===1&&e.stdout===''&&e.stderr==='';}
  demand(clear,'TR_READBACK_APPLICATION_LISTENER_STILL_PRESENT');
 }
 const manifest=await privateJson(join(root,'prototype-target.json')),cfg=await privateJson(join(root,'runtime-private.json')),
  container=await privateJson(join(root,'container-owned.json'));
 demand(manifest.expectedMainSha===ORIGINAL&&manifest.mode==='isolated-synthetic'&&manifest.productionConnected===false&&manifest.retainedDataUsed===false&&
  manifest.realCompanyGrantsModified===false&&manifest.runtime?.isolationRoot===root&&manifest.runtime.databaseRoot===join(root,'db')&&
  manifest.runtime.postgresHost==='127.0.0.1'&&manifest.runtime.postgresPort===55471&&manifest.runtime.postgresDbName==='proto_a_01'&&
  cfg.sourceSha===ORIGINAL&&cfg.databaseName==='proto_a_01'&&cfg.databaseUser==='proto_runtime','TR_READBACK_WRONG_SYNTHETIC_TARGET');
 const connections=JSON.parse(await command('podman',['system','connection','list','--format','json'],repo)),defaults=connections.filter(c=>c.Default===true);
 demand(defaults.length===1&&defaults[0].Name==='podman-machine-default'&&/^ssh:\/\/core@127\.0\.0\.1:\d+\/run\/user\/\d+\/podman\/podman.sock$/.test(defaults[0].URI??'')&&
  await command('podman',['info','--format','{{.Host.Security.Rootless}}'],repo)==='true','TR_READBACK_LOCAL_ROOTLESS_PODMAN_REQUIRED');
 demand(/^[a-f0-9]{64}$/.test(container.id??''),'TR_READBACK_CONTAINER_ID_INVALID');
 const inspected=JSON.parse(await command('podman',['inspect',container.id],repo));
 demand(inspected.length===1&&validContainer(inspected[0],container,join(root,'db')),'TR_READBACK_OWNED_CONTAINER_REQUIRED');
 const before=await privateJson(join(stage,'database-before-private.json')),c=await privateJson(join(stage,'configuration-private.json')),
  actors=await privateJson(join(root,'actors-private.json')),fixture=await privateJson(join(root,'actors-fixture-private.json'));
 const tables=[...Object.keys(before),...transferTables].sort();
 const result=JSON.parse(await command('podman',['exec',container.id,'psql','--no-psqlrc','-qAt','-U','proto_runtime','-d','proto_a_01','-v','ON_ERROR_STOP=1','-c',readbackSql(tables)],repo));
 demand(result.database==='proto_a_01'&&/^17\.11(?:\D|$)/.test(result.server??'')&&result.readOnly==='on'&&result.otherConnections===0&&
  canonical(result.tables)===canonical(tables),'TR_READBACK_DATABASE_IDENTITY_OR_TRAFFIC_DRIFT');
 const current=Object.fromEntries(Object.entries(result.snapshot).map(([table,rows])=>{
  demand(Array.isArray(rows)&&rows.length<=10000,'TR_READBACK_ROW_BOUND_EXCEEDED');
  return [table,rows.map(raw=>({...JSON.parse(raw),__fm03_exact_row_json:raw})).sort((a,b)=>canonical(a).localeCompare(canonical(b)))];
 }));
 const migrations=(await readdir(join(repo,'apps/api/prisma/migrations'),{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort();
 demand(current._prisma_migrations.length===migrations.length,'TR_READBACK_SCHEMA_COUNT_CHANGED');
 for(const name of migrations){const row=current._prisma_migrations.find(m=>m.migration_name===name);demand(row?.finished_at&&!row.rolled_back_at&&row.checksum===hash(await readFile(join(repo,'apps/api/prisma/migrations',name,'migration.sql'))),'TR_READBACK_SCHEMA_CHECKSUM_CHANGED');}
 const receipt=verifyFailedTransferState(before,current,c,{fixture,actors:actors.actors});
 const inventories=await privateJson(join(stage,'file-inventories-private.json')),preserved=join(stage,'preserved');await directory(preserved);
 demand((await lstat(join(preserved,'postgresql.custom'))).size>1024,'TR_READBACK_POPULATED_BACKUP_REQUIRED');
 for(const [name,saved]of Object.entries(inventories)){
  demand(/^[a-zA-Z0-9_.-]+$/.test(name)&&!['.','..','db','transfer-upgrade'].includes(name),'TR_READBACK_UNSAFE_INVENTORY_NAME');
  const inventory=async path=>Array.isArray(saved)?(['fm03-upgrade','receiving-upgrade'].includes(name)?previousInventory(path):privateInventory(path)):hash(await privateBytes(path));
  demand(canonical(await inventory(join(root,name)))===canonical(saved)&&canonical(await inventory(join(preserved,name)))===canonical(saved),'TR_READBACK_PRESERVED_FILES_CHANGED');
 }
 verifyDocumentInventory(current.documents,await privateInventory(join(root,'documents')));
 return {...receipt,readOnlyDatabaseTransaction:true,migrationChecksumsVerified:true,filesAndPriorReceiptsPreserved:true,
  populatedBackupPresent:true,originalLauncherMustNotBeRetried:true};
}
const entry=process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null);
if(entry&&entry===await realpath(new URL(import.meta.url))){
 try{demand(process.argv.length===4&&process.argv[2]==='--read-only','TR_READBACK_READ_ONLY_AND_SHA_REQUIRED');console.log(JSON.stringify(await inspectFailedTransfer(process.argv[3])));}
 catch(e){console.log(JSON.stringify({status:'TRANSFER_FAILED_SOURCE_READBACK_BLOCKED',code:/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'TR_READBACK_PRIVATE_CHECK_FAILED',
  continuationAuthorized:false,originalLauncherMustNotBeRetried:true,productionAuthorized:false,secretsPrinted:false}));process.exitCode=1;}
}
