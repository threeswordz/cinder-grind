import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AppModule } from '../app.module';
import { AuditService } from '../audit/audit.service';
import { ApprovalService } from '../approval/approval.service';
import { PrismaService } from '../prisma/prisma.service';
import { GoodsReceiptService } from './goods-receipt.service';
import { MovementCorrectionService } from './movement-correction.service';
import { receivingFixture } from './receiving-test-fixture';
import { transferCustodyFixture } from './transfer-custody-test-fixture';
import { DocumentTargetsService } from '../documents/document-targets.service';
import { StockTransferService } from './stock-transfer.service';
import { materialPlanIssueFixture } from './material-plan-issue-test-fixture';

test('SS16 draft: immutable correction request, configured PM decision and atomic canonical GR reversal', async () => {
  const expected = process.env.M6_SS16_DISPOSABLE_DB;
  assert.match(expected ?? '', /^m6_ss16_[a-f0-9]{8}$/);
  const db = new PrismaService();
  await db.$connect();
  const previous = process.env.STORAGE_ROOT;
  let storage: string | undefined;
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    const identity = await db.$queryRaw<Array<{name:string}>>`SELECT current_database() AS name`;
    assert.equal(identity[0]?.name, expected);
    storage = await mkdtemp(join(tmpdir(), 'm6-ss16-'));
    process.env.STORAGE_ROOT = storage;
    app = await NestFactory.create(AppModule, {logger:false});
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    const post = (path: string, session: {sessionToken:string;csrfToken:string} | null, body: unknown, csrf = true) =>
      fetch(origin + '/inventory/' + path, { method:'POST', headers:{'content-type':'application/json',
        ...(session ? {cookie:'erp_session='+session.sessionToken} : {}),
        ...(session && csrf ? {'x-csrf-token':session.csrfToken} : {})}, body:JSON.stringify(body) });
    const get = (path: string, session: {sessionToken:string} | null) =>
      fetch(origin + '/inventory/' + path, {headers:session ? {cookie:'erp_session='+session.sessionToken} : {}});
    const f = await receivingFixture(db);
    await db.role.update({where:{id:f.store.role.id},data:{roleCode:'STOREKEEPER'}});
    await db.role.update({where:{id:f.pm.role.id},data:{roleCode:'PROJECT_MANAGER'}});
    const reverse = await db.permission.findUniqueOrThrow({where:{permissionCode:'inventory.receipt.reverse'}});
    // Explicit synthetic grant for this test only, not retained configuration.
    await db.rolePermission.create({data:{roleId:f.pm.role.id,permissionId:reverse.id}});
    const store = await f.sessions.resolve(f.store.session.sessionToken);
    const pm = await f.sessions.resolve(f.pm.session.sessionToken);
    assert.ok(store && pm);
    const goods = app.get(GoodsReceiptService), corrections = app.get(MovementCorrectionService);
    const receipt = await goods.create({auth:store}, {projectId:f.project.id,purchaseOrderId:f.po.id,
      warehouseId:f.warehouse.id,lines:[{purchaseOrderLineId:f.po.lines[0]!.id,quantity:new Prisma.Decimal('2')}]});
    await goods.submit({auth:store},receipt.id,f.receiptWorkflow.workflowCode);
    await goods.approve({auth:pm},receipt.id,randomUUID());
    const stock = async () => db.stockTransaction.count({where:{goodsReceiptId:receipt.id}});
    assert.equal(await stock(),1);
    const key = randomUUID(), reason = 'Synthetic incorrect receipt correction';
    const request = () => corrections.request({auth:store},'GOODS_RECEIPT',receipt.id,key,reason);
    await assert.rejects(request(), (err: any) => err.getResponse?.()?.code === 'SS16_CONFIGURED_PM_STEP_REQUIRED');
    assert.equal(await db.movementCorrectionRequest.count({where:{companyId:f.company.id}}),0);
    await db.approvalWorkflow.create({data:{companyId:f.company.id,workflowCode:'SS16_MOVEMENT_CORRECTION',
      entityType:'MOVEMENT_CORRECTION',workflowName:'Synthetic correction review',
      steps:{create:[{stepNo:1,stepName:'Independent PM',requiredApprovals:1,stepRoles:{create:[{roleId:f.pm.role.id}]}}]}}});
    const requestPath = 'movement-corrections/sources/GOODS_RECEIPT/'+receipt.id+'/requests';
    const requestBody = {requestKey:key,reason};
    assert.equal((await post(requestPath,null,requestBody)).status,401);
    assert.equal((await post(requestPath,f.store.session,requestBody,false)).status,403);
    assert.equal((await post(requestPath,f.pm.session,requestBody)).status,403);
    const legacy = await post('goods-receipts/'+receipt.id+'/reverse',f.pm.session,{reversalKey:randomUUID(),reason});
    assert.equal(legacy.status,409);
    assert.equal(await stock(),1,'Legacy route must not mutate stock');
    const created = await post(requestPath,f.store.session,requestBody);
    const createdText = await created.text();
    assert.equal(created.status,201,createdText);
    const pending = await request();
    assert.equal(JSON.parse(createdText).data.id,pending.id);
    assert.equal((await get(requestPath,null)).status,401);
    for (const actor of [f.store,f.pm]) {
      const listed = await get(requestPath,actor.session);
      const body = await listed.text();
      assert.equal(listed.status,200,body);
      const rows = JSON.parse(body).data;
      assert.equal(rows.length,1);
      assert.equal(rows[0].id,pending.id);
      assert.equal(rows[0].approvalInstance.approvalState,'SUBMITTED');
      assert.equal(Object.hasOwn(rows[0],'requestKey'),false);
      assert.deepEqual(rows[0].approvalInstance.actions,[]);
    }
    const unauthorizedRead = await get(requestPath,f.viewer.session);
    assert.ok([403,404].includes(unauthorizedRead.status));
    assert.equal(pending.approvalInstance.approvalState,'SUBMITTED');
    assert.equal((await request()).id,pending.id);
    await assert.rejects(corrections.request({auth:store},'GOODS_RECEIPT',receipt.id,key,'Changed reason'));
    await assert.rejects(corrections.request({auth:store},'GOODS_RECEIPT',receipt.id,randomUUID(),reason));
    await assert.rejects(corrections.decide({auth:store},pending.id,'APPROVE','Self approval'));
    await assert.rejects(db.movementCorrectionRequest.update({where:{id:pending.id},data:{reason:'Rewrite'}}));
    await assert.rejects(db.movementCorrectionRequest.delete({where:{id:pending.id}}));
    assert.equal(await stock(),1);
    const audit = app.get(AuditService), original = audit.record.bind(audit);
    audit.record = async (input, tx) => {
      if (input.entityType === 'MOVEMENT_CORRECTION' && input.action === 'APPROVE') throw new Error('Synthetic final audit failure');
      return original(input,tx);
    };
    try {
      await assert.rejects(corrections.decide({auth:pm},pending.id,'APPROVE','Review accepted'), /Synthetic final audit failure/);
    } finally { audit.record = original; }
    assert.equal(await stock(),1,'Canonical reversal must roll back with the failed decision');
    assert.equal((await db.goodsReceipt.findUniqueOrThrow({where:{id:receipt.id}})).reversedAt,null);
    assert.equal((await db.approvalInstance.findUniqueOrThrow({where:{id:pending.approvalInstanceId}})).approvalState,'SUBMITTED');
    assert.equal(await db.approvalAction.count({where:{approvalInstanceId:pending.approvalInstanceId}}),0);
    await db.rolePermission.delete({where:{roleId_permissionId:{roleId:f.pm.role.id,permissionId:reverse.id}}});
    try { await assert.rejects(corrections.decide({auth:pm},pending.id,'APPROVE','Stale grant')); }
    finally { await db.rolePermission.create({data:{roleId:f.pm.role.id,permissionId:reverse.id}}); }
    const approvePath = 'movement-corrections/'+pending.id+'/approve';
    assert.equal((await post(approvePath,f.store.session,{comment:'Self approval'})).status,403);
    assert.equal((await post(approvePath,f.pm.session,{comment:'Missing CSRF'},false)).status,403);
    assert.equal(await stock(),1);
    const approved = await post(approvePath,f.pm.session,{comment:'Independent review accepted'});
    const approvedText = await approved.text();
    assert.equal(approved.status,201,approvedText);
    const result = JSON.parse(approvedText).data;
    assert.equal(result.approvalInstance.approvalState,'APPROVED');
    for(const actor of [f.store,f.pm]){
      const history=await get(requestPath,actor.session);
      assert.equal(history.status,200);
      const rows=(await history.json() as any).data;
      const actions=rows[0].approvalInstance.actions;
      assert.equal(actions.length,1);
      assert.equal(actions[0].action,'APPROVE');
      assert.equal(actions[0].actionByUserId,pm.userId);
      assert.equal(actions[0].comment,'Independent review accepted');
      assert.ok(Number.isFinite(Date.parse(actions[0].actionAt)));
      assert.deepEqual(Object.keys(actions[0].actionByUser),['displayName']);
      assert.equal(actions[0].actionByUser.displayName,f.pm.user.displayName);
    }
    const reversed = await db.goodsReceipt.findUniqueOrThrow({where:{id:receipt.id}});
    assert.equal(reversed.reversalReason,reason);
    assert.equal(reversed.reversalKey,'ss16:'+pending.id);
    assert.equal(reversed.reversedByUserId,pm.userId);
    assert.ok(reversed.reversedAt);
    assert.equal(await stock(),2);
    const movement = await db.stockTransaction.aggregate({where:{goodsReceiptId:receipt.id},_sum:{quantity:true}});
    assert.equal(movement._sum.quantity?.toString(),'0');
    await assert.rejects(corrections.decide({auth:pm},pending.id,'APPROVE','Replay'));
    assert.equal(await stock(),2);

    // New bounded unposted cancellation: original approval is retained and cancelled,
    // never a synthetic reversal of stock that did not exist.
    const draft = await goods.create({auth:store}, {projectId:f.project.id,purchaseOrderId:f.po.id,
      warehouseId:f.warehouse.id,lines:[{purchaseOrderLineId:f.po.lines[0]!.id,quantity:new Prisma.Decimal('1')}]});
    const cancelPath = 'movement-corrections/sources/GOODS_RECEIPT/'+draft.id+'/cancellation-requests';
    const cancelBody = {requestKey:randomUUID(),reason:'Synthetic submitted receipt correction'};
    assert.equal((await post(cancelPath,f.store.session,cancelBody)).status,409);
    await goods.submit({auth:store},draft.id,f.receiptWorkflow.workflowCode);
    const originalReceipt = await db.goodsReceipt.findUniqueOrThrow({where:{id:draft.id}});
    assert.ok(originalReceipt.approvalInstanceId);
    const cancelledStock = () => db.stockTransaction.count({where:{goodsReceiptId:draft.id}});
    const originalState = async () => (await db.approvalInstance.findUniqueOrThrow({where:{id:originalReceipt.approvalInstanceId!}})).approvalState;
    assert.equal(await cancelledStock(),0);
    const cancelResponse = await post(cancelPath,f.store.session,cancelBody);
    const cancelText = await cancelResponse.text();
    assert.equal(cancelResponse.status,201,cancelText);
    const cancel = JSON.parse(cancelText).data;
    assert.equal(cancel.sourcePostedAt,null);
    assert.equal(cancel.sourceApprovalInstanceId,originalReceipt.approvalInstanceId);
    assert.equal(await originalState(),'SUBMITTED');
    await assert.rejects(corrections.request({auth:store},'GOODS_RECEIPT',draft.id,cancelBody.requestKey,cancelBody.reason));
    assert.equal((await post('movement-corrections/'+cancel.id+'/approve',f.store.session,{comment:'Self approve'})).status,403);
    const rejection = await post('movement-corrections/'+cancel.id+'/reject',f.pm.session,{comment:'Not justified'});
    assert.equal(rejection.status,201,await rejection.text());
    assert.equal(await originalState(),'SUBMITTED');
    const approvedCancel = await corrections.request({auth:store},'GOODS_RECEIPT',draft.id,randomUUID(),cancelBody.reason,'CANCEL_UNPOSTED');
    audit.record = async (input, tx) => {
      if (input.entityType === 'MOVEMENT_CORRECTION' && input.action === 'APPROVE') throw new Error('Synthetic cancellation audit failure');
      return original(input,tx);
    };
    try { await assert.rejects(corrections.decide({auth:pm},approvedCancel.id,'APPROVE','Reviewed'), /Synthetic cancellation audit failure/); }
    finally { audit.record = original; }
    assert.equal(await originalState(),'SUBMITTED');
    assert.equal((await db.approvalInstance.findUniqueOrThrow({where:{id:approvedCancel.approvalInstanceId}})).approvalState,'SUBMITTED');
    assert.equal(await cancelledStock(),0);
    const cancellation = await post('movement-corrections/'+approvedCancel.id+'/approve',f.pm.session,{comment:'Reviewed and approved'});
    assert.equal(cancellation.status,201,await cancellation.text());
    assert.equal(await originalState(),'CANCELLED');
    assert.equal(await cancelledStock(),0);
    assert.deepEqual(await db.goodsReceipt.findUniqueOrThrow({where:{id:draft.id}}),originalReceipt);
    await assert.rejects(goods.approve({auth:pm},draft.id,randomUUID()));
    assert.equal(await cancelledStock(),0);
    assert.equal(await db.approvalAction.count({where:{approvalInstanceId:originalReceipt.approvalInstanceId!,action:'CANCEL'}}),1);
    await assert.rejects(corrections.decide({auth:pm},approvedCancel.id,'APPROVE','Replay'));
    const sameCancellation = await corrections.request({auth:store},'GOODS_RECEIPT',draft.id,cancelBody.requestKey,cancelBody.reason,'CANCEL_UNPOSTED');
    assert.equal(sameCancellation.id,cancel.id,'Original rejected request remains the exact replay result');
    await assert.rejects(corrections.request({auth:store},'GOODS_RECEIPT',draft.id,randomUUID(),cancelBody.reason,'CANCEL_UNPOSTED'));
    const staleDraft = await goods.create({auth:store}, {projectId:f.project.id,purchaseOrderId:f.po.id,
      warehouseId:f.warehouse.id,lines:[{purchaseOrderLineId:f.po.lines[0]!.id,quantity:new Prisma.Decimal('1')}]});
    await goods.submit({auth:store},staleDraft.id,f.receiptWorkflow.workflowCode);
    const staleRequest = await corrections.request({auth:store},'GOODS_RECEIPT',staleDraft.id,randomUUID(),cancelBody.reason,'CANCEL_UNPOSTED');
    await goods.approve({auth:pm},staleDraft.id,randomUUID());
    await assert.rejects(corrections.decide({auth:pm},staleRequest.id,'APPROVE','Source already posted'),
      (err: any) => err.getResponse?.()?.code === 'SS16_UNPOSTED_SUBMITTED_SOURCE_REQUIRED');
    assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:staleDraft.id}}),1);
    assert.equal((await db.approvalInstance.findUniqueOrThrow({where:{id:staleRequest.approvalInstanceId}})).approvalState,'SUBMITTED');
    await corrections.decide({auth:pm},staleRequest.id,'REJECT','Source already posted; correction must be a separate reversal');
    assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:staleDraft.id}}),1);
    // Separate synthetic Company: controlled receiving has its own original
    // physical delivery, evidence and deadline, all preserved by GR cancellation.
    const rc = await receivingFixture(db);
    const prepareActors = async (fixture: Awaited<ReturnType<typeof receivingFixture>>, permissionCode: string) => {
      await db.role.update({where:{id:fixture.store.role.id},data:{roleCode:'STOREKEEPER'}});
      await db.role.update({where:{id:fixture.pm.role.id},data:{roleCode:'PROJECT_MANAGER'}});
      const permission = await db.permission.findUniqueOrThrow({where:{permissionCode}});
      await db.rolePermission.createMany({data:[{roleId:fixture.pm.role.id,permissionId:permission.id}],skipDuplicates:true});
      await db.approvalWorkflow.create({data:{companyId:fixture.company.id,workflowCode:'SS16_MOVEMENT_CORRECTION',
        entityType:'MOVEMENT_CORRECTION',workflowName:'Synthetic correction review',
        steps:{create:[{stepNo:1,stepName:'Independent PM',requiredApprovals:1,stepRoles:{create:[{roleId:fixture.pm.role.id}]}}]}}});
    };
    await prepareActors(rc,'inventory.receipt.reverse');
    const rcStore = await rc.sessions.resolve(rc.store.session.sessionToken);
    const rcPm = await rc.sessions.resolve(rc.pm.session.sessionToken);
    assert.ok(rcStore && rcPm);
    const okPost = async (path: string, actor: typeof rc.store, body: unknown) => {
      const response = await post(path,actor.session,body);
      const raw = await response.text();
      assert.equal(response.status,201,path+' '+raw);
      return JSON.parse(raw).data;
    };
    const root = 'receiving/deliveries';
    await okPost('receiving/projects/'+rc.project.id+'/enable',rc.config,{requestKey:randomUUID(),reason:'Disposable controlled receiving'});
    const delivery = await okPost(root,rc.store,rc.input());
    const readDelivery = async () => {
      const response = await get(root+'/'+delivery.id,rc.store.session);
      assert.equal(response.status,200);
      return JSON.parse(await response.text()).data;
    };
    const command = async (extra: Record<string,unknown> = {}) => ({requestKey:randomUUID(),
      expectedVersion:(await readDelivery()).version,reason:'Synthetic source evidence action',...extra});
    const captured = await readDelivery();
    await okPost(root+'/'+delivery.id+'/link-po',rc.store,await command({purchaseOrderId:rc.po.id,
      lines:[{id:captured.lines[0].id,purchaseOrderLineId:rc.po.lines[0]!.id}]}));
    const targets = app.get(DocumentTargetsService);
    for (const purpose of ['DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO']) {
      const bytes = Buffer.from('%PDF-1.4\\nSynthetic SS16 '+purpose+'\\n');
      const doc = await targets.upload({auth:rcStore},rc.project.id,'RECEIVING_DELIVERY',delivery.id,rc.documentType.id,
        {originalname:purpose+'.pdf',mimetype:'application/pdf',size:bytes.length,buffer:bytes});
      await okPost(root+'/'+delivery.id+'/evidence',rc.store,await command({documentId:doc.id,purpose,signedEvidenceConfirmed:purpose==='RECEIVER_SIGNATURE'}));
    }
    await okPost(root+'/'+delivery.id+'/check',rc.jai,await command({decision:'ACCEPT'}));
    const checked = await readDelivery();
    const linked = await goods.create({auth:rcStore},{projectId:rc.project.id,purchaseOrderId:rc.po.id,
      warehouseId:rc.warehouse.id,deliveryId:delivery.id,requestKey:randomUUID(),expectedDeliveryVersion:checked.version,
      lines:[{purchaseOrderLineId:rc.po.lines[0]!.id,quantity:new Prisma.Decimal('3')}]});
    await goods.submit({auth:rcStore},linked.id,rc.receiptWorkflow.workflowCode);
    const physicalBefore = await db.receivingDelivery.findUniqueOrThrow({where:{id:delivery.id}});
    const physicalEvents = await db.receivingDeliveryEvent.count({where:{deliveryId:delivery.id}});
    const physicalEvidence = await db.receivingDeliveryEvidence.count({where:{deliveryId:delivery.id}});
    const voidIntent = await command();
    assert.equal((await post(root+'/'+delivery.id+'/void',rc.store.session,voidIntent)).status,409);
    const rcCancel = await corrections.request({auth:rcStore},'GOODS_RECEIPT',linked.id,randomUUID(),'Incorrect submitted GR','CANCEL_UNPOSTED');
    assert.equal((await post(root+'/'+delivery.id+'/void',rc.store.session,voidIntent)).status,409);
    await corrections.decide({auth:rcPm},rcCancel.id,'APPROVE','Independent GR cancellation');
    assert.deepEqual(await db.receivingDelivery.findUniqueOrThrow({where:{id:delivery.id}}),physicalBefore);
    assert.equal(await db.receivingDeliveryEvent.count({where:{deliveryId:delivery.id}}),physicalEvents);
    assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:linked.id}}),0);
    await assert.rejects(goods.approve({auth:rcPm},linked.id,randomUUID()));
    await okPost(root+'/'+delivery.id+'/void',rc.store,voidIntent);
    const voided = await readDelivery();
    assert.equal(voided.status,'VOID');
    assert.equal(voided.receivedAt,checked.receivedAt);
    assert.equal(voided.poLinkDueAt,checked.poLinkDueAt);
    assert.equal(await db.receivingDeliveryEvidence.count({where:{deliveryId:delivery.id}}),physicalEvidence);
    assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:linked.id}}),0);
    const replacement = await okPost(root,rc.store,rc.input({supersedesId:delivery.id,receivedAt:checked.receivedAt}));
    const replacementRow = await db.receivingDelivery.findUniqueOrThrow({where:{id:replacement.id}});
    assert.equal(replacementRow.receivedAt.toISOString(),checked.receivedAt);
    assert.equal(replacementRow.poLinkDueAt.toISOString(),checked.poLinkDueAt);

    // Separate synthetic transfer custody with real canonical source stock.
    const tf = await transferCustodyFixture(db,app);
    await prepareActors(tf,'inventory.transfer.reverse');
    const tStore = await tf.sessions.resolve(tf.store.session.sessionToken);
    const tPm = await tf.sessions.resolve(tf.pm.session.sessionToken);
    assert.ok(tStore && tPm);
    // Legacy paired transfer is a separate posted reversal journey before enabling custody.
    const legacyTransfer = await okPost('stock-transfers',tf.store,tf.transferInput);
    await okPost('stock-transfers/'+legacyTransfer.id+'/submit',tf.store,{workflowCode:tf.workflow.workflowCode});
    await okPost('stock-transfers/'+legacyTransfer.id+'/approve',tf.pm,{postKey:randomUUID()});
    assert.equal(await db.stockTransaction.count({where:{stockTransferId:legacyTransfer.id}}),2);
    assert.equal((await post('stock-transfers/'+legacyTransfer.id+'/reverse',tf.pm.session,{reversalKey:randomUUID(),reason:'Bypass'})).status,409);
    const legacyRequest = await corrections.request({auth:tStore},'STOCK_TRANSFER',legacyTransfer.id,randomUUID(),'Incorrect paired transfer');
    await corrections.decide({auth:tPm},legacyRequest.id,'APPROVE','Independent exact reversal');
    assert.equal(await db.stockTransaction.count({where:{stockTransferId:legacyTransfer.id}}),4);
    const transferNet = await db.stockTransaction.aggregate({where:{stockTransferId:legacyTransfer.id},_sum:{quantity:true}});
    assert.equal(transferNet._sum.quantity?.toString(),'0');
    await okPost('transfer-custody/projects/'+tf.project.id+'/enable',tf.pm,{requestKey:randomUUID(),reason:'Disposable transfer policy'});
    const transfer = await okPost('stock-transfers',tf.store,tf.transferInput);
    await okPost('stock-transfers/'+transfer.id+'/submit',tf.store,{workflowCode:tf.workflow.workflowCode});
    const custodyBefore = await db.transferCustody.findUniqueOrThrow({where:{transferId:transfer.id}});
    const transferHeader = await db.stockTransfer.findUniqueOrThrow({where:{id:transfer.id}});
    assert.ok(transferHeader.approvalInstanceId);
    const transferCorrection = await corrections.request({auth:tStore},'STOCK_TRANSFER',transfer.id,randomUUID(),'Wrong destination','CANCEL_UNPOSTED');
    await db.projectMember.deleteMany({where:{projectId:tf.unassigned.id,employeeId:tf.pm.employee.id}});
    try { await assert.rejects(corrections.decide({auth:tPm},transferCorrection.id,'APPROVE','Missing destination scope')); }
    finally { await db.projectMember.create({data:{projectId:tf.unassigned.id,employeeId:tf.pm.employee.id,projectRole:'Synthetic destination'}}); }
    assert.equal((await db.approvalInstance.findUniqueOrThrow({where:{id:transferHeader.approvalInstanceId!}})).approvalState,'SUBMITTED');
    const custodyResult = await corrections.decide({auth:tPm},transferCorrection.id,'APPROVE','Independent transfer cancellation');
    assert.equal(custodyResult.approvalInstance.approvalState,'APPROVED');
    assert.equal((await db.approvalInstance.findUniqueOrThrow({where:{id:transferHeader.approvalInstanceId!}})).approvalState,'CANCELLED');
    assert.deepEqual(await db.stockTransfer.findUniqueOrThrow({where:{id:transfer.id}}),transferHeader);
    const custodyAfter = await db.transferCustody.findUniqueOrThrow({where:{transferId:transfer.id}});
    assert.equal(custodyAfter.version,custodyBefore.version+1);
    const cancelledEvent = await db.transferCustodyEvent.findFirstOrThrow({where:{transferId:transfer.id,action:'CANCEL'}});
    assert.equal(cancelledEvent.reason,'Wrong destination');
    assert.equal(cancelledEvent.actorUserId,tPm.userId);
    assert.equal(await db.stockTransaction.count({where:{stockTransferId:transfer.id}}),0);
    assert.equal(await db.transferDispatch.count({where:{transferId:transfer.id}}),0);
    await assert.rejects(app.get(StockTransferService).approve({auth:tPm},transfer.id,randomUUID()));
    assert.equal((await post('transfer-custody/transfers/'+transfer.id+'/dispatch',tf.store.session,
      {requestKey:randomUUID(),expectedVersion:custodyAfter.version,reason:'Cancelled source cannot dispatch'})).status,409);
    assert.equal((await post('stock-transfers/'+transfer.id+'/reverse',tf.pm.session,{reversalKey:randomUUID(),reason:'No reversal'})).status,409);
    await assert.rejects(corrections.decide({auth:tPm},transferCorrection.id,'APPROVE','Replay'));
    assert.equal(await db.transferCustodyEvent.count({where:{transferId:transfer.id,action:'CANCEL'}}),1);
    assert.equal(await db.stockTransaction.count({where:{stockTransferId:transfer.id}}),0);
    const ready = await okPost('stock-transfers',tf.store,tf.transferInput);
    await okPost('stock-transfers/'+ready.id+'/submit',tf.store,{workflowCode:tf.workflow.workflowCode});
    await okPost('stock-transfers/'+ready.id+'/approve',tf.pm,{postKey:randomUUID()});
    const readyHeader = await db.stockTransfer.findUniqueOrThrow({where:{id:ready.id}});
    assert.ok(readyHeader.approvalInstanceId);
    const historicalApproval = await db.approvalInstance.findUniqueOrThrow({where:{id:readyHeader.approvalInstanceId}});
    assert.equal(historicalApproval.approvalState,'APPROVED');
    const readyRequest = await corrections.request({auth:tStore},'STOCK_TRANSFER',ready.id,randomUUID(),'Approved but not dispatched','CANCEL_UNPOSTED');
    await corrections.decide({auth:tPm},readyRequest.id,'APPROVE','Cancel before physical dispatch');
    assert.deepEqual(await db.approvalInstance.findUniqueOrThrow({where:{id:historicalApproval.id}}),historicalApproval);
    const readyCustody = await db.transferCustody.findUniqueOrThrow({where:{transferId:ready.id}});
    assert.equal(await db.transferCustodyEvent.count({where:{transferId:ready.id,action:'CANCEL'}}),1);
    assert.equal((await post('transfer-custody/transfers/'+ready.id+'/dispatch',tf.store.session,
      {requestKey:randomUUID(),expectedVersion:readyCustody.version,reason:'Cancelled approved transfer'})).status,409);
    await assert.rejects(corrections.request({auth:tStore},'STOCK_TRANSFER',ready.id,randomUUID(),'Duplicate terminal cancellation','CANCEL_UNPOSTED'));
    assert.equal(await db.stockTransaction.count({where:{stockTransferId:ready.id}}),0);

    // Plan overage uses a distinct approval entity and immutable authorization;
    // cancellation must not create a new authorization or release stock.
    const mp = await materialPlanIssueFixture(db);
    await db.role.update({where:{id:mp.store.role.id},data:{roleCode:'STOREKEEPER'}});
    await db.role.update({where:{id:mp.manager.role.id},data:{roleCode:'PROJECT_MANAGER'}});
    await mp.grant(mp.manager,['inventory.issue.reverse','inventory.return.reverse']);
    await db.approvalWorkflow.create({data:{companyId:mp.company.id,workflowCode:'SS16_MOVEMENT_CORRECTION',
      entityType:'MOVEMENT_CORRECTION',workflowName:'Independent correction review',
      steps:{create:[{stepNo:1,stepName:'PM',requiredApprovals:1,stepRoles:{create:[{roleId:mp.manager.role.id}]}}]}}});
    const mpStore = await mp.sessions.resolve(mp.store.session.sessionToken);
    const mpPm = await mp.sessions.resolve(mp.manager.session.sessionToken);
    assert.ok(mpStore && mpPm);
    mp.store.auth=mpStore;mp.manager.auth=mpPm;
    await mp.controls.enable({auth:mp.ben.auth},mp.project.id,mp.enableInput());
    const over = await mp.issue('7',false);
    const intent = await mp.pin(over.id);
    await mp.controls.submitOverage({auth:mpStore},over.id,intent);
    const overAuth = await db.materialPlanIssueAuthorization.findFirstOrThrow({where:{issueId:over.id},include:{approval:true,lines:true}});
    assert.ok(overAuth.approvalInstanceId);
    assert.equal(overAuth.approval?.approvalState,'SUBMITTED');
    const overReq = await corrections.request({auth:mpStore},'MATERIAL_ISSUE',over.id,randomUUID(),'Incorrect overage source','CANCEL_UNPOSTED');
    assert.equal(overReq.sourceApprovalInstanceId,overAuth.approvalInstanceId);
    // A PM without Store posting capability cannot cancel through the generic
    // approval service; only the exact in-transaction SS16 proof permits it.
    assert.equal(mpPm.permissions.includes('inventory.material_plan.issue.post'),false);
    await assert.rejects(db.$transaction(tx=>app!.get(ApprovalService).cancel(overAuth.approvalInstanceId!,mpPm,tx),
      {isolationLevel:Prisma.TransactionIsolationLevel.Serializable}), /Material plan issue actor authority invalid/);
    assert.equal((await db.approvalInstance.findUniqueOrThrow({where:{id:overAuth.approvalInstanceId}})).approvalState,'SUBMITTED');
    audit.record = async (input, tx) => {
      if (input.entityType === 'MOVEMENT_CORRECTION' && input.action === 'APPROVE') throw new Error('Synthetic plan cancellation audit failure');
      return original(input,tx);
    };
    try { await assert.rejects(corrections.decide({auth:mpPm},overReq.id,'APPROVE','Cancel submitted overage'), /Synthetic plan cancellation audit failure/); }
    finally { audit.record=original; }
    assert.equal((await db.approvalInstance.findUniqueOrThrow({where:{id:overAuth.approvalInstanceId}})).approvalState,'SUBMITTED');
    assert.equal((await db.approvalInstance.findUniqueOrThrow({where:{id:overReq.approvalInstanceId}})).approvalState,'SUBMITTED');
    assert.equal(await db.stockTransaction.count({where:{materialIssueId:over.id}}),0);
    await corrections.decide({auth:mpPm},overReq.id,'APPROVE','Cancel submitted overage');
    assert.equal((await db.approvalInstance.findUniqueOrThrow({where:{id:overAuth.approvalInstanceId}})).approvalState,'CANCELLED');
    assert.equal(await db.materialPlanIssueAuthorization.count({where:{issueId:over.id}}),1);
    assert.deepEqual(await db.materialPlanIssueAllocation.findMany({where:{authorizationId:overAuth.id},orderBy:{id:'asc'}}),
      overAuth.lines.slice().sort((a,b)=>a.id.localeCompare(b.id)));
    await assert.rejects(mp.controls.submitOverage({auth:mpStore},over.id,await mp.pin(over.id)),
      (err:any)=>err.getResponse?.()?.code==='SS16_SOURCE_CANCELLED');
    await assert.rejects(mp.controls.decide({auth:mpPm},overAuth.id,{requestKey:randomUUID(),decision:'APPROVE',comment:'Cancelled source'},'REVIEW'));
    assert.equal(await db.stockTransaction.count({where:{materialIssueId:over.id}}),0);
    // Posted issue and return both travel through independent correction.
    await mp.issues.submit({auth:mpStore},mp.historical.id,'MR-ISSUE');
    await mp.issues.approve({auth:mpPm},mp.historical.id,randomUUID());
    const returned = await mp.sourceReturn(mp.historical.id,'1');
    assert.equal((await post('material-returns/'+returned.id+'/reverse',mp.manager.session,{reversalKey:randomUUID(),reason:'Bypass'})).status,409);
    const returnReq = await corrections.request({auth:mpStore},'MATERIAL_RETURN',returned.id,randomUUID(),'Incorrect return');
    await corrections.decide({auth:mpPm},returnReq.id,'APPROVE','Independent return reversal');
    assert.equal(await db.stockTransaction.count({where:{materialReturnId:returned.id}}),2);
    const netReturn = await db.stockTransaction.aggregate({where:{materialReturnId:returned.id},_sum:{quantity:true}});
    assert.equal(netReturn._sum.quantity?.toString(),'0');
    assert.equal((await post('material-issues/'+mp.historical.id+'/reverse',mp.manager.session,{reversalKey:randomUUID(),reason:'Bypass'})).status,409);
    const issueReq = await corrections.request({auth:mpStore},'MATERIAL_ISSUE',mp.historical.id,randomUUID(),'Incorrect issue');
    await corrections.decide({auth:mpPm},issueReq.id,'APPROVE','Independent issue reversal');
    assert.equal(await db.stockTransaction.count({where:{materialIssueId:mp.historical.id}}),2);
    const netIssue = await db.stockTransaction.aggregate({where:{materialIssueId:mp.historical.id},_sum:{quantity:true}});
    assert.equal(netIssue._sum.quantity?.toString(),'0');
  } finally {
    try { await app?.close(); } finally {
      await db.$disconnect();
      if (previous === undefined) delete process.env.STORAGE_ROOT; else process.env.STORAGE_ROOT=previous;
      if (storage) await rm(storage,{recursive:true,force:true});
    }
  }
});
