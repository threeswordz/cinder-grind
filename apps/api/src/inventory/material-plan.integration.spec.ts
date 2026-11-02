import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {NestFactory} from '@nestjs/core';
import {AppModule} from '../app.module';
import {PrismaService} from '../prisma/prisma.service';
import {securityHeadersMiddleware} from '../common/security-headers';
import {ProblemDetailsFilter} from '../common/problem-details.filter';
import {materialPlanFixture} from './material-plan-test-fixture';
import {InventoryService} from './inventory.service';

test('MP-AC-01–06 foundation authenticates quantity-only plans and immutable independent decisions',async t=>{
 const db=new PrismaService();await db.$connect();const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(0,'127.0.0.1');
 try{
  const f=await materialPlanFixture(db),root=await app.getUrl()+'/api/v1/inventory/material-plans';type Actor=typeof f.store;
  const call=async(actor:Actor|undefined,path:string,status=200,body?:unknown,csrf=true)=>{
   const r=await fetch(root+path,{method:body===undefined?'GET':'POST',headers:{...(actor?{Cookie:'erp_session='+actor.session.sessionToken}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...(actor&&csrf?{'x-csrf-token':actor.session.csrfToken}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
   assert.equal(r.status,status,await r.clone().text());assert.equal(r.headers.get('cache-control'),'private, no-store');return await r.json() as any;
  };
  const effects=async()=>({stock:await db.stockTransaction.count(),reservations:await db.materialReservation.count(),issues:await db.materialIssue.count(),requests:await db.materialRequest.count(),payments:await db.payment.count(),directCosts:await db.directCostPosting.count()});
  const baseline=await effects();let id='',receipt:any;
  await t.test('HTTP authentication, current action rights, CSRF and strict Company/Project inputs',async()=>{
   const input=f.input();await call(undefined,'/projects',401);await call(f.foreman,'',403,input);await call(f.administrator,'',403,input);await call(f.store,'',403,input,false);await call(f.outsider,'',403,input);
   await call(f.store,'',422,{...input,companyId:f.foreign.id});await call(f.store,'',422,{...input,warehouseId:f.foreign.id});await call(f.store,'',422,{...input,budgetRevisionId:f.foreign.id});await call(f.store,'',422,{...input,validTo:'2026-02-30'});await call(f.store,'',422,{...input,lines:[{...input.lines[0],quantity:'0'}]});
   const [a,b]=await Promise.all([call(f.store,'',201,input),call(f.store,'',201,input)]);assert.deepEqual(a.data,b.data);id=a.data.id;receipt=a.data;
   await call(f.store,'',409,{...input,reason:'Changed replay body'});assert.equal(await db.materialUsagePlan.count({where:{companyId:f.company.id}}),1);
  });
  await t.test('quantity-only selectors/detail/replay/history exclude source prices and money',async()=>{
   for(const path of ['/choices?projectId='+f.project.id+'&kind=source-lines&budgetRevisionId='+f.approved.id,'/'+id,'/'+id+'/revisions']){
    const result=await call(f.store,path);const serialized=JSON.stringify(result);assert.doesNotMatch(serialized,/"(?:rate|amount|contractValue|bankAccount|salary)"|98765\.4321/);
   }
   assert.equal((await call(f.store,'/'+id)).data.latestRevision.lines[0].quantity,'6.0000');
   assert.deepEqual(Object.keys(receipt).sort(),['id','projectId','revisionId','revisionNo','status','version'].sort());
   await call(f.store,'/choices?projectId='+f.unassigned.id+'&kind=revisions',403);
   await call(f.store,'/choices?projectId='+f.project.id+'&kind=source-lines&budgetRevisionId='+randomUUID(),422);
  });
  await t.test('raw SQL cannot alter original Draft lines or write without retained replay evidence',async()=>{
   const d=(await call(f.store,'/'+id)).data,line=d.latestRevision.lines[0];
   await assert.rejects(()=>db.materialUsagePlanLine.update({where:{id:line.id},data:{quantity:'7'}}));
   await assert.rejects(()=>db.materialUsagePlan.update({where:{id},data:{version:{increment:1}}}));
   await assert.rejects(()=>db.materialUsagePlan.update({where:{id},data:{warehouseId:randomUUID(),version:{increment:1}}}));
   await assert.rejects(()=>db.materialUsagePlanLine.create({data:{revisionId:d.latestRevision.id,budgetRevisionLineId:f.source2.id,materialId:f.material2.id,uomId:f.uom.id,quantity:'1'}}));
   await assert.rejects(()=>db.materialUsagePlanRevision.delete({where:{id:d.latestRevision.id}}));
  });
  await t.test('independent current submission, exact approval replay and retained approved version',async()=>{
   receipt=(await call(f.store,'/'+id+'/submit',201,{requestKey:randomUUID(),expectedVersion:receipt.version})).data;
   const decision={requestKey:randomUUID(),expectedVersion:receipt.version,decision:'APPROVE',comment:'Independent synthetic plan approval'};
   await call(f.store,'/'+id+'/decision',403,decision);await call(f.administrator,'/'+id+'/decision',403,decision);
   const result=(await call(f.manager,'/'+id+'/decision',201,decision)).data;assert.deepEqual((await call(f.manager,'/'+id+'/decision',201,decision)).data,result);receipt=result;
   await call(f.manager,'/'+id+'/decision',409,{...decision,comment:'Changed retained decision'});
   const d=(await call(f.store,'/'+id)).data;assert.equal(d.approvedRevision.status,'APPROVED');assert.equal(d.issueEnforcement,'NOT_ENABLED_BY_FOUNDATION');
   await assert.rejects(()=>db.materialUsagePlanRevision.update({where:{id:d.approvedRevision.id},data:{decisionComment:'Rewrite approval'}}));
   await assert.rejects(()=>db.materialUsagePlanOperation.updateMany({where:{planId:id},data:{bodyDigest:'a'.repeat(64)}}));
  });
  await t.test('reasoned revisions retain approved lines, reject stale versions and prevent source remapping',async()=>{
   const body={requestKey:randomUUID(),expectedVersion:receipt.version,validFrom:'2026-11-01',validTo:'2026-12-31',reason:'Reduce original allocation',lines:[{budgetRevisionLineId:f.source.id,materialId:f.material.id,uomId:f.uom.id,quantity:'5'}]};
   const changed=(await call(f.store,'/'+id+'/revisions',201,body)).data;assert.deepEqual((await call(f.store,'/'+id+'/revisions',201,body)).data,changed);await call(f.store,'/'+id+'/revisions',409,{...body,requestKey:randomUUID()});receipt=changed;
   const d=(await call(f.store,'/'+id)).data;assert.equal(d.approvedRevision.lines[0].quantity,'6.0000');assert.equal(d.latestRevision.lines[0].quantity,'5.0000');assert.equal(d.latestRevision.revisionNo,2);
   const other=await db.material.create({data:{companyId:f.company.id,materialCode:'MP-OTHER',materialName:'Other synthetic material',defaultUomId:f.uom.id}});
   await call(f.store,'/'+id+'/revisions',422,{...body,requestKey:randomUUID(),expectedVersion:receipt.version,lines:[{...body.lines[0],materialId:other.id}]});
   receipt=(await call(f.store,'/'+id+'/submit',201,{requestKey:randomUUID(),expectedVersion:receipt.version})).data;
   receipt=(await call(f.manager,'/'+id+'/decision',201,{requestKey:randomUUID(),expectedVersion:receipt.version,decision:'APPROVE',comment:'Approved reduced replacement'})).data;
  });
  await t.test('concurrent independent work packages cannot multiply approved Cost BOQ quantity',async()=>{
   const a=(await call(f.store,'',201,f.input('4','PACKAGE-B'))).data,b=(await call(f.store,'',201,f.input('4','PACKAGE-C'))).data;
   const submitted=await Promise.all([a,b].map(async p=>(await call(f.store,'/'+p.id+'/submit',201,{requestKey:randomUUID(),expectedVersion:p.version})).data));
   const results=await Promise.all(submitted.map(p=>fetch(root+'/'+p.id+'/decision',{method:'POST',headers:{Cookie:'erp_session='+f.manager.session.sessionToken,'x-csrf-token':f.manager.session.csrfToken,'Content-Type':'application/json'},body:JSON.stringify({requestKey:randomUUID(),expectedVersion:p.version,decision:'APPROVE',comment:'Concurrent source allocation'})})));
   assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
   const approved=await db.materialUsagePlanRevision.findMany({where:{status:'APPROVED',plan:{companyId:f.company.id}},select:{planId:true,revisionNo:true,lines:{select:{quantity:true}}},orderBy:{revisionNo:'desc'}});
   const seen=new Set<string>();let quantity=0;for(const r of approved)if(!seen.has(r.planId)){seen.add(r.planId);quantity+=Number(r.lines[0]!.quantity);}assert.equal(quantity,9);
  });
  await t.test('a different approved Cost BOQ basis cannot multiply an existing source item allowance',async()=>{
   const draft=await f.budget.createRevisionDraft({auth:f.sourceMaker.auth},f.project.id,'Synthetic second source basis');await f.budget.submitRevision({auth:f.sourceMaker.auth},draft.id,f.wf.workflowCode);await f.budget.approveRevision({auth:f.manager.auth},draft.id,'Independent new source approval');
   const line=await db.budgetRevisionLine.findFirstOrThrow({where:{budgetRevisionId:draft.id,boqItemId:f.item.id}});
   const p=(await call(f.store,'',201,{...f.input('1','NEW-BASIS'),budgetRevisionId:draft.id,lines:[{budgetRevisionLineId:line.id,materialId:f.material.id,uomId:f.uom.id,quantity:'1'}]})).data;
   const sub=(await call(f.store,'/'+p.id+'/submit',201,{requestKey:randomUUID(),expectedVersion:p.version})).data;
   await call(f.manager,'/'+p.id+'/decision',409,{requestKey:randomUUID(),expectedVersion:sub.version,decision:'APPROVE',comment:'Conflicting basis must deny'});
   await db.material.update({where:{id:f.material.id},data:{isActive:false}});
   const rejected=(await call(f.manager,'/'+p.id+'/decision',201,{requestKey:randomUUID(),expectedVersion:sub.version,decision:'REJECT',comment:'Reject stale source without activating it'})).data;assert.equal(rejected.status,'REJECTED');
   await db.material.update({where:{id:f.material.id},data:{isActive:true}});
  });
  await t.test('revision history pages newest-first without losing rows or accepting a foreign cursor',async()=>{
   for(let n=0;n<27;n++)receipt=(await call(f.store,'/'+id+'/revisions',201,{requestKey:randomUUID(),expectedVersion:receipt.version,validFrom:'2026-11-01',validTo:'2026-12-31',reason:'Synthetic history page '+n,lines:f.input('5').lines})).data;
   const first=(await call(f.store,'/'+id+'/revisions')).data;assert.equal(first.items.length,25);assert.equal(first.items[0].revisionNo,29);
   const second=(await call(f.store,'/'+id+'/revisions?after='+first.nextCursor)).data;assert.equal(second.items.length,4);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.items,...second.items].map((r:any)=>r.id)).size,29);
   await call(f.store,'/'+id+'/revisions?after='+randomUUID(),422);
  });
  await t.test('plan warehouse scope survives authorized reassignment, concurrent creation and later allocation revision',async()=>{
   await f.grant(f.manager,['inventory.warehouse.view','inventory.warehouse.edit','projects.access_all']);
   const inventory=app.get(InventoryService);
   const freshWarehouse=()=>db.warehouse.create({data:{companyId:f.company.id,projectId:f.project.id,warehouseCode:'MP-'+randomUUID(),warehouseName:'Plan-only warehouse',isSiteWarehouse:true}});
   const wh=await freshWarehouse();
   assert.equal(await db.stockTransaction.count({where:{warehouseId:wh.id}}),0);
   assert.equal(await db.materialRequest.count({where:{warehouseId:wh.id}}),0);
   // The same authorized actor can move an unreferenced warehouse.
   await inventory.updateWarehouse({auth:f.manager.auth},wh.id,{projectId:f.unassigned.id});
   await inventory.updateWarehouse({auth:f.manager.auth},wh.id,{projectId:f.project.id});
   const input={...f.input('2','PLAN-ONLY'),warehouseId:wh.id,lines:[{budgetRevisionLineId:f.source2.id,materialId:f.material2.id,uomId:f.uom.id,quantity:'2'}]};
   let p=(await call(f.store,'',201,input)).data;
   const patch=async(body:unknown,status:number)=>{
    const r=await fetch(await app.getUrl()+'/api/v1/inventory/warehouses/'+wh.id,{method:'PATCH',headers:{Cookie:'erp_session='+f.manager.session.sessionToken,'x-csrf-token':f.manager.session.csrfToken,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal(r.status,status,await r.clone().text());return r.json() as Promise<any>;
   };
   assert.equal((await patch({projectId:f.unassigned.id},409)).code,'MATERIAL_PLAN_WAREHOUSE_SCOPE_IMMUTABLE');
   p=(await call(f.store,'/'+p.id+'/submit',201,{requestKey:randomUUID(),expectedVersion:p.version})).data;
   p=(await call(f.manager,'/'+p.id+'/decision',201,{requestKey:randomUUID(),expectedVersion:p.version,decision:'APPROVE',comment:'Plan-only warehouse checker'})).data;
   await patch({projectId:f.unassigned.id},409);
   await patch({projectId:null,isSiteWarehouse:false},409);
   await assert.rejects(()=>db.warehouse.update({where:{id:wh.id},data:{projectId:f.unassigned.id}}),e=>e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2003'&&String(e.meta?.field_name).includes('material_usage_plans_warehouse_scope_fkey'));
   await patch({warehouseName:'Descriptive edit remains allowed',projectId:f.project.id},200);
   p=(await call(f.store,'/'+p.id+'/revisions',201,{requestKey:randomUUID(),expectedVersion:p.version,validFrom:input.validFrom,validTo:input.validTo,reason:'Release allocation after denied move',lines:[{...input.lines[0],quantity:'1'}]})).data;
   p=(await call(f.store,'/'+p.id+'/submit',201,{requestKey:randomUUID(),expectedVersion:p.version})).data;
   await call(f.manager,'/'+p.id+'/decision',201,{requestKey:randomUUID(),expectedVersion:p.version,decision:'APPROVE',comment:'Reduced allocation remains usable'});
   const detail=(await call(f.store,'/'+p.id)).data;assert.equal(detail.projectId,f.project.id);assert.equal(detail.approvedRevision.lines[0].quantity,'1.0000');
   const old=(await call(f.store,'/'+p.id+'/revisions')).data;assert.equal(old.items.length,2);
   // Exercise both operations concurrently against fresh warehouses with no
   // stock/request guard. PostgreSQL must never commit an orphaned plan scope.
   for(let n=0;n<3;n++){
    const racing=await freshWarehouse();
    const outcomes=await Promise.allSettled([
     f.service.create({auth:f.store.auth},{...input,requestKey:randomUUID(),warehouseId:racing.id,workPackageCode:'RACE-'+n}),
     inventory.updateWarehouse({auth:f.manager.auth},racing.id,{projectId:f.unassigned.id}),
    ]);
    assert.ok(outcomes.some(r=>r.status==='rejected'),'create and scope move must not both commit');
    for(const outcome of outcomes)if(outcome.status==='rejected')assert.ok([409,422].includes(outcome.reason?.getStatus?.()),'race must return a controlled scope conflict');
    const row=await db.warehouse.findUniqueOrThrow({where:{id:racing.id}});
    const plans=await db.materialUsagePlan.findMany({where:{warehouseId:racing.id}});
    for(const plan of plans){assert.equal(plan.companyId,row.companyId);assert.equal(plan.projectId,row.projectId);}
   }
  });
  await t.test('persisted grant revocation and forged access-all do not survive replay or direct reads',async()=>{
   const p=await db.permission.findUniqueOrThrow({where:{permissionCode:'inventory.material_plan.view'}});const old=f.store.auth;
   await db.rolePermission.delete({where:{roleId_permissionId:{roleId:f.store.role.id,permissionId:p.id}}});
   await call(f.store,'/'+id,403);await assert.rejects(()=>f.service.get({...old,permissions:[...old.permissions,'projects.access_all']},id));
   await assert.rejects(()=>f.service.get({...f.outsider.auth,permissions:[...f.store.auth.permissions,'projects.access_all']},id));
  });
  assert.deepEqual(await effects(),baseline,'plan foundation cannot post stock, create requests or mutate Finance');
 }finally{await app.close();await db.$disconnect();}
});
