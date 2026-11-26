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
import { PrismaService } from '../prisma/prisma.service';
import { GoodsReceiptService } from './goods-receipt.service';
import { MovementCorrectionService } from './movement-correction.service';
import { receivingFixture } from './receiving-test-fixture';

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
  } finally {
    try { await app?.close(); } finally {
      await db.$disconnect();
      if (previous === undefined) delete process.env.STORAGE_ROOT; else process.env.STORAGE_ROOT=previous;
      if (storage) await rm(storage,{recursive:true,force:true});
    }
  }
});
