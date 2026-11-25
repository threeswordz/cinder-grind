import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type Context = { auth: AuthenticatedUserContext; correlationId?: string };
type LoanRow = {
  id: string; companyId: string; equipmentId: string; projectId: string;
  borrowerEmployeeId: string; borrowerName: string; equipmentCode: string;
  equipmentName: string; siteLabel: string; issuedOn: Date; dueOn: Date;
  conditionOut: string; issuedByUserId: string; returnedOn: Date | null;
  conditionIn: string | null; returnedByUserId: string | null; createdAt: Date;
};
export type EquipmentCustodyIssue = {
  equipmentId: string; projectId: string; borrowerEmployeeId: string;
  siteLabel: string; issuedOn: Date; dueOn: Date; conditionOut: string;
};
export type EquipmentCustodyReturn = { returnedOn: Date; conditionIn: string };

function deny(): never {
  throw new ForbiddenException({ code: 'EQUIPMENT_CUSTODY_DENIED', detail: 'Equipment custody permission or active Employee required.' });
}
function conflict(code: string, detail: string): never {
  throw new ConflictException({ code, detail });
}
function invalid(field: string, detail: string): never {
  throw new UnprocessableEntityException({ code: 'EQUIPMENT_CUSTODY_INVALID', errors: [{ field, message: detail }] });
}
function todayUtc(): Date { return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'); }

@Injectable()
export class EquipmentCustodyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  private async authorize(supplied: AuthenticatedUserContext, permission: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma): Promise<AuthenticatedUserContext> {
    // Refresh the session and assigned role permissions from the same DB snapshot
    // as the custody write. A previously issued request context is not a grant.
    if (!supplied.permissions.includes(permission)) deny();
    const session = await tx.userSession.findFirst({
      where: { id: supplied.sessionId, userId: supplied.userId,
        revokedAt: null, expiresAt: { gt: new Date() },
        user: { companyId: supplied.companyId, isActive: true,
          company: { isActive: true } } },
      select: { user: { select: {
        employee: { select: { companyId: true, isActive: true } },
        userRoles: { select: { role: { select: {
          companyId: true, isActive: true, roleCode: true,
          rolePermissions: { select: { permission: { select: { permissionCode: true } } } },
        } } } },
      } } },
    });
    const employee = session?.user.employee;
    if (!session || !employee?.isActive || employee.companyId !== supplied.companyId) deny();
    const roles = session.user.userRoles
      .map(assignment => assignment.role)
      .filter(role => role.isActive && role.companyId === supplied.companyId);
    const livePermissions = new Set(roles.flatMap(role =>
      role.rolePermissions.map(entry => entry.permission.permissionCode)));
    if (!livePermissions.has(permission)) deny();
    const suppliedRoles = new Set(supplied.roleCodes);
    return {
      ...supplied,
      roleCodes: [...new Set(roles.map(role => role.roleCode))]
        .filter(roleCode => suppliedRoles.has(roleCode)),
      permissions: [...livePermissions].filter(code => supplied.permissions.includes(code)),
    };
  }

  async projects(supplied: AuthenticatedUserContext) {
    const auth = await this.authorize(supplied, 'equipment.custody.view');
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { AND: [scope, { isActive: true }] },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectCode: 'asc' }], take: 200,
    });
  }

  async borrowers(supplied: AuthenticatedUserContext, projectId: string, on: Date) {
    const auth = await this.authorize(supplied, 'equipment.custody.view');
    await this.access.assertAccess(auth, projectId);
    const members = await this.prisma.projectMember.findMany({
      where: { projectId, isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: on } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: on } }] }],
        employee: { companyId: auth.companyId, isActive: true } },
      select: { employee: { select: { id: true, employeeCode: true, employeeName: true } } },
      orderBy: { employee: { employeeName: 'asc' } }, take: 200,
    });
    return [...new Map(members.map(({employee}) => [employee.id, employee])).values()];
  }

  async list(supplied: AuthenticatedUserContext, projectId: string, equipmentId?: string) {
    const auth = await this.authorize(supplied, 'equipment.custody.view');
    await this.access.assertAccess(auth, projectId);
    return this.prisma.$queryRawUnsafe<LoanRow[]>(
      'SELECT l.id, l.company_id AS "companyId", l.equipment_id AS "equipmentId", l.project_id AS "projectId", ' +
      'l.borrower_employee_id AS "borrowerEmployeeId", b.employee_name AS "borrowerName", ' +
      'e.equipment_code AS "equipmentCode", e.equipment_name AS "equipmentName", l.site_label AS "siteLabel", ' +
      'l.issued_on AS "issuedOn", l.due_on AS "dueOn", l.condition_out AS "conditionOut", ' +
      'l.issued_by_user_id AS "issuedByUserId", l.returned_on AS "returnedOn", ' +
      'l.condition_in AS "conditionIn", l.returned_by_user_id AS "returnedByUserId", l.created_at AS "createdAt" ' +
      'FROM equipment_custody_loans l JOIN equipment e ON e.id=l.equipment_id JOIN employees b ON b.id=l.borrower_employee_id ' +
      'WHERE l.company_id=$1::uuid AND l.project_id=$2::uuid ' +
      (equipmentId ? 'AND l.equipment_id=$3::uuid ' : '') +
      'ORDER BY l.issued_on DESC, l.created_at DESC LIMIT 100',
      ...(equipmentId ? [auth.companyId, projectId, equipmentId] : [auth.companyId, projectId]),
    );
  }

  async checkout(context: Context, input: EquipmentCustodyIssue) {
    if (input.issuedOn > todayUtc()) invalid('issuedOn', 'Issue date cannot be in the future.');
    if (input.dueOn < input.issuedOn) invalid('dueOn', 'Due date cannot predate issue date.');
    return this.prisma.$transaction(async tx => {
      const auth = await this.authorize(context.auth, 'equipment.custody.manage', tx);
      await this.access.assertAccess(auth, input.projectId, tx);
      // A single Equipment row lock serializes simultaneous checkout and reassignment.
      const equipment = await tx.$queryRawUnsafe<{id:string;equipment_code:string;is_active:boolean;operational_status:string}[]>(
        'SELECT id, equipment_code, is_active, operational_status FROM equipment WHERE id=$1::uuid AND company_id=$2::uuid FOR UPDATE',
        input.equipmentId, auth.companyId,
      );
      const selectedEquipment = equipment[0];
      if (!selectedEquipment) throw new NotFoundException({code:'EQUIPMENT_NOT_FOUND',detail:'Equipment not found in Company.'});
      if (!selectedEquipment.is_active || selectedEquipment.operational_status !== 'AVAILABLE' ||
          !/^CG[0-9]{5}$/.test(selectedEquipment.equipment_code)) {
        conflict('EQUIPMENT_CUSTODY_NOT_ELIGIBLE', 'An active, available CG##### Equipment record is required.');
      }
      const open = await tx.$queryRawUnsafe<{id:string}[]>(
        'SELECT id FROM equipment_custody_loans WHERE equipment_id=$1::uuid AND returned_on IS NULL',
        input.equipmentId,
      );
      if (open.length) conflict('EQUIPMENT_ALREADY_CHECKED_OUT', 'Equipment already has an open individual custody loan.');
      const assignment = await tx.equipmentAssignment.findFirst({
        where: { companyId: auth.companyId, equipmentId: input.equipmentId, projectId: input.projectId,
          assignedTo: null, assignedFrom: { lte: input.issuedOn } },
        select: { id:true },
      });
      if (!assignment) conflict('EQUIPMENT_CUSTODY_PROJECT_ASSIGNMENT', 'Equipment must be openly assigned to the chosen Project on issue date.');
      const borrower = await tx.employee.findFirst({
        where: { id: input.borrowerEmployeeId, companyId: auth.companyId, isActive: true,
          projectMembers: { some: { projectId: input.projectId, isActive: true,
            OR: [{startDate:null},{startDate:{lte:input.issuedOn}}],
            AND: [{ OR: [{endDate:null},{endDate:{gte:input.issuedOn}}] }] } } },
        select: { id: true },
      });
      if (!borrower) conflict('EQUIPMENT_CUSTODY_BORROWER_OUT_OF_SCOPE', 'Borrower must be an active Employee member of the selected Project.');
      const inserted = await tx.$queryRawUnsafe<{id:string}[]>(
        'INSERT INTO equipment_custody_loans (company_id,equipment_id,project_id,borrower_employee_id,' +
        'site_label,issued_on,due_on,condition_out,issued_by_user_id) ' +
        'VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::date,$7::date,$8,$9::uuid) RETURNING id',
        auth.companyId,input.equipmentId,input.projectId,input.borrowerEmployeeId,
        input.siteLabel,input.issuedOn,input.dueOn,input.conditionOut,auth.userId,
      );
      const createdLoan = inserted[0];
      if (!createdLoan) conflict('EQUIPMENT_CUSTODY_INSERT_FAILED', 'Loan insertion returned no record.');
      await this.audit.record({...context,auth,entityType:'EQUIPMENT_CUSTODY',entityId:createdLoan.id,action:'CHECKOUT',
        newValues:{...input, issuedByUserId:auth.userId}},tx);
      return { id: createdLoan.id };
    });
  }

  async returnLoan(context: Context, id: string, input: EquipmentCustodyReturn) {
    if (input.returnedOn > todayUtc()) invalid('returnedOn','Return date cannot be in the future.');
    return this.prisma.$transaction(async tx => {
      const auth = await this.authorize(context.auth,'equipment.custody.manage',tx);
      const rows = await tx.$queryRawUnsafe<{id:string;equipment_id:string;project_id:string;issued_on:Date;returned_on:Date|null}[]>(
        'SELECT id,equipment_id,project_id,issued_on,returned_on FROM equipment_custody_loans ' +
        'WHERE id=$1::uuid AND company_id=$2::uuid',id,auth.companyId);
      const existingLoan = rows[0];
      if (!existingLoan) throw new NotFoundException({code:'EQUIPMENT_CUSTODY_NOT_FOUND',detail:'Loan not found in Company.'});
      await this.access.assertAccess(auth,existingLoan.project_id,tx);
      // Same lock order as checkout/assignment guards; re-read after acquiring it.
      await tx.$queryRawUnsafe('SELECT id FROM equipment WHERE id=$1::uuid FOR UPDATE', existingLoan.equipment_id);
      const locked = await tx.$queryRawUnsafe<{returned_on:Date|null;issued_on:Date}[]>(
        'SELECT returned_on,issued_on FROM equipment_custody_loans WHERE id=$1::uuid FOR UPDATE',id);
      const lockedLoan = locked[0];
      if (!lockedLoan) throw new NotFoundException({code:'EQUIPMENT_CUSTODY_NOT_FOUND',detail:'Loan not found in Company.'});
      if (lockedLoan.returned_on) conflict('EQUIPMENT_CUSTODY_ALREADY_RETURNED','A loan can only be returned once.');
      if (input.returnedOn < lockedLoan.issued_on) invalid('returnedOn','Return date cannot predate issue date.');
      const updated = await tx.$queryRawUnsafe<{id:string}[]>(
        'UPDATE equipment_custody_loans SET returned_on=$2::date,condition_in=$3,returned_by_user_id=$4::uuid,updated_at=NOW() ' +
        'WHERE id=$1::uuid AND returned_on IS NULL RETURNING id',
        id,input.returnedOn,input.conditionIn,auth.userId);
      if (!updated.length) conflict('EQUIPMENT_CUSTODY_ALREADY_RETURNED','A loan can only be returned once.');
      await this.audit.record({...context,auth,entityType:'EQUIPMENT_CUSTODY',entityId:id,action:'RETURN',
        oldValues:{returnedOn:null},newValues:{...input,returnedByUserId:auth.userId}},tx);
      return {id,returnedOn:input.returnedOn,conditionIn:input.conditionIn};
    });
  }
}
