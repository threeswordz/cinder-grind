// Connect the independent cluster, restore transport and full restored-content witness.
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,isAbsolute} from 'node:path';
import {normalizeInventory} from './m6-backup-receipts.mjs';
import {sourceProcessTuple} from './m7-source-process.mjs';
import {schemaDefinitionDigest} from './m7-source-capture-adapter.mjs';
const need=(ok,c)=>{if(!ok)throw Error('M7_TARGET_DB_'+c);};
const hex=(v,n=64)=>typeof v==='string'&&v.length===n&&/^[a-f0-9]+$/.test(v);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const kinds=['documents','uploads','hrkeys'];
const dbTuple=d=>[d.cluster,d.oid,d.database,d.role];
// Manifest recheck independently hashes every archived byte; source observer
// independently reads the final source. Neither is a replay of a success flag.
export function createM7CaptureObserver({binding,source}){
 need(typeof binding?.capture==='function'&&typeof binding.reverify==='function'&&typeof binding.assertObservation==='function'&&hex(binding.manifestSha)&&typeof source?.observe==='function','CAPTURE_CONTEXT');
 return async()=>{
   await binding.reverify();const s=await source.observe(),c=binding.capture();
   need(s?.sourcePreserved===true&&s.quiescent===true&&hex(s.storageIdentitySha256)&&hex(s.schemaSha)&&hex(s.rowsSha)&&same(dbTuple(s.sourceDatabase),dbTuple(c.sourceDatabase)),'SOURCE');
   const inventories=Object.fromEntries(kinds.map(k=>[k+'Sha',hash(normalizeInventory(s.expectedInventories[k],false))]));
   const databaseIdentitySha256=hash(dbTuple(s.sourceDatabase)),quiescenceReceiptSha256=hash([sourceProcessTuple(s.sourceProcess),databaseIdentitySha256,s.rowsSha]);
   const stateSha256=hash([s.applicationSha,s.tree,s.schemaSha,s.rowsSha,databaseIdentitySha256,s.storageIdentitySha256,quiescenceReceiptSha256,...kinds.map(k=>inventories[k+'Sha'])]);
   const observed={sha:s.applicationSha,tree:s.tree,manifestSha:binding.manifestSha,dumpSha:c.dumpSha,schemaSha:s.schemaSha,rowsSha:s.rowsSha,...inventories,sourceDatabase:s.sourceDatabase,sourceProcess:s.sourceProcess,databaseIdentitySha256,quiescenceReceiptSha256,storageIdentitySha256:s.storageIdentitySha256,stateSha256};
   binding.assertObservation(observed);return observed;
 };
}
// Same ordered row-hash census as M6, but the connection must be the new
// target role and OID. No post-restore migrations or mutations are allowed.
export async function readM7RestoredCensus(db,target){
 need(typeof db?.$transaction==='function'&&/^m7_restore_[a-f0-9]{12}$/.test(target?.database??'')&&target.role===target.database.replace('m7_restore_','m7_restore_role_')&&Number.isSafeInteger(target.oid)&&target.oid>0,'CENSUS_CONTEXT');
 return db.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
   const i=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation,(SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid");
   need(i.length===1&&i[0].db===target.database&&i[0].role===target.role&&i[0].ro==='on'&&i[0].isolation==='repeatable read'&&i[0].oid===String(target.oid),'CENSUS_IDENTITY');
   const names=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(r=>r.tablename);
   need(names.length===174&&new Set(names).size===174&&names.every(n=>/^[a-z_][a-z0-9_]*$/.test(n))&&same(names,names.slice().sort()),'CENSUS_TABLES');
   const rows={};for(const n of names){const r=await tx.$queryRawUnsafe('SELECT encode(sha256(convert_to(to_jsonb(t)::text,\'UTF8\')),\'hex\') AS hash FROM public."'+n+'" t LIMIT 10001');need(r.length<=10000&&r.every(x=>hex(x.hash)),'CENSUS_ROWS');rows[n]=r.map(x=>x.hash).sort();}
   const active=await tx.$queryRawUnsafe('SELECT count(*)::text AS n FROM public.user_sessions WHERE revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP');
   need(rows.user_sessions?.length===144&&rows.po_dispatch_events?.length===2&&active.length===1&&active[0].n==='0','CENSUS_SESSIONS');return {rowsSha:hash(rows),tables:174,sessions:144,activeSessions:0};
 },{isolationLevel:'RepeatableRead',timeout:120000});
}
const exec=promisify(execFile);
async function schemaDump({executable,cwd,containerId,plan}){
 const env=Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','XDG_RUNTIME_DIR','LANG','LC_ALL'].filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]]));
 try{return (await exec(executable,['exec','--env','PGPASSFILE=/run/m7-private/pgpass',containerId,'pg_dump','-w','-h','/var/run/postgresql','-U',plan.role,'-d',plan.database,'--schema-only','--no-owner','--no-privileges'],{cwd,env,timeout:60000,maxBuffer:16777216})).stdout;}catch{throw Error('M7_TARGET_DB_SCHEMA_DUMP');}
}
// The cluster is created only after the restore claim has been made. The
// existing restore sequence owns create-role, create-DB and archive replay.
export async function createM7TargetDatabase({claim,binding,source,captureRoot,executable,application,dbPort,makeClient,inventory,verifyOwnedSessions=async s=>s.length},deps){
 const plan=claim?.plan,capture=binding?.capture();
 need(typeof claim?.verifyPaths==='function'&&plan?.sha===capture?.sha&&plan.tree===capture.tree&&hex(capture.dumpSha)&&hex(source?.sourceContainerId)&&hex(source?.sourceImageId)&&[captureRoot,executable,application].every(p=>typeof p==='string'&&isAbsolute(p)&&resolve(p)===p)&&typeof makeClient==='function'&&typeof inventory==='function'&&typeof verifyOwnedSessions==='function','CONTEXT');
 const d=deps??Object.assign({schemaDump,readCensus:readM7RestoredCensus},...await Promise.all([import('./m7-target-cluster.mjs'),import('./m7-postgres-transport.mjs'),import('./m7-postgres-restore.mjs')]));
 const observe=createM7CaptureObserver({binding,source});let cluster,pg,attempted=false,closed=false,contentVerified=false;
 const pin=p=>need(p===plan&&!closed,'PLAN');
 const verifySource=async()=>{await observe();return true;};
 const initialize=async()=>{
   need(!attempted,'ALREADY_ATTEMPTED');attempted=true;await claim.verifyPaths();await verifySource();
   cluster=await d.createM7TargetCluster({claim,sourceContainerId:source.sourceContainerId,sourceImageId:source.sourceImageId,sourceCluster:capture.sourceDatabase.cluster,dbPort,executable,cwd:application,verifySource})();
   need(cluster.sourceContainerId===source.sourceContainerId&&cluster.containerId!==source.sourceContainerId&&cluster.cluster!==capture.sourceDatabase.cluster&&cluster.dbPort===dbPort&&hex(cluster.rolePassword),'CLUSTER');
   const transport=d.createM7PodmanTransport({containerId:cluster.containerId,sourceContainerId:source.sourceContainerId,executable,cwd:application,plan,adminRole:cluster.adminRole,captureRoot,rolePassword:cluster.rolePassword,verifyContainer:cluster.verifyContainer,reverifyCapture:binding.reverify});
   pg=d.createM7PostgresRestore({plan,sourceDatabase:capture.sourceDatabase,targetCluster:cluster.cluster,adminRole:cluster.adminRole,dumpSha256:capture.dumpSha,transport,verifyIsolation:cluster.verifyIsolation,reverifyCapture:binding.reverify,verifyOwnedSessions});
 };
 const dbUrl=()=>{need(cluster&&pg&&!closed,'UNAVAILABLE');return 'postgresql://'+plan.role+':'+cluster.rolePassword+'@127.0.0.1:'+dbPort+'/'+plan.database+'?schema=public&connection_limit=1';};
 const close=async()=>{if(closed)return;closed=true;await cluster?.close();};
 return Object.freeze({inspectCaptureAndSource:observe,
   async inspectTargetAbsence(p){pin(p);await initialize();return pg.inspectAbsence(plan);},
   async provisionFreshTarget(p){pin(p);need(pg,'UNAVAILABLE');await pg.provisionFreshTarget(plan);},
   async inspectDatabase(p){pin(p);need(pg,'UNAVAILABLE');return pg.inspectDatabase(plan);},
   async restoreDatabase(p,args,digest){pin(p);need(pg,'UNAVAILABLE');await pg.restoreDatabase(plan,args,digest);},
   async inspectRestoredContent(p){pin(p);need(pg&&!contentVerified,'CONTENT_STATE');await claim.verifyPaths();await verifySource();const target=await pg.inspectDatabase(plan);need(target.cluster===cluster.cluster&&target.otherSessions===0&&!target.emptyAtDatabaseScope,'TARGET_STATE');
     await cluster.verifyIsolation();const relay=cluster.inspectRelay();need(relay.listening===true&&relay.address==='127.0.0.1'&&relay.port===dbPort,'RELAY');
     const client=makeClient(dbUrl());let census;try{census=await d.readCensus(client,target);}finally{await client.$disconnect();}
     const schemaSha=schemaDefinitionDigest(await d.schemaDump({executable,cwd:application,containerId:cluster.containerId,plan}),plan.role);
     const inventories=Object.fromEntries(await Promise.all(kinds.map(async k=>[k+'Sha',hash(normalizeInventory(await inventory(plan.storage[k]),false))])));
     const result={schemaSha,rowsSha:census.rowsSha,...inventories};need(census.tables===174&&census.sessions===144&&census.activeSessions===0,'CONTENT_DRIFT_CENSUS');
     for(const [field,code] of [['schemaSha','SCHEMA'],['rowsSha','ROWS'],['documentsSha','DOCUMENTS'],['uploadsSha','UPLOADS'],['hrkeysSha','HRKEYS']])need(result[field]===capture[field],'CONTENT_DRIFT_'+code);
     const after=await pg.inspectDatabase(plan);need(same(dbTuple(target),dbTuple(after))&&after.otherSessions===0,'DATABASE_DRIFT');await verifySource();await claim.verifyPaths();contentVerified=true;return result;
   },
   // URL remains private; only the exact restored app or private snapshot reader
   // can receive it after the populated baseline has been independently proved.
   targetConnection(){need(contentVerified&&!closed,'CONTENT_REQUIRED');return dbUrl();},close});
}
