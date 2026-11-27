import assert from 'node:assert/strict';
import test, {type TestContext} from 'node:test';
import type {PrismaService} from '../prisma/prisma.service';
import {proveConvertedCorrection} from './m6-parallel-03-ss16-native-proof';

const actor=(id:string)=>({user:{id},role:{id:'role-'+id,companyId:'company',roleCode:id},session:{sessionToken:id,csrfToken:id+'-csrf'}});
const f={company:{id:'company',companyCode:'RC-00000001',companyName:'Synthetic receiving'},store:actor('store'),pm:actor('pm')};
const base='http://127.0.0.1:31001/api/v1',id='return-id',rid='correction-id',reason='Original partial return';
const root=base+'/inventory/movement-corrections',path=root+'/sources/MATERIAL_RETURN/'+id+'/requests';
class Decimal {
 constructor(readonly value:number){}
 toString(){return String(this.value);}
 negated(){return new Decimal(-this.value);}
}
function fixture(t:TestContext,mode:'success'|'blocked'|'wrong-code'|'wrong-source'|'wrong-pin'|'wrong-item'|'wrong-type'|'mutated-original'){
 const date=new Date('2026-11-19T00:00:00Z');
 const pin={stockTransactionId:'original',effectSign:1,companyId:'company',materialId:'material',sourceUomId:'BOX',stockUomId:'EA',basisVersion:1,revisionId:'original-rate',numerator:'22',denominator:'1',businessDate:date,sourceQuantity:new Decimal(0.5),stockQuantity:new Decimal(11)};
 const original={id:'original',companyId:'company',materialId:'material',warehouseId:'warehouse',projectId:'project',uomId:'EA',materialReturnId:id,materialReturnItemId:'line',reversalOfId:null,movementType:'MATERIAL_RETURN',quantity:new Decimal(11),materialUomEffectPin:pin};
 const reversal={...original,id:'compensation',reversalOfId:original.id,movementType:'MATERIAL_RETURN_REVERSAL',effectKey:'material-return-reversal:original',postedByUserId:'pm',quantity:new Decimal(-11),materialUomEffectPin:{...pin,stockTransactionId:'compensation',effectSign:-1}};
 const db={stockTransaction:{findMany:async(q:unknown)=>{assert.deepEqual(q,{where:{companyId:'company',materialReturnId:id},include:{materialUomEffectPin:true},orderBy:{id:'asc'}});return rows;}}} as unknown as PrismaService;
 let rows:Array<typeof original|typeof reversal>=[original],state='SUBMITTED',actions:unknown[]=[],calls=0,firstPayload:unknown;
 const row=()=>({id:rid,sourceId:mode==='wrong-source'?'foreign':id,sourceKind:'MATERIAL_RETURN',companyId:'company',requestedByUserId:'store',reason,approvalInstance:{approvalState:state,actions}});
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status});
 t.mock.method(globalThis,'fetch',async(input:string|URL|Request,init?:RequestInit)=>{
  calls++;
  const url=String(input),headers=new Headers(init?.headers),who=headers.get('Cookie');
  const body=init?.body?JSON.parse(String(init.body)):undefined;
  assert.equal(init?.redirect,'error');
  assert.equal(headers.get('x-csrf-token'),who==='erp_session=store'?'store-csrf':'pm-csrf');
  if(url===base+'/inventory/material-returns/'+id+'/reverse'){
   assert.equal(who,'erp_session=pm');return reply(409,{code:'SS16_CORRECTION_APPROVAL_REQUIRED'});
  }
  if(url===path&&init?.method==='POST'){
   assert.equal(who,'erp_session=store');assert.equal(body.reason,reason);
   if(firstPayload===undefined)firstPayload=body;else assert.deepEqual(body,firstPayload);
   return reply(201,{data:row()});
  }
  if(url===path&&init?.method==='GET'){
   assert.equal(who,'erp_session=pm');return reply(200,{data:[row()]});
  }
  if(url===root+'/'+rid+'/approve'){
   if(who==='erp_session=store')return reply(403,{code:'SS16_ACTOR_DENIED'});
   assert.equal(who,'erp_session=pm');
   if(state==='APPROVED')return reply(409,{code:'SS16_DECISION_ALREADY_RECORDED'});
   if(mode==='blocked'||mode==='wrong-code')return reply(409,{code:mode==='blocked'?'MATERIAL_RETURN_REVERSAL_INSUFFICIENT_AVAILABLE':'UNRELATED_CONFLICT'});
   state='APPROVED';actions=[{action:'APPROVE',actionByUserId:'pm',comment:body.comment}];
   if(mode==='wrong-pin')reversal.materialUomEffectPin.revisionId='new-rate';
   if(mode==='wrong-item')reversal.materialReturnItemId='other-line';
   if(mode==='wrong-type')reversal.movementType='MATERIAL_ISSUE_REVERSAL';
   rows=[reversal,mode==='mutated-original'?{...original,warehouseId:'different'}:original];
   return reply(201,{data:row()});
  }
  if(url===root+'/'+rid+'/reject'){
   assert.equal(who,'erp_session=pm');state='REJECTED';actions=[{action:'REJECT',actionByUserId:'pm',comment:body.comment}];
   return reply(201,{data:row()});
  }
  throw new Error('Unexpected request '+url);
 });
 return {db,calls:()=>calls};
}
for(const mode of ['success','blocked'] as const)test('converted return '+mode+' traverses independent SS16 protocol',async t=>{
 const x=fixture(t,mode);
 await proveConvertedCorrection(x.db,f,base,'MATERIAL_RETURN',id,reason,mode==='blocked'?'MATERIAL_RETURN_REVERSAL_INSUFFICIENT_AVAILABLE':undefined);
 assert.equal(x.calls(),mode==='success'?8:8);
});
for(const mode of ['wrong-code','wrong-source','wrong-pin','wrong-item','wrong-type','mutated-original'] as const)test('converted return rejects '+mode,async t=>{
 const x=fixture(t,mode);
 await assert.rejects(proveConvertedCorrection(x.db,f,base,'MATERIAL_RETURN',id,reason,mode==='wrong-code'?'MATERIAL_RETURN_REVERSAL_INSUFFICIENT_AVAILABLE':undefined));
});
