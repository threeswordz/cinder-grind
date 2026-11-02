import {UnprocessableEntityException} from '@nestjs/common';
export const MP_VIEW='inventory.material_plan.view';
export const mpInvalid=(field:string):never=>{throw new UnprocessableEntityException({code:'MATERIAL_PLAN_INPUT_INVALID',errors:[{field,message:'Invalid material plan value.'}]});};
export function mpObject(value:unknown,keys:string[]){
 if(!value||typeof value!=='object'||Array.isArray(value))return mpInvalid('body');
 const r=value as Record<string,unknown>;if(Object.keys(r).some(k=>!keys.includes(k)))return mpInvalid('body');return r;
}
export function mpId(v:unknown,field='id'){if(typeof v!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v))return mpInvalid(field);return v.toLowerCase();}
export function mpText(v:unknown,field:string,max=2000){if(typeof v!=='string'||!v.trim()||v.trim().length>max||/[\u0000-\u001f\u007f]/.test(v))return mpInvalid(field);return v.trim();}
export function mpVersion(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<1||v>=2147483647)return mpInvalid('expectedVersion');return v;}
export function mpDate(v:unknown,field:string){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v.startsWith('0000')||!Number.isFinite(Date.parse(v+'T00:00:00.000Z'))||new Date(v+'T00:00:00.000Z').toISOString().slice(0,10)!==v)return mpInvalid(field);return v;}
export function mpQuantity(v:unknown){if(typeof v!=='string'||! /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(v)||/^0(?:\.0+)?$/.test(v))return mpInvalid('quantity');const [a,b='']=v.split('.');return a+'.'+b.padEnd(4,'0');}
export function mpContent(r:Record<string,unknown>){
 const validFrom=mpDate(r.validFrom,'validFrom'),validTo=mpDate(r.validTo,'validTo');if(validTo<validFrom)return mpInvalid('validTo');
 if(!Array.isArray(r.lines)||r.lines.length<1||r.lines.length>100)return mpInvalid('lines');
 const lines=r.lines.map(value=>{const l=mpObject(value,['budgetRevisionLineId','materialId','uomId','quantity']);return {budgetRevisionLineId:mpId(l.budgetRevisionLineId,'budgetRevisionLineId'),materialId:mpId(l.materialId,'materialId'),uomId:mpId(l.uomId,'uomId'),quantity:mpQuantity(l.quantity)};}).sort((a,b)=>a.budgetRevisionLineId.localeCompare(b.budgetRevisionLineId));
 if(new Set(lines.map(l=>l.budgetRevisionLineId)).size!==lines.length)return mpInvalid('lines');
 return {validFrom,validTo,reason:mpText(r.reason,'reason'),lines};
}
export function mpCreate(v:unknown){const r=mpObject(v,['requestKey','projectId','warehouseId','budgetRevisionId','workPackageCode','validFrom','validTo','reason','lines']);return {requestKey:mpId(r.requestKey,'requestKey'),projectId:mpId(r.projectId,'projectId'),warehouseId:mpId(r.warehouseId,'warehouseId'),budgetRevisionId:mpId(r.budgetRevisionId,'budgetRevisionId'),workPackageCode:mpText(r.workPackageCode,'workPackageCode',80),...mpContent(r)};}
export function mpRevise(v:unknown){const r=mpObject(v,['requestKey','expectedVersion','validFrom','validTo','reason','lines']);return {requestKey:mpId(r.requestKey,'requestKey'),expectedVersion:mpVersion(r.expectedVersion),...mpContent(r)};}
export function mpAction(v:unknown,decision=false){const r=mpObject(v,['requestKey','expectedVersion',...(decision?['decision','comment']:[])]);if(decision&&!['APPROVE','REJECT'].includes(String(r.decision)))return mpInvalid('decision');return {requestKey:mpId(r.requestKey,'requestKey'),expectedVersion:mpVersion(r.expectedVersion),...(decision?{decision:r.decision as 'APPROVE'|'REJECT',comment:mpText(r.comment,'comment')}: {})};}
export type MPContent=ReturnType<typeof mpContent>;
