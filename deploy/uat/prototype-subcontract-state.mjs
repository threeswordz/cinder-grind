// Bounded extension of the completed populated transfer prototype. No bootstrap/reset.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SOURCE,ROLES,httpClient} from './prototype-actors.mjs';
import {fm03Snapshot,digest,FM03_GRANTS} from './prototype-fm03-state.mjs';
import {RECEIVING_GRANTS} from './prototype-receiving-state.mjs';
import {TRANSFER_GRANTS,verifyTransferHistoricalRows,transferNewRows} from './prototype-transfer-state.mjs';
import {physicalTables,physicalMigrations} from '../release-candidate/subcontract-physical-schema-contract.mjs';
import {physicalCatalog,verifyPhysicalCatalog} from '../release-candidate/subcontract-physical-catalog-contract.mjs';
export {fm03Snapshot as subcontractSnapshot,digest};
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const sorted=v=>JSON.stringify([...v].sort());
const view=['subcontracts.claim.view','subcontracts.physical.view','documents.document.view'];
export const SUBCONTRACT_GRANTS=Object.freeze({
 KHAIMOOK:[...view,'subcontracts.subcontractor.view','subcontracts.subcontractor.manage',
  'subcontracts.agreement.view','subcontracts.agreement.create','subcontracts.agreement.submit',
  'subcontracts.work_order.view','subcontracts.work_order.create','subcontracts.work_order.submit',
  'subcontracts.claim.create','subcontracts.claim.edit','subcontracts.claim.submit','subcontracts.physical.edit',
  'documents.document.upload','documents.document.link'],
 BEN:[...view,'subcontracts.agreement.view','subcontracts.agreement.approve','subcontracts.work_order.view','subcontracts.work_order.approve',
  'subcontracts.physical.configure','subcontracts.physical.decide','subcontracts.assessment.assess','subcontracts.assessment.view'],
 PORN:[...view,'subcontracts.assessment.view','subcontracts.certification.view','subcontracts.certification.create','subcontracts.certification.edit','subcontracts.certification.submit'],
 NANCY:[...view,'subcontracts.certification.view','subcontracts.certification.approve'],
});
export function verifySubcontractMigration(before,after){
 const normalized=structuredClone(after);
 verifyPhysicalCatalog(after.permissions.filter(p=>physicalCatalog.some(c=>c.id===p.id)).map(({__fm03_exact_row_json,...r})=>r),true);
 normalized.permissions=normalized.permissions.filter(p=>!physicalCatalog.some(c=>c.id===p.id));
 for(const t of physicalTables){demand(!Object.hasOwn(before,t)&&normalized[t]?.length===0,'PA_UPGRADE_NONEMPTY_OR_PRIOR_PHYSICAL_TABLE');delete normalized[t];}
 const added=after._prisma_migrations.filter(n=>!before._prisma_migrations.some(m=>m.id===n.id));
 demand(after._prisma_migrations.length===before._prisma_migrations.length+physicalMigrations.length&&
  sorted(added.map(m=>m.migration_name))===sorted(physicalMigrations)&&added.every(m=>m.finished_at&&!m.rolled_back_at),'PA_UPGRADE_WRONG_ADDITIVE_MIGRATIONS');
 normalized._prisma_migrations=after._prisma_migrations.filter(n=>before._prisma_migrations.some(m=>m.id===n.id));
 assert.deepEqual(normalized,before,'Physical migration changed historical rows, grants or exact PostgreSQL bytes');
}
export async function configureSubcontract(db,binding,expected){
 const b=structuredClone(binding),f=b.fixture;
 demand(b.sourceSha===SOURCE&&/^[a-f0-9]{64}$/.test(expected??''),'PA_CONFIGURATION_BINDING_INVALID');
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('prototype-subcontract-configuration-v1'))");
  demand(digest(await fm03Snapshot(tx))===expected,'PA_CONFIGURATION_STATE_DRIFT');
  const companies=await tx.company.findMany();
  demand(companies.length===2&&companies.every(c=>c.isActive&&c.baseCurrencyCode==='THB')&&
   companies.some(c=>c.id===f.companyId&&c.companyCode==='PROTO_A')&&companies.some(c=>c.id===f.foreignCompanyId&&c.companyCode==='PROTO_B'),'PA_SYNTHETIC_COMPANIES_REQUIRED');
  demand(await tx.project.count({where:{id:f.projectId,companyId:f.companyId,projectCode:'SITE_A',isActive:true}})===1,'PA_PROJECT_BINDING_DRIFT');
  demand(await tx.siteIssue.count({where:{companyId:f.companyId,status:'CLOSED',version:6}})===1&&
   await tx.receivingDelivery.count()===1&&await tx.transferReceipt.count()===1&&await tx.transferDispatch.count()===1,'PA_COMPLETED_PREDECESSORS_REQUIRED');
  for(const model of ['subcontractor','subcontractAgreement','subcontractClaim','subcontractCertification','subcontractPhysicalPolicy'])
   demand(await tx[model].count()===0,'PA_SUBCONTRACT_ALREADY_EXISTS');
  const keys=Object.keys(ROLES),members=await tx.userRole.findMany({where:{roleId:{in:keys.map(k=>b.actors[k].roleId)}}});
  demand(members.length===keys.length&&members.every(m=>m.companyId===f.companyId&&keys.some(k=>m.userId===b.actors[k].userId&&m.roleId===b.actors[k].roleId)),'PA_ROLE_MEMBERSHIP_MUST_BE_EXCLUSIVE');
  const added=[];
  for(const key of keys){
   const a=b.actors[key],user=await tx.user.findUnique({where:{id:a.userId},include:{userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
   demand(user?.isActive&&user.companyId===f.companyId&&user.employeeId===a.employeeId&&user.email==='proto-'+key.toLowerCase()+'@example.invalid'&&
    user.userRoles.length===1&&user.userRoles[0].roleId===a.roleId&&user.userRoles[0].role.companyId===f.companyId&&user.userRoles[0].role.roleCode==='PROTO_'+key&&user.userRoles[0].role.isActive&&
    await tx.employee.count({where:{id:a.employeeId,companyId:f.companyId,isActive:true}})===1&&
    await tx.projectMember.count({where:{employeeId:a.employeeId,projectId:f.projectId,isActive:true}})===1,'PA_ACTOR_SCOPE_DRIFT');
   const delta=b.configuration?.changes?.find(c=>c.roleCode==='PROTO_'+key)?.addedCapabilities??[];
   const wanted=[...new Set([...ROLES[key].permissions,...delta,...(FM03_GRANTS[key]??[]),...(RECEIVING_GRANTS[key]??[]),...(TRANSFER_GRANTS[key]??[])])];
   demand(sorted(user.userRoles[0].role.rolePermissions.map(r=>r.permission.permissionCode))===sorted(wanted),'PA_EXISTING_GRANT_MATRIX_CHANGED');
   const missing=(SUBCONTRACT_GRANTS[key]??[]).filter(code=>!wanted.includes(code)),catalog=await tx.permission.findMany({where:{permissionCode:{in:missing}}});
   demand(catalog.length===missing.length,'PA_MIGRATED_CAPABILITY_CATALOG_REQUIRED');
   for(const permission of catalog)added.push(await tx.rolePermission.create({data:{roleId:a.roleId,permissionId:permission.id}}));
  }
  const workflows={};
  for(const [entityType,key]of [['SUBCONTRACT_AGREEMENT','BEN'],['SUBCONTRACT_WORK_ORDER','BEN'],['SUBCONTRACT_CERTIFICATION','NANCY']]){
   demand(await tx.approvalWorkflow.count({where:{companyId:f.companyId,entityType}})===0&&
    await tx.numberSequence.count({where:{companyId:f.companyId,entityType}})===0,'PA_EXISTING_CONFIGURATION_RECONCILIATION_REQUIRED');
   workflows[entityType]=await tx.approvalWorkflow.create({data:{companyId:f.companyId,entityType,workflowCode:'PROTO_PA_'+entityType,workflowName:'Independent synthetic '+entityType,
    steps:{create:[{stepNo:1,stepName:'Independent synthetic checker',requiredApprovals:1,stepRoles:{create:[{roleId:b.actors[key].roleId}]}}]}}});
  }
  const type=await tx.documentType.findFirst({where:{id:b.configuration.documentTypeId,companyId:f.companyId,isActive:true}});
  demand(type&&!type.documentTypeCode.startsWith('HR_')&&await tx.hrDocumentAttachment.count({where:{document:{documentTypeId:type.id}}})===0,'PA_ORDINARY_DOCUMENT_TYPE_REQUIRED');
  demand(await tx.unitOfMeasure.count({where:{id:f.uomId,companyId:f.companyId,isActive:true,decimalPlaces:4}})===1,'PA_EXISTING_UOM_REQUIRED');
  await tx.auditLog.create({data:{companyId:f.companyId,entityType:'PROTOTYPE_SUBCONTRACT_CONFIGURATION',entityId:f.projectId,action:'CONFIGURE',actorUserId:f.adminUserId,
   newValues:{syntheticOnly:true,grantMatrix:SUBCONTRACT_GRANTS}}});
  return {status:'SUBCONTRACT_SYNTHETIC_CONFIGURATION_APPLIED',addedRolePermissionIds:added.map(r=>r.id),workflows,documentTypeId:type.id,productionAuthorized:false};
 },{isolationLevel:'Serializable',timeout:30000});
}
export function validSubcontractOrigins(api,web){return process.platform==='darwin'&&api==='http://127.0.0.1:33071/api/v1'&&web==='http://127.0.0.1:44171'||
 process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&api==='http://127.0.0.1:31319/api/v1'&&web==='http://127.0.0.1:44319';}
