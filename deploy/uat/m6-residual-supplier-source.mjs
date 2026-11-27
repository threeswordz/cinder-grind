// Source-bound synthetic PUR07 preparation. Never sends supplier communications.
import {createHash} from 'node:crypto';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_SUPPLIER_SOURCE_'+c),{safeCode:'M6_SUPPLIER_SOURCE_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const supplierSourceDigest=x=>hash(JSON.stringify(x));
function units(x){need(typeof x==='string'&&/^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(x),'QUANTITY');const [a,b='']=x.split('.');return BigInt(a)*10000n+BigInt(b.padEnd(4,'0'));}
const format=n=>String(n/10000n)+'.'+String(n%10000n).padStart(4,'0');
export function planResidualSupplierSources({binding:b,order,delivery,lines,evidence,dispatchEvents,roster,documentType,artifacts}){
 const ids=['companyId','projectId','orderId','deliveryId'];need(b&&ids.every(k=>uuid(b[k]))&&new Set(ids.map(k=>b[k])).size===4,'BINDING');
 const scoped=r=>r?.companyId===b.companyId&&r.projectId===b.projectId;
 need(scoped(order)&&order.id===b.orderId&&order.approvalInstance?.approvalState==='APPROVED'&&!order.cancelledAt&&!order.nextRevision&&uuid(order.supplierId),'ORDER');
 need(scoped(delivery)&&delivery.id===b.deliveryId&&delivery.purchaseOrderId===order.id&&delivery.supplierId===order.supplierId&&delivery.status==='CHECKED'&&Number.isFinite(Date.parse(delivery.checkedAt))&&!delivery.replacement,'DELIVERY');
 need(Array.isArray(lines)&&lines.length===1,'LINE_CENSUS');const l=lines[0],p=l.purchaseOrderLine;
 need(uuid(l.id)&&l.deliveryId===delivery.id&&l.condition==='DAMAGED'&&uuid(l.purchaseOrderLineId)&&p?.id===l.purchaseOrderLineId&&p.purchaseOrderId===order.id&&p.lineType==='MATERIAL'&&p.materialId===l.materialId&&p.uomId===l.uomId&&uuid(l.materialId)&&uuid(l.uomId),'LINE');
 const observed=units(l.observedQuantity),good=units(l.goodQuantity);need(observed===units(b.observed)&&good===units(b.good)&&observed>good,'HELD');
 const photos=evidence.filter(e=>e.purpose==='CONDITION_PHOTO'&&!e.replacement);need(photos.length===1,'PHOTO_CENSUS');const photo=photos[0],doc=photo.document;
 need(photo.companyId===b.companyId&&photo.deliveryId===delivery.id&&uuid(photo.documentId)&&doc?.id===photo.documentId&&doc.companyId===b.companyId&&doc.isActive===true&&hex(photo.checksum)&&doc.checksum===photo.checksum&&doc.links.some(x=>x.entityType==='PROJECT'&&x.entityId===b.projectId)&&doc.links.some(x=>x.entityType==='RECEIVING_DELIVERY'&&x.entityId===delivery.id),'PHOTO');
 need(Array.isArray(dispatchEvents)&&dispatchEvents.length<=2&&dispatchEvents.every(e=>uuid(e.id)&&scoped(e)&&e.purchaseOrderId===order.id&&['DISPATCH','ACKNOWLEDGMENT'].includes(e.kind))&&new Set(dispatchEvents.map(e=>e.id)).size===dispatchEvents.length,'DISPATCH_CENSUS');
 const sends=dispatchEvents.filter(e=>e.kind==='DISPATCH'),acks=dispatchEvents.filter(e=>e.kind==='ACKNOWLEDGMENT');need(sends.length<=1&&acks.length<=1&&(!sends.length||sends[0].acknowledgesEventId===null)&&(!acks.length||acks[0].acknowledgesEventId===sends[0]?.id),'DISPATCH_CHAIN');
 const existingDispatchId=sends[0]?.id??null,existingAckId=acks[0]?.id??null;
 need(documentType?.companyId===b.companyId&&uuid(documentType.id)&&documentType.isActive===true,'DOCUMENT_TYPE');
 const required={JAI:['procurement.po.view','documents.document.view','documents.document.upload','documents.document.link',...(!existingAckId?['procurement.po.edit']:[])],STORE_SITE:['inventory.receiving.view','documents.document.view','documents.document.upload','documents.document.link'],KHAIMOOK:['inventory.receipt.view','documents.document.view']};
 const roles={JAI:'PROCUREMENT_OFFICER',STORE_SITE:'STOREKEEPER',KHAIMOOK:'PROJECT_MANAGER'};
 for(const [k,permissions] of Object.entries(required)){const r=roster[k];need(r?.companyId===b.companyId&&uuid(r.userId)&&r.roleCodes.includes(roles[k])&&permissions.every(x=>r.permissions.includes(x)),'ACTOR_'+k);}
 need(new Set(Object.keys(required).map(k=>roster[k].userId)).size===3,'ACTOR_ALIAS');
 const specs=[...(!existingDispatchId?[['dispatch','JAI','PURCHASE_ORDER',order.id]]:[]),['ack','JAI','PURCHASE_ORDER',order.id],['transit','JAI','PURCHASE_ORDER',order.id],['delay','JAI','PURCHASE_ORDER',order.id],['handover','STORE_SITE','RECEIVING_DELIVERY',delivery.id]];
 need(artifacts&&same(Object.keys(artifacts).sort(),specs.map(x=>x[0]).sort()),'ARTIFACT_SET');
 const uploads=specs.map(([key,actor,entityType,entityId])=>{const a=artifacts[key];need(hex(a?.sha256)&&Number.isSafeInteger(a.size)&&a.size>0&&a.size<=1048576&&a.sha256!==photo.checksum,'ARTIFACT');return {key,actor,actorUserId:roster[actor].userId,entityType,entityId,sha256:a.sha256,size:a.size};});need(new Set(uploads.map(x=>x.sha256)).size===uploads.length,'ARTIFACT_ALIAS');
 return {companyId:b.companyId,projectId:b.projectId,orderId:order.id,deliveryId:delivery.id,lineId:l.id,conditionDocumentId:doc.id,conditionChecksum:doc.checksum,observedQuantity:format(observed),goodQuantity:format(good),returnQuantity:format(observed-good),documentTypeId:documentType.id,jaiUserId:roster.JAI.userId,existingDispatchId,existingAckId,uploads,expectedNewDispatchEvents:Number(!existingDispatchId)+Number(!existingAckId),syntheticOnly:true,productionAuthorized:false};
}
export function createResidualSupplierSourceJourney({plan,authorization:a,operatorSha,verifyBefore,verifyRuntime,request,upload,download,verifyDelta}){
 const p=structuredClone(plan);need(p?.syntheticOnly===true&&p.productionAuthorized===false&&a?.applicationSha==='70013b5139292ef33563447f8937c8f132feabd2'&&a.database==='m6_successor_rehearsal'&&/^[a-f0-9]{40}$/.test(operatorSha??'')&&a.operatorSha===operatorSha&&a.planSha256===supplierSourceDigest(p)&&a.ownerAuthorizedSupplierSources===true&&a.retainedMutationAuthorized===false&&a.productionAuthorized===false,'AUTHORITY');
 need([verifyBefore,verifyRuntime,request,upload,download,verifyDelta].every(f=>typeof f==='function'),'ADAPTER');let attempted=false;
 const path='/procurement/purchase-orders/'+p.orderId+'/dispatch-events';
 async function http(method,body,status){await verifyRuntime();const r=await request({actor:'JAI',method,path,body});need(r?.status===status,'HTTP_'+status);return r.data;}
 const scope=e=>e?.companyId===p.companyId&&e.projectId===p.projectId&&e.purchaseOrderId===p.orderId&&uuid(e.id);
 return async()=>{need(!attempted,'NO_REPLAY');attempted=true;need(await verifyBefore(p)===true,'SOURCE_DRIFT');
  const initial=await http('GET',undefined,200);const oldIds=[p.existingDispatchId,p.existingAckId].filter(Boolean).sort();need(Array.isArray(initial)&&initial.every(scope)&&same(initial.map(e=>e.id).sort(),oldIds),'INITIAL_EVENTS');
  const docs={},expectedFiles=[];for(const spec of p.uploads){const target='/documents/projects/'+p.projectId+'/targets/'+spec.entityType+'/'+spec.entityId;await verifyRuntime();const r=await upload({...spec,path:target,documentTypeId:p.documentTypeId});need(r?.status===201&&uuid(r.data?.id)&&r.data.id!==p.conditionDocumentId&&!Object.values(docs).includes(r.data.id),'UPLOAD');docs[spec.key]=r.data.id;await verifyRuntime();const d=await download({actor:spec.actor,path:target+'/'+r.data.id+'/download'});need(d?.status===200&&d.bytes instanceof Uint8Array&&d.bytes.length===spec.size&&hash(d.bytes)===spec.sha256,'DOWNLOAD');expectedFiles.push({id:r.data.id,projectId:p.projectId,...spec});}
  const added=[];let dispatchId=p.existingDispatchId,ackId=p.existingAckId;
  async function record(kind,evidenceDocumentId,acknowledgesEventId){const e=await http('POST',{kind,channel:'EMAIL',recipient:'synthetic-supplier@example.invalid',evidenceReference:'SYNTHETIC M6 rehearsal only; no external message sent',evidenceDocumentId,acknowledgesEventId},201);need(scope(e)&&e.kind===kind&&e.evidenceDocumentId===evidenceDocumentId&&e.acknowledgesEventId===acknowledgesEventId&&e.recordedByUserId===p.jaiUserId&&e.pdfSha256===null&&!oldIds.includes(e.id)&&!added.some(x=>x.id===e.id),'EVENT');added.push(e);return e.id;}
  if(!dispatchId)dispatchId=await record('DISPATCH',docs.dispatch,null);
  if(!ackId)ackId=await record('ACKNOWLEDGMENT',docs.ack,dispatchId);
  const terminal=await http('GET',undefined,200);need(Array.isArray(terminal)&&terminal.every(scope)&&same(terminal.map(x=>x.id).sort(),[dispatchId,ackId].sort())&&terminal.find(x=>x.id===dispatchId)?.kind==='DISPATCH'&&terminal.find(x=>x.id===ackId)?.kind==='ACKNOWLEDGMENT'&&terminal.find(x=>x.id===ackId)?.acknowledgesEventId===dispatchId&&added.length===p.expectedNewDispatchEvents,'TERMINAL_EVENTS');
  need(await verifyDelta({plan:p,addedEvents:added,expectedFiles})===true,'DELTA');
  return {status:'M6_SUPPLIER_SOURCE_PREPARED',ackEventId:ackId,ackDocumentId:docs.ack,transitDocumentId:docs.transit,delayDocumentId:docs.delay,handoverDocumentId:docs.handover,conditionDocumentId:p.conditionDocumentId,conditionChecksum:p.conditionChecksum,handoverChecksum:p.uploads.find(x=>x.key==='handover').sha256,originalDeliveryId:p.deliveryId,originalDeliveryLineId:p.lineId,observedQuantity:p.observedQuantity,goodQuantity:p.goodQuantity,returnQuantity:p.returnQuantity,expectedFiles,newDispatchEvents:added.length,externalMessagesSent:0,productionAuthorized:false,automaticRetryAllowed:false};
 };
}
