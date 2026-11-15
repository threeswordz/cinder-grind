// Read-only post-run custody. Never applies grants, replays the API journey or
// treats final stock20 as a pristine fixture. The original history stays intact.
import {createHash} from 'node:crypto';
import {SOURCE,ROLES} from './prototype-actors.mjs';
import {validPrivateActors} from './prototype-browser-operator.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const canonical=v=>v&&typeof v==='object'?typeof v.toJSON==='function'?canonical(v.toJSON()):
  Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export const MATERIAL_MAIN='f661c5387610326d83047b557edce9d3449990ef';
export function validMaterialRunReceipt(r){
  return r?.status==='MATERIAL_AUTHENTICATED_API_JOURNEY_VERIFIED'&&r.sourceSha===SOURCE&&r.operatorMainSha===MATERIAL_MAIN&&
    same(r.stockHistory,['20.0000','17.0000','13.0000','20.0000'])&&
    ['financeUnchanged','apiSessionsRevoked','compiledArtifactBytesVerified'].every(k=>r[k]===true)&&
    ['actualUiJourneyVerified','fullBusinessRoleMatrixVerified','populatedRecoveryVerified','prototypeFrozen',
      'humanUatCompleted','productionAuthorized','secretsPrinted'].every(k=>r[k]===false);
}
// Every existing protected business slice participates; the only exceptions
// are the target request header and its revisions, checked separately below.
const models=['company','employee','role','rolePermission','userRole','project','projectMember','hrCompanyAccess',
  'customer','supplier','unitOfMeasure','material','warehouse','stockCount','stockTransaction','stockTransfer',
  'materialReservation','materialIssue','materialIssueItem','materialReturn','materialReturnItem',
  'purchaseRequest','purchaseOrder','goodsReceipt','materialRequest','materialRequestLine','materialRequestRevision',
  'materialRequestIssueLink','materialRequestReceipt','materialRequestOperation','materialUsagePlan','materialUsagePlanRevision',
  'materialUsagePlanLine','materialPlanProjectPolicy','materialPlanIssueBinding','materialPlanIssueAuthorization','materialPlanIssueAllocation',
  'boq','boqSection','boqItem','budgetRevision','budgetRevisionLine','approvalWorkflow','approvalStep','approvalStepRole',
  'approvalInstance','approvalAction','numberSequence','documentType','dailySiteReport','hrEmployment','hrEmploymentRevision',
  'hrPrivateRevision','hrPerson','hrPersonLink','hrDocumentAttachment','document','documentLink','subcontractAgreement',
  'supplierInvoice','clientInvoice','payment','directCostPosting'];
