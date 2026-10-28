import { createHash } from 'node:crypto';

import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { budgetInvalid } from './budget-validation';
import { CustomerBoqPricingLine, priceCustomerBoq } from './customer-boq-pricing';

type Context = { auth: AuthenticatedUserContext; correlationId?: string };
type LineInput = Omit<CustomerBoqPricingLine, 'uomDecimalPlaces' | 'previousRate'> & { description: string };
export type CustomerBoqDraft = { sourceRevisionId: string; previousVersionId?: string; reason: string; lines: LineInput[] };
type Receipt = { id: string; editNo: number; approvalState: string };
const ENTITY = 'CUSTOMER_BOQ';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const graph = { approvalInstance: true, edits: { orderBy: { editNo: 'asc' as const }, include: {
  lines: { orderBy: { sortOrder: 'asc' as const }, include: { mappings: true } },
} } };

function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + stable(v)).join(',') + '}';
  return JSON.stringify(value);
}
function required(value: string, field: string, max = 4000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw budgetInvalid(field, 'A bounded nonempty value is required.');
  return value.trim();
}
function uuid(value: string, field: string) {
  if (!UUID.test(value)) throw budgetInvalid(field, 'Use a valid record identity.');
}
function conflict() { return new ConflictException({ code: 'CUSTOMER_BOQ_CONFLICT', detail: 'The Customer BOQ has changed or is no longer editable. Refresh before continuing.' }); }

/** Internal service only. No controller/module activation or grant seeds yet.
 * Reads require BOTH explicit full-source-cost and customer-price capabilities.
 * Mutation receipts contain no financial values. Never expose its graph to a quantity/Finance reader.
 */
@Injectable()
export class CustomerBoqService {
  constructor(private readonly prisma: PrismaService, private readonly access: ProjectAccessService,
    private readonly audit: AuditService, private readonly approvals: ApprovalService) {}

