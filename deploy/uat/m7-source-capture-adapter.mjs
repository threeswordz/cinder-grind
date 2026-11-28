// Native capture binding; this module neither provisions targets nor accepts M7.
import {createHash} from 'node:crypto';
import {lstat,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {createRequire} from 'node:module';
import {sourceProcessTuple,sameSourceProcess} from './m7-source-process.mjs';
import {normalizeInventory} from './m6-backup-receipts.mjs';
const need=(ok,c)=>{if(!ok)throw Error('M7_CAPTURE_SOURCE_'+c);};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const hex=(x,n)=>typeof x==='string'&&x.length===n&&/^[a-f0-9]+$/.test(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const kinds=['documents','uploads','hrkeys'];
const dbName='m6_successor_rehearsal',role='proto_runtime';
const identitySql="SELECT current_database() AS database,current_user AS role,(SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid,(SELECT system_identifier::text FROM pg_control_system()) AS cluster,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation";
const clientSql="SELECT count(*)::text AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'";
const podIdentitySql="SELECT current_database() || ':' || current_user || ':' || (SELECT oid::text FROM pg_database WHERE datname=current_database()) || ':' || (SELECT system_identifier::text FROM pg_control_system())";
function identity(s){need(s?.database===dbName&&s.role===role&&/^\d+$/.test(s.cluster??'')&&Number.isSafeInteger(Number(s.oid))&&Number(s.oid)>0,'DB_IDENTITY');return {database:s.database,role:s.role,oid:Number(s.oid),cluster:s.cluster};}
export async function readM7CaptureIdentity(db){return db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const rows=await tx.$queryRawUnsafe(identitySql);need(rows.length===1&&rows[0].ro==='on'&&rows[0].isolation==='repeatable read','DB_TRANSACTION');const clients=await tx.$queryRawUnsafe(clientSql);need(clients.length===1&&clients[0].n==='0','OTHER_CLIENTS');return identity(rows[0]);},{isolationLevel:'RepeatableRead',timeout:30000});}
// pg_dump --no-owner/--no-privileges deliberately excludes role ownership and ACL
// commands. Generated owner comments are not definitions; preserve every other line.
// Modern PG emits a random matching restrict/unrestrict key; only normalize the
// outer pair, never arbitrary matching strings embedded in function bodies.
export function schemaDefinitionDigest(text,owner){
 need(typeof text==='string'&&text.length>0&&text.length<=16777216&&!text.includes('\0')&&/^[a-z][a-z0-9_]{0,62}$/.test(owner),'SCHEMA_OUTPUT');
 const lines=text.replace(/\r\n/g,'\n').trim().split('\n');
 need(lines[0]==='--'&&lines[1]==='-- PostgreSQL database dump'&&lines[2]==='--','SCHEMA_HEADER');
 const end=lines.lastIndexOf('-- PostgreSQL database dump complete');need(end>3&&lines[end-1]==='--'&&lines[end+1]==='--','SCHEMA_FOOTER');
 const restrict=lines.flatMap((l,i)=>l.startsWith('\\restrict ')?[i]:[]),unrestrict=lines.flatMap((l,i)=>l.startsWith('\\unrestrict ')?[i]:[]);
 if(restrict.length||unrestrict.length){need(restrict.length===1&&unrestrict.length===1&&restrict[0]<10&&unrestrict[0]>end&&lines.slice(end+2,unrestrict[0]).every(l=>l==='')&&lines.slice(unrestrict[0]+1).every(l=>l===''),'SCHEMA_RESTRICT');const key=lines[restrict[0]].slice(10);need(/^[a-zA-Z0-9]{16,128}$/.test(key)&&lines[unrestrict[0]]==='\\unrestrict '+key,'SCHEMA_RESTRICT');lines[restrict[0]]='\\restrict M7_FIXED_KEY';lines[unrestrict[0]]='\\unrestrict M7_FIXED_KEY';}
 else need(lines.slice(end+2).every(l=>l===''),'SCHEMA_FOOTER');
 return hash(lines.map((l,i)=>l.startsWith('-- Name: ')&&l.endsWith('; Owner: '+owner)&&lines[i-1]==='--'&&lines[i+1]==='--'?l.slice(0,-owner.length)+'M7_OWNER':l));
}
export function createM7SourceCaptureAdapter({anchor,paths,db,containerId,application,inspectSource,admit,inventory,readStorageIdentity,verifyContainer,command,databaseStream,readIdentity=readM7CaptureIdentity}){
 need(anchor?.database===dbName&&hex(anchor.applicationSha,40)&&hex(anchor.applicationTree,40)&&hex(anchor.terminalSnapshotSha256,64)&&hex(containerId,64)&&resolve(application)===application&&[inspectSource,admit,inventory,readStorageIdentity,verifyContainer,command,databaseStream,readIdentity].every(f=>typeof f==='function'),'CONTEXT');
 need(kinds.every(k=>paths?.[k]===join(paths.stage,k)),'PATHS');const pin=structuredClone(anchor),p=structuredClone(paths);let baseline=null,dumpAttempted=false;
 const pod=async args=>{need(await verifyContainer(containerId)===true,'CONTAINER');return command('podman',['exec',containerId,...args],application);};
 const dbIdentity=async()=>{const direct=identity(await readIdentity(db));const socket=await pod(['psql','-X','-qAt','-w','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U',role,'-d',dbName,'-c',podIdentitySql]);need(socket===[direct.database,direct.role,direct.oid,direct.cluster].join(':'),'CLUSTER_ALIAS');return direct;};
 const observe=async()=>{
   const firstDb=await dbIdentity();let latest;
   const observed=await admit(async pathsArg=>{need(same(pathsArg,p),'PATHS');latest=await inspectSource(pathsArg);return latest;});
   need(observed?.status==='M7_TERMINAL_SOURCE_ADMITTED_READ_ONLY'&&observed.snapshotSha256===pin.terminalSnapshotSha256&&observed.tables===174&&observed.sessions===144&&observed.activeSessions===0&&latest?.applicationSha===pin.applicationSha&&latest.applicationTree===pin.applicationTree&&latest.quiescent===true,'PREDECESSOR');
   sourceProcessTuple(latest.sourceProcess);
   const raw=Object.fromEntries(await Promise.all(kinds.map(async k=>[k,await inventory(p[k])])));
   need(hash(kinds.map(k=>[k,raw[k]]))===latest.storageSha256&&latest.storageSha256===observed.storageSha256,'STORAGE_DRIFT');
   const expectedInventories=Object.fromEntries(kinds.map(k=>[k,normalizeInventory(raw[k],false)]));
   const storageIdentitySha256=hash(await readStorageIdentity(p));
   const schemaSha=schemaDefinitionDigest(await pod(['pg_dump','-w','-h','/var/run/postgresql','-U',role,'-d',dbName,'--schema-only','--no-owner','--no-privileges']),role);
   const lastDb=await dbIdentity(),last=await inspectSource(p);
   need(same(firstDb,lastDb)&&latest.storageSha256===last.storageSha256&&last.applicationSha===pin.applicationSha&&last.applicationTree===pin.applicationTree&&last.quiescent===true&&sameSourceProcess(latest.sourceProcess,last.sourceProcess)&&hash(await readStorageIdentity(p))===storageIdentitySha256,'SOURCE_DRIFT');
   const result={applicationSha:pin.applicationSha,tree:pin.applicationTree,rowsSha:observed.snapshotSha256,schemaSha,sourceDatabase:lastDb,sourceProcess:structuredClone(last.sourceProcess),expectedInventories,storageIdentitySha256,sourcePreserved:true,quiescent:true};
   need(baseline===null||same(baseline,result),'SOURCE_DRIFT');baseline=structuredClone(result);return result;
 };
 const dump=async({archive,sourceDatabase})=>{
   need(!dumpAttempted&&baseline&&same(identity(sourceDatabase),baseline.sourceDatabase)&&typeof archive==='string'&&resolve(archive)===archive&&archive.endsWith('/postgresql.custom'),'DUMP_CONTEXT');dumpAttempted=true;
   need(same(await dbIdentity(),baseline.sourceDatabase)&&await verifyContainer(containerId)===true,'DUMP_SOURCE');
   await databaseStream(containerId,['pg_dump','-w','-h','/var/run/postgresql','-U',role,'-d',dbName,'--format=custom','--no-owner','--no-acl'],application,archive,false);
   need(same(await dbIdentity(),baseline.sourceDatabase)&&await verifyContainer(containerId)===true,'DUMP_SOURCE');
 };
 return Object.freeze({observe,dump});
}
async function readNativeStorageIdentity(paths){const ids=[];for(const k of kinds){const p=paths[k],s=await lstat(p);need(s.isDirectory()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(p)===p,'STORAGE_PATH');ids.push([k,p,s.dev,s.ino,s.uid,s.mode]);}return ids;}
export async function createM7NativeCaptureContext({application}){
 need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&typeof application==='string'&&resolve(application)===application&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(k)),'MAC');
 const root=join(await realpath(homedir()),'Construction-ERP-Prototype-Runtime');
 const [{terminalAnchor,terminalPaths,readM7PrivateTerminalReceipt,admitM7TerminalSource},{createM7NativeSourceInspector},{inventory},{validConfig,validContainer},{command,databaseStream},{readCheckoutIdentity}]=await Promise.all([import('./m7-terminal-source.mjs'),import('./m7-source-inspector.mjs'),import('./m6-runtime-evidence.mjs'),import('./prototype-actors.mjs'),import('./prototype-transfer-upgrade.mjs'),import('./m6-post-m4-inspect.mjs')]);
 const app=await readCheckoutIdentity(application);need(app.sha===terminalAnchor.applicationSha&&app.tree===terminalAnchor.applicationTree&&app.clean===true,'APPLICATION');
 const config=await readM7PrivateTerminalReceipt(join(root,'runtime-private.json')),receipt=await readM7PrivateTerminalReceipt(join(root,'container-owned.json'));need(validConfig(config)&&hex(receipt?.id,64),'CONFIG');
 const verifyContainer=async id=>{need(id===receipt.id,'CONTAINER');const raw=JSON.parse(await command('podman',['inspect',id],application));return Array.isArray(raw)&&raw.length===1&&validContainer(raw[0],receipt,join(root,'db'));};
 need(await verifyContainer(receipt.id),'CONTAINER');const {PrismaClient,Prisma}=createRequire(join(application,'apps/api/package.json'))('@prisma/client');need(Prisma.prismaVersion.client==='6.19.3','PRISMA');
 const db=new PrismaClient({datasources:{db:{url:'postgresql://'+role+':'+config.databasePassword+'@127.0.0.1:55471/'+dbName+'?schema=public&connection_limit=1'}},log:[]});
 try{const paths=terminalPaths(root),inspectSource=await createM7NativeSourceInspector({root,application,db});const adapter=createM7SourceCaptureAdapter({anchor:terminalAnchor,paths,db,containerId:receipt.id,application,inspectSource,admit:inspect=>admitM7TerminalSource({root,db,inspectSource:inspect}),inventory,readStorageIdentity:readNativeStorageIdentity,verifyContainer,command,databaseStream});return Object.freeze({root,paths,anchor:terminalAnchor,sourceContainerId:receipt.id,sourceImageId:receipt.image,db,...adapter,close:()=>db.$disconnect()});}catch(e){await db.$disconnect();throw e;}
}
