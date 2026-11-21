#!/usr/bin/env node
// DEC-050 recovery continuation: verify already-completed source journey, never replay it.
// Deliberately does not import or invoke upgradeUom(). No migration, API, write workflow or restore.
import assert from 'node:assert/strict';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {realpath,lstat,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {uomSnapshot,digest} from './prototype-uom-state.mjs';
import {privateInventory,privateJson,verifyDocumentInventory,seal,fileHash} from './prototype-transfer-upgrade.mjs';
import {verifyTransferDocumentFiles} from './prototype-transfer-state.mjs';
import {uomStageInventory,PREVIOUS_APP,PREVIOUS_OPERATOR} from './prototype-uom-upgrade.mjs';

const OPERATOR='9fa0506e9a50fd556f1c4404e4db2e3d88093b85';
const UOM_STATUS='UOM_POPULATED_MAC_UPGRADE_AND_CONVERTED_RECEIVING_VERIFIED';
const fail=code=>{throw Object.assign(new Error(code),{safeCode:code});};
const requireCheck=(condition,code)=>{if(!condition)fail(code);};
const identical=(a,b)=>digest(a)===digest(b);
const exists=async path=>{try{await lstat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};

// Separating entries by storage type prevents a new directory being counted as a new Document.
// Every original byte/directory remains exact, every added file is a documented known file.
export function verifyFinalDocumentDelta(before,after,documents){
 requireCheck(Array.isArray(before)&&Array.isArray(after)&&Array.isArray(documents),'UOM_CONTINUATION_DOCUMENT_INPUT_INVALID');
 const byPath=new Map(after.map(x=>[x[0],x])),old=new Set(before.map(x=>x[0]));
 requireCheck(byPath.size===after.length&&old.size===before.length,'UOM_CONTINUATION_DUPLICATE_STORAGE_PATH');
 for(const row of before)requireCheck(identical(byPath.get(row[0]),row),'UOM_CONTINUATION_ORIGINAL_DOCUMENT_BYTES_CHANGED');
 const fresh=after.filter(row=>!old.has(row[0]));
 const freshFiles=fresh.filter(row=>typeof row[1]==='number');
 const freshDirs=fresh.filter(row=>row[1]==='directory');
 requireCheck(fresh.length===freshFiles.length+freshDirs.length,'UOM_CONTINUATION_INVALID_NEW_STORAGE_ENTRY');
 requireCheck(freshDirs.length===0,'UOM_CONTINUATION_UNEXPECTED_NEW_DIRECTORY');
 requireCheck(freshFiles.length===documents.length,'UOM_CONTINUATION_UNEXPECTED_NEW_FILES');
 requireCheck(new Set(documents.map(d=>d.id)).size===documents.length &&
  new Set(documents.map(d=>d.storage_key)).size===documents.length,'UOM_CONTINUATION_DUPLICATE_DOCUMENT');
 for(const d of documents){
  const row=byPath.get(d.storage_key);
  requireCheck(!old.has(d.storage_key)&&typeof row?.[1]==='number'&&row[1]===d.file_size_bytes&&
   /^[a-f0-9]{64}$/.test(d.checksum??'')&&row[2]===d.checksum,'UOM_CONTINUATION_DOCUMENT_BYTES_INVALID');
 }
 const paths=new Set(documents.map(d=>d.storage_key));
 requireCheck(freshFiles.every(row=>paths.has(row[0])),'UOM_CONTINUATION_UNACCOUNTED_NEW_FILE');
 return {newDocumentCount:documents.length,oldEntryCount:before.length};
}

export function verifyJourneyFlags(source,rehearsal){
 const flags=['definitionBrowserVerified','threeLocalesVerified','mobileVerified','wrongActorDenialVerified',
  'uncertainResponseReplayVerified','sessionsRevoked','historicalStockAndFinancialRowsPreserved',
  'legacyMaterialsNotActivated','convertedReceivingVerified','convertedReservationVerified',
  'reservationReleasedWithoutStockEffect','convertedRequestSourceVerified','convertedMovementReportVerified',
  'convertedApprovedSourcePlanAndIssueVerified','convertedPlannedReturnVerified','convertedOverageVerified',
  'actualIntegratedOperationalBrowserReadbackVerified','newConvertedStockJourneyVerified',
  'requestAndReportSessionsRevoked'];
 for(const [name,result] of [['source',source],['rehearsal',rehearsal]]){
  requireCheck(result&&flags.every(key=>result[key]===true), 'UOM_CONTINUATION_'+name.toUpperCase()+'_INCOMPLETE');
  requireCheck(result.ownerCostSelfApprovalUnverified===true,'UOM_CONTINUATION_BOQ_BOUNDARY_INVALID');
  requireCheck(Array.isArray(result.documentIds)&&result.documentIds.length===3,'UOM_CONTINUATION_DOCUMENT_SCOPE_INVALID');
 }
}

export async function verifyFailedStage(root,stage){
 const failure=await privateJson(join(stage,'failure-private.json'));
 requireCheck(failure.phase==='FINAL_PRESERVATION'&&failure.code==='RC_UNEXPECTED_DOCUMENT_FILES'&&
  failure.sourceMayBeStopped===true&&failure.sourceMayBeMigrated===true&&
  failure.automaticRetryAllowed===false,'UOM_CONTINUATION_WRONG_FAILURE_PHASE');
 requireCheck(!(await exists(join(stage,'ready.json'))),'UOM_CONTINUATION_ALREADY_COMPLETED');
 requireCheck(!(await exists(join(stage,'continuation-ready.json'))),'UOM_CONTINUATION_ALREADY_FINALIZED');
 const before=await privateJson(join(stage,'database-before-private.json'));
 const after=await privateJson(join(stage,'source-database-after-private.json'));
 const rehearsalAfter=await privateJson(join(stage,'rehearsal-database-after-private.json'));
 const source=await privateJson(join(stage,'source-journey-private.json'));
 const rehearsal=await privateJson(join(stage,'rehearsal-journey-private.json'));
 const baseline=await privateJson(join(stage,'file-inventories-private.json'));
 const preservation=await privateJson(join(stage,'preservation-private.json'));
 const started=await privateJson(join(stage,'started.json'));
 requireCheck(started.operatorMain===OPERATOR&&started.reviewedApp===OPERATOR&&
  started.previousApplication===PREVIOUS_APP&&started.previousOperator===PREVIOUS_OPERATOR,'UOM_CONTINUATION_OPERATOR_PIN_MISMATCH');
 verifyJourneyFlags(source,rehearsal);
 requireCheck(typeof preservation.dumpSha256==='string'&&/^[a-f0-9]{64}$/.test(preservation.dumpSha256)&&
  identical(baseline,preservation.inventories),'UOM_CONTINUATION_INVENTORY_CUSTODY_INVALID');
 requireCheck(await fileHash(join(stage,'preserved/postgresql.custom'))===preservation.dumpSha256,
  'UOM_CONTINUATION_PRESERVED_DUMP_CHANGED');
 const previous=await privateJson(join(root,'subcontract-upgrade/source-database-after-private.json'));
 requireCheck(identical(before,previous),'UOM_CONTINUATION_PREVIOUS_SOURCE_MISMATCH');
 requireCheck(Array.isArray(after.documents)&&Array.isArray(rehearsalAfter.documents)&&
  Array.isArray(before.documents),'UOM_CONTINUATION_DATABASE_SNAPSHOT_MISSING');
 const documents=after.documents.filter(d=>source.documentIds.includes(d.id));
 requireCheck(documents.length===3,'UOM_CONTINUATION_NEW_DOCUMENT_ROWS_MISSING');
 verifyDocumentInventory(after.documents,await privateInventory(join(root,'documents')));
 verifyDocumentInventory(rehearsalAfter.documents,await privateInventory(join(stage,'rehearsal/documents')));
 // Both journeys prove their own complete file custody: no manual receipt recreation.
 const rehearsalBaseline=await privateInventory(join(stage,'rehearsal/documents'));
 verifyFinalDocumentDelta(baseline.documents,rehearsalBaseline,
  rehearsalAfter.documents.filter(d=>rehearsal.documentIds.includes(d.id)));
 const current=await privateInventory(join(root,'documents'));
 const proof=verifyFinalDocumentDelta(baseline.documents,current,documents);
 verifyTransferDocumentFiles(baseline.documents,current,documents);
 const stages=['fm03-upgrade','receiving-upgrade','transfer-upgrade','transfer-continuation','subcontract-upgrade'];
 const dataNames=['documents','uploads','hrkeys'];
 for(const [name,original] of Object.entries(baseline)){
  const readInventory=async base=>{
   const full=join(base,name),stat=await lstat(full);
   requireCheck(!stat.isSymbolicLink()&&stat.uid===process.getuid(),'UOM_CONTINUATION_UNSAFE_FILE');
   if(stat.isDirectory()){
    requireCheck([...stages,...dataNames,'logs'].includes(name),'UOM_CONTINUATION_UNKNOWN_RUNTIME_DIRECTORY');
    return stages.includes(name)?uomStageInventory(full):privateInventory(full);
   }
   requireCheck(stat.isFile()&&stat.nlink===1,'UOM_CONTINUATION_UNSAFE_FILE');
   return fileHash(full);
  };
  requireCheck(identical(await readInventory(join(stage,'preserved')),original),
   'UOM_CONTINUATION_PRESERVED_HISTORY_CHANGED');
  if(name!=='documents')requireCheck(identical(await readInventory(root),original),
   'UOM_CONTINUATION_SOURCE_HISTORY_CHANGED');
 }
 // No client application traffic or mutations. Query one transaction in read-only mode.
 const cfg=await privateJson(join(root,'runtime-private.json'));
 const application=join(stage,'application');
 const {PrismaClient}=createRequire(join(application,'apps/api/package.json'))('@prisma/client');
 const url='postgresql://proto_runtime:'+cfg.databasePassword+'@127.0.0.1:55471/proto_a_01?schema=public';
 const client=new PrismaClient({datasources:{db:{url}},log:[]});
 try{
  const live=await client.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
   return uomSnapshot(tx);
  },{isolationLevel:'RepeatableRead',timeout:60000});
  requireCheck(identical(live,after),'UOM_CONTINUATION_LIVE_DB_CHANGED');
  requireCheck((live.user_sessions??[]).every(row=>row.revoked_at),'UOM_CONTINUATION_SESSION_ACTIVE');
 }finally{await client.$disconnect();}
 return {source,rehearsal,preservation,proof};
}

