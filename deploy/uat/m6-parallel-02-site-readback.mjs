// M6-02 successor-only readback. Caller owns pinned runtime, private receipt
// binding, authenticated GET transport, session cleanup and preservation gates.
// No login, grant changes, writes, business replay or release authorization.
import {createHash} from 'node:crypto';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_02_'+code),{safeCode:'M6_02_'+code});};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hex=/^[a-f0-9]{64}$/;
const q=v=>{need(typeof v==='string'&&/^\d{1,14}(?:\.\d{1,4})?$/.test(v),'DECIMAL');const [a,b='']=v.split('.');return BigInt(a)*10000n+BigInt(b.padEnd(4,'0'));};
const one=(rows,code)=>{need(Array.isArray(rows)&&rows.length===1,code);return rows[0];};
const scope=(r,b,id)=>r?.id===id&&r.companyId===b.companyId&&r.projectId===b.projectId;
const denied=r=>r?.status===403||r?.status===404;
const roles=['KHAIMOOK','JAI','PORN','STORE_SITE'];
const fields=new Set('id projectId companyId boqId boqName budgetRevisionId boqItemId revisionNo revisionNumber lifecycleState isOriginal isCurrent createdAt submittedAt itemCode description sectionId sectionCode sectionName quantity uomId uomCode uomName wbsId wbsCode wbsName costCodeId costCode costName sortOrder isActive'.split(' '));
const relations={project:'id projectCode projectName',section:'id sectionCode sectionName',uom:'id uomCode uomName decimalPlaces',wbs:'id wbsCode wbsName',costCode:'id costCode costName',approvalInstance:'id approvalState currentStepNo startedAt completedAt'};
const scalar=v=>v===null||['string','boolean','number'].includes(typeof v);
const money=v=>{need(typeof v==='string'&&/^\d{1,18}(?:\.\d{1,4})?$/.test(v),'FULL_MONEY');const [a,b='']=v.split('.');return BigInt(a)*10000n+BigInt(b.padEnd(4,'0'));};
const sameRaw=(r,c)=>Array.isArray(r.lines)&&r.lines.length===c.lines.length&&new Set(r.lines.map(l=>l.id)).size===r.lines.length&&c.lines.every(raw=>r.lines.some(l=>l.id===raw.id&&l.uomId===raw.uomId&&q(l.quantity)===q(raw.quantity)));
const sameMoney=(r,c)=>sameRaw(r,c)&&c.lines.every(raw=>{const l=r.lines.find(l=>l.id===raw.id);return money(l.rate)===money(raw.rate)&&money(l.amount)===money(raw.amount);});
export function assertM6QuantityProjection(row){
 need(row&&typeof row==='object'&&!Array.isArray(row),'QUANTITY_SHAPE');
 for(const [key,value] of Object.entries(row)){
  if(['items','lines','sections'].includes(key)){need(Array.isArray(value),'QUANTITY_SHAPE');value.forEach(assertM6QuantityProjection);continue;}
  if(Object.hasOwn(relations,key)){
   if(value===null||key==='costCode'&&typeof value==='string')continue;
   need(typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([k,v])=>relations[key].split(' ').includes(k)&&scalar(v)),'QUANTITY_DISCLOSURE');continue;
  }
  need(fields.has(key)&&scalar(value),'QUANTITY_DISCLOSURE');
 }
}
export function siteReadbackPaths(b){
 const ids=['companyId','projectId','foreignProjectId','reportId','planId','requestId','documentId','materialId','uomId','warehouseId','budgetRevisionId','budgetRevisionLineId','costRevisionId','clientVersionId','benUserId','nancyUserId','storeUserId','pmUserId','foremanUserId'];
 need(b&&ids.every(k=>typeof b[k]==='string'&&uuid.test(b[k]))&&new Set(ids.map(k=>b[k])).size===ids.length&&hex.test(b.documentSha256??''),'BINDING');
 const p=b.projectId,c=b.costRevisionId;
 return {report:'/site-execution/reports/'+b.reportId,plan:'/inventory/material-plans/'+b.planId,request:'/inventory/material-requests/'+b.requestId,
  quantity:'/budget/quantity/projects/'+p+'/revisions/'+c,cost:'/budget/revisions/'+c,
  client:'/budget/customer/projects/'+p+'/versions/'+b.clientVersionId,
  foreign:'/budget/quantity/projects/'+b.foreignProjectId+'/revisions/'+c,
  document:'/documents/projects/'+p+'/targets/MATERIAL_REQUEST/'+b.requestId+'/'+b.documentId+'/download'};
}
export async function verifyM6SiteReadback(binding,{get,download}={}){
 const b=Object.freeze({...binding}),p=siteReadbackPaths(b);
 need(typeof get==='function'&&typeof download==='function','TRANSPORT');
 const read=async(actor,path)=>{const r=await get(actor,path);need(r?.status===200&&r.data&&typeof r.data==='object','READ');return r.data;};
 const report=await read('FOREMAN',p.report);
 need(scope(report,b,b.reportId)&&report.status==='SUBMITTED'&&report.submittedByUserId===b.foremanUserId,'REPORT');
 const plan=await read('STORE_SITE',p.plan),pm=await read('KHAIMOOK',p.plan);
 for(const r of [plan,pm]){
  need(scope(r,b,b.planId)&&r.warehouseId===b.warehouseId&&r.budgetRevisionId===b.budgetRevisionId,'PLAN');
  const rev=r.approvedRevision,line=one(rev?.lines,'PLAN_LINE');
  need(rev.status==='APPROVED'&&rev.createdByUserId===b.storeUserId&&rev.decidedByUserId===b.pmUserId&&line.budgetRevisionLineId===b.budgetRevisionLineId&&line.materialId===b.materialId&&line.uomId===b.uomId&&q(line.quantity)===60000n,'PLAN_LINE');
 }
 const req=await read('STORE_SITE',p.request),line=one(req.lines,'REQUEST_LINE');
 need(scope(req,b,b.requestId)&&req.warehouseId===b.warehouseId&&line.materialId===b.materialId&&line.uomId===b.uomId&&q(line.requestedQuantity)===30000n&&line.fulfillment==='NOT_ISSUED','REQUEST');
 need(Number.isSafeInteger(req.version)&&req.version>=1&&req.revisions?.length===req.version&&req.revisions.every((r,i)=>r.version===i+1),'REQUEST_HISTORY');
 const link=one(line.issueLinks,'LINK'),receipt=one(link.receipts,'RECEIPT');
 need(link.currentlyIssued===false&&receipt.documentId===b.documentId&&receipt.evidenceChecksum===b.documentSha256&&!receipt.superseded,'RECEIPT');
 const document=await download('STORE_SITE',p.document);
 need(document?.status===200&&document.bytes instanceof Uint8Array&&document.bytes.length>0&&createHash('sha256').update(document.bytes).digest('hex')===b.documentSha256,'DOCUMENT_BYTES');
 need(denied(await download('FOREMAN',p.document)),'DOCUMENT_DENIAL');
 const cost=await read('BEN',p.cost),nancy=await read('NANCY',p.cost);
 for(const r of [cost,nancy])need(scope(r,b,b.costRevisionId)&&r.lifecycleState==='APPROVED'&&r.createdByUserId===b.benUserId&&r.approvalInstance?.actions?.some(a=>a.actionByUserId===b.benUserId&&a.action==='APPROVE')&&Array.isArray(r.lines)&&r.lines.length>0,'COST');
 need(sameMoney(cost,cost)&&sameMoney(nancy,cost),'FULL_MONEY');
 let clientMoney;
 for(const actor of ['BEN','NANCY']){
  const h=await read(actor,p.client),v=h.version;
  need(scope(v,b,b.clientVersionId)&&v.sourceRevisionId===b.costRevisionId&&v.createdByUserId===b.benUserId&&v.approvalInstance?.approvalState==='APPROVED'&&h.approvals?.some(a=>a.id===v.approvalInstanceId&&a.actions?.some(x=>x.actionByUserId===b.nancyUserId&&x.action==='APPROVE')),'CLIENT');
  const edit=one(v.edits?.filter(e=>e.editNo===v.currentEditNo),'CLIENT_EDIT'),l=one(edit.lines,'CLIENT_LINE'),m=one(l.mappings,'CLIENT_MAPPING');
  const raw=one(cost.lines.filter(x=>x.id===m.sourceLineId),'CLIENT_SOURCE');
  const observed=[money(l.rate),money(l.amount)];
  if(clientMoney)need(observed.every((x,i)=>x===clientMoney[i]),'FULL_MONEY');else clientMoney=observed;
  need(raw.uomId===l.uomId&&q(raw.quantity)===q(l.pricingSnapshot?.rawQuantity)&&q(l.pricingSnapshot.bufferQuantity)>0n&&q(l.quantity)===q(raw.quantity)+q(l.pricingSnapshot.bufferQuantity),'CLIENT_BUFFER');
 }
 for(const actor of roles){
  const row=await read(actor,p.quantity);assertM6QuantityProjection(row);
  need(scope(row,b,b.costRevisionId)&&sameRaw(row,cost),'RAW_QUANTITY');
  const alternate=await get(actor,p.cost);if(!denied(alternate)){need(alternate?.status===200,'ALTERNATE_COST');assertM6QuantityProjection(alternate.data);need(scope(alternate.data,b,b.costRevisionId),'ALTERNATE_COST');need(sameRaw(alternate.data,cost),'RAW_QUANTITY');}
  need(denied(await get(actor,p.client)),'CLIENT_DENIAL');
 }
 need(denied(await get('STORE_SITE',p.foreign)),'FOREIGN_PROJECT_DENIAL');
 return {status:'M6_02_SITE_MATERIAL_ROLE_READBACK_VERIFIED',report:true,plan:true,request:true,documentBytes:true,documentDenial:true,boqRoleMatrix:true,mismatchedProjectDenial:true,mutationsPerformed:false,humanUatCompleted:false,productionAuthorized:false};
}
