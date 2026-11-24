import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException, ForbiddenException } from '@nestjs/common';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { PurchaseOrderService } from './purchase-order.service';

// PM02 new SERVICE guard only. Existing PostgreSQL award/lineage triggers
// already reject forged rows on INSERT; never weaken/bypass those constraints
// just to force a physical returned B line into a draft PO.
// This intentionally tests the defensive service pre-ApprovalService boundary
// through a transaction seam, not a real database, HTTP session or UAT.
test('PM02 PO submission rejects inactive source before ApprovalService.start', async (t) => {
  const companyId = 'a8f26a6a-98cd-4d35-83e7-ab42aa568c47';
  const foreignCompany = 'fba5db89-c2b6-4f44-9eb2-37c6a7e4a56e';
  const projectId = '708f4aae-04c9-4ff7-8b3b-52e3908e2fbc';
  const otherProject = 'f4e2ea2e-d3c7-4382-a6ab-41f899fc447c';
  const sourceId = '6e084416-36d6-4be6-8382-36d5b4ea9872';
  const orderId = '6a06d4c2-bd63-471f-b9ad-ad16b65023a1';
  const auth = {
    companyId, userId: '7acd4a1d-7e9b-4fa8-905e-f89a3ef2c1c9',
  } as AuthenticatedUserContext;
  const cases = [
    {label: 'explicit RETURNED line', decision: 'RETURNED'},
    {label: 'cancelled parent request', cancelled: true},
    {label: 'foreign Company', sourceCompany: foreignCompany},
    {label: 'other Project', sourceProject: otherProject},
    {label: 'rejected parent', approvalState: 'REJECTED'},
    {label: 'unapproved Draft parent', approvalState: null},
    {label: 'missing source line', missing: true},
  ] as const;

  for (const scenario of cases) {
    await t.test(scenario.label, async () => {
      let checkedScope = 0;
      let approvalStart = 0;
      let submittedWrites = 0;
      let audited = 0;
      const order = {
        id: orderId, companyId, projectId, approvalInstanceId: null,
        submittedAt: null, cancelledAt: null, nextRevision: null,
        lines: [{ purchaseRequestLineId: sourceId }],
      };
      const sources = ('missing' in scenario && scenario.missing) ? [] : [{
        id: sourceId,
        reviewDecision: 'decision' in scenario ? scenario.decision : 'APPROVED',
        purchaseRequest: {
          companyId: 'sourceCompany' in scenario ? scenario.sourceCompany : companyId,
          projectId: 'sourceProject' in scenario ? scenario.sourceProject : projectId,
          cancelledAt: 'cancelled' in scenario && scenario.cancelled ? new Date() : null,
          approvalInstance: ('approvalState' in scenario && scenario.approvalState === null)
            ? null : { approvalState: 'approvalState' in scenario
              ? scenario.approvalState : 'APPROVED' },
        },
      }];
      const tx = {
        purchaseOrder: {
          findFirst: async () => order,
          update: async () => { submittedWrites++; throw Error('UNEXPECTED_PO_WRITE'); },
        },
        purchaseRequestLine: {
          findMany: async (query: { where: { purchaseRequest: unknown } }) => {
            assert.deepEqual(query.where.purchaseRequest, { companyId, projectId });
            return sources;
          },
        },
      };
      const database = {
        $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      } as unknown as PrismaService;
      const projectAccess = {
        assertAccess: async () => { checkedScope++; },
      } as unknown as ProjectAccessService;
      const approvals = {
        start: async () => { approvalStart++; throw Error('UNEXPECTED_APPROVAL_START'); },
      } as unknown as ApprovalService;
      const audit = {
        record: async () => { audited++; throw Error('UNEXPECTED_AUDIT_WRITE'); },
      } as unknown as AuditService;
      const service = new PurchaseOrderService(
        database, projectAccess, audit, approvals,
        {} as NumberSequenceService,
      );
      await assert.rejects(
        () => service.submit({auth}, orderId, 'UNUSED_SYNTHETIC_PO_WORKFLOW'),
        (error: unknown) => error instanceof ConflictException &&
          typeof error.getResponse() === 'object' &&
          (error.getResponse() as {code?:string}).code === 'PO_SOURCE_DEMAND_INACTIVE',
        'Source invalidity must be refused by SERVICE before any new approval state',
      );
      assert.equal(checkedScope, 1);
      assert.equal(approvalStart, 0);
      assert.equal(submittedWrites, 0);
      assert.equal(audited, 0);
    });
  }
});

