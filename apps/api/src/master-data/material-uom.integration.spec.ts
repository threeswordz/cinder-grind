import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { securityHeadersMiddleware } from '../common/security-headers';
import { materialUomFixture } from './material-uom-test-fixture';

test('DEC-050 A actual PostgreSQL/HTTP: exact definitions, current authority, immutable provenance and no stock activation', async t => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.ok(/^\/(?:erp_validation|construction_erp|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/.test(url.pathname));
  const db = new PrismaService(); await db.$connect();
  const app = await NestFactory.create(AppModule, { logger: false }); app.setGlobalPrefix('api/v1'); app.use(securityHeadersMiddleware(false)); app.useGlobalFilters(new ProblemDetailsFilter()); await app.listen(0, '127.0.0.1');
  try {
    const f = await materialUomFixture(db), path = '/master-data/material-conversions/' + f.material.id, base = await app.getUrl() + '/api/v1';
    type Actor = typeof f.maker;
    async function call(actor: Actor | null, endpoint: string, expected = 200, body?: unknown, csrf = true): Promise<any> {
      const r = await fetch(base + endpoint, { method: body === undefined ? 'GET' : 'POST', headers: { ...(actor ? { Cookie: 'erp_session=' + actor.session.sessionToken, ...(csrf ? { 'X-CSRF-Token': actor.session.csrfToken } : {}) } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const result: any = await r.json(); assert.equal(r.status, expected, endpoint + ' ' + JSON.stringify(result)); assert.equal(r.headers.get('cache-control'), 'private, no-store'); return result.data;
    }
    const prepare = { requestKey: randomUUID(), stockUomId: f.each.id, reason: 'Explicit synthetic stock basis' };
    const revision = (expectedVersion: number, numerator = '20', effectiveFrom = '2026-01-01') => ({ requestKey: randomUUID(), expectedVersion, sourceUomId: f.carton.id, numerator, denominator: '1', effectiveFrom, reason: 'Explicit material-specific revision' });
    const preview = (businessDate = '2026-11-18', quantity = '2', sourceUomId = f.carton.id) => call(f.viewer, path + '/preview', 201, { businessDate, quantity, sourceUomId });
    const commercialBefore = await db.$queryRawUnsafe(`SELECT (SELECT count(*) FROM stock_transactions)::text AS stock,(SELECT count(*) FROM material_reservations)::text AS reserved,(SELECT count(*) FROM purchase_orders)::text AS orders,(SELECT count(*) FROM payments)::text AS payments`);
    const materialBefore = await db.material.findUniqueOrThrow({ where: { id: f.material.id } });
    await t.test('read/manage rights, Employee, Company, technical-admin and CSRF boundaries are distinct', async () => {
      assert.equal((await call(f.viewer, path)).state, 'NOT_PREPARED');
      await call(null, path, 401);
      for (const actor of [f.viewer, f.noConversion, f.technical, f.detached]) await call(actor, path + '/basis', 403, prepare);
      await call(f.maker, path + '/basis', 403, prepare, false);
      await call(f.foreign, path, 404);
      await call(f.maker, '/master-data/material-conversions/' + f.foreignMaterial.id, 404);
      await call(f.maker, path + '/basis', 422, { ...prepare, stockUomId: f.foreignUnit.id });
      await call(f.maker, path + '/basis', 422, { ...prepare, stockUomId: f.fine.id });
    });
    await t.test('explicit basis is pinned, has stable response-loss retries and cannot activate inventory', async () => {
      const first = await call(f.maker, path + '/basis', 201, prepare);
      assert.deepEqual(await call(f.maker, path + '/basis', 201, prepare), first);
      await call(f.maker, path + '/basis', 409, { ...prepare, reason: 'Changed replay' });
      await call(f.maker, path + '/basis', 409, { ...prepare, requestKey: randomUUID() });
      const state = await call(f.viewer, path); assert.equal(state.basis.version, 1); assert.equal(state.inventoryConversionEnabled, false);
      assert.equal(state.basis.sessionId, undefined); assert.equal(state.basis.operationId, undefined);
      assert.equal(await db.auditLog.count({ where: { companyId: f.company.id, entityType: 'MATERIAL_UOM', action: 'PREPARE' } }), 1);
      const [clock] = await db.$queryRaw<Array<{ exact: boolean }>>`SELECT b.created_at=o.created_at AS exact FROM material_uom_bases b JOIN material_uom_operations o ON o.id=b.operation_id WHERE b.material_id=${f.material.id}::uuid`;
      assert.equal(clock?.exact, true, 'Canonical source and receipt retain full PostgreSQL timestamp precision');
    });
    const original = revision(1);
    let firstRevision: any;
    await t.test('material-specific ratio and explicit business date normalize exactly without posting', async () => {
      firstRevision = await call(f.maker, path + '/revisions', 201, original);
      assert.deepEqual(await call(f.maker, path + '/revisions', 201, original), firstRevision);
      await call(f.maker, path + '/revisions', 409, { ...original, numerator: '21' });
      const result = await preview(); assert.equal(result.stockQuantity, '40.0000'); assert.equal(result.enteredQuantity, '2.0000'); assert.equal(result.revisionId, firstRevision.revisionId);
      assert.equal((await preview('2026-11-18', '2', f.each.id)).stockQuantity, '2.0000');
      await call(f.viewer, path + '/preview', 422, { sourceUomId: f.carton.id, quantity: '2', businessDate: '2025-12-31' });
      await call(f.viewer, path + '/preview', 422, { sourceUomId: f.carton.id, quantity: '2' });
      await call(f.viewer, path + '/preview', 422, { sourceUomId: f.carton.id, quantity: '2', businessDate: '2026-11-18', numerator: '999' });
      await call(f.viewer, '/master-data/material-conversions/' + f.second.id + '/preview', 422, { sourceUomId: f.carton.id, quantity: '2', businessDate: '2026-11-18' });
    });
    await t.test('future and same-date corrective revisions preserve old facts and select unambiguously', async () => {
      await call(f.maker, path + '/revisions', 201, revision(2, '24', '2027-01-01'));
      assert.equal((await preview()).stockQuantity, '40.0000'); assert.equal((await preview('2027-01-01')).stockQuantity, '48.0000');
      await call(f.maker, path + '/revisions', 201, revision(3, '22', '2027-01-01'));
      assert.equal((await preview('2027-01-01')).stockQuantity, '44.0000'); assert.equal((await preview()).revisionId, firstRevision.revisionId);
      const old = await db.materialUomRevision.findUniqueOrThrow({ where: { id: firstRevision.revisionId } }); assert.equal(old.numerator, '20');
      await assert.rejects(db.materialUomRevision.update({ where: { id: old.id }, data: { numerator: '99' } }), /MATERIAL_UOM_HISTORY_IMMUTABLE/);
      await assert.rejects(db.materialUomRevision.delete({ where: { id: old.id } }), /MATERIAL_UOM_HISTORY_IMMUTABLE/);
    });
    await t.test('nonrepresentable, source-precision and overflow quantities fail without residuals', async () => {
      await call(f.maker, path + '/revisions', 201, { ...revision(4, '1'), sourceUomId: f.third.id, denominator: '3' });
      assert.equal((await preview('2026-11-18', '3', f.third.id)).stockQuantity, '1.0000');
      for (const [quantity, sourceUomId] of [['1', f.third.id], ['0.5', f.carton.id], ['99999999999999', f.carton.id]]) await call(f.viewer, path + '/preview', 422, { sourceUomId, quantity, businessDate: '2026-11-18' });
    });
    await t.test('Stage B immutable stock-fact math rejects every residual and preserves signed reversal precision', async () => {
      const exact = async (entered: string, stock: string, numerator: string, denominator: string, sourcePrecision = 0, stockPrecision = 0) => {
        const rows = await db.$queryRaw<Array<{ exact: boolean }>>`SELECT erp_material_uom_exact_stock_fact(${entered}::numeric,${stock}::numeric,${numerator}::numeric,${denominator}::numeric,${sourcePrecision},${stockPrecision}) AS exact`;
        return rows[0]?.exact;
      };
      assert.equal(await exact('2','40','20','1'), true);
      assert.equal(await exact('3','1','1','3'), true);
      assert.equal(await exact('1','0.3333','1','3',0,4), false, 'No rounded thirds');
      assert.equal(await exact('2','39.9999','20','1',0,4), false, 'No truncated canonical stock');
      assert.equal(await exact('-2','-40','20','1'), true, 'Reversal uses the same signed basis');
      assert.equal(await exact('0.5','10','20','1'), false, 'Entered source precision enforced');
      assert.equal(await exact('2','40.1','20','1'), false, 'Stock precision enforced');
      assert.equal(await exact('99999999999999.9999','199999999999999.9998','2','1',4,4), false, 'No numeric overflow');
      assert.equal(await exact('1','1','0','1'), false, 'No zero numerator');
      assert.equal(await exact('1','1','1','0'), false, 'No zero denominator');
      const columns = await db.$queryRaw<Array<{column_name: string}>>`SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='stock_transactions' AND column_name IN ('stock_uom_id','stock_quantity','conversion_business_date','conversion_revision_id','conversion_basis_version','conversion_numerator','conversion_denominator')`;
      assert.equal(columns.length, 7, 'Forward-only optional provenance columns exist');
    });
    await t.test('SQL rejects missing/mismatched receipts, direct version changes and unit/Company repointing', async () => {
      await assert.rejects(db.materialUomBasis.update({ where: { materialId: f.material.id }, data: { version: { increment: 1 } } }), /MATERIAL_UOM_HISTORY_IMMUTABLE/);
      await assert.rejects(db.materialUomBasis.delete({ where: { materialId: f.material.id } }), /MATERIAL_UOM_HISTORY_IMMUTABLE/);
      await assert.rejects(db.unitOfMeasure.update({ where: { id: f.each.id }, data: { decimalPlaces: 1 } }), /MATERIAL_UOM_PRECISION_PINNED/);
      await assert.rejects(db.unitOfMeasure.update({ where: { id: f.carton.id }, data: { companyId: f.other.id } }), /MATERIAL_UOM_PRECISION_PINNED/);
      await assert.rejects(db.material.update({ where: { id: f.material.id }, data: { companyId: f.other.id } }), /MATERIAL_UOM_HISTORY_IMMUTABLE/);
      await assert.rejects(db.materialUomOperation.updateMany({ where: { materialId: f.material.id }, data: { outcome: {} } }), /MATERIAL_UOM_HISTORY_IMMUTABLE/);
      await assert.rejects(db.$transaction(tx => tx.materialUomBasis.create({ data: { materialId: f.second.id, companyId: f.company.id, stockUomId: f.each.id, stockPrecision: 0, stockUomCode: 'EA', stockUomName: 'EA', createdByUserId: f.maker.user.id, sessionId: f.maker.session.sessionId, operationId: randomUUID(), reason: 'No matching receipt' } })));
      assert.equal(await db.materialUomBasis.count({ where: { materialId: f.second.id } }), 0);
      await assert.rejects(db.$transaction(async tx => {
        const operationId=randomUUID();
        await tx.$executeRaw`INSERT INTO material_uom_revisions(id,company_id,material_id,source_uom_id,source_precision,source_uom_code,source_uom_name,numerator,denominator,effective_from,revision_no,created_by_user_id,session_id,operation_id,reason)
         VALUES(${randomUUID()}::uuid,${f.company.id}::uuid,${f.material.id}::uuid,${f.carton.id}::uuid,0,'CARTON','CARTON','30','1','2026-01-01',6,${f.maker.user.id}::uuid,${f.maker.session.sessionId}::uuid,${operationId}::uuid,'Mismatched immutable receipt')`;
        await tx.$executeRaw`INSERT INTO material_uom_operations(id,company_id,actor_user_id,session_id,request_key,action,material_id,input,outcome)
         VALUES(${operationId}::uuid,${f.company.id}::uuid,${f.maker.user.id}::uuid,${f.maker.session.sessionId}::uuid,${randomUUID()}::uuid,'REVISE',${f.material.id}::uuid,'{}','{}')`;
      }), /MATERIAL_UOM_RECEIPT_REQUIRED/);
      assert.equal((await call(f.viewer, path)).basis.version, 5);
    });
    await t.test('competing stale revisions have one winner; concurrent identical retries commit once', async () => {
      const a = revision(5, '21'), b = revision(5, '23');
      const settled = await Promise.allSettled([f.service.revise({ auth: f.maker.auth }, f.material.id, a), f.service.revise({ auth: f.maker.auth }, f.material.id, b)]);
      assert.equal(settled.filter(x => x.status === 'fulfilled').length, 1); assert.equal(settled.filter(x => x.status === 'rejected').length, 1);
      const same = revision(6, '25'); const outcomes = await Promise.all([f.service.revise({ auth: f.maker.auth }, f.material.id, same), f.service.revise({ auth: f.maker.auth }, f.material.id, same)]);
      assert.deepEqual(outcomes[0], outcomes[1]); assert.equal((await call(f.viewer, path)).basis.version, 7);
      assert.equal(await db.materialUomRevision.count({ where: { materialId: f.material.id } }), 6);
    });
    await t.test('labels are pinned; inactive references and revoked rights cannot replay old success', async () => {
      await db.unitOfMeasure.update({ where: { id: f.carton.id }, data: { uomCode: 'PACK' } });
      assert.equal((await preview()).sourceUomCode, 'CARTON');
      await db.unitOfMeasure.update({ where: { id: f.carton.id }, data: { isActive: false } });
      await call(f.viewer, path + '/preview', 422, { sourceUomId: f.carton.id, quantity: '2', businessDate: '2026-11-18' });
      await call(f.maker, path + '/revisions', 422, original);
      await db.unitOfMeasure.update({ where: { id: f.carton.id }, data: { isActive: true } });
      const capability = await db.permission.findUniqueOrThrow({ where: { permissionCode: 'master.material.conversion.manage' } });
      await db.rolePermission.deleteMany({ where: { roleId: f.maker.role.id, permissionId: capability.id } });
      await call(f.maker, path + '/basis', 403, prepare);
      await assert.rejects(f.service.prepare({ auth: f.maker.auth }, f.material.id, prepare), error => (error as any).getStatus() === 403);
      await db.employee.update({ where: { id: f.viewer.employee!.id }, data: { isActive: false } });
      await call(f.viewer, path, 403); await assert.rejects(f.service.get(f.viewer.auth, f.material.id), error => (error as any).getStatus() === 403);
      await f.sessions.revoke(f.maker.session.sessionId); await call(f.maker, path, 401);
      await assert.rejects(f.service.get(f.maker.auth, f.material.id), error => (error as any).getStatus() === 403);
    });
    assert.deepEqual(await db.material.findUniqueOrThrow({ where: { id: f.material.id } }), materialBefore);
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT (SELECT count(*) FROM stock_transactions)::text AS stock,(SELECT count(*) FROM material_reservations)::text AS reserved,(SELECT count(*) FROM purchase_orders)::text AS orders,(SELECT count(*) FROM payments)::text AS payments`), commercialBefore);
  } finally { await app.close(); await db.$disconnect(); }
});
