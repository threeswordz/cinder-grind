import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NestFactory} from '@nestjs/core';
import {AppModule} from '../app.module';
import {PrismaService} from '../prisma/prisma.service';
import {ProblemDetailsFilter} from '../common/problem-details.filter';
import {securityHeadersMiddleware} from '../common/security-headers';
import {DocumentTargetsService} from '../documents/document-targets.service';
import {InventoryQuantityService} from './inventory-quantity.service';
import {receivingFixture} from './receiving-test-fixture';

test('receiving actual HTTP holds physical goods until independent evidence check and canonical approved GR',async t=>{
 const target=new URL(process.env.DATABASE_URL??'');assert.ok(['127.0.0.1','localhost'].includes(target.hostname));
 assert.ok(target.pathname==='/erp_validation'&&target.username==='erp_validation'||/^\/(?:construction_erp|receiving_[a-f0-9]{32}|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/.test(target.pathname));
 const oldStorage=process.env.STORAGE_ROOT,storage=await mkdtemp(join(tmpdir(),'receiving-http-'));process.env.STORAGE_ROOT=storage;
 const db=new PrismaService();await db.$connect();
 const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(0,'127.0.0.1');
 try{
  const f=await receivingFixture(db),base=await app.getUrl()+'/api/v1',root='/inventory/receiving',targets=app.get(DocumentTargetsService);
  type Actor=typeof f.store;
  async function call(actor:Actor|null,path:string,status=200,body?:unknown,csrf=true):Promise<any>{
   const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(actor?{Cookie:'erp_session='+actor.session.sessionToken}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...(actor&&csrf?{'x-csrf-token':actor.session.csrfToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const value:any=await r.json();assert.equal(r.status,status,path+' '+JSON.stringify(value));return value.data;
  }
  const quantities=new InventoryQuantityService(db),dimension={companyId:f.company.id,projectId:f.project.id,warehouseId:f.warehouse.id,materialId:f.material.id,uomId:f.uom.id};
  const balance=async()=>(await quantities.onHand(db,dimension)).toFixed(4);
  const financial=async()=>[await db.directCostPosting.count({where:{companyId:f.company.id}}),await db.payment.count({where:{companyId:f.company.id}})];
  const beforeFinance=await financial();let id='';
  const detail=()=>call(f.store,root+'/deliveries/'+id);
  const cmd=(version:number,extra={})=>({requestKey:randomUUID(),expectedVersion:version,reason:'Synthetic actual custody action',...extra});
  await t.test('live session, assignment, CSRF and explicit Project policy gate capture',async()=>{
   await call(null,root+'/projects',401);await call(f.store,root+'/deliveries',403,f.input(),false);
   await call(f.outsider,root+'/projects/'+f.project.id+'/deliveries',403);
   await call(f.store,root+'/deliveries',409,f.input());
   const enable={requestKey:randomUUID(),reason:'Enable only this synthetic receipt site'};
   await call(f.store,root+'/projects/'+f.project.id+'/enable',403,enable);
   assert.deepEqual(await call(f.config,root+'/projects/'+f.project.id+'/enable',201,enable),await call(f.config,root+'/projects/'+f.project.id+'/enable',201,enable));
   await call(f.store,root+'/deliveries',422,f.input({usable:true}));
   await call(f.store,root+'/projects/'+f.unassigned.id+'/deliveries',403);
   await call(f.store,root+'/deliveries/'+randomUUID(),404);
   const foreign=await db.company.create({data:{companyCode:'RC-F-'+randomUUID(),companyName:'Foreign synthetic'}}),vendor=await db.supplier.create({data:{companyId:foreign.id,supplierCode:'FOREIGN',supplierName:'Foreign supplier'}});
   await call(f.store,root+'/deliveries',422,f.input({supplierId:vendor.id}));
   const prePoSupplier=await db.supplier.create({data:{companyId:f.company.id,supplierCode:'NO-PO',supplierName:'Supplier without any PO'}});
   assert.equal(await db.purchaseOrder.count({where:{supplierId:prePoSupplier.id}}),0);
   const prePo=await call(f.store,root+'/deliveries',201,f.input({supplierId:prePoSupplier.id}));
   const held=await call(f.store,root+'/deliveries/'+prePo.id);assert.equal(held.purchaseOrderId,null);assert.equal(held.usable,false);assert.equal(await balance(),'0.0000');
  });
  await t.test('concurrent capture is one immutable effect, overdue never becomes stock',async()=>{
   const body=f.input({receivedAt:new Date(Date.now()-49*3600000).toISOString()});
   const [a,b]=await Promise.all([call(f.store,root+'/deliveries',201,body),call(f.store,root+'/deliveries',201,body)]);assert.deepEqual(a,b);id=a.id;
   await call(f.store,root+'/deliveries',409,{...body,reason:'Different under same key'});
   const d=await detail();assert.equal(d.deadline,'OVERDUE');assert.equal(d.usable,false);assert.equal(d.lines[0].heldQuantity,'4.0000');assert.equal(await balance(),'0.0000');
   assert.equal(await db.stockTransaction.count({where:{companyId:f.company.id}}),0);assert.deepEqual(await financial(),beforeFinance);
   assert.doesNotMatch(JSON.stringify(d),/passwordHash|storageKey|bodyDigest|csrfTokenHash/);
   await assert.rejects(()=>db.receivingDelivery.update({where:{id},data:{receivedAt:new Date(),poLinkDueAt:new Date(Date.now()+48*3600000),version:{increment:1}}}));
   const d2=await call(f.viewer,root+'/deliveries/'+id);assert.equal(d2.goodsReceipt,null);
  });
  await t.test('approved PO mapping, complete evidence and a separate Jai check are mandatory',async()=>{
   const d=await detail(),line=d.lines[0];
   await call(f.jai,root+'/deliveries/'+id+'/check',409,cmd(d.version,{decision:'ACCEPT'}));
   await call(f.store,root+'/deliveries/'+id+'/link-po',422,cmd(d.version,{purchaseOrderId:randomUUID(),lines:[{id:line.id,purchaseOrderLineId:f.po.lines[0]!.id}]}));
   await call(f.store,root+'/deliveries/'+id+'/link-po',409,cmd(999,{purchaseOrderId:f.po.id,lines:[{id:line.id,purchaseOrderLineId:f.po.lines[0]!.id}]}));
   const body=cmd(d.version,{purchaseOrderId:f.po.id,lines:[{id:line.id,purchaseOrderLineId:f.po.lines[0]!.id}]});await call(f.store,root+'/deliveries/'+id+'/link-po',201,body);
   await call(f.store,root+'/deliveries/'+id+'/link-po',201,body);
   assert.equal((await detail()).deadline,'LINKED_LATE');
   await call(f.jai,root+'/deliveries/'+id+'/check',422,cmd((await detail()).version,{decision:'ACCEPT'}));
   for(const purpose of ['DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO']){
    const bytes=Buffer.from('%PDF-1.4\nSynthetic '+purpose+' physical evidence\n');
    const doc=await targets.upload({auth:f.store.auth},f.project.id,'RECEIVING_DELIVERY',id,f.documentType.id,{originalname:purpose+'.pdf',mimetype:'application/pdf',size:bytes.length,buffer:bytes});
    const version=(await detail()).version;
    if(purpose==='RECEIVER_SIGNATURE')await call(f.store,root+'/deliveries/'+id+'/evidence',422,cmd(version,{documentId:doc.id,purpose,signedEvidenceConfirmed:false}));
    await call(f.store,root+'/deliveries/'+id+'/evidence',201,cmd(version,{documentId:doc.id,purpose,signedEvidenceConfirmed:purpose==='RECEIVER_SIGNATURE'}));
   }
   const version=(await detail()).version;
   // Holding both permissions never authorizes the delivery creator to self-check.
   const checkPermission=await db.permission.findUniqueOrThrow({where:{permissionCode:'inventory.receiving.check'}});
   await db.rolePermission.create({data:{roleId:f.store.role.id,permissionId:checkPermission.id}});
   await call(f.store,root+'/deliveries/'+id+'/check',403,cmd(version,{decision:'ACCEPT'}));
   await db.rolePermission.delete({where:{roleId_permissionId:{roleId:f.store.role.id,permissionId:checkPermission.id}}});
   const evidenceId=(await detail()).evidence[0].documentId;
   const evidenceRow=await db.document.findUniqueOrThrow({where:{id:evidenceId}}),path=join(storage,evidenceRow.storageKey),originalBytes=await readFile(path);
   await writeFile(path,Buffer.from('tampered evidence bytes'));
   await call(f.jai,root+'/deliveries/'+id+'/check',422,cmd(version,{decision:'ACCEPT'}));
   await writeFile(path,originalBytes);

   await call(f.jai,root+'/deliveries/'+id+'/check',201,cmd(version,{decision:'ACCEPT'}));
   const checked=await detail();assert.equal(checked.status,'CHECKED');assert.equal(checked.usable,false);assert.equal(await balance(),'0.0000');
   assert.ok((await call(f.viewer,root+'/deliveries/'+id)).evidence.every((e:any)=>e.documentId===null&&e.checksum===null&&e.fileName===null));
  });
  let grId='';
  await t.test('GR creation uses exact checked quantities; draft and submission cannot release stock',async()=>{
   const d=await detail(),body={projectId:f.project.id,purchaseOrderId:f.po.id,warehouseId:f.warehouse.id,lines:[{purchaseOrderLineId:f.po.lines[0]!.id,quantity:'3.0000'}]};
   await call(f.store,'/inventory/goods-receipts',409,body);
   await call(f.store,'/inventory/goods-receipts',422,{...body,deliveryId:id,requestKey:randomUUID(),expectedDeliveryVersion:d.version,lines:[{...body.lines[0],quantity:'4'}]});
   const intent={...body,deliveryId:id,requestKey:randomUUID(),expectedDeliveryVersion:d.version};
   const [a,b]=await Promise.all([call(f.store,'/inventory/goods-receipts',201,intent),call(f.store,'/inventory/goods-receipts',201,intent)]);assert.deepEqual(a,b);grId=a.id;
   assert.equal(await db.goodsReceipt.count({where:{deliveryId:id}}),1);
   await call(f.store,root+'/deliveries/'+id+'/void',201,cmd(d.version));
   await call(f.store,'/inventory/goods-receipts/'+grId+'/submit',409,{workflowCode:f.receiptWorkflow.workflowCode});
   // Voided draft source remains historical; a corrected replacement preserves its origin clock.
   const old=await detail();const corrected=await call(f.store,root+'/deliveries',201,f.input({supersedesId:id,receivedAt:old.receivedAt}));
   const replacement=await call(f.store,root+'/deliveries/'+corrected.id);assert.equal(replacement.receivedAt,old.receivedAt);assert.equal(replacement.poLinkDueAt,old.poLinkDueAt);assert.equal(replacement.deadline,'OVERDUE');
   assert.equal(await balance(),'0.0000');
   id=corrected.id;
   let live=await detail();
   await call(f.store,root+'/deliveries/'+id+'/link-po',201,cmd(live.version,{purchaseOrderId:f.po.id,lines:[{id:live.lines[0].id,purchaseOrderLineId:f.po.lines[0]!.id}]}));
   for(const purpose of ['DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO']){
    const bytes=Buffer.from('%PDF-1.4\nReplacement '+purpose+' evidence\n');
    const doc=await targets.upload({auth:f.store.auth},f.project.id,'RECEIVING_DELIVERY',id,f.documentType.id,{originalname:purpose+'.pdf',mimetype:'application/pdf',size:bytes.length,buffer:bytes});
    await call(f.store,root+'/deliveries/'+id+'/evidence',201,cmd((await detail()).version,{documentId:doc.id,purpose,signedEvidenceConfirmed:purpose==='RECEIVER_SIGNATURE'}));
   }
   await call(f.jai,root+'/deliveries/'+id+'/check',201,cmd((await detail()).version,{decision:'ACCEPT'}));
   live=await detail();
   const accepted=await call(f.store,'/inventory/goods-receipts',201,{...body,deliveryId:id,requestKey:randomUUID(),expectedDeliveryVersion:live.version});grId=accepted.id;
   assert.equal(await balance(),'0.0000');
   await call(f.store,'/inventory/goods-receipts/'+grId+'/submit',201,{workflowCode:f.receiptWorkflow.workflowCode});
   assert.equal(await balance(),'0.0000');
   await call(f.store,'/inventory/goods-receipts/'+grId+'/approve',403,{postKey:randomUUID()});
   const posting={postKey:randomUUID()};await call(f.pm,'/inventory/goods-receipts/'+grId+'/approve',201,posting);await call(f.pm,'/inventory/goods-receipts/'+grId+'/approve',201,posting);
   assert.equal(await balance(),'3.0000');assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:grId}}),1);
   live=await detail();assert.equal(live.usable,true);assert.equal(live.lines[0].heldQuantity,'1.0000');assert.deepEqual(await financial(),beforeFinance);
   await assert.rejects(()=>db.receivingDeliveryEvent.updateMany({where:{deliveryId:id},data:{note:'Rewritten'}}));
   await assert.rejects(()=>db.goodsReceiptItem.update({where:{id:accepted.items[0].id},data:{quantity:'4'}}));
   await assert.rejects(()=>db.document.update({where:{id:live.evidence[0].documentId},data:{checksum:'0'.repeat(64)}}));
   // Revocation and archived evidence cannot prevent a reasoned reversal of existing stock.
   await db.userSession.updateMany({where:{userId:f.jai.user.id},data:{revokedAt:new Date()}});
   await db.document.update({where:{id:live.evidence[0].documentId},data:{isActive:false}});
   const reverse={reversalKey:randomUUID(),reason:'Synthetic physical return reversal'};
   await call(f.store,'/inventory/goods-receipts/'+grId+'/reverse',201,reverse);await call(f.store,'/inventory/goods-receipts/'+grId+'/reverse',201,reverse);
   assert.equal(await balance(),'0.0000');assert.equal((await detail()).usable,false);assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:grId}}),2);
   await call(f.jai,root+'/deliveries/'+id,401);
  });
 }finally{await app.close();await db.$disconnect();if(oldStorage===undefined)delete process.env.STORAGE_ROOT;else process.env.STORAGE_ROOT=oldStorage;await rm(storage,{recursive:true,force:true});}
});
