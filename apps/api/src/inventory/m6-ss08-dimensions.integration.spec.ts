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
import { PrismaService } from '../prisma/prisma.service';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { materialRequestFixture } from './material-request-test-fixture';

// Standalone focused native test. Never run against the retained prototype.
test('M6 SS08: exact request, issue and stock dimensions, scoped choices and replay', async () => {
  const expected = process.env.M6_SS08_DISPOSABLE_DB;
  assert.match(expected ?? '', /^m6_ss08_[a-f0-9]{8}$/);
  const db = new PrismaService();
  await db.$connect();
  const previous = process.env.STORAGE_ROOT;
  let storage: string | undefined;
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    const identity = await db.$queryRaw<Array<{name: string}>>`SELECT current_database() AS name`;
    assert.equal(identity[0]?.name, expected, 'only the explicitly named disposable database is admitted');
    storage = await mkdtemp(join(tmpdir(), 'm6-ss08-'));
    process.env.STORAGE_ROOT = storage;
    app = await NestFactory.create(AppModule, {logger: false});
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.listen(0, '127.0.0.1');
    const f = await materialRequestFixture(db);
    const base = await app.getUrl() + '/api/v1';
    const root = '/inventory/material-requests';
    const call = async (actor: typeof f.store, url: string, status: number, body?: unknown) => {
      const response = await fetch(base + url, {method: body === undefined ? 'GET' : 'POST', headers: {Cookie: 'erp_session=' + actor.session.sessionToken, 'x-csrf-token': actor.session.csrfToken, 'Content-Type': 'application/json'}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
      assert.equal(response.status, status, 'unexpected HTTP status for synthetic SS08 operation');
      return await response.json() as any;
    };
    const wbs = await db.wbsElement.create({data: {projectId: f.project.id, wbsCode: 'M6-SS08', wbsName: 'Synthetic work package'}});
    const cost = await db.costCode.create({data: {companyId: f.company.id, costCode: 'M6-SS08', costName: 'Synthetic cost dimension'}});
    const foreignCost = await db.costCode.create({data: {companyId: f.foreign.id, costCode: 'M6-SS08', costName: 'Foreign cost dimension'}});
    const calendar = await db.workingCalendar.create({data: {companyId: f.company.id, projectId: f.project.id, calendarName: 'Synthetic calendar', timezoneName: 'Asia/Bangkok'}});
    const activity = await db.activity.create({data: {companyId: f.company.id, projectId: f.project.id, wbsId: wbs.id, workingCalendarId: calendar.id, activityCode: 'M6-SS08', activityName: 'Synthetic activity', plannedDurationWorkDays: '1', plannedStartDate: new Date('2026-11-02T00:00:00Z'), plannedFinishDate: new Date('2026-11-02T00:00:00Z')}});
    const dimensions = {wbsId: wbs.id, costCodeId: cost.id, activityId: activity.id};
    const input = f.input('3.0000');
    const body = {...input, lines: [{...input.lines[0]!, ...dimensions}]};
    await call(f.store, root, 422, {...body, requestKey: randomUUID(), lines: [{...body.lines[0]!, costCodeId: foreignCost.id}]});
    const request = (await call(f.store, root, 201, body)).data;
    const detail = (await call(f.store, root + '/' + request.id, 200)).data;
    const line = detail.lines[0];
    for (const [key, value] of Object.entries(dimensions)) assert.equal(line[key], value);
    await call(f.outsider, root + '/' + request.id, 403);
    const wrong = await f.issue('1'); // valid posted item, but no work dimensions
    const workflow = await db.approvalWorkflow.findFirstOrThrow({where: {companyId: f.company.id, workflowCode: 'MR-ISSUE'}});
    const issue = await f.issues.create({auth: f.store.auth}, {projectId: f.project.id, warehouseId: f.warehouse.id, issueDate: new Date('2026-11-02T00:00:00Z'), issuedToEmployeeId: f.foreman.employee.id, lines: [{materialId: f.material.id, uomId: f.uom.id, quantity: new Prisma.Decimal('3'), ...dimensions}]});
    await f.issues.submit({auth: f.store.auth}, issue.id, workflow.workflowCode);
    await f.issues.approve({auth: f.manager.auth}, issue.id, randomUUID());
    const posted = await f.issues.get(f.store.auth, issue.id);
    const item = posted.items[0]!;
    const choices = (await call(f.store, root + '/' + request.id + '/issue-choices?lineId=' + line.id, 200)).data.items;
    assert.deepEqual(choices.map((x: {id: string}) => x.id), [item.id]);
    const link = {requestKey: randomUUID(), expectedVersion: detail.version, requestLineId: line.id, materialIssueItemId: item.id, reason: 'Synthetic dimensioned issue'};
    const stockBefore = await db.stockTransaction.count({where: {companyId: f.company.id}});
    await call(f.store, root + '/' + request.id + '/issue-links', 422, {...link, requestKey: randomUUID(), materialIssueItemId: wrong.items[0]!.id});
    const linked = (await call(f.store, root + '/' + request.id + '/issue-links', 201, link)).data;
    assert.deepEqual((await call(f.store, root + '/' + request.id + '/issue-links', 201, link)).data, linked);
    assert.equal(await db.stockTransaction.count({where: {companyId: f.company.id}}), stockBefore, 'link/replay cannot create stock effects');
    const effect = await db.stockTransaction.findFirstOrThrow({where: {materialIssueItemId: item.id, movementType: 'MATERIAL_ISSUE'}});
    for (const [key, value] of Object.entries(dimensions)) assert.equal(effect[key as keyof typeof dimensions], value);
    const final = (await call(f.store, root + '/' + request.id, 200)).data.lines[0];
    assert.equal(final.issuedQuantity, '3.0000');
    assert.equal(final.remainingQuantity, '0.0000');
    assert.equal(final.acknowledgedQuantity, '0.0000');
    for (const [key, value] of Object.entries(dimensions)) assert.equal(final[key], value);
  } finally {
    try { await app?.close(); } finally {
      await db.$disconnect();
      if (previous === undefined) delete process.env.STORAGE_ROOT; else process.env.STORAGE_ROOT = previous;
      if (storage) await rm(storage, {recursive: true, force: true});
    }
  }
});
