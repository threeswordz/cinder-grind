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
    const outsiderEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'FINB-OUT-' + suffix,
        employeeName: 'Finance B Outsider',
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
    const outsider = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: outsiderEmployee.id,
        email: 'finb-outsider-' + suffix + '@example.com',
        displayName: 'Finance B Outsider',
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
          { invoiceDate: new Date('2026-11-01T00:00:00.000Z') },
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