export async function materialUiSnapshot(db,binding){
  const b=structuredClone(binding),f=b.fixture,c=b.configuration,j=b.journey;
  demand(b.sourceSha===SOURCE&&validPrivateActors(b)&&c?.sourceSha===SOURCE&&c.projectId===f?.projectId&&
    c.status==='MATERIAL_SYNTHETIC_CONFIGURATION_APPLIED'&&c.configurationApplied===true&&c.productionAuthorized===false&&
    Array.isArray(c.changes)&&j?.status==='MATERIAL_API_JOURNEY_EXECUTED'&&j.financeUnchanged===true&&
    same(j.stockHistory,['20.0000','17.0000','13.0000','20.0000']),'MATERIAL_UI_POST_RUN_BINDING_INVALID');
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const mode=await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS mode");
    demand(mode.length===1&&mode[0].mode==='on','MATERIAL_UI_READ_ONLY_REQUIRED');
    const users=await tx.user.findMany({include:{userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
    demand(users.length===9&&await tx.role.count()===9&&await tx.employee.count()===8&&await tx.projectMember.count()===8,
      'MATERIAL_UI_ROLE_CENSUS_CHANGED');
    const companies=await tx.company.findMany({select:{id:true,companyCode:true,isActive:true,baseCurrencyCode:true}}),
      projects=await tx.project.findMany({select:{id:true,companyId:true,projectCode:true,isActive:true}});
    demand(companies.length===2&&companies.every(x=>x.isActive&&x.baseCurrencyCode==='THB')&&
      [[f.companyId,'PROTO_A'],[f.foreignCompanyId,'PROTO_B']].every(([id,companyCode])=>companies.some(x=>x.id===id&&x.companyCode===companyCode))&&
      projects.length===3&&[[f.projectId,f.companyId,'SITE_A'],[f.unassignedProjectId,f.companyId,'SITE_B'],
        [f.foreignProjectId,f.foreignCompanyId,'SITE_FOREIGN']].every(([id,companyId,projectCode])=>
        projects.some(x=>x.id===id&&x.companyId===companyId&&x.projectCode===projectCode&&x.isActive)),
      'MATERIAL_UI_COMPANY_PROJECT_IDENTITY_CHANGED');
    const admin=users.find(u=>u.id===f.adminUserId);
    demand(admin?.isActive&&admin.companyId===f.companyId&&admin.email==='proto-admin@example.invalid'&&admin.employeeId===null&&
      admin.userRoles.length===1&&admin.userRoles[0].role.companyId===f.companyId&&admin.userRoles[0].role.isActive&&
      admin.userRoles[0].role.roleCode==='SYS_ADMIN'&&
      !admin.userRoles[0].role.rolePermissions.some(p=>/\.approve$/.test(p.permission.permissionCode)||p.permission.permissionCode.startsWith('hr.'))&&
      await tx.hrCompanyAccess.count({where:{userId:admin.id}})===0,'MATERIAL_UI_ADMIN_AUTHORITY_CHANGED');
    const seen=new Set();
    for(const change of c.changes){
      demand(['PROTO_STORE_SITE','PROTO_KHAIMOOK','PROTO_BEN'].includes(change.roleCode)&&!seen.has(change.roleCode)&&
        Array.isArray(change.addedCapabilities)&&new Set(change.addedCapabilities).size===change.addedCapabilities.length,
        'MATERIAL_UI_CONFIG_RECEIPT_CHANGED');seen.add(change.roleCode);
    }
    for(const [key,a] of Object.entries(b.actors)){
      const u=users.find(u=>u.id===a.userId),roles=u?.userRoles;
      demand(u?.isActive&&u.companyId===f.companyId&&u.employeeId===a.employeeId&&u.email===a.email&&roles.length===1&&
        roles[0].roleId===a.roleId&&roles[0].role.companyId===f.companyId&&roles[0].role.isActive&&
        roles[0].role.roleCode==='PROTO_'+key,'MATERIAL_UI_ACTOR_IDENTITY_CHANGED');
      const delta=c.changes.find(x=>x.roleCode==='PROTO_'+key)?.addedCapabilities??[];
      const expected=[...ROLES[key].permissions,...delta].sort();
      demand(new Set(expected).size===expected.length&&same(roles[0].role.rolePermissions.map(p=>p.permission.permissionCode).sort(),expected),
        'MATERIAL_UI_EFFECTIVE_GRANTS_CHANGED');
      const grants=await tx.hrCompanyAccess.findMany({where:{userId:a.userId},select:{companyId:true,category:true}});
      demand(grants.every(g=>g.companyId===f.companyId)&&same(grants.map(g=>g.category).sort(),[...ROLES[key].categories].sort()),
        'MATERIAL_UI_PRIVATE_CATEGORIES_CHANGED');
      demand(await tx.employee.count({where:{id:a.employeeId,companyId:f.companyId,isActive:true}})===1&&
        await tx.projectMember.count({where:{employeeId:a.employeeId,projectId:f.projectId,isActive:true}})===1,
        'MATERIAL_UI_ACTOR_PROJECT_SCOPE_CHANGED');
    }
    const markers=await tx.auditLog.findMany({where:{companyId:f.companyId,entityType:'PROTOTYPE_MATERIAL_CONFIGURATION',entityId:f.projectId},
      select:{actorUserId:true,newValues:true}});
    const saved={...c};for(const k of ['status','configurationApplied','sourceApproved','policyEnabled','stockPosted','productionAuthorized'])delete saved[k];
    demand(markers.length===1&&markers[0].actorUserId===f.adminUserId&&same(markers[0].newValues,saved),
      'MATERIAL_UI_CONFIG_AUDIT_BINDING_CHANGED');
    const request=await tx.materialRequest.findUnique({where:{id:j.requestId}}),document=await tx.document.findUnique({where:{id:j.documentId}});
    demand(request?.companyId===f.companyId&&request.projectId===f.projectId&&request.warehouseId===f.warehouseId&&
      request.requesterEmployeeId===b.actors.FOREMAN.employeeId&&document?.companyId===f.companyId&&document.checksum===j.documentSha256,
      'MATERIAL_UI_RETAINED_RECORD_BINDING_CHANGED');
    const issues=await tx.materialIssue.findMany({where:{id:{in:[j.withinIssueId,j.overageIssueId]}}});
    demand(issues.length===2&&issues.every(i=>i.companyId===f.companyId&&i.projectId===f.projectId&&i.warehouseId===f.warehouseId&&
      i.postedAt&&i.reversedAt)&&await tx.stockTransaction.count()===5&&await tx.materialReservation.count()===0,
      'MATERIAL_UI_REVERSED_STOCK_HISTORY_CHANGED');
    const rows={};
    for(const model of models){
      let entries=await tx[model].findMany();
      if(model==='materialRequest')entries=entries.filter(r=>r.id!==j.requestId);
      if(['materialRequestRevision','materialRequestOperation'].includes(model))entries=entries.filter(r=>r.requestId!==j.requestId);
      rows[model]=entries.map(r=>JSON.stringify(r)).sort();
    }
    return {preservedSha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
      request,requestRevisions:await tx.materialRequestRevision.findMany({where:{requestId:j.requestId},orderBy:{version:'asc'}}),
      requestOperations:await tx.materialRequestOperation.findMany({where:{requestId:j.requestId}}),
      permissions:Object.fromEntries(['STORE_SITE','FOREMAN'].map(key=>[key,users.find(u=>u.id===b.actors[key].userId)
        .userRoles[0].role.rolePermissions.map(x=>x.permission.permissionCode).sort()])),
      activeSessions:(await tx.userSession.findMany({where:{revokedAt:null},select:{id:true}})).map(s=>s.id)};
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
export function verifyMaterialUiPreservation(before,after){
  demand(before.preservedSha256===after.preservedSha256,'MATERIAL_UI_UNRELATED_BUSINESS_STATE_CHANGED');
  const strip=row=>Object.fromEntries(Object.entries(row).filter(([k])=>!['version','remarks','updatedAt'].includes(k)));
  demand(same(strip(before.request),strip(after.request))&&after.request.version===before.request.version+1,
    'MATERIAL_UI_REQUEST_HEADER_CHANGED');
  demand(after.requestRevisions.length===before.requestRevisions.length+1&&
    before.requestRevisions.every(r=>same(r,after.requestRevisions.find(x=>x.id===r.id)))&&
    after.requestOperations.length===before.requestOperations.length+1&&
    before.requestOperations.every(r=>same(r,after.requestOperations.find(x=>x.id===r.id))),
    'MATERIAL_UI_OPERATION_HISTORY_CHANGED');
  demand(after.activeSessions.every(id=>before.activeSessions.includes(id)),'MATERIAL_UI_SERVER_SESSION_NOT_REVOKED');
}