test('PM02 final approval rechecks current demand, supplier and Project in the approval transaction', async (t) => {
  const companyId = 'company-a', projectId = 'project-a', sourceId = 'pr-line-a';
  const orderId = 'po-a', maker = 'jai', checker = 'ben', instanceId = 'approval-a';
  const auth = { companyId, userId: checker } as AuthenticatedUserContext;
  const order = {
    id: orderId, companyId, projectId, supplierId: 'supplier-a', poNumber: 'PO2611-001',
    approvalInstanceId: instanceId, submittedByUserId: maker, cancelledAt: null,
    lines: [{ purchaseRequestLineId: sourceId }],
  };
  const active = () => ({
    id: sourceId, reviewDecision: 'APPROVED',
    purchaseRequest: { companyId, projectId, cancelledAt: null as Date | null,
      approvalInstance: { approvalState: 'APPROVED' } },
  });
  for (const scenario of [
    'returned', 'cancelled', 'foreign-company', 'other-project', 'missing',
    'rejected', 'supplier-inactive', 'project-revoked', 'po-cancelled', 'instance-changed',
  ]) {
    await t.test(scenario, async () => {
      const changed = active();
      if (scenario === 'returned') changed.reviewDecision = 'RETURNED';
      if (scenario === 'cancelled') changed.purchaseRequest.cancelledAt = new Date();
      if (scenario === 'foreign-company') changed.purchaseRequest.companyId = 'foreign';
      if (scenario === 'other-project') changed.purchaseRequest.projectId = 'other';
      if (scenario === 'rejected') changed.purchaseRequest.approvalInstance.approvalState = 'REJECTED';
      let finalChecks = 0, committed = 0, audits = 0, commercialReads = 0;
      const tx = {
        purchaseOrder: { findFirst: async () => ({
          ...order,
          cancelledAt: scenario === 'po-cancelled' ? new Date() : null,
          approvalInstanceId: scenario === 'instance-changed' ? 'other-instance' : instanceId,
        }) },
        purchaseRequestLine: { findMany: async (query: { where: { purchaseRequest: unknown } }) => {
          assert.deepEqual(query.where.purchaseRequest, { companyId, projectId });
          return scenario === 'missing' ? [] : [changed];
        } },
        supplier: { findFirst: async () => scenario === 'supplier-inactive' ? null : { id: order.supplierId } },
        supplierQuotation: { count: async () => { commercialReads++; throw Error('UNEXPECTED_COMMERCIAL_READ'); } },
      };
      const database = {
        purchaseOrder: { findFirst: async () => order },
        purchaseRequestLine: { findMany: async () => [active()] },
        supplier: { findFirst: async () => ({ id: order.supplierId }) },
      } as unknown as PrismaService;
      const access = { assertAccess: async (_auth: unknown, id: string, db?: unknown) => {
        assert.equal(id, projectId);
        if (db === tx) {
          finalChecks++;
          if (scenario === 'project-revoked') throw new ForbiddenException({ code: 'PROJECT_ACCESS_DENIED' });
        }
      } } as unknown as ProjectAccessService;
      const approvals = { approve: async (_id: string, _auth: unknown, _maker: string,
        _comment: unknown, callback: (client: typeof tx) => Promise<void>) => {
        // Deliberately emulate the final-approval transaction callback boundary;
        // this is a service seam, not a native concurrency or rollback test.
        await callback(tx);
        committed++;
        throw Error('UNEXPECTED_APPROVAL_COMMIT');
      } } as unknown as ApprovalService;
      const audit = { record: async () => { audits++; } } as unknown as AuditService;
      const service = new PurchaseOrderService(database, access, audit, approvals, {} as NumberSequenceService);
      const expected = scenario === 'supplier-inactive' ? 'PO_SUPPLIER_INACTIVE' :
        scenario === 'project-revoked' ? 'PROJECT_ACCESS_DENIED' :
        ['po-cancelled','instance-changed'].includes(scenario) ? 'PO_NOT_SUBMITTED' : 'PO_SOURCE_DEMAND_INACTIVE';
      await assert.rejects(() => service.approve({ auth }, orderId), (error: unknown) =>
        (error instanceof ConflictException || error instanceof ForbiddenException) &&
        (error.getResponse() as {code?: string}).code === expected);
      assert.equal(finalChecks, 1);
      assert.equal(committed, 0);
      assert.equal(audits, 0);
      assert.equal(commercialReads, 0);
    });
  }
});