export async function prepareSubcontractSource(db,binding,configuration,origins){
 const {api,web}=structuredClone(origins),b=structuredClone(binding),f=b.fixture,c=structuredClone(configuration);
 demand(validSubcontractOrigins(api,web),'PA_SOURCE_ORIGINS_REFUSED');
 const ids={},sessions={};
 const client=httpClient(api,web,async(url,options)=>{
  const path=url.slice(api.length),auth=['/auth/login','/auth/logout','/auth/me'].includes(path);
  demand(url.startsWith(api+'/')&&options.redirect==='error'&&options.headers.Origin===web,'PA_SOURCE_TRANSPORT_REFUSED');
  const allowed=auth||options.method==='POST'&&['/subcontracts/subcontractors','/subcontracts/agreements',
   '/subcontracts/physical/projects/'+f.projectId+'/enable',ids.agreement&&'/subcontracts/agreements/'+ids.agreement+'/submit',
   ids.agreement&&'/subcontracts/agreements/'+ids.agreement+'/approve',ids.agreement&&'/subcontracts/agreements/'+ids.agreement+'/work-orders',
   ids.wo&&'/subcontracts/work-orders/'+ids.wo+'/submit',ids.wo&&'/subcontracts/work-orders/'+ids.wo+'/approve',
   ids.agreement&&'/subcontracts/agreements/'+ids.agreement+'/claims',ids.claim&&'/subcontracts/claims/'+ids.claim+'/lines'].includes(path);
  demand(allowed,'PA_SOURCE_UNDECLARED_REQUEST');return fetch(url,options);
 });
 const call=async(key,label,path,body)=>(await client.call(sessions[key],label,path,201,body)).value.data;
 let result,primary;
 try{
  for(const key of ['KHAIMOOK','BEN'])sessions[key]=await client.login(key,b.actors[key],f.companyId);
  const contractor=await call('KHAIMOOK','PA_CONTRACTOR','/subcontracts/subcontractors',{subcontractorCode:'PROTO_PA_CONTRACTOR',subcontractorName:'Synthetic physical work contractor'});
  const agreement=await call('KHAIMOOK','PA_AGREEMENT','/subcontracts/agreements',{projectId:f.projectId,subcontractorId:contractor.id,originalValue:'10000.00',currencyCode:'THB',retentionRate:'5.00',scopeOfWork:'Synthetic physical work',createKey:randomUUID()});ids.agreement=agreement.id;
  await call('KHAIMOOK','PA_AGREEMENT_SUBMIT','/subcontracts/agreements/'+ids.agreement+'/submit',{workflowCode:c.workflows.SUBCONTRACT_AGREEMENT.workflowCode,actionKey:randomUUID()});
  await call('BEN','PA_AGREEMENT_APPROVE','/subcontracts/agreements/'+ids.agreement+'/approve',{actionKey:randomUUID(),comment:'Independent synthetic agreement approval'});
  const wo=await call('KHAIMOOK','PA_WORK_ORDER','/subcontracts/agreements/'+ids.agreement+'/work-orders',{scopeOfWork:'Measured synthetic installed work',amount:'1000.00'});ids.wo=wo.id;
  await call('KHAIMOOK','PA_WORK_ORDER_SUBMIT','/subcontracts/work-orders/'+ids.wo+'/submit',{workflowCode:c.workflows.SUBCONTRACT_WORK_ORDER.workflowCode,actionKey:randomUUID()});
  await call('BEN','PA_WORK_ORDER_APPROVE','/subcontracts/work-orders/'+ids.wo+'/approve',{actionKey:randomUUID(),comment:'Independent synthetic WO approval'});
  await call('BEN','PA_ENABLE','/subcontracts/physical/projects/'+f.projectId+'/enable',{requestKey:randomUUID(),reason:'Explicit bounded synthetic physical acceptance'});
  const claim=await call('KHAIMOOK','PA_CLAIM','/subcontracts/agreements/'+ids.agreement+'/claims',{periodStart:'2026-11-01',periodEnd:'2026-11-18'});ids.claim=claim.id;
  const line=await call('KHAIMOOK','PA_LINE','/subcontracts/claims/'+ids.claim+'/lines',{amount:'1000.00',workOrderId:ids.wo});
  demand(await db.subcontractClaim.count({where:{id:claim.id,companyId:f.companyId,projectId:f.projectId,state:'DRAFT'}})===1&&
   await db.subcontractPhysicalClaim.count({where:{claimId:claim.id,version:1}})===1,'PA_CANONICAL_SOURCE_REQUIRED');
  result={contractorId:contractor.id,agreementId:agreement.id,workOrderId:wo.id,claimId:claim.id,claimNumber:claim.claimNumber,lineId:line.id,observations:client.observations};
 }catch(e){primary=e;}finally{
  for(const [key,session]of Object.entries(sessions))try{await client.logout(key,session);await client.call(session,'PA_'+key+'_REVOKED','/auth/me',401);}catch(e){primary??=e;}
 }
 if(primary)throw primary;return result;
}
export function subcontractBrowserBinding(b,c,source,origins,downloadRoot,technical){
 const f=b.fixture;
 demand(technical?.userId===f.adminUserId&&technical.email==='proto-admin@example.invalid'&&/^[a-f0-9]{64}$/.test(technical.password??''),'PA_TECHNICAL_ACTOR_BINDING_REQUIRED');
 return {...origins,downloadRoot,fixture:{company:{id:f.companyId},project:{id:f.projectId},agreement:{id:source.agreementId},claim:{id:source.claimId,number:source.claimNumber},
  line:{id:source.lineId},uom:{id:f.uomId},documentType:{id:c.documentTypeId},workflowCode:c.workflows.SUBCONTRACT_CERTIFICATION.workflowCode,
  actors:{maker:b.actors.KHAIMOOK,ben:b.actors.BEN,porn:b.actors.PORN,nancy:b.actors.NANCY,outsider:b.actors.FOREMAN,technical}}};
}
export function verifySubcontractPreservation(before,after,c,b,source,result){
 const f=b.fixture,logins=['KHAIMOOK','BEN','PORN','NANCY','FOREMAN'].map(k=>b.actors[k].userId).concat(f.adminUserId),baseline=structuredClone(before),normalized=structuredClone(after);
 for(const data of [baseline,normalized])data.users=data.users.map(row=>{if(!logins.includes(row.id))return row;const {last_login_at,updated_at,__fm03_exact_row_json,...r}=row;return r;});
 verifyTransferHistoricalRows(baseline,normalized);
 demand(physicalTables.every(t=>baseline[t]?.length===0),'PA_PRIOR_PHYSICAL_STATE_REFUSED');
 const added=t=>physicalTables.includes(t)?normalized[t]:transferNewRows(t,baseline[t],normalized[t]);
 const counts={role_permissions:c.addedRolePermissionIds.length,approval_workflows:3,approval_steps:3,approval_step_roles:3,number_sequences:3,
  subcontractors:1,subcontract_agreements:1,subcontract_agreement_versions:1,subcontract_work_orders:1,subcontract_claims:1,subcontract_claim_lines:1,
  subcontract_claim_assessments:1,subcontract_certifications:1,subcontract_action_replays:8,
  subcontract_physical_policies:1,subcontract_physical_claims:1,subcontract_physical_revisions:1,subcontract_physical_submissions:1,subcontract_physical_decisions:1,subcontract_physical_operations:2,
  documents:1,document_links:2,approval_instances:3,approval_actions:3};
 for(const table of Object.keys(baseline)){
  const fresh=added(table);
  if(table==='user_sessions'){demand(fresh.length>0&&fresh.every(r=>r.revoked_at&&logins.includes(r.user_id)),'PA_SESSION_NOT_REVOKED');continue;}
  if(table==='audit_logs'){
   const types=['PROTOTYPE_SUBCONTRACT_CONFIGURATION','SUBCONTRACTOR','SUBCONTRACT_AGREEMENT','SUBCONTRACT_WORK_ORDER','SUBCONTRACT_CLAIM','SUBCONTRACT_CLAIM_LINE','SUBCONTRACT_CLAIM_ASSESSMENT','SUBCONTRACT_CERTIFICATION','DOCUMENT','DOCUMENT_LINK'];
   demand(fresh.length>0&&fresh.every(r=>r.company_id===f.companyId&&logins.includes(r.actor_user_id)&&types.includes(r.entity_type)),'PA_UNEXPECTED_AUDIT_ADDITION');continue;
  }
  demand(fresh.length===(counts[table]??0),'PA_UNEXPECTED_ADDITIONS_'+table.toUpperCase());
  for(const row of fresh)if(Object.hasOwn(row,'company_id'))demand(row.company_id===f.companyId,'PA_NEW_ROW_WRONG_COMPANY');
 }
 demand(sorted(added('role_permissions').map(r=>r.id))===sorted(c.addedRolePermissionIds),'PA_GRANT_DELTA_CHANGED');
 const oldGrants=new Set(before.role_permissions.map(r=>r.role_id+':'+r.permission_id));
 const expected=Object.entries(SUBCONTRACT_GRANTS).flatMap(([key,codes])=>codes.map(code=>b.actors[key].roleId+':'+after.permissions.find(p=>p.permission_code===code)?.id)).filter(x=>!oldGrants.has(x));
 demand(sorted(added('role_permissions').map(r=>r.role_id+':'+r.permission_id))===sorted(expected),'PA_EXACT_GRANT_MATRIX_CHANGED');
 const claim=added('subcontract_claims')[0],decision=added('subcontract_physical_decisions')[0],cert=added('subcontract_certifications')[0],assessment=added('subcontract_claim_assessments')[0];
 demand(claim.id===source.claimId&&claim.state==='ASSESSED'&&claim.created_by_user_id===b.actors.KHAIMOOK.userId&&
  decision.claim_id===source.claimId&&decision.actor_user_id===b.actors.BEN.userId&&Number(decision.assessed_amount)===731.25&&
  Number(decision.decisions[0].acceptedQuantity)===8&&Number(decision.decisions[0].heldQuantity)===2&&decision.decisions[0].heldDisposition==='REWORK'&&
  cert.id===result.certificationId&&cert.claim_id===source.claimId&&cert.state==='APPROVED'&&Number(cert.certified_gross)===731.25&&Number(cert.retained_amount)===36.56&&
  assessment.id===decision.assessment_id&&Number(assessment.assessed_amount)===731.25,'PA_FINAL_CANONICAL_PHYSICAL_MONEY_BINDING_INVALID');
 demand(added('documents').every(d=>result.documentIds.includes(d.id)&&d.uploaded_by_user_id===b.actors.KHAIMOOK.userId&&d.document_type_id===c.documentTypeId),'PA_FINAL_DOCUMENT_SCOPE_INVALID');
}
