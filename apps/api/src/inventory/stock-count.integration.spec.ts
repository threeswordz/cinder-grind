import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { InventoryQuantityService } from './inventory-quantity.service';
import { MaterialReservationService } from './material-reservation.service';
import { InventoryReportService } from './inventory-report.service';
import { StockBalanceService } from './stock-balance.service';
import { StockCountService } from './stock-count.service';

function auth(companyId: string, userId: string, permissions: string[]): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(), userId, companyId, email: userId + '@example.com',
    displayName: 'Stock Count User', roleCodes: ['SYNTHETIC_STOCK_COUNT'],
    permissions, csrfTokenHash: '0'.repeat(64),
  };
}

test('OP-STOCK-COUNT-01 quantity-only reconciliation is scoped, stale-safe, reserved-safe and maker-checker', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({ data: { companyCode: 'SC-' + suffix, companyName: 'Stock Count ' + suffix } });
    const customer = await prisma.customer.create({ data: {
      companyId: company.id, customerCode: 'SC-C-' + suffix, customerName: 'Count Customer',
    }});
    const project = await prisma.project.create({ data: {
      companyId: company.id, projectCode: 'SC-P-' + suffix, projectName: 'Count Project',
      customerId: customer.id, contractValue: '1000',
      plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
      plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
    }});
    const storeEmployee = await prisma.employee.create({ data: {
      companyId: company.id, employeeCode: 'SC-S-' + suffix, employeeName: 'Store Site',
    }});
    const managerEmployee = await prisma.employee.create({ data: {
      companyId: company.id, employeeCode: 'SC-M-' + suffix, employeeName: 'Project Manager',
    }});
    const store = await prisma.user.create({ data: {
      companyId: company.id, employeeId: storeEmployee.id, email: 'store-' + suffix + '@example.com',
      displayName: 'Store Site', passwordHash: 'x',
    }});
    const manager = await prisma.user.create({ data: {
      companyId: company.id, employeeId: managerEmployee.id, email: 'pm-' + suffix + '@example.com',
      displayName: 'Khaimook synthetic', passwordHash: 'x',
    }});
    await prisma.projectMember.createMany({ data: [
      { projectId: project.id, employeeId: storeEmployee.id, projectRole: 'Store' },
      { projectId: project.id, employeeId: managerEmployee.id, projectRole: 'Project Manager' },
    ]});
    const uom = await prisma.unitOfMeasure.create({ data: {
      companyId: company.id, uomCode: 'EA-' + suffix, uomName: 'Each', decimalPlaces: 4,
    }});
    const alternativeUom = await prisma.unitOfMeasure.create({ data: {
      companyId: company.id, uomCode: 'BOX-' + suffix, uomName: 'Box', decimalPlaces: 4,
    }});
    const material = await prisma.material.create({ data: {
      companyId: company.id, materialCode: 'MAT-' + suffix, materialName: 'Count Material', defaultUomId: uom.id,
    }});
    const site = await prisma.warehouse.create({ data: {
      companyId: company.id, projectId: project.id, warehouseCode: 'SITE-' + suffix,
      warehouseName: 'Site Store', isSiteWarehouse: true,
    }});
    const central = await prisma.warehouse.create({ data: {
      companyId: company.id, warehouseCode: 'MAIN-' + suffix, warehouseName: 'Central Store', isSiteWarehouse: false,
    }});

    const access = new ProjectAccessService(prisma, new ProjectScopeService(new AuthorizationService()));
    const quantities = new InventoryQuantityService(prisma);
    const service = new StockCountService(prisma, access, new AuditService(prisma), quantities);
    const reservationService = new MaterialReservationService(prisma, access,
      new AuditService(prisma), new NumberSequenceService(prisma), quantities);
    const reports = new InventoryReportService(
      prisma,
      access,
      new StockBalanceService(prisma, access),
    );
    const storeAuth = auth(company.id, store.id, [
      'inventory.stock_count.view','inventory.stock_count.create','inventory.stock_count.edit','inventory.stock_count.submit',
    ]);
    const managerAuth = auth(company.id, manager.id, ['inventory.stock_count.view','inventory.stock_count.approve']);

    const choices = await service.choices(storeAuth, project.id, site.id);
    assert.equal(choices.items.some(item =>
      item.materialId === material.id && item.uomId === uom.id
    ), true);
    await assert.rejects(
      () => service.choices(storeAuth, project.id, central.id),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    await assert.rejects(() => service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: central.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(1), evidenceReference: 'inspection',
    }), (error: unknown) => error instanceof UnprocessableEntityException);

    // A same-Company active UOM is NOT automatically valid for this Material/warehouse.
    // The UI offers only the default UOM or an already posted stock dimension.
    await assert.rejects(() => service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: alternativeUom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(8), evidenceReference: 'invalid unit',
    }), (error: unknown) => error instanceof UnprocessableEntityException,
    'stock count must reject a never-used, non-default UOM for the selected Material/site');
    assert.equal(await prisma.stockCount.count({ where: {
      companyId: company.id, projectId: project.id, warehouseId: site.id,
      materialId: material.id, uomId: alternativeUom.id,
    }}), 0);

    const plus = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(5), evidenceReference: 'photo ref +5',
    });
    assert.equal(plus.expectedOnHand.toString(), '0');
    const plusSubmitted = await service.submit({ auth: storeAuth }, plus.id, plus.version);
    const plusApproved = await service.approve(
      { auth: managerAuth }, plus.id, plusSubmitted.version, 'SC-PLUS-' + suffix, 'verified count',
    );
    assert.equal(plusApproved.status, 'APPROVED');
    assert.equal(plusApproved.stockTransaction?.quantity.toString(), '5');
    const movementSummary = await reports.movementSummary(managerAuth, project.id);
    assert.equal(movementSummary.stockCountRowCount, 1);
    const countMovements = await reports.movementReport(managerAuth, {
      projectId: project.id,
      sourceType: 'STOCK_COUNT',
    });
    assert.equal(countMovements.length, 1);
    assert.equal(countMovements[0]?.sourceType, 'STOCK_COUNT');
    assert.equal(countMovements[0]?.sourceId, plus.id);
    assert.equal(countMovements[0]?.sourceNumber, null);
    assert.equal(countMovements[0]?.movementType, 'STOCK_COUNT_ADJUSTMENT');
    const dimension = { companyId: company.id, projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id };
    assert.equal((await quantities.onHand(prisma, dimension)).toString(), '5');

    const minus = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(3), evidenceReference: 'photo ref -2',
    });
    const minusSubmitted = await service.submit({ auth: storeAuth }, minus.id, minus.version);
    const minusApproved = await service.approve({ auth: managerAuth }, minus.id, minusSubmitted.version, 'SC-MINUS-' + suffix);
    assert.equal(minusApproved.stockTransaction?.quantity.toString(), '-2');
    assert.equal((await quantities.onHand(prisma, dimension)).toString(), '3');
    const replay = await service.approve({ auth: managerAuth }, minus.id, minusSubmitted.version, 'SC-MINUS-' + suffix);
    assert.equal(replay.stockTransaction?.id, minusApproved.stockTransaction?.id);
    await assert.rejects(() => service.approve(
      { auth: managerAuth }, minus.id, minusSubmitted.version, 'SC-MINUS-CHANGED-' + suffix,
    ), (error: unknown) => error instanceof ConflictException);

    const zero = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(3),
    });
    const zeroSubmitted = await service.submit({ auth: storeAuth }, zero.id, zero.version);
    const zeroApproved = await service.approve({ auth: managerAuth }, zero.id, zeroSubmitted.version, 'SC-ZERO-' + suffix);
    assert.equal(zeroApproved.stockTransaction, null);

    const noEvidence = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(4),
    });
    await assert.rejects(() => service.submit({ auth: storeAuth }, noEvidence.id, noEvidence.version),
      (error: unknown) => error instanceof UnprocessableEntityException);

    const stale = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(3),
    });
    const mover = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(4), evidenceReference: 'move stock',
    });
    const moverSubmitted = await service.submit({ auth: storeAuth }, mover.id, mover.version);
    await service.approve({ auth: managerAuth }, mover.id, moverSubmitted.version, 'SC-MOVE-' + suffix);
    await assert.rejects(() => service.submit({ auth: storeAuth }, stale.id, stale.version),
      (error: unknown) => error instanceof ConflictException);

    const selfMade = await service.create({ auth: managerAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(4),
    });
    const selfSubmitted = await service.submit({ auth: managerAuth }, selfMade.id, selfMade.version);
    await assert.rejects(() => service.approve(
      { auth: managerAuth }, selfMade.id, selfSubmitted.version, 'SC-SELF-' + suffix,
    ), (error: unknown) => error instanceof ForbiddenException);

    const reservationSnapshot = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(1), evidenceReference: 'physical shortage observed',
    });
    const reservation = await prisma.materialReservation.create({ data: {
      companyId: company.id, projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      reservationNumber: 'SC-RSV-' + suffix, quantity: new Prisma.Decimal(2), createdByUserId: store.id,
    }});
    await prisma.materialReservation.update({ where: { id: reservation.id }, data: {
      status: 'ACTIVE', activatedByUserId: store.id, activatedAt: new Date(),
    }});
    await assert.rejects(() => service.submit(
      { auth: storeAuth }, reservationSnapshot.id, reservationSnapshot.version,
    ), (error: unknown) => error instanceof ConflictException,
    'reservation changes after the physical snapshot must force a recount/review');

    const shortage = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(1), evidenceReference: 'verified shortage below reservation',
    });
    const shortageSubmitted = await service.submit({ auth: storeAuth }, shortage.id, shortage.version);
    const shortageApproved = await service.approve(
      { auth: managerAuth }, shortage.id, shortageSubmitted.version, 'SC-SHORT-' + suffix,
    );
    assert.equal(shortageApproved.stockTransaction?.quantity.toString(), '-3');
    assert.equal((await quantities.onHand(prisma, dimension)).toString(), '1');

    // SC-AC-05 ABA regression: canonical append-only movements can change
    // between count and submission and then return on-hand to the original
    // numeric snapshot. A recount is still required, even if sums match.
    const abaBefore = await quantities.onHand(prisma, dimension);
    const abaDraft = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: abaBefore,
    });
    const abaUp = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: abaBefore.plus(1), evidenceReference: 'ABA test up',
    });
    const abaUpSubmitted = await service.submit({ auth: storeAuth }, abaUp.id, abaUp.version);
    await service.approve({ auth: managerAuth }, abaUp.id, abaUpSubmitted.version, 'SC-ABA-UP-' + suffix);
    const abaDown = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: abaBefore, evidenceReference: 'ABA test down',
    });
    const abaDownSubmitted = await service.submit({ auth: storeAuth }, abaDown.id, abaDown.version);
    await service.approve({ auth: managerAuth }, abaDown.id, abaDownSubmitted.version, 'SC-ABA-DOWN-' + suffix);
    assert.equal((await quantities.onHand(prisma, dimension)).toString(), abaBefore.toString(),
      'canonical adjustments must restore the aggregate for this ABA test');
    await assert.rejects(
      () => service.submit({ auth: storeAuth }, abaDraft.id, abaDraft.version),
      (error: unknown) => error instanceof ConflictException,
      'new stock ledger events must make the count stale even if on-hand returns to the same total',
    );

    // Also reject at independent approval after the count was already submitted.
    const abaAwaitingDecision = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: abaBefore,
    });
    const abaAwaitingSubmitted = await service.submit(
      { auth: storeAuth }, abaAwaitingDecision.id, abaAwaitingDecision.version,
    );
    const abaSecondUp = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: abaBefore.plus(1), evidenceReference: 'approval ABA up',
    });
    const abaSecondUpSubmitted = await service.submit(
      { auth: storeAuth }, abaSecondUp.id, abaSecondUp.version,
    );
    await service.approve({ auth: managerAuth }, abaSecondUp.id,
      abaSecondUpSubmitted.version, 'SC-ABA-APPROVAL-UP-' + suffix);
    const abaSecondDown = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: abaBefore, evidenceReference: 'approval ABA down',
    });
    const abaSecondDownSubmitted = await service.submit(
      { auth: storeAuth }, abaSecondDown.id, abaSecondDown.version,
    );
    await service.approve({ auth: managerAuth }, abaSecondDown.id,
      abaSecondDownSubmitted.version, 'SC-ABA-APPROVAL-DOWN-' + suffix);
    assert.equal((await quantities.onHand(prisma, dimension)).toString(), abaBefore.toString());
    await assert.rejects(() => service.approve(
      { auth: managerAuth }, abaAwaitingDecision.id,
      abaAwaitingSubmitted.version, 'SC-ABA-STALE-DECISION-' + suffix,
    ), (error: unknown) => error instanceof ConflictException,
    'approval cannot accept a stale historical ledger count after net-zero movements');
    assert.equal(await prisma.stockTransaction.count({ where: {
      stockCountId: abaAwaitingDecision.id,
    }}), 0, 'a stale attempted approval may not create a ledger effect');

    // A different reservation can replace the previous ACTIVE reservation for
    // the same quantity: this remains a different reservation history.
    const abaReservationDraft = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: abaBefore,
    });
    const replacementReservation = await prisma.materialReservation.create({ data: {
      companyId: company.id, projectId: project.id, warehouseId: site.id,
      materialId: material.id, uomId: uom.id,
      reservationNumber: 'SC-ABA-RSV-' + suffix,
      quantity: new Prisma.Decimal(2), createdByUserId: store.id,
    }});
    await prisma.materialReservation.update({ where: { id: reservation.id },
      data: { status: 'RELEASED', releasedByUserId: store.id, releasedAt: new Date(),
        releaseReason: 'synthetic replacement' } });
    await prisma.materialReservation.update({ where: { id: replacementReservation.id },
      data: { status: 'ACTIVE', activatedByUserId: store.id, activatedAt: new Date() } });
    assert.equal((await quantities.activeReserved(prisma, dimension)).toString(), '2',
      'same aggregate reservation quantity must remain for the ABA reproduction');
    await assert.rejects(
      () => service.submit({ auth: storeAuth }, abaReservationDraft.id, abaReservationDraft.version),
      (error: unknown) => error instanceof ConflictException,
      'different reservation identity/history must stale the original count snapshot',
    );

    // Reservation release/cancellation must serialize on the exact same
    // dimension lock as a count approval. The test holds the lock in one
    // disposable transaction, then starts a real reservation service call.
    // A prior implementation could complete release/cancel while this lock
    // was held, making count validation/decision ordering ambiguous.
    const countBeforeRelease = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: abaBefore,
    });
    const countBeforeReleaseSubmitted = await service.submit(
      { auth: storeAuth }, countBeforeRelease.id, countBeforeRelease.version,
    );
    let releaseSettled = false;
    let releaseWhileLocked = false;
    let releasePromise!: Promise<unknown>;
    await prisma.$transaction(async tx => {
      await quantities.lock(tx, dimension);
      releasePromise = reservationService.release(
        { auth: storeAuth }, replacementReservation.id, 'synthetic counted-stock release',
      ).finally(() => { releaseSettled = true; });
      await new Promise(resolve => setTimeout(resolve, 600));
      releaseWhileLocked = releaseSettled;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await releasePromise;
    assert.equal(releaseWhileLocked, false,
      'reservation release must wait for the exact inventory stock-dimension lock');
    await assert.rejects(() => service.approve(
      { auth: managerAuth }, countBeforeRelease.id, countBeforeReleaseSubmitted.version,
      'SC-RELEASE-RACE-' + suffix,
    ), (error: unknown) => error instanceof ConflictException,
    'approval must reject a reservation release committed after physical count');
    assert.equal(await prisma.stockTransaction.count({ where: { stockCountId: countBeforeRelease.id } }), 0);

    const cancellableReservation = await prisma.materialReservation.create({ data: {
      companyId: company.id, projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      reservationNumber: 'SC-CANCEL-' + suffix, quantity: new Prisma.Decimal(1),
      createdByUserId: store.id,
    } });
    await prisma.materialReservation.update({ where: { id: cancellableReservation.id },
      data: { status: 'ACTIVE', activatedByUserId: store.id, activatedAt: new Date() } });
    const countBeforeCancel = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: abaBefore,
    });
    const countBeforeCancelSubmitted = await service.submit(
      { auth: storeAuth }, countBeforeCancel.id, countBeforeCancel.version,
    );
    let cancelSettled = false;
    let cancelWhileLocked = false;
    let cancelPromise!: Promise<unknown>;
    await prisma.$transaction(async tx => {
      await quantities.lock(tx, dimension);
      cancelPromise = reservationService.cancel(
        { auth: storeAuth }, cancellableReservation.id, 'synthetic counted-stock cancel',
      ).finally(() => { cancelSettled = true; });
      await new Promise(resolve => setTimeout(resolve, 600));
      cancelWhileLocked = cancelSettled;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await cancelPromise;
    assert.equal(cancelWhileLocked, false,
      'reservation cancellation must wait for the exact inventory stock-dimension lock');
    await assert.rejects(() => service.approve(
      { auth: managerAuth }, countBeforeCancel.id, countBeforeCancelSubmitted.version,
      'SC-CANCEL-RACE-' + suffix,
    ), (error: unknown) => error instanceof ConflictException,
    'approval must reject a reservation cancellation committed after physical count');
    assert.equal(await prisma.stockTransaction.count({ where: { stockCountId: countBeforeCancel.id } }), 0);

    // Codex P2: an approval waiting behind Warehouse archival must fail
    // closed, not commit quantity into a newly archived site Warehouse.
    const raceWarehouse = await prisma.warehouse.create({ data: {
      companyId: company.id, projectId: project.id,
      warehouseCode: 'SC-ARCHIVE-' + suffix,
      warehouseName: 'Archival serialization warehouse', isSiteWarehouse: true,
    } });
    const raceCount = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: raceWarehouse.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(1),
      evidenceReference: 'synthetic physical count before archival',
    });
    const raceSubmitted = await service.submit({ auth: storeAuth }, raceCount.id, raceCount.version);
    let raceSettled = false;
    let raceApproval!: Promise<{ approved: boolean; error?: unknown }>;
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        'inventory-warehouse:' + raceWarehouse.id,
      );
      raceApproval = service.approve(
        { auth: managerAuth }, raceCount.id, raceSubmitted.version, 'SC-ARCHIVE-RACE-' + suffix,
      ).then(
        () => { raceSettled = true; return { approved: true }; },
        (error: unknown) => { raceSettled = true; return { approved: false, error }; },
      );
      await new Promise(resolve => setTimeout(resolve, 600));
      assert.equal(raceSettled, false,
        'positive count approval must wait for the Warehouse archival mutex');
      await tx.warehouse.update({ where: { id: raceWarehouse.id }, data: { isActive: false } });
    });
    const raceResult = await raceApproval;
    assert.equal(raceResult.approved, false,
      'approval must fail closed after archival changes Warehouse under the mutex');
    assert.equal(await prisma.stockTransaction.count({ where: { stockCountId: raceCount.id } }), 0,
      'an archived Warehouse must not receive a delayed stock-count adjustment');
    assert.equal((await prisma.stockCount.findUnique({ where: { id: raceCount.id } }))?.status,
      'SUBMITTED', 'failed approval must preserve the submitted count');

    // Codex P2 regression: Warehouse row SHARE and FK KEY SHARE must coexist
    // while approval-equivalent code waits for the dimension advisory lock.
    // A row FOR UPDATE here forms a lock cycle with StockCount creation,
    // which needs the Warehouse FK KEY SHARE after taking the dimension lock.
    let compatibleRowLockHeld = false;
    let waitingDimension!: Promise<void>;
    await prisma.$transaction(async tx => {
      await quantities.lock(tx, dimension);
      waitingDimension = prisma.$transaction(async contender => {
        await contender.$queryRawUnsafe(
          'SELECT id FROM "warehouses" WHERE id = $1::uuid FOR SHARE', site.id,
        );
        compatibleRowLockHeld = true;
        await quantities.lock(contender, dimension);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      for (let tick = 0; tick < 50 && !compatibleRowLockHeld; tick++) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal(compatibleRowLockHeld, true, 'second transaction must hold Warehouse SHARE');
      const live = await quantities.available(tx, dimension);
      const history = await quantities.snapshotVersion(tx, dimension);
      await tx.stockCount.create({ data: {
        companyId: company.id, projectId: project.id, warehouseId: site.id,
        materialId: material.id, uomId: uom.id, countedAt: new Date(),
        expectedOnHand: live.onHand, expectedReserved: live.reserved,
        expectedLedgerEventCount: history.ledgerEventCount,
        expectedReservationFingerprint: history.reservationFingerprint,
        actualQuantity: live.onHand, varianceQuantity: new Prisma.Decimal(0),
        createdByUserId: store.id,
      } });
      // Committing this insertion releases the dimension lock and must allow
      // the row-share holder to finish, without deadlock or generic HTTP 500.
    });
    await waitingDimension;

    // SQL history guard must also protect new immutable snapshot coordinates,
    // even when an actor supplies an otherwise valid optimistic version.
    await assert.rejects(() => prisma.stockCount.update({
      where: { id: abaDraft.id },
      data: { expectedLedgerEventCount: abaDraft.expectedLedgerEventCount + 1,
        version: abaDraft.version + 1 },
    }), 'snapshot ledger event coordinate must be immutable');
    await assert.rejects(() => prisma.stockCount.update({
      where: { id: abaDraft.id },
      data: { expectedReservationFingerprint: 'f'.repeat(64),
        version: abaDraft.version + 1 },
    }), 'snapshot reservation coordinate must be immutable');

    await assert.rejects(() => prisma.stockCount.update({
      where: { id: plus.id }, data: { evidenceReference: 'tampered', version: plusApproved.version + 1 },
    }), 'approved count history must be immutable');

    assert.equal(await prisma.auditLog.count({
      where: { companyId: company.id, entityType: { in: ['PAYMENT','SUPPLIER_INVOICE','DIRECT_COST_POSTING'] } },
    }), 0);
  } finally {
    await prisma.$disconnect();
  }
});
