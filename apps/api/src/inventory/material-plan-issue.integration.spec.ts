import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {inspect} from 'node:util';
const conflictStatus=(e:any)=>{assert.equal(e?.getStatus?.(),409,inspect(e));return true;};
import {Prisma} from '@prisma/client';
import {NestFactory} from '@nestjs/core';
import {AppModule} from '../app.module';
import {PrismaService} from '../prisma/prisma.service';
import {securityHeadersMiddleware} from '../common/security-headers';
import {ProblemDetailsFilter} from '../common/problem-details.filter';
import {materialPlanIssueFixture} from './material-plan-issue-test-fixture';
import {MPI} from './material-plan-issue-contract';

test('MP-AC-07–13 actual authenticated plan posting, overage, consumption and immutable source history',async t=>{
 const db=new PrismaService();await db.$connect();const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(0,'127.0.0.1');
 try{
  const f=await materialPlanIssueFixture(db),root=await app.getUrl()+'/api/v1/inventory/material-plan-issues';type Actor=typeof f.store;
  const call=async(actor:Actor|undefined,path:string,status=200,body?:unknown,csrf=true)=>{
   const response=await fetch(root+path,{method:body===undefined?'GET':'POST',headers:{...(actor?{Cookie:'erp_session='+actor.session.sessionToken}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...(actor&&csrf?{'x-csrf-token':actor.session.csrfToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
   assert.equal(response.status,status,await response.clone().text());assert.equal(response.headers.get('cache-control'),'private, no-store');return response.json() as Promise<any>;
  };
  const path='/projects/'+f.project.id,baseline={payments:await db.payment.count(),costs:await db.directCostPosting.count()};
  let directId='',overageId='',postedAuth='',replacementIssue='',returnId='';let directInput:any;
  await t.test('enablement requires current explicit capability, CSRF and synthetic confirmation; no implicit SYS_ADMIN authority',async()=>{
   assert.equal(await db.materialPlanProjectPolicy.count({where:{companyId:f.company.id}}),0);
   await call(undefined,path+'/policy',401);await call(f.administrator,path+'/enable',403,f.enableInput());await call(f.store,path+'/enable',403,f.enableInput());await call(f.ben,path+'/enable',403,f.enableInput(),false);
   await call(f.ben,path+'/enable',422,{...f.enableInput(),confirmation:'PRODUCTION'});await call(f.ben,path+'/enable',422,{...f.enableInput(),companyId:f.foreign.id});
   await call(f.ben,'/projects/'+f.unassigned.id+'/enable',403,f.enableInput());
   const input=f.enableInput(),r=await Promise.all([call(f.ben,path+'/enable',201,input),call(f.ben,path+'/enable',201,input)]);assert.deepEqual(r[0].data,r[1].data);
   assert.equal(await db.materialPlanProjectPolicy.count({where:{companyId:f.company.id}}),1);assert.equal((await call(f.store,path+'/policy')).data.enabled,true);
   await call(f.ben,path+'/enable',409,{...input,reason:'Changed body'});await call(f.ben,path+'/enable',409,f.enableInput());
  });
  await t.test('historical drafts retain canonical legacy approval; only newly created enabled issues are pinned',async()=>{
   assert.equal(await db.materialPlanIssueBinding.findUnique({where:{issueId:f.historical.id}}),null);
   const enabled=await db.materialPlanProjectPolicy.findUniqueOrThrow({where:{projectId:f.project.id}});
   await assert.rejects(()=>db.$transaction(tx=>tx.materialPlanIssueBinding.create({data:{issueId:f.historical.id,policyId:enabled.id}}),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}));
   await f.issues.submit({auth:f.store.auth},f.historical.id,'MR-ISSUE');await f.issues.approve({auth:f.manager.auth},f.historical.id,randomUUID());
   const issue=await f.issue('3',false);directId=issue.id;assert.ok(await db.materialPlanIssueBinding.findUnique({where:{issueId:directId}}));
   await assert.rejects(()=>f.issues.submit({auth:f.store.auth},directId,'MR-ISSUE'),(e:any)=>e.getStatus()===409&&e.getResponse().code==='MATERIAL_PLAN_ISSUE_PATH_REQUIRED');
   await assert.rejects(()=>db.$transaction(tx=>tx.materialIssue.update({where:{id:directId},data:{postedAt:new Date(),postedByUserId:f.store.user.id,postKey:randomUUID()}}),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}));
  });
  await t.test('within-plan Store posting has no separate approval and one canonical stock effect; replay is exact',async()=>{
   const input=await f.pin(directId);directInput=input;const before=await db.approvalInstance.count({where:{companyId:f.company.id}});
   const preview=(await call(f.store,'/issues/'+directId+'/preview',201,input)).data;assert.equal(preview.result,'WITHIN_PLAN');assert.equal(preview.items[0].remaining,'6.0000');
   const result=await call(f.store,'/issues/'+directId+'/within-plan',201,input);assert.equal(result.data.status,'POSTED');postedAuth=result.data.authorizationId;
   assert.deepEqual((await call(f.store,'/issues/'+directId+'/within-plan',201,input)).data,result.data);
   await call(f.store,'/issues/'+directId+'/within-plan',409,{...input,bindings:[{...input.bindings[0],expectedPlanVersion:214}]});
   const row=await f.issues.get(f.store.auth,directId);assert.equal(row.approvalInstanceId,null);assert.equal(row.postedByUserId,f.store.user.id);assert.equal(row.stockTransactions.length,1);assert.equal(row.stockTransactions[0]!.quantity.toFixed(4),'-3.0000');
   assert.equal(await db.approvalInstance.count({where:{companyId:f.company.id}}),before);assert.equal(await db.materialPlanIssueAuthorization.count({where:{issueId:directId}}),1);
   await assert.rejects(()=>db.$transaction(tx=>tx.materialPlanIssueAllocation.updateMany({where:{authorizationId:postedAuth},data:{overageQuantity:'3'}}),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}));
   await assert.rejects(()=>db.$transaction(tx=>tx.materialPlanIssueBinding.update({where:{issueId:directId},data:{authorizationId:randomUUID()}}),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}));
  });
  await t.test('every beyond-plan quantity requires independent eligible reviewer then final authority',async()=>{
   const issue=await f.issue('4',false);overageId=issue.id;const input=await f.pin(issue.id);
   assert.equal((await call(f.store,'/issues/'+issue.id+'/preview',201,input)).data.overageQuantity,'1.0000');
   await call(f.store,'/issues/'+issue.id+'/within-plan',409,input);const result=(await call(f.store,'/issues/'+issue.id+'/overage',201,input)).data;
   assert.equal(result.status,'AWAITING_REVIEW');assert.equal(await db.stockTransaction.count({where:{materialIssueId:issue.id}}),0);
   const decision=()=>({requestKey:randomUUID(),decision:'APPROVE',comment:'Independent synthetic overage action'});
   await call(f.ben,'/authorizations/'+result.authorizationId+'/decision',409,decision());await call(f.store,'/authorizations/'+result.authorizationId+'/review',403,decision());await call(f.administrator,'/authorizations/'+result.authorizationId+'/decision',403,decision());
   await f.grant(f.store,[MPI.review]);await call(f.store,'/authorizations/'+result.authorizationId+'/review',403,decision());
   const review=decision();assert.equal((await call(f.manager,'/authorizations/'+result.authorizationId+'/review',201,review)).data.status,'AWAITING_APPROVAL');
   assert.equal((await call(f.manager,'/authorizations/'+result.authorizationId+'/review',201,review)).data.status,'AWAITING_APPROVAL');
   await f.grant(f.manager,[MPI.approve]);await call(f.manager,'/authorizations/'+result.authorizationId+'/decision',403,decision());
   const approved=decision();assert.equal((await call(f.ben,'/authorizations/'+result.authorizationId+'/decision',201,approved)).data.status,'POSTED');
   assert.equal((await call(f.ben,'/authorizations/'+result.authorizationId+'/decision',201,approved)).data.status,'POSTED');
   assert.equal(await db.stockTransaction.count({where:{materialIssueId:issue.id}}),1);
   const history=(await call(f.store,'/issues/'+issue.id)).data;assert.equal(history.items[0].approval.actions.length,2);assert.equal(new Set(history.items[0].approval.actions.map((a:any)=>a.actionByUserId)).size,2);
   assert.doesNotMatch(JSON.stringify(history),/"(?:rate|amount|salary|bankAccount|contractValue)"|98765\.4321/);
  });
  await t.test('reasoned revisions carry usage; newly effective revisions invalidate pending decisions without relabelling posted history',async()=>{
   let plan=await f.service.get(f.store.auth,f.plan.id);
   const revision=(qty:string)=>({requestKey:randomUUID(),expectedVersion:plan.version,validFrom:'2026-11-01',validTo:'2026-12-31',reason:'Synthetic carried consumption',lines:[{budgetRevisionLineId:f.source.id,materialId:f.material.id,uomId:f.uom.id,quantity:qty}]});
   await assert.rejects(()=>f.service.revise({auth:f.store.auth},plan.id,revision('6')),conflictStatus);
   const pending=await f.issue('2',false);replacementIssue=pending.id;const old=(await call(f.store,'/issues/'+pending.id+'/overage',201,await f.pin(pending.id))).data;
   await f.service.revise({auth:f.store.auth},plan.id,revision('8'));plan=await f.service.get(f.store.auth,plan.id);
   await f.service.submit({auth:f.store.auth},plan.id,{requestKey:randomUUID(),expectedVersion:plan.version});plan=await f.service.get(f.store.auth,plan.id);
   await f.service.decide({auth:f.manager.auth},plan.id,{requestKey:randomUUID(),expectedVersion:plan.version,decision:'APPROVE',comment:'Approved carried allocation'});
   await call(f.manager,'/authorizations/'+old.authorizationId+'/review',409,{requestKey:randomUUID(),decision:'APPROVE',comment:'Old pin must deny'});
   plan=await f.service.get(f.store.auth,plan.id);const fresh=(await call(f.store,'/issues/'+pending.id+'/overage',201,await f.pin(pending.id,plan.approvedRevision!.lines[0]!.id))).data;
   assert.notEqual(fresh.authorizationId,old.authorizationId);const d=()=>({requestKey:randomUUID(),decision:'APPROVE',comment:'Fresh effective version'});
   await call(f.manager,'/authorizations/'+fresh.authorizationId+'/review',201,d());await call(f.ben,'/authorizations/'+fresh.authorizationId+'/decision',201,d());
   const historical=(await call(f.store,'/issues/'+directId)).data;assert.equal(historical.items[0].lines[0].planLine.revisionId,f.plan.approvedRevision!.id);
  });
  await t.test('canonical returns and reversals change net usage once; reductions never erase or relabel prior usage',async()=>{
   const returned=await f.sourceReturn(overageId,'3');returnId=returned.id;let plan=await f.service.get(f.store.auth,f.plan.id);
   await f.service.revise({auth:f.store.auth},plan.id,{requestKey:randomUUID(),expectedVersion:plan.version,validFrom:'2026-11-01',validTo:'2026-12-31',reason:'Reduce only after canonical return',lines:[{budgetRevisionLineId:f.source.id,materialId:f.material.id,uomId:f.uom.id,quantity:'6'}]});plan=await f.service.get(f.store.auth,plan.id);
   await f.service.submit({auth:f.store.auth},plan.id,{requestKey:randomUUID(),expectedVersion:plan.version});plan=await f.service.get(f.store.auth,plan.id);await f.service.decide({auth:f.manager.auth},plan.id,{requestKey:randomUUID(),expectedVersion:plan.version,decision:'APPROVE',comment:'Net usage carried'});
   await f.returns.reverse({auth:f.store.auth},returnId,randomUUID(),'Canonical returned material reversal');
   plan=await f.service.get(f.store.auth,plan.id);const next=await f.issue('0.0001',false),pins=await f.pin(next.id,plan.approvedRevision!.lines[0]!.id);
   const preview=(await call(f.store,'/issues/'+next.id+'/preview',201,pins)).data;assert.equal(preview.items[0].used,'9.0000');assert.equal(preview.items[0].remaining,'-3.0000');await call(f.store,'/issues/'+next.id+'/within-plan',409,pins);
   await f.issues.reverse({auth:f.store.auth},overageId,randomUUID(),'Canonical source reversal after returned row reversed');
   assert.equal((await call(f.store,'/issues/'+next.id+'/preview',201,pins)).data.items[0].used,'5.0000');
   const before=await db.stockTransaction.count();await f.returns.create({auth:f.store.auth},{projectId:f.project.id,warehouseId:f.warehouse.id,returnDate:new Date('2026-11-02'),lines:[{materialIssueItemId:(await f.issues.get(f.store.auth,directId)).items[0]!.id,quantity:new Prisma.Decimal('1')}]});
   assert.equal((await call(f.store,'/issues/'+next.id+'/preview',201,pins)).data.items[0].used,'5.0000');assert.equal(await db.stockTransaction.count(),before);
   assert.equal((await call(f.store,'/issues/'+replacementIssue)).data.items[0].lines[0].quantity,'2.0000');
  });
  await t.test('Company/Project and current grant boundaries apply to reads and exact committed replay',async()=>{
   await call(f.outsider,'/issues/'+directId,403);await assert.rejects(()=>f.controls.history({...f.outsider.auth,permissions:[...f.outsider.auth.permissions,'projects.access_all']},directId));
   const p=await db.permission.findUniqueOrThrow({where:{permissionCode:MPI.post}});await db.rolePermission.delete({where:{roleId_permissionId:{roleId:f.store.role.id,permissionId:p.id}}});
   await call(f.store,'/issues/'+directId+'/within-plan',403,directInput);
   await assert.rejects(()=>f.controls.withinPlan({auth:{...f.store.auth,permissions:[...f.store.auth.permissions,MPI.post,'projects.access_all']}},directId,directInput),(e:any)=>e.getStatus()===403);
  });
  assert.deepEqual({payments:await db.payment.count(),costs:await db.directCostPosting.count()},baseline,'plan policy cannot add Finance postings');
 }finally{await app.close();await db.$disconnect();}
});

test('MP-AC-10–11 combined allowance races, same-key replay and whole mixed-batch rollback',async()=>{
 const db=new PrismaService();await db.$connect();
 try{
  const f=await materialPlanIssueFixture(db);await f.controls.enable({auth:f.ben.auth},f.project.id,f.enableInput());
  const a=await f.issue('4',false),b=await f.issue('4',false),pa=await f.pin(a.id),pb=await f.pin(b.id);
  const results=await Promise.allSettled([f.controls.withinPlan({auth:f.store.auth},a.id,pa),f.controls.withinPlan({auth:f.store.auth},b.id,pb)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);for(const r of results)if(r.status==='rejected')assert.equal(r.reason.getStatus(),409);
  const once=await f.issue('1',false),input=await f.pin(once.id),same=await Promise.all([f.controls.withinPlan({auth:f.store.auth},once.id,input),f.controls.withinPlan({auth:f.store.auth},once.id,input)]);assert.deepEqual(same[0],same[1]);assert.equal(await db.stockTransaction.count({where:{materialIssueId:once.id}}),1);
  const mixed=await f.issues.create({auth:f.store.auth},{projectId:f.project.id,warehouseId:f.warehouse.id,issueDate:new Date('2026-11-02'),lines:[{materialId:f.material.id,uomId:f.uom.id,quantity:new Prisma.Decimal('1')},{materialId:f.material.id,uomId:f.uom.id,quantity:new Prisma.Decimal('1')}]});
  const real=await f.pin(mixed.id);await assert.rejects(()=>f.controls.withinPlan({auth:f.store.auth},mixed.id,real),conflictStatus);assert.equal(await db.stockTransaction.count({where:{materialIssueId:mixed.id}}),0);assert.equal(await db.materialPlanIssueAuthorization.count({where:{issueId:mixed.id}}),0);
  const denied=await f.issue('1',false);await assert.rejects(()=>f.controls.withinPlan({auth:f.store.auth},denied.id,{requestKey:randomUUID(),bindings:[{issueItemId:denied.items[0]!.id,planLineId:randomUUID(),expectedPlanVersion:f.plan.version}]}),(e:any)=>e.getStatus()===422);
 }finally{await db.$disconnect();}
});

test('MP-AC-04/11 concurrent effective replacement and posting cannot reduce below committed consumption',async()=>{
 const db=new PrismaService();await db.$connect();
 try{
  const f=await materialPlanIssueFixture(db);await f.controls.enable({auth:f.ben.auth},f.project.id,f.enableInput());let plan=await f.service.get(f.store.auth,f.plan.id);
  await f.service.revise({auth:f.store.auth},plan.id,{requestKey:randomUUID(),expectedVersion:plan.version,validFrom:'2026-11-01',validTo:'2026-12-31',reason:'Concurrent reduction',lines:[{budgetRevisionLineId:f.source.id,materialId:f.material.id,uomId:f.uom.id,quantity:'4'}]});plan=await f.service.get(f.store.auth,plan.id);
  await f.service.submit({auth:f.store.auth},plan.id,{requestKey:randomUUID(),expectedVersion:plan.version});plan=await f.service.get(f.store.auth,plan.id);
  const issue=await f.issue('5',false),pin=await f.pin(issue.id);const results=await Promise.allSettled([
   f.service.decide({auth:f.manager.auth},plan.id,{requestKey:randomUUID(),expectedVersion:plan.version,decision:'APPROVE',comment:'Race replacement approval'}),
   f.controls.withinPlan({auth:f.store.auth},issue.id,pin),
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);for(const r of results)if(r.status==='rejected')assert.ok([409,422].includes(r.reason.getStatus()));
  const now=await f.service.get(f.store.auth,plan.id),posted=await db.materialIssue.findUniqueOrThrow({where:{id:issue.id}});assert.ok(!posted.postedAt||now.approvedRevision!.lines[0]!.quantity==='6.0000');
 }finally{await db.$disconnect();}
});

test('MP-AC-09 final posting revalidates the earlier reviewer grant and preserves approval history',async()=>{
 const db=new PrismaService();await db.$connect();
 try{
  const f=await materialPlanIssueFixture(db);await f.controls.enable({auth:f.ben.auth},f.project.id,f.enableInput());
  const direct=await f.issue('3',false);await f.controls.withinPlan({auth:f.store.auth},direct.id,await f.pin(direct.id));
  const issue=await f.issue('4',false),pending=await f.controls.submitOverage({auth:f.store.auth},issue.id,await f.pin(issue.id)) as {authorizationId:string};
  const d=()=>({requestKey:randomUUID(),decision:'APPROVE',comment:'Revalidate persisted reviewer authority'});
  await f.controls.decide({auth:f.manager.auth},pending.authorizationId,d(),'REVIEW');
  const capability=await db.permission.findUniqueOrThrow({where:{permissionCode:MPI.review}});
  await db.rolePermission.deleteMany({where:{roleId:f.manager.role.id,permissionId:capability.id}});
  await assert.rejects(()=>f.controls.decide({auth:f.ben.auth},pending.authorizationId,d(),'DECIDE'),conflictStatus);
  assert.equal(await db.stockTransaction.count({where:{materialIssueId:issue.id}}),0);
  await f.grant(f.manager,[MPI.review]);await f.controls.decide({auth:f.ben.auth},pending.authorizationId,d(),'DECIDE');
  const auth=await db.materialPlanIssueAuthorization.findUniqueOrThrow({where:{id:pending.authorizationId}});
  const actions=await db.approvalAction.findMany({where:{approvalInstanceId:auth.approvalInstanceId!}});assert.equal(actions.length,2);
  await assert.rejects(()=>db.approvalAction.update({where:{id:actions[0]!.id},data:{comment:'Forged mutable history'}}));
  await assert.rejects(()=>db.approvalAction.delete({where:{id:actions[0]!.id}}));
 }finally{await db.$disconnect();}
});
