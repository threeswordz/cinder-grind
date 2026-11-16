import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {INestApplication} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {DocumentTargetsService} from '../documents/document-targets.service';
import {ReceivingService} from './receiving.service';
import {GoodsReceiptService} from './goods-receipt.service';
import {receivingFixture} from './receiving-test-fixture';

// Disposable technical proof only. The same real domain services are used by HTTP.
export async function receivingProofFixture(db:PrismaService,app:INestApplication,post=true){
 const f=await receivingFixture(db),service=app.get(ReceivingService),targets=app.get(DocumentTargetsService),receipts=app.get(GoodsReceiptService);
 await service.enable({auth:f.config.auth},f.project.id,{requestKey:randomUUID(),reason:'Explicit synthetic receiving recovery/browser policy'});
 const result=await service.capture({auth:f.store.auth},f.input({receivedAt:new Date(Date.now()-49*3600000).toISOString()})) as {id:string};
 const id=result.id,docs=[] as Array<{id:string;bytes:string}>;
 const command=async(extra={})=>({requestKey:randomUUID(),expectedVersion:(await service.get(f.store.auth,id)).version,reason:'Synthetic receiving proof',...extra});
 for(const purpose of ['DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO']){
  const bytes=Buffer.from('%PDF-1.4\nSynthetic receiving proof '+purpose+'\n');
  const doc=await targets.upload({auth:f.store.auth},f.project.id,'RECEIVING_DELIVERY',id,f.documentType.id,{originalname:purpose+'.pdf',mimetype:'application/pdf',size:bytes.length,buffer:bytes});
  docs.push({id:doc.id,bytes:bytes.toString('base64')});
  await service.attach({auth:f.store.auth},id,await command({documentId:doc.id,purpose,signedEvidenceConfirmed:purpose==='RECEIVER_SIGNATURE'}));
 }
 let grId:string|null=null;
 if(post){
  const d=await service.get(f.store.auth,id);
  await service.link({auth:f.store.auth},id,await command({purchaseOrderId:f.po.id,lines:[{id:d.lines[0]!.id,purchaseOrderLineId:f.po.lines[0]!.id}]}));
  await service.check({auth:f.jai.auth},id,await command({decision:'ACCEPT'}));
  const checked=await service.get(f.store.auth,id);
  const gr=await receipts.create({auth:f.store.auth},{requestKey:randomUUID(),expectedDeliveryVersion:checked.version,deliveryId:id,projectId:f.project.id,purchaseOrderId:f.po.id,warehouseId:f.warehouse.id,lines:[{purchaseOrderLineId:f.po.lines[0]!.id,quantity:new Prisma.Decimal(3)}]});grId=gr.id;
  await receipts.submit({auth:f.store.auth},gr.id,f.receiptWorkflow.workflowCode);await receipts.approve({auth:f.pm.auth},gr.id,randomUUID(),'Synthetic canonical GR approval');
 }
 return {f,id,grId,docs};
}
