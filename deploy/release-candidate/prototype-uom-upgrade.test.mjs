import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdtemp,symlink,rm,realpath,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {upgradeUom,validSubcontractReceipt,PREVIOUS_APP,PREVIOUS_OPERATOR,APPLICATION_BASE,REHEARSAL_DB} from '../uat/prototype-uom-upgrade.mjs';
import {verifyUomMigration,verifyUomPreservation,configureUom,prepareUomSource,UOM_TABLES,UOM_MIGRATIONS,UOM_GRANTS} from '../uat/prototype-uom-state.mjs';
import {materialUomCatalog} from './material-uom-catalog-contract.mjs';
const receipt=()=>({status:'SUBCONTRACT_POPULATED_MAC_UPGRADE_AND_BROWSER_VERIFIED',applicationSha:PREVIOUS_APP,operatorMainSha:PREVIOUS_OPERATOR,populatedDumpSha256:'a'.repeat(64),
 ...Object.fromEntries(['forwardOnlyMigration','sourceHistoryPreserved','completedPartialTransferPreserved','documentsUploadsKeysAndPriorReceiptsPreserved','preUpgradeSeparatePopulatedRestoreAndJourneyVerified','stockAndPaymentRowsUnchanged','physicalCaptureAndIndependentPartialAcceptanceVerified','explicitAcceptedAmountVerified','canonicalCertificationApprovalVerified','threeLocalesVerified','mobileVerified','protectedDownloadBytesVerified','wrongActorDenialVerified','uncertainResponseReplayVerified','sessionsRevoked'].map(k=>[k,true])),
 ...Object.fromEntries(['fullBusinessJourneysVerified','milestone7Complete','prototypeFrozen','humanUatCompleted','productionAuthorized','secretsPrinted'].map(k=>[k,false]))});