async function main(){
 requireCheck(process.platform==='darwin'&&process.getuid()>0,'UOM_CONTINUATION_NONROOT_MAC_REQUIRED');
 requireCheck(process.argv.length===4&&process.argv[2]==='--verify'&&process.argv[3]===OPERATOR,
  'UOM_CONTINUATION_PINNED_READ_ONLY_MODE_REQUIRED');
 const home=homedir(),root=join(home,'Construction-ERP-Prototype-Runtime'),stage=join(root,'uom-upgrade');
 requireCheck(resolve(home)===home,'UOM_CONTINUATION_HOME_INVALID');
 const directory=await realpath(stage);requireCheck(directory===stage,'UOM_CONTINUATION_STAGE_SYMLINK');
 const result=await verifyFailedStage(root,stage);
 console.log(JSON.stringify({status:'UOM_FINAL_PRESERVATION_READ_ONLY_PASS',operatorMain:OPERATOR,
  oldEntriesUnchanged:true,newDocumentCount:result.proof.newDocumentCount,
  restoredJourneyVerified:true,sourceJourneyVerified:true,
  sourceAndProtectedDocumentBytesPreserved:true,sourceDbSnapshotUnchanged:true,
  completionReceiptWritten:false,automaticRetryAllowed:false,productionAuthorized:false}));
}
const entry=process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null);
if(entry&&entry===await realpath(new URL(import.meta.url))){
 try{await main();}catch(e){console.log(JSON.stringify({status:'UOM_FINAL_PRESERVATION_READ_ONLY_BLOCKED',
  code:e.safeCode??'UOM_CONTINUATION_PRIVATE_CHECK_FAILURE',completionReceiptWritten:false,
  automaticRetryAllowed:false,productionAuthorized:false}));process.exitCode=1;}
}
