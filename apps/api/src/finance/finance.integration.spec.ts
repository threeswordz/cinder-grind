import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { REQUIRED_PERMISSIONS_KEY } from '../authorization/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { ClientInvoiceController } from './client-invoice.controller';
import { ClientInvoiceService } from './client-invoice.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

function auth(
  companyId: string,
  userId: string,
  roleCodes: string[] = [],
  permissions: string[] = ['projects.access_all'],
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: userId + '@example.com',
    displayName: 'Finance Test User',
    roleCodes,
    permissions,
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.6-A routes retain explicit Supplier Invoice permissions', () => {
  const routes = [
    ['projects', ['finance.supplier_invoice.view']],
    ['workflowOptions', ['finance.supplier_invoice.submit']],
    ['options', ['finance.supplier_invoice.view']],
    ['list', ['finance.supplier_invoice.view']],
    ['get', ['finance.supplier_invoice.view']],
    ['byPurchaseOrderLine', ['finance.supplier_invoice.view']],
    ['byGoodsReceiptItem', ['finance.supplier_invoice.view']],
    ['create', ['finance.supplier_invoice.create']],
    ['update', ['finance.supplier_invoice.edit']],
    ['addLine', ['finance.supplier_invoice.edit']],
    ['updateLine', ['finance.supplier_invoice.edit']],
    ['deleteLine', ['finance.supplier_invoice.edit']],
    ['submit', ['finance.supplier_invoice.submit']],
    ['approve', ['finance.supplier_invoice.approve']],
    ['reject', ['finance.supplier_invoice.reject']],
  ] as const;
  for (const [method, permissions] of routes) {
    assert.deepEqual(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        FinanceController.prototype[method],
      ),
      permissions,
    );
  }
});

