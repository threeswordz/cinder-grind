// Retained site/material source proof; no business replay or database writes.
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_SITE_'+code),{safeCode:'M6_SITE_'+code});};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
const one=(rows,code)=>{need(Array.isArray(rows)&&rows.length===1,code);return rows[0];};
const amount=(v,want)=>v!=null&&typeof v.toString==='function'&&new RegExp('^'+want+'(?:\\.0+)?
const sameScope=(r,b)=>r&&r.companyId===b.companyId&&r.projectId===b.projectId;
const materialScope=(r,b)=>r&&r.materialId===b.materialId&&r.uomId===b.uomId;
export function validateSiteBinding({sourceSha,actors,fixture,initial,journey}){
 need(/^[a-f0-9]{40}$/.test(sourceSha??'')&&actors?.sourceSha===sourceSha&&fixture?.sourceSha===sourceSha&&initial?.sourceSha===sourceSha,'RECEIPT_SOURCE');
 need(initial.fixture?.companyId===fixture.companyId&&initial.fixture?.projectId===fixture.projectId&&journey?.status==='MATERIAL_API_JOURNEY_EXECUTED'&&journey.productionAuthorized===false&&journey.financeUnchanged===true&&JSON.stringify(journey.stockHistory)===JSON.stringify(['20.0000','17.0000','13.0000','20.0000']),'RECEIPT_JOURNEY');
 const f=actors.actors?.FOREMAN,s=actors.actors?.STORE_SITE,k=actors.actors?.KHAIMOOK;
 need(f?.email==='proto-foreman@example.invalid'&&s?.email==='proto-store_site@example.invalid'&&k?.email==='proto-khaimook@example.invalid','RECEIPT_ACTORS');
 const b={companyId:fixture.companyId,projectId:fixture.projectId,warehouseId:fixture.warehouseId,materialId:fixture.materialId,uomId:fixture.uomId,foremanUserId:f.userId,foremanEmployeeId:f.employeeId,storeUserId:s.userId,storeEmployeeId:s.employeeId,pmUserId:k.userId,reportId:initial.results?.reportId,planId:journey.planId,requestId:journey.requestId,withinIssueId:journey.withinIssueId,overageIssueId:journey.overageIssueId,documentId:journey.documentId,budgetRevisionId:journey.sourceMapping?.budgetRevisionId,budgetRevisionLineId:journey.sourceMapping?.budgetRevisionLineId};
 need(Object.values(b).every(v=>typeof v==='string'&&uuid.test(v))&&new Set(Object.values(b)).size===Object.keys(b).length&&hex.test(journey.documentSha256??''),'RECEIPT_IDENTIFIERS');
 return {...b,documentSha256:journey.documentSha256};
}
export function assertSiteHistory(b,{report,request,plan,issues,document}){
 need(sameScope(report,b)&&report.id===b.reportId&&report.status==='SUBMITTED'&&report.createdByUserId===b.foremanUserId&&report.submittedByUserId===b.foremanUserId&&report.submittedAt&&report.generalRemarks==='Synthetic Foreman daily report','DAILY_SOURCE');
 need(sameScope(plan,b)&&plan.id===b.planId&&plan.warehouseId===b.warehouseId&&plan.createdByUserId===b.storeUserId&&plan.budgetRevisionId===b.budgetRevisionId,'PLAN_SOURCE');
 const approved=one(plan.revisions?.filter(r=>r.status==='APPROVED'),'PLAN_REVISION');
 need(approved.createdByUserId===b.storeUserId&&approved.submittedByUserId===b.storeUserId&&approved.decidedByUserId===b.pmUserId&&approved.submittedAt&&approved.decidedAt,'PLAN_INDEPENDENT_DECISION');
 const pl=one(approved.lines,'PLAN_LINE');
 need(materialScope(pl,b)&&pl.budgetRevisionLineId===b.budgetRevisionLineId&&amount(pl.quantity,'6'),'PLAN_QUANTITY');
 need(sameScope(request,b)&&request.id===b.requestId&&request.warehouseId===b.warehouseId&&request.createdByUserId===b.storeUserId&&request.requesterEmployeeId===b.foremanEmployeeId,'REQUEST_SOURCE');
 const line=one(request.lines,'REQUEST_LINE');
 need(materialScope(line,b)&&amount(line.requestedQuantity,'3'),'REQUEST_QUANTITY');
 need(Array.isArray(request.revisions)&&request.revisions.length===request.version&&request.revisions.every((r,i)=>r.version===i+1),'REQUEST_REVISIONS');
 const link=one(line.issueLinks,'REQUEST_LINK');
 need(link.requestId===request.id&&link.requestLineId===line.id&&link.linkedByUserId===b.storeUserId,'REQUEST_LINK_SCOPE');
 const receipt=one(link.receipts,'RECEIPT');
 need(receipt.requestId===request.id&&receipt.issueLinkId===link.id&&receipt.recipientEmployeeId===b.foremanEmployeeId&&receipt.issuerEmployeeId===b.storeEmployeeId&&receipt.recordedByUserId===b.storeUserId&&receipt.documentId===b.documentId&&receipt.evidenceChecksum===b.documentSha256&&receipt.signedEvidenceConfirmed===true&&receipt.supersedesReceiptId===null,'SIGNED_RECEIPT');
 need(document?.id===b.documentId&&document.companyId===b.companyId&&document.checksum===b.documentSha256&&document.isActive===true&&document.links?.some(l=>l.entityType==='MATERIAL_REQUEST'&&l.entityId===request.id),'DOCUMENT_CUSTODY');
 need(Array.isArray(issues)&&issues.length===2,'ISSUE_COUNT');
 for(const [id,qty] of [[b.withinIssueId,'3'],[b.overageIssueId,'4']]){
  const issue=one(issues.filter(r=>r.id===id),'ISSUE_ID');
  need(sameScope(issue,b)&&issue.warehouseId===b.warehouseId&&issue.issuedToEmployeeId===b.foremanEmployeeId&&issue.createdByUserId===b.storeUserId&&issue.postedAt&&issue.reversedAt&&issue.reversedByUserId===b.storeUserId,'ISSUE_SOURCE');
  const item=one(issue.items,'ISSUE_ITEM');
  need(materialScope(item,b)&&amount(item.quantity,qty),'ISSUE_QUANTITY');
  if(id===b.withinIssueId)need(link.materialIssueItemId===item.id,'ISSUE_LINK');
  const rows=issue.stockTransactions;
  need(Array.isArray(rows)&&rows.length===2,'LEDGER_COUNT');
  const original=one(rows.filter(r=>r.movementType==='MATERIAL_ISSUE'),'LEDGER_ORIGINAL');
  const reversal=one(rows.filter(r=>r.movementType==='MATERIAL_ISSUE_REVERSAL'),'LEDGER_REVERSAL');
  need(rows.every(r=>sameScope(r,b)&&materialScope(r,b)&&r.warehouseId===b.warehouseId&&r.materialIssueId===id&&r.materialIssueItemId===item.id)&&original.reversalOfId===null&&reversal.reversalOfId===original.id&&amount(original.quantity,'-'+qty)&&amount(reversal.quantity,qty),'LEDGER_RECIPROCITY');
 }
 return {status:'M6_RETAINED_SITE_MATERIAL_HISTORY_OBSERVED',dailyReports:1,approvedPlans:1,requestLines:1,signedReceiptRows:1,issueReversalPairs:2,originalIssueNetQuantity:'0.0000',documentMetadataMatched:true,protectedBytesVerified:false,authenticatedWorkflowVerified:false,historicalBaselineVerified:false,mayMutate:false,productionAuthorized:false};
}
export async function observeRetainedSiteMaterial(db,b){
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const i=one(await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation"),'DB');
  need(i.db==='proto_a_01'&&i.role==='proto_runtime'&&i.ro==='on'&&i.isolation==='repeatable read','DB');
  await requireNoLiveSessions(tx);
  const [report,request,plan,issues,document]=await Promise.all([
   tx.dailySiteReport.findUnique({where:{id:b.reportId}}),
   tx.materialRequest.findUnique({where:{id:b.requestId},include:{lines:{include:{issueLinks:{include:{receipts:true}}}},revisions:{orderBy:{version:'asc'}}}}),
   tx.materialUsagePlan.findUnique({where:{id:b.planId},include:{revisions:{include:{lines:true}}}}),
   tx.materialIssue.findMany({where:{id:{in:[b.withinIssueId,b.overageIssueId]}},include:{items:true,stockTransactions:true}}),
   tx.document.findUnique({where:{id:b.documentId},include:{links:true}})
  ]);
  return assertSiteHistory(b,{report,request,plan,issues,document});
 },{isolationLevel:'RepeatableRead',timeout:30000});
}
).test(v.toString());
const sameScope=(r,b)=>r&&r.companyId===b.companyId&&r.projectId===b.projectId;
const materialScope=(r,b)=>r&&r.materialId===b.materialId&&r.uomId===b.uomId;
export function validateSiteBinding({sourceSha,actors,fixture,initial,journey}){
 need(/^[a-f0-9]{40}$/.test(sourceSha??'')&&actors?.sourceSha===sourceSha&&fixture?.sourceSha===sourceSha&&initial?.sourceSha===sourceSha,'RECEIPT_SOURCE');
 need(initial.fixture?.companyId===fixture.companyId&&initial.fixture?.projectId===fixture.projectId&&journey?.status==='MATERIAL_API_JOURNEY_EXECUTED'&&journey.productionAuthorized===false&&journey.financeUnchanged===true&&JSON.stringify(journey.stockHistory)===JSON.stringify(['20.0000','17.0000','13.0000','20.0000']),'RECEIPT_JOURNEY');
 const f=actors.actors?.FOREMAN,s=actors.actors?.STORE_SITE,k=actors.actors?.KHAIMOOK;
 need(f?.email==='proto-foreman@example.invalid'&&s?.email==='proto-store_site@example.invalid'&&k?.email==='proto-khaimook@example.invalid','RECEIPT_ACTORS');
 const b={companyId:fixture.companyId,projectId:fixture.projectId,warehouseId:fixture.warehouseId,materialId:fixture.materialId,uomId:fixture.uomId,foremanUserId:f.userId,foremanEmployeeId:f.employeeId,storeUserId:s.userId,storeEmployeeId:s.employeeId,pmUserId:k.userId,reportId:initial.results?.reportId,planId:journey.planId,requestId:journey.requestId,withinIssueId:journey.withinIssueId,overageIssueId:journey.overageIssueId,documentId:journey.documentId,budgetRevisionId:journey.sourceMapping?.budgetRevisionId,budgetRevisionLineId:journey.sourceMapping?.budgetRevisionLineId};
 need(Object.values(b).every(v=>typeof v==='string'&&uuid.test(v))&&new Set(Object.values(b)).size===Object.keys(b).length&&hex.test(journey.documentSha256??''),'RECEIPT_IDENTIFIERS');
 return {...b,documentSha256:journey.documentSha256};
}
export function assertSiteHistory(b,{report,request,plan,issues,document}){
 need(sameScope(report,b)&&report.id===b.reportId&&report.status==='SUBMITTED'&&report.createdByUserId===b.foremanUserId&&report.submittedByUserId===b.foremanUserId&&report.submittedAt&&report.generalRemarks==='Synthetic Foreman daily report','DAILY_SOURCE');
 need(sameScope(plan,b)&&plan.id===b.planId&&plan.warehouseId===b.warehouseId&&plan.createdByUserId===b.storeUserId&&plan.budgetRevisionId===b.budgetRevisionId,'PLAN_SOURCE');
 const approved=one(plan.revisions?.filter(r=>r.status==='APPROVED'),'PLAN_REVISION');
 need(approved.createdByUserId===b.storeUserId&&approved.submittedByUserId===b.storeUserId&&approved.decidedByUserId===b.pmUserId&&approved.submittedAt&&approved.decidedAt,'PLAN_INDEPENDENT_DECISION');
 const pl=one(approved.lines,'PLAN_LINE');
 need(materialScope(pl,b)&&pl.budgetRevisionLineId===b.budgetRevisionLineId&&amount(pl.quantity,'6'),'PLAN_QUANTITY');
 need(sameScope(request,b)&&request.id===b.requestId&&request.warehouseId===b.warehouseId&&request.createdByUserId===b.storeUserId&&request.requesterEmployeeId===b.foremanEmployeeId,'REQUEST_SOURCE');
 const line=one(request.lines,'REQUEST_LINE');
 need(materialScope(line,b)&&amount(line.requestedQuantity,'3'),'REQUEST_QUANTITY');
 need(Array.isArray(request.revisions)&&request.revisions.length===request.version&&request.revisions.every((r,i)=>r.version===i+1),'REQUEST_REVISIONS');
 const link=one(line.issueLinks,'REQUEST_LINK');
 need(link.requestId===request.id&&link.requestLineId===line.id&&link.linkedByUserId===b.storeUserId,'REQUEST_LINK_SCOPE');
 const receipt=one(link.receipts,'RECEIPT');
 need(receipt.requestId===request.id&&receipt.issueLinkId===link.id&&receipt.recipientEmployeeId===b.foremanEmployeeId&&receipt.issuerEmployeeId===b.storeEmployeeId&&receipt.recordedByUserId===b.storeUserId&&receipt.documentId===b.documentId&&receipt.evidenceChecksum===b.documentSha256&&receipt.signedEvidenceConfirmed===true&&receipt.supersedesReceiptId===null,'SIGNED_RECEIPT');
 need(document?.id===b.documentId&&document.companyId===b.companyId&&document.checksum===b.documentSha256&&document.isActive===true&&document.links?.some(l=>l.entityType==='MATERIAL_REQUEST'&&l.entityId===request.id),'DOCUMENT_CUSTODY');
 need(Array.isArray(issues)&&issues.length===2,'ISSUE_COUNT');
 for(const [id,qty] of [[b.withinIssueId,'3'],[b.overageIssueId,'4']]){
  const issue=one(issues.filter(r=>r.id===id),'ISSUE_ID');
  need(sameScope(issue,b)&&issue.warehouseId===b.warehouseId&&issue.issuedToEmployeeId===b.foremanEmployeeId&&issue.createdByUserId===b.storeUserId&&issue.postedAt&&issue.reversedAt&&issue.reversedByUserId===b.storeUserId,'ISSUE_SOURCE');
  const item=one(issue.items,'ISSUE_ITEM');
  need(materialScope(item,b)&&amount(item.quantity,qty),'ISSUE_QUANTITY');
  if(id===b.withinIssueId)need(link.materialIssueItemId===item.id,'ISSUE_LINK');
  const rows=issue.stockTransactions;
  need(Array.isArray(rows)&&rows.length===2,'LEDGER_COUNT');
  const original=one(rows.filter(r=>r.movementType==='MATERIAL_ISSUE'),'LEDGER_ORIGINAL');
  const reversal=one(rows.filter(r=>r.movementType==='MATERIAL_ISSUE_REVERSAL'),'LEDGER_REVERSAL');
  need(rows.every(r=>sameScope(r,b)&&materialScope(r,b)&&r.warehouseId===b.warehouseId&&r.materialIssueId===id&&r.materialIssueItemId===item.id)&&original.reversalOfId===null&&reversal.reversalOfId===original.id&&amount(original.quantity,'-'+qty)&&amount(reversal.quantity,qty),'LEDGER_RECIPROCITY');
 }
 return {status:'M6_RETAINED_SITE_MATERIAL_HISTORY_OBSERVED',dailyReports:1,approvedPlans:1,requestLines:1,signedReceiptRows:1,issueReversalPairs:2,originalIssueNetQuantity:'0.0000',documentMetadataMatched:true,protectedBytesVerified:false,authenticatedWorkflowVerified:false,historicalBaselineVerified:false,mayMutate:false,productionAuthorized:false};
}
export async function observeRetainedSiteMaterial(db,b){
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const i=one(await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation"),'DB');
  need(i.db==='proto_a_01'&&i.role==='proto_runtime'&&i.ro==='on'&&i.isolation==='repeatable read','DB');
  await requireNoLiveSessions(tx);
  const [report,request,plan,issues,document]=await Promise.all([
   tx.dailySiteReport.findUnique({where:{id:b.reportId}}),
   tx.materialRequest.findUnique({where:{id:b.requestId},include:{lines:{include:{issueLinks:{include:{receipts:true}}}},revisions:{orderBy:{version:'asc'}}}}),
   tx.materialUsagePlan.findUnique({where:{id:b.planId},include:{revisions:{include:{lines:true}}}}),
   tx.materialIssue.findMany({where:{id:{in:[b.withinIssueId,b.overageIssueId]}},include:{items:true,stockTransactions:true}}),
   tx.document.findUnique({where:{id:b.documentId},include:{links:true}})
  ]);
  return assertSiteHistory(b,{report,request,plan,issues,document});
 },{isolationLevel:'RepeatableRead',timeout:30000});
}
