// Test-only SS16 adapter for the disposable converted-UOM native journeys.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service';

type Actor={user:{id:string};role:{id:string;companyId:string;roleCode:string};session:{sessionToken:string;csrfToken:string}};
type Fixture={company:{id:string;companyCode:string;companyName:string};store:Actor;pm:Actor};
const kinds={
 GOODS_RECEIPT:{field:'goodsReceiptId',route:'goods-receipts',permission:'inventory.receipt',effect:'receipt-reversal:'},
 MATERIAL_ISSUE:{field:'materialIssueId',route:'material-issues',permission:'inventory.issue',effect:'material-issue-reversal:'},
 STOCK_TRANSFER:{field:'stockTransferId',route:'stock-transfers',permission:'inventory.transfer',effect:'stock-transfer-reversal:'},
} as const;
type Kind=keyof typeof kinds;

export async function prepareConvertedCorrectionFixture(db:PrismaService,f:Fixture,scope:readonly Kind[]){
 assert.match(f.company.companyCode,/^RC-[a-f0-9]{8}$/);
 assert.equal(f.company.companyName,'Synthetic receiving');
 assert.notEqual(f.store.user.id,f.pm.user.id);
 assert.notEqual(f.store.role.id,f.pm.role.id);
 assert.ok(scope.length);
 await db.$transaction(async tx=>{
  for(const [actor,original,roleCode,actions] of [
   [f.store,'Store','STOREKEEPER',['view','edit']],
   [f.pm,'Khaimook','PROJECT_MANAGER',['view','approve','reverse']],
  ] as const){
   const role=await tx.role.findUniqueOrThrow({where:{id:actor.role.id}});
   assert.equal(role.companyId,f.company.id);
   assert.equal(role.roleCode,original);
   const codes=[...new Set(scope.flatMap(k=>actions.map(a=>kinds[k].permission+'.'+a)))];
   const grants=await tx.permission.findMany({where:{permissionCode:{in:codes}}});
   assert.equal(grants.length,codes.length);
   await tx.role.update({where:{id:role.id},data:{roleCode}});
   await tx.rolePermission.createMany({data:grants.map(g=>({roleId:role.id,permissionId:g.id})),skipDuplicates:true});
  }
  await tx.approvalWorkflow.create({data:{companyId:f.company.id,workflowCode:'SS16_MOVEMENT_CORRECTION',entityType:'MOVEMENT_CORRECTION',workflowName:'Synthetic converted stock correction',
   steps:{create:[{stepNo:1,stepName:'Independent PM',requiredApprovals:1,stepRoles:{create:[{roleId:f.pm.role.id}]}}]}}});
 });
}

