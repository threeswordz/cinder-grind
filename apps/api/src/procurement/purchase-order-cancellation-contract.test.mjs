import assert from 'node:assert/strict';
import test from 'node:test';
import {planPur10Decision,assertPur10ReadyToCancel,Pur10PolicyError} from './purchase-order-cancellation-contract.ts';
const order={id:'po-1',companyId:'mke',projectId:'site-a',poNumber:'PO2611-005',revisionNo:2,updatedAt:'2026-11-23T15:00:00Z',configuredJaiUserId:'jai',configuredKhaimookUserId:'khaimook',configuredBenUserId:'ben',isLatestRevision:true,isCancelled:false,isRejected:false};
const actor=(userId,role,permissions)=>({userId,companyId:'mke',roleCodes:[role],permissions,sessionActive:true,employeeActive:true});
const jai=actor('jai','PROCUREMENT_OFFICER',['procurement.po.create']);
const pm=actor('khaimook','PROJECT_MANAGER',['procurement.po.view']);
const ben=actor('ben','MANAGEMENT',['procurement.po.approve']);
const base={order,projectAuthorized:true,note:'Cancel remaining supplier quantity by agreement.'};
const decide=(action,a,current,expectedVersion=current?.version??0,override={})=>planPur10Decision({...base,action,actor:a,current,expectedVersion,...override});
const c=(next,prev=null)=>({caseId:'case1',companyId:order.companyId,projectId:order.projectId,orderId:order.id,poNumber:order.poNumber,revisionNo:order.revisionNo,orderUpdatedAt:order.updatedAt,makerUserId:next.makerUserId,pmUserId:next.pmUserId,benUserId:next.benUserId,version:next.version,status:next.nextStatus});
const noRisk={postedUnreversedReceipt:false,approvedInvoiceSource:false,supplierRefusesCancellation:false,depositOrPenaltyUnresolved:false,partialDeliveryOrInvoice:false};
const err=(f,code)=>assert.throws(f,e=>e instanceof Pur10PolicyError && e.code===code,code);
test('PUR10 Jai → independent Khaimook → independent Ben is nonposting until separate atomic cancellation',()=>{
 const proposed=decide('PROPOSE',jai,null);assert.deepEqual([proposed.nextStatus,proposed.effect,proposed.version],['PM_PENDING','NO_PO_CHANGE',1]);
 const pmReview=decide('PM_FORWARD',pm,c(proposed));assert.deepEqual([pmReview.nextStatus,pmReview.version],['BEN_PENDING',2]);
 const approved=decide('BEN_APPROVE',ben,c(pmReview));assert.deepEqual([approved.nextStatus,approved.effect,approved.version],['BEN_APPROVED','NO_PO_CHANGE',3]);
 assert.doesNotThrow(()=>assertPur10ReadyToCancel(c(approved),order,noRisk));
});
test('PUR10 wrong actor / stale version / cross-Company & Project / self-approval denied',()=>{
 const proposed=c(decide('PROPOSE',jai,null));
 err(()=>decide('PROPOSE',jai,proposed), 'PUR10_ACTIVE_PROPOSAL_OR_STALE_VERSION');
 err(()=>decide('PM_FORWARD',jai,proposed), 'PUR10_SELF_REVIEW_DENIED');
 err(()=>decide('PM_FORWARD',pm,proposed,0),'PUR10_STALE_OR_CHANGED_SOURCE');
 err(()=>decide('PM_FORWARD',{...pm,companyId:'tcj'},proposed),'PUR10_CURRENT_ROLE_AND_PERMISSION_REQUIRED');
 err(()=>decide('PM_FORWARD',pm,proposed,1,{projectAuthorized:false}),'PUR10_PROJECT_SCOPE_DENIED');
 err(()=>decide('PM_FORWARD',pm,proposed,1,{order:{...order,updatedAt:'changed'}}),'PUR10_STALE_OR_CHANGED_SOURCE');
 err(()=>decide('PM_FORWARD',{...pm,employeeActive:false},proposed),'PUR10_CURRENT_ROLE_AND_PERMISSION_REQUIRED');
 err(()=>decide('PM_FORWARD',{...pm,userId:'another-manager'},proposed),'PUR10_NAMED_PM_REQUIRED');
 const next=c(decide('PM_FORWARD',pm,proposed));
 err(()=>decide('BEN_APPROVE',pm,next),'PUR10_CURRENT_ROLE_AND_PERMISSION_REQUIRED');
 err(()=>decide('BEN_APPROVE',{...ben,userId:'khaimook'},next),'PUR10_NAMED_BEN_REQUIRED');
 err(()=>decide('BEN_APPROVE',{...ben,sessionActive:false},next),'PUR10_CURRENT_ROLE_AND_PERMISSION_REQUIRED');
});
test('PUR10 rejects terminal, malformed, stale, unauthorized or exception paths',()=>{
 const proposed=c(decide('PROPOSE',jai,null));
 const returned=c(decide('PM_RETURN',pm,proposed));
 err(()=>decide('BEN_APPROVE',ben,returned),'PUR10_INDEPENDENT_BEN_STAGE_REQUIRED');
 err(()=>decide('PM_FORWARD',pm,returned),'PUR10_PM_STAGE_INVALID');
 err(()=>decide('PROPOSE',jai,null,0,{note:' ' }),'PUR10_REASON_OR_NOTE_REQUIRED');
 err(()=>decide('PROPOSE',jai,null,0,{order:{...order,isLatestRevision:false}}),'PUR10_ACTIVE_LATEST_PO_REQUIRED');
 err(()=>decide('PROPOSE',jai,null,0,{order:{...order,isCancelled:true}}),'PUR10_ACTIVE_LATEST_PO_REQUIRED');
 err(()=>decide('PROPOSE',jai,null,0,{actor:actor('store','STOREKEEPER',['procurement.po.create'])}),'PUR10_CURRENT_ROLE_AND_PERMISSION_REQUIRED');
 const pmReview=c(decide('PM_FORWARD',pm,proposed));
 const approved=c(decide('BEN_APPROVE',ben,pmReview));
 for(const key of Object.keys(noRisk)){err(()=>assertPur10ReadyToCancel(approved,order,{...noRisk,[key]:true}),key.includes('Receipt')||key.includes('InvoiceSource')?'PUR10_RECEIPT_OR_FINANCE_SOURCE_LOCKED':'PUR10_OWNER_AND_FINANCE_EXCEPTION_DECISION_REQUIRED');}
 err(()=>assertPur10ReadyToCancel(pmReview,order,noRisk),'PUR10_THREE_INDEPENDENT_DECISIONS_REQUIRED');
 err(()=>assertPur10ReadyToCancel(approved,{...order,updatedAt:'later'},noRisk),'PUR10_SOURCE_CHANGED_SINCE_REVIEW');
});
