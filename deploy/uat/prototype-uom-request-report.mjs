// After a proven new synthetic converted GR, read request and report sources.
// Uses authenticated canonical APIs; writes no stock, grant, receipt or Finance row.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SOURCE,httpClient} from './prototype-actors.mjs';
import {validUomOrigins} from './prototype-uom-state.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export async function convertedRequestReport(db,binding,source,{api,web}){
 const b=structuredClone(binding),f=b.fixture,id=source?.material?.id;
 demand(b.sourceSha===SOURCE&&validUomOrigins(api,web)&&
  source?.company?.id===f.companyId&&source?.material?.code==='PROTO_UOM_NEW',
  'UOM_RR_SYNTHETIC_BINDING_REFUSED');
 const [activation,receipt,stockBefore,paymentsBefore]=await Promise.all([
  db.materialUomActivation.findUnique({where:{materialId:id}}),
  db.stockTransaction.findMany({where:{companyId:f.companyId,materialId:id,goodsReceiptId:{not:null}}}),
  db.stockTransaction.findMany({where:{companyId:f.companyId}}),
  db.payment.findMany({where:{companyId:f.companyId}})
 ]);
 demand(activation?.basisVersion===3&&activation.stockUomId===source.each.id&&receipt.length===1&&
  receipt[0].uomId===source.each.id&&receipt[0].quantity.toFixed(4)==='60.0000'&&
  await db.materialRequestLine.count({where:{materialId:id}})===0,
  'UOM_RR_CONVERTED_RECEIPT_NOT_VERIFIED');
 const sessions={},client=httpClient(api,web,async(url,options)=>{
  const path=url.slice(api.length);
  demand(url.startsWith(api+'/')&&options.headers.Origin===web&&options.redirect==='error'&&
   (['/auth/login','/auth/logout','/auth/me'].includes(path)||path==='/inventory/material-requests'||
    path.startsWith('/inventory/material-requests/')||path.startsWith('/inventory/reports/movements?'))&&
   ['GET','POST'].includes(options.method),'UOM_RR_UNDECLARED_HTTP');
  return fetch(url,options);
 });
 let primary,result,phase='LOGIN';
 const call=async(key,name,path,status,body)=>(await client.call(sessions[key],name,path,status,body)).value?.data;
 try{
  sessions.STORE_SITE=await client.login('UOM_RR_STORE_SITE',b.actors.STORE_SITE,f.companyId);
  sessions.FOREMAN=await client.login('UOM_RR_FOREMAN',b.actors.FOREMAN,f.companyId);
  phase='REQUEST';
  const input={requestKey:randomUUID(),projectId:f.projectId,warehouseId:f.warehouseId,
   requesterEmployeeId:b.actors.FOREMAN.employeeId,requestDate:'2026-11-19',
   remarks:'Synthetic converted source demand, no stock effect',
   lines:[{materialId:id,uomId:source.carton.id,requestedQuantity:'2.0000',
    wbsId:null,costCodeId:null,activityId:null,remarks:null}]};
  await client.call(sessions.FOREMAN,'UOM_RR_FOREMAN_CREATE_DENIED','/inventory/material-requests',403,input);
  const request=await call('STORE_SITE','UOM_RR_CREATE','/inventory/material-requests',201,input);
  const path='/inventory/material-requests/'+request.id;
  let read=await call('STORE_SITE','UOM_RR_READ_V1',path,200);
  const line=read.lines?.[0];
  demand(read.version===1&&line?.materialId===id&&line.requestedQuantity==='2.0000'&&
   line.requestStockBasis?.stockQuantity==='40.0000'&&
   line.requestStockBasis?.numerator==='20'&&line.requestStockBasis?.businessDate==='2026-11-19',
   'UOM_RR_ORIGINAL_CONVERTED_SOURCE_NOT_VISIBLE');
  const pin=await db.materialUomRequestLinePin.findUniqueOrThrow({
   where:{requestLineId_requestVersion:{requestLineId:line.id,requestVersion:1}}});
  assert.equal(pin.stockQuantity.toFixed(4),'40.0000');
  phase='REVISE';
  await call('STORE_SITE','UOM_RR_REVISE',path+'/revisions',201,{
   requestKey:randomUUID(),expectedVersion:read.version,reason:'Explicit future-dated conversion source',
   requestDate:'2027-01-01',remarks:'Synthetic future carton requirement',
   lines:[{id:line.id,requestedQuantity:'1.0000',remarks:null}]});
  read=await call('STORE_SITE','UOM_RR_READ_V2',path,200);
  demand(read.version===2&&read.lines[0]?.requestStockBasis?.stockQuantity==='24.0000'&&
   read.lines[0].requestStockBasis?.numerator==='24'&&
   read.lines[0].requestStockBasis?.businessDate==='2027-01-01',
   'UOM_RR_FUTURE_SOURCE_NOT_PINNED');
  assert.deepEqual(await db.materialUomRequestLinePin.findUniqueOrThrow({
   where:{requestLineId_requestVersion:{requestLineId:line.id,requestVersion:1}}}),pin,
   'Past dated request was rewritten by a future revision');
  phase='REPORT';
  const reportPath='/inventory/reports/movements?projectId='+f.projectId+'&materialId='+id;
  await client.call(sessions.FOREMAN,'UOM_RR_FOREMAN_REPORT_DENIED',reportPath,403);
  const movements=await call('STORE_SITE','UOM_RR_MOVEMENT',reportPath,200);
  const posted=movements.find(v=>v.sourceType==='GOODS_RECEIPT'&&v.materialId===id);
  demand(posted&&posted.quantity==='60.0000'&&posted.conversion?.sourceQuantity==='3.0000'&&
   posted.conversion?.stockQuantity==='60.0000'&&posted.conversion?.numerator==='20'&&
   posted.conversion?.businessDate==='2026-11-19',
   'UOM_RR_MOVEMENT_LOST_CONVERSION');
  assert.deepEqual(await db.stockTransaction.findMany({where:{companyId:f.companyId}}),
   stockBefore,'UOM request/report changed posted stock');
  assert.deepEqual(await db.payment.findMany({where:{companyId:f.companyId}}),
   paymentsBefore,'UOM request/report posted Finance');
  result={convertedRequestSourceVerified:true,convertedMovementReportVerified:true,
   priorRequestRevisionPreserved:true,requestAndReportSessionsRevoked:true};
 }catch(e){primary=e;if(!e.safeCode)e.safeCode='UOM_RR_'+phase+'_FAILED';}
 finally{for(const [key,session]of Object.entries(sessions))try{
  await client.logout('UOM_RR_'+key,session);
  await client.call(session,'UOM_RR_'+key+'_REVOKED','/auth/me',401);
 }catch(e){primary??=e;}}
 if(primary)throw primary;
 return result;
}