test('V0.6-A Supplier Invoice preserves Project scope, approval history, totals and idempotency', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'FIN-' + suffix,
        companyName: 'Finance Test ' + suffix,
        baseCurrencyCode: 'SGD',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'FIN-C-' + suffix,
        customerName: 'Finance Customer',
      },
    });
    const makerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'FIN-M-' + suffix,
        employeeName: 'Finance Maker',
      },
    });
    const checkerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'FIN-CHECK-' + suffix,
        employeeName: 'Finance Checker',
      },
    });
    const outsiderEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'FIN-OUT-' + suffix,
        employeeName: 'Finance Outsider',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: makerEmployee.id,
        email: 'fin-maker-' + suffix + '@example.com',
        displayName: 'Finance Maker',
        passwordHash: 'x',
      },
    });
    const checker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: checkerEmployee.id,
        email: 'fin-checker-' + suffix + '@example.com',
        displayName: 'Finance Checker',
        passwordHash: 'x',
      },
    });
    const outsider = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: outsiderEmployee.id,
        email: 'fin-outsider-' + suffix + '@example.com',
        displayName: 'Finance Outsider',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'FIN-P-' + suffix,
        projectName: 'Finance Project',
        customerId: customer.id,
        contractValue: '1000000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-12-31T00:00:00.000Z'),
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'FIN-X-' + suffix,
        projectName: 'Finance Other Project',
        customerId: customer.id,
        contractValue: '500000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-12-31T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.createMany({
      data: [
        {
          projectId: project.id,
          employeeId: makerEmployee.id,
          projectRole: 'Finance Maker',
        },
        {
          projectId: project.id,
          employeeId: checkerEmployee.id,
          projectRole: 'Finance Approver',
        },
      ],
    });
    const supplier = await prisma.supplier.create({
      data: {
        companyId: company.id,
        supplierCode: 'FIN-S-' + suffix,
        supplierName: 'Finance Supplier',
      },
    });
    const wbs = await prisma.wbsElement.create({
      data: {
        projectId: project.id,
        wbsCode: '01',
        wbsName: 'Finance WBS',
      },
    });
    const otherWbs = await prisma.wbsElement.create({
      data: {
        projectId: otherProject.id,
        wbsCode: '99',
        wbsName: 'Other Project WBS',
      },
    });
    const costCode = await prisma.costCode.create({
      data: {
        companyId: company.id,
        costCode: 'FIN-' + suffix,
        costName: 'Finance Cost',
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'FIN_APPROVER_' + suffix,
        roleName: 'Finance Approver',
      },
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'FIN_SI_' + suffix,
        entityType: 'SUPPLIER_INVOICE',
        workflowName: 'Supplier Invoice Approval',
        steps: {
          create: {
            stepNo: 1,
            stepName: 'Finance Checker',
            requiredApprovals: 1,
            stepRoles: { create: { roleId: role.id } },
          },
        },
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const finance = new FinanceService(
      prisma,
      access,
      new ApprovalService(prisma),
      new AuditService(prisma),
      new NumberSequenceService(prisma),
    );
    const makerAuth = auth(company.id, maker.id);
    const checkerAuth = auth(company.id, checker.id, [role.roleCode]);
    const sysAdminAuth = auth(company.id, outsider.id, ['SYS_ADMIN']);
    const outsiderAuth = auth(company.id, outsider.id, [], []);

    const draftInput = {
      supplierId: supplier.id,
      supplierReference: 'SUP-INV-' + suffix,
      invoiceDate: new Date('2026-10-01T00:00:00.000Z'),
      dueDate: new Date('2026-10-31T00:00:00.000Z'),
      createKey: randomUUID(),
      lines: [
        {
          description: 'Concrete delivered',
          amount: new (await import('@prisma/client')).Prisma.Decimal('120.50'),
          wbsId: wbs.id,
          costCodeId: costCode.id,
        },
        {
          description: 'Formwork delivered',
          amount: new (await import('@prisma/client')).Prisma.Decimal('79.50'),
          wbsId: wbs.id,
          costCodeId: costCode.id,
        },
      ],
    };

    const created = await finance.createInvoice(
      { auth: makerAuth },
      project.id,
      draftInput,
    );
    assert.match(created.supplierInvoiceNumber, /^SI2610-\d{3}$/);
    assert.equal(created.currencyCode, 'SGD');
    assert.equal(created.totalAmount.toFixed(2), '200.00');
    assert.equal(created.projectId, project.id);
    assert.equal(created.items.length, 2);

    const replay = await finance.createInvoice(
      { auth: makerAuth },
      project.id,
      draftInput,
    );
    assert.equal(replay.id, created.id);

    await assert.rejects(
      () =>
        finance.createInvoice(
          { auth: makerAuth },
          project.id,
          {
            ...draftInput,
            supplierReference: 'DIFFERENT-' + suffix,
          },
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    await assert.rejects(
      () =>
        finance.createInvoice(
          { auth: makerAuth },
          project.id,
          {
            ...draftInput,
            createKey: randomUUID(),
          },
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    await assert.rejects(
      () =>
        finance.createInvoice(
          { auth: makerAuth },
          project.id,
          {
            ...draftInput,
            createKey: randomUUID(),
            supplierReference: 'CROSS-' + suffix,
            lines: [
              {
                description: 'Cross project dimension',
                amount: draftInput.lines[0]!.amount,
                wbsId: otherWbs.id,
              },
            ],
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const submitted = await finance.submit(
      { auth: makerAuth },
      created.id,
      workflow.workflowCode,
      randomUUID(),
    );
    assert.equal(submitted.state, 'SUBMITTED');

    await assert.rejects(
      () =>
        finance.approve(
          { auth: auth(company.id, maker.id, [role.roleCode]) },
          created.id,
          randomUUID(),
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    await assert.rejects(
      () =>
        finance.approve(
          { auth: sysAdminAuth },
          created.id,
          randomUUID(),
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    await prisma.wbsElement.update({
      where: { id: wbs.id },
      data: { isActive: false },
    });
    await assert.rejects(
      () =>
        finance.approve(
          { auth: checkerAuth },
          created.id,
          randomUUID(),
          'Source changed after submission',
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    await prisma.wbsElement.update({
      where: { id: wbs.id },
      data: { isActive: true },
    });

    const approvedKey = randomUUID();
    const approved = await finance.approve(
      { auth: checkerAuth },
      created.id,
      approvedKey,
      'Approved for payment processing',
    );
    assert.equal(approved.state, 'APPROVED');
    assert.equal(approved.approvalInstance?.approvalState, 'APPROVED');
    assert.equal(approved.approvedByUserId, checker.id);

    const approvedReplay = await finance.approve(
      { auth: checkerAuth },
      created.id,
      approvedKey,
      'Approved for payment processing',
    );
    assert.equal(approvedReplay.state, 'APPROVED');

    await assert.rejects(
      () =>
        finance.updateInvoice(
          { auth: makerAuth },
          created.id,
          { supplierReference: 'MUTATED-' + suffix },
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    await assert.rejects(
      () =>
        prisma.$executeRawUnsafe(
          'UPDATE "supplier_invoices" SET "supplier_reference" = $1 WHERE "id" = $2::uuid',
          'SQL-MUTATION-' + suffix,
          created.id,
        ),
    );
    await assert.rejects(
      () =>
        prisma.$executeRawUnsafe(
          'DELETE FROM "supplier_invoice_items" WHERE "id" = $1::uuid',
          created.items[0]!.id,
        ),
    );
    await assert.rejects(
      () =>
        prisma.$executeRawUnsafe(
          'UPDATE "supplier_invoices" SET "approval_instance_id" = NULL WHERE "id" = $1::uuid',
          created.id,
        ),
      /SUPPLIER_INVOICE_HISTORY_IMMUTABLE/,
    );
    await assert.rejects(
      () =>
        prisma.$executeRawUnsafe(
          'UPDATE "supplier_invoices" SET "approved_by_user_id" = $1::uuid WHERE "id" = $2::uuid',
          maker.id,
          created.id,
        ),
      /SUPPLIER_INVOICE_HISTORY_IMMUTABLE/,
    );

    await assert.rejects(
      () => finance.getInvoice(outsiderAuth, created.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const rejectedDraft = await finance.createInvoice(
      { auth: makerAuth },
      project.id,
      {
        ...draftInput,
        createKey: randomUUID(),
        supplierReference: 'REJECT-' + suffix,
      },
    );
    await finance.submit(
      { auth: makerAuth },
      rejectedDraft.id,
      workflow.workflowCode,
      randomUUID(),
    );
    const rejected = await finance.reject(
      { auth: checkerAuth },
      rejectedDraft.id,
      randomUUID(),
      'Rejected with retained decision history',
    );
    assert.equal(rejected.state, 'REJECTED');
    assert.equal(rejected.approvalInstance?.approvalState, 'REJECTED');
    assert.equal(rejected.rejectedByUserId, checker.id);
    assert.equal(
      rejected.rejectionReason,
      'Rejected with retained decision history',
    );
    await assert.rejects(
      () =>
        finance.updateInvoice(
          { auth: makerAuth },
          rejectedDraft.id,
          { supplierReference: 'REJECT-MUTATED-' + suffix },
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    const concurrentDraft = await finance.createInvoice(
      { auth: makerAuth },
      project.id,
      {
        ...draftInput,
        createKey: randomUUID(),
        supplierReference: 'CONCURRENT-' + suffix,
      },
    );
    const concurrentSubmitted = await finance.submit(
      { auth: makerAuth },
      concurrentDraft.id,
      workflow.workflowCode,
      randomUUID(),
    );
    assert.ok(concurrentSubmitted.approvalInstanceId);

    const concurrentResults = await Promise.allSettled([
      finance.approve(
        { auth: checkerAuth },
        concurrentDraft.id,
        randomUUID(),
        'Concurrent decision A',
      ),
      finance.approve(
        { auth: checkerAuth },
        concurrentDraft.id,
        randomUUID(),
        'Concurrent decision B',
      ),
    ]);
    assert.equal(
      concurrentResults.filter((result) => result.status === 'fulfilled').length,
      1,
      'Exactly one concurrent approval transaction must commit.',
    );
    assert.equal(
      concurrentResults.filter((result) => result.status === 'rejected').length,
      1,
      'The competing concurrent approval transaction must not duplicate the decision.',
    );
    const concurrentAfter = await finance.getInvoice(
      makerAuth,
      concurrentDraft.id,
    );
    assert.equal(concurrentAfter.state, 'APPROVED');
    assert.equal(
      await prisma.approvalAction.count({
        where: {
          approvalInstanceId: concurrentSubmitted.approvalInstanceId!,
        },
      }),
      1,
      'Concurrent approval must retain exactly one approval action.',
    );

    const auditRows = await prisma.auditLog.findMany({
      where: {
        companyId: company.id,
        entityType: 'SUPPLIER_INVOICE',
        entityId: created.id,
      },
    });
    assert.ok(auditRows.some((row) => row.action === 'CREATE_DRAFT'));
    assert.ok(auditRows.some((row) => row.action === 'SUBMIT'));
    assert.ok(auditRows.some((row) => row.action === 'APPROVE'));
  } finally {
    await prisma.$disconnect();
  }
});


test('V0.6-B routes retain explicit Client Invoice and AP-AR permissions', () => {
  const clientRoutes = [
    ['projects', ['finance.client_invoice.view']],
    ['workflows', ['finance.client_invoice.submit']],
    ['options', ['finance.client_invoice.view']],
    ['list', ['finance.client_invoice.view']],
    ['accountsReceivableProjects', ['finance.ar.view']],
    ['accountsReceivable', ['finance.ar.view']],
    ['get', ['finance.client_invoice.view']],
    ['create', ['finance.client_invoice.create']],
    ['update', ['finance.client_invoice.edit']],
    ['addLine', ['finance.client_invoice.edit']],
    ['updateLine', ['finance.client_invoice.edit']],
    ['deleteLine', ['finance.client_invoice.edit']],
    ['submit', ['finance.client_invoice.submit']],
    ['approve', ['finance.client_invoice.approve']],
    ['reject', ['finance.client_invoice.reject']],
  ] as const;
  for (const [method, permissions] of clientRoutes) {
    assert.deepEqual(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        ClientInvoiceController.prototype[method],
      ),
      permissions,
    );
  }
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      FinanceController.prototype.accountsPayableProjects,
    ),
    ['finance.ap.view'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      FinanceController.prototype.accountsPayable,
    ),
    ['finance.ap.view'],
  );
});

test('V0.6-B Client Invoice viewer Project selector preserves archived history', async () => {
  const companyId = randomUUID();
  const userId = randomUUID();
  const viewerAuth = auth(companyId, userId, [], [
    'finance.client_invoice.view',
    'projects.access_all',
  ]);
  const archivedProject = {
    id: randomUUID(),
    projectCode: 'ARCHIVED-CI',
    projectName: 'Archived Client Invoice Project',
    isActive: false,
  };
  let balanceSelectorCalled = false;
  const controller = new ClientInvoiceController({
    balanceProjects: async (receivedAuth: AuthenticatedUserContext) => {
      balanceSelectorCalled = true;
      assert.equal(receivedAuth.userId, userId);
      return [archivedProject];
    },
  } as unknown as ClientInvoiceService);

  const result = await controller.projects({ auth: viewerAuth } as never);
  assert.equal(balanceSelectorCalled, true);
  assert.deepEqual(result.data, [archivedProject]);
});

test('V0.6-B Client Invoice preserves scope, maker-checker, retained history and derived AP-AR', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'FINB-' + suffix,
        companyName: 'Finance B Test ' + suffix,
        baseCurrencyCode: 'SGD',
      },
    });
    await assert.rejects(
      () =>
        prisma.numberSequence.create({
          data: {
            companyId: company.id,
            entityType: 'CUSTOM',
            sequenceCode: 'CLIENT_INVOICE',
            formatTemplate: 'BAD-###',
            resetRule: 'NONE',
            nextValue: 1,
          },
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes('number_sequences_client_invoice_policy_check'),
    );
    assert.equal(
      await prisma.numberSequence.count({
        where: { companyId: company.id, sequenceCode: 'CLIENT_INVOICE' },
      }),
      0,
      'Post-migration database policy must reject malformed reserved Client Invoice sequences.',
    );

    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'FINB-C-' + suffix,
        customerName: 'Finance B Customer',
      },
    });
    const otherCustomer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'FINB-X-' + suffix,
        customerName: 'Alternate Same-Company Customer',
      },
    });
    const foreignCompany = await prisma.company.create({
      data: {
        companyCode: 'FINB-F-' + suffix,
        companyName: 'Finance B Foreign Company ' + suffix,
        baseCurrencyCode: 'SGD',
      },
    });
    const foreignCustomer = await prisma.customer.create({
      data: {
        companyId: foreignCompany.id,
        customerCode: 'FINB-FC-' + suffix,
        customerName: 'Foreign Company Customer',
      },
    });
    const makerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'FINB-M-' + suffix,
        employeeName: 'Finance B Maker',
      },
    });
    const checkerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'FINB-CHECK-' + suffix,
        employeeName: 'Finance B Checker',
      },
    });
    const checker2Employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'FINB-CHECK2-' + suffix,
        employeeName: 'Finance B Checker Two',
      },
    });
    const outsiderEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'FINB-OUT-' + suffix,
        employeeName: 'Finance B Outsider',
      },
    });
    const permissionDeniedEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'FINB-NOPERM-' + suffix,
        employeeName: 'Finance B No Permission',
      },
    });
    const scopeDeniedEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'FINB-NOSCOPE-' + suffix,
        employeeName: 'Finance B No Project Scope',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: makerEmployee.id,
        email: 'finb-maker-' + suffix + '@example.com',
        displayName: 'Finance B Maker',
        passwordHash: 'x',
      },
    });
    const checker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: checkerEmployee.id,
        email: 'finb-checker-' + suffix + '@example.com',
        displayName: 'Finance B Checker',
        passwordHash: 'x',
      },
    });
    const checker2 = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: checker2Employee.id,
        email: 'finb-checker2-' + suffix + '@example.com',
        displayName: 'Finance B Checker Two',
        passwordHash: 'x',
      },
    });
    const outsider = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: outsiderEmployee.id,
        email: 'finb-outsider-' + suffix + '@example.com',
        displayName: 'Finance B Outsider',
        passwordHash: 'x',
      },
    });
    const permissionDeniedUser = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: permissionDeniedEmployee.id,
        email: 'finb-noperm-' + suffix + '@example.com',
        displayName: 'Finance B No Permission',
        passwordHash: 'x',
      },
    });
    const scopeDeniedUser = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: scopeDeniedEmployee.id,
        email: 'finb-noscope-' + suffix + '@example.com',
        displayName: 'Finance B No Project Scope',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'FINB-P-' + suffix,
        projectName: 'Finance B Project',
        customerId: customer.id,
        contractValue: '1000000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-12-31T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.createMany({
      data: [
        { projectId: project.id, employeeId: makerEmployee.id, projectRole: 'Finance Maker' },
        { projectId: project.id, employeeId: checkerEmployee.id, projectRole: 'Finance Approver' },
        { projectId: project.id, employeeId: checker2Employee.id, projectRole: 'Finance Approver' },
        { projectId: project.id, employeeId: permissionDeniedEmployee.id, projectRole: 'Finance Permission Test' },
      ],
    });
    const supplier = await prisma.supplier.create({
      data: {
        companyId: company.id,
        supplierCode: 'FINB-S-' + suffix,
        supplierName: 'Finance B Supplier',
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'FINB_APPROVER_' + suffix,
        roleName: 'Finance B Approver',
      },
    });
    const noPermissionRole = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'FINB_NOPERM_' + suffix,
        roleName: 'Finance B Workflow Role Without Finance Permission',
      },
    });
    const decisionPermissions = await prisma.permission.findMany({
      where: {
        permissionCode: {
          in: ['finance.client_invoice.approve', 'finance.client_invoice.reject'],
        },
      },
      select: { id: true, permissionCode: true },
    });
    assert.equal(decisionPermissions.length, 2);
    await prisma.rolePermission.createMany({
      data: decisionPermissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
    });
    await prisma.userRole.createMany({
      data: [
        { companyId: company.id, userId: checker.id, roleId: role.id },
        { companyId: company.id, userId: checker2.id, roleId: role.id },
        {
          companyId: company.id,
          userId: permissionDeniedUser.id,
          roleId: noPermissionRole.id,
        },
        {
          companyId: company.id,
          userId: scopeDeniedUser.id,
          roleId: role.id,
        },
      ],
    });
    const clientWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'FINB_CI_' + suffix,
        entityType: 'CLIENT_INVOICE',
        workflowName: 'Client Invoice Approval',
        steps: {
          create: {
            stepNo: 1,
            stepName: 'Finance Checker',
            requiredApprovals: 1,
            stepRoles: {
              create: [
                { roleId: role.id },
                { roleId: noPermissionRole.id },
              ],
            },
          },
        },
      },
    });
    const multiApproverWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'FINB_CI_MULTI_' + suffix,
        entityType: 'CLIENT_INVOICE',
        workflowName: 'Client Invoice Two-Approver Workflow',
        steps: {
          create: {
            stepNo: 1,
            stepName: 'Two Finance Checkers',
            requiredApprovals: 2,
            stepRoles: { create: { roleId: role.id } },
          },
        },
      },
    });
    const supplierWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'FINB_SI_' + suffix,
        entityType: 'SUPPLIER_INVOICE',
        workflowName: 'Supplier Invoice Approval',
        steps: {
          create: {
            stepNo: 1,
            stepName: 'Finance Checker',
            requiredApprovals: 1,
            stepRoles: { create: { roleId: role.id } },
          },
        },
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const approvals = new ApprovalService(prisma);
    const audit = new AuditService(prisma);
    const numbers = new NumberSequenceService(prisma);
    const clientFinance = new ClientInvoiceService(
      prisma,
      access,
      approvals,
      audit,
      numbers,
    );
    const supplierFinance = new FinanceService(
      prisma,
      access,
      approvals,
      audit,
      numbers,
    );
    const makerAuth = auth(company.id, maker.id);
    const checkerAuth = auth(company.id, checker.id, [role.roleCode]);
    const sysAdminAuth = auth(company.id, outsider.id, ['SYS_ADMIN']);
    const outsiderAuth = auth(company.id, outsider.id, [], []);
    const Decimal = (await import('@prisma/client')).Prisma.Decimal;

    const draft = await clientFinance.create(
      { auth: makerAuth },
      project.id,
      {
        customerId: customer.id,
        invoiceDate: new Date('2026-10-02T00:00:00.000Z'),
        dueDate: new Date('2026-10-31T00:00:00.000Z'),
        createKey: randomUUID(),
        lines: [{ description: 'Progress billing', amount: new Decimal('125.50') }],
      },
    );
    assert.match(draft.clientInvoiceNumber, /^CI2610-\d{3}$/);
    assert.equal(draft.currencyCode, 'SGD');
    assert.equal(draft.totalAmount.toFixed(2), '125.50');

    const samePeriodDateEdit = await clientFinance.update(
      { auth: makerAuth },
      draft.id,
      { invoiceDate: new Date('2026-10-15T00:00:00.000Z') },
    );
    assert.equal(
      samePeriodDateEdit.invoiceDate.toISOString().slice(0, 10),
      '2026-10-15',
    );
    await assert.rejects(
      () =>
        clientFinance.update(
          { auth: makerAuth },
          draft.id,
          {
            invoiceDate: new Date('2026-11-01T00:00:00.000Z'),
            dueDate: new Date('2026-11-30T00:00:00.000Z'),
          },
        ),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () =>
        prisma.clientInvoice.update({
          where: { id: draft.id },
          data: { invoiceDate: new Date('2026-11-01T00:00:00.000Z') },
        }),
      /CLIENT_INVOICE_NUMBER_PERIOD_MISMATCH/,
    );
    await assert.rejects(
      () =>
        prisma.clientInvoice.update({
          where: { id: draft.id },
          data: { dueDate: new Date('2026-10-10T00:00:00.000Z') },
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes('client_invoices_due_date_order_check'),
    );

    const dateRaceDraft = await clientFinance.create(
      { auth: makerAuth },
      project.id,
      {
        customerId: customer.id,
        invoiceDate: new Date('2026-10-02T00:00:00.000Z'),
        dueDate: new Date('2026-10-31T00:00:00.000Z'),
        createKey: randomUUID(),
        lines: [{ description: 'Concurrent header date validation', amount: new Decimal('6.00') }],
      },
    );
    const dateRaceResults = await Promise.allSettled([
      clientFinance.update(
        { auth: makerAuth },
        dateRaceDraft.id,
        { dueDate: new Date('2026-10-10T00:00:00.000Z') },
      ),
      clientFinance.update(
        { auth: makerAuth },
        dateRaceDraft.id,
        { invoiceDate: new Date('2026-10-20T00:00:00.000Z') },
      ),
    ]);
    assert.equal(
      dateRaceResults.filter((result) => result.status === 'fulfilled').length,
      1,
      'Exactly one competing Draft header date update may commit.',
    );
    const rejectedDateRace = dateRaceResults.find(
      (result) => result.status === 'rejected',
    );
    assert.ok(rejectedDateRace && rejectedDateRace.status === 'rejected');
    assert.ok(
      rejectedDateRace.reason instanceof UnprocessableEntityException,
      'The waiter must reload the locked Draft and reject the stale date pair in service validation.',
    );
    const dateRaceAfter = await clientFinance.get(makerAuth, dateRaceDraft.id);
    assert.ok(
      dateRaceAfter.dueDate === null ||
        dateRaceAfter.dueDate.getTime() >= dateRaceAfter.invoiceDate.getTime(),
    );

    const lineSubmissionRaceDraft = await clientFinance.create(
      { auth: makerAuth },
      project.id,
      {
        customerId: customer.id,
        invoiceDate: new Date('2026-10-04T00:00:00.000Z'),
        dueDate: new Date('2026-10-31T00:00:00.000Z'),
        createKey: randomUUID(),
        lines: [{ description: 'Line/submission serialization', amount: new Decimal('10.00') }],
      },
    );
    const interceptedClientFinance = clientFinance as unknown as {
      lock: (
        companyId: string,
        invoiceId: string,
        tx: Prisma.TransactionClient,
      ) => Promise<void>;
    };
    const originalClientInvoiceLock =
      interceptedClientFinance.lock.bind(clientFinance);
    let releaseSubmissionLock!: () => void;
    const permitSubmission = new Promise<void>((resolve) => {
      releaseSubmissionLock = resolve;
    });
    let submissionLocked!: () => void;
    const submissionHasLock = new Promise<void>((resolve) => {
      submissionLocked = resolve;
    });
    interceptedClientFinance.lock = async (companyId, invoiceId, tx) => {
      await originalClientInvoiceLock(companyId, invoiceId, tx);
      if (invoiceId === lineSubmissionRaceDraft.id) {
        submissionLocked();
        await permitSubmission;
      }
    };
    try {
      const racingLineSubmission = clientFinance.submit(
        { auth: makerAuth },
        lineSubmissionRaceDraft.id,
        clientWorkflow.workflowCode,
        randomUUID(),
      );
      await submissionHasLock;
      const directLineMutation = prisma.clientInvoiceItem
        .create({
          data: {
            companyId: company.id,
            projectId: project.id,
            clientInvoiceId: lineSubmissionRaceDraft.id,
            lineNo: 2,
            description: 'Must not cross submission boundary',
            amount: new Decimal('5.00'),
          },
        })
        .then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (error: unknown) => ({ status: 'rejected' as const, error }),
        );
      const mutationState = await Promise.race([
        directLineMutation.then((result) => result.status),
        new Promise<'pending'>((resolve) =>
          setTimeout(() => resolve('pending'), 200),
        ),
      ]);
      assert.equal(
        mutationState,
        'pending',
        'Direct Client Invoice line mutation must wait while submission owns the parent invoice lock.',
      );

      releaseSubmissionLock();
      const retainedSubmission = await racingLineSubmission;
      assert.equal(retainedSubmission.state, 'SUBMITTED');

      const mutationOutcome = await directLineMutation;
      assert.equal(mutationOutcome.status, 'rejected');
      assert.ok(
        mutationOutcome.status === 'rejected' &&
          mutationOutcome.error instanceof Error &&
          mutationOutcome.error.message.includes(
            'CLIENT_INVOICE_HISTORY_IMMUTABLE',
          ),
        'A direct line mutation waiting behind submission must re-check the committed parent state and reject.',
      );
      const retainedAfterLineRace = await clientFinance.get(
        makerAuth,
        lineSubmissionRaceDraft.id,
      );
      assert.equal(retainedAfterLineRace.items.length, 1);
      assert.equal(retainedAfterLineRace.totalAmount.toFixed(2), '10.00');

      const directDecisionAt = new Date();
      await assert.rejects(
        () =>
          prisma.clientInvoice.update({
            where: { id: lineSubmissionRaceDraft.id },
            data: {
              state: 'APPROVED',
              approvedByUserId: checker.id,
              approvedAt: directDecisionAt,
              decidedAt: directDecisionAt,
            },
          }),
        /CLIENT_INVOICE_APPROVAL_STATE_MISMATCH/,
      );
      await assert.rejects(
        () =>
          prisma.clientInvoice.update({
            where: { id: lineSubmissionRaceDraft.id },
            data: {
              state: 'REJECTED',
              rejectedByUserId: checker.id,
              rejectedAt: directDecisionAt,
              decidedAt: directDecisionAt,
              rejectionReason: 'Direct decision bypass must fail',
            },
          }),
        /CLIENT_INVOICE_APPROVAL_STATE_MISMATCH/,
      );
      const afterDecisionBypass = await clientFinance.get(
        makerAuth,
        lineSubmissionRaceDraft.id,
      );
      assert.equal(afterDecisionBypass.state, 'SUBMITTED');
      assert.equal(
        afterDecisionBypass.approvalInstance?.approvalState,
        'SUBMITTED',
      );

      const linkedApproval = await prisma.approvalInstance.findUniqueOrThrow({
        where: { id: retainedSubmission.approvalInstanceId! },
        include: {
          workflow: {
            include: {
              steps: { orderBy: { stepNo: 'asc' } },
            },
          },
        },
      });
      const currentApprovalStep = linkedApproval.workflow.steps.find(
        (step) => step.stepNo === linkedApproval.currentStepNo,
      );
      assert.ok(currentApprovalStep);

      await assert.rejects(
        () =>
          prisma.approvalInstance.update({
            where: { id: linkedApproval.id },
            data: {
              approvalState: 'APPROVED',
              completedAt: new Date(),
            },
          }),
        /CLIENT_INVOICE_APPROVAL_EVIDENCE_INVALID/,
      );
      await assert.rejects(
        () =>
          prisma.approvalAction.create({
            data: {
              approvalInstanceId: linkedApproval.id,
              approvalStepId: currentApprovalStep!.id,
              action: 'APPROVE',
              actionByUserId: maker.id,
            },
          }),
        /CLIENT_INVOICE_MAKER_CHECKER_VIOLATION/,
      );
      await assert.rejects(
        () =>
          prisma.approvalAction.create({
            data: {
              approvalInstanceId: linkedApproval.id,
              approvalStepId: currentApprovalStep!.id,
              action: 'APPROVE',
              actionByUserId: outsider.id,
            },
          }),
        /CLIENT_INVOICE_APPROVAL_ROLE_DENIED/,
      );
      await assert.rejects(
        () =>
          prisma.approvalAction.create({
            data: {
              approvalInstanceId: linkedApproval.id,
              approvalStepId: currentApprovalStep!.id,
              action: 'APPROVE',
              actionByUserId: permissionDeniedUser.id,
            },
          }),
        /CLIENT_INVOICE_APPROVAL_PERMISSION_DENIED/,
      );
      await assert.rejects(
        () =>
          prisma.approvalAction.create({
            data: {
              approvalInstanceId: linkedApproval.id,
              approvalStepId: currentApprovalStep!.id,
              action: 'APPROVE',
              actionByUserId: scopeDeniedUser.id,
            },
          }),
        /CLIENT_INVOICE_APPROVAL_PROJECT_ACCESS_DENIED/,
      );

      const actorBindingDraft = await clientFinance.create(
        { auth: makerAuth },
        project.id,
        {
          customerId: customer.id,
          invoiceDate: new Date('2026-10-05T00:00:00.000Z'),
          dueDate: new Date('2026-10-31T00:00:00.000Z'),
          createKey: randomUUID(),
          lines: [{ description: 'Decision evidence binding', amount: new Decimal('8.00') }],
        },
      );
      const actorBindingSubmission = await clientFinance.submit(
        { auth: makerAuth },
        actorBindingDraft.id,
        clientWorkflow.workflowCode,
        randomUUID(),
      );
      const actorBindingInstance = await prisma.approvalInstance.findUniqueOrThrow({
        where: { id: actorBindingSubmission.approvalInstanceId! },
      });
      const actorBindingStep = await prisma.approvalStep.findFirstOrThrow({
        where: {
          approvalWorkflowId: actorBindingInstance.approvalWorkflowId,
          stepNo: actorBindingInstance.currentStepNo,
        },
      });
      const actorBindingAction = await prisma.approvalAction.create({
        data: {
          approvalInstanceId: actorBindingInstance.id,
          approvalStepId: actorBindingStep.id,
          action: 'APPROVE',
          actionByUserId: checker.id,
        },
      });
      await prisma.approvalInstance.update({
        where: { id: actorBindingInstance.id },
        data: { approvalState: 'APPROVED', completedAt: actorBindingAction.actionAt },
      });
      await assert.rejects(
        () =>
          prisma.clientInvoice.update({
            where: { id: actorBindingDraft.id },
            data: {
              state: 'APPROVED',
              approvedByUserId: outsider.id,
              approvedAt: actorBindingAction.actionAt,
              decidedAt: actorBindingAction.actionAt,
            },
          }),
        /CLIENT_INVOICE_APPROVAL_METADATA_EVIDENCE_MISMATCH/,
      );
      const forgedDecisionAt = new Date(actorBindingAction.actionAt.getTime() + 1000);
      await assert.rejects(
        () =>
          prisma.clientInvoice.update({
            where: { id: actorBindingDraft.id },
            data: {
              state: 'APPROVED',
              approvedByUserId: checker.id,
              approvedAt: forgedDecisionAt,
              decidedAt: forgedDecisionAt,
            },
          }),
        /CLIENT_INVOICE_APPROVAL_METADATA_EVIDENCE_MISMATCH/,
      );
      const evidenceBoundInvoice = await prisma.clientInvoice.update({
        where: { id: actorBindingDraft.id },
        data: {
          state: 'APPROVED',
          approvedByUserId: actorBindingAction.actionByUserId,
          approvedAt: actorBindingAction.actionAt,
          decidedAt: actorBindingAction.actionAt,
        },
      });
      assert.equal(evidenceBoundInvoice.approvedByUserId, checker.id);
      assert.equal(
        evidenceBoundInvoice.approvedAt?.getTime(),
        actorBindingAction.actionAt.getTime(),
      );

      const rejectionBindingDraft = await clientFinance.create(
        { auth: makerAuth },
        project.id,
        {
          customerId: customer.id,
          invoiceDate: new Date('2026-10-06T00:00:00.000Z'),
          dueDate: new Date('2026-10-31T00:00:00.000Z'),
          createKey: randomUUID(),
          lines: [{ description: 'Rejection reason evidence binding', amount: new Decimal('8.50') }],
        },
      );
      const rejectionBindingSubmission = await clientFinance.submit(
        { auth: makerAuth },
        rejectionBindingDraft.id,
        clientWorkflow.workflowCode,
        randomUUID(),
      );
      const rejectionBindingInstance = await prisma.approvalInstance.findUniqueOrThrow({
        where: { id: rejectionBindingSubmission.approvalInstanceId! },
      });
      const rejectionBindingStep = await prisma.approvalStep.findFirstOrThrow({
        where: {
          approvalWorkflowId: rejectionBindingInstance.approvalWorkflowId,
          stepNo: rejectionBindingInstance.currentStepNo,
        },
      });
      const retainedRejectionReason = 'Retained rejection evidence';
      const rejectionBindingAction = await prisma.approvalAction.create({
        data: {
          approvalInstanceId: rejectionBindingInstance.id,
          approvalStepId: rejectionBindingStep.id,
          action: 'REJECT',
          actionByUserId: checker.id,
          comment: retainedRejectionReason,
        },
      });
      await prisma.approvalInstance.update({
        where: { id: rejectionBindingInstance.id },
        data: {
          approvalState: 'REJECTED',
          completedAt: rejectionBindingAction.actionAt,
        },
      });
      await assert.rejects(
        () =>
          prisma.clientInvoice.update({
            where: { id: rejectionBindingDraft.id },
            data: {
              state: 'REJECTED',
              rejectedByUserId: rejectionBindingAction.actionByUserId,
              rejectedAt: rejectionBindingAction.actionAt,
              decidedAt: rejectionBindingAction.actionAt,
              rejectionReason: 'Forged rejection reason',
            },
          }),
        /CLIENT_INVOICE_REJECTION_METADATA_EVIDENCE_MISMATCH/,
      );
      const evidenceBoundRejectedInvoice = await prisma.clientInvoice.update({
        where: { id: rejectionBindingDraft.id },
        data: {
          state: 'REJECTED',
          rejectedByUserId: rejectionBindingAction.actionByUserId,
          rejectedAt: rejectionBindingAction.actionAt,
          decidedAt: rejectionBindingAction.actionAt,
          rejectionReason: retainedRejectionReason,
        },
      });
      assert.equal(evidenceBoundRejectedInvoice.rejectedByUserId, checker.id);
      assert.equal(evidenceBoundRejectedInvoice.rejectionReason, retainedRejectionReason);

      const multiDraft = await clientFinance.create(
        { auth: makerAuth },
        project.id,
        {
          customerId: customer.id,
          invoiceDate: new Date('2026-10-07T00:00:00.000Z'),
          dueDate: new Date('2026-10-31T00:00:00.000Z'),
          createKey: randomUUID(),
          lines: [{ description: 'Serialized multi-approver final action', amount: new Decimal('9.00') }],
        },
      );
      const multiSubmitted = await clientFinance.submit(
        { auth: makerAuth },
        multiDraft.id,
        multiApproverWorkflow.workflowCode,
        randomUUID(),
      );
      const multiInstance = await prisma.approvalInstance.findUniqueOrThrow({
        where: { id: multiSubmitted.approvalInstanceId! },
      });
      const multiStep = await prisma.approvalStep.findFirstOrThrow({
        where: {
          approvalWorkflowId: multiInstance.approvalWorkflowId,
          stepNo: multiInstance.currentStepNo,
        },
      });

      const earlierRetainedTimestamp = new Date('2026-10-07T09:00:00.000Z');
      const laterRetainedTimestamp = new Date('2026-10-07T10:00:00.000Z');
      let earlyTransactionStarted!: () => void;
      const earlyStarted = new Promise<void>((resolve) => {
        earlyTransactionStarted = resolve;
      });
      const earlyStartedLaterInsert = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT now()`;
        earlyTransactionStarted();
        await tx.$queryRaw`SELECT 1::int AS "slept" FROM pg_sleep(0.25)`;
        return tx.approvalAction.create({
          data: {
            approvalInstanceId: multiInstance.id,
            approvalStepId: multiStep.id,
            action: 'APPROVE',
            actionByUserId: checker2.id,
            actionAt: earlierRetainedTimestamp,
          },
        });
      });
      await earlyStarted;
      const laterStartedEarlierInsert = prisma.$transaction(async (tx) =>
        tx.approvalAction.create({
          data: {
            approvalInstanceId: multiInstance.id,
            approvalStepId: multiStep.id,
            action: 'APPROVE',
            actionByUserId: checker.id,
            actionAt: laterRetainedTimestamp,
          },
        }),
      );
      const [serializedSecondAction, serializedFirstAction] = await Promise.all([
        earlyStartedLaterInsert,
        laterStartedEarlierInsert,
      ]);
      assert.ok(serializedFirstAction.clientInvoiceDecisionOrder);
      assert.ok(serializedSecondAction.clientInvoiceDecisionOrder);
      assert.ok(
        serializedSecondAction.clientInvoiceDecisionOrder! >
          serializedFirstAction.clientInvoiceDecisionOrder!,
        'Decision order must follow the Approval Instance lock serialization order.',
      );
      assert.ok(
        serializedSecondAction.actionAt.getTime() >=
          serializedFirstAction.actionAt.getTime(),
        'Retained action_at must follow the Approval Instance serialization order.',
      );
      assert.notEqual(
        serializedFirstAction.actionAt.getTime(),
        laterRetainedTimestamp.getTime(),
        'The database must replace caller-supplied action_at after acquiring the serialization lock.',
      );
      assert.notEqual(
        serializedSecondAction.actionAt.getTime(),
        earlierRetainedTimestamp.getTime(),
        'The final serialized action must receive its retained timestamp after lock acquisition.',
      );

      await prisma.approvalInstance.update({
        where: { id: multiInstance.id },
        data: { approvalState: 'APPROVED', completedAt: new Date() },
      });
      const multiApproved = await prisma.clientInvoice.update({
        where: { id: multiDraft.id },
        data: {
          state: 'APPROVED',
          approvedByUserId: serializedSecondAction.actionByUserId,
          approvedAt: serializedSecondAction.actionAt,
          decidedAt: serializedSecondAction.actionAt,
        },
      });
      assert.equal(multiApproved.approvedByUserId, checker2.id);
      assert.equal(
        multiApproved.approvedAt?.getTime(),
        serializedSecondAction.actionAt.getTime(),
      );

      const supplierApprovalStep = await prisma.approvalStep.findFirstOrThrow({
        where: { approvalWorkflowId: supplierWorkflow.id, stepNo: 1 },
      });
      const unrelatedApprovalInstance = await prisma.approvalInstance.create({
        data: {
          companyId: company.id,
          approvalWorkflowId: supplierWorkflow.id,
          entityType: 'SUPPLIER_INVOICE',
          entityId: randomUUID(),
          currentStepNo: 1,
          approvalState: 'SUBMITTED',
        },
      });
      const unrelatedApprovalAction = await prisma.approvalAction.create({
        data: {
          approvalInstanceId: unrelatedApprovalInstance.id,
          approvalStepId: supplierApprovalStep.id,
          action: 'APPROVE',
          actionByUserId: checker.id,
        },
      });
      await assert.rejects(
        () =>
          prisma.approvalAction.update({
            where: { id: unrelatedApprovalAction.id },
            data: {
              approvalInstanceId: linkedApproval.id,
              approvalStepId: currentApprovalStep!.id,
            },
          }),
        /CLIENT_INVOICE_APPROVAL_ACTION_IMMUTABLE/,
      );

      const decisionRaceDraft = await clientFinance.create(
        { auth: makerAuth },
        project.id,
        {
          customerId: customer.id,
          invoiceDate: new Date('2026-10-06T00:00:00.000Z'),
          dueDate: new Date('2026-10-31T00:00:00.000Z'),
          createKey: randomUUID(),
          lines: [{ description: 'Approval decision serialization', amount: new Decimal('7.00') }],
        },
      );
      const decisionRaceSubmission = await clientFinance.submit(
        { auth: makerAuth },
        decisionRaceDraft.id,
        clientWorkflow.workflowCode,
        randomUUID(),
      );
      const decisionRaceInstance = await prisma.approvalInstance.findUniqueOrThrow({
        where: { id: decisionRaceSubmission.approvalInstanceId! },
      });
      const decisionRaceStep = await prisma.approvalStep.findFirstOrThrow({
        where: {
          approvalWorkflowId: decisionRaceInstance.approvalWorkflowId,
          stepNo: decisionRaceInstance.currentStepNo,
        },
      });
      const competingDecisions = await Promise.allSettled([
        prisma.approvalAction.create({
          data: {
            approvalInstanceId: decisionRaceInstance.id,
            approvalStepId: decisionRaceStep.id,
            action: 'APPROVE',
            actionByUserId: checker.id,
          },
        }),
        prisma.approvalAction.create({
          data: {
            approvalInstanceId: decisionRaceInstance.id,
            approvalStepId: decisionRaceStep.id,
            action: 'REJECT',
            actionByUserId: checker.id,
          },
        }),
      ]);
      assert.equal(
        competingDecisions.filter((result) => result.status === 'fulfilled').length,
        1,
        'Exactly one competing direct decision by the same user may commit.',
      );
      const rejectedCompetingDecision = competingDecisions.find(
        (result) => result.status === 'rejected',
      );
      assert.ok(
        rejectedCompetingDecision &&
          rejectedCompetingDecision.status === 'rejected' &&
          rejectedCompetingDecision.reason instanceof Error &&
          rejectedCompetingDecision.reason.message.includes(
            'CLIENT_INVOICE_APPROVAL_ACTION_DUPLICATE',
          ),
        'The serialized waiter must observe the committed decision and reject.',
      );

      const legitimateDecision = await clientFinance.approve(
        { auth: checkerAuth },
        lineSubmissionRaceDraft.id,
        randomUUID(),
        'Configured workflow decision',
      );
      assert.equal(legitimateDecision.state, 'APPROVED');
      assert.equal(
        legitimateDecision.approvalInstance?.approvalState,
        'APPROVED',
      );
    } finally {
      releaseSubmissionLock();
      interceptedClientFinance.lock = originalClientInvoiceLock;
    }

    const alternateCustomerDraft = await clientFinance.create(
      { auth: makerAuth },
      project.id,
      {
        customerId: otherCustomer.id,
        invoiceDate: new Date('2026-10-02T00:00:00.000Z'),
        createKey: randomUUID(),
        lines: [{ description: 'Alternate same-Company customer', amount: new Decimal('1.00') }],
      },
    );
    assert.equal(alternateCustomerDraft.customerId, otherCustomer.id);

    await assert.rejects(
      () =>
        clientFinance.create(
          { auth: makerAuth },
          project.id,
          {
            customerId: foreignCustomer.id,
            invoiceDate: new Date('2026-10-02T00:00:00.000Z'),
            createKey: randomUUID(),
            lines: [{ description: 'Cross-company customer', amount: new Decimal('1.00') }],
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const directInsertDecisionAt = new Date();
    await assert.rejects(
      () =>
        prisma.clientInvoice.create({
          data: {
            companyId: company.id,
            projectId: project.id,
            customerId: customer.id,
            clientInvoiceNumber: 'CI2610-999999',
            invoiceDate: new Date('2026-10-02T00:00:00.000Z'),
            currencyCode: 'SGD',
            state: 'APPROVED',
            createKey: randomUUID(),
            createPayloadHash: '1'.repeat(64),
            createdByUserId: maker.id,
            approvedByUserId: checker.id,
            approvedAt: directInsertDecisionAt,
            decidedAt: directInsertDecisionAt,
          },
        }),
      /CLIENT_INVOICE_INITIAL_STATE_INVALID/,
    );
    await assert.rejects(
      () =>
        prisma.clientInvoice.create({
          data: {
            companyId: company.id,
            projectId: project.id,
            customerId: customer.id,
            clientInvoiceNumber: 'CI2610-999998',
            invoiceDate: new Date('2026-10-02T00:00:00.000Z'),
            currencyCode: 'SGD',
            state: 'DRAFT',
            createKey: randomUUID(),
            createPayloadHash: '2'.repeat(64),
            createdByUserId: maker.id,
            approvedByUserId: checker.id,
          },
        }),
      /CLIENT_INVOICE_INITIAL_STATE_INVALID/,
    );

    await assert.rejects(
      () =>
        prisma.clientInvoice.create({
          data: {
            companyId: company.id,
            projectId: project.id,
            customerId: customer.id,
            clientInvoiceNumber: 'CI-BAD-' + suffix,
            invoiceDate: new Date('2026-10-02T00:00:00.000Z'),
            currencyCode: 'USD',
            createKey: randomUUID(),
            createPayloadHash: '0'.repeat(64),
            createdByUserId: maker.id,
          },
        }),
      /CLIENT_INVOICE_BASE_CURRENCY_REQUIRED/,
    );

    const createRaceKey = randomUUID();
    const createRaceInput = {
      customerId: customer.id,
      invoiceDate: new Date('2026-10-02T00:00:00.000Z'),
      createKey: createRaceKey,
      lines: [{ description: 'Idempotent create race', amount: new Decimal('2.00') }],
    };
    const [createRaceA, createRaceB] = await Promise.all([
      clientFinance.create({ auth: makerAuth }, project.id, createRaceInput),
      clientFinance.create({ auth: makerAuth }, project.id, createRaceInput),
    ]);
    assert.equal(createRaceA.id, createRaceB.id);

    // Number allocation now participates in the caller's transaction. Simulate
    // a losing create transaction that has already allocated in a later month:
    // rollback must leave the Company-wide sequence period unchanged so a
    // legitimate earlier-period Client Invoice remains allocatable.
    const sequenceBeforeRollback = await prisma.numberSequence.findFirstOrThrow({
      where: { companyId: company.id, sequenceCode: 'CLIENT_INVOICE' },
      select: { nextValue: true, lastPeriodKey: true },
    });
    await assert.rejects(
      () =>
        prisma.$transaction(
          async (tx) => {
            await numbers.next(
              company.id,
              'CLIENT_INVOICE',
              new Date('2026-11-02T00:00:00.000Z'),
              tx,
            );
            throw new Error('ROLLBACK_CLIENT_INVOICE_SEQUENCE');
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
        ),
      /ROLLBACK_CLIENT_INVOICE_SEQUENCE/,
    );
    const sequenceAfterRollback = await prisma.numberSequence.findFirstOrThrow({
      where: { companyId: company.id, sequenceCode: 'CLIENT_INVOICE' },
      select: { nextValue: true, lastPeriodKey: true },
    });
    assert.deepEqual(
      sequenceAfterRollback,
      sequenceBeforeRollback,
      'A rolled-back Client Invoice create must not commit its sequence mutation.',
    );
    const postRollbackOctober = await clientFinance.create(
      { auth: makerAuth },
      project.id,
      {
        customerId: customer.id,
        invoiceDate: new Date('2026-10-25T00:00:00.000Z'),
        createKey: randomUUID(),
        lines: [{ description: 'Earlier period remains allocatable', amount: new Decimal('5.00') }],
      },
    );
    assert.match(postRollbackOctober.clientInvoiceNumber, /^CI2610-\d{3}$/);

    const edited = await clientFinance.addLine(
      { auth: makerAuth },
      draft.id,
      { description: 'Approved variation billing', amount: new Decimal('50.00') },
    );
    assert.equal(edited.totalAmount.toFixed(2), '175.50');
    const lineToEdit = edited.items[1]!;
    const editedLine = await clientFinance.updateLine(
      { auth: makerAuth },
      lineToEdit.id,
      { description: 'Variation billing' },
    );
    assert.equal(editedLine.items[1]!.description, 'Variation billing');

    const submitKey = randomUUID();
    const submitted = await clientFinance.submit(
      { auth: makerAuth },
      draft.id,
      clientWorkflow.workflowCode,
      submitKey,
    );
    assert.equal(submitted.state, 'SUBMITTED');
    const submittedReplay = await clientFinance.submit(
      { auth: makerAuth },
      draft.id,
      clientWorkflow.workflowCode,
      submitKey,
    );
    assert.equal(submittedReplay.state, 'SUBMITTED');

    await assert.rejects(
      () => clientFinance.addLine(
        { auth: makerAuth },
        draft.id,
        { description: 'Late mutation', amount: new Decimal('1.00') },
      ),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () => clientFinance.approve(
        { auth: auth(company.id, maker.id, [role.roleCode]) },
        draft.id,
        randomUUID(),
      ),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () => clientFinance.approve(
        { auth: sysAdminAuth },
        draft.id,
        randomUUID(),
      ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const approveKey = randomUUID();
    const approved = await clientFinance.approve(
      { auth: checkerAuth },
      draft.id,
      approveKey,
      'Approved client billing',
    );
    assert.equal(approved.state, 'APPROVED');
    assert.equal(approved.approvalInstance?.approvalState, 'APPROVED');
    assert.doesNotThrow(
      () => JSON.stringify(approved),
      'Client Invoice approval responses must not expose internal BigInt decision-order fields.',
    );
    const retainedApprovedAction = await prisma.approvalAction.findFirstOrThrow({
      where: {
        approvalInstanceId: approved.approvalInstanceId!,
        action: 'APPROVE',
        actionByUserId: checker.id,
      },
      orderBy: [{ actionAt: 'desc' }, { id: 'desc' }],
    });
    assert.equal(approved.approvedByUserId, retainedApprovedAction.actionByUserId);
    assert.equal(approved.approvedAt?.getTime(), retainedApprovedAction.actionAt.getTime());
    assert.equal(approved.decidedAt?.getTime(), retainedApprovedAction.actionAt.getTime());
    const approvedReplay = await clientFinance.approve(
      { auth: checkerAuth },
      draft.id,
      approveKey,
      'Approved client billing',
    );
    assert.equal(approvedReplay.state, 'APPROVED');

    await assert.rejects(
      () => prisma.$executeRawUnsafe(
        'UPDATE "client_invoices" SET "invoice_date" = $1::date WHERE "id" = $2::uuid',
        '2026-10-03',
        draft.id,
      ),
      /CLIENT_INVOICE_HISTORY_IMMUTABLE/,
    );
    await assert.rejects(
      () => prisma.$executeRawUnsafe(
        'UPDATE "client_invoices" SET "approval_instance_id" = NULL WHERE "id" = $1::uuid',
        draft.id,
      ),
      /CLIENT_INVOICE_HISTORY_IMMUTABLE/,
    );
    await assert.rejects(
      () => prisma.$executeRawUnsafe(
        'UPDATE "client_invoices" SET "approved_by_user_id" = $1::uuid WHERE "id" = $2::uuid',
        maker.id,
        draft.id,
      ),
      /CLIENT_INVOICE_HISTORY_IMMUTABLE/,
    );
    await assert.rejects(
      () => prisma.$executeRawUnsafe(
        'DELETE FROM "client_invoices" WHERE "id" = $1::uuid',
        draft.id,
      ),
      /CLIENT_INVOICE_HISTORY_IMMUTABLE/,
    );
    await assert.rejects(
      () => prisma.$executeRawUnsafe(
        'UPDATE "client_invoice_items" SET "client_invoice_id" = $1::uuid WHERE "id" = $2::uuid',
        alternateCustomerDraft.id,
        draft.items[0]!.id,
      ),
      /CLIENT_INVOICE_HISTORY_IMMUTABLE/,
    );
    await assert.rejects(
      () => clientFinance.get(outsiderAuth, draft.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const ar = await clientFinance.accountsReceivable(makerAuth, project.id);
    const arRow = ar.find((row) => row.id === draft.id);
    assert.ok(arRow);
    assert.equal(arRow.allocatedAmount.toFixed(2), '0.00');
    assert.equal(arRow.outstandingAmount.toFixed(2), '175.50');
    await assert.rejects(
      () => clientFinance.accountsReceivable(outsiderAuth, project.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const supplierDraft = await supplierFinance.createInvoice(
      { auth: makerAuth },
      project.id,
      {
        supplierId: supplier.id,
        supplierReference: 'FINB-SUP-' + suffix,
        invoiceDate: new Date('2026-10-02T00:00:00.000Z'),
        dueDate: new Date('2026-10-30T00:00:00.000Z'),
        createKey: randomUUID(),
        lines: [{ description: 'Supplier billing', amount: new Decimal('80.00') }],
      },
    );
    await supplierFinance.submit(
      { auth: makerAuth },
      supplierDraft.id,
      supplierWorkflow.workflowCode,
      randomUUID(),
    );
    await supplierFinance.approve(
      { auth: checkerAuth },
      supplierDraft.id,
      randomUUID(),
      'Approved AP source',
    );
    const ap = await supplierFinance.accountsPayable(makerAuth, project.id);
    const apRow = ap.find((row) => row.id === supplierDraft.id);
    assert.ok(apRow);
    assert.equal(apRow.allocatedAmount.toFixed(2), '0.00');
    assert.equal(apRow.outstandingAmount.toFixed(2), '80.00');
    await assert.rejects(
      () => supplierFinance.accountsPayable(outsiderAuth, project.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const concurrentDraft = await clientFinance.create(
      { auth: makerAuth },
      project.id,
      {
        customerId: customer.id,
        invoiceDate: new Date('2026-10-02T00:00:00.000Z'),
        createKey: randomUUID(),
        lines: [{ description: 'Concurrent billing', amount: new Decimal('20.00') }],
      },
    );
    const concurrentSubmitted = await clientFinance.submit(
      { auth: makerAuth },
      concurrentDraft.id,
      clientWorkflow.workflowCode,
      randomUUID(),
    );
    const decisions = await Promise.allSettled([
      clientFinance.approve(
        { auth: checkerAuth },
        concurrentDraft.id,
        randomUUID(),
        'Concurrent A',
      ),
      clientFinance.approve(
        { auth: checkerAuth },
        concurrentDraft.id,
        randomUUID(),
        'Concurrent B',
      ),
    ]);
    assert.equal(decisions.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(decisions.filter((result) => result.status === 'rejected').length, 1);
    assert.equal(
      await prisma.approvalAction.count({
        where: { approvalInstanceId: concurrentSubmitted.approvalInstanceId! },
      }),
      1,
    );

    await prisma.project.update({
      where: { id: project.id },
      data: { isActive: false },
    });
    const activeClientProjects = await clientFinance.projects(makerAuth);
    assert.equal(
      activeClientProjects.some((item) => item.id === project.id),
      false,
      'Archived Projects must remain unavailable for new Client Invoice setup.',
    );
    const arProjectsAfterArchive = await clientFinance.balanceProjects(makerAuth);
    const archivedArProject = arProjectsAfterArchive.find(
      (item) => item.id === project.id,
    );
    assert.ok(archivedArProject);
    assert.equal(archivedArProject.isActive, false);
    const apProjectsAfterArchive = await supplierFinance.balanceProjects(makerAuth);
    const archivedApProject = apProjectsAfterArchive.find(
      (item) => item.id === project.id,
    );
    assert.ok(archivedApProject);
    assert.equal(archivedApProject.isActive, false);
    const archivedAr = await clientFinance.accountsReceivable(
      makerAuth,
      project.id,
    );
    assert.ok(
      archivedAr.some((row) => row.id === draft.id),
      'Approved receivables must remain visible after Project archival.',
    );
    const archivedAp = await supplierFinance.accountsPayable(
      makerAuth,
      project.id,
    );
    assert.ok(
      archivedAp.some((row) => row.id === supplierDraft.id),
      'Approved payables must remain visible after Project archival.',
    );

    const auditRows = await prisma.auditLog.findMany({
      where: {
        companyId: company.id,
        entityType: 'CLIENT_INVOICE',
        entityId: draft.id,
      },
    });
    assert.ok(auditRows.some((row) => row.action === 'CREATE_DRAFT'));
    assert.ok(auditRows.some((row) => row.action === 'ADD_LINE'));
    assert.ok(auditRows.some((row) => row.action === 'SUBMIT'));
    assert.ok(auditRows.some((row) => row.action === 'APPROVE'));
  } finally {
    await prisma.$disconnect();
  }
});
