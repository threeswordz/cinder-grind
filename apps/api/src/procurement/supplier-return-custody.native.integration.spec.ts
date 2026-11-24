import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ReceivingService } from '../inventory/receiving.service';
import { receivingFixture } from '../inventory/receiving-test-fixture';
import { DocumentTargetsService } from '../documents/document-targets.service';
import { SupplierDeliveryCaseService } from './supplier-delivery-case.service';

test('PUR14 actual checked damaged return is signed custody only, no stock or AP credit', async () => {
 const db = new PrismaService();
 const temp = await mkdtemp(join(tmpdir(), 'pur14-return-native-'));
 const priorStorage = process.env.STORAGE_ROOT, priorNodeEnv = process.env.NODE_ENV;
 process.env.STORAGE_ROOT = join(temp, 'documents');
 process.env.NODE_ENV = 'test';
 await db.$connect();
 const app = await NestFactory.create(AppModule, { logger: false });
 await app.init();
 try {
  const f = await receivingFixture(db);
  await db.role.update({where:{id:f.store.role.id},data:{roleCode:'STOREKEEPER'}});
  await db.role.update({where:{id:f.pm.role.id},data:{roleCode:'PROJECT_MANAGER'}});
  await db.role.update({where:{id:f.buyer.role.id},data:{roleCode:'PROCUREMENT_OFFICER'}});
  const docPermission=await db.permission.findUniqueOrThrow({
   where:{permissionCode:'documents.document.view'},
  });
  await db.rolePermission.create({data:{roleId:f.buyer.role.id,permissionId:docPermission.id}});
  const store=await f.sessions.resolve(f.store.session.sessionToken);
  const pm=await f.sessions.resolve(f.pm.session.sessionToken);
  const jai=await f.sessions.resolve(f.buyer.session.sessionToken);
  assert.ok(store&&pm&&jai);
  const ctx=(auth:NonNullable<typeof store>)=>({auth});
  const receiving=app.get(ReceivingService);
  const documents=app.get(DocumentTargetsService);
  const supplier=app.get(SupplierDeliveryCaseService);
  await receiving.enable(ctx(f.config.auth),f.project.id,{
   requestKey:randomUUID(),reason:'Disposable focused supplier custody return',
  });
  const captured=await receiving.capture(ctx(store),f.input({
   receivedAt:new Date(Date.now()-3600000).toISOString(),
   lines:[{materialId:f.material.id,uomId:f.uom.id,
    observedQuantity:'4.0000',goodQuantity:'3.0000',
    condition:'DAMAGED',note:'One damaged physical item separately held'}],
  })) as unknown as {id:string};
  let delivery=await receiving.get(store,captured.id);
  const lineId=delivery.lines[0]!.id;
  const cmd=(version:number,more:Record<string,unknown>={})=>({
   requestKey:randomUUID(),expectedVersion:version,reason:'Scoped supplier evidence',...more,
  });
  await receiving.link(ctx(store),captured.id,cmd(delivery.version,{
   purchaseOrderId:f.po.id,
   lines:[{id:lineId,purchaseOrderLineId:f.po.lines[0]!.id}],
  }));
  let photoId='';
  for(const purpose of ['DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO']){
   const bytes=Buffer.from('%PDF-1.4\nReceiving '+purpose+' '+randomUUID()+'\n');
   const doc=await documents.upload(ctx(store),f.project.id,'RECEIVING_DELIVERY',captured.id,
    f.documentType.id,{originalname:purpose+'.pdf',mimetype:'application/pdf',
     size:bytes.length,buffer:bytes});
   if(purpose==='CONDITION_PHOTO')photoId=doc.id;
   delivery=await receiving.get(store,captured.id);
   await receiving.attach(ctx(store),captured.id,cmd(delivery.version,{
    documentId:doc.id,purpose,signedEvidenceConfirmed:purpose==='RECEIVER_SIGNATURE',
   }));
  }
  delivery=await receiving.get(store,captured.id);
  await receiving.check(ctx(f.jai.auth),captured.id,cmd(delivery.version,{decision:'ACCEPT'}));
  assert.equal((await receiving.get(store,captured.id)).status,'CHECKED');
  const signatureBytes=Buffer.from('%PDF-1.4\nSupplier signed physical return '+randomUUID()+'\n');
  const signed=await documents.upload(ctx(store),f.project.id,'RECEIVING_DELIVERY',captured.id,
   f.documentType.id,{originalname:'supplier-signed-return.pdf',mimetype:'application/pdf',
    size:signatureBytes.length,buffer:signatureBytes});
  const signedRow=await db.document.findUniqueOrThrow({where:{id:signed.id}});
  assert.match(signedRow.checksum??'',/^[a-f0-9]{64}$/i);
  assert.notEqual(signed.id,photoId);
  const input=(action:string,version:number,previous:string|null,
   extra:Record<string,unknown>={})=>({
   action,expectedVersion:version,expectedPreviousEventId:previous,
   evidenceDocumentId:photoId,
   note:'Documentary supplier claim recorded only, no supplier notification',...extra,
  });
  const reported=await supplier.transition(ctx(store),f.po.id,
   input('REPORT_DISCREPANCY',0,null,{discrepancyKind:'DAMAGED'}) as never);
  const reviewed=await supplier.transition(ctx(pm),f.po.id,
   input('PM_REVIEW_DISCREPANCY',1,reported.expectedPreviousEventId,
    {pmDecision:'REQUEST_RETURN'}) as never);
  const claimed=await supplier.transition(ctx(jai),f.po.id,
   input('JAI_RECORD_CLAIM',2,reviewed.expectedPreviousEventId) as never);
  const valid=()=>input('STORE_RECORD_RETURN_DISPATCH',3,claimed.expectedPreviousEventId,{
   evidenceDocumentId:signed.id,originalReceivingDeliveryLineId:lineId,
   returnQuantity:'1.0000',supplierSignatory:'Supplier receiving representative',
   supplierSignatureConfirmed:true,
  });
  const expectCode=async(task:Promise<unknown>,code:string)=>assert.rejects(task,(e:unknown)=>{
   if(!e||typeof e!=='object'||!('getResponse' in e)||
      typeof e.getResponse!=='function')return false;
   const x=e.getResponse();
   return !!x&&typeof x==='object'&&'code' in x&&x.code===code;
  },code);
  const eventsBefore=await db.auditLog.count({
   where:{companyId:f.company.id,entityType:'SUPPLIER_DELIVERY_CASE',entityId:f.po.id},
  });
  const stockBefore=await db.stockTransaction.count({where:{companyId:f.company.id}});
  const apBefore=await db.supplierInvoice.count({where:{companyId:f.company.id}});
  const payBefore=await db.payment.count({where:{companyId:f.company.id}});
  assert.equal(eventsBefore,3);
  await expectCode(supplier.transition(ctx(store),f.po.id,
   {...valid(),returnQuantity:'3.0000'} as never),
   'PUR14_RETURN_UNPOSTED_DAMAGED_QUANTITY_REQUIRED');
  await expectCode(supplier.transition(ctx(store),f.po.id,
   {...valid(),supplierSignatureConfirmed:false} as never),
   'SUPPLIER_CASE_RETURN_SOURCE_AND_SIGNED_HANDOVER_REQUIRED');
  await expectCode(supplier.transition(ctx(store),f.po.id,
   {...valid(),originalReceivingDeliveryLineId:randomUUID()} as never),
   'SUPPLIER_CASE_RETURN_ORIGINAL_CHECKED_LINE_REQUIRED');
  await expectCode(supplier.transition(ctx(store),f.po.id,
   {...valid(),evidenceDocumentId:photoId} as never),
   'PUR14_RETURN_SIGNED_SUPPLIER_DOCUMENT_REQUIRED');
  await expectCode(supplier.transition(ctx(store),f.po.id,
   {...valid(),evidenceDocumentId:randomUUID()} as never),
   'SUPPLIER_CASE_SCOPED_DOCUMENT_EVIDENCE_REQUIRED');
  await expectCode(supplier.transition(ctx(store),f.po.id,
   {...valid(),expectedPreviousEventId:reported.expectedPreviousEventId} as never),
   'SUPPLIER_CASE_STALE_EVENT');
  assert.equal(await db.auditLog.count({
   where:{companyId:f.company.id,entityType:'SUPPLIER_DELIVERY_CASE',entityId:f.po.id},
  }),eventsBefore,'Rejected return cannot append audit event');
  assert.equal(await db.stockTransaction.count({where:{companyId:f.company.id}}),stockBefore);
  assert.equal(await db.supplierInvoice.count({where:{companyId:f.company.id}}),apBefore);
  assert.equal(await db.payment.count({where:{companyId:f.company.id}}),payBefore);
  const final=await supplier.transition(ctx(store),f.po.id,valid() as never);
  assert.equal(final.case.stage,'RETURN_DISPATCH_RECORDED');
  const read=await supplier.read(store,f.po.id);
  const trace=read.returnCustodyTrace as {quantity:string;warehouseId:string;
   originalDeliveryLineId:string;signedHandoverDocumentId:string;financeEffect:boolean;stockEffect:boolean};
  assert.equal(trace.quantity,'1.0000');
  assert.equal(trace.originalDeliveryLineId,lineId);
  assert.equal(trace.warehouseId,f.warehouse.id);
  assert.equal(trace.signedHandoverDocumentId,signed.id);
  assert.equal(trace.stockEffect,false);
  assert.equal(trace.financeEffect,false);
  assert.equal(read.financeResolution,'REPLACEMENT_ONLY_NO_AP_CREDIT');
  assert.equal(read.nonDamagedResolution,'DISCREPANCY_EVIDENCE_ONLY');
  assert.equal(await db.auditLog.count({
   where:{companyId:f.company.id,entityType:'SUPPLIER_DELIVERY_CASE',entityId:f.po.id},
  }),eventsBefore+1);
  assert.equal(await db.stockTransaction.count({where:{companyId:f.company.id}}),stockBefore,
   'Physical custody return must not deduct posted inventory');
  assert.equal(await db.supplierInvoice.count({where:{companyId:f.company.id}}),apBefore);
  assert.equal(await db.payment.count({where:{companyId:f.company.id}}),payBefore);
  await expectCode(supplier.transition(ctx(store),f.po.id,valid() as never),
   'SUPPLIER_CASE_STALE_EVENT');
  console.log('PUR14_NATIVE_SIGNED_CUSTODY_DAMAGED_SOURCE_STOCK_AP_UNCHANGED_PASS');
 }finally{
  await app.close();await db.$disconnect();
  if(priorStorage===undefined)delete process.env.STORAGE_ROOT;
  else process.env.STORAGE_ROOT=priorStorage;
  if(priorNodeEnv===undefined)delete process.env.NODE_ENV;
  else process.env.NODE_ENV=priorNodeEnv;
  await rm(temp,{recursive:true,force:true});
 }
});
