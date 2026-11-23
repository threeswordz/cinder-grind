import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { securityHeadersMiddleware } from '../common/security-headers';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../auth/session.service';

// Native evidence ONLY. Refuse to run against any configured retained, Mac,
// populated, Production or other private database, even with operator error.
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid.invalid/');
if (process.env.M4_NON_PRODUCTION_CONFIRMED !== 'YES' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.pathname !== '/erp_m4_native') {
  throw new Error('M4_NATIVE_DISPOSABLE_DATABASE_REQUIRED');
}

type Actor = {
  id: string;
  roleId: string;
  sessionId: string;
  token: string;
  csrf: string;
};
type Result<T = any> = { status: number; data: T; raw: unknown };
const parsed = async <T = any>(res: Response): Promise<Result<T>> => {
  const raw: any = await res.json().catch(() => ({}));
  return { status: res.status, data: raw.data as T, raw };
};

test('M4 native PostgreSQL + actual HTTP: Nancy, PM09 and SS13 actors, concurrent boundaries, protected bytes, no posting', async () => {
  const oldStorage = process.env.STORAGE_ROOT;
  const root = await mkdtemp(join(tmpdir(), 'm4-native-only-'));
  process.env.STORAGE_ROOT = root;
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.use(securityHeadersMiddleware(false));
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(0, '127.0.0.1');
  const db = app.get(PrismaService);
  const sessions = app.get(SessionService);
  try {
    const base = (await app.getUrl()) + '/api/v1';
    const unique = randomUUID().slice(0, 8);
    const company = await db.company.create({
      data: { companyCode: 'M4-' + unique, companyName: 'Disposable M4 Native Test Only' },
    });
    const customer = await db.customer.create({
      data: { companyId: company.id, customerCode: 'C-' + unique, customerName: 'Disposable Customer' },
    });
    const project = await db.project.create({ data: {
      companyId: company.id, customerId: customer.id, projectCode: 'P-' + unique,
      projectName: 'M4 scoped project', contractValue: '1000',
      plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2027-12-31'),
    } });
    const otherProject = await db.project.create({ data: {
      companyId: company.id, customerId: customer.id, projectCode: 'X-' + unique,
      projectName: 'M4 inaccessible project', contractValue: '1000',
      plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2027-12-31'),
    } });
    const warehouse = await db.warehouse.create({ data: {
      companyId: company.id, projectId: project.id,
      warehouseCode: 'W-' + unique, warehouseName: 'M4 site warehouse', isSiteWarehouse: true,
    } });
    const uom = await db.unitOfMeasure.create({ data: {
      companyId: company.id, uomCode: 'EA-' + unique, uomName: 'Each', decimalPlaces: 4,
    } });
    const wrongUom = await db.unitOfMeasure.create({ data: {
      companyId: company.id, uomCode: 'WR-' + unique, uomName: 'Wrong dimension', decimalPlaces: 4,
    } });
    const material = await db.material.create({ data: {
      companyId: company.id, defaultUomId: uom.id,
      materialCode: 'M-' + unique, materialName: 'Test aggregate', materialCategory: 'AGGREGATE',
    } });
    const documentType = await db.documentType.create({ data: {
      companyId: company.id, documentTypeCode: 'TEST-' + unique, documentTypeName: 'M4 test evidence',
    } });

    const rights = [...new Set([
      'inventory.issue.view', 'inventory.issue.create', 'inventory.issue.approve',
      'inventory.stock.view', 'inventory.stock_count.view',
      'documents.document.view', 'documents.document.upload', 'documents.document.link',
    ])];
    const permissionIds = new Map<string,string>();
    for (const code of rights) {
      const row = await db.permission.upsert({
        where: { permissionCode: code }, update: {},
        create: { permissionCode: code, moduleCode: code.slice(0, code.indexOf('.')).toUpperCase() },
      });
      permissionIds.set(code, row.id);
    }
    async function actor(label: string, roleCode: string, allowed: string[], scope: string): Promise<Actor> {
      const employee = await db.employee.create({ data: {
        companyId: company.id, employeeCode: label + unique,
        employeeName: 'Synthetic ' + label,
      } });
      const user = await db.user.create({ data: {
        companyId: company.id, employeeId: employee.id,
        email: label.toLowerCase() + '-' + unique + '@example.invalid',
        displayName: 'Synthetic ' + label, passwordHash: 'not-a-login',
      } });
      // Multiple personnel may hold the same Company role. Never create a
      // duplicate STOREKEEPER Role merely because a second User belongs to
      // an inaccessible Project. Role identity is Company + roleCode.
      const role = (await db.role.findFirst({ where: { companyId: company.id, roleCode } })) ??
        await db.role.create({ data: {
          companyId: company.id, roleCode, roleName: 'Synthetic ' + roleCode,
        } });
      await db.rolePermission.createMany({ data: allowed.map(code => ({
        roleId: role.id, permissionId: permissionIds.get(code)!,
      })), skipDuplicates:true });
      await db.userRole.create({ data: { companyId: company.id, userId: user.id, roleId: role.id } });
      await db.projectMember.create({ data: {
        projectId: scope, employeeId: employee.id, projectRole: roleCode,
      } });
      const session = await sessions.create(user.id);
      return { id: user.id, roleId: role.id, sessionId: session.sessionId,
        token: session.sessionToken, csrf: session.csrfToken };
    }
    const doc = ['documents.document.view'];
    const store = await actor('Store', 'STOREKEEPER', [
      'inventory.issue.view', 'inventory.issue.create', 'inventory.stock.view',
      'inventory.stock_count.view', ...doc, 'documents.document.upload', 'documents.document.link',
    ], project.id);
    const pm = await actor('PM', 'PROJECT_MANAGER', [
      'inventory.issue.view', 'inventory.issue.approve', 'inventory.stock.view',
      'inventory.stock_count.view', ...doc,
    ], project.id);
    const nancy = await actor('Nancy', 'FINANCE_MANAGER', [
      'inventory.stock_count.view','inventory.stock.view',...doc,
    ], project.id);
    const ben = await actor('Ben', 'MANAGEMENT', [
      'inventory.stock.view',...doc,
    ], project.id);
    const outsider = await actor('Other', 'STOREKEEPER', [
      'inventory.issue.view', 'inventory.issue.create','inventory.stock.view',
      'inventory.stock_count.view',...doc,
    ], otherProject.id);

    async function call<T = any>(who: Actor, method: 'GET'|'POST', path: string, body?: unknown) {
      return parsed<T>(await fetch(base + path, {
        method,
        headers: {
          Cookie: 'erp_session=' + who.token,
          ...(method === 'POST' ? {'x-csrf-token': who.csrf, 'Content-Type': 'application/json'} : {}),
        },
        ...(method === 'POST' ? {body: JSON.stringify(body ?? {})} : {}),
      }));
    }
    async function ok<T = any>(
      who:Actor, method:'GET'|'POST', path:string, body:unknown = undefined, code=method==='POST'?201:200
    ) {
      const result = await call<T>(who, method, path, body);
      assert.equal(result.status, code, method + ' ' + path + ': ' + JSON.stringify(result.raw));
      return result.data;
    }
    async function denied(
      who:Actor, method:'GET'|'POST', path:string, body:unknown=undefined
    ) {
      const result = await call(who, method, path, body);
      assert.notEqual(result.status, 200, method + ' ' + path + ' must not succeed');
      assert.notEqual(result.status, 201, method + ' ' + path + ' must not mutate');
      assert.ok([400,401,403,404,409,422].includes(result.status),
        'Expected a refused request, got ' + result.status + ' ' + JSON.stringify(result.raw));
      return result;
    }
    async function upload(who:Actor,path:string,payload:Buffer){
      const form = new FormData();
      form.set('documentTypeId', documentType.id);
      form.set('file', new Blob([new Uint8Array(payload)], {type:'application/pdf'}),'proof.pdf');
      const result=await parsed<{id:string}>(await fetch(base+path, {
        method:'POST',headers:{Cookie:'erp_session='+who.token,'x-csrf-token':who.csrf},body:form,
      }));
      assert.equal(result.status,201,path+': '+JSON.stringify(result.raw));
      return result.data.id;
    }
    const schedulePath='/inventory/stock-count-schedules/projects/'+project.id+'/sites/'+warehouse.id;
    // Sequentially awaited assertions deliberately fail the parent test.
    // Node's t.test() child assertion failures do NOT reject the parent.
    await (async()=>{
      const input={materialCategory:'AGGREGATE',firstDueDate:'2026-11-24',
        intervalDays:7,status:'ACTIVE',reason:'Explicit synthetic weekly count',
        expectedPreviousEventId:null};
      await denied(store,'POST',schedulePath,input);
      await denied(outsider,'GET',schedulePath+'?asOfDate=2026-11-23');
      const created=await ok<{version:number}>(nancy,'POST',schedulePath,input);
      assert.equal(created.version,1);
      const read=await ok<{schedules:Array<{version:number;lastEventId:string;nextDueDate:string}>}>(
        store,'GET',schedulePath+'?asOfDate=2026-11-23');
      assert.equal(read.schedules[0]!.nextDueDate,'2026-11-24');
      const event=read.schedules[0]!.lastEventId;
      await denied(nancy,'POST',schedulePath,{...input,reason:'Cannot create twice'});
      const next=await ok<{version:number}>(nancy,'POST',schedulePath,{
        ...input,intervalDays:14,reason:'Deliberate revision',expectedPreviousEventId:event,
      });
      assert.equal(next.version,2);
      await denied(nancy,'POST',schedulePath,{
        ...input,intervalDays:21,reason:'Stale writer',expectedPreviousEventId:event,
      });
      const current=await ok<{schedules:Array<{version:number;intervalDays:number}>}>(
        nancy,'GET',schedulePath+'?asOfDate=2026-11-23');
      assert.equal(current.schedules[0]!.version,2);
      assert.equal(current.schedules[0]!.intervalDays,14);
      await denied(nancy,'POST',schedulePath,{...input,materialCategory:'NOT_IN_MASTER'});
    })();
    console.log('M4_NATIVE_NANCY_SCOPE_PASS');

    const stockBefore=await db.stockTransaction.count({where:{companyId:company.id}});
    const financeBefore=await db.directCostPosting.count({where:{companyId:company.id}});
    const date=new Date(Date.now()-52*3600000);
    const issue=await db.materialIssue.create({data:{
      companyId:company.id,projectId:project.id,warehouseId:warehouse.id,
      issueNumber:'MI-'+unique,issueDate:date,createdByUserId:store.id,
      postedByUserId:store.id,postedAt:date,postKey:'M4-NATIVE-'+unique,
    }});
    const actualPdf=Buffer.from('%PDF-1.4\nM4 scoped native non-Production evidence\n%%EOF\n');
    const issueDocPath='/documents/projects/'+project.id+'/targets/MATERIAL_ISSUE/'+issue.id;
    await (async()=>{
      await denied(pm,'POST','/inventory/urgent-issue-documents/'+issue.id+'/register',{reason:'Wrong actor'});
      const registered=await ok<{dueAt:string}>(
        store,'POST','/inventory/urgent-issue-documents/'+issue.id+'/register',
        {reason:'Actual posted issue lacked documents'});
      assert.ok(Date.parse(registered.dueAt)<Date.now(),'posted issue deadline must remain late');
      const docId=await upload(store,issueDocPath,actualPdf);
      const download=await fetch(base+issueDocPath+'/'+docId+'/download',{
        headers:{Cookie:'erp_session='+store.token},
      });
      assert.equal(download.status,200,'authorized actual evidence byte download');
      assert.deepEqual(Buffer.from(await download.arrayBuffer()),actualPdf);
      const blocked=await fetch(base+issueDocPath+'/'+docId+'/download',{
        headers:{Cookie:'erp_session='+outsider.token},
      });
      assert.ok([403,404].includes(blocked.status),
        'unassigned Project must be refused with 403/404, got '+blocked.status);
      await ok(store,'POST','/inventory/urgent-issue-documents/'+issue.id+'/submit',{
        documentIds:[docId],completionNote:'Completed with actual linked source evidence',
      });
      const state=await ok<{record:{status:string;lastEventId:string;evidenceFingerprint:string;
        sourceCurrent:boolean;overdue:boolean}}>(pm,'GET',
        '/inventory/urgent-issue-documents/'+issue.id);
      assert.equal(state.record.status,'SUBMITTED'); assert.equal(state.record.sourceCurrent,true);
      assert.equal(state.record.overdue,true);
      const decidePath='/inventory/urgent-issue-documents/'+issue.id+'/decision';
      const req={decision:'CLOSE',expectedSubmissionEventId:state.record.lastEventId,
        expectedFingerprint:state.record.evidenceFingerprint,note:'Independent evidence check'};
      await denied(store,'POST',decidePath,req);
      const decided=await ok<{onTime:boolean}>(pm,'POST',decidePath,req);
      assert.equal(decided.onTime,false,'late evidence may close but cannot be on time');
      await denied(pm,'POST',decidePath,req);
      await db.document.update({where:{id:docId},data:{isActive:false}});
      await denied(pm,'GET','/inventory/urgent-issue-documents/'+issue.id);
    })();
    console.log('M4_NATIVE_PM09_PROTECTED_BYTES_PASS');

    await (async()=>{
      const docId=await upload(store,'/documents/projects/'+project.id,actualPdf);
      const body={projectId:project.id,warehouseId:warehouse.id,materialId:material.id,
        uomId:uom.id,quantity:'2.0000',kind:'DAMAGE',occurredOn:'2026-11-23',
        finderName:'Synthetic site finder',place:'Section A',cause:'Damaged in transit',
        proposedDisposition:'DISPOSAL',evidenceDocumentIds:[docId]};
      await denied(store,'POST','/inventory/stock-loss-cases',{...body,uomId:wrongUom.id});
      await denied(outsider,'POST','/inventory/stock-loss-cases',body);
      const opened=await ok<{caseId:string}>(store,'POST','/inventory/stock-loss-cases',body);
      const id=opened.caseId,path='/inventory/stock-loss-cases/'+id;
      await denied(outsider,'GET',path);
      const stage=await ok<{latestEventId:string;version:number;status:string}>(pm,'GET',path);
      assert.equal(stage.status,'OPEN');
      const screen=path+'/pm-screen';
      await denied(pm,'POST',screen,{expectedPreviousEventId:stage.latestEventId,
        decision:'RETURN',escalateToBen:true,note:'Invalid conflicting disposition'});
      assert.equal((await ok<{version:number}>(pm,'GET',path)).version,1,
        'invalid PM choice must not write a permanent unreadable audit record');
      const valid={expectedPreviousEventId:stage.latestEventId,
        decision:'FORWARD_DISPOSAL',escalateToBen:true,note:'Significant severity'};
      await denied(store,'POST',screen,valid);
      await ok(pm,'POST',screen,valid);
      await denied(pm,'POST',screen,valid);
      const pending=await ok<{latestEventId:string;status:string}>(ben,'GET',path);
      assert.equal(pending.status,'BEN_PENDING');
      await denied(nancy,'POST',path+'/nancy-decision',{
        expectedPreviousEventId:pending.latestEventId,
        decision:'APPROVE_PROPOSAL',note:'Cannot skip Ben'});
      await ok(ben,'POST',path+'/ben-review',{
        expectedPreviousEventId:pending.latestEventId,note:'Acknowledged severity only'});
      const forNancy=await ok<{latestEventId:string;status:string}>(nancy,'GET',path);
      assert.equal(forNancy.status,'NANCY_PENDING');
      await ok(nancy,'POST',path+'/nancy-decision',{
        expectedPreviousEventId:forNancy.latestEventId,
        decision:'APPROVE_PROPOSAL',note:'Approve proposal only'});
      const end=await ok<{status:string;stockDisposalExecuted:boolean;financeWriteOffPosted:boolean}>(
        pm,'GET',path);
      assert.equal(end.status,'NANCY_APPROVED_PENDING_EXECUTION');
      assert.equal(end.stockDisposalExecuted,false);
      assert.equal(end.financeWriteOffPosted,false);
      assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),stockBefore);
      assert.equal(await db.directCostPosting.count({where:{companyId:company.id}}),financeBefore);
      await db.userSession.update({where:{id:nancy.sessionId},data:{revokedAt:new Date()}});
      await denied(nancy,'GET',path);
    })();
    console.log('M4_NATIVE_AUTHENTICATED_API_SCOPED_PASS: schedule/PM09/SS13, actual bytes, no financial or stock posting');
  } finally {
    await app.close();
    if (oldStorage === undefined) delete process.env.STORAGE_ROOT;
    else process.env.STORAGE_ROOT=oldStorage;
    await rm(root,{recursive:true,force:true});
  }
});