test('UOM successor admits only the actual completed subcontract custody and no release claims',()=>{
 assert.equal(validSubcontractReceipt(receipt()),true);
 for(const key of Object.keys(receipt())){const r=receipt();delete r[key];assert.equal(validSubcontractReceipt(r),false,key);}
 for(const [key,value]of [['status','SUBCONTRACT_UPGRADE_BLOCKED'],['applicationSha',APPLICATION_BASE],['operatorMainSha','a'.repeat(40)],['sourceHistoryPreserved',false],['productionAuthorized',true]]){
  assert.equal(validSubcontractReceipt({...receipt(),[key]:value}),false,key);
 }
});
test('nine UOM migrations leave every old PostgreSQL byte, grant and financial fact intact',()=>{
 const before={permissions:[],_prisma_migrations:[{id:'old',migration_name:'old',checksum:'kept'}],stock_transactions:[{id:'stock',quantity:1,__fm03_exact_row_json:'{"quantity":1.0000}'}],
  role_permissions:[{id:'grant'}],subcontract_certifications:[{id:'approved',retained_amount:36.56}],transfer_receipts:[{id:'partial',quantity:4}]};
 const after={...structuredClone(before),permissions:materialUomCatalog.map(p=>({...p,created_at:'2026-11-21T00:00:00Z'})),...Object.fromEntries(UOM_TABLES.map(t=>[t,[]])),
  _prisma_migrations:[...before._prisma_migrations,...UOM_MIGRATIONS.map((migration_name,i)=>({id:'new-'+i,migration_name,finished_at:'2026-11-21T00:00:00Z',rolled_back_at:null}))]};
 verifyUomMigration(before,after);assert.equal(UOM_TABLES.length,12);assert.equal(UOM_MIGRATIONS.length,9);
 for(const mutate of [a=>a.stock_transactions[0].__fm03_exact_row_json='{"quantity":1.0001}',a=>a.role_permissions=[],a=>a.subcontract_certifications[0].retained_amount=0,
  a=>a.transfer_receipts[0].quantity=5,a=>a.material_uom_activations.push({material_id:'legacy'}),a=>delete a.material_uom_plan_line_pins,
  a=>a._prisma_migrations[0].checksum='rewritten',a=>a._prisma_migrations.pop(),a=>a.permissions[0].permission_code='different']){
  const changed=structuredClone(after);mutate(changed);assert.throws(()=>verifyUomMigration(before,changed));
 }
});
function preserved(){
 const b={fixture:{companyId:'company',projectId:'site',adminUserId:'admin'},actors:Object.fromEntries(['KHAIMOOK','STORE_SITE','JAI'].map(k=>[k,{userId:k,roleId:'role-'+k}]))};
 const source={company:{id:'company'},each:{id:'each'},carton:{id:'carton'},material:{id:'material'}};
 const permissions=[...new Set(Object.values(UOM_GRANTS).flat())].map((permission_code,i)=>({id:'permission-'+i,permission_code}));
 const before={...Object.fromEntries(UOM_TABLES.map(t=>[t,[]])),permissions,users:[{id:'KHAIMOOK',email:'kept',last_login_at:'old',updated_at:'old',__fm03_exact_row_json:'old'}],
  role_permissions:[],units_of_measure:[],materials:[],audit_logs:[],user_sessions:[],stock_transactions:[{id:'stock',quantity:1,__fm03_exact_row_json:'{"quantity":1.0000}'}],
  material_request_receipts:[{id:'signed',document_id:'original'}],material_plan_issue_bindings:[{issue_id:'old',plan_id:'old'}],documents:[{id:'original',checksum:'kept'}]};
 const after=structuredClone(before);
 const grants=Object.entries(UOM_GRANTS).flatMap(([key,codes])=>codes.map(code=>({id:key+'-'+code,role_id:b.actors[key].roleId,permission_id:permissions.find(p=>p.permission_code===code).id})));
 after.role_permissions=grants;
 after.units_of_measure=[{id:'each',company_id:'company'},{id:'carton',company_id:'company'}];after.materials=[{id:'material',company_id:'company',default_uom_id:'carton'}];
 after.material_uom_bases=[{material_id:'material',company_id:'company'}];
 after.material_uom_revisions=[0,1].map(i=>({id:'revision-'+i,material_id:'material',company_id:'company'}));
 after.material_uom_operations=[0,1,2].map(i=>({id:'operation-'+i,material_id:'material',company_id:'company'}));
 after.user_sessions=[{id:'session',user_id:'KHAIMOOK',revoked_at:'now'}];
 after.audit_logs=[{id:'config',company_id:'company',entity_type:'PROTOTYPE_UOM_CONFIGURATION',entity_id:'site',actor_user_id:'admin'},
  ...['each','carton','material','material','material','material'].map((entity_id,i)=>({id:'audit-'+i,company_id:'company',entity_type:i<2?'UNIT_OF_MEASURE':i===2?'MATERIAL':'MATERIAL_UOM',entity_id,actor_user_id:'KHAIMOOK'}))];
 return {b,source,before,after,c:{addedRolePermissionIds:grants.map(r=>r.id)}};
}
test('new synthetic definitions cannot edit old rows, add composite-key effects, grant extra authority or leave live sessions',()=>{
 const f=preserved();verifyUomPreservation(f.before,f.after,f.c,f.b,f.source);
 for(const mutate of [a=>a.stock_transactions[0].__fm03_exact_row_json='{"quantity":1.0001}',a=>a.material_request_receipts[0].document_id='other',
  a=>a.material_plan_issue_bindings.push({issue_id:'new',plan_id:'old'}),a=>a.user_sessions[0].revoked_at=null,
  a=>a.role_permissions[0].permission_id='extra',a=>a.material_uom_bases[0].material_id='legacy',a=>a.materials[0].default_uom_id='old',
  a=>a.material_uom_activations.push({material_id:'legacy'}),a=>a.audit_logs[1].actor_user_id='admin',a=>a.users[0].email='rewritten',a=>a.documents[0].checksum='rewritten']){
  const changed=structuredClone(f.after);mutate(changed);assert.throws(()=>verifyUomPreservation(f.before,changed,f.c,f.b,f.source));
 }
 const authOnly=structuredClone(f.after);authOnly.users[0].last_login_at='now';authOnly.users[0].updated_at='now';authOnly.users[0].__fm03_exact_row_json='new auth timestamp';
 verifyUomPreservation(f.before,authOnly,f.c,f.b,f.source);
});
test('non-Mac and foreign-source calls fail before private reads or mutations',async()=>{
 if(process.platform!=='darwin')await assert.rejects(upgradeUom('a'.repeat(40)),e=>e.safeCode==='UOM_UPGRADE_NONROOT_MAC_REQUIRED');
 assert.equal(REHEARSAL_DB,'proto_a_01_uom_preupgrade');
 const forbidden=new Proxy({}, {get(){throw Error('database must not be touched');}});
 await assert.rejects(configureUom(forbidden,{sourceSha:'wrong'},'a'.repeat(64)),e=>e.safeCode==='UOM_CONFIGURATION_BINDING_INVALID');
 await assert.rejects(prepareUomSource(forbidden,{},{api:'https://external.invalid/api/v1',web:'https://external.invalid'}),e=>e.safeCode==='UOM_SOURCE_ORIGINS_REFUSED');
});
test('UOM CLI aliases fail closed and imports never execute an upgrade',async t=>{
 const source=await realpath(fileURLToPath(new URL('../uat/prototype-uom-upgrade.mjs',import.meta.url))),temporary=await mkdtemp(join(tmpdir(),'uom-cli-'));
 t.after(()=>rm(temporary,{recursive:true,force:true}));const alias=join(temporary,'alias');await symlink(dirname(source),alias,'dir');
 for(const [flags,path]of [[[],source],[[],join(alias,'prototype-uom-upgrade.mjs')],[['--preserve-symlinks-main'],join(alias,'prototype-uom-upgrade.mjs')]]){
  const r=spawnSync(process.execPath,[...flags,path,'--invalid','a'.repeat(40)],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,1);assert.equal(r.stderr,'');assert.equal(JSON.parse(r.stdout).code,'UOM_UPGRADE_EXECUTE_AND_SHA_REQUIRED');
 }
 const r=spawnSync(process.execPath,['--input-type=module','-e','await import('+JSON.stringify(new URL('../uat/prototype-uom-upgrade.mjs',import.meta.url).href)+')'],{encoding:'utf8',timeout:10000});
 assert.equal(r.status,0);assert.equal(r.stdout,'');assert.equal(r.stderr,'');
});
test('preserved application base is the reviewed Stage C tree and nine exact migration directories',async()=>{
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 assert.equal(git('rev-parse',APPLICATION_BASE+'^{tree}'),'71415b92ec46c4fb637f3da9977a39a575522a89');
 const names=(await readdir(new URL('../../apps/api/prisma/migrations/',import.meta.url))).filter(n=>n.includes('material_uom'));
 assert.deepEqual(names.sort(),[...UOM_MIGRATIONS].sort());
});
