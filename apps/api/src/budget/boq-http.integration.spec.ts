import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SessionService } from '../auth/session.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { PrismaService } from '../prisma/prisma.service';
import { customerBoqFixture } from './customer-boq-test-fixture';

test('public BOQ HTTP workflow enforces persisted disclosure, CSRF, maker/checker, source scope, export and uploaded-byte authority',async t=>{
  const db=new PrismaService();await db.$connect();
  const storage=await mkdtemp(path.join(os.tmpdir(),'erp-boq-http-'));
  const oldRoot=process.env.STORAGE_ROOT;process.env.STORAGE_ROOT=storage;
  const app=await NestFactory.create(AppModule,{logger:false});
  app.setGlobalPrefix('api/v1');app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(0,'127.0.0.1');
  const base=(await app.getUrl())+'/api/v1';
  try{
    const f=await customerBoqFixture(db),foreign=await customerBoqFixture(db);
    const sessions=new SessionService(db);
    const tokens=new Map<string,Awaited<ReturnType<SessionService['create']>>>();
    for(const a of [f.maker,f.checker,f.outsider,foreign.maker])tokens.set(a.userId,await sessions.create(a.userId));
    const call=async(a:AuthenticatedUserContext|undefined,url:string,body?:unknown,csrf=true,method=body===undefined?'GET':'POST')=>{
      const token=a?tokens.get(a.userId):undefined;
      return fetch(base+url,{method,headers:{...(token?{Cookie:'erp_session='+token.sessionToken}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...(csrf&&token?{'x-csrf-token':token.csrfToken}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})}) as Promise<Omit<Response,'json'> & {json():Promise<any>}>;
    };
    const get=async(a:AuthenticatedUserContext,url:string,status=200)=>{const r=await call(a,url);assert.equal(r.status,status,await r.clone().text());return r;};
    const post=async(a:AuthenticatedUserContext,url:string,body:unknown,status=201)=>{const r=await call(a,url,body);assert.equal(r.status,status,await r.clone().text());return r;};
    async function grants(a:AuthenticatedUserContext,codes:string[]){
      for(const permissionCode of codes)await db.permission.upsert({where:{permissionCode},update:{},create:{permissionCode,moduleCode:'TEST'}});
      const role=await db.role.create({data:{companyId:a.companyId,roleCode:'HTTP-'+randomUUID().slice(0,8),roleName:'Disposable HTTP role',rolePermissions:{create:codes.map(permissionCode=>({permission:{connect:{permissionCode}}}))}}});
      await db.userRole.deleteMany({where:{userId:a.userId}});
      await db.userRole.create({data:{companyId:a.companyId,userId:a.userId,roleId:role.id}});return role;
    }
    const pid=f.project.id,root='/budget/customer/projects/'+pid;
    const all=['budget.boq.view','budget.revision.view','budget.customer.view','budget.customer.manage','budget.customer.submit','budget.customer.approve'];
    const sourceBefore=JSON.stringify(await db.budgetRevision.findUniqueOrThrow({where:{id:f.source.id},include:{lines:true}}));
    const ledgersBefore=await Promise.all([db.stockTransaction.count(),db.payment.count(),db.directCostPosting.count()]);
    let id='',instance='',documentId='';
    await t.test('unauthenticated/no-access/direct foreign IDs fail and source options expose only the authorized approved revision',async()=>{
      assert.equal((await call(undefined,'/budget/customer/projects')).status,401);
      const options=await(await get(f.maker,root+'/options')).json();
      assert.deepEqual(options.data.sources.map((s:{id:string})=>s.id),[f.source.id]);
      assert.equal(options.data.sources[0].lines[0].id,f.sourceLine.id);
      assert.equal((await get(f.maker,'/budget/customer/projects')).headers.get('cache-control'),'private, no-store');
      await get(f.outsider,root+'/options',403);
      await get(foreign.maker,root+'/options',404);
      await grants(f.outsider,[]);await get(f.outsider,'/budget/customer/projects',403);
    });
    await t.test('real CSRF and strict transport reject mutations before any version is created',async()=>{
      const count=await db.customerBoqVersion.count({where:{projectId:pid}});
      assert.equal((await call(f.maker,root+'/versions',{requestId:randomUUID(),draft:f.input()},false)).status,403);
      const bad=f.input();Object.assign(bad.lines[0]!,{previousRate:'0',uomDecimalPlaces:4});
      await post(f.maker,root+'/versions',{requestId:randomUUID(),draft:bad},422);
      await post(f.maker,root+'/versions',{requestId:randomUUID(),draft:{...f.input(),sourceRevisionId:foreign.source.id}},422);
      assert.equal(await db.customerBoqVersion.count({where:{projectId:pid}}),count);
    });
    await t.test('preview is non-persistent; concurrent request replay returns one exact minimal receipt',async()=>{
      const count=await db.customerBoqVersion.count({where:{projectId:pid}});
      const preview=await(await post(f.maker,root+'/preview',{draft:f.input()})).json();
      assert.equal(preview.data.lines[0].rate,'120.0000');assert.equal(preview.data.totalAmount,'1200.00');
      assert.equal(await db.customerBoqVersion.count({where:{projectId:pid}}),count);
      const requestId=randomUUID(),body={requestId,draft:f.input()};
      const replies=await Promise.all([post(f.maker,root+'/versions',body),post(f.maker,root+'/versions',body)]);
      const values=await Promise.all(replies.map(r=>r.json()));assert.deepEqual(values[0],values[1]);
      id=values[0].data.id;assert.deepEqual(Object.keys(values[0].data).sort(),['approvalState','editNo','id']);
      await post(f.maker,root+'/versions',{requestId,draft:f.input('119')},409);
      const history=await(await get(f.maker,root+'/versions/'+id)).json();
      assert.equal(history.data.allowedActions.edit,true);assert.equal(history.data.allowedActions.decide,false);
      await get(foreign.maker,root+'/versions/'+id,404);
      await get(f.maker,'/budget/customer/projects/'+foreign.project.id+'/versions/'+id,404);
    });
    await t.test('quantity plus action/report roles receive no costs through reads, mutations, reports, forecasts or Customer exports',async()=>{
      // Reuse assigned editor: no new retained users, grants or owner fixtures.
      tokens.set(f.editor.userId,await sessions.create(f.editor.userId));
      const codes=['budget.quantity.view','budget.boq.manage','budget.revision.submit','budget.revision.approve','cost.control.view','cost.forecast.view','management.dashboard.view','management.report.export','management.portfolio.view'];
      await grants(f.editor,codes);
      const quantity='/budget/quantity/projects/'+pid;
      const working=await(await get(f.editor,quantity+'/boq')).json();
      assert.equal(working.data.items[0].quantity,'10');
      for(const url of [quantity+'/boq',quantity+'/revisions',quantity+'/revisions/'+f.source.id]){
        const response=await get(f.editor,url);assert.equal(response.headers.get('cache-control'),'private, no-store');
        assert.doesNotMatch(await response.text(),/"(?:rate|amount|totalAmount|currencyCode|revisionNote|notes|actions|pricingSnapshot)"/);
      }
      for(const url of ['/budget/projects/'+pid+'/boq','/budget/projects/'+pid+'/revisions','/budget/revisions/'+f.source.id,root+'/options',root+'/versions/'+id,root+'/versions/'+id+'/export'])await get(f.editor,url,403);
      const patched=await call(f.editor,'/budget/projects/'+pid+'/boq',{boqName:'Updated work'},true,'PATCH');assert.equal(patched.status,200,await patched.clone().text());
      assert.deepEqual(Object.keys((await patched.json()).data).sort(),['id','projectId']);
      const reports=['/projects/'+pid+'/cost-control','/cost-control/projects/'+pid+'/forecast-options','/cost-control/projects/'+pid+'/forecasts','/cost-control/forecasts/'+randomUUID(),'/management/projects/'+pid+'/summary?asOf=2026-10-28','/management/reports?projectId='+pid+'&asOf=2026-10-28','/management/reports/export.csv?projectId='+pid+'&asOf=2026-10-28','/management/portfolio?asOf=2026-10-28'];
      for(const url of reports){const r=await get(f.editor,url,403);assert.equal((await r.json()).code,'BOQ_COST_DISCLOSURE_DENIED');}
      await get(f.editor,'/budget/quantity/projects/'+foreign.project.id+'/revisions',404);
      await get(f.editor,quantity+'/revisions/'+foreign.source.id,404);
    });
    await t.test('maker/editor and configured step roles remain authoritative through rejection, resubmission and approval',async()=>{
      await post(f.maker,root+'/versions/'+id+'/edit',{requestId:randomUUID(),expectedEditNo:1,draft:{...f.input('115'),reason:'Negotiated price'}});
      await post(f.maker,root+'/versions/'+id+'/submit',{requestId:randomUUID(),expectedEditNo:2,workflowCode:f.wf.workflowCode});
      const row=(await(await get(f.maker,root+'/versions/'+id)).json()).data;
      instance=row.version.approvalInstanceId;assert.equal(row.allowedActions.decide,false);
      assert.equal((await(await get(f.checker,root+'/versions/'+id)).json()).data.allowedActions.decide,true);
      await post(f.maker,root+'/versions/'+id+'/decision',{requestId:randomUUID(),expectedInstanceId:instance,decision:'APPROVE'},403);
      await post(f.checker,root+'/versions/'+id+'/decision',{requestId:randomUUID(),expectedInstanceId:instance,decision:'REJECT',comment:'Revise'});
      await post(f.maker,root+'/versions/'+id+'/edit',{requestId:randomUUID(),expectedEditNo:2,draft:{...f.input('112'),reason:'Revised offer'}});
      await post(f.maker,root+'/versions/'+id+'/submit',{requestId:randomUUID(),expectedEditNo:3,workflowCode:f.wf.workflowCode});
      const next=(await(await get(f.checker,root+'/versions/'+id)).json()).data;assert.notEqual(next.version.approvalInstanceId,instance);
      await post(f.checker,root+'/versions/'+id+'/decision',{requestId:randomUUID(),expectedInstanceId:instance,decision:'APPROVE'},409);
      await post(f.checker,root+'/versions/'+id+'/decision',{requestId:randomUUID(),expectedInstanceId:next.version.approvalInstanceId,decision:'APPROVE'});
      const final=(await(await get(f.maker,root+'/versions/'+id)).json()).data;
      assert.equal(final.version.approvalInstance.approvalState,'APPROVED');assert.equal(final.version.edits.length,3);
      assert.deepEqual(final.approvals.map((a:{approvalState:string})=>a.approvalState).sort(),['APPROVED','REJECTED']);
      assert.deepEqual(final.allowedActions,{edit:false,submit:false,decide:false});
      await post(f.maker,root+'/versions/'+id+'/edit',{requestId:randomUUID(),expectedEditNo:3,draft:f.input()},409);
    });
    await t.test('CSV reads the stored current commercial snapshot with four-place rate/two-place amount and never includes internal cost snapshots',async()=>{
      const r=await get(f.maker,root+'/versions/'+id+'/export');
      assert.match(r.headers.get('content-type')??'',/text\/csv/);assert.equal(r.headers.get('cache-control'),'private, no-store');
      const csv=await r.text();assert.match(csv,/"112\.0000","1120\.00","THB"/);assert.doesNotMatch(csv,/allocatedCost|costBasis|sourceSnapshot|1000\.0000/);
      const formula=f.input();formula.lines[0]!.description='=SUM(1,2)';
      const created=(await(await post(f.maker,root+'/versions',{requestId:randomUUID(),draft:formula})).json()).data;
      const safe=await(await get(f.maker,root+'/versions/'+created.id+'/export')).text();
      assert.ok(safe.includes("\"'=SUM(1,2)\""),'CSV descriptions cannot execute a formula');
    });
    await t.test('protected Customer uploads/metadata/bytes cannot be read through generic Project or quantity-only authority',async()=>{
      const docs=['documents.document.view','documents.document.upload','documents.document.link','documents.document.archive'];
      await grants(f.maker,[...all,...docs]);await grants(f.editor,['budget.quantity.view',...docs]);
      const type=await db.documentType.create({data:{companyId:f.company.id,documentTypeCode:'CBQ',documentTypeName:'Customer BOQ'}});
      const bytes=Buffer.from('%PDF-1.4\nDisposable Customer commercial document\n%%EOF');
      const form=new FormData();form.set('documentTypeId',type.id);form.set('file',new Blob([bytes],{type:'application/pdf'}),'customer.pdf');
      const token=tokens.get(f.maker.userId)!;
      const target='/documents/projects/'+pid+'/targets/CUSTOMER_BOQ/'+id;
      const upload=await fetch(base+target,{method:'POST',headers:{Cookie:'erp_session='+token.sessionToken,'x-csrf-token':token.csrfToken},body:form});
      assert.equal(upload.status,201,await upload.clone().text());documentId=(await upload.json() as {data:{id:string}}).data.id;
      const generic='/documents/projects/'+pid;
      const full=await get(f.maker,target+'/'+documentId+'/download');assert.deepEqual(Buffer.from(await full.arrayBuffer()),bytes);
      assert.deepEqual((await(await get(f.editor,generic)).json()).data,[]);
      await get(f.editor,generic+'/'+documentId+'/download',404);await get(f.editor,target,403);
      await post(f.editor,generic+'/'+documentId+'/archive',{},404);
      const options=(await(await get(f.editor,generic+'/targets/options')).json()).data;assert.deepEqual(options.customerBoqs,[]);assert.deepEqual(options.budgetRevisions,[]);assert.deepEqual(options.boqs,[]);
      await grants(f.maker,['budget.boq.view',...docs]);await get(f.maker,target,403);await get(f.maker,generic+'/'+documentId+'/download',404);
      await grants(f.maker,[...all,...docs]);await get(f.maker,generic+'/'+documentId+'/download');
    });
    await t.test('revoked persisted access denies old direct URLs and exports; source and stock/Finance ledgers stay unchanged',async()=>{
      await grants(f.maker,[]);for(const url of [root+'/versions/'+id,root+'/versions/'+id+'/export',root+'/options'])await get(f.maker,url,403);
      assert.equal(JSON.stringify(await db.budgetRevision.findUniqueOrThrow({where:{id:f.source.id},include:{lines:true}})),sourceBefore);
      assert.deepEqual(await Promise.all([db.stockTransaction.count(),db.payment.count(),db.directCostPosting.count()]),ledgersBefore);
    });
  }finally{
    await app.close();await db.$disconnect();await rm(storage,{recursive:true,force:true});
    if(oldRoot===undefined)delete process.env.STORAGE_ROOT;else process.env.STORAGE_ROOT=oldRoot;
  }
});
