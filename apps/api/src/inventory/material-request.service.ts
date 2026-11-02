import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { DocumentsService } from '../documents/documents.service';
type Db = Prisma.TransactionClient | PrismaService;
type Context = {
    auth: AuthenticatedUserContext;
    correlationId?: string;
};
export type MaterialRequestLineInput = {
    materialId: string;
    uomId: string;
    requestedQuantity: string;
    wbsId: string | null;
    costCodeId: string | null;
    activityId: string | null;
    remarks: string | null;
};
export type MaterialRequestCreate = {
    requestKey: string;
    projectId: string;
    warehouseId: string;
    requesterEmployeeId: string;
    requestDate: string;
    remarks: string | null;
    lines: MaterialRequestLineInput[];
};
export type MaterialRequestEdit = {
    requestKey: string;
    expectedVersion: number;
    reason: string;
    requestDate: string;
    remarks: string | null;
    lines: Array<{
        id: string;
        requestedQuantity: string;
        remarks: string | null;
    }>;
};
export type MaterialRequestLink = {
    requestKey: string;
    expectedVersion: number;
    requestLineId: string;
    materialIssueItemId: string;
    reason: string;
};
export type MaterialRequestAcknowledge = {
    requestKey: string;
    expectedVersion: number;
    issueLinkId: string;
    recipientEmployeeId: string;
    issuerEmployeeId: string;
    receivedAt: string;
    documentId: string;
    signedEvidenceConfirmed: true;
    supersedesReceiptId: string | null;
    reason: string;
};
export const MATERIAL_REQUEST_VIEW = 'inventory.material_request.view';
const lineSelect = { id: true, lineNo: true, materialId: true, uomId: true, requestedQuantity: true, wbsId: true, costCodeId: true, activityId: true, remarks: true,
    material: { select: { materialCode: true, materialName: true } }, uom: { select: { uomCode: true } },
    issueLinks: { orderBy: [{ linkedAt: 'asc' as const }, { id: 'asc' as const }], select: { id: true, materialIssueItemId: true, linkedAt: true,
            issueItem: { select: { quantity: true, materialIssue: { select: { id: true, issueNumber: true, postedAt: true, reversedAt: true } } } },
            receipts: { select: { id: true, recipientEmployeeId: true, issuerEmployeeId: true, receivedAt: true, documentId: true, evidenceChecksum: true,
                    reason: true, supersedesReceiptId: true, recordedAt: true, recipient: { select: { employeeName: true } }, issuer: { select: { employeeName: true } },
                    recordedBy: { select: { displayName: true } }, correction: { select: { id: true } } }, orderBy: { recordedAt: 'asc' as const } } } } } satisfies Prisma.MaterialRequestLineSelect;
