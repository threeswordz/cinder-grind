import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Prisma} from '@prisma/client';
import {PrismaService} from '../../prisma/prisma.service';
import {ApprovalService} from '../../approval/approval.service';
import {hrFixture,hrFacts} from '../hr-test-fixture';

test('HR03 persisted raw request and correction evidence uses canonical approvals',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'erp-hr03-native-'));
  const original={keys:process.env.HR_PRIVATE_KEYS,active:process.env.HR_PRIVATE_ACTIVE_KEY_ID,storage:process.env.STORAGE_ROOT};
  process.env.HR_PRIVATE_KEYS=JSON.stringify({test1:randomBytes(32).toString('base64')});
  process.env.HR_PRIVATE_ACTIVE_KEY_ID='test1';process.env.STORAGE_ROOT=dir;
  const db=new PrismaService();await db.$connect();
  try{
    const f=await hrFixture(db),a=f.actors,companyId=f.company.id;
    await f.service.employment(a.hr.auth,companyId,f.legacy.id,{requestId:randomUUID(),expectedVersion:0,facts:hrFacts({projectId:f.project.id})});
    const employment=await db.hrEmployment.findUniqueOrThrow({where:{companyId_employeeId:{companyId,employeeId:f.legacy.id}},include:{revisions:true}});
    const employmentRevisionId=employment.revisions[0]!.id;
    const workflowCode='HR03_SYNTHETIC_'+f.suffix, entityType='HR_WORK_REQUEST_REVISION';
    await db.approvalWorkflow.create({data:{companyId,workflowCode,entityType,workflowName:'Synthetic site leave only',steps:{create:[
      {stepNo:1,stepName:'Foreman',stepRoles:{create:{roleId:a.foreman.role.id}}},
      {stepNo:2,stepName:'HR',stepRoles:{create:{roleId:a.hr.role.id}}},
    ]}}});
    const approval=new ApprovalService(db);
    const before=await Promise.all([db.payment.count(),db.directCostPosting.count(),db.dailySiteReportManpower.count()]);
    const requestId=randomUUID(),workDate=new Date('2026-11-20');
    type Operation='REQUEST'|'CORRECTION'|'CANCELLATION';
    async function append(version:number,operation:Operation,portion='FULL_DAY',overrides:Partial<Prisma.HrWorkRequestRevisionUncheckedCreateInput>={}){
      const id=randomUUID();
      return db.$transaction(async tx=>{
        if(version===1)await tx.hrWorkRequest.create({data:{id:requestId,companyId,employeeId:f.legacy.id,kind:'LEAVE'}});
        const instance=await approval.start({companyId,workflowCode,entityType,entityId:id},tx);
        const row=await tx.hrWorkRequestRevision.create({data:{id,companyId,requestId,version,operation,employmentRevisionId,projectId:f.project.id,makerUserId:a.store.user.id,approvalInstanceId:instance.id,leaveType:'SYNTHETIC_LEAVE',reason:'Synthetic request evidence',...overrides}});
        await tx.hrWorkRequestDay.create({data:{companyId,revisionId:row.id,workDate,leavePortion:portion}});
        await tx.hrWorkRequest.update({where:{id:requestId},data:{currentVersion:version}});
        return row;
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    }
    let first:Awaited<ReturnType<typeof append>>;
    await t.test('request and immutable days with actual ordered canonical approval decisions',async()=>{
      first=await append(1,'REQUEST');
      await assert.rejects(approval.approve(first.approvalInstanceId,a.hr.auth,a.store.user.id));
      await assert.rejects(approval.approve(first.approvalInstanceId,a.store.auth,a.store.user.id));
      await assert.rejects(append(2,'CORRECTION','HALF_AM'));
      await approval.approve(first.approvalInstanceId,a.foreman.auth,a.store.user.id);
      await approval.approve(first.approvalInstanceId,a.hr.auth,a.store.user.id);
      assert.equal((await db.approvalInstance.findUniqueOrThrow({where:{id:first.approvalInstanceId}})).approvalState,'APPROVED');
      await assert.rejects(db.hrWorkRequestRevision.update({where:{id:first.id},data:{reason:'overwrite'}}));
      await assert.rejects(db.hrWorkRequestDay.create({data:{companyId,revisionId:first.id,workDate:new Date('2026-11-21'),leavePortion:'FULL_DAY'}}));
      await assert.rejects(db.hrWorkRequest.update({where:{id:requestId},data:{currentVersion:9}}));
    });
    await t.test('wrong Company and employment pins fail, rejected correction preserves approved base',async()=>{
      await assert.rejects(append(2,'CORRECTION','HALF_AM',{projectId:f.foreignProject.id}));
      await assert.rejects(append(2,'CORRECTION','HALF_AM',{employmentRevisionId:randomUUID()}));
      const correction=await append(2,'CORRECTION','HALF_AM');
      await approval.reject(correction.approvalInstanceId,a.foreman.auth,a.store.user.id,'Synthetic rejection');
      assert.equal((await db.approvalInstance.findUniqueOrThrow({where:{id:first.approvalInstanceId}})).approvalState,'APPROVED');
      await assert.rejects(append(3,'CANCELLATION','HALF_AM'));
      const cancellation=await append(3,'CANCELLATION','FULL_DAY');
      await approval.approve(cancellation.approvalInstanceId,a.foreman.auth,a.store.user.id);
      await approval.approve(cancellation.approvalInstanceId,a.hr.auth,a.store.user.id);
      await assert.rejects(append(4,'CORRECTION','FULL_DAY'));
      assert.equal(await db.hrWorkRequestRevision.count({where:{requestId}}),3);
      assert.equal(await db.approvalAction.count({where:{approvalInstanceId:first.approvalInstanceId}}),2);
      assert.deepEqual(await Promise.all([db.payment.count(),db.directCostPosting.count(),db.dailySiteReportManpower.count()]),before);
    });
  }finally{
    await db.$disconnect();await rm(dir,{recursive:true,force:true});
    for(const [k,v] of [['HR_PRIVATE_KEYS',original.keys],['HR_PRIVATE_ACTIVE_KEY_ID',original.active],['STORAGE_ROOT',original.storage]] as const){
      if(v===undefined)delete process.env[k];else process.env[k]=v;
    }
  }
});
