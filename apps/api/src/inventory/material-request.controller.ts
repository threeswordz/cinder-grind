import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { inventoryInvalid, inventoryObject, inventoryUuid } from './inventory-validation';
import { MaterialRequestService, MaterialRequestLineInput } from './material-request.service';
function object(value: unknown, keys: string[]) { const r = inventoryObject(value); if (Object.keys(r).some(k => !keys.includes(k)))
    inventoryInvalid('body', 'Unknown field.'); return r; }
function text(value: unknown, field: string, max = 4000, nullable = false): string | null {
    if (nullable && (value === null || value === undefined || value === ''))
        return null;
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
        inventoryInvalid(field, 'Invalid text.');
    return value.trim();
}
function id(value: unknown, field: string) { return inventoryUuid(value, field).toLowerCase(); }
function optionalId(value: unknown, field: string) { return value === null || value === undefined || value === '' ? null : id(value, field); }
function version(value: unknown) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    inventoryInvalid('expectedVersion', 'Positive integer required.'); return value; }
function quantity(value: unknown) {
    if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(value) || new Prisma.Decimal(value).lte(0))
        inventoryInvalid('requestedQuantity', 'Positive decimal with at most four decimal places required.');
    return new Prisma.Decimal(value).toFixed(4);
}
function date(value: unknown) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00.000Z')) || new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) !== value)
    inventoryInvalid('requestDate', 'Valid YYYY-MM-DD required.'); return value; }
function instant(value: unknown) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value)
    inventoryInvalid('receivedAt', 'Valid UTC ISO timestamp required.'); return value; }
function lines(value: unknown) { if (!Array.isArray(value) || value.length < 1 || value.length > 100)
    inventoryInvalid('lines', 'Provide 1–100 lines.'); return value; }
