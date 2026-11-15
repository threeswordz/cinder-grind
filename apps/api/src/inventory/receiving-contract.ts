import {UnprocessableEntityException} from '@nestjs/common';
import {inventoryUuid} from './inventory-validation';

export const RECEIVING='inventory.receiving.';
export const receivingCapabilities=['view','capture','edit','link_po','check','configure'] as const;
export const receivingConditions=['NORMAL','SHORT','EXCESS','WRONG','DAMAGED'] as const;
export const receivingPurposes=['DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO','QUALITY_RESULT'] as const;
export function receivingInvalid(field='input'):never {throw new UnprocessableEntityException({code:'RECEIVING_INPUT_INVALID',field});}
function object(v:unknown,keys:string[]){
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))receivingInvalid();
 return v as Record<string,unknown>;
}
function text(v:unknown,max=10000){if(typeof v!=='string'||!v.trim()||v.length>max)receivingInvalid();return v.trim();}
function bool(v:unknown){if(typeof v!=='boolean')receivingInvalid();return v;}
export function receivingVersion(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<1||v>2147483646)receivingInvalid('expectedVersion');return v;}
export function receivingQuantity(v:unknown,zero=false){
 if(typeof v!=='string'||!/^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$/.test(v))receivingInvalid('quantity');
 const [whole,fraction='']=v.split('.'),units=BigInt(whole!)*10000n+BigInt(fraction.padEnd(4,'0'));
 if((!zero&&units===0n)||units>999999999999999999n)receivingInvalid('quantity');
 return whole+'.'+fraction.padEnd(4,'0');
}
function quantities(r:Record<string,unknown>){
 const observedQuantity=receivingQuantity(r.observedQuantity),goodQuantity=receivingQuantity(r.goodQuantity,true);
 if(BigInt(goodQuantity.replace('.',''))>BigInt(observedQuantity.replace('.','')))receivingInvalid('goodQuantity');
 if(!receivingConditions.includes(r.condition as typeof receivingConditions[number]))receivingInvalid('condition');
 if(r.condition==='NORMAL'&&goodQuantity!==observedQuantity)receivingInvalid('condition');
 return {observedQuantity,goodQuantity,condition:r.condition as typeof receivingConditions[number],note:text(r.note,2000)};
}
function array(v:unknown){if(!Array.isArray(v)||!v.length||v.length>100)receivingInvalid('lines');return v as unknown[];}
export function receivingCapture(v:unknown){
 const r=object(v,['requestKey','projectId','warehouseId','supplierId','receivedAt','receiverName','reason','qualityRequired','lines','supersedesId']);
 if(typeof r.receivedAt!=='string'||!Number.isFinite(Date.parse(r.receivedAt))||new Date(r.receivedAt).toISOString()!==r.receivedAt)receivingInvalid('receivedAt');
 const lines=array(r.lines).map(x=>{const l=object(x,['materialId','uomId','observedQuantity','goodQuantity','condition','note']);return {materialId:inventoryUuid(l.materialId,'materialId'),uomId:inventoryUuid(l.uomId,'uomId'),...quantities(l)};});
 return {requestKey:inventoryUuid(r.requestKey,'requestKey'),projectId:inventoryUuid(r.projectId,'projectId'),warehouseId:inventoryUuid(r.warehouseId,'warehouseId'),supplierId:inventoryUuid(r.supplierId,'supplierId'),receivedAt:r.receivedAt,receiverName:text(r.receiverName,200),reason:text(r.reason),qualityRequired:bool(r.qualityRequired),lines,supersedesId:r.supersedesId==null?null:inventoryUuid(r.supersedesId,'supersedesId')};
}
export function receivingAction(v:unknown){const r=object(v,['requestKey','expectedVersion','reason']);return {requestKey:inventoryUuid(r.requestKey,'requestKey'),expectedVersion:receivingVersion(r.expectedVersion),reason:text(r.reason)};}
export function receivingRevise(v:unknown){
 const r=object(v,['requestKey','expectedVersion','reason','receiverName','qualityRequired','lines']);
 const lines=array(r.lines).map(x=>{const l=object(x,['id','observedQuantity','goodQuantity','condition','note']);return {id:inventoryUuid(l.id,'id'),...quantities(l)};});
 if(new Set(lines.map(l=>l.id)).size!==lines.length)receivingInvalid('lines');
 return {requestKey:inventoryUuid(r.requestKey,'requestKey'),expectedVersion:receivingVersion(r.expectedVersion),reason:text(r.reason),receiverName:text(r.receiverName,200),qualityRequired:bool(r.qualityRequired),lines};
}
export function receivingLink(v:unknown){
 const r=object(v,['requestKey','expectedVersion','reason','purchaseOrderId','lines']);
 const lines=array(r.lines).map(x=>{const l=object(x,['id','purchaseOrderLineId']);return {id:inventoryUuid(l.id,'id'),purchaseOrderLineId:l.purchaseOrderLineId==null?null:inventoryUuid(l.purchaseOrderLineId,'purchaseOrderLineId')};});
 if(new Set(lines.map(l=>l.id)).size!==lines.length)receivingInvalid('lines');
 const ids=lines.flatMap(l=>l.purchaseOrderLineId?[l.purchaseOrderLineId]:[]);if(new Set(ids).size!==ids.length)receivingInvalid('lines');
 return {requestKey:inventoryUuid(r.requestKey,'requestKey'),expectedVersion:receivingVersion(r.expectedVersion),reason:text(r.reason),purchaseOrderId:inventoryUuid(r.purchaseOrderId,'purchaseOrderId'),lines};
}
export function receivingEvidence(v:unknown){
 const r=object(v,['requestKey','expectedVersion','reason','documentId','purpose','signedEvidenceConfirmed','supersedesId']);
 if(!receivingPurposes.includes(r.purpose as typeof receivingPurposes[number])||r.purpose==='RECEIVER_SIGNATURE'&&r.signedEvidenceConfirmed!==true)receivingInvalid('purpose');
 return {requestKey:inventoryUuid(r.requestKey,'requestKey'),expectedVersion:receivingVersion(r.expectedVersion),reason:text(r.reason),documentId:inventoryUuid(r.documentId,'documentId'),purpose:r.purpose as typeof receivingPurposes[number],signedEvidenceConfirmed:r.signedEvidenceConfirmed===true,supersedesId:r.supersedesId==null?null:inventoryUuid(r.supersedesId,'supersedesId')};
}
export function receivingCheck(v:unknown){const r=object(v,['requestKey','expectedVersion','reason','decision']);if(r.decision!=='ACCEPT'&&r.decision!=='RETURN')receivingInvalid('decision');return {requestKey:inventoryUuid(r.requestKey,'requestKey'),expectedVersion:receivingVersion(r.expectedVersion),reason:text(r.reason),decision:r.decision as 'ACCEPT'|'RETURN'};}
export function receivingEnable(v:unknown){const r=object(v,['requestKey','reason']);return {requestKey:inventoryUuid(r.requestKey,'requestKey'),reason:text(r.reason)};}
export function receivingDue(receivedAt:Date){return new Date(receivedAt.getTime()+48*60*60*1000);}
export function receivingDeadline(due:Date,linked:Date|null,now=new Date()){
 return linked?(linked>due?'LINKED_LATE':'LINKED_ON_TIME'):now>due?'OVERDUE':'DUE';
}
export type ReceivingCapture=ReturnType<typeof receivingCapture>;
