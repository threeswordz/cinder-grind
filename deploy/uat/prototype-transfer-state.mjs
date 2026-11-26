// One controlled extension of the completed populated receiving prototype.
// No CLI, fixture bootstrap, stock injection, role replacement or retained data.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SOURCE,ROLES,httpClient} from './prototype-actors.mjs';
import {FM03_GRANTS,fm03Snapshot,digest} from './prototype-fm03-state.mjs';
import {receivingGrantsFor,verifyReceivingDocumentFiles} from './prototype-receiving-state.mjs';
import {transferTables} from '../release-candidate/transfer-schema-contract.mjs';
import {transferCatalog,verifyTransferCatalog} from '../release-candidate/transfer-catalog-contract.mjs';
export {fm03Snapshot as transferSnapshot,digest,verifyReceivingDocumentFiles as verifyTransferDocumentFiles};
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export const TRANSFER_MIGRATIONS=Object.freeze([
 '20261117001000_transfer_dispatch_receipt','20261117002000_transfer_custody_guards',
 '20261117003000_transfer_receipt_commit_binding','20261117004000_transfer_live_warehouse_scope',
 '20261117005000_transfer_warehouse_scope_lock']);
export const TRANSFER_GRANTS=Object.freeze({
 STORE_SITE:['inventory.transfer.view','inventory.transfer.create','inventory.transfer.submit','inventory.transfer.dispatch'],
 KHAIMOOK:['inventory.transfer.view','inventory.transfer.approve','inventory.transfer.configure','inventory.transfer.assign_receiver','inventory.transfer.receipt_view'],
 // An existing synthetic Employee exercises the explicitly assigned substitute.
 // This is not a new production Porn role policy or an implicit Store grant.
 PORN:['inventory.transfer.receipt_view','inventory.transfer.receive_assigned','documents.document.view','documents.document.upload','documents.document.link'],
});
const keys={login_rate_limit_buckets:'client_key',material_plan_issue_bindings:'issue_id',site_issue_routings:'project_id',
 receiving_project_policies:'project_id',transfer_project_policies:'project_id',transfer_custodies:'transfer_id'};