  async history(auth: AuthenticatedUserContext, projectId: string, id: string) {
    uuid(id, 'id');
    return this.prisma.$transaction(async (tx) => {
      await this.authorize(tx, auth, projectId);
      const version = await this.load(tx, auth.companyId, projectId, id);
      const approvals = await tx.approvalInstance.findMany({ where: { companyId: auth.companyId, entityType: ENTITY, entityId: id }, orderBy: { startedAt: 'asc' }, include: { actions: true } });
      return { version, approvals };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  create(context: Context, projectId: string, requestId: string, draft: CustomerBoqDraft) {
    return this.write(context, projectId, requestId, 'manage', { operation: 'CREATE', draft }, async (tx, auth) => {
      let previous: Awaited<ReturnType<CustomerBoqService['load']>> | undefined;
      if (draft.previousVersionId) {
        previous = await this.load(tx, auth.companyId, projectId, draft.previousVersionId);
        if (previous.approvalInstance?.approvalState !== 'APPROVED') throw conflict();
      }
      const priced = await this.price(tx, auth, projectId, draft, previous);
      const latest = await tx.customerBoqVersion.aggregate({ where: { companyId: auth.companyId, projectId }, _max: { versionNo: true } });
      const version = await tx.customerBoqVersion.create({ data: {
        companyId: auth.companyId, projectId, versionNo: (latest._max.versionNo ?? 0) + 1,
        sourceRevisionId: draft.sourceRevisionId, previousVersionId: draft.previousVersionId ?? null,
        currencyCode: 'THB', currentEditNo: 1, createdByUserId: auth.userId,
      } });
      await this.saveEdit(tx, version.id, 1, auth.userId, draft, priced);
      await this.audit.record({ ...context, auth, entityType: ENTITY, entityId: version.id, action: 'CREATE', newValues: { version, priced, reason: draft.reason } }, tx);
      return { id: version.id, editNo: 1, approvalState: 'DRAFT' };
    });
  }

  edit(context: Context, projectId: string, requestId: string, id: string, expectedEditNo: number, draft: CustomerBoqDraft) {
    return this.write(context, projectId, requestId, 'manage', { operation: 'EDIT', id, expectedEditNo, draft }, async (tx, auth) => {
      const before = await this.load(tx, auth.companyId, projectId, id);
      if (before.currentEditNo !== expectedEditNo || !this.editable(before.approvalInstance?.approvalState) ||
        before.sourceRevisionId !== draft.sourceRevisionId || (before.previousVersionId ?? undefined) !== draft.previousVersionId) throw conflict();
      const priced = await this.price(tx, auth, projectId, draft, before);
      const next = before.currentEditNo + 1;
      await this.saveEdit(tx, id, next, auth.userId, draft, priced);
      await tx.customerBoqVersion.update({ where: { id }, data: { currentEditNo: next } });
      await this.audit.record({ ...context, auth, entityType: ENTITY, entityId: id, action: 'EDIT',
        oldValues: { editNo: before.currentEditNo }, newValues: { editNo: next, priced, reason: draft.reason } }, tx);
      return { id, editNo: next, approvalState: before.approvalInstance?.approvalState ?? 'DRAFT' };
    });
  }

  submit(context: Context, projectId: string, requestId: string, id: string, expectedEditNo: number, workflowCode: string) {
    return this.write(context, projectId, requestId, 'submit', { operation: 'SUBMIT', id, expectedEditNo, workflowCode }, async (tx, auth) => {
      const row = await this.load(tx, auth.companyId, projectId, id);
      if (row.currentEditNo !== expectedEditNo || !this.editable(row.approvalInstance?.approvalState)) throw conflict();
      await this.assertNewMoney(tx, auth.companyId, projectId);
      const approval = await this.approvals.start({ companyId: auth.companyId, entityType: ENTITY, entityId: id,
        workflowCode: required(workflowCode, 'workflowCode', 100) }, tx);
      await tx.customerBoqVersion.update({ where: { id }, data: { approvalInstanceId: approval.id, submittedByUserId: auth.userId, submittedAt: new Date() } });
      await this.audit.record({ ...context, auth, entityType: ENTITY, entityId: id, action: 'SUBMIT', newValues: { approvalInstanceId: approval.id, editNo: row.currentEditNo } }, tx);
      return { id, editNo: row.currentEditNo, approvalState: approval.approvalState };
    });
  }

  decide(context: Context, projectId: string, requestId: string, id: string, expectedInstanceId: string,
    decision: 'APPROVE' | 'REJECT', comment: string) {
    return this.write(context, projectId, requestId, 'approve', { operation: decision, id, expectedInstanceId, comment }, async (tx, auth) => {
      if (!['APPROVE', 'REJECT'].includes(decision)) throw budgetInvalid('decision', 'Choose APPROVE or REJECT.');
      const row = await this.load(tx, auth.companyId, projectId, id);
      if (row.approvalInstanceId !== expectedInstanceId || row.approvalInstance?.approvalState !== 'SUBMITTED') throw conflict();
      await this.assertNewMoney(tx, auth.companyId, projectId);
      this.approvals.assertMakerChecker(row.createdByUserId, auth.userId);
      this.approvals.assertMakerChecker(row.submittedByUserId!, auth.userId);
      // Every editor is a maker of this exact commercial version, not only its creator.
      if (row.edits.some((edit) => edit.actorUserId === auth.userId)) throw new ForbiddenException({ code: 'MAKER_CHECKER_VIOLATION', detail: 'An editor cannot approve or reject this Customer BOQ version.' });
      const note = required(comment, 'comment');
      const approval = decision === 'APPROVE' ?
        await this.approvals.approve(expectedInstanceId, auth, row.createdByUserId, note, undefined, tx) :
        await this.approvals.reject(expectedInstanceId, auth, row.createdByUserId, note, tx);
      await this.audit.record({ ...context, auth, entityType: ENTITY, entityId: id, action: decision,
        newValues: { approvalInstanceId: approval.id, editNo: row.currentEditNo, approvalState: approval.approvalState, comment: note } }, tx);
      return { id, editNo: row.currentEditNo, approvalState: approval.approvalState };
    });
  }

  private editable(state: string | undefined) { return state === undefined || state === 'REJECTED'; }

  private async authorize(tx: Prisma.TransactionClient, supplied: AuthenticatedUserContext, projectId: string, action?: string) {
    uuid(projectId, 'projectId');
    // Resolve current persisted effective roles/grants inside the transaction; caller flags/names are not authority.
    const user = await tx.user.findFirst({ where: { id: supplied.userId, companyId: supplied.companyId, isActive: true, company: { isActive: true } },
      include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } } });
    const roles = user?.userRoles.map((r) => r.role).filter((r) => r.isActive && r.companyId === supplied.companyId) ?? [];
    const auth = { ...supplied, roleCodes: roles.map((r) => r.roleCode), permissions: [...new Set(roles.flatMap((r) => r.rolePermissions.map((p) => p.permission.permissionCode)))] };
    const needs = ['budget.boq.view', 'budget.revision.view', 'budget.customer.view', ...(action ? ['budget.customer.' + action] : [])];
    if (!user || !needs.every((p) => auth.permissions.includes(p))) throw new ForbiddenException({ code: 'CUSTOMER_BOQ_PERMISSION_DENIED', detail: 'Explicit source-cost, customer-price and applicable action authority are required.' });
    await this.access.assertAccess(auth, projectId, tx);
    return auth;
  }

  private async load(tx: Prisma.TransactionClient, companyId: string, projectId: string, id: string) {
    uuid(id, 'id');
    const row = await tx.customerBoqVersion.findFirst({ where: { id, companyId, projectId }, include: graph });
    if (!row) throw new NotFoundException({ code: 'CUSTOMER_BOQ_NOT_FOUND', detail: 'Customer BOQ not found.' });
    return row;
  }

  private async assertNewMoney(tx: Prisma.TransactionClient, companyId: string, projectId: string) {
    // Reuse the database-owned new-money provenance guard and its row locks.
    await tx.$executeRaw`SELECT erp_thb_require_company(${companyId}::uuid)`;
    await tx.$executeRaw`SELECT erp_thb_assert_source('projects', ${projectId}::uuid)`;
    const active = await tx.project.count({ where: { id: projectId, companyId, isActive: true } });
    if (!active) throw budgetInvalid('projectId', 'Select an active Project.');
  }

  private async price(tx: Prisma.TransactionClient, auth: AuthenticatedUserContext, projectId: string, draft: CustomerBoqDraft,
    before?: Awaited<ReturnType<CustomerBoqService['load']>>) {
    required(draft.reason, 'reason');
    uuid(draft.sourceRevisionId, 'sourceRevisionId');
    await this.assertNewMoney(tx, auth.companyId, projectId);
    const source = await tx.budgetRevision.findFirst({ where: { id: draft.sourceRevisionId, companyId: auth.companyId, projectId },
      include: { approvalInstance: true, lines: true } });
    if (!source || source.approvalInstance?.approvalState !== 'APPROVED') throw budgetInvalid('sourceRevisionId', 'Select an approved cost revision in this Company and Project.');
    await tx.$executeRaw`SELECT erp_thb_assert_source('budget_revisions', ${source.id}::uuid)`;
    if (!Array.isArray(draft.lines) || draft.lines.length === 0 || draft.lines.length > 500) throw budgetInvalid('lines', 'Use between 1 and 500 lines.');
    const uoms = await tx.unitOfMeasure.findMany({ where: { id: { in: draft.lines.map((l) => l.uomId) }, companyId: auth.companyId, isActive: true } });
    const oldLines = before?.edits.find((e) => e.editNo === before.currentEditNo)?.lines ?? [];
    const inputs = draft.lines.map((line) => {
      uuid(line.lineId, 'lineId'); required(line.description, 'description', 500);
      const uom = uoms.find((u) => u.id === line.uomId);
      if (!uom) throw budgetInvalid('uomId', 'Select an active UOM in this Company.');
      const old = oldLines.find((l) => l.lineKey === line.lineId);
      return { lineId: line.lineId, quantity: line.quantity, uomId: line.uomId, method: line.method, mappings: line.mappings,
        ...(line.manualRate !== undefined ? { manualRate: line.manualRate } : {}),
        ...(line.markupPercent !== undefined ? { markupPercent: line.markupPercent } : {}),
        ...(line.mappingReason !== undefined ? { mappingReason: line.mappingReason } : {}),
        ...(line.zeroPriceReason !== undefined ? { zeroPriceReason: line.zeroPriceReason } : {}),
        uomDecimalPlaces: uom.decimalPlaces, ...(old ? { previousRate: old.rate.toFixed(4) } : {}),
        ...((line.pricingReason ?? (before ? draft.reason : undefined)) ? { pricingReason: line.pricingReason ?? draft.reason } : {}) };
    });
    const result = priceCustomerBoq({ companyId: auth.companyId, projectId }, {
      companyId: source.companyId, projectId: source.projectId, revisionId: source.id,
      currencyCode: source.currencyCode, approvalState: source.approvalInstance.approvalState,
      lines: source.lines.map((l) => ({ id: l.id, quantity: l.quantity.toFixed(4), uomId: l.uomId, rate: l.rate.toFixed(4), amount: l.amount.toFixed(4) })),
    }, inputs);
    return { result, uoms };
  }

  private async saveEdit(tx: Prisma.TransactionClient, versionId: string, editNo: number, actorUserId: string,
    draft: CustomerBoqDraft, priced: Awaited<ReturnType<CustomerBoqService['price']>>) {
    await tx.customerBoqEdit.create({ data: { versionId, editNo, actorUserId, reason: draft.reason.trim(),
      totalAmount: priced.result.totalAmount, sourceCoverage: priced.result.sourceCoverage,
      lines: { create: priced.result.lines.map((line, index) => {
        const uom = priced.uoms.find((u) => u.id === line.uomId)!;
        const { mappings, ...snapshot } = line;
        return { lineKey: line.lineId, sortOrder: index, description: draft.lines[index]!.description.trim(),
          quantity: line.quantity, uomId: line.uomId, uomSnapshot: { id: uom.id, code: uom.uomCode, name: uom.uomName, decimalPlaces: uom.decimalPlaces },
          rate: line.rate, amount: line.amount, pricingSnapshot: snapshot,
          mappings: { create: mappings.map((m) => ({ sourceLineId: m.sourceLineId, sharePercent: m.sharePercent,
            allocatedCost: m.allocatedCost, sourceSnapshot: m.sourceSnapshot })) } };
      }) } } });
  }

  private async write(context: Context, projectId: string, requestId: string, action: string, payload: unknown,
    operation: (tx: Prisma.TransactionClient, auth: AuthenticatedUserContext) => Promise<Receipt>): Promise<Receipt> {
    uuid(requestId, 'requestId');
    const hash = createHash('sha256').update(stable({ projectId, action, payload })).digest('hex');
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const auth = await this.authorize(tx, context.auth, projectId, action);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${auth.companyId + auth.userId + requestId}, 0))`;
          const replay = await tx.customerBoqReplay.findUnique({ where: { companyId_actorUserId_requestId: { companyId: auth.companyId, actorUserId: auth.userId, requestId } } });
          if (replay) {
            if (replay.payloadHash !== hash) throw new ConflictException({ code: 'CUSTOMER_BOQ_REPLAY_MISMATCH', detail: 'This request identity was already used with a different payload.' });
            return replay.receipt as Receipt;
          }
          // Serialize allocation of version numbers and edit/submit/decision transitions per Project.
          await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid AND company_id = ${auth.companyId}::uuid FOR UPDATE`;
          const receipt = await operation(tx, auth);
          await tx.customerBoqReplay.create({ data: { companyId: auth.companyId, actorUserId: auth.userId, requestId, payloadHash: hash, receipt } });
          return receipt;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && attempt < 3 &&
          (['P2034', 'P2002'].includes(error.code) || (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))))) continue;
        throw error;
      }
    }
  }
}
