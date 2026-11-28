// Native caller supplies captured complete 174-table hash census and the actual
// canonical audit rows. Never writes DB or treats HTTP success as preservation.
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_SUPPLIER_DELTA_'+c),{safeCode:'M6_SUPPLIER_DELTA_'+c});};
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const sort=x=>[...x].sort(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const contract=[['JAI','ACKNOWLEDGE','ACKNOWLEDGED','ackDocumentId'],['JAI','CONFIRM_IN_TRANSIT','IN_TRANSIT','transitDocumentId'],['JAI','REPORT_DELAY','DELAY_REPORTED','delayDocumentId'],['STORE_SITE','REPORT_DISCREPANCY','DISCREPANCY_REPORTED','conditionDocumentId'],['KHAIMOOK','PM_REVIEW_DISCREPANCY','PM_REVIEWED','conditionDocumentId'],['JAI','JAI_RECORD_CLAIM','CLAIM_RECORDED','conditionDocumentId'],['STORE_SITE','STORE_RECORD_RETURN_DISPATCH','RETURN_DISPATCH_RECORDED','handoverDocumentId']];
export function verifySupplierAuditDelta({before,after,events,rows,binding:b}){
 const keys=sort(Object.keys(before??{}));need(keys.length===174&&keys.includes('audit_logs')&&keys.includes('user_sessions')&&same(keys,sort(Object.keys(after??{})))&&Array.isArray(events)&&Array.isArray(rows)&&events.length===7&&rows.length===7,'CENSUS');
 const actors={JAI:b?.jaiUserId,STORE_SITE:b?.storeUserId,KHAIMOOK:b?.pmUserId};need([b?.companyId,b?.projectId,b?.orderId,...Object.values(actors)].every(uuid)&&new Set(Object.values(actors)).size===3,'SCOPE');
 need(events.every(e=>uuid(e.id))&&new Set(events.map(e=>e.id)).size===7&&rows.every(r=>hex(r.hash)&&uuid(r.id))&&new Set(rows.map(r=>r.hash)).size===7&&new Set(rows.map(r=>r.id)).size===7,'IDENTITY');
 for(let i=0;i<contract.length;i++){
  const [actor,action,stage,doc]=contract[i],e=events[i],r=rows.find(x=>x.id===e.id),v=r?.newValues,s=v?.state,previous=i?events[i-1].id:null;
  need(e.actor===actor&&e.action===action&&e.stage===stage&&e.evidenceDocumentId===b[doc]&&uuid(b[doc])&&e.previousEventId===previous,'EVENT');
  need(r?.companyId===b.companyId&&r.entityType==='SUPPLIER_DELIVERY_CASE'&&r.entityId===b.orderId&&r.action===action&&r.actorUserId===actors[actor]&&v?.actorUserId===actors[actor]&&v.previousEventId===previous&&v.evidenceDocumentId===b[doc]&&v.reportedOnly===true&&v.effect==='NO_PO_GR_STOCK_FINANCE_MUTATION','AUDIT');
  need(s?.companyId===b.companyId&&s.projectId===b.projectId&&s.purchaseOrderId===b.orderId&&s.revisionId===b.orderId&&s.stage===stage&&s.version===i+1,'STATE');
  if(i===0)need(v.referencedPur07AcknowledgmentEventId===b.ackEventId&&uuid(b.ackEventId),'ACK_SOURCE');
  if(i===2)need(v.newSupplierExpectedDate===b.revisedDate,'DELAY_SOURCE');
  if(i>=3)need(s.discrepancyKind==='DAMAGED'&&s.storeReporterId===actors.STORE_SITE,'REPORT_SOURCE');
  if(i>=4)need(s.pmDecision==='REQUEST_RETURN'&&s.pmReviewerId===actors.KHAIMOOK,'PM_SOURCE');
  if(i>=5)need(s.jaiClaimerId===actors.JAI,'CLAIM_SOURCE');
  if(i===6){const t=v.returnCustodyTrace;need(v.originalReceivingDeliveryLineId===b.originalDeliveryLineId&&t?.originalDeliveryId===b.originalDeliveryId&&t.originalDeliveryLineId===b.originalDeliveryLineId&&t.signedHandoverDocumentId===b.handoverDocumentId&&t.signedHandoverChecksum===b.handoverChecksum&&t.returnType==='UNPOSTED_DAMAGED_CUSTODY_ONLY'&&t.stockEffect===false&&t.financeEffect===false,'RETURN_SOURCE');}
 }
 for(const key of keys){const old=before[key],next=after[key],added=key==='audit_logs'?rows.map(r=>r.hash):[];need(Array.isArray(old)&&Array.isArray(next)&&old.every(hex)&&next.every(hex)&&new Set([...old,...added]).size===old.length+added.length&&same(sort([...old,...added]),sort(next)),'UNEXPECTED_DELTA');}
 return true;
}
