// #338: one real authenticated material journey using existing business APIs.
// Coordinator must own target custody, configuration and private run markers.
import {randomUUID,createHash} from 'node:crypto';
import {materialJourneyHttp} from './prototype-material-http.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function runMaterialApiJourney(binding,sessions,fetchImpl=fetch){
  const b=structuredClone(binding),c=materialJourneyHttp(b,fetchImpl),
    store=sessions.STORE_SITE,khaimook=sessions.KHAIMOOK,ben=sessions.BEN,foreman=sessions.FOREMAN;
  demand([store,khaimook,ben,foreman].every(a=>a?.cookie&&a?.csrf)&&
    new Set([store.userId,khaimook.userId,ben.userId,foreman.userId]).size===4,'MATERIAL_JOURNEY_INDEPENDENT_SESSIONS_REQUIRED');
  try{
  const today=new Date().toISOString().slice(0,10),until=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  const stockPath='/inventory/stock-balances?projectId='+b.projectId+'&warehouseId='+b.warehouseId+'&materialId='+b.materialId;
  async function balance(code,want){
    const rows=(await c.call(store,code,stockPath,200)).value.data;
    demand(Array.isArray(rows)&&rows.length===1&&rows[0].projectId===b.projectId&&rows[0].warehouseId===b.warehouseId&&
      rows[0].materialId===b.materialId&&rows[0].uomId===b.uomId&&rows[0].quantity===want,'MATERIAL_JOURNEY_STOCK_MISMATCH');
  }
  const readPlan=async id=>(await c.call(store,'PLAN_READ','/inventory/material-plans/'+id,200)).value.data;
  const readRequest=async id=>(await c.call(store,'REQUEST_READ','/inventory/material-requests/'+id,200)).value.data;
  const readIssue=async id=>(await c.call(store,'ISSUE_READ','/inventory/material-issues/'+id,200)).value.data;
  await balance('INITIAL_STOCK','20.0000');
  const reportPath='/inventory/reports/movement-summary?projectId='+b.projectId;
  const reportBefore=(await c.call(store,'REPORT_BEFORE',reportPath,200)).value.data;
  const requestBody={requestKey:randomUUID(),projectId:b.projectId,warehouseId:b.warehouseId,
    requesterEmployeeId:b.foremanEmployeeId,requestDate:today,remarks:'Synthetic material handover',
    lines:[{materialId:b.materialId,uomId:b.uomId,requestedQuantity:'3.0000',wbsId:null,costCodeId:null,activityId:null,remarks:null}]};
  const request=(await c.call(store,'REQUEST_CREATE','/inventory/material-requests',201,requestBody)).value.data;
  let requestRead=await readRequest(request.id);
  const planBody={requestKey:randomUUID(),projectId:b.projectId,warehouseId:b.warehouseId,
    budgetRevisionId:b.budgetRevisionId,workPackageCode:'PROTO-MATERIAL-01',validFrom:today,validTo:until,
    reason:'Bounded deployed synthetic material journey',lines:[{budgetRevisionLineId:b.budgetRevisionLineId,
      materialId:b.materialId,uomId:b.uomId,quantity:'6.0000'}]};
  await c.call(store,'PLAN_CSRF_DENIED','/inventory/material-plans',403,planBody,'POST',false);
  let plan=(await c.call(store,'PLAN_CREATE','/inventory/material-plans',201,planBody)).value.data;
  plan=await readPlan(plan.id);
  await c.call(store,'PLAN_SUBMIT','/inventory/material-plans/'+plan.id+'/submit',201,
    {requestKey:randomUUID(),expectedVersion:plan.version});plan=await readPlan(plan.id);
  await c.call(store,'PLAN_SELF_APPROVE_DENIED','/inventory/material-plans/'+plan.id+'/decision',403,
    {requestKey:randomUUID(),expectedVersion:plan.version,decision:'APPROVE',comment:'Maker cannot approve'});
  await c.call(khaimook,'PLAN_INDEPENDENT_APPROVE','/inventory/material-plans/'+plan.id+'/decision',201,
    {requestKey:randomUUID(),expectedVersion:plan.version,decision:'APPROVE',comment:'Independent synthetic source allocation'});
  plan=await readPlan(plan.id);
  demand(plan.approvedRevision?.lines?.length===1&&
    !/"(?:rate|lineAmount|totalAmount|unitPrice)"\s*:/.test(JSON.stringify(plan)),
    'MATERIAL_JOURNEY_APPROVED_QUANTITY_PROJECTION_FAILED');
  await c.call(ben,'POLICY_ENABLE','/inventory/material-plan-issues/projects/'+b.projectId+'/enable',201,
    {requestKey:randomUUID(),workflowCode:b.overageWorkflowCode,confirmation:'ISOLATED_SYNTHETIC',reason:'Owner-authorized synthetic material journey'});
  const issueBody=quantity=>({projectId:b.projectId,warehouseId:b.warehouseId,issueDate:today,
    issuedToEmployeeId:b.foremanEmployeeId,lines:[{materialId:b.materialId,uomId:b.uomId,quantity}]});
  await c.call(foreman,'FOREMAN_ISSUE_DENIED','/inventory/material-issues',403,issueBody('3.0000'));
  async function createIssue(quantity){
    const saved=(await c.call(store,'ISSUE_CREATE','/inventory/material-issues',201,issueBody(quantity))).value.data;
    return readIssue(saved.id);
  }
  const within=await createIssue('3.0000');
  const pins=issue=>({requestKey:randomUUID(),bindings:[{issueItemId:issue.items[0].id,
    planLineId:plan.approvedRevision.lines[0].id,expectedPlanVersion:plan.version}]});
  const pin=pins(within),withinPath='/inventory/material-plan-issues/issues/'+within.id+'/within-plan';
  await c.call(foreman,'FOREMAN_POST_DENIED',withinPath,403,pin);
  const posted=(await c.call(store,'WITHIN_PLAN_POST',withinPath,201,pin)).value.data;
  demand(posted.status==='POSTED','MATERIAL_JOURNEY_WITHIN_POST_FAILED');
  demand(JSON.stringify((await c.call(store,'WITHIN_PLAN_REPLAY',withinPath,201,pin)).value.data)===JSON.stringify(posted),
    'MATERIAL_JOURNEY_REPLAY_CHANGED');
  await balance('WITHIN_STOCK','17.0000');
  const link={requestKey:randomUUID(),expectedVersion:requestRead.version,requestLineId:requestRead.lines[0].id,
    materialIssueItemId:within.items[0].id,reason:'Actual posted synthetic issue'};
  await c.call(store,'REQUEST_LINK','/inventory/material-requests/'+request.id+'/issue-links',201,link);
  requestRead=await readRequest(request.id);
  demand(requestRead.lines[0].issuedQuantity==='3.0000'&&requestRead.lines[0].acknowledgedQuantity==='0.0000',
    'MATERIAL_JOURNEY_REQUEST_LINK_FAILED');
  const bytes=new TextEncoder().encode('%PDF-1.4\nSynthetic material handover evidence; no human signature or UAT\n%%EOF');
  await c.upload(foreman,'FOREMAN_DOCUMENT_UPLOAD_DENIED',request.id,403,bytes);
  const document=await c.upload(store,'SIGNED_DOCUMENT_UPLOAD',request.id,201,bytes);
  demand(hash(await c.download(store,'SIGNED_DOCUMENT_BYTES',request.id,document.data.id,200))===hash(bytes),
    'MATERIAL_JOURNEY_DOCUMENT_BYTES_CHANGED');
  await c.download(foreman,'FOREMAN_DOCUMENT_DOWNLOAD_DENIED',request.id,document.data.id,403);
  requestRead=await readRequest(request.id);
  demand(requestRead.lines[0].acknowledgedQuantity==='0.0000','MATERIAL_JOURNEY_UPLOAD_ACKNOWLEDGED_STOCK');
  await c.call(store,'SIGNED_ACKNOWLEDGMENT','/inventory/material-requests/'+request.id+'/receipts',201,
    {requestKey:randomUUID(),expectedVersion:requestRead.version,issueLinkId:requestRead.lines[0].issueLinks[0].id,
      recipientEmployeeId:b.foremanEmployeeId,issuerEmployeeId:b.storeEmployeeId,
      receivedAt:new Date(Date.now()-1000).toISOString(),documentId:document.data.id,
      signedEvidenceConfirmed:true,supersedesReceiptId:null,reason:'Recorded synthetic handover evidence; no human UAT'});
  requestRead=await readRequest(request.id);
  demand(requestRead.lines[0].acknowledgedQuantity==='3.0000','MATERIAL_JOURNEY_ACKNOWLEDGMENT_FAILED');
  await balance('RECEIPT_STOCK_UNCHANGED','17.0000');
  const overage=await createIssue('4.0000'),overagePin=pins(overage);
  await c.call(store,'OVERAGE_DIRECT_BLOCKED','/inventory/material-plan-issues/issues/'+overage.id+'/within-plan',409,overagePin);
  const submitted=(await c.call(store,'OVERAGE_SUBMIT','/inventory/material-plan-issues/issues/'+overage.id+'/overage',201,overagePin)).value.data;
  const decision=()=>({requestKey:randomUUID(),decision:'APPROVE',comment:'Independent synthetic overage decision'});
  await c.call(ben,'OVERAGE_ORDER_BLOCKED','/inventory/material-plan-issues/authorizations/'+submitted.authorizationId+'/decision',409,decision());
  await c.call(khaimook,'OVERAGE_REVIEW','/inventory/material-plan-issues/authorizations/'+submitted.authorizationId+'/review',201,decision());
  const approved=(await c.call(ben,'OVERAGE_FINAL_APPROVE','/inventory/material-plan-issues/authorizations/'+submitted.authorizationId+'/decision',201,decision())).value.data;
  demand(approved.status==='POSTED','MATERIAL_JOURNEY_OVERAGE_POST_FAILED');
  await balance('OVERAGE_STOCK','13.0000');
  for(const issue of [overage,within])await c.call(store,'ISSUE_REVERSE','/inventory/material-issues/'+issue.id+'/reverse',201,
    {reversalKey:randomUUID(),reason:'Synthetic physical issue reversal with retained history'});
  await balance('FINAL_STOCK','20.0000');
  requestRead=await readRequest(request.id);
  demand(requestRead.lines[0].issuedQuantity==='0.0000'&&requestRead.lines[0].acknowledgedQuantity==='0.0000'&&
    requestRead.lines[0].issueLinks[0].receipts.length===1,'MATERIAL_JOURNEY_RETAINED_RECEIPT_HISTORY_FAILED');
  const reportAfter=(await c.call(store,'REPORT_AFTER',reportPath,200)).value.data;
  demand(reportAfter.stockCountRowCount===reportBefore.stockCountRowCount&&
    reportAfter.materialIssueRowCount===reportBefore.materialIssueRowCount+4,'MATERIAL_JOURNEY_CANONICAL_REPORT_FAILED');
  // IDs and observations are private coordinator evidence, never public output.
  return {status:'MATERIAL_API_JOURNEY_EXECUTED',planId:plan.id,requestId:request.id,
    withinIssueId:within.id,overageIssueId:overage.id,documentId:document.data.id,documentSha256:hash(bytes),
    stockHistory:['20.0000','17.0000','13.0000','20.0000'],observations:c.observations,
    actualUiJourneyVerified:false,fullBusinessRoleMatrixVerified:false,populatedRecoveryVerified:false,
    prototypeFrozen:false,humanUatCompleted:false,productionAuthorized:false};
  }catch(e){e.privateObservations=c.observations;throw e;}
}
