// Exact SS16 successor admission, not a generalized schema relaxation.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export const ss16Baseline='9417f07c609dbc091b5bbe2e09071c5e2c316459';
const currentBlob='c1a4f592034353ab61e1f0a71ceeee396ea28d52';
const previousBlob='1a50604233a9555c206195aec2443aa5e1b27ab7';
const model="model MovementCorrectionRequest {\n  id String @id @default(uuid()) @db.Uuid\n  companyId String @map(\"company_id\") @db.Uuid\n  sourceKind String @map(\"source_kind\") @db.VarChar(30)\n  sourceId String @map(\"source_id\") @db.Uuid\n  sourcePostedAt DateTime? @map(\"source_posted_at\") @db.Timestamptz(6)\n  sourceApprovalInstanceId String? @map(\"source_approval_instance_id\") @db.Uuid\n  sourceSubmittedAt DateTime? @map(\"source_submitted_at\") @db.Timestamptz(6)\n  requestKey String @map(\"request_key\") @db.VarChar(120)\n  reason String @db.Text\n  requestedByUserId String @map(\"requested_by_user_id\") @db.Uuid\n  requestedAt DateTime @default(now()) @map(\"requested_at\") @db.Timestamptz(6)\n  approvalInstanceId String @unique @map(\"approval_instance_id\") @db.Uuid\n\n  company Company @relation(fields: [companyId], references: [id], onDelete: Restrict)\n  requestedBy User @relation(\"MovementCorrectionRequester\", fields: [companyId, requestedByUserId], references: [companyId, id], onDelete: Restrict)\n  approvalInstance ApprovalInstance @relation(\"MovementCorrectionDecision\", fields: [approvalInstanceId], references: [id], onDelete: Restrict)\n  sourceApprovalInstance ApprovalInstance? @relation(\"MovementCorrectionOriginalApproval\", fields: [sourceApprovalInstanceId], references: [id], onDelete: Restrict, map: \"movement_correction_original_approval_fk\")\n\n  @@unique([companyId, sourceKind, sourceId, requestKey], map: \"movement_correction_request_replay_key\")\n  @@index([companyId, sourceKind, sourceId], map: \"movement_correction_source_idx\")\n  @@map(\"movement_correction_requests\")\n}";
const relations=["  movementCorrectionRequests MovementCorrectionRequest[]","  movementCorrectionRequests MovementCorrectionRequest[] @relation(\"MovementCorrectionRequester\")","  movementCorrectionRequest MovementCorrectionRequest? @relation(\"MovementCorrectionDecision\")","  sourceCancellationRequests MovementCorrectionRequest[] @relation(\"MovementCorrectionOriginalApproval\")"];
export const ss16MigrationPins=Object.freeze({
  "20261127041000_ss16_movement_correction_request": "15c5c008c89319fff63b2693dd74643672260b79",
  "20261127050000_ss16_unposted_cancellation_pin": "ddaa18ba825224109678f57a980aa2cba176f748",
  "20261127060000_ss16_controlled_submitted_cancellation": "78e06c3b3ab90dc1b63657f83436bd837a39c868",
  "20261127070000_ss16_terminal_controlled_cancellation": "c48243e098aa21fe1f6177adf277927249f77263",
  "20261127080000_ss16_plan_cancel_decision_proof": "05dd43ce8d6961ec0a8bb0ba25d9d07288148ebe",
  "20261127150000_ss16_reciprocal_decision_integrity": "11142cdbee00034f8b27bfd4eb9d099cb10f85cf",
  "20261127160000_ss16_terminal_outcome_ledger_proof": "e53dc8f7ad59fbd4cebf716a77366d91db311f9d"
});
export const ss16MigrationNames=Object.freeze(Object.keys(ss16MigrationPins));
export const ss16EvidenceKeys=Object.freeze(["ss16SourceContract","ss16HistoricalPreservation","ss16InstalledRecovery","ss16RollbackAbsence","ss16RuntimeAcceptance"]);
const prefix='migration-aware-ss16-';
const schemaPath='apps/api/prisma/schema.prisma';
const root='apps/api/prisma/migrations/';
const blob=bytes=>{const b=Buffer.from(bytes);return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');};
const git=args=>execFileSync('git',args,{encoding:'utf8'});
export function stripSs16ReleaseSchema(schema){
 const present=/\b(?:MovementCorrectionRequest|movementCorrectionRequests|movementCorrectionRequest|sourceCancellationRequests|movement_correction_requests)\b/.test(schema);
 if(!present)return {present:false,text:schema};
 assert.equal(blob(schema),currentBlob,'Only exact reviewed SS16 schema is admitted');
 const previous=git(['show',ss16Baseline+':'+schemaPath]);
 assert.equal(blob(previous),previousBlob,'Exact pre-SS16 baseline required');
 assert.equal(schema.split(model).length,2);
 let reduced=schema.replace(model,'');
 for(const relation of relations){
  assert.equal(reduced.split('\n').filter(line=>line===relation).length,1);
  reduced=reduced.replace(relation+'\n','');
 }
 assert.equal(reduced.trimEnd(),previous.trimEnd(),'Non-SS16 schema difference');
 return {present:true,text:previous};
}
export function ss16Mode(mode){
 if(typeof mode!=='string'||!mode.startsWith(prefix))return {present:false,prior:mode};
 const suffix=mode.slice(prefix.length);
 assert.ok(suffix&&!suffix.startsWith('ss16-'),'Invalid SS16 outer mode');
 return {present:true,prior:suffix==='schema'?'migration-aware-sql-only':'migration-aware-'+suffix};
}
export function wrapSs16Mode(prior){
 assert.match(prior,/^migration-aware-[a-z0-9-]+$/);
 assert.equal(ss16Mode(prior).present,false);
 return prior==='migration-aware-sql-only'?prefix+'schema':prefix+prior.slice('migration-aware-'.length);
}
export function assertSs16ReleaseEvidence(rehearsal){
 const mode=ss16Mode(rehearsal.releaseMode);
 const names=Array.isArray(rehearsal.migrationNames)?rehearsal.migrationNames:[];
 const additions=names.filter(n=>typeof n==='string'&&n.includes('_ss16_')).sort();
 if(!mode.present){
  assert.equal(additions.length,0,'SS16 migrations require explicit SS16 evidence');
  assert.notEqual(rehearsal.version,26,'SS16 evidence version without mode');
  assert.ok(ss16EvidenceKeys.every(key=>rehearsal[key]===undefined),'Unexpected SS16 evidence without mode');
  return mode;
 }
 assert.equal(rehearsal.version,26,'SS16 evidence version mismatch');
 assert.deepEqual(additions,[...ss16MigrationNames].sort(),'Missing, duplicate or unexpected SS16 migration');
 for(const key of ss16EvidenceKeys)assert.equal(rehearsal[key],'PASS','Missing SS16 evidence: '+key);
 return mode;
}
function inventory(ref){
 return Object.fromEntries(git(['ls-tree','-r','-z',ref,'--',root]).split('\0').filter(Boolean).map(row=>{
  const [meta,path]=row.split('\t');
  assert.match(meta,/^100644 blob [a-f0-9]{40}$/);
  return [path,meta.split(' ')[2]];
 }));
}
export function exactSs16Checksums(){
 return Object.fromEntries(ss16MigrationNames.map(name=>{
  const bytes=readFileSync(new URL('../../'+root+name+'/migration.sql',import.meta.url));
  assert.equal(blob(bytes),ss16MigrationPins[name],'SS16 SQL source differs: '+name);
  return [name,createHash('sha256').update(bytes).digest('hex')];
 }));
}
export function assertSs16SourceTree(candidate,predecessor){
 assert.match(candidate,/^[a-f0-9]{40}$/);
 assert.match(predecessor,/^[a-f0-9]{40}$/);
 assert.equal(git(['rev-parse','HEAD']).trim(),candidate);
 const current=inventory(candidate),previous=inventory(predecessor),baseline=inventory(ss16Baseline);
 assert.equal(Object.keys(baseline).filter(p=>p.endsWith('/migration.sql')).length,177);
 const expected={...baseline,...Object.fromEntries(ss16MigrationNames.map(name=>[root+name+'/migration.sql',ss16MigrationPins[name]]))};
 assert.deepEqual(current,expected,'Current full migration inventory drift');
 assert.ok(Object.keys(previous).every(p=>baseline[p]===previous[p]),'Historical migration drift');
 assert.ok(ss16MigrationNames.every(n=>!Object.hasOwn(previous,root+n+'/migration.sql')),'SS16 already installed in historical source');
 assert.equal(stripSs16ReleaseSchema(git(['show',candidate+':'+schemaPath])).present,true);
 assert.equal(stripSs16ReleaseSchema(git(['show',predecessor+':'+schemaPath])).present,false);
 exactSs16Checksums();
 return true;
}
export function assertSs16AppliedHistory(before,after,checksums=exactSs16Checksums()){
 const index=rows=>{
  assert.ok(Array.isArray(rows));
  const map=new Map();
  for(const row of rows){
   assert.match(row.migration_name,/^[0-9]{14}_[A-Za-z0-9_]+$/);
   assert.match(row.checksum,/^[a-f0-9]{64}$/);
   assert.ok(!map.has(row.migration_name),'Duplicate applied migration');
   map.set(row.migration_name,row.checksum);
  }
  return map;
 };
 const old=index(before),next=index(after);
 for(const [name,sum] of old)assert.equal(next.get(name),sum,'Historical migration changed: '+name);
 assert.deepEqual([...old.keys()].filter(n=>n.includes('_ss16_')),[],'Predecessor has SS16 history');
 assert.deepEqual([...next.keys()].filter(n=>n.includes('_ss16_')).sort(),[...ss16MigrationNames].sort());
 for(const name of ss16MigrationNames)assert.equal(next.get(name),checksums[name],'SS16 applied checksum differs: '+name);
 return true;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [candidate,predecessor]=process.argv.slice(2);
 assertSs16SourceTree(candidate,predecessor);
 console.log('SS16_EXACT_SOURCE_TREE_PASS');
}
