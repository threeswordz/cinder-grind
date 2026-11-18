import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,symlink,rm,realpath,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {upgradeSubcontract,validTransferContinuationReceipt,subcontractStageInventory,PREVIOUS_APP,PREVIOUS_OPERATOR,REVIEWED_APP,REHEARSAL_DB} from '../uat/prototype-subcontract-upgrade.mjs';
import {verifySubcontractMigration,verifySubcontractRetention,configureSubcontract,prepareSubcontractSource} from '../uat/prototype-subcontract-state.mjs';
import {physicalTables,physicalMigrations} from './subcontract-physical-schema-contract.mjs';
import {physicalCatalog} from './subcontract-physical-catalog-contract.mjs';
const receipt=()=>({status:'TRANSFER_PRESERVED_STATE_CONTINUATION_AND_BROWSER_VERIFIED',failedSource:'97db9151b1059e5f134529deb25b78fc714fa683',applicationSha:PREVIOUS_APP,operatorMainSha:PREVIOUS_OPERATOR,populatedFailureDumpSha256:'a'.repeat(64),
 ...Object.fromEntries(['sourceHistoryPreserved','originalFailedStagePreserved','spentNumberPreserved','policyNotReplayed','schemaAndConfigurationUnchanged','separatePopulatedContinuationRehearsalVerified','documentsUploadsKeysAndPriorReceiptsPreserved','approvalHasNoStockEffect','originDispatchDeductedOnce','actualDestinationReceiptCredited','explicitReceiverAssignmentVerified','partialOutstandingPreserved','sameReceiptEvidenceUploaded','threeLocalesVerified','wrongActorDenialVerified','sessionsRevoked'].map(k=>[k,true])),
 ...Object.fromEntries(['fullBusinessJourneysVerified','milestone7Complete','prototypeFrozen','humanUatCompleted','productionAuthorized','secretsPrinted'].map(k=>[k,false]))});
