import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { freezeSubmittedReceiptSources, assertReceiptSourcePostingReady } from './material-uom-receipt-source';
import { AuthenticatedUserContext } from '../auth/auth.types';

const companyId='company', materialId='material', stockUomId='each', sourceUomId='carton';
const permission='inventory.receipt.submit';
const auth={companyId,userId:'store',sessionId:'session',permissions:[permission]} as unknown as AuthenticatedUserContext;
const receipt={id:'gr',companyId,projectId:'project',items:[{id:'item',materialId,uomId:sourceUomId,quantity:new Prisma.Decimal(2)}]};
function context(allowed=true,existing=false){
  const saved: any[]=[];
  const tx={
    userSession:{findFirst:async()=>allowed?{user:{employee:{companyId,isActive:true},userRoles:[{companyId,role:{companyId,isActive:true,roleCode:'STORE',rolePermissions:[{permission:{permissionCode:permission}}]}}]}}:null},
    $executeRaw:async()=>0,
    material:{findFirst:async()=>({id:materialId})},
    materialUomBasis:{findUnique:async()=>({companyId,stockUomId,stockPrecision:0,version:2})},
    unitOfMeasure:{findFirst:async()=>({decimalPlaces:0})},
    materialUomRevision:{findFirst:async()=>({id:'revision',sourcePrecision:0,numerator:'20',denominator:'1'})},
    materialUomReceiptSourcePin:{create:async({data}:any)=>{saved.push(data);return data;},findFirst:async()=>existing?{receiptItemId:'item'}:null},
  };
  return {tx:tx as unknown as Prisma.TransactionClient,saved};
}
test('receipt submission source freeze preserves commercial quantity and selects explicit dated normalized quantity',async()=>{
 const {tx,saved}=context();
 await freezeSubmittedReceiptSources(tx,auth,receipt,'2026-11-19');
 assert.equal(saved.length,1);
 assert.equal(saved[0].sourceQuantity.toString(),'2');
 assert.equal(saved[0].stockQuantity.toString(),'40');
 assert.equal(saved[0].receiptId,receipt.id);
 assert.equal(saved[0].receiptItemId,receipt.items[0]!.id);
 assert.equal(saved[0].businessDate.toISOString(),'2026-11-19T00:00:00.000Z');
 assert.equal(saved[0].revisionId,'revision');
 assert.equal(saved[0].effectSign,undefined);
});
test('receipt source freeze rejects inactive authority, foreign company and inferred date',async()=>{
 for(const [ctx,actor,fact,date] of [[context(false),auth,receipt,'2026-11-19'],[context(),auth,{...receipt,companyId:'other'},'2026-11-19'],[context(),auth,receipt,'']] as const){
  await assert.rejects(()=>freezeSubmittedReceiptSources(ctx.tx,actor,fact,date));
  assert.deepEqual(ctx.saved,[]);
 }
});
test('posting remains denied for a frozen source, while an unpinned receipt follows the old path',async()=>{
 await assertReceiptSourcePostingReady(context().tx,companyId,receipt.id);
 await assert.rejects(()=>assertReceiptSourcePostingReady(context(true,true).tx,companyId,receipt.id));
});