function context(req: AuthenticatedRequest) { return { auth: req.auth!, ...(req.correlationId ? { correlationId: req.correlationId } : {}) }; }
const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('inventory/material-requests')
export class MaterialRequestController {
    constructor(private readonly service: MaterialRequestService) { }
    @Get('projects')
    @UseGuards(AuthGuard, PermissionGuard)
    @RequirePermissions('inventory.material_request.view')
    async projects(
    @Req()
    req: AuthenticatedRequest) { return { data: await this.service.projects(req.auth!) }; }
    @Get('choices')
    @UseGuards(AuthGuard, PermissionGuard)
    @RequirePermissions('inventory.material_request.view')
    async choices(
    @Req()
    req: AuthenticatedRequest,
    @Query('projectId')
    project: unknown,
    @Query('kind')
    kind: unknown,
    @Query('after')
    after: unknown) {
        if (!['warehouses', 'employees', 'materials', 'wbs', 'costCodes', 'activities'].includes(String(kind)))
            inventoryInvalid('kind', 'Invalid choice category.');
        return { data: await this.service.choices(req.auth!, id(project, 'projectId'), kind as 'warehouses' | 'employees' | 'materials' | 'wbs' | 'costCodes' | 'activities', optionalId(after, 'after') ?? undefined) };
    }
    @Get()
    @UseGuards(AuthGuard, PermissionGuard)
    @RequirePermissions('inventory.material_request.view')
    async list(
    @Req()
    req: AuthenticatedRequest,
    @Query('projectId')
    project: unknown,
    @Query('after')
    after: unknown) { return { data: await this.service.list(req.auth!, id(project, 'projectId'), optionalId(after, 'after') ?? undefined) }; }
    @Get(':id')
    @UseGuards(AuthGuard, PermissionGuard)
    @RequirePermissions('inventory.material_request.view')
    async get(
    @Req()
    req: AuthenticatedRequest,
    @Param('id', uuid)
    requestId: string) { return { data: await this.service.get(req.auth!, requestId) }; }
    @Get(':id/issue-choices')
    @UseGuards(AuthGuard, PermissionGuard)
    @RequirePermissions('inventory.material_request.view', 'inventory.issue.view')
    async issues(
    @Req()
    req: AuthenticatedRequest,
    @Param('id', uuid)
    requestId: string,
    @Query('lineId')
    lineId: unknown,
    @Query('after')
    after: unknown) { return { data: await this.service.issueChoices(req.auth!, requestId, id(lineId, 'lineId'), optionalId(after, 'after') ?? undefined) }; }
    @Post()
    @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
    @RequirePermissions('inventory.material_request.view', 'inventory.material_request.create')
    async create(
    @Req()
    req: AuthenticatedRequest,
    @Body()
    body: unknown) {
        const r = object(body, ['requestKey', 'projectId', 'warehouseId', 'requesterEmployeeId', 'requestDate', 'remarks', 'lines']);
        const items: MaterialRequestLineInput[] = lines(r.lines).map(value => {
            const l = object(value, ['materialId', 'uomId', 'requestedQuantity', 'wbsId', 'costCodeId', 'activityId', 'remarks']);
            return {
                materialId: id(l.materialId, 'materialId'), uomId: id(l.uomId, 'uomId'), requestedQuantity: quantity(l.requestedQuantity),
                wbsId: optionalId(l.wbsId, 'wbsId'), costCodeId: optionalId(l.costCodeId, 'costCodeId'), activityId: optionalId(l.activityId, 'activityId'), remarks: text(l.remarks, 'remarks', 4000, true)
            };
        });
        return { data: await this.service.create(context(req), { requestKey: id(r.requestKey, 'requestKey'), projectId: id(r.projectId, 'projectId'), warehouseId: id(r.warehouseId, 'warehouseId'), requesterEmployeeId: id(r.requesterEmployeeId, 'requesterEmployeeId'), requestDate: date(r.requestDate), remarks: text(r.remarks, 'remarks', 4000, true), lines: items }) };
    }
    @Post(':id/revisions')
    @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
    @RequirePermissions('inventory.material_request.view', 'inventory.material_request.edit')
    async edit(
    @Req()
    req: AuthenticatedRequest,
    @Param('id', uuid)
    requestId: string,
    @Body()
    body: unknown) {
        const r = object(body, ['requestKey', 'expectedVersion', 'reason', 'requestDate', 'remarks', 'lines']);
        return { data: await this.service.edit(context(req), requestId.toLowerCase(), { requestKey: id(r.requestKey, 'requestKey'), expectedVersion: version(r.expectedVersion), reason: text(r.reason, 'reason')!, requestDate: date(r.requestDate), remarks: text(r.remarks, 'remarks', 4000, true),
                lines: lines(r.lines).map(value => { const l = object(value, ['id', 'requestedQuantity', 'remarks']); return { id: id(l.id, 'id'), requestedQuantity: quantity(l.requestedQuantity), remarks: text(l.remarks, 'remarks', 4000, true) }; }) }) };
    }
    @Post(':id/issue-links')
    @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
    @RequirePermissions('inventory.material_request.view', 'inventory.material_request.link', 'inventory.issue.view')
    async link(
    @Req()
    req: AuthenticatedRequest,
    @Param('id', uuid)
    requestId: string,
    @Body()
    body: unknown) {
        const r = object(body, ['requestKey', 'expectedVersion', 'requestLineId', 'materialIssueItemId', 'reason']);
        return { data: await this.service.link(context(req), requestId.toLowerCase(), { requestKey: id(r.requestKey, 'requestKey'), expectedVersion: version(r.expectedVersion), requestLineId: id(r.requestLineId, 'requestLineId'), materialIssueItemId: id(r.materialIssueItemId, 'materialIssueItemId'), reason: text(r.reason, 'reason')! }) };
    }
    @Post(':id/receipts')
    @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
    @RequirePermissions('inventory.material_request.view', 'inventory.material_request.acknowledge', 'inventory.issue.view', 'documents.document.view')
    async acknowledge(
    @Req()
    req: AuthenticatedRequest,
    @Param('id', uuid)
    requestId: string,
    @Body()
    body: unknown) {
        const r = object(body, ['requestKey', 'expectedVersion', 'issueLinkId', 'recipientEmployeeId', 'issuerEmployeeId', 'receivedAt', 'documentId', 'signedEvidenceConfirmed', 'supersedesReceiptId', 'reason']);
        if (r.signedEvidenceConfirmed !== true)
            inventoryInvalid('signedEvidenceConfirmed', 'Explicit signed-evidence confirmation required.');
        return { data: await this.service.acknowledge(context(req), requestId.toLowerCase(), { requestKey: id(r.requestKey, 'requestKey'), expectedVersion: version(r.expectedVersion), issueLinkId: id(r.issueLinkId, 'issueLinkId'), recipientEmployeeId: id(r.recipientEmployeeId, 'recipientEmployeeId'), issuerEmployeeId: id(r.issuerEmployeeId, 'issuerEmployeeId'), receivedAt: instant(r.receivedAt), documentId: id(r.documentId, 'documentId'), signedEvidenceConfirmed: true, supersedesReceiptId: optionalId(r.supersedesReceiptId, 'supersedesReceiptId'), reason: text(r.reason, 'reason')! }) };
    }
}