export async function proveConvertedCorrection(db:PrismaService,f:Fixture,base:string,kind:Kind,id:string,reason:string,blockedCode?:string){
 const url=new URL(base);
 assert.equal(url.protocol,'http:');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/api/v1');
 const k=kinds[kind],root='/inventory/movement-corrections',path=root+'/sources/'+kind+'/'+id+'/requests';
 const read=()=>db.stockTransaction.findMany({where:{companyId:f.company.id,[k.field]:id},include:{materialUomEffectPin:true},orderBy:{id:'asc'}});
 const before=await read();
 assert.ok(before.length>0);assert.ok(before.every(row=>row.reversalOfId===null));
 assert.ok(before.some(row=>row.materialUomEffectPin!==null));
 async function call(actor:Actor,path:string,status:number,body?:unknown,code?:string):Promise<any>{
  const response=await fetch(base+path,{redirect:'error',method:body===undefined?'GET':'POST',headers:{Cookie:'erp_session='+actor.session.sessionToken,'x-csrf-token':actor.session.csrfToken,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result:any=await response.json();
  assert.equal(response.status,status,path+' '+JSON.stringify(result));
  if(code)assert.equal(result.code,code);
  return result.data;
 }
 const payload={requestKey:randomUUID(),reason};
 await call(f.pm,'/inventory/'+k.route+'/'+id+'/reverse',409,{reversalKey:payload.requestKey,reason},'SS16_CORRECTION_APPROVAL_REQUIRED');
 const request=await call(f.store,path,201,payload);
 assert.equal(request.approvalInstance.approvalState,'SUBMITTED');
 assert.equal((await call(f.store,path,201,payload)).id,request.id);
 const approve=root+'/'+request.id+'/approve',comment='Independent converted stock correction';
 await call(f.store,approve,403,{comment:'Self decision denied'});
 assert.deepEqual(await read(),before);
 const history=async()=>{
  const rows=await call(f.pm,path,200);
  const row=rows.find((r:any)=>r.id===request.id);
  assert.ok(row);return row.approvalInstance;
 };
 if(blockedCode){
  await call(f.pm,approve,409,{comment},blockedCode);
  const pending=await history();
  assert.equal(pending.approvalState,'SUBMITTED');assert.equal(pending.actions.length,0);
  assert.deepEqual(await read(),before);
  const rejection='Outstanding physical custody';
  await call(f.pm,root+'/'+request.id+'/reject',201,{comment:rejection});
  const rejected=await history();
  assert.equal(rejected.approvalState,'REJECTED');assert.equal(rejected.actions.length,1);
  assert.equal(rejected.actions[0].action,'REJECT');assert.equal(rejected.actions[0].actionByUserId,f.pm.user.id);assert.equal(rejected.actions[0].comment,rejection);
  assert.deepEqual(await read(),before);
  return;
 }
 const decision=await call(f.pm,approve,201,{comment});
 assert.equal(decision.approvalInstance.approvalState,'APPROVED');
 assert.equal((await call(f.store,path,201,payload)).id,request.id);
 await call(f.pm,approve,409,{comment},'SS16_DECISION_ALREADY_RECORDED');
 const approved=await history();
 assert.equal(approved.approvalState,'APPROVED');assert.equal(approved.actions.length,1);
 assert.equal(approved.actions[0].action,'APPROVE');assert.equal(approved.actions[0].actionByUserId,f.pm.user.id);assert.equal(approved.actions[0].comment,comment);
 const after=await read();
 assert.equal(after.length,before.length*2);
 assert.deepEqual(after.filter(r=>r.reversalOfId===null),before);
 for(const original of before){
  const matches=after.filter(r=>r.reversalOfId===original.id);
  assert.equal(matches.length,1);
  const reversal=matches[0]!;
  assert.equal(reversal.quantity.toString(),original.quantity.negated().toString());
  assert.equal(reversal.effectKey,k.effect+original.id);
  assert.equal(reversal.postedByUserId,f.pm.user.id);
  for(const field of ['companyId','warehouseId','projectId','materialId','uomId','goodsReceiptId','goodsReceiptItemId','materialIssueId','materialIssueItemId','stockTransferId','stockTransferItemId','transferReceiptLineId','wbsId','costCodeId','activityId'] as const)assert.equal(reversal[field],original[field],field);
  const pin=original.materialUomEffectPin,reversePin=reversal.materialUomEffectPin;
  if(pin){
   assert.ok(reversePin);
   assert.equal(reversePin.stockTransactionId,reversal.id);
   assert.equal(reversePin.effectSign,-pin.effectSign);
   for(const field of ['companyId','materialId','sourceUomId','stockUomId','basisVersion','revisionId','numerator','denominator'] as const)assert.equal(reversePin[field],pin[field],field);
   assert.equal(reversePin.businessDate.toISOString(),pin.businessDate.toISOString());
   assert.equal(reversePin.sourceQuantity.toString(),pin.sourceQuantity.toString());
   assert.equal(reversePin.stockQuantity.toString(),pin.stockQuantity.toString());
  }else assert.equal(reversePin,null);
 }
}