test('only the exact successful continuation receipt admits the next upgrade',()=>{
 assert.equal(validTransferContinuationReceipt(receipt()),true);
 for(const key of Object.keys(receipt())){const r=receipt();delete r[key];assert.equal(validTransferContinuationReceipt(r),false,key);}
 for(const [key,value]of [['status','TRANSFER_UPGRADE_BLOCKED'],['applicationSha',REVIEWED_APP],['operatorMainSha','a'.repeat(40)],['policyNotReplayed',false],['productionAuthorized',true],['humanUatCompleted',true]]){
  const r=receipt();r[key]=value;assert.equal(validTransferContinuationReceipt(r),false,key);
 }
});
test('canonical Nancy-approved withholding is admitted only for this exact certification, amount and approval',()=>{
 const b={fixture:{companyId:'company',projectId:'site'},actors:{NANCY:{userId:'nancy'}}},source={agreementId:'agreement'},
  cert={id:'certification',retained_amount:36.56,approved_by_user_id:'nancy',approved_at:'2026-11-18T06:00:00.123456+00:00'},
  entry={company_id:'company',project_id:'site',agreement_id:'agreement',certification_id:'certification',entry_type:'WITHHOLDING',currency_code:'THB',amount:36.56,
   reverses_entry_id:null,recorded_by_user_id:'nancy',recorded_at:cert.approved_at};
 verifySubcontractRetention(entry,b,source,cert);
 for(const [field,value]of [['company_id','other'],['project_id','other'],['agreement_id','other'],['certification_id','other'],['entry_type','REVERSAL'],['amount',36.57],
  ['currency_code','SGD'],['reverses_entry_id','prior'],['recorded_by_user_id','porn'],['recorded_at','later']]){
  const altered={...entry,[field]:value};assert.throws(()=>verifySubcontractRetention(altered,b,source,cert));
 }
 assert.throws(()=>verifySubcontractRetention(entry,b,source,{...cert,approved_by_user_id:'porn'}));
});
test('non-Mac execution and foreign origins fail before private reads or mutations',async()=>{
 if(process.platform!=='darwin')await assert.rejects(upgradeSubcontract('a'.repeat(40)),e=>e.safeCode==='PA_UPGRADE_NONROOT_MAC_REQUIRED');
 assert.equal(REHEARSAL_DB,'proto_a_01_subcontract_preupgrade');
 const forbidden=new Proxy({}, {get(){throw Error('must not touch a database');}});
 await assert.rejects(configureSubcontract(forbidden,{sourceSha:'wrong'},'a'.repeat(64)),e=>e.safeCode==='PA_CONFIGURATION_BINDING_INVALID');
 await assert.rejects(prepareSubcontractSource(forbidden,{},{},{api:'https://external.invalid/api/v1',web:'https://external.invalid'}),e=>e.safeCode==='PA_SOURCE_ORIGINS_REFUSED');
});
test('the ten exact additive migrations cannot alter any historical SQL bytes or grants',()=>{
 const before={permissions:[],_prisma_migrations:[{id:'old',migration_name:'old',checksum:'retained'}],stock_transactions:[{id:'stock',quantity:1,__fm03_exact_row_json:'{"quantity":1.0000}'}],transfer_receipts:[{id:'partial',quantity:4}],role_permissions:[{id:'grant'}]};
 const after={...structuredClone(before),permissions:physicalCatalog.map(p=>({...p,created_at:'2026-11-18T00:00:00Z'})),
  ...Object.fromEntries(physicalTables.map(t=>[t,[]])),_prisma_migrations:[...before._prisma_migrations,...physicalMigrations.map((migration_name,i)=>({id:'new-'+i,migration_name,finished_at:'2026-11-18T00:00:00Z',rolled_back_at:null}))]};
 verifySubcontractMigration(before,after);
 for(const change of [a=>a.stock_transactions[0].__fm03_exact_row_json='{"quantity":1.0001}',a=>a.transfer_receipts[0].quantity=5,a=>a.role_permissions=[],a=>a.permissions.pop(),
  a=>a.subcontract_physical_claims.push({claim_id:'backfilled'}),a=>delete a.subcontract_physical_decisions,a=>a._prisma_migrations[0].checksum='changed',a=>a._prisma_migrations.pop(),a=>a._prisma_migrations.at(-1).rolled_back_at='now']){
  const altered=structuredClone(after);change(altered);assert.throws(()=>verifySubcontractMigration(before,altered));
 }
});
test('preservation includes prior populated rehearsals and detects private byte drift and links',async t=>{
 const root=await mkdtemp(join(tmpdir(),'subcontract-prior-'));t.after(()=>rm(root,{recursive:true,force:true}));
 for(const name of ['application','rehearsal'])await mkdir(join(root,name),{mode:0o700});
 await writeFile(join(root,'ready.json'),'sealed',{mode:0o600});await writeFile(join(root,'rehearsal','file'),'old',{mode:0o600});
 await writeFile(join(root,'application','build'),'excluded immutable checkout',{mode:0o600});
 const before=await subcontractStageInventory(root);assert.ok(before.some(r=>r[0]==='rehearsal/file'));assert.ok(!before.some(r=>r[0].startsWith('application')));
 await writeFile(join(root,'rehearsal','file'),'changed');assert.notDeepEqual(await subcontractStageInventory(root),before);
 await symlink(join(root,'ready.json'),join(root,'linked'));await assert.rejects(subcontractStageInventory(root));
});
test('canonical and Mac-alias CLI fail closed and imports are inert',async t=>{
 const source=await realpath(fileURLToPath(new URL('../uat/prototype-subcontract-upgrade.mjs',import.meta.url))),temporary=await mkdtemp(join(tmpdir(),'subcontract-cli-'));
 t.after(()=>rm(temporary,{recursive:true,force:true}));const alias=join(temporary,'alias');await symlink(dirname(source),alias,'dir');
 for(const [flags,path]of [[[],source],[[],join(alias,'prototype-subcontract-upgrade.mjs')],[['--preserve-symlinks-main'],join(alias,'prototype-subcontract-upgrade.mjs')]]){
  const r=spawnSync(process.execPath,[...flags,path,'--invalid','a'.repeat(40)],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,1);assert.equal(r.stderr,'');assert.equal(JSON.parse(r.stdout).code,'PA_UPGRADE_EXECUTE_AND_SHA_REQUIRED');
 }
 const r=spawnSync(process.execPath,['--input-type=module','-e','await import('+JSON.stringify(new URL('../uat/prototype-subcontract-upgrade.mjs',import.meta.url).href)+')'],{encoding:'utf8',timeout:10000});
 assert.equal(r.status,0);assert.equal(r.stdout,'');assert.equal(r.stderr,'');
});
test('deployed application uses the durable reviewed integration tree and exact additive migration identities',async()=>{
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 // #365's recorded reviewed tree is preserved by its retained main commit.
 // Do not require a squash-merged review branch object to remain fetched.
 assert.equal(git('rev-parse',REVIEWED_APP+'^{tree}'),'19a2f275a75dc5c0d0ed18820a906889db789251');
 const names=(await readdir(new URL('../../apps/api/prisma/migrations/',import.meta.url))).filter(n=>/^20261117\d{6}_subcontract_physical_/.test(n));
 assert.deepEqual(names.sort(),[...physicalMigrations].sort());
});