function rowKey(table,row){const v=row?.[keys[table]??'id'];demand(typeof v==='string'&&v.length>0,'TR_HISTORY_KEY_REQUIRED');return v;}
export function transferNewRows(table,before,after){const old=new Set(before.map(r=>rowKey(table,r)));return after.filter(r=>!old.has(rowKey(table,r)));}
export function verifyTransferHistoricalRows(before,after){
 demand(canonical(Object.keys(before).sort())===canonical(Object.keys(after).sort()),'TR_HISTORY_TABLE_SET_CHANGED');
 for(const [table,rows]of Object.entries(before)){
  demand(Array.isArray(after[table]),'TR_HISTORY_TABLE_MISSING');
  for(const row of rows)assert.deepEqual(after[table].find(r=>rowKey(table,r)===rowKey(table,row)),row,'Transfer changed historical '+table);
 }
}
export function verifyTransferMigration(before,after){
 const normalized=structuredClone(after),baseline=structuredClone(before);
 verifyTransferCatalog(after.permissions.filter(p=>transferCatalog.some(c=>c.id===p.id)).map(({__fm03_exact_row_json,...r})=>r),true);
 normalized.permissions=normalized.permissions.filter(p=>!transferCatalog.some(c=>c.id===p.id));
 for(const table of transferTables){demand(!Object.hasOwn(before,table)&&normalized[table]?.length===0,'TR_UPGRADE_NONEMPTY_OR_PRIOR_TRANSFER_TABLE');delete normalized[table];}
 const old=before._prisma_migrations,added=after._prisma_migrations.filter(n=>!old.some(m=>m.id===n.id));
 demand(after._prisma_migrations.length===old.length+5&&old.every(m=>after._prisma_migrations.some(n=>canonical(n)===canonical(m)))&&
  canonical(added.map(m=>m.migration_name).sort())===canonical([...TRANSFER_MIGRATIONS].sort())&&added.every(m=>m.finished_at&&!m.rolled_back_at),'TR_UPGRADE_WRONG_ADDITIVE_MIGRATIONS');
 normalized._prisma_migrations=old;
 normalized.stock_transactions=normalized.stock_transactions.map(row=>{
  demand(row.transfer_receipt_line_id===null,'TR_UPGRADE_HISTORICAL_STOCK_BACKFILLED');
  // Keep PostgreSQL's exact Decimal/timestamp bytes. Parsing JSON into JS may
  // otherwise hide a precision change in a large historical quantity.
  const {transfer_receipt_line_id,__fm03_exact_row_json:raw,...r}=row;
  const field=/,\s*"transfer_receipt_line_id"\s*:\s*null(?=\s*[,}])/g;
  demand(typeof raw==='string'&&[...raw.matchAll(field)].length===1,'TR_UPGRADE_EXACT_STOCK_BYTES_REQUIRED');
  return {...r,__fm03_exact_row_json:raw.replace(field,'')};
 });
 assert.deepEqual(normalized,baseline,'Transfer migration changed populated history, grants or receiving state');
}
export async function configureTransfer(db,binding,expected){
 const b=structuredClone(binding),f=b.fixture;
 demand(b.sourceSha===SOURCE&&/^[a-f0-9]{64}$/.test(expected??''),'TR_CONFIGURATION_BINDING_INVALID');
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('prototype-transfer-configuration-v1'))");
  demand(digest(await fm03Snapshot(tx))===expected,'TR_CONFIGURATION_STATE_DRIFT');
  const companies=await tx.company.findMany();
  demand(companies.length===2&&companies.every(c=>c.isActive&&c.baseCurrencyCode==='THB')&&
   companies.some(c=>c.id===f.companyId&&c.companyCode==='PROTO_A')&&companies.some(c=>c.id===f.foreignCompanyId&&c.companyCode==='PROTO_B'),'TR_SYNTHETIC_COMPANIES_REQUIRED');
  for(const [id,projectCode]of [[f.projectId,'SITE_A'],[f.unassignedProjectId,'SITE_B']])
   demand(await tx.project.count({where:{id,companyId:f.companyId,projectCode,isActive:true}})===1,'TR_PROJECT_BINDING_DRIFT');
  demand(await tx.warehouse.count({where:{id:f.warehouseId,companyId:f.companyId,projectId:f.projectId,isActive:true}})===1,'TR_SOURCE_WAREHOUSE_DRIFT');
  demand(await tx.siteIssue.count()===1&&await tx.siteIssue.count({where:{companyId:f.companyId,status:'CLOSED',version:6}})===1&&
   await tx.receivingDelivery.count()===1&&await tx.goodsReceipt.count({where:{companyId:f.companyId,deliveryId:{not:null},postedAt:{not:null}}})===1,'TR_COMPLETED_RECEIVING_AND_FM03_REQUIRED');
  for(const model of ['transferProjectPolicy','transferCustody','stockTransfer'])demand(await tx[model].count()===0,'TR_TRANSFER_ALREADY_EXISTS');
  const allKeys=Object.keys(ROLES),members=await tx.userRole.findMany({where:{roleId:{in:allKeys.map(k=>b.actors[k].roleId)}}});
  demand(members.length===allKeys.length&&members.every(m=>m.companyId===f.companyId&&allKeys.some(k=>m.userId===b.actors[k].userId&&m.roleId===b.actors[k].roleId)),'TR_ROLE_MEMBERSHIP_MUST_BE_EXCLUSIVE');
  const added=[];
  for(const key of allKeys){
   const a=b.actors[key],user=await tx.user.findUnique({where:{id:a.userId},include:{userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
   demand(user?.isActive&&user.companyId===f.companyId&&user.employeeId===a.employeeId&&user.email==='proto-'+key.toLowerCase()+'@example.invalid'&&
    user.userRoles.length===1&&user.userRoles[0].roleId===a.roleId&&user.userRoles[0].role.companyId===f.companyId&&
    user.userRoles[0].role.roleCode==='PROTO_'+key&&user.userRoles[0].role.isActive&&
    await tx.employee.count({where:{id:a.employeeId,companyId:f.companyId,isActive:true}})===1&&
    await tx.projectMember.count({where:{employeeId:a.employeeId,projectId:f.projectId,isActive:true}})===1,'TR_ACTOR_SCOPE_DRIFT');
   const delta=b.configuration?.changes?.find(c=>c.roleCode==='PROTO_'+key)?.addedCapabilities??[];
   const wanted=[...new Set([...ROLES[key].permissions,...delta,...(FM03_GRANTS[key]??[]),...(receivingGrantsFor(b)[key]??[])])].sort();
   demand(canonical(user.userRoles[0].role.rolePermissions.map(r=>r.permission.permissionCode).sort())===canonical(wanted),'TR_EXISTING_GRANT_MATRIX_CHANGED');
   const missing=(TRANSFER_GRANTS[key]??[]).filter(code=>!wanted.includes(code)),catalog=await tx.permission.findMany({where:{permissionCode:{in:missing}}});
   demand(catalog.length===missing.length,'TR_MIGRATED_CAPABILITY_CATALOG_REQUIRED');
   for(const permission of catalog)added.push(await tx.rolePermission.create({data:{roleId:a.roleId,permissionId:permission.id}}));
  }
  demand(await tx.warehouse.count({where:{companyId:f.companyId,warehouseCode:'PROTO_TRANSFER_DEST'}})===0&&
   await tx.projectMember.count({where:{projectId:f.unassignedProjectId,employeeId:b.actors.PORN.employeeId}})===0&&
   await tx.approvalWorkflow.count({where:{companyId:f.companyId,entityType:'STOCK_TRANSFER'}})===0&&
   await tx.numberSequence.count({where:{companyId:f.companyId,sequenceCode:'STOCK_TRANSFER'}})===0,'TR_EXISTING_CONFIGURATION_RECONCILIATION_REQUIRED');
  const warehouse=await tx.warehouse.create({data:{companyId:f.companyId,projectId:f.unassignedProjectId,warehouseCode:'PROTO_TRANSFER_DEST',warehouseName:'Synthetic destination warehouse',isSiteWarehouse:true}});
  const member=await tx.projectMember.create({data:{projectId:f.unassignedProjectId,employeeId:b.actors.PORN.employeeId,projectRole:'Explicit synthetic destination receiver'}});
  const workflow=await tx.approvalWorkflow.create({data:{companyId:f.companyId,entityType:'STOCK_TRANSFER',workflowCode:'PROTO_TRANSFER_APPROVAL',workflowName:'Independent synthetic transfer approval',
   steps:{create:[{stepNo:1,stepName:'Independent Khaimook decision',requiredApprovals:1,stepRoles:{create:[{roleId:b.actors.KHAIMOOK.roleId}]}}]}}});
  const sequence=await tx.numberSequence.create({data:{companyId:f.companyId,entityType:'STOCK_TRANSFER',sequenceCode:'STOCK_TRANSFER',formatTemplate:'STYYMM-###',resetRule:'MONTHLY'}});
  const type=await tx.documentType.findFirst({where:{id:b.configuration.documentTypeId,companyId:f.companyId,isActive:true}});
  demand(type&&!type.documentTypeCode.startsWith('HR_')&&await tx.hrDocumentAttachment.count({where:{document:{documentTypeId:type.id}}})===0,'TR_ORDINARY_DOCUMENT_TYPE_REQUIRED');
  await tx.auditLog.create({data:{companyId:f.companyId,entityType:'PROTOTYPE_TRANSFER_CONFIGURATION',entityId:f.projectId,action:'CONFIGURE',actorUserId:f.adminUserId,
   newValues:{syntheticOnly:true,grantMatrix:TRANSFER_GRANTS,destinationProjectId:f.unassignedProjectId,receiverEmployeeId:b.actors.PORN.employeeId}}});
  return {status:'TRANSFER_SYNTHETIC_CONFIGURATION_APPLIED',addedRolePermissionIds:added.map(r=>r.id),warehouse,member,workflow,sequence,documentTypeId:type.id,productionAuthorized:false};
 },{isolationLevel:'Serializable',timeout:30000});
}
export async function prepareTransferSource(db,binding,configuration,origins){
 const {api,web}=structuredClone(origins),b=structuredClone(binding),f=b.fixture,c=structuredClone(configuration);
 demand(process.platform==='darwin'&&api==='http://127.0.0.1:33071/api/v1'&&web==='http://127.0.0.1:44171'||
  process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&api==='http://127.0.0.1:31319/api/v1'&&web==='http://127.0.0.1:44319','TR_SOURCE_ORIGINS_REFUSED');
 let id;
 const base='/inventory/transfer-custody',project=base+'/projects/'+f.unassignedProjectId;
 const client=httpClient(api,web,async(url,options)=>{
  const path=url.slice(api.length),auth=['/auth/login','/auth/logout','/auth/me'].includes(path);
  const allowed=auth||options.method==='POST'&&[
   base+'/projects/'+f.projectId+'/enable','/inventory/stock-transfers',
   id&&'/inventory/stock-transfers/'+id+'/submit',id&&'/inventory/stock-transfers/'+id+'/approve',id&&project+'/transfers/'+id+'/assign'].includes(path)||
   options.method==='GET'&&id&&[project+'/transfers/'+id,'/inventory/stock-transfers/'+id].includes(path);
  demand(url.startsWith(api+'/')&&options.redirect==='error'&&options.headers.Origin===web&&allowed,'TR_SOURCE_UNDECLARED_REQUEST');return fetch(url,options);
 });
 const sessions={},call=async(key,label,path,body)=>(await client.call(sessions[key],label,path,body===undefined?200:201,body)).value.data;
 let primary,result;
 const priorStock=await db.stockTransaction.findMany({orderBy:{id:'asc'}});
 try{
  for(const key of ['STORE_SITE','KHAIMOOK'])sessions[key]=await client.login(key,b.actors[key],f.companyId);
  await call('KHAIMOOK','TR_POLICY_ENABLE',base+'/projects/'+f.projectId+'/enable',{requestKey:randomUUID(),reason:'Explicit synthetic dispatch/actual-receipt policy'});
  const transfer=await call('STORE_SITE','TR_CREATE','/inventory/stock-transfers',{sourceWarehouseId:f.warehouseId,destinationWarehouseId:c.warehouse.id,
   transferDate:new Date().toISOString().slice(0,10),remarks:'Synthetic transfer; no financial effect',lines:[{materialId:f.materialId,quantity:'5.0000',uomId:f.uomId,
    sourceProjectId:f.projectId,destinationProjectId:f.unassignedProjectId,remarks:'Synthetic origin work'}]});id=transfer.id;
  await call('STORE_SITE','TR_SUBMIT','/inventory/stock-transfers/'+id+'/submit',{workflowCode:c.workflow.workflowCode});
  await call('KHAIMOOK','TR_APPROVE','/inventory/stock-transfers/'+id+'/approve',{postKey:randomUUID(),comment:'Independent approval; no stock until actual dispatch'});
  assert.deepEqual(await db.stockTransaction.findMany({orderBy:{id:'asc'}}),priorStock,'Transfer approval moved stock');
  const current=await call('KHAIMOOK','TR_DEST_READ',project+'/transfers/'+id);
  await call('KHAIMOOK','TR_EXPLICIT_ASSIGN',project+'/transfers/'+id+'/assign',{requestKey:randomUUID(),expectedVersion:current.version,employeeId:b.actors.PORN.employeeId,
   reason:'Khaimook explicitly assigns this active synthetic destination Employee while Store is absent'});
  const source=await call('STORE_SITE','TR_SOURCE_READ','/inventory/stock-transfers/'+id);
  demand(source.id===id&&source.items.length===1&&Number(source.items[0].quantity)===5,'TR_APPROVED_SOURCE_BINDING_REQUIRED');
  result={id,number:source.transferNumber,observations:client.observations};
 }catch(e){primary=e;}
 finally{for(const [key,session]of Object.entries(sessions))try{await client.logout(key,session);await client.call(session,'TR_'+key+'_REVOKED','/auth/me',401);}catch(e){primary??=e;}}
 if(primary)throw primary;return result;
}
export async function transferBrowserBinding(db,b,c,source,origins){
 const f=b.fixture,material=await db.material.findUniqueOrThrow({where:{id:f.materialId}});
 return {...origins,fixture:{company:{id:f.companyId},id:source.id,number:source.number,destination:{id:f.unassignedProjectId},
  documentType:{id:c.documentTypeId},materialCode:material.materialCode,
  actors:{store:b.actors.STORE_SITE,receiver:b.actors.PORN,outsider:b.actors.FOREMAN}}};
}
export function verifyTransferJourneyPreservation(before,after,c,b,source,result){
 const f=b.fixture,loginIds=['STORE_SITE','KHAIMOOK','PORN','FOREMAN'].map(k=>b.actors[k].userId),normalized=structuredClone(after),baseline=structuredClone(before);
 for(const data of [baseline,normalized])data.users=data.users.map(row=>{if(!loginIds.includes(row.id))return row;const {last_login_at,updated_at,__fm03_exact_row_json,...r}=row;return r;});
 verifyTransferHistoricalRows(baseline,normalized);
 const added=t=>transferNewRows(t,baseline[t],normalized[t]);
 const counts={role_permissions:c.addedRolePermissionIds.length,warehouses:1,project_members:1,approval_workflows:1,approval_steps:1,approval_step_roles:1,
  number_sequences:1,stock_transfers:1,stock_transfer_items:1,stock_transactions:2,documents:1,document_links:2,approval_instances:1,approval_actions:1,
  transfer_project_policies:1,transfer_custodies:1,transfer_dispatches:1,transfer_receiver_assignments:1,transfer_receipts:1,transfer_receipt_lines:1,
  transfer_custody_events:6,transfer_operations:6};
 for(const table of Object.keys(baseline)){
  const fresh=added(table);
  if(table==='users'){demand(fresh.length===0,'TR_UNEXPECTED_USERS');continue;}
  if(table==='user_sessions'){demand(fresh.length>0&&fresh.every(r=>r.revoked_at&&loginIds.includes(r.user_id)),'TR_FRESH_SESSION_NOT_REVOKED');continue;}
  if(table==='audit_logs'){
   const entities=new Set(['PROTOTYPE_TRANSFER_CONFIGURATION','STOCK_TRANSFER','DOCUMENT','DOCUMENT_LINK']);
   demand(fresh.length>0&&fresh.every(r=>r.company_id===f.companyId&&[f.adminUserId,...loginIds].includes(r.actor_user_id)&&entities.has(r.entity_type)),'TR_UNEXPECTED_AUDIT_ADDITION');continue;
  }
  demand(fresh.length===(counts[table]??0),'TR_UNEXPECTED_ADDITIONS_'+table.toUpperCase());
  for(const row of fresh)if(Object.hasOwn(row,'company_id'))demand(row.company_id===f.companyId,'TR_NEW_ROW_WRONG_COMPANY');
 }
 demand(canonical(added('role_permissions').map(r=>r.id).sort())===canonical([...c.addedRolePermissionIds].sort()),'TR_GRANT_DELTA_CHANGED');
 const oldGrants=new Set(baseline.role_permissions.map(r=>r.role_id+':'+r.permission_id));
 const expectedGrants=Object.entries(TRANSFER_GRANTS).flatMap(([key,codes])=>codes.map(code=>{
  const permission=after.permissions.find(p=>p.permission_code===code);demand(permission,'TR_FINAL_CAPABILITY_MISSING');
  return b.actors[key].roleId+':'+permission.id;
 })).filter(key=>!oldGrants.has(key)).sort();
 demand(canonical(added('role_permissions').map(r=>r.role_id+':'+r.permission_id).sort())===canonical(expectedGrants),'TR_FINAL_EXACT_GRANT_MATRIX_CHANGED');
 demand(added('warehouses')[0].id===c.warehouse.id&&added('project_members')[0].id===c.member.id&&added('stock_transfers')[0].id===source.id,'TR_CONFIGURATION_SOURCE_IDS_CHANGED');
 demand(canonical(added('transfer_operations').map(r=>r.action).sort())===canonical(['ENABLE','APPROVE','ASSIGN','DISPATCH','PREPARE_RECEIPT','RECEIVE'].sort()),'TR_OPERATION_HISTORY_INVALID');
 const stock=added('stock_transactions'),out=stock.find(r=>r.movement_type==='STOCK_TRANSFER_OUT'),incoming=stock.find(r=>r.movement_type==='STOCK_TRANSFER_IN');
 demand(out?.stock_transfer_id===source.id&&out.quantity===-5&&out.warehouse_id===f.warehouseId&&out.posted_by_user_id===b.actors.STORE_SITE.userId&&
  incoming?.stock_transfer_id===source.id&&incoming.quantity===4&&incoming.warehouse_id===c.warehouse.id&&incoming.posted_by_user_id===b.actors.PORN.userId,'TR_FINAL_STOCK_ACTORS_OR_SOURCE_INVALID');
 const receipt=added('transfer_receipts')[0],line=added('transfer_receipt_lines')[0],assignment=added('transfer_receiver_assignments')[0];
 demand(receipt.id===result.receiptId&&receipt.transfer_id===source.id&&receipt.project_id===f.unassignedProjectId&&receipt.posted_at&&receipt.created_by_user_id===b.actors.PORN.userId&&
  line.receipt_id===receipt.id&&line.quantity===4&&incoming.transfer_receipt_line_id===line.id&&
  assignment.employee_id===b.actors.PORN.employeeId&&assignment.actor_user_id===b.actors.KHAIMOOK.userId,'TR_FINAL_RECEIPT_ASSIGNMENT_INVALID');
 demand(added('documents').every(d=>result.documentIds.includes(d.id)&&receipt.document_id===d.id&&receipt.checksum===d.checksum&&
  d.uploaded_by_user_id===b.actors.PORN.userId&&d.document_type_id===c.documentTypeId),'TR_FINAL_DOCUMENT_SCOPE_INVALID');
}
