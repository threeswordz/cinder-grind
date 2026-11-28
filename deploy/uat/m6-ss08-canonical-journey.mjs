// SS08 isolated within-plan dimensional issue. No direct business DB writes.
// Caller owns fixture admission, transport, document bytes, durable attempt and delta proof.
import {createHash} from 'node:crypto';
import {verifySs08TerminalReadback} from './m6-ss08-terminal-readback.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_SS08_JOURNEY_'+c),{safeCode:'M6_SS08_JOURNEY_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
export const ss08BindingDigest=x=>hash(JSON.stringify(x));
function units(x){need(typeof x==='string'&&/^-?(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$/.test(x),'QUANTITY');const [a,b='']=x.replace(/^-/,'').split('.');return (x.startsWith('-')?-1n:1n)*(BigInt(a)*10000n+BigInt(b.padEnd(4,'0')));}
export function createSs08CanonicalJourney({binding,authorization:a,operatorSha,request,upload,download,readback,verifyRuntime,verifySources,verifyDelta,clock=()=>new Date()}){
 const b=structuredClone(binding),keys=['companyId','projectId','foreignProjectId','warehouseId','materialId','uomId','costCodeId','activityId','activityTypeId','planId','revisionId','planLineId','budgetRevisionId','budgetLineId','issuerEmployeeId','recipientEmployeeId','storeUserId','pmUserId','documentTypeId','historicalDocumentId','createKey','postKey','linkKey','receiptKey'];
 need(b&&keys.every(k=>uuid(b[k]))&&Array.isArray(b.wbsPath)&&b.wbsPath.length===3&&b.wbsPath.every(w=>uuid(w.id)&&typeof w.name==='string'&&w.name.trim())&&new Set([...keys.map(k=>b[k]),...b.wbsPath.map(w=>w.id)]).size===keys.length+3&&typeof b.activityTypeName==='string'&&b.activityTypeName.trim()&&Number.isSafeInteger(b.planVersion)&&b.planVersion>0,'BINDING');
 need(hex(b.documentSha256)&&hex(b.historicalDocumentSha256)&&b.documentSha256!==b.historicalDocumentSha256&&units(b.quantity)>0n&&/^\d{4}-\d{2}-\d{2}$/.test(b.issueDate)&&Number.isFinite(Date.parse(b.issueDate))&&new Date(b.issueDate).toISOString().slice(0,10)===b.issueDate,'EVIDENCE_BINDING');
 need(a?.applicationSha==='70013b5139292ef33563447f8937c8f132feabd2'&&a.database==='m6_successor_rehearsal'&&/^[a-f0-9]{40}$/.test(operatorSha??'')&&a.operatorSha===operatorSha&&a.bindingSha256===ss08BindingDigest(b)&&a.ownerAuthorizedSs08Journey===true&&a.retainedMutationAuthorized===false&&a.productionAuthorized===false,'AUTHORITY');
 need([request,upload,download,readback,verifyRuntime,verifySources,verifyDelta,clock].every(f=>typeof f==='function'),'ADAPTER');
 const dims={wbsId:b.wbsPath[2].id,costCodeId:b.costCodeId,activityId:b.activityId},mat={materialId:b.materialId,uomId:b.uomId},scope=r=>r?.companyId===b.companyId&&r.projectId===b.projectId&&r.warehouseId===b.warehouseId,exactLine=r=>r&&Object.entries({...dims,...mat}).every(([k,v])=>r[k]===v);
 const requestPath='/inventory/material-requests',issuePath='/inventory/material-issues',planPath='/inventory/material-plan-issues/issues/';let attempted=false;
 async function call(method,path,body,status){await verifyRuntime();const r=await request({actor:'STORE_SITE',method,path,body});need(r?.status===status,'HTTP_'+status);return r.data;}
 return async()=>{
  need(!attempted,'NO_REPLAY');attempted=true;await verifyRuntime();need(await verifySources(b)===true,'SOURCE_PROOF');
  await call('GET',requestPath+'?projectId='+b.foreignProjectId,undefined,404);
  const r=await call('POST',requestPath,{requestKey:b.createKey,projectId:b.projectId,warehouseId:b.warehouseId,requesterEmployeeId:b.recipientEmployeeId,requestDate:b.issueDate,remarks:'Synthetic M6 SS08',lines:[{...mat,...dims,requestedQuantity:b.quantity}]},201);need(uuid(r?.id)&&r.version===1,'REQUEST_CREATE');
  const rp=requestPath+'/'+r.id,draft=await call('GET',rp,undefined,200),line=draft?.lines?.[0];need(scope(draft)&&draft.id===r.id&&draft.version===1&&draft.requesterEmployeeId===b.recipientEmployeeId&&draft.lines.length===1&&uuid(line?.id)&&exactLine(line)&&units(line.requestedQuantity)===units(b.quantity)&&line.fulfillment==='NOT_ISSUED'&&line.issueLinks.length===0,'REQUEST_LINE');
  const issue=await call('POST',issuePath,{projectId:b.projectId,warehouseId:b.warehouseId,issuedToEmployeeId:b.recipientEmployeeId,issueDate:b.issueDate,remarks:'Synthetic M6 SS08',lines:[{...mat,...dims,quantity:b.quantity}]},201);need(scope(issue)&&uuid(issue.id)&&issue.createdByUserId===b.storeUserId&&issue.issuedToEmployeeId===b.recipientEmployeeId&&!issue.postedAt,'ISSUE_CREATE');
  const ip=issuePath+'/'+issue.id,itemDetail=await call('GET',ip,undefined,200),item=itemDetail?.items?.[0];need(scope(itemDetail)&&itemDetail.id===issue.id&&itemDetail.items.length===1&&uuid(item?.id)&&exactLine(item)&&units(item.quantity)===units(b.quantity),'ISSUE_LINE');
  const pp=planPath+issue.id,payload={requestKey:b.postKey,bindings:[{issueItemId:item.id,planLineId:b.planLineId,expectedPlanVersion:b.planVersion}]};
  const preview=await call('POST',pp+'/preview',payload,201),p=preview?.items?.[0];need(preview?.issueId===issue.id&&preview.result==='WITHIN_PLAN'&&preview.items.length===1&&p.issueItemId===item.id&&p.planId===b.planId&&p.planLineId===b.planLineId&&p.planVersion===b.planVersion&&units(p.quantity)===units(b.quantity)&&units(p.overageQuantity)===0n,'PLAN_PREVIEW');
  const posted=await call('POST',pp+'/within-plan',payload,201);need(posted?.issueId===issue.id&&uuid(posted.authorizationId),'ISSUE_POST');
  const actual=await call('GET',ip,undefined,200);need(scope(actual)&&actual.id===issue.id&&Number.isFinite(Date.parse(actual.postedAt))&&!actual.reversedAt&&actual.stockTransactions?.length===1&&actual.stockTransactions[0].movementType==='MATERIAL_ISSUE'&&units(actual.stockTransactions[0].quantity)===-units(b.quantity),'STOCK_EFFECT');
  const linked=await call('POST',rp+'/issue-links',{requestKey:b.linkKey,expectedVersion:1,requestLineId:line.id,materialIssueItemId:item.id,reason:'Synthetic linked dimensional issue'},201);need(linked?.id===r.id&&linked.version===2,'LINK');
  const afterLink=await call('GET',rp,undefined,200),link=afterLink?.lines?.[0]?.issueLinks?.[0];need(scope(afterLink)&&afterLink.version===2&&afterLink.lines[0].id===line.id&&afterLink.lines[0].issueLinks.length===1&&uuid(link?.id)&&link.materialIssueItemId===item.id&&link.currentlyIssued===true&&link.receipts.length===0,'LINK_READBACK');
  const target='/documents/projects/'+b.projectId+'/targets/MATERIAL_REQUEST/'+r.id;await verifyRuntime();const doc=await upload({actor:'STORE_SITE',path:target,documentTypeId:b.documentTypeId,expectedSha256:b.documentSha256});need(doc?.status===201&&uuid(doc.data?.id)&&doc.data.id!==b.historicalDocumentId,'NEW_DOCUMENT');
  const docId=doc.data.id;await verifyRuntime();const bytes=await download({actor:'STORE_SITE',path:target+'/'+docId+'/download'});need(bytes?.status===200&&bytes.bytes instanceof Uint8Array&&bytes.bytes.length>0&&hash(bytes.bytes)===b.documentSha256,'DOCUMENT_BYTES');
  const receivedAt=clock().toISOString();need(Date.parse(receivedAt)>=Date.parse(actual.postedAt),'RECEIPT_TIME');
  const receiptOp=await call('POST',rp+'/receipts',{requestKey:b.receiptKey,expectedVersion:2,issueLinkId:link.id,recipientEmployeeId:b.recipientEmployeeId,issuerEmployeeId:b.issuerEmployeeId,receivedAt,documentId:docId,signedEvidenceConfirmed:true,supersedesReceiptId:null,reason:'Synthetic signed receipt only'},201);need(receiptOp?.id===r.id&&receiptOp.version===3,'ACKNOWLEDGE');
  const final=await call('GET',rp,undefined,200),fl=final?.lines?.[0],receipt=fl?.issueLinks?.[0]?.receipts?.[0];need(scope(final)&&final.version===3&&fl?.id===line.id&&fl.fulfillment==='FULFILLED'&&units(fl.acknowledgedQuantity)===units(b.quantity)&&fl.issueLinks.length===1&&fl.issueLinks[0].id===link.id&&fl.issueLinks[0].receipts.length===1&&uuid(receipt?.id)&&receipt.documentId===docId&&receipt.evidenceChecksum===b.documentSha256,'RECEIPT_READBACK');
  const ids={issueId:issue.id,issueItemId:item.id,requestId:r.id,requestLineId:line.id,linkId:link.id,receiptId:receipt.id,documentId:docId,authorizationId:posted.authorizationId};
  const rows=await readback(ids);const proof=verifySs08TerminalReadback({...rows,binding:{...b,...ids},bytes:bytes.bytes});need(proof.issueReversed===false,'ACTIVE_ISSUE');
  need(await verifyDelta(ids)===true,'DELTA');
  return {...proof,canonicalApiVerified:true,foreignProjectDenied:true,browserVerified:false,productionAuthorized:false,automaticRetryAllowed:false};
 };
}
