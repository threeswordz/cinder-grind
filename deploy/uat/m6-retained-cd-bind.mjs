// Private, synthetic-only input binding for the C/D metadata kernel.
// All records are read from a repeatable-read native transaction. Never log these
// values; only the eventual aggregate assertion receipt may leave the Mac.
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
import {validPrivateActors,validActorReceipt} from './prototype-browser-operator.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_CD_BIND_'+code),{safeCode:'M6_CD_BIND_'+code});};
const one=(rows,code)=>{need(Array.isArray(rows)&&rows.length===1,code);return rows[0];};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const keys=['BEN','NANCY','KOH','FOREMAN'];
export async function bindRetainedCD(db,{actorReceipt,privateActors,fixture,source,journey}){
 need(validActorReceipt(actorReceipt)&&validPrivateActors(privateActors),'ACTOR_RECEIPT');
 need(fixture&&['companyId','foreignCompanyId','projectId','unassignedProjectId','foreignProjectId'].every(k=>uuid.test(fixture[k]??''))&&new Set([fixture.companyId,fixture.foreignCompanyId]).size===2&&new Set([fixture.projectId,fixture.unassignedProjectId,fixture.foreignProjectId]).size===3,'FIXTURE');
 need(source&&uuid.test(source.claimId??'')&&uuid.test(source.agreementId??'')&&journey?.status==='PHYSICAL_BROWSER_WORKFLOW_VERIFIED'&&journey.sessionsRevoked===true&&uuid.test(journey.certificationId??'')&&Array.isArray(journey.documentIds)&&journey.documentIds.length===1&&uuid.test(journey.documentIds[0]),'PHYSICAL_RECEIPT');
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const i=one(await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation"),'DB');
  need(i.db==='proto_a_01'&&i.role==='proto_runtime'&&i.ro==='on'&&i.isolation==='repeatable read','DB');
  await requireNoLiveSessions(tx);
  const companies=await tx.company.findMany({select:{id:true,companyCode:true,isActive:true,baseCurrencyCode:true}});
  need(companies.length===2&&[[fixture.companyId,'PROTO_A'],[fixture.foreignCompanyId,'PROTO_B']].every(([id,code])=>companies.some(c=>c.id===id&&c.companyCode===code&&c.isActive&&c.baseCurrencyCode==='THB')),'COMPANY');
  const projects=await tx.project.findMany({select:{id:true,companyId:true,projectCode:true,isActive:true}});
  need(projects.length===3&&[[fixture.projectId,fixture.companyId,'SITE_A'],[fixture.unassignedProjectId,fixture.companyId,'SITE_B'],[fixture.foreignProjectId,fixture.foreignCompanyId,'SITE_FOREIGN']].every(([id,companyId,code])=>projects.some(p=>p.id===id&&p.companyId===companyId&&p.projectCode===code&&p.isActive)),'PROJECT');
  need(await tx.user.count()===9&&await tx.role.count()===9&&await tx.employee.count()===8,'CENSUS');
  const actors={};
  for(const [key,a] of Object.entries(privateActors.actors)){
   const u=await tx.user.findUnique({where:{id:a.userId},include:{userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
   need(u?.isActive&&u.companyId===fixture.companyId&&u.employeeId===a.employeeId&&u.email===a.email&&u.userRoles.length===1&&u.userRoles[0].companyId===fixture.companyId&&u.userRoles[0].roleId===a.roleId&&u.userRoles[0].role.isActive&&u.userRoles[0].role.companyId===fixture.companyId&&u.userRoles[0].role.roleCode==='PROTO_'+key,'ACTOR');
   if(keys.includes(key))actors[key]={...a,companyId:u.companyId,permissions:u.userRoles[0].role.rolePermissions.map(x=>x.permission.permissionCode).sort()};
  }
  const required={BEN:['subcontracts.physical.view','subcontracts.claim.view','subcontracts.assessment.view','documents.document.view'],NANCY:['subcontracts.certification.view'],KOH:['hr.employment.view','hr.identity.view','hr.bank.view','hr.documents.view']};
  for(const [key,codes] of Object.entries(required))need(codes.every(c=>actors[key].permissions.includes(c)),'PERMISSIONS');
  need(!actors.FOREMAN.permissions.some(c=>c.startsWith('subcontracts.physical.')||['hr.employment.view','hr.identity.view','hr.bank.view','hr.documents.view'].includes(c)),'FOREMAN_PERMISSIONS');
  const kohGrants=await tx.hrCompanyAccess.findMany({where:{userId:actors.KOH.userId,isActive:true},select:{companyId:true,category:true}});
  need(['employment','identity','bank','documents'].every(c=>kohGrants.some(g=>g.companyId===fixture.companyId&&g.category===c))&&kohGrants.every(g=>g.companyId===fixture.companyId),'HR_GRANTS');
  need(await tx.hrCompanyAccess.count({where:{userId:actors.FOREMAN.userId,isActive:true}})===0,'FOREMAN_GRANTS');
  const claim=await tx.subcontractClaim.findUnique({where:{id:source.claimId}});
  need(claim&&claim.companyId===fixture.companyId&&claim.projectId===fixture.projectId&&claim.agreementId===source.agreementId,'CLAIM');
  const submission=await tx.subcontractPhysicalSubmission.findUnique({where:{claimId:claim.id}});
  const decision=await tx.subcontractPhysicalDecision.findUnique({where:{claimId:claim.id}});
  const revisions=await tx.subcontractPhysicalRevision.findMany({where:{claimId:claim.id},orderBy:{version:'desc'},select:{id:true}});
  const cert=await tx.subcontractCertification.findUnique({where:{id:journey.certificationId}});
  const doc=await tx.document.findUnique({where:{id:journey.documentIds[0]}});
  need(submission&&decision&&decision.actorUserId===actors.BEN.userId&&revisions.length>0&&revisions.some(r=>r.id===submission.revisionId)&&cert?.state==='APPROVED'&&cert.claimId===claim.id&&cert.companyId===claim.companyId&&cert.projectId===claim.projectId&&cert.agreementId===claim.agreementId&&doc?.isActive&&doc.companyId===claim.companyId&&Array.isArray(submission.evidence)&&submission.evidence.some(d=>d.id===doc.id),'FINANCE_LINEAGE');
  need(decision.assessedAmount.toFixed(2)==='731.25'&&cert.certifiedGross.toFixed(2)==='731.25'&&cert.retainedAmount.toFixed(2)==='36.56','FINANCE_ORIGINAL_AMOUNTS');
  // Original actor enrollment is FOREMAN; sealed M6 HR upload is KOH's own employee.
  const employeeId=privateActors.actors.FOREMAN.employeeId,attachmentEmployeeId=privateActors.actors.KOH.employeeId,companyId=fixture.companyId;
  need(employeeId!==attachmentEmployeeId,'HR_DISTINCT_SUBJECTS');
  const employment=await tx.hrEmployment.findUnique({where:{companyId_employeeId:{companyId,employeeId}},select:{currentVersion:true,revisions:{orderBy:{version:'asc'},select:{version:true}}}});
  const privateRows=await tx.hrPrivateRevision.findMany({where:{companyId,employeeId},orderBy:{version:'asc'},select:{id:true,category:true,version:true}});
  const attachments=await tx.hrDocumentAttachment.findMany({where:{companyId,employeeId:attachmentEmployeeId},orderBy:{version:'asc'},select:{id:true,version:true}});
  need(employment?.currentVersion===1&&employment.revisions.length===1&&employment.revisions[0].version===1&&privateRows.length===2&&['identity','bank'].every(c=>privateRows.filter(x=>x.category===c&&x.version===1).length===1)&&attachments.length===1&&attachments[0].version===1&&await tx.hrDocumentAttachment.count({where:{companyId}})===1,'HR_ORIGINAL_COVERAGE');
  return {actors,finance:{companyId:claim.companyId,projectId:claim.projectId,claimId:claim.id,certificationId:cert.id,documentId:doc.id,revisionIds:revisions.map(r=>r.id),submissionRevisionId:submission.revisionId,sourceDigest:submission.sourceDigest,assessedAmount:decision.assessedAmount.toFixed(2),certifiedGross:cert.certifiedGross.toFixed(2),retainedAmount:cert.retainedAmount.toFixed(2)},hr:{companyId,employeeId,attachmentEmployeeId,employmentVersions:employment.revisions.map(r=>r.version),attachments,privateCategories:['identity','bank'].map(category=>{const rows=privateRows.filter(r=>r.category===category);return {category,ids:rows.map(r=>r.id),versions:rows.map(r=>r.version)};})},foreignCompanyId:fixture.foreignCompanyId,foreignProjectId:fixture.foreignProjectId,unassignedProjectId:fixture.unassignedProjectId};
 },{isolationLevel:'RepeatableRead',timeout:30000});
}
