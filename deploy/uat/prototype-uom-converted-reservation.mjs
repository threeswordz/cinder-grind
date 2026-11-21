// One new converted reservation on the approved isolated synthetic material.
// No old reservation/issue cycle replay and no posting or financial mutation.
import assert from 'node:assert/strict';
import {SOURCE,httpClient} from './prototype-actors.mjs';
import {validUomOrigins} from './prototype-uom-state.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export async function convertedReservation(db,binding,source,{api,web}){
 const b=structuredClone(binding),f=b.fixture,materialId=source?.material?.id;
 demand(b.sourceSha===SOURCE&&validUomOrigins(api,web)&&source.company.id===f.companyId&&
  source.material.code==='PROTO_UOM_NEW','UOM_RSV_WRONG_SYNTHETIC_SOURCE');
 const [active,stock,preexisting,sequence]=await Promise.all([
  db.materialUomActivation.findUnique({where:{materialId}}),
  db.stockTransaction.findMany({where:{companyId:f.companyId}}),
  db.materialReservation.count({where:{companyId:f.companyId,materialId}}),
  db.numberSequence.findMany({where:{companyId:f.companyId,sequenceCode:'MATERIAL_RESERVATION'}})
 ]);
 demand(active?.stockUomId===source.each.id&&preexisting===0&&sequence.length<=1&&
  (sequence.length===0||sequence[0].entityType==='MATERIAL_RESERVATION'&&
   sequence[0].formatTemplate==='RSVYYMM-###'&&sequence[0].resetRule==='MONTHLY'),
  'UOM_RSV_STOCK_OR_SEQUENCE_DRIFT');
 // Existing canonical MaterialReservation numbering requires exactly this format.
 // A separate synthetic sequence is created only when absent; never alter an old one.
 if(!sequence.length)await db.numberSequence.create({data:{companyId:f.companyId,
  entityType:'MATERIAL_RESERVATION',sequenceCode:'MATERIAL_RESERVATION',
  formatTemplate:'RSVYYMM-###',resetRule:'MONTHLY'}});
 const client=httpClient(api,web,async(url,options)=>{
  const suffix=url.slice(api.length);
  demand(url.startsWith(api+'/')&&options.headers.Origin===web&&options.redirect==='error'&&
   ['GET','POST'].includes(options.method)&&
   (['/auth/login','/auth/logout','/auth/me'].includes(suffix)||
    suffix==='/inventory/material-reservations'||suffix.startsWith('/inventory/material-reservations/')),
   'UOM_RSV_UNDECLARED_HTTP');
  return fetch(url,options);
 });
 const sessions={};let primary,result,phase='LOGIN';
 try{
  sessions.STORE_SITE=await client.login('UOM_RSV_STORE',b.actors.STORE_SITE,f.companyId);
  sessions.FOREMAN=await client.login('UOM_RSV_FOREMAN',b.actors.FOREMAN,f.companyId);
  phase='CREATE';
  const input={projectId:f.projectId,warehouseId:f.warehouseId,materialId,
   uomId:source.carton.id,quantity:'1',remarks:'Explicit synthetic carton reservation'};
  await client.call(sessions.FOREMAN,'UOM_RSV_FOREMAN_DENIED','/inventory/material-reservations',403,input);
  const created=(await client.call(sessions.STORE_SITE,'UOM_RSV_CREATE','/inventory/material-reservations',201,input)).value.data;
  demand(created?.materialId===materialId&&created.status==='DRAFT','UOM_RSV_NEW_SOURCE_INVALID');
  phase='ACTIVATE';
  await client.call(sessions.STORE_SITE,'UOM_RSV_MISSING_DATE','/inventory/material-reservations/'+created.id+'/activate',422,{});
  const reserved=(await client.call(sessions.STORE_SITE,'UOM_RSV_ACTIVATE',
   '/inventory/material-reservations/'+created.id+'/activate',201,
   {conversionBusinessDate:'2026-11-19'})).value.data;
  const pin=await db.materialUomReservationPin.findUniqueOrThrow({where:{reservationId:created.id}});
  demand(reserved?.status==='ACTIVE'&&pin.companyId===f.companyId&&pin.materialId===materialId&&
   pin.sourceUomId===source.carton.id&&pin.stockUomId===source.each.id&&
   pin.sourceQuantity.toFixed(4)==='1.0000'&&pin.stockQuantity.toFixed(4)==='20.0000'&&
   pin.numerator==='20'&&pin.businessDate.toISOString().slice(0,10)==='2026-11-19',
   'UOM_RSV_FROZEN_SOURCE_INCORRECT');
  phase='RELEASE';
  const released=(await client.call(sessions.STORE_SITE,'UOM_RSV_RELEASE',
   '/inventory/material-reservations/'+created.id+'/release',201,
   {reason:'Release synthetic no-posting demand'})).value.data;
  demand(released?.status==='RELEASED','UOM_RSV_NOT_RELEASED');
  assert.deepEqual(await db.materialUomReservationPin.findUniqueOrThrow({where:{reservationId:created.id}}),
   pin,'Releasing reservation rewrote frozen conversion');
  assert.deepEqual(await db.stockTransaction.findMany({where:{companyId:f.companyId}}),stock,
   'Reservation must not post or rewrite stock');
  demand(await db.materialReservation.count({where:{companyId:f.companyId,materialId}})===1,
   'UOM_RSV_DUPLICATE_OR_MISSING');
  result={convertedReservationVerified:true,pinnedReservationStockQuantity:'20.0000',
   reservationReleasedWithoutStockEffect:true,reservationSessionsRevoked:true};
 }catch(e){primary=e;if(!e.safeCode)e.safeCode='UOM_RSV_'+phase+'_FAILED';}
 finally{for(const [key,session]of Object.entries(sessions))try{
  await client.logout('UOM_RSV_'+key,session);
  await client.call(session,'UOM_RSV_'+key+'_REVOKED','/auth/me',401);
 }catch(e){primary??=e;}}
 if(primary)throw primary;
 return result;
}
