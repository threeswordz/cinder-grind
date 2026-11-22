import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { ProjectProgressPlanService } from './project-progress-plan.service';

const VIEW = 'schedule.programme.view';

function fixture(missingQuantity = false) {
  const companyId = randomUUID(), projectId = randomUUID();
  const planId = randomUUID(), budgetId = randomUUID(), uomId = randomUUID();
  const quantityActivityId = randomUUID(), milestoneActivityId = randomUUID();
  const auth: AuthenticatedUserContext = {
    sessionId: randomUUID(), userId: randomUUID(), companyId,
    email: 'fm02-readback@example.com', displayName: 'FM02 readback',
    roleCodes: ['PROJECT_MANAGER'], permissions: [VIEW], csrfTokenHash: '0'.repeat(64),
  };
  const plan = {
    id: planId, companyId, projectId, versionNo: 2,
    confirmedAt: new Date('2026-11-22T02:00:00Z'), confirmedByUserId: randomUUID(),
    confirmedBy: {id: randomUUID(), displayName: 'Ben'},
    lines: [
      {activityId: quantityActivityId, weightPercent: new Prisma.Decimal('60.00'),
        sourceKind: 'QUANTITY', approvedBudgetRevisionLineId: budgetId,
        uomId, plannedQuantity: new Prisma.Decimal('20.0000')},
      {activityId: milestoneActivityId, weightPercent: new Prisma.Decimal('40.00'),
        sourceKind: 'MILESTONE', approvedBudgetRevisionLineId: null,
        uomId: null, plannedQuantity: null},
    ],
  };
  const seen: Array<Record<string, unknown>> = [];
  const tx = {
    userSession: {findFirst: async () => ({
      user: {userRoles: [{companyId, role: {companyId, roleCode: 'PROJECT_MANAGER',
        isActive: true, rolePermissions: [{permission: {permissionCode: VIEW}}]}}]},
    })},
    project: {findFirst: async () => ({id: projectId, companyId})},
    projectProgressPlan: {findFirst: async () => plan},
    activity: {findMany: async () => [
      {id: quantityActivityId}, {id: milestoneActivityId},
    ]},
    activityProgress: {findFirst: async (query: {where: Record<string, unknown>}) => {
      seen.push(query.where);
      if (query.where.activityId === quantityActivityId) {
        if (missingQuantity) return null;
        return {id: randomUUID(), sourceType: 'BOQ_QUANTITY', sourceEntityId: planId,
          percentComplete: new Prisma.Decimal('50.00'), note: 'Measured quantity',
          completedQuantity: new Prisma.Decimal('10.0000'),
          sourceBudgetRevisionLineId: budgetId, sourceUomId: uomId};
      }
      return {id: randomUUID(), sourceType: 'MANUAL', sourceEntityId: null,
        percentComplete: new Prisma.Decimal('25.00'), note: 'Reasoned milestone inspection',
        completedQuantity: null, sourceBudgetRevisionLineId: null, sourceUomId: null};
    }},
  };
  const prisma = {
    $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  const access = {assertAccess: async () => {}} as unknown as ProjectAccessService;
  const service = new ProjectProgressPlanService(prisma, access, {} as AuditService);
  return {service, auth, projectId, planId, budgetId, uomId,
    quantityActivityId, milestoneActivityId, seen};
}

test('FM02 readback pins quantities to exact confirmed plan, BOQ line and UOM', async () => {
  const f = fixture();
  const result = await f.service.current(f.auth, f.projectId);
  assert.equal(result.percentComplete, '40.00');
  assert.ok('lines' in result);
  assert.equal(result.status, 'CALCULATED_TECHNICAL_ONLY');
  assert.deepEqual(result.lines.map(x => x.planSourceKind), ['QUANTITY', 'MILESTONE']);
  assert.deepEqual(result.lines.map(x => x.percentComplete), ['50.00', '25.00']);
  assert.equal(f.seen.length, 2);
  assert.equal(f.seen[0]!.sourceType, 'BOQ_QUANTITY');
  assert.equal(f.seen[0]!.sourceEntityId, f.planId);
  assert.equal(f.seen[0]!.sourceBudgetRevisionLineId, f.budgetId);
  assert.equal(f.seen[0]!.sourceUomId, f.uomId);
  assert.deepEqual(f.seen[1]!.sourceType, {not: 'BOQ_QUANTITY'});
});

test('FM02 missing quantity evidence stays missing, but intended QUANTITY basis is visible', async () => {
  const f = fixture(true);
  const result = await f.service.current(f.auth, f.projectId);
  assert.equal(result.status, 'BLOCKED_MISSING_SOURCE');
  assert.ok('lines' in result);
  assert.equal(result.percentComplete, null);
  assert.deepEqual(result.missingActivityIds, [f.quantityActivityId]);
  assert.equal(result.lines[0]!.planSourceKind, 'QUANTITY');
  assert.equal(result.lines[0]!.sourceKind, null);
});