const requestSelect = { id: true, companyId: true, projectId: true, warehouseId: true, requesterEmployeeId: true, requestDate: true, remarks: true,
    version: true, createdAt: true, updatedAt: true, requester: { select: { employeeCode: true, employeeName: true } }, warehouse: { select: { warehouseName: true } },
    lines: { select: lineSelect, orderBy: { lineNo: 'asc' as const } },
    revisions: { select: { id: true, version: true, action: true, reason: true, recordedAt: true, actor: { select: { displayName: true } }, snapshot: true }, orderBy: { version: 'asc' as const } },
} satisfies Prisma.MaterialRequestSelect;
type Row = Prisma.MaterialRequestGetPayload<{
    select: typeof requestSelect;
}>;
@Injectable()
export class MaterialRequestService {
    constructor(private readonly prisma: PrismaService, private readonly access: ProjectAccessService, private readonly audit: AuditService, private readonly documents: DocumentsService) { }
    private denied() { return new ForbiddenException({ code: 'MATERIAL_REQUEST_PERMISSION_DENIED' }); }
    private invalid(code: string): never { throw new UnprocessableEntityException({ code }); }
    private conflict(code = 'MATERIAL_REQUEST_VERSION_CONFLICT'): never { throw new ConflictException({ code }); }
    private async authorize(auth: AuthenticatedUserContext, extra: string[] = [], db: Db = this.prisma) {
        const session = await db.userSession.findFirst({ where: { id: auth.sessionId, userId: auth.userId, revokedAt: null, expiresAt: { gt: new Date() },
                user: { companyId: auth.companyId, isActive: true, company: { isActive: true } } }, select: { user: { select: { userRoles: { select: { role: { select: { isActive: true, rolePermissions: { select: { permission: { select: { permissionCode: true } } } } } } } } } } } });
        const permissions = [...new Set(session?.user.userRoles.filter(x => x.role.isActive).flatMap(x => x.role.rolePermissions.map(p => p.permission.permissionCode)) ?? [])];
        if (!session || ![MATERIAL_REQUEST_VIEW, ...extra].every(p => auth.permissions.includes(p) && permissions.includes(p)))
            throw this.denied();
        return { ...auth, permissions };
    }
    async projects(auth: AuthenticatedUserContext) {
        const scoped = await this.authorize(auth);
        return this.prisma.project.findMany({ where: { AND: [await this.access.scopeWhere(scoped), { isActive: true }] },
            select: { id: true, projectCode: true, projectName: true }, orderBy: { id: 'asc' } });
    }
    async choices(auth: AuthenticatedUserContext, projectId: string, kind: 'warehouses' | 'employees' | 'materials' | 'wbs' | 'costCodes' | 'activities', after?: string) {
        const scoped = await this.authorize(auth);
        await this.access.assertAccess(scoped, projectId);
        const page = { take: 101, orderBy: { id: 'asc' as const } }, cursor = after ? { id: { gt: after } } : {};
        let rows: Array<{
            id: string;
            [key: string]: unknown;
        }>;
        if (kind === 'warehouses')
            rows = await this.prisma.warehouse.findMany({ ...page, where: { ...cursor, companyId: scoped.companyId, isActive: true, OR: [{ projectId }, { projectId: null }] }, select: { id: true, warehouseName: true, warehouseCode: true } });
        else if (kind === 'employees')
            rows = await this.prisma.employee.findMany({ ...page, where: { ...cursor, companyId: scoped.companyId, isActive: true, projectMembers: { some: { projectId, isActive: true } } }, select: { id: true, employeeCode: true, employeeName: true } });
        else if (kind === 'materials')
            rows = await this.prisma.material.findMany({ ...page, where: { ...cursor, companyId: scoped.companyId, isActive: true, defaultUom: { isActive: true, companyId: scoped.companyId } }, select: { id: true, materialCode: true, materialName: true, defaultUom: { select: { id: true, uomCode: true } } } });
        else if (kind === 'wbs')
            rows = await this.prisma.wbsElement.findMany({ ...page, where: { ...cursor, projectId, isActive: true }, select: { id: true, wbsCode: true, wbsName: true } });
        else if (kind === 'costCodes')
            rows = await this.prisma.costCode.findMany({ ...page, where: { ...cursor, companyId: scoped.companyId, isActive: true }, select: { id: true, costCode: true, costName: true } });
        else
            rows = await this.prisma.activity.findMany({ ...page, where: { ...cursor, companyId: scoped.companyId, projectId, isActive: true }, select: { id: true, activityCode: true, activityName: true, wbsId: true } });
        return { items: rows.slice(0, 100), nextCursor: rows.length > 100 ? rows[99]!.id : null };
    }
    private async find(auth: AuthenticatedUserContext, id: string, db: Db = this.prisma) {
        const row = await db.materialRequest.findFirst({ where: { id, companyId: auth.companyId }, select: requestSelect });
        if (!row)
            throw new NotFoundException({ code: 'MATERIAL_REQUEST_NOT_FOUND' });
        await this.access.assertAccess(auth, row.projectId, db);
        return row;
    }
    private present(auth: AuthenticatedUserContext, row: Row) {
        const sourceVisible = auth.permissions.includes('inventory.issue.view');
        const evidenceVisible = auth.permissions.includes('documents.document.view');
        return { ...row, revisions: row.revisions.map(v => ({ id: v.id, version: v.version, action: v.action, reason: v.reason, recordedAt: v.recordedAt, actor: v.actor,
                // Only request facts/line quantities are exposed from historical snapshots, never raw relation/Document payloads.
                facts: this.revisionFacts(v.snapshot) })), lines: row.lines.map(line => {
                let issued = 0n, acknowledged = 0n;
                const units=(q:Prisma.Decimal)=>BigInt(q.toFixed(4).replace('.', ''));
                const formatted=(q:bigint)=>{const digits=q.toString().padStart(5,'0');return digits.slice(0,-4)+'.'+digits.slice(-4);};
                const links = line.issueLinks.map(link => {
                    const issue = link.issueItem.materialIssue, posted = Boolean(issue.postedAt && !issue.reversedAt);
                    if (posted)
                        issued += units(link.issueItem.quantity);
                    const receipt = link.receipts.find(r => !r.correction);
                    if (posted && receipt)
                        acknowledged += units(link.issueItem.quantity);
                    return { id: link.id, linkedAt: link.linkedAt, quantity: link.issueItem.quantity.toFixed(4), currentlyIssued: posted,
                        issue: sourceVisible ? issue : null, materialIssueItemId: sourceVisible ? link.materialIssueItemId : null,
                        receipts: link.receipts.map(r => ({ id: r.id, recipientEmployeeId: r.recipientEmployeeId, issuerEmployeeId: r.issuerEmployeeId,
                            recipient: r.recipient, issuer: r.issuer, receivedAt: r.receivedAt, recordedAt: r.recordedAt, recordedBy: r.recordedBy,
                            supersedesReceiptId: r.supersedesReceiptId, superseded: Boolean(r.correction), reason: r.reason,
                            documentId: evidenceVisible ? r.documentId : null, evidenceChecksum: evidenceVisible ? r.evidenceChecksum : null })) };
                });
                return { id: line.id, lineNo: line.lineNo, materialId: line.materialId, material: line.material, uomId: line.uomId, uom: line.uom,
                    requestedQuantity: line.requestedQuantity.toFixed(4), wbsId: line.wbsId, costCodeId: line.costCodeId, activityId: line.activityId, remarks: line.remarks,
                    issuedQuantity: formatted(issued), acknowledgedQuantity: formatted(acknowledged),
                    fulfillment: issued===0n ? 'NOT_ISSUED' : issued<units(line.requestedQuantity) ? 'PARTIAL' : issued===units(line.requestedQuantity) ? 'FULFILLED' : 'OVER_FULFILLED', issueLinks: links };
            }) };
    }
    private revisionFacts(snapshot: Prisma.JsonValue) {
        const s = snapshot as {
            request?: {
                request_date?: unknown;
                remarks?: unknown;
            };
            lines?: Array<{
                id?: unknown;
                requested_quantity?: unknown;
                remarks?: unknown;
            }>;
        };
        return { requestDate: s.request?.request_date ?? null, remarks: s.request?.remarks ?? null,
            lines: (s.lines ?? []).map(l => ({ id: l.id, requestedQuantity: String(l.requested_quantity), remarks: l.remarks ?? null })) };
    }
    async get(auth: AuthenticatedUserContext, id: string) { const scoped = await this.authorize(auth); return this.present(scoped, await this.find(scoped, id)); }
    async list(auth: AuthenticatedUserContext, projectId: string, after?: string) {
        const scoped = await this.authorize(auth);
        await this.access.assertAccess(scoped, projectId);
        const rows = await this.prisma.materialRequest.findMany({ where: { companyId: scoped.companyId, projectId, ...(after ? { id: { gt: after } } : {}) }, orderBy: { id: 'asc' }, take: 51,
            select: { id: true, requestDate: true, version: true, requester: { select: { employeeName: true } }, warehouse: { select: { warehouseName: true } }, _count: { select: { lines: true } } } });
        return { items: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49]!.id : null };
    }
    async issueChoices(auth: AuthenticatedUserContext, id: string, lineId: string, after?: string) {
        const scoped = await this.authorize(auth, ['inventory.issue.view']);
        const r = await this.find(scoped, id);
        const line = r.lines.find(l => l.id === lineId);
        if (!line)
            this.invalid('MATERIAL_REQUEST_LINE_INVALID');
        const rows = await this.prisma.materialIssueItem.findMany({ where: { ...(after ? { id: { gt: after } } : {}), materialId: line.materialId, uomId: line.uomId,
                wbsId: line.wbsId, costCodeId: line.costCodeId, activityId: line.activityId, materialRequestLink: null,
                materialIssue: { companyId: r.companyId, projectId: r.projectId, warehouseId: r.warehouseId, postedAt: { not: null }, reversedAt: null } },
            select: { id: true, lineNo: true, quantity: true, materialIssue: { select: { id: true, issueNumber: true, issuedToEmployeeId: true } } }, orderBy: { id: 'asc' }, take: 101 });
        return { items: rows.slice(0, 100).map(x => ({ ...x, quantity: x.quantity.toFixed(4) })), nextCursor: rows.length > 100 ? rows[99]!.id : null };
    }
    private quantity(value: string) { const q = new Prisma.Decimal(value); if (!q.isFinite() || q.lte(0) || q.decimalPlaces() > 4 || q.gte('100000000000000'))
        this.invalid('MATERIAL_REQUEST_QUANTITY_INVALID'); return q; }
    private async employee(db: Db, companyId: string, projectId: string, id: string) {
        const e = await db.employee.findFirst({ where: { id, companyId, isActive: true, projectMembers: { some: { projectId, isActive: true } } }, select: { id: true } });
        if (!e)
            this.invalid('MATERIAL_REQUEST_EMPLOYEE_INVALID');
    }
    private async validateLine(db: Db, companyId: string, projectId: string, warehouseId: string, l: MaterialRequestLineInput) {
        this.quantity(l.requestedQuantity);
        const material = await db.material.findFirst({ where: { id: l.materialId, companyId, isActive: true }, select: { defaultUomId: true } });
        if (!material || !await db.unitOfMeasure.findFirst({ where: { id: l.uomId, companyId, isActive: true }, select: { id: true } }))
            this.invalid('MATERIAL_REQUEST_MATERIAL_UOM_INVALID');
        if (material.defaultUomId !== l.uomId && !await db.stockTransaction.findFirst({ where: { companyId, projectId, warehouseId, materialId: l.materialId, uomId: l.uomId }, select: { id: true } }))
            this.invalid('MATERIAL_REQUEST_MATERIAL_UOM_INVALID');
        if (l.wbsId && !await db.wbsElement.findFirst({ where: { id: l.wbsId, projectId, isActive: true }, select: { id: true } }))
            this.invalid('MATERIAL_REQUEST_WBS_INVALID');
        if (l.costCodeId && !await db.costCode.findFirst({ where: { id: l.costCodeId, companyId, isActive: true }, select: { id: true } }))
            this.invalid('MATERIAL_REQUEST_COST_CODE_INVALID');
        if (l.activityId && !await db.activity.findFirst({ where: { id: l.activityId, companyId, projectId, isActive: true, ...(l.wbsId ? { wbsId: l.wbsId } : {}) }, select: { id: true } }))
            this.invalid('MATERIAL_REQUEST_ACTIVITY_INVALID');
    }
    private result(op: {
        requestId: string;
        revision: {
            id: string;
            version: number;
        };
    }) { return { id: op.requestId, version: op.revision.version, revisionId: op.revision.id }; }
    private async command(context: Context, action: 'CAPTURE' | 'REVISE' | 'LINK' | 'ACKNOWLEDGE', key: string, body: unknown, id: string | null, work: (tx: Prisma.TransactionClient, auth: AuthenticatedUserContext, row: Row | null) => Promise<{
        id: string;
        reason: string;
    }>) {
        const capability = { CAPTURE: 'create', REVISE: 'edit', LINK: 'link', ACKNOWLEDGE: 'acknowledge' }[action];
        const extra = ['inventory.material_request.' + capability, ...(['LINK', 'ACKNOWLEDGE'].includes(action) ? ['inventory.issue.view'] : []),
            ...(action === 'ACKNOWLEDGE' ? ['documents.document.view'] : [])];
        const digest = createHash('sha256').update(JSON.stringify([id, body])).digest('hex');
        try {
            return await this.prisma.$transaction(async (tx) => {
                const auth = await this.authorize(context.auth, extra, tx);
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtextextended(${['material-request-operation', auth.companyId, auth.userId, action, key].join(':')},0))`;
                const old = await tx.materialRequestOperation.findUnique({ where: { companyId_actorUserId_action_requestKey: { companyId: auth.companyId, actorUserId: auth.userId, action, requestKey: key } }, include: { revision: { select: { id: true, version: true } } } });
                if (old) {
                    await this.find(auth, old.requestId, tx);
                    if (old.bodyDigest !== digest)
                        this.conflict('MATERIAL_REQUEST_REPLAY_BODY_CONFLICT');
                    return this.result(old);
                }
                let row: Row | null = null;
                if (id) {
                    await tx.$queryRaw `SELECT id FROM material_requests WHERE id=${id}::uuid AND company_id=${auth.companyId}::uuid FOR UPDATE`;
                    row = await this.find(auth, id, tx);
                    if (row.version !== (body as {
                        expectedVersion: number;
                    }).expectedVersion)
                        this.conflict();
                }
                const outcome = await work(tx, auth, row);
                const current = await tx.materialRequest.findUniqueOrThrow({ where: { id: outcome.id }, select: { version: true } });
                const [snap] = await tx.$queryRaw<Array<{
                    snapshot: Prisma.InputJsonValue;
                }>> `SELECT erp_material_request_snapshot(${outcome.id}::uuid) AS snapshot`;
                const revision = await tx.materialRequestRevision.create({ data: { requestId: outcome.id, version: current.version, actorUserId: auth.userId, action, reason: outcome.reason, snapshot: snap!.snapshot }, select: { id: true, version: true } });
                await tx.materialRequestOperation.create({ data: { companyId: auth.companyId, actorUserId: auth.userId, action, requestKey: key, bodyDigest: digest, requestId: outcome.id, revisionId: revision.id } });
                await this.audit.record({ ...context, auth, entityType: 'MATERIAL_REQUEST', entityId: outcome.id, action,
                    newValues: { version: current.version, revisionId: revision.id } }, tx);
                return this.result({ requestId: outcome.id, revision });
            }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 20000 });
        }
        catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(e.code))
                this.conflict('MATERIAL_REQUEST_CONCURRENT_CONFLICT');
            throw e;
        }
    }
    private async bump(tx: Prisma.TransactionClient, auth: AuthenticatedUserContext, r: Row, data: Prisma.MaterialRequestUpdateManyMutationInput = {}) {
        const n = await tx.materialRequest.updateMany({ where: { id: r.id, version: r.version }, data: { ...data, version: { increment: 1 }, updatedByUserId: auth.userId } });
        if (n.count !== 1)
            this.conflict();
    }
    create(c: Context, input: MaterialRequestCreate) {
        return this.command(c, 'CAPTURE', input.requestKey, input, null, async (tx, auth) => {
            await this.access.assertAccess(auth, input.projectId, tx);
            if (!await tx.project.findFirst({ where: { id: input.projectId, companyId: auth.companyId, isActive: true }, select: { id: true } }))
                this.invalid('MATERIAL_REQUEST_PROJECT_INVALID');
            if (!await tx.warehouse.findFirst({ where: { id: input.warehouseId, companyId: auth.companyId, isActive: true, OR: [{ projectId: input.projectId }, { projectId: null }] }, select: { id: true } }))
                this.invalid('MATERIAL_REQUEST_WAREHOUSE_INVALID');
            await this.employee(tx, auth.companyId, input.projectId, input.requesterEmployeeId);
            if (input.lines.length < 1 || input.lines.length > 100)
                this.invalid('MATERIAL_REQUEST_LINES_INVALID');
            for (const l of input.lines)
                await this.validateLine(tx, auth.companyId, input.projectId, input.warehouseId, l);
            const row = await tx.materialRequest.create({ data: { companyId: auth.companyId, projectId: input.projectId, warehouseId: input.warehouseId,
                    requesterEmployeeId: input.requesterEmployeeId, requestDate: new Date(input.requestDate + 'T00:00:00.000Z'), remarks: input.remarks,
                    createdByUserId: auth.userId, updatedByUserId: auth.userId, lines: { create: input.lines.map((l, i) => ({ ...l, lineNo: i + 1, requestedQuantity: this.quantity(l.requestedQuantity) })) } }, select: { id: true } });
            return { id: row.id, reason: 'Store-recorded oral/chat material request' };
        });
    }
    edit(c: Context, id: string, input: MaterialRequestEdit) {
        return this.command(c, 'REVISE', input.requestKey, input, id, async (tx, auth, row) => {
            const r = row!;
            if (input.lines.length !== r.lines.length || new Set(input.lines.map(l => l.id)).size !== r.lines.length || input.lines.some(l => !r.lines.some(x => x.id === l.id)))
                this.invalid('MATERIAL_REQUEST_LINES_INVALID');
            await this.bump(tx, auth, r, { requestDate: new Date(input.requestDate + 'T00:00:00.000Z'), remarks: input.remarks });
            for (const l of input.lines)
                await tx.materialRequestLine.update({ where: { id: l.id }, data: { requestedQuantity: this.quantity(l.requestedQuantity), remarks: l.remarks } });
            return { id, reason: input.reason };
        });
    }
    link(c: Context, id: string, input: MaterialRequestLink) {
        return this.command(c, 'LINK', input.requestKey, input, id, async (tx, auth, row) => {
            const r = row!, line = r.lines.find(l => l.id === input.requestLineId);
            if (!line)
                this.invalid('MATERIAL_REQUEST_LINE_INVALID');
            const item = await tx.materialIssueItem.findFirst({ where: { id: input.materialIssueItemId, materialId: line.materialId, uomId: line.uomId, wbsId: line.wbsId, costCodeId: line.costCodeId, activityId: line.activityId,
                    materialIssue: { companyId: auth.companyId, projectId: r.projectId, warehouseId: r.warehouseId, postedAt: { not: null }, reversedAt: null } }, select: { id: true } });
            if (!item)
                this.invalid('MATERIAL_REQUEST_ISSUE_INVALID');
            await this.bump(tx, auth, r);
            await tx.materialRequestIssueLink.create({ data: { requestId: id, requestLineId: line.id, materialIssueItemId: item.id, linkedByUserId: auth.userId } });
            return { id, reason: input.reason };
        });
    }
    acknowledge(c: Context, id: string, input: MaterialRequestAcknowledge) {
        return this.command(c, 'ACKNOWLEDGE', input.requestKey, input, id, async (tx, auth, row) => {
            const r = row!;
            const link = await tx.materialRequestIssueLink.findFirst({ where: { id: input.issueLinkId, requestId: id }, include: { issueItem: { include: { materialIssue: true } }, receipts: { where: { correction: null }, select: { id: true } } } });
            if (!link || !link.issueItem.materialIssue.postedAt || link.issueItem.materialIssue.reversedAt)
                this.invalid('MATERIAL_REQUEST_ISSUE_INVALID');
            if ((link.receipts[0]?.id ?? null) !== input.supersedesReceiptId)
                this.conflict('MATERIAL_REQUEST_RECEIPT_CORRECTION_REQUIRED');
            const receiver = link.issueItem.materialIssue.issuedToEmployeeId;
            if (receiver && receiver !== input.recipientEmployeeId)
                this.invalid('MATERIAL_REQUEST_RECIPIENT_INVALID');
            await this.employee(tx, auth.companyId, r.projectId, input.recipientEmployeeId);
            await this.employee(tx, auth.companyId, r.projectId, input.issuerEmployeeId);
            if (input.signedEvidenceConfirmed !== true || !Number.isFinite(Date.parse(input.receivedAt)) || Date.parse(input.receivedAt) > Date.now())
                this.invalid('MATERIAL_REQUEST_RECEIPT_INVALID');
            await tx.$queryRaw `SELECT id FROM documents WHERE id=${input.documentId}::uuid FOR SHARE`;
            const doc = await tx.document.findFirst({ where: { id: input.documentId, companyId: auth.companyId, isActive: true, mimeType: { in: ['application/pdf', 'image/jpeg', 'image/png'] },
                    AND: [{ links: { some: { entityType: 'MATERIAL_REQUEST', entityId: id } } }, { links: { some: { entityType: 'PROJECT', entityId: r.projectId } } }] }, include: { links: { select: { entityType: true, entityId: true } } } });
            if (!doc || !doc.checksum || !(await this.documents.filterSourceDocuments(auth, r.projectId, [doc], tx)).length)
                this.invalid('MATERIAL_REQUEST_EVIDENCE_INVALID');
            await this.documents.downloadProjectDocument(auth, r.projectId, doc.id, tx);
            await this.bump(tx, auth, r);
            await tx.materialRequestReceipt.create({ data: { requestId: id, issueLinkId: link.id, recipientEmployeeId: input.recipientEmployeeId, issuerEmployeeId: input.issuerEmployeeId,
                    receivedAt: new Date(input.receivedAt), documentId: doc.id, evidenceChecksum: doc.checksum, signedEvidenceConfirmed: true, supersedesReceiptId: input.supersedesReceiptId, reason: input.reason, recordedByUserId: auth.userId } });
            return { id, reason: input.reason };
        });
    }
}
