// Create-only paired capture of the final offline M6 source. No restore or CLI.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,mkdir,open,realpath,readdir} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {sourceProcessTuple,sameSourceProcess} from './m7-source-process.mjs';
import {normalizeInventory} from './m6-backup-receipts.mjs';
import {createM7SourceStorageCapture} from './m7-storage-restore.mjs';
import {prepareM7PairedManifest,verifyM7PairedManifest} from './m7-paired-backup.mjs';
const kinds=['documents','uploads','hrkeys'];
const need=(ok,c)=>{if(!ok)throw Error('M7_CAPTURE_'+c);};
const hex=(x,n)=>typeof x==='string'&&x.length===n&&/^[a-f0-9]+$/.test(x);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const inside=(a,b)=>{const r=relative(a,b);return r===''||(!isAbsolute(r)&&r!=='..'&&!r.startsWith('../'));};
const disjoint=(a,b)=>!inside(a,b)&&!inside(b,a);
const identity=s=>[s.dev,s.ino,s.uid,s.mode];
const fileIdentity=s=>[...identity(s),s.size,s.mtimeMs,s.ctimeMs,s.nlink];
async function dir(p,priv=true){need(typeof p==='string'&&isAbsolute(p)&&resolve(p)===p&&await realpath(p)===p,'PATH');const s=await lstat(p);need(s.isDirectory()&&s.uid===process.getuid()&&(!priv||!(s.mode&0o077)),'DIRECTORY');return identity(s);}
async function dumpDigest(p){
  const s=await lstat(p);need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>5&&await realpath(p)===p,'DUMP');
  const f=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{need(same(fileIdentity(s),fileIdentity(await f.stat())),'DUMP_DRIFT');const b=Buffer.alloc(5);need((await f.read(b,0,5,0)).bytesRead===5&&b.toString()==='PGDMP','DUMP_FORMAT');const h=createHash('sha256');let bytes=0;for await(const c of f.createReadStream({start:0,autoClose:false})){bytes+=c.length;h.update(c);}need(bytes===s.size&&same(fileIdentity(s),fileIdentity(await f.stat()))&&same(fileIdentity(s),fileIdentity(await lstat(p))),'DUMP_DRIFT');return h.digest('hex');}finally{await f.close();}
}
// Observer must independently collect schema, full row census, DB/cluster identity,
// private file inventories and process custody, not echo caller-supplied hashes.
export function createM7PairedCapture({parent,runId,sourceRoot,protectedRoots,anchor,observe,dump,copyStorage=createM7SourceStorageCapture,sealManifest=prepareM7PairedManifest,verifyManifest=verifyM7PairedManifest}){
  need(/^[a-f0-9]{12}$/.test(runId??'')&&Array.isArray(protectedRoots)&&protectedRoots.length>=2&&[observe,dump,copyStorage,sealManifest,verifyManifest].every(f=>typeof f==='function'),'CONTEXT');
  need(hex(anchor?.applicationSha,40)&&hex(anchor?.applicationTree,40)&&hex(anchor?.terminalSnapshotSha256,64)&&anchor.database==='m6_successor_rehearsal','ANCHOR');
  const pin=structuredClone(anchor),protectedPaths=[...protectedRoots,sourceRoot],root=join(parent,'m7-capture-'+runId),storage=Object.fromEntries(kinds.map(k=>[k,join(root,k)]));let attempted=false;
  const read=async()=>{
    const s=structuredClone(await observe());const db=s?.sourceDatabase;
    need(s?.applicationSha===pin.applicationSha&&s.tree===pin.applicationTree&&s.rowsSha===pin.terminalSnapshotSha256&&hex(s.schemaSha,64)&&s.sourcePreserved===true&&s.quiescent===true&&db?.database===pin.database&&db.role==='proto_runtime'&&/^\d+$/.test(db.cluster??'')&&Number.isSafeInteger(db.oid)&&db.oid>0,'SOURCE');
    const processTuple=sourceProcessTuple(s.sourceProcess);
    need(Object.keys(s.expectedInventories??{}).sort().join(',')===kinds.slice().sort().join(',')&&kinds.every(k=>Array.isArray(s.expectedInventories[k])&&s.expectedInventories[k].length>0),'INVENTORIES');
    s.expectedInventories=Object.fromEntries(kinds.map(k=>[k,normalizeInventory(s.expectedInventories[k],false)]));
    need(hex(s.storageIdentitySha256,64),'STORAGE_IDENTITY');
    const inventories=Object.fromEntries(kinds.map(k=>[k+'Sha',hash(s.expectedInventories[k])]));
    const databaseIdentitySha256=hash([db.cluster,db.oid,db.database,db.role]);const quiescenceReceiptSha256=hash([processTuple,databaseIdentitySha256,s.rowsSha]);
    const stateSha256=hash([s.applicationSha,s.tree,s.schemaSha,s.rowsSha,databaseIdentitySha256,s.storageIdentitySha256,quiescenceReceiptSha256,...kinds.map(k=>inventories[k+'Sha'])]);
    return {...s,...inventories,databaseIdentitySha256,quiescenceReceiptSha256,stateSha256};
  };
  return async function captureOnce(){
    need(!attempted,'ALREADY_ATTEMPTED');attempted=true;
    const parentId=await dir(parent),protectedIds=await Promise.all(protectedPaths.map(p=>dir(p,false)));
    need(protectedPaths.every(p=>disjoint(parent,p)),'OVERLAP');
    const first=await read();
    const reverifySource=async()=>{const s=await read();need(s.stateSha256===first.stateSha256&&sameSourceProcess(s.sourceProcess,first.sourceProcess)&&same(s.expectedInventories,first.expectedInventories),'SOURCE_DRIFT');return s;};
    // Exclusive claim; a partial set remains reserved and cannot be reused.
    await mkdir(root,{mode:0o700});const rootId=await dir(root);
    for(const p of Object.values(storage))await mkdir(p,{mode:0o700});const ids=await Promise.all(Object.values(storage).map(p=>dir(p)));
    const verifyPaths=async()=>{need(same(parentId,await dir(parent))&&same(rootId,await dir(root)),'PATH_DRIFT');for(let i=0;i<protectedPaths.length;i++)need(same(protectedIds[i],await dir(protectedPaths[i],false)),'PROTECTED_PATH_DRIFT');for(let i=0;i<kinds.length;i++)need(same(ids[i],await dir(storage[kinds[i]])),'PATH_DRIFT');};
    await verifyPaths();await reverifySource();
    const copied=await copyStorage({claim:{plan:{storage},verifyPaths},captureRoot:sourceRoot,expectedInventories:first.expectedInventories,reverifyCapture:reverifySource})();
    need(copied?.status==='M7_STORAGE_RESTORE_BYTES_VERIFIED'&&copied.rootsVerified===3,'COPY');await verifyPaths();await reverifySource();
    const archive=join(root,'postgresql.custom');need((await readdir(root)).sort().join(',')===kinds.slice().sort().join(','),'PRIOR_ARCHIVE');
    await dump({archive,sourceDatabase:structuredClone(first.sourceDatabase)});const dumpSha=await dumpDigest(archive);
    const last=await reverifySource();await verifyPaths();
    const evidence={applicationSha:pin.applicationSha,databaseIdentitySha256:first.databaseIdentitySha256,storageIdentitySha256:first.storageIdentitySha256,quiescenceReceiptSha256:first.quiescenceReceiptSha256,beforeStateSha256:first.stateSha256,afterStateSha256:last.stateSha256,dumpSha256:dumpSha};
    const manifest={root,evidence,expectedInventories:structuredClone(first.expectedInventories)};
    const sealed=await sealManifest(manifest);need(hex(sealed?.manifestSha256,64),'MANIFEST');manifest.manifestSha256=sealed.manifestSha256;
    need(await verifyManifest(manifest)===true&&await dumpDigest(archive)===dumpSha,'MANIFEST_RECHECK');await reverifySource();await verifyPaths();
    const witness={applicationSha:first.applicationSha,tree:first.tree,manifestSha256:manifest.manifestSha256,dumpSha,databaseIdentitySha256:first.databaseIdentitySha256,storageIdentitySha256:first.storageIdentitySha256,quiescenceReceiptSha256:first.quiescenceReceiptSha256,stateSha256:first.stateSha256,schemaSha:first.schemaSha,rowsSha:first.rowsSha,...Object.fromEntries(kinds.map(k=>[k+'Sha',first[k+'Sha']])),sourceDatabase:structuredClone(first.sourceDatabase),sourceProcess:structuredClone(first.sourceProcess)};
    const db=first.sourceDatabase,witnessSha256=hash([witness.applicationSha,witness.tree,witness.manifestSha256,dumpSha,witness.databaseIdentitySha256,witness.storageIdentitySha256,witness.quiescenceReceiptSha256,witness.stateSha256,witness.schemaSha,witness.rowsSha,...kinds.map(k=>witness[k+'Sha']),[db.cluster,db.oid,db.database,db.role],sourceProcessTuple(witness.sourceProcess)]);
    return {status:'M7_PAIRED_CAPTURE_SET_SEALED',manifestArgs:manifest,witness,witnessSha256,nativeCaptureVerified:false,nativeRecoveryVerified:false,milestone7Accepted:false,productionAuthorized:false};
  };
}
