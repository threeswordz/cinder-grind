// Shared acceptance protocol, no provisioning or arbitrary target selection.
// Caller owns the origin, transport allowlist, isolated source and two actors.
const need=(ok,code)=>{if(!ok)throw Error('SS16_ACCEPTANCE_'+code);};
const routes=Object.freeze({GOODS_RECEIPT:'goods-receipts',MATERIAL_ISSUE:'material-issues',MATERIAL_RETURN:'material-returns',STOCK_TRANSFER:'stock-transfers'});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function acceptCorrection({call,maker,reviewer,kind,id,key,reason,blockedCode,verifyLegacy=false,registerDecision=()=>{}}){
 const makerId=maker?.userId??maker?.user?.id,reviewerId=reviewer?.userId??reviewer?.user?.id;
 need(typeof makerId==='string'&&makerId.length>0&&typeof reviewerId==='string'&&reviewerId.length>0&&makerId!==reviewerId&&Object.hasOwn(routes,kind)&&uuid.test(id)&&typeof key==='string'&&key.length>0&&key.length<=120&&typeof reason==='string'&&reason.trim()&&maker!==reviewer,'INPUT');
 const source='/inventory/'+routes[kind]+'/'+id;
 if(verifyLegacy){const legacy=await call(reviewer,'LEGACY_DENIED',source+'/reverse',409,{reversalKey:key,reason});
  need(legacy.code==='SS16_CORRECTION_APPROVAL_REQUIRED','LEGACY');}
 const path='/inventory/movement-corrections/sources/'+kind+'/'+id+'/requests',body={requestKey:key,reason};
 const created=(await call(maker,'CORRECTION_REQUEST',path,201,body)).data;
 need(uuid.test(created?.id??'')&&created.sourceId===id&&created.sourceKind===kind&&created.approvalInstance?.approvalState==='SUBMITTED','SOURCE');
 const replay=(await call(maker,'CORRECTION_REPLAY',path,201,body)).data;
 need(replay?.id===created.id,'REPLAY');
 const decision='/inventory/movement-corrections/'+created.id,comment={comment:'Independent acceptance decision'};
 const self={comment:'Self decision prohibited'};
 // A scoped transport may permit exactly this known request and payloads.
 registerDecision(decision+'/approve',self,comment);
 await call(maker,'CORRECTION_SELF_DENIED',decision+'/approve',403,self);
 const result=await call(reviewer,'CORRECTION_DECISION',decision+'/approve',blockedCode?409:201,comment);
 if(blockedCode){
   need(result.code===blockedCode,'CANONICAL_BLOCK');
   const history=(await call(reviewer,'CORRECTION_PENDING_HISTORY',path,200)).data.find(row=>row.id===created.id);
   need(history?.approvalInstance.approvalState==='SUBMITTED'&&history.approvalInstance.actions.length===0,'ROLLBACK');
   const rejection={comment:'Original source restriction confirmed'};
   registerDecision(decision+'/reject',rejection);
   const rejected=(await call(reviewer,'CORRECTION_REJECT',decision+'/reject',201,rejection)).data;
   need(rejected?.id===created.id&&rejected.approvalInstance?.approvalState==='REJECTED','REJECT');
 }else{
   need(result.data?.id===created.id&&result.data.approvalInstance?.approvalState==='APPROVED','APPROVAL');
   const duplicate=await call(reviewer,'CORRECTION_DECISION_REPLAY_DENIED',decision+'/approve',409,comment);
   need(duplicate.code==='SS16_DECISION_ALREADY_RECORDED','DECISION_REPLAY');
   const history=(await call(maker,'CORRECTION_HISTORY',path,200)).data.find(row=>row.id===created.id);
   need(history?.approvalInstance.approvalState==='APPROVED'&&history.approvalInstance.actions.length===1&&
    history.approvalInstance.actions[0].action==='APPROVE'&&
    history.approvalInstance.actions[0].comment===comment.comment&&
    history.approvalInstance.actions[0].actionByUserId===reviewerId,'HISTORY');
 }
 const read=await call(maker,'CORRECTION_SOURCE_READ',source,200);
 need(read.data?.id===id&&(blockedCode?!read.data.reversedAt:read.data.reversalKey==='ss16:'+created.id&&read.data.reversedAt),'OUTCOME');
 return read;
}
