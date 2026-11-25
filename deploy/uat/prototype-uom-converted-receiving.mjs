// New synthetic material only; no replay or rewrite of completed predecessor receipts.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {SOURCE,httpClient} from './prototype-actors.mjs';
import {validUomOrigins} from './prototype-uom-state.mjs';
import {receivingCommercialFixture,syntheticPoCommercialTerms,verifySyntheticPoCommercialTerms} from './prototype-receiving-state.mjs';
const check=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const four=v=>Number(v).toFixed(4);
export async function convertedReceiving(db,binding,source,{api,web}){
 const b=structuredClone(binding),f=b.fixture;
 check(b.sourceSha===SOURCE&&validUomOrigins(api,web)&&source?.company?.id===f.companyId&&
  source.material?.code==='PROTO_UOM_NEW','UOM_RC_SOURCE_INVALID');
 const [material,suppliers,work,wbs,cost,doc]=await Promise.all([
  db.material.findUnique({where:{id:source.material.id}}),
  db.supplier.findMany({where:{companyId:f.companyId,supplierCode:'PROTO_RC_SUPPLIER'}}),
  db.approvalWorkflow.findMany({where:{companyId:f.companyId,workflowCode:{in:['PROTO_RC_PURCHASE_REQUEST','PROTO_RC_PURCHASE_ORDER','PROTO_RC_GOODS_RECEIPT']},isActive:true}}),
  db.wbsElement.findMany({where:{projectId:f.projectId,wbsCode:'PROTO_RC'}}),
  db.costCode.findMany({where:{companyId:f.companyId,costCode:'PROTO_RC_MATERIAL'}}),
  db.documentType.findUnique({where:{id:b.configuration.documentTypeId}})
 ]);
 check(material?.companyId===f.companyId&&material.defaultUomId===source.carton.id&&
  suppliers.length===1&&work.length===3&&wbs.length===1&&cost.length===1&&doc?.companyId===f.companyId&&
  await db.receivingProjectPolicy.count({where:{projectId:f.projectId}})===1&&
  await db.materialUomActivation.count({where:{materialId:material.id}})===0&&
  await db.purchaseRequestLine.count({where:{materialId:material.id}})===0,'UOM_RC_EXISTING_SOURCE_REFUSED');
 const revision=await db.materialUomRevision.findMany({where:{materialId:material.id},orderBy:{revisionNo:'asc'}});
 check(revision.length===2&&String(revision[0].numerator)==='20'&&
  revision[0].effectiveFrom.toISOString().slice(0,10)==='2026-01-01'&&
  String(revision[1].numerator)==='24'&&revision[1].effectiveFrom.toISOString().slice(0,10)==='2027-01-01',
  'UOM_RC_RATE_CHANGED');
 const before={
  stock:await db.stockTransaction.findMany({where:{companyId:f.companyId}}),
  docs:await db.document.findMany({where:{companyId:f.companyId}}),
  certification:await db.subcontractCertification.findMany({where:{companyId:f.companyId}}),
  transfer:await db.transferReceipt.findMany(),
  payments:await db.payment.findMany({where:{companyId:f.companyId}}),
  costs:await db.directCostPosting.findMany({where:{companyId:f.companyId}}),
  grants:await db.rolePermission.findMany({where:{roleId:{in:Object.values(b.actors).map(a=>a.roleId)}}})
 };
 const flow=Object.fromEntries(work.map(w=>[w.entityType,w.workflowCode])),sessions={},commercial=receivingCommercialFixture(b);
 if(commercial)check(api==='http://127.0.0.1:31319/api/v1'&&web==='http://127.0.0.1:44319','UOM_RC_COMMERCIAL_FIXTURE_ORIGINS_REFUSED');
 let commercialPoId;
 // Authenticated canonical calls; these are isolated-synthetic successors only.
 const client=httpClient(api,web,async(url,options)=>{
  const path=url.slice(api.length);
  check(url.startsWith(api+'/')&&options.headers.Origin===web&&options.redirect==='error'&&
   (['GET','POST','PUT'].includes(options.method)||commercial&&options.method==='PATCH'&&commercialPoId&&path==='/procurement/purchase-orders/'+commercialPoId)&&
   (['/auth/login','/auth/logout','/auth/me'].includes(path)||
    path==='/master-data/material-conversions/'+material.id+'/activation'||
    path.startsWith('/procurement/')||path.startsWith('/inventory/receiving/deliveries')||
    path.startsWith('/inventory/goods-receipts')),'UOM_RC_UNDECLARED_REQUEST');
  return fetch(url,options);
 });
 const call=async(k,label,path,body,method)=>(await client.call(sessions[k],label,path,
  body===undefined?200:(method==='PUT'||method==='PATCH')?200:201,body,method)).value?.data;
 const action=more=>({requestKey:randomUUID(),reason:'Isolated converted UOM proof',...more});
 let primary,result,phase='SOURCE_AUTH';
 try{
  for(const k of ['KHAIMOOK','STORE_SITE','JAI','BEN'])sessions[k]=await client.login('UOM_RC_'+k,b.actors[k],f.companyId);
  const command=action({expectedVersion:3});
  phase='ACTIVATION';const activated=await call('KHAIMOOK','RC_ACTIVATE','/master-data/material-conversions/'+material.id+'/activation',command);
  check(activated?.inventoryConversionEnabled&&activated.stockUomId===source.each.id,'UOM_RC_ACTIVATION_FAILED');
  assert.deepEqual(await call('KHAIMOOK','RC_ACTIVATION_REPLAY','/master-data/material-conversions/'+material.id+'/activation',command),activated);
  const later=new Date(Date.now()+14*86400000).toISOString().slice(0,10),today=new Date().toISOString().slice(0,10);
  phase='PURCHASE_REQUEST';const pr=await call('STORE_SITE','RC_PR','/procurement/projects/'+f.projectId+'/purchase-requests',{remarks:'New synthetic converted carton demand'});
  const line=await call('STORE_SITE','RC_PR_LINE','/procurement/purchase-requests/'+pr.id+'/lines',{
   lineType:'MATERIAL',materialId:material.id,quantity:'4.0000',uomId:source.carton.id,
   wbsId:wbs[0].id,costCodeId:cost[0].id,requiredOnSite:later});
  await call('STORE_SITE','RC_PR_SUBMIT','/procurement/purchase-requests/'+pr.id+'/submit',{workflowCode:flow.PURCHASE_REQUEST});
  await call('KHAIMOOK','RC_PR_APPROVE','/procurement/purchase-requests/'+pr.id+'/approve',{comment:'Independent new material PR'});
  phase='RFQ';const rfq=await call('JAI','RC_RFQ','/procurement/projects/'+f.projectId+'/rfqs',{
   closingDate:later,remarks:'New material sourcing',lines:[{purchaseRequestLineId:line.id,quantity:'4.0000'}]});
  await call('JAI','RC_RFQ_SUPPLIER','/procurement/rfqs/'+rfq.id+'/suppliers',{supplierId:suppliers[0].id});
  const quote=await call('JAI','RC_QUOTE','/procurement/rfqs/'+rfq.id+'/quotations',{
   supplierId:suppliers[0].id,supplierReference:'UOM_SYNTHETIC_QUOTE',quotationDate:today});
  const qline=await call('JAI','RC_QUOTE_LINE','/procurement/quotations/'+quote.id+'/lines/'+rfq.lines[0].id,
   {quantity:'4.0000',unitPrice:'12.0000'},'PUT');
  const award=await call('JAI','RC_AWARD','/procurement/rfq-lines/'+rfq.lines[0].id+'/award',{
   supplierQuotationLineId:qline.id,decisionReason:'New synthetic source'});
  phase='PURCHASE_ORDER';const po=await call('JAI','RC_PO','/procurement/projects/'+f.projectId+'/purchase-orders',{
   awardIds:[award.id],remarks:'Converted carton PO'});
  commercialPoId=po.id;
  if(commercial)verifySyntheticPoCommercialTerms(await call('JAI','RC_PO_COMMERCIAL','/procurement/purchase-orders/'+po.id,syntheticPoCommercialTerms,'PATCH'));
  await call('JAI','RC_PO_SUBMIT','/procurement/purchase-orders/'+po.id+'/submit',{workflowCode:flow.PURCHASE_ORDER});
  await call('BEN','RC_PO_APPROVE','/procurement/purchase-orders/'+po.id+'/approve',{comment:'Independent PO authorization'});
  const approved=await call('JAI','RC_PO_READ','/procurement/purchase-orders/'+po.id);
  check(approved?.lifecycleState==='APPROVED'&&approved.lines.length===1&&
   approved.lines[0].materialId===material.id&&four(approved.lines[0].quantity)==='4.0000',
   'UOM_RC_APPROVED_PO_WRONG');
  phase='DELIVERY_CAPTURE';const delivery=await call('STORE_SITE','RC_DELIVERY','/inventory/receiving/deliveries',{
   requestKey:randomUUID(),projectId:f.projectId,warehouseId:f.warehouseId,supplierId:suppliers[0].id,
   receivedAt:new Date(Date.now()-49*3600000).toISOString(),receiverName:'Synthetic converted receiver',
   reason:'New carton physical custody',qualityRequired:false,
   lines:[{materialId:material.id,uomId:source.carton.id,observedQuantity:'4',
    goodQuantity:'3',condition:'DAMAGED',note:'One carton held for damage'}]});
  const get=()=>call('STORE_SITE','RC_READ_DELIVERY','/inventory/receiving/deliveries/'+delivery.id);
  check((await get()).usable===false,'UOM_RC_EARLY_USE');
  phase='DOCUMENT_EVIDENCE';const documents=[];
  for(const purpose of ['DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO']){
   const bytes=Buffer.from('%PDF-1.4\nSynthetic converted '+purpose);
   const form=new FormData();form.set('documentTypeId',doc.id);
   form.set('file',new Blob([bytes],{type:'application/pdf'}),'uom-converted-'+purpose+'.pdf');
   const response=await fetch(api+'/documents/projects/'+f.projectId+'/targets/RECEIVING_DELIVERY/'+delivery.id,{
    method:'POST',headers:{Cookie:sessions.STORE_SITE.cookie,'x-csrf-token':sessions.STORE_SITE.csrf,Origin:web},
    body:form,redirect:'error',signal:AbortSignal.timeout(15000)});
   const payload=await response.json();
   check(response.status===201&&payload?.data?.id,'UOM_RC_DOCUMENT_UPLOAD');
   const saved=await db.document.findUniqueOrThrow({where:{id:payload.data.id}});
   check(saved.companyId===f.companyId&&saved.fileSizeBytes===bytes.length&&
    saved.checksum===createHash('sha256').update(bytes).digest('hex'),'UOM_RC_DOCUMENT_DIGEST');
   documents.push(saved.id);
   await call('STORE_SITE','RC_EVIDENCE_'+purpose,'/inventory/receiving/deliveries/'+delivery.id+'/evidence',
    action({expectedVersion:(await get()).version,documentId:saved.id,purpose,
     signedEvidenceConfirmed:purpose==='RECEIVER_SIGNATURE'}));
  }
  phase='PO_LINK';const held=await get();
  await call('STORE_SITE','RC_LINK','/inventory/receiving/deliveries/'+delivery.id+'/link-po',
   action({expectedVersion:held.version,purchaseOrderId:approved.id,
    lines:held.lines.map(l=>({id:l.id,purchaseOrderLineId:approved.lines[0].id}))}));
  phase='INDEPENDENT_CHECK';await call('JAI','RC_CHECK','/inventory/receiving/deliveries/'+delivery.id+'/check',
   action({expectedVersion:(await get()).version,decision:'ACCEPT'}));
  const checked=await get();
  check(checked.deadline==='LINKED_LATE'&&!checked.usable,'UOM_RC_LATE_LINK_OR_EARLY_USE');
  phase='GOODS_RECEIPT';const gr=await call('STORE_SITE','RC_GR','/inventory/goods-receipts',{
   projectId:f.projectId,purchaseOrderId:approved.id,warehouseId:f.warehouseId,deliveryId:delivery.id,
   requestKey:randomUUID(),expectedDeliveryVersion:checked.version,
   lines:[{purchaseOrderLineId:approved.lines[0].id,quantity:'3'}]});
  await call('STORE_SITE','RC_GR_SUBMIT','/inventory/goods-receipts/'+gr.id+'/submit',
   {workflowCode:flow.GOODS_RECEIPT,conversionBusinessDate:'2026-11-19'});
  const post={postKey:randomUUID()};
  await call('KHAIMOOK','RC_GR_APPROVE','/inventory/goods-receipts/'+gr.id+'/approve',post);
  await call('KHAIMOOK','RC_GR_IDEMPOTENT','/inventory/goods-receipts/'+gr.id+'/approve',post);
  phase='POSTING_READBACK';const receipt=await db.goodsReceipt.findUniqueOrThrow({where:{id:gr.id},include:{items:true}});
  const effect=await db.stockTransaction.findFirstOrThrow({where:{goodsReceiptId:gr.id,materialId:material.id},
   include:{materialUomEffectPin:true}});
  check(receipt.postedAt&&receipt.items.length===1&&four(receipt.items[0].quantity)==='3.0000'&&
   effect.uomId===source.each.id&&four(effect.quantity)==='60.0000'&&
   effect.materialUomEffectPin?.businessDate.toISOString().slice(0,10)==='2026-11-19',
   'UOM_RC_CONVERSION_PROVENANCE_INVALID');
  phase='HISTORICAL_READBACK';for(const [model,old] of [['stockTransaction',before.stock],['document',before.docs],
   ['subcontractCertification',before.certification],['transferReceipt',before.transfer],
   ['payment',before.payments],['directCostPosting',before.costs]]){
   const after=await db[model].findMany({where:model==='transferReceipt'?{}:{companyId:f.companyId}});
   for(const row of old)assert.deepEqual(after.find(x=>x.id===row.id),row,'Old '+model+' row changed');
  }
  assert.deepEqual(await db.rolePermission.findMany({where:{roleId:{in:Object.values(b.actors).map(a=>a.roleId)}}}),
   before.grants,'Unexpected role grants');
  result={convertedReceivingVerified:true,sourceQuantity:'3.0000',stockQuantity:'60.0000',
   convertedGoodOnly:true,documentIds:documents};
 }catch(e){primary=e; if(!e.safeCode)e.safeCode='UOM_RC_'+phase+'_FAILED';}
 finally{for(const [k,session]of Object.entries(sessions))try{
  await client.logout('UOM_RC_'+k,session);
  await client.call(session,'UOM_RC_'+k+'_REVOKED','/auth/me',401);
 }catch(e){primary??=e;}}
 if(primary)throw primary;
 return result;
}
