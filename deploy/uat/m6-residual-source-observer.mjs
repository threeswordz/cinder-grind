// Native read-only source adapter. No sessions, writes, grants or CLI.
import {createHash} from 'node:crypto';
import {event284Specs} from './m6-residual-role-plan.mjs';
import {calendarName} from './m6-event284-calendar.mjs';
import {planResidualSiteFixture} from './m6-residual-site-fixture.mjs';
import {planResidualSupplierSources} from './m6-residual-supplier-source.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RESIDUAL_OBSERVER_'+c),{safeCode:'M6_RESIDUAL_OBSERVER_'+c});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sorted=x=>[...x].sort();
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const prefix='M6-RESIDUAL-266';
function digest(x){return createHash('sha256').update(JSON.stringify(x)).digest('hex');}
function moneyRows(rows){return rows.map(x=>({...x,quantity:String(x.quantity),rate:String(x.rate),amount:String(x.amount)}));}
export function projectResidualRoster(roster,rolePlan){
 const out=structuredClone(roster);need(rolePlan?.database==='m6_successor_rehearsal'&&rolePlan.applicationSha==='70013b5139292ef33563447f8937c8f132feabd2'&&Array.isArray(rolePlan.changes)&&rolePlan.changes.length===4&&same(sorted(rolePlan.changes.map(c=>c.actor)),['BEN','FOREMAN','JAI','KHAIMOOK'])&&typeof rolePlan.needsPoEdit==='boolean'&&same(rolePlan.expected,{roles:2,user_roles:2,role_permissions:rolePlan.needsPoEdit?14:13,audit_logs:1}),'ROLE_PLAN');
 const exact=Object.fromEntries(event284Specs(rolePlan.needsPoEdit).map(([actor,role,permissions])=>[actor,[role,permissions]]));
 for(const c of rolePlan.changes){const [role,permissions]=exact[c.actor];need(c.createRole===role&&same(sorted(c.permissions.map(p=>p.code)),sorted(permissions)),'ROLE_SCOPE');const r=out[c.actor];need(r?.userId===c.userId&&r.companyId===rolePlan.companyId&&same(sorted(r.roleCodes),c.beforeRoles)&&same(sorted(r.permissions),c.beforePermissions),'ROLE_DRIFT');r.roleCodes=sorted(new Set([...r.roleCodes,...(c.createRole?[c.createRole]:[])]));r.permissions=sorted(new Set([...r.permissions,...c.permissions.map(p=>p.code)]));}
 return out;
}
export async function observeResidualSourcePlans(ctx,{keys,issueDate,validTo,artifacts}){
 const {db,fixture:f,site,inventoryBinding:inv,rolePlan,binding,initial,captureFixtureRows,verifyBeforeMutation,verifyCustody}=ctx;
 need(ctx.candidate?.sha==='70013b5139292ef33563447f8937c8f132feabd2'&&ctx.publicProof?.status==='M6_RESIDUAL_READ_ONLY_READINESS_PASS'&&ctx.publicProof.historicalSessionRowsPreserved===129&&ctx.publicProof.rateBucketReady===true&&[captureFixtureRows,verifyBeforeMutation,verifyCustody].every(x=>typeof x==='function')&&initial?.user_sessions?.length===129,'ADMISSION');
 need([f?.companyId,f?.projectId,f?.foreignCompanyId,f?.foreignProjectId,f?.warehouseId,f?.materialId,f?.uomId,site?.documentId,inv?.orderId,inv?.deliveryId].every(uuid)&&site.companyId===f.companyId&&site.projectId===f.projectId&&inv.companyId===f.companyId&&inv.projectId===f.projectId&&rolePlan.companyId===f.companyId&&rolePlan.projectId===f.projectId,'SCOPE');
 const roster=projectResidualRoster(binding.roster,rolePlan),scope={companyId:f.companyId,projectId:f.projectId};
 await verifyBeforeMutation();await verifyCustody();
 const result=await db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const dbid=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");need(dbid.length===1&&dbid[0].db==='m6_successor_rehearsal'&&dbid[0].role==='proto_runtime'&&dbid[0].ro==='on'&&dbid[0].isolation==='repeatable read','DATABASE');
  const active=await tx.$queryRawUnsafe('SELECT count(*)::text AS n FROM public.user_sessions WHERE revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP');need(active.length===1&&active[0].n==='0'&&same(initial,await captureFixtureRows(tx)),'BASELINE');
  const boq=await tx.boq.findFirst({where:scope,include:{sections:true,items:true}}),approved=await tx.budgetRevision.findFirst({where:{...scope,approvalInstance:{is:{approvalState:'APPROVED'}}},orderBy:{revisionNo:'desc'},include:{approvalInstance:true,lines:true}}),max=await tx.budgetRevision.aggregate({where:scope,_max:{revisionNo:true}});
  need(boq&&approved&&max._max.revisionNo===approved.revisionNo,'BOQ_REVISION');
  const workflow=await tx.approvalWorkflow.findFirst({where:{companyId:f.companyId,workflowCode:'PROTO_M6_COST_BEN',entityType:'BUDGET_REVISION',isActive:true},include:{steps:{include:{stepRoles:{include:{role:true}}}}}});
  const step=workflow?.steps?.[0],edge=step?.stepRoles?.[0],benRole=ctx.roleContext.original.BEN.roleId;need(workflow&&workflow.steps.length===1&&step.stepNo===1&&step.requiredApprovals===1&&step.stepRoles.length===1&&edge.roleId===benRole&&edge.role.companyId===f.companyId&&edge.role.roleCode==='PROTO_BEN'&&edge.role.isActive===true,'BOQ_WORKFLOW');
  const calendars=await tx.workingCalendar.findMany({where:{companyId:f.companyId,isActive:true,OR:[{projectId:f.projectId},{projectId:null}]},orderBy:[{isDefault:'desc'},{id:'asc'}],take:201});need(calendars.length<=200,'CALENDAR');const calendar=calendars.find(c=>c.projectId===f.projectId&&c.isDefault)??calendars.find(c=>c.projectId===f.projectId)??calendars.find(c=>c.isDefault)??calendars[0]??null;
  const costCode=await tx.costCode.findFirst({where:{companyId:f.companyId,isActive:true},orderBy:{costCode:'asc'}});need(costCode,'COST_CODE');
  const activityType=await tx.activityType.findFirst({where:{companyId:f.companyId,isActive:true},orderBy:{activityTypeCode:'asc'}});
  const material=await tx.material.findUnique({where:{id:f.materialId}}),uom=await tx.unitOfMeasure.findUnique({where:{id:f.uomId}}),activation=await tx.materialUomActivation.findUnique({where:{materialId:f.materialId}});
  const stock=await tx.stockTransaction.groupBy({by:['uomId'],where:{...scope,warehouseId:f.warehouseId,materialId:f.materialId},_sum:{quantity:true}});need(stock.length===1&&stock[0].uomId===f.uomId&&stock[0]._sum.quantity!==null,'STOCK_BASIS');
  const issuePolicy=await tx.materialPlanProjectPolicy.findUnique({where:{projectId:f.projectId}});need(uuid(issuePolicy?.id),'ISSUE_POLICY_ID');
  const collisionCount=(await tx.workingCalendar.count({where:{companyId:f.companyId,calendarName}}))+(await tx.wbsElement.count({where:{projectId:f.projectId,wbsCode:{startsWith:prefix}}}))+(await tx.activity.count({where:{...scope,activityCode:{startsWith:prefix}}}))+(await tx.activityType.count({where:{companyId:f.companyId,activityTypeCode:{startsWith:prefix}}}))+(await tx.boqItem.count({where:{boqId:boq.id,itemCode:{startsWith:prefix}}}))+(await tx.materialUsagePlan.count({where:{...scope,workPackageCode:prefix}}));
  const sitePlan=planResidualSiteFixture({binding:{...scope,warehouseId:f.warehouseId,materialId:f.materialId,uomId:f.uomId,budgetRevisionId:approved.id},roster,boq:{...boq,items:moneyRows(boq.items)},approved:{...approved,lines:moneyRows(approved.lines)},workflow:{...workflow,benOnly:true},calendar,costCode,activityType,material:{...material,uomActivated:!!activation},uom,stockQuantity:String(stock[0]._sum.quantity),collisionCount,issuePolicy,keys,issueDate,validTo});
  const order=await tx.purchaseOrder.findUnique({where:{id:inv.orderId},include:{approvalInstance:true,nextRevision:true}}),delivery=await tx.receivingDelivery.findUnique({where:{id:inv.deliveryId},include:{replacement:true,lines:{include:{purchaseOrderLine:true}},evidence:{include:{replacement:true,document:{include:{links:true}}}}}});
  const dispatchEvents=await tx.poDispatchEvent.findMany({where:{...scope,purchaseOrderId:inv.orderId},orderBy:{id:'asc'},take:3});
  const historical=await tx.document.findUnique({where:{id:site.documentId},include:{documentType:true}});need(historical?.companyId===f.companyId&&historical.checksum===site.documentSha256&&historical.isActive===true,'DOCUMENT_SOURCE');
  need(rolePlan.needsPoEdit===!dispatchEvents.some(e=>e.kind==='ACKNOWLEDGMENT'),'PUR07_ROLE_DRIFT');
  const selected={...artifacts};if(dispatchEvents.some(e=>e.kind==='DISPATCH'))delete selected.dispatch;
  const supplierPlan=planResidualSupplierSources({binding:inv,order,delivery,lines:(delivery?.lines??[]).map(l=>({...l,observedQuantity:String(l.observedQuantity),goodQuantity:String(l.goodQuantity)})),evidence:delivery?.evidence??[],dispatchEvents,roster,documentType:historical.documentType,artifacts:selected});
  const foreign=await tx.purchaseOrder.findFirst({where:{companyId:f.foreignCompanyId,projectId:f.foreignProjectId},orderBy:{id:'asc'},select:{id:true,companyId:true,projectId:true}});need(uuid(foreign?.id)&&foreign.companyId===f.foreignCompanyId&&foreign.projectId===f.foreignProjectId,'FOREIGN_ORDER');
  need(same(initial,await captureFixtureRows(tx)),'BASELINE_DRIFT');
  return {sitePlan,supplierPlan,issuePolicyId:issuePolicy.id,foreignOrderId:foreign.id,documentTypeId:historical.documentTypeId,historicalDocumentId:historical.id,historicalDocumentSha256:historical.checksum,baselineSha256:digest(initial),expectedActors:['BEN','KHAIMOOK','FOREMAN','JAI','STORE_SITE'].map(k=>roster[k].userId).sort(),syntheticOnly:true,productionAuthorized:false};
 },{isolationLevel:'RepeatableRead',timeout:120000});
 await verifyBeforeMutation();await verifyCustody();return result;
}
