// DEC-050: bounded new synthetic material issue -> partial return -> reversals.
// Separate from BOQ-backed plan, which requires a real approved Cost source.
// No historical issue/return, old stock, Finance or predecessor operator is replayed.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SOURCE,httpClient} from './prototype-actors.mjs';
import {validUomOrigins} from './prototype-uom-state.mjs';
const demand=(v,code)=>{if(!v)throw Object.assign(new Error(code),{safeCode:code});};
const fixed=x=>Number(x).toFixed(4);
const expectedRights={
 STORE_SITE:['inventory.issue.view','inventory.issue.create','inventory.issue.submit','inventory.issue.reverse',
   'inventory.return.view','inventory.return.create','inventory.return.submit','inventory.return.reverse'],
 KHAIMOOK:['inventory.issue.view','inventory.issue.approve','inventory.return.view','inventory.return.approve'],
};
async function configure(db,binding,source){
 const b=structuredClone(binding),f=b.fixture;
 demand(b.sourceSha===SOURCE&&source.company.id===f.companyId&&source.material.code==='PROTO_UOM_NEW',
  'UOM_POSTING_WRONG_SYNTHETIC_BINDING');
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('prototype-uom-converted-posting-v1'))");
  demand(await tx.material.count({where:{id:source.material.id,companyId:f.companyId,materialCode:'PROTO_UOM_NEW',isActive:true}})===1&&
   await tx.materialUomActivation.count({where:{materialId:source.material.id,companyId:f.companyId,stockUomId:source.each.id}})===1&&
   await tx.materialIssueItem.count({where:{materialId:source.material.id}})===0&&
   await tx.materialReturnItem.count({where:{materialId:source.material.id}})===0,
   'UOM_POSTING_SOURCE_ALREADY_USED_OR_DRIFT');
  const rights=[...new Set(Object.values(expectedRights).flat())];
  const perms=await tx.permission.findMany({where:{permissionCode:{in:rights}}});
  demand(perms.length===rights.length,'UOM_POSTING_PERMISSION_CATALOG_INCOMPLETE');
  const permissions=new Map(perms.map(p=>[p.permissionCode,p.id]));
  for(const [key,codes]of Object.entries(expectedRights)){
   const roleId=b.actors[key].roleId,rows=await tx.rolePermission.findMany({where:{roleId},select:{permissionId:true}});
   demand(codes.every(code=>rows.some(p=>p.permissionId===permissions.get(code))),
    'UOM_POSTING_SYNTHETIC_ROLE_PERMISSION_MISSING');
  }
  const seq=async(entityType,format)=>{
   const before=await tx.numberSequence.findUnique({where:{companyId_sequenceCode:{companyId:f.companyId,sequenceCode:entityType}}});
   if(before){
    demand(before.entityType===entityType&&before.formatTemplate===format&&before.resetRule==='MONTHLY',
     'UOM_POSTING_PREEXISTING_SEQUENCE_CONFLICT');return;
   }
   await tx.numberSequence.create({data:{companyId:f.companyId,entityType,sequenceCode:entityType,
    formatTemplate:format,resetRule:'MONTHLY'}});
  };
  await seq('MATERIAL_ISSUE','MIYYMM-###');await seq('MATERIAL_RETURN','MRTYYMM-###');
  const workflow={};
  for(const entityType of ['MATERIAL_ISSUE','MATERIAL_RETURN']){
   const rows=await tx.approvalWorkflow.findMany({where:{companyId:f.companyId,entityType},
    include:{steps:{orderBy:{stepNo:'asc'},include:{stepRoles:true}}}});
   demand(rows.length<=1,'UOM_POSTING_AMBIGUOUS_APPROVAL_WORKFLOW');
   const current=rows[0];
   if(current){
    demand(current.isActive&&current.steps.length===1&&current.steps[0].stepNo===1&&
     current.steps[0].requiredApprovals===1&&current.steps[0].stepRoles.length===1&&
     current.steps[0].stepRoles[0].roleId===b.actors.KHAIMOOK.roleId,
     'UOM_POSTING_EXISTING_APPROVAL_AUTHORITY_CONFLICT');
    workflow[entityType]=current.workflowCode;continue;
   }
   const row=await tx.approvalWorkflow.create({data:{companyId:f.companyId,entityType,
    workflowCode:'PROTO_UOM_'+(entityType==='MATERIAL_ISSUE'?'ISSUE':'RETURN'),
    workflowName:'Isolated converted '+entityType+' independent approval',
    steps:{create:[{stepNo:1,stepName:'Khaimook independent stock check',
     requiredApprovals:1,stepRoles:{create:[{roleId:b.actors.KHAIMOOK.roleId}]}}]}}});
   workflow[entityType]=row.workflowCode;
  }
  await tx.auditLog.create({data:{companyId:f.companyId,
   entityType:'PROTOTYPE_UOM_POSTING_CONFIGURATION',entityId:f.projectId,
   action:'CONFIGURE',actorUserId:f.adminUserId,
   newValues:{syntheticOnly:true,materialId:source.material.id,
    workflow,approvedCostSourceAvailable:false,originalRolesUnchanged:true}}});
  return workflow;
 },{isolationLevel:'Serializable',timeout:30000});
}
export async function convertedIssueReturn(db,binding,source,{api,web}){
 const b=structuredClone(binding),f=b.fixture,materialId=source?.material?.id;
 demand(b.sourceSha===SOURCE&&validUomOrigins(api,web)&&source?.company?.id===f.companyId&&
  source?.material?.code==='PROTO_UOM_NEW','UOM_IR_SYNTHETIC_SOURCE_REQUIRED');
 const [before,finance,documents,oldCert,oldTransfer,sourceBefore]=await Promise.all([
  db.stockTransaction.findMany({where:{companyId:f.companyId}}),
  db.payment.findMany({where:{companyId:f.companyId}}),
  db.document.findMany({where:{companyId:f.companyId}}),
  db.subcontractCertification.findMany({where:{companyId:f.companyId}}),
  db.transferReceipt.findMany(),
  db.materialUomReceiptSourcePin.findMany({where:{companyId:f.companyId,materialId}})
 ]);
 demand(sourceBefore.length===1&&fixed(sourceBefore[0].stockQuantity)==='60.0000'&&
  sourceBefore[0].numerator==='20'&&
  before.filter(t=>t.materialId===materialId).length===1,
  'UOM_IR_PRIOR_CANONICAL_RECEIPT_REQUIRED');
 const workflow=await configure(db,b,source),sessions={};
 const client=httpClient(api,web,async(url,options)=>{
  const path=url.slice(api.length);
  demand(url.startsWith(api+'/')&&options.redirect==='error'&&options.headers.Origin===web&&
   ['GET','POST'].includes(options.method)&&
   (['/auth/login','/auth/logout','/auth/me'].includes(path)||
     path==='/inventory/material-issues'||path.startsWith('/inventory/material-issues/')||
     path==='/inventory/material-returns'||path.startsWith('/inventory/material-returns/')||
     path.startsWith('/inventory/reports/movements?')),
    'UOM_IR_UNDECLARED_HTTP_REQUEST');
  return fetch(url,options);
 });
 const call=async(key,label,path,body,expected=201)=>
  (await client.call(sessions[key],label,path,expected,body)).value?.data;
 const balance=async()=>{
  const sum=await db.stockTransaction.aggregate({where:{companyId:f.companyId,materialId,uomId:source.each.id},_sum:{quantity:true}});
  return sum._sum.quantity?.toFixed(4)??'0.0000';
 };
 let primary,result,phase='LOGIN';
 try{
  for(const key of ['STORE_SITE','KHAIMOOK','FOREMAN'])
   sessions[key]=await client.login('UOM_IR_'+key,b.actors[key],f.companyId);
  demand(await balance()==='60.0000','UOM_IR_RECEIPT_BALANCE_CHANGED');
  phase='ISSUE_CREATE';
  const issueBody={projectId:f.projectId,warehouseId:f.warehouseId,issueDate:'2026-11-19',
   issuedToEmployeeId:b.actors.FOREMAN.employeeId,
   remarks:'New converted stock; independent checker required',
   lines:[{materialId,uomId:source.carton.id,quantity:'1.0000',remarks:null}]};
  await call('FOREMAN','UOM_IR_FOREMAN_ISSUE_DENIED','/inventory/material-issues',issueBody,403);
  const issue=await call('STORE_SITE','UOM_IR_CREATE','/inventory/material-issues',issueBody);
  const issuePath='/inventory/material-issues/'+issue.id;
  await call('STORE_SITE','UOM_IR_SUBMIT',issuePath+'/submit',{workflowCode:workflow.MATERIAL_ISSUE});
  const pin=await db.materialUomIssueSourcePin.findFirstOrThrow({where:{issueId:issue.id,materialId}});
  demand(pin.companyId===f.companyId&&pin.stockUomId===source.each.id&&
   fixed(pin.sourceQuantity)==='1.0000'&&fixed(pin.stockQuantity)==='20.0000'&&
   pin.numerator==='20'&&pin.businessDate.toISOString().slice(0,10)==='2026-11-19',
   'UOM_IR_ISSUE_SOURCE_PIN_CHANGED');
  await call('STORE_SITE','UOM_IR_MAKER_APPROVE_DENIED',issuePath+'/approve',{postKey:randomUUID()},403);
  phase='ISSUE_APPROVE';
  const issuePost={postKey:randomUUID(),comment:'Independent Khaimook approved unplanned synthetic issue'};
  await call('KHAIMOOK','UOM_IR_APPROVE',issuePath+'/approve',issuePost);
  await call('KHAIMOOK','UOM_IR_REPLAY',issuePath+'/approve',issuePost);
  demand(await balance()==='40.0000','UOM_IR_ISSUE_STOCK_NOT_40');
  const effect=await db.stockTransaction.findFirstOrThrow({where:{materialIssueId:issue.id,movementType:'MATERIAL_ISSUE'},
   include:{materialUomEffectPin:true}});
  demand(effect.uomId===source.each.id&&fixed(effect.quantity)==='-20.0000'&&
   effect.materialUomEffectPin?.numerator==='20'&&
   effect.materialUomEffectPin?.businessDate.toISOString().slice(0,10)==='2026-11-19',
   'UOM_IR_ISSUE_POSTING_OR_CONVERSION_INVALID');
  phase='RETURN_CREATE';
  const issueItem=await db.materialIssueItem.findFirstOrThrow({where:{materialIssueId:issue.id,materialId}});
  const body={projectId:f.projectId,warehouseId:f.warehouseId,returnDate:'2026-11-20',
   remarks:'Synthetic partial physical return with original conversion',
   lines:[{materialIssueItemId:issueItem.id,quantity:'0.5000',remarks:'Half carton returned'}]};
  await call('FOREMAN','UOM_IR_FOREMAN_RETURN_DENIED','/inventory/material-returns',body,403);
  const returned=await call('STORE_SITE','UOM_IR_RETURN_CREATE','/inventory/material-returns',body);
  const returnPath='/inventory/material-returns/'+returned.id;
  await call('STORE_SITE','UOM_IR_RETURN_SUBMIT',returnPath+'/submit',{workflowCode:workflow.MATERIAL_RETURN});
  await call('STORE_SITE','UOM_IR_RETURN_SELF_APPROVE_DENIED',returnPath+'/approve',{postKey:randomUUID()},403);
  phase='RETURN_APPROVE';
  const returnPost={postKey:randomUUID(),comment:'Independent Khaimook return posting'};
  await call('KHAIMOOK','UOM_IR_RETURN_APPROVE',returnPath+'/approve',returnPost);
  await call('KHAIMOOK','UOM_IR_RETURN_REPLAY',returnPath+'/approve',returnPost);
  demand(await balance()==='50.0000','UOM_IR_RETURN_STOCK_NOT_50');
  const returnedEffect=await db.stockTransaction.findFirstOrThrow({where:{materialReturnId:returned.id,movementType:'MATERIAL_RETURN'},
   include:{materialUomEffectPin:true}});
  demand(returnedEffect.uomId===source.each.id&&fixed(returnedEffect.quantity)==='10.0000'&&
   returnedEffect.materialUomEffectPin?.numerator==='20'&&
   returnedEffect.materialUomEffectPin?.sourceQuantity.toFixed(4)==='0.5000',
   'UOM_IR_RETURN_DID_NOT_USE_ORIGINAL_FACTOR');
  phase='REVERSALS';
  const returnReversal={reversalKey:randomUUID(),reason:'Synthetic return reversal before source issue'};
  await call('STORE_SITE','UOM_IR_REVERSE_RETURN',returnPath+'/reverse',returnReversal);
  await call('STORE_SITE','UOM_IR_REVERSE_RETURN_RETRY',returnPath+'/reverse',returnReversal);
  demand(await balance()==='40.0000','UOM_IR_REVERSED_RETURN_BALANCE');
  const issueReversal={reversalKey:randomUUID(),reason:'Synthetic issue reversal restores original converted stock'};
  await call('STORE_SITE','UOM_IR_REVERSE_ISSUE',issuePath+'/reverse',issueReversal);
  await call('STORE_SITE','UOM_IR_REVERSE_ISSUE_RETRY',issuePath+'/reverse',issueReversal);
  demand(await balance()==='60.0000','UOM_IR_FINAL_STOCK_NOT_60');
  const movements=await call('STORE_SITE','UOM_IR_MOVEMENT_READ',
   '/inventory/reports/movements?projectId='+f.projectId+'&materialId='+materialId,undefined,200);
  demand(movements.some(row=>row.sourceType==='GOODS_RECEIPT'&&row.quantity==='60.0000'&&row.conversion?.numerator==='20')&&
   movements.some(row=>row.sourceType==='MATERIAL_ISSUE'&&row.quantity==='-20.0000'&&row.conversion?.numerator==='20')&&
   movements.some(row=>row.sourceType==='MATERIAL_RETURN'&&row.quantity==='10.0000'),
   'UOM_IR_CANONICAL_MOVEMENT_REPORT_INCOMPLETE');
  assert.deepEqual(await db.materialUomIssueSourcePin.findFirstOrThrow({where:{issueId:issue.id,materialId}}),pin);
  const after=await db.stockTransaction.findMany({where:{companyId:f.companyId}});
  for(const old of before)assert.deepEqual(after.find(row=>row.id===old.id),old,'Previously posted stock row changed');
  demand(after.length===before.length+4,'UOM_IR_UNEXPECTED_STOCK_EFFECTS');
  assert.deepEqual(await db.materialUomReceiptSourcePin.findMany({where:{companyId:f.companyId,materialId}}),sourceBefore);
  assert.deepEqual(await db.document.findMany({where:{companyId:f.companyId}}),documents);
  assert.deepEqual(await db.subcontractCertification.findMany({where:{companyId:f.companyId}}),oldCert);
  assert.deepEqual(await db.transferReceipt.findMany(),oldTransfer);
  assert.deepEqual(await db.payment.findMany({where:{companyId:f.companyId}}),finance);
  result={convertedIssueReturnVerified:true,independentIssueAndReturnApprovalsVerified:true,
   originalConversionUsedOnReturn:true,issueAndReturnReversalVerified:true,
   sourceQuantity:'1.0000',issueStockQuantity:'20.0000',returnedStockQuantity:'10.0000',
   finalNewMaterialBalance:'60.0000',sessionRevocationVerified:true};
 }catch(e){primary=e;if(!e.safeCode)e.safeCode='UOM_IR_'+phase+'_FAILED';}
 finally{for(const [key,session]of Object.entries(sessions))try{
  await client.logout('UOM_IR_'+key,session);
  await client.call(session,'UOM_IR_'+key+'_REVOKED','/auth/me',401);
 }catch(e){primary??=e;}}
 if(primary)throw primary;
 return result;
}
