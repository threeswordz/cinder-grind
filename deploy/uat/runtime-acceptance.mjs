const baseUrl = process.env.UAT_API_BASE_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? '3000'}/api/v1`;
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required.');
}

const suffix = Date.now().toString(36).toUpperCase();
const stepResults = [];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function record(name) {
  stepResults.push(name);
  process.stdout.write(`✓ ${name}\n`);
}

function utcDateOffset(days) {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie');
  check(raw, 'Login response did not set a session cookie.');
  const first = raw.split(';', 1)[0];
  check(first.startsWith('erp_session='), 'Unexpected session cookie.');
  return first;
}

async function readBody(response) {
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return response.json();
  return response.arrayBuffer();
}

async function request(session, path, options = {}) {
  const {
    method = 'GET',
    json,
    body,
    expected = 200,
    csrf = true,
    accept = 'application/json',
  } = options;

  const headers = new Headers({ Accept: accept });
  if (session?.cookie) headers.set('Cookie', session.cookie);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  if (csrf && session?.csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers.set('X-CSRF-Token', session.csrfToken);
  }

  const response = await fetch(baseUrl + path, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : body,
  });

  if (response.status !== expected) {
    let detail = '';
    try {
      detail = JSON.stringify(await response.json());
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(`${method} ${path} expected ${expected}, got ${response.status}: ${detail}`);
  }

  return { response, data: await readBody(response) };
}

async function login(email, password) {
  const response = await fetch(baseUrl + '/auth/login', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  check(response.status === 201 || response.status === 200, `Login failed for ${email}: ${response.status}`);
  const data = await response.json();
  return {
    cookie: cookieFrom(response),
    csrfToken: data.data.csrfToken,
    user: data.data.user,
  };
}

async function logout(session) {
  await request(session, '/auth/logout', { method: 'POST', expected: 204 });
}

const admin = await login(adminEmail, adminPassword);
const me = await request(admin, '/auth/me');
check(me.data.data.email === adminEmail.toLowerCase(), 'Authenticated administrator identity mismatch.');
check(
  !me.data.data.permissions.includes('procurement.pr.cancel'),
  'SYS_ADMIN must not implicitly receive Purchase Request cancellation authority.',
);
check(
  !me.data.data.permissions.includes('procurement.rfq.manage') &&
    !me.data.data.permissions.includes('procurement.quotation.manage') &&
    !me.data.data.permissions.includes('procurement.award.select'),
  'SYS_ADMIN must not implicitly receive Stage C sourcing business authority.',
);
check(
  !me.data.data.permissions.some((permission) =>
    permission.startsWith('procurement.po.'),
  ),
  'SYS_ADMIN must not implicitly receive Purchase Order business authority.',
);
check(
  !me.data.data.permissions.some((permission) =>
    permission.startsWith('finance.supplier_invoice.'),
  ),
  'SYS_ADMIN must not implicitly receive Supplier Invoice Finance authority.',
);
check(
  !me.data.data.permissions.some(
    (permission) =>
      permission.startsWith('finance.client_invoice.') ||
      permission.startsWith('finance.payment.') ||
      permission === 'finance.retention.view' ||
      permission === 'finance.ap.view' ||
      permission === 'finance.ar.view',
  ),
  'SYS_ADMIN must not implicitly receive Client Invoice, Payment or AP/AR Finance authority.',
);
check(
  !me.data.data.permissions.some(
    (permission) =>
      permission.startsWith('subcontracts.claim.') ||
      permission.startsWith('subcontracts.assessment.'),
  ),
  'SYS_ADMIN must not implicitly receive Claim or Assessment business authority.',
);
record('administrator login, current-user endpoint and technical-role business-authority separation');

const status = await request(admin, '/admin/statuses', {
  method: 'POST',
  json: {
    entityType: 'PROJECT',
    statusCode: 'ACTIVE-' + suffix,
    statusLabel: 'Active UAT ' + suffix,
    sortOrder: 10,
  },
  expected: 201,
});
const statusId = status.data.data.id;

const customer = await request(admin, '/master-data/customers', {
  method: 'POST',
  json: {
    customerCode: 'CUST-' + suffix,
    customerName: 'Factory Customer ' + suffix,
  },
  expected: 201,
});
const customerId = customer.data.data.id;

const uom = await request(admin, '/master-data/uoms', {
  method: 'POST',
  json: {
    uomCode: 'EA-' + suffix,
    uomName: 'Each',
    decimalPlaces: 0,
  },
  expected: 201,
});
const uomId = uom.data.data.id;

const material = await request(admin, '/master-data/materials', {
  method: 'POST',
  json: {
    materialCode: 'STEEL-' + suffix,
    materialName: 'Reinforcement Steel',
    materialCategory: 'Steel',
    defaultUomId: uomId,
  },
  expected: 201,
});
check(material.data.data.defaultUomId === uomId, 'Material/UOM relationship mismatch.');

const sourcingSupplierA = await request(admin, '/master-data/suppliers', {
  method: 'POST',
  json: {
    supplierCode: 'SRC-A-' + suffix,
    supplierName: 'Sourcing Supplier A ' + suffix,
    contactName: 'Supplier A Contact',
    email: 'supplier-a-' + suffix.toLowerCase() + '@example.com',
  },
  expected: 201,
});
const sourcingSupplierB = await request(admin, '/master-data/suppliers', {
  method: 'POST',
  json: {
    supplierCode: 'SRC-B-' + suffix,
    supplierName: 'Sourcing Supplier B ' + suffix,
    contactName: 'Supplier B Contact',
    email: 'supplier-b-' + suffix.toLowerCase() + '@example.com',
  },
  expected: 201,
});

const pmEmployee = await request(admin, '/master-data/employees', {
  method: 'POST',
  json: {
    employeeCode: 'PM-' + suffix,
    employeeName: 'Project Manager ' + suffix,
    jobTitle: 'Project Manager',
  },
  expected: 201,
});
const unassignedEmployee = await request(admin, '/master-data/employees', {
  method: 'POST',
  json: {
    employeeCode: 'PE-' + suffix,
    employeeName: 'Unassigned Engineer ' + suffix,
    jobTitle: 'Project Engineer',
  },
  expected: 201,
});
const checkerEmployee = await request(admin, '/master-data/employees', {
  method: 'POST',
  json: {
    employeeCode: 'BA-' + suffix,
    employeeName: 'Baseline Approver ' + suffix,
    jobTitle: 'Project Controls Approver',
  },
  expected: 201,
});
record('master data creation through live HTTP API');

const role = await request(admin, '/admin/roles', {
  method: 'POST',
  json: {
    roleCode: 'UAT_PROJECT_USER_' + suffix,
    roleName: 'UAT Project User ' + suffix,
    description: 'Automated runtime acceptance role',
  },
  expected: 201,
});
const roleId = role.data.data.id;
const permissionCodes = [
  'projects.project.view',
  'projects.project.create',
  'projects.project.edit',
  'projects.team.view',
  'wbs.wbs.view',
  'wbs.wbs.create',
  'wbs.cost_code.view',
  'wbs.cost_code.create',
  'documents.document.view',
  'documents.document.upload',
  'documents.document.link',
  'documents.document.archive',
  'schedule.programme.view',
  'schedule.activity.create',
  'schedule.activity.edit',
  'schedule.activity.archive',
  'schedule.dependency.manage',
  'schedule.calendar.manage',
  'schedule.baseline.create',
  'schedule.baseline.approve',
  'schedule.progress.record',
  'site.daily_report.view',
  'site.daily_report.create',
  'site.daily_report.edit',
  'site.daily_report.submit',
  'equipment.type.view',
  'equipment.type.manage',
  'equipment.equipment.view',
  'equipment.equipment.manage',
  'equipment.assignment.view',
  'equipment.assignment.manage',
  'equipment.usage.view',
  'equipment.usage.create',
  'equipment.usage.edit',
  'inventory.warehouse.view',
  'inventory.warehouse.create',
  'inventory.warehouse.edit',
  'inventory.warehouse.archive',
  'inventory.receipt.view',
  'inventory.receipt.create',
  'inventory.receipt.edit',
  'inventory.receipt.submit',
  'inventory.receipt.reverse',
  'inventory.stock.view',
  'inventory.reservation.view',
  'inventory.reservation.create',
  'inventory.reservation.edit',
  'inventory.reservation.activate',
  'inventory.reservation.release',
  'inventory.issue.view',
  'inventory.issue.create',
  'inventory.issue.edit',
  'inventory.issue.submit',
  'inventory.issue.reverse',
  'inventory.return.view',
  'inventory.return.create',
  'inventory.return.edit',
  'inventory.return.submit',
  'inventory.return.reverse',
  'inventory.transfer.view',
  'inventory.transfer.create',
  'inventory.transfer.edit',
  'inventory.transfer.submit',
  'inventory.transfer.reverse',
  'inventory.report.view',
  'reporting.operational.view',
  'budget.boq.view',
  'budget.boq.manage',
  'budget.revision.view',
  'budget.revision.submit',
  'procurement.pr.view',
  'procurement.pr.manage',
  'procurement.pr.submit',
  'procurement.pr.cancel',
  'procurement.rfq.view',
  'procurement.rfq.manage',
  'procurement.quotation.view',
  'procurement.quotation.manage',
  'procurement.award.select',
  'procurement.po.view',
  'procurement.po.create',
  'procurement.po.edit',
  'procurement.po.submit',
  'procurement.po.cancel',
  'procurement.po.revise',
  'finance.supplier_invoice.view',
  'finance.supplier_invoice.create',
  'finance.supplier_invoice.edit',
  'finance.supplier_invoice.submit',
  'finance.client_invoice.view',
  'finance.client_invoice.create',
  'finance.client_invoice.edit',
  'finance.client_invoice.submit',
  'finance.payment.view',
  'finance.payment.create',
  'finance.payment.edit',
  'finance.payment.submit',
  'finance.payment.cancel',
  'finance.retention.view',
  'finance.ap.view',
  'finance.ar.view',
  'subcontracts.subcontractor.view',
  'subcontracts.subcontractor.manage',
  'subcontracts.subcontractor.archive',
  'subcontracts.agreement.view',
  'subcontracts.agreement.create',
  'subcontracts.agreement.edit',
  'subcontracts.agreement.submit',
  'subcontracts.agreement.approve',
  'subcontracts.agreement.reject',
  'subcontracts.agreement.revise',
  'subcontracts.agreement.cancel',
  'subcontracts.work_order.view',
  'subcontracts.work_order.create',
  'subcontracts.work_order.edit',
  'subcontracts.work_order.submit',
  'subcontracts.work_order.approve',
  'subcontracts.work_order.reject',
  'subcontracts.claim.view',
  'subcontracts.claim.create',
  'subcontracts.claim.edit',
  'subcontracts.claim.submit',
  'subcontracts.claim.withdraw',
  'subcontracts.assessment.view',
  'subcontracts.certification.view',
  'subcontracts.certification.create',
  'subcontracts.certification.edit',
  'subcontracts.certification.submit',
  'subcontracts.certification.approve',
  'subcontracts.variation.view',
  'subcontracts.variation.create',
  'subcontracts.variation.edit',
  'subcontracts.variation.submit',
  'subcontracts.variation.approve',
  'subcontracts.report.view',
];
await request(admin, `/admin/roles/${roleId}/permissions`, {
  method: 'PUT',
  json: { permissionCodes },
});

const checkerRole = await request(admin, '/admin/roles', {
  method: 'POST',
  json: {
    roleCode: 'UAT_BASELINE_APPROVER_' + suffix,
    roleName: 'UAT Baseline Approver ' + suffix,
    description: 'Automated baseline approval role',
  },
  expected: 201,
});
const checkerRoleId = checkerRole.data.data.id;
await request(admin, `/admin/roles/${checkerRoleId}/permissions`, {
  method: 'PUT',
  json: {
    permissionCodes: [
      'schedule.baseline.approve',
      'schedule.programme.view',
      'budget.revision.view',
      'budget.revision.approve',
      'procurement.pr.view',
      'procurement.pr.approve',
      'procurement.quotation.view',
      'procurement.quotation.manage',
      'procurement.po.view',
      'procurement.po.approve',
      'procurement.po.reject',
      'finance.supplier_invoice.view',
      'finance.supplier_invoice.approve',
      'finance.supplier_invoice.reject',
      'finance.client_invoice.view',
      'finance.client_invoice.approve',
      'finance.client_invoice.reject',
      'finance.payment.view',
      'finance.payment.approve',
      'finance.payment.reject',
      'finance.ap.view',
      'finance.ar.view',
      'inventory.receipt.view',
      'inventory.receipt.approve',
      'inventory.issue.view',
      'inventory.issue.approve',
      'inventory.return.view',
      'inventory.return.approve',
      'inventory.transfer.view',
      'inventory.transfer.approve',
      'subcontracts.agreement.view',
      'subcontracts.agreement.approve',
      'subcontracts.agreement.reject',
      'subcontracts.work_order.view',
      'subcontracts.work_order.approve',
      'subcontracts.work_order.reject',
      'subcontracts.claim.view',
      'subcontracts.assessment.view',
      'subcontracts.assessment.assess',
      'subcontracts.assessment.reject',
      'subcontracts.certification.view',
      'subcontracts.certification.approve',
      'subcontracts.certification.reject',
      'subcontracts.certification.reverse',
      'subcontracts.variation.view',
      'subcontracts.variation.approve',
      'subcontracts.variation.reject',
      'subcontracts.variation.reverse',
      'subcontracts.report.view',
    ],
  },
});

const baselineWorkflowCode = 'SCHEDULE_BASELINE_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: baselineWorkflowCode,
    entityType: 'SCHEDULE_BASELINE',
    workflowName: 'Schedule Baseline Approval ' + suffix,
    steps: [
      {
        stepNo: 1,
        stepName: 'Approve Schedule Baseline',
        requiredApprovals: 1,
        roleIds: [checkerRoleId],
      },
    ],
  },
  expected: 201,
});

const budgetWorkflowCode = 'BUDGET_REVISION_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: budgetWorkflowCode,
    entityType: 'BUDGET_REVISION',
    workflowName: 'Budget Revision Approval ' + suffix,
    steps: [
      {
        stepNo: 1,
        stepName: 'Approve Budget Revision',
        requiredApprovals: 1,
        roleIds: [checkerRoleId],
      },
    ],
  },
  expected: 201,
});
await request(admin, '/admin/number-sequences', {
  method: 'POST',
  json: {
    entityType: 'BUDGET_REVISION',
    sequenceCode: 'BUDGET_REVISION',
    formatTemplate: 'BRYY-###',
    resetRule: 'YEARLY',
    startingValue: 1,
  },
  expected: 201,
});

const prWorkflowCode = 'PURCHASE_REQUEST_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: prWorkflowCode,
    entityType: 'PURCHASE_REQUEST',
    workflowName: 'Purchase Request Approval ' + suffix,
    steps: [
      {
        stepNo: 1,
        stepName: 'Approve Purchase Request',
        requiredApprovals: 1,
        roleIds: [checkerRoleId],
      },
    ],
  },
  expected: 201,
});
await request(admin, '/admin/number-sequences', {
  method: 'POST',
  json: {
    entityType: 'PURCHASE_REQUEST',
    sequenceCode: 'PURCHASE_REQUEST',
    formatTemplate: 'PRYYMM-###',
    resetRule: 'MONTHLY',
    startingValue: 1,
  },
  expected: 201,
});
await request(admin, '/admin/number-sequences', {
  method: 'POST',
  json: {
    entityType: 'RFQ',
    sequenceCode: 'RFQ',
    formatTemplate: 'RFQYYMM-###',
    resetRule: 'MONTHLY',
    startingValue: 1,
  },
  expected: 201,
});

const poWorkflowCode = 'PURCHASE_ORDER_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: poWorkflowCode,
    entityType: 'PURCHASE_ORDER',
    workflowName: 'Purchase Order Approval ' + suffix,
    steps: [
      {
        stepNo: 1,
        stepName: 'Approve Purchase Order',
        requiredApprovals: 1,
        roleIds: [checkerRoleId],
      },
    ],
  },
  expected: 201,
});
await request(admin, '/admin/number-sequences', {
  method: 'POST',
  json: {
    entityType: 'PURCHASE_ORDER',
    sequenceCode: 'PURCHASE_ORDER',
    formatTemplate: 'POYYMM-###',
    resetRule: 'MONTHLY',
    startingValue: 1,
  },
  expected: 201,
});
const receiptWorkflowCode = 'GOODS_RECEIPT_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: receiptWorkflowCode,
    entityType: 'GOODS_RECEIPT',
    workflowName: 'Goods Receipt Approval ' + suffix,
    steps: [{
      stepNo: 1,
      stepName: 'Approve Goods Receipt',
      requiredApprovals: 1,
      roleIds: [checkerRoleId],
    }],
  },
  expected: 201,
});
await request(admin, '/admin/number-sequences', {
  method: 'POST',
  json: {
    entityType: 'GOODS_RECEIPT',
    sequenceCode: 'GOODS_RECEIPT',
    formatTemplate: 'GRNYYMM-###',
    resetRule: 'MONTHLY',
    startingValue: 1,
  },
  expected: 201,
});
await request(admin, '/admin/number-sequences', {
  method: 'POST',
  json: {
    entityType: 'MATERIAL_RESERVATION',
    sequenceCode: 'MATERIAL_RESERVATION',
    formatTemplate: 'RSVYYMM-###',
    resetRule: 'MONTHLY',
    startingValue: 1,
  },
  expected: 201,
});
const issueWorkflowCode = 'MATERIAL_ISSUE_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: issueWorkflowCode,
    entityType: 'MATERIAL_ISSUE',
    workflowName: 'Material Issue Approval ' + suffix,
    steps: [{
      stepNo: 1,
      stepName: 'Approve Material Issue',
      requiredApprovals: 1,
      roleIds: [checkerRoleId],
    }],
  },
  expected: 201,
});
await request(admin, '/admin/number-sequences', {
  method: 'POST',
  json: {
    entityType: 'MATERIAL_ISSUE',
    sequenceCode: 'MATERIAL_ISSUE',
    formatTemplate: 'MIYYMM-###',
    resetRule: 'MONTHLY',
    startingValue: 1,
  },
  expected: 201,
});
const returnWorkflowCode = 'MATERIAL_RETURN_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: returnWorkflowCode,
    entityType: 'MATERIAL_RETURN',
    workflowName: 'Material Return Approval ' + suffix,
    steps: [{
      stepNo: 1,
      stepName: 'Approve Material Return',
      requiredApprovals: 1,
      roleIds: [checkerRoleId],
    }],
  },
  expected: 201,
});
await request(admin, '/admin/number-sequences', {
  method: 'POST',
  json: {
    entityType: 'MATERIAL_RETURN',
    sequenceCode: 'MATERIAL_RETURN',
    formatTemplate: 'MRTYYMM-###',
    resetRule: 'MONTHLY',
    startingValue: 1,
  },
  expected: 201,
});

const transferWorkflowCode = 'STOCK_TRANSFER_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: transferWorkflowCode,
    entityType: 'STOCK_TRANSFER',
    workflowName: 'Stock Transfer Approval ' + suffix,
    steps: [{
      stepNo: 1,
      stepName: 'Approve Stock Transfer',
      requiredApprovals: 1,
      roleIds: [checkerRoleId],
    }],
  },
  expected: 201,
});
await request(admin, '/admin/number-sequences', {
  method: 'POST',
  json: {
    entityType: 'STOCK_TRANSFER',
    sequenceCode: 'STOCK_TRANSFER',
    formatTemplate: 'STYYMM-###',
    resetRule: 'MONTHLY',
    startingValue: 1,
  },
  expected: 201,
});

const subcontractAgreementWorkflowCode = 'SUBCONTRACT_AGREEMENT_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: subcontractAgreementWorkflowCode,
    entityType: 'SUBCONTRACT_AGREEMENT',
    workflowName: 'Subcontract Agreement Approval ' + suffix,
    steps: [{
      stepNo: 1,
      stepName: 'Approve Subcontract Agreement',
      requiredApprovals: 1,
      roleIds: [checkerRoleId],
    }],
  },
  expected: 201,
});
const subcontractWorkOrderWorkflowCode = 'SUBCONTRACT_WORK_ORDER_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: subcontractWorkOrderWorkflowCode,
    entityType: 'SUBCONTRACT_WORK_ORDER',
    workflowName: 'Subcontract Work Order Approval ' + suffix,
    steps: [{
      stepNo: 1,
      stepName: 'Approve Subcontract Work Order',
      requiredApprovals: 1,
      roleIds: [checkerRoleId],
    }],
  },
  expected: 201,
});
const subcontractCertificationWorkflowCode =
  'SUBCONTRACT_CERTIFICATION_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: subcontractCertificationWorkflowCode,
    entityType: 'SUBCONTRACT_CERTIFICATION',
    workflowName: 'Subcontract Certification Approval ' + suffix,
    steps: [{
      stepNo: 1,
      stepName: 'Approve Subcontract Certification',
      requiredApprovals: 1,
      roleIds: [checkerRoleId],
    }],
  },
  expected: 201,
});
const subcontractVariationWorkflowCode =
  'SUBCONTRACT_VARIATION_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: subcontractVariationWorkflowCode,
    entityType: 'SUBCONTRACT_VARIATION',
    workflowName: 'Subcontract Variation Approval ' + suffix,
    steps: [{
      stepNo: 1,
      stepName: 'Approve Subcontract Variation',
      requiredApprovals: 1,
      roleIds: [checkerRoleId],
    }],
  },
  expected: 201,
});

const supplierInvoiceWorkflowCode = 'SUPPLIER_INVOICE_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: supplierInvoiceWorkflowCode,
    entityType: 'SUPPLIER_INVOICE',
    workflowName: 'Supplier Invoice Approval ' + suffix,
    steps: [{
      stepNo: 1,
      stepName: 'Approve Supplier Invoice',
      requiredApprovals: 1,
      roleIds: [checkerRoleId],
    }],
  },
  expected: 201,
});

const clientInvoiceWorkflowCode = 'CLIENT_INVOICE_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: clientInvoiceWorkflowCode,
    entityType: 'CLIENT_INVOICE',
    workflowName: 'Client Invoice Approval ' + suffix,
    steps: [{
      stepNo: 1,
      stepName: 'Approve Client Invoice',
      requiredApprovals: 1,
      roleIds: [checkerRoleId],
    }],
  },
  expected: 201,
});

const paymentWorkflowCode = 'PAYMENT_' + suffix;
await request(admin, '/admin/approval-workflows', {
  method: 'POST',
  json: {
    workflowCode: paymentWorkflowCode,
    entityType: 'PAYMENT',
    workflowName: 'Payment Approval ' + suffix,
    steps: [{
      stepNo: 1,
      stepName: 'Approve Payment',
      requiredApprovals: 1,
      roleIds: [checkerRoleId],
    }],
  },
  expected: 201,
});

record('V0.3-A Budget, V0.3-B Purchase Request, V0.3-C RFQ, V0.3-D PO, V0.5-D/E Subcontracts and V0.6-A/B/C Finance approval configuration');

const pmPassword = 'Uat-PM-' + suffix + '-Strong-2026!';
const unassignedPassword = 'Uat-PE-' + suffix + '-Strong-2026!';
const checkerPassword = 'Uat-BA-' + suffix + '-Strong-2026!';
const pmUser = await request(admin, '/admin/users', {
  method: 'POST',
  json: {
    email: `uat-pm-${suffix.toLowerCase()}@example.com`,
    displayName: 'Project Manager ' + suffix,
    password: pmPassword,
    employeeId: pmEmployee.data.data.id,
    roleIds: [roleId],
  },
  expected: 201,
});
const unassignedUser = await request(admin, '/admin/users', {
  method: 'POST',
  json: {
    email: `uat-pe-${suffix.toLowerCase()}@example.com`,
    displayName: 'Unassigned Engineer ' + suffix,
    password: unassignedPassword,
    employeeId: unassignedEmployee.data.data.id,
    roleIds: [roleId],
  },
  expected: 201,
});
const checkerUser = await request(admin, '/admin/users', {
  method: 'POST',
  json: {
    email: `uat-ba-${suffix.toLowerCase()}@example.com`,
    displayName: 'Baseline Approver ' + suffix,
    password: checkerPassword,
    employeeId: checkerEmployee.data.data.id,
    roleIds: [checkerRoleId],
  },
  expected: 201,
});
check(pmUser.data.data.employeeId === pmEmployee.data.data.id, 'Project Manager User/Employee link missing.');
check(unassignedUser.data.data.employeeId === unassignedEmployee.data.data.id, 'Unassigned User/Employee link missing.');
check(checkerUser.data.data.employeeId === checkerEmployee.data.data.id, 'Baseline Approver User/Employee link missing.');
record('roles, permissions, Approval Matrix and Employee-linked Users');

const pm = await login(pmUser.data.data.email, pmPassword);
await request(pm, '/cost-codes', {
  method: 'POST',
  json: { costCode: 'NO-CSRF-' + suffix, costName: 'Must Not Persist' },
  expected: 403,
  csrf: false,
});
record('CSRF rejection on mutation without token');

const project = await request(pm, '/projects', {
  method: 'POST',
  json: {
    projectCode: 'PJ-' + suffix,
    projectName: 'Factory Construction ' + suffix,
    customerId,
    statusDefinitionId: statusId,
    contractValue: '90000000.00',
    location: 'UAT Project Site',
    description: 'Automated V0.1 runtime acceptance project',
    plannedStartDate: '2026-10-01',
    plannedCompletionDate: '2027-09-30',
  },
  expected: 201,
});
const projectId = project.data.data.id;
const projectRead = await request(pm, '/projects/' + projectId);
check(projectRead.data.data.id === projectId, 'Project Manager could not read created Project.');

const members = await request(admin, `/projects/${projectId}/members`);
check(
  members.data.data.some((item) =>
    item.employeeId === pmEmployee.data.data.id &&
    item.projectRole === 'Project Creator' &&
    item.isActive === true
  ),
  'Automatic Project Creator membership was not found.',
);
record('scoped Project creation and automatic Project Creator membership');

await request(admin, `/projects/${projectId}/members`, {
  method: 'POST',
  json: {
    employeeId: checkerEmployee.data.data.id,
    projectRole: 'Baseline Approver',
  },
  expected: 201,
});

const rootWbs = await request(pm, `/wbs/projects/${projectId}`, {
  method: 'POST',
  json: { wbsCode: '01', wbsName: 'Groundworks' },
  expected: 201,
});
const childWbs = await request(pm, `/wbs/projects/${projectId}`, {
  method: 'POST',
  json: {
    parentId: rootWbs.data.data.id,
    wbsCode: '01.01',
    wbsName: 'Ground Floor Slab',
  },
  expected: 201,
});
check(childWbs.data.data.parentId === rootWbs.data.data.id, 'WBS parent/child relationship mismatch.');

const costCode = await request(pm, '/cost-codes', {
  method: 'POST',
  json: { costCode: 'MAT-STEEL-' + suffix, costName: 'Steel Materials' },
  expected: 201,
});
check(costCode.data.data.id, 'Cost Code was not created.');
record('hierarchical WBS and independent Cost Code');

const activityStatus = await request(admin, '/admin/statuses', {
  method: 'POST',
  json: {
    entityType: 'ACTIVITY',
    statusCode: 'PLANNED-' + suffix,
    statusLabel: 'Planned ' + suffix,
    sortOrder: 10,
  },
  expected: 201,
});

const activityType = await request(admin, '/activity-types', {
  method: 'POST',
  json: {
    activityTypeCode: 'WORK-' + suffix,
    activityTypeName: 'Work Activity ' + suffix,
  },
  expected: 201,
});

await request(pm, '/activity-types', {
  method: 'POST',
  json: {
    activityTypeCode: 'DENIED-' + suffix,
    activityTypeName: 'Must Not Persist',
  },
  expected: 403,
});

const calendar = await request(pm, '/working-calendars', {
  method: 'POST',
  json: {
    projectId,
    calendarName: 'Project Calendar ' + suffix,
    timezoneName: 'Asia/Singapore',
    isDefault: true,
  },
  expected: 201,
});
const calendarId = calendar.data.data.id;

await request(pm, `/working-calendars/${calendarId}/weekdays`, {
  method: 'PUT',
  json: {
    weekdays: [
      { weekdayNo: 1, isWorking: true, startTime: '08:00', endTime: '17:00' },
      { weekdayNo: 2, isWorking: true, startTime: '08:00', endTime: '17:00' },
      { weekdayNo: 3, isWorking: true, startTime: '08:00', endTime: '17:00' },
      { weekdayNo: 4, isWorking: true, startTime: '08:00', endTime: '17:00' },
      { weekdayNo: 5, isWorking: true, startTime: '08:00', endTime: '17:00' },
      { weekdayNo: 6, isWorking: false, startTime: null, endTime: null },
      { weekdayNo: 7, isWorking: false, startTime: null, endTime: null },
    ],
  },
});

await request(pm, `/working-calendars/${calendarId}/exceptions`, {
  method: 'PUT',
  json: {
    exceptions: [
      {
        exceptionDate: '2026-12-25',
        isWorkingOverride: false,
        startTime: null,
        endTime: null,
        reason: 'UAT non-working exception',
      },
    ],
  },
});

const activityA = await request(pm, '/activities', {
  method: 'POST',
  json: {
    projectId,
    wbsId: rootWbs.data.data.id,
    activityTypeId: activityType.data.data.id,
    workingCalendarId: calendarId,
    statusDefinitionId: activityStatus.data.data.id,
    activityCode: 'A100-' + suffix,
    activityName: 'Excavation ' + suffix,
    plannedDurationWorkDays: '5',
    plannedStartDate: '2026-10-01',
    plannedFinishDate: '2026-10-05',
    responsibleEmployeeId: pmEmployee.data.data.id,
    ownerUserId: pmUser.data.data.id,
  },
  expected: 201,
});

const activityB = await request(pm, '/activities', {
  method: 'POST',
  json: {
    projectId,
    wbsId: childWbs.data.data.id,
    parentActivityId: activityA.data.data.id,
    activityTypeId: activityType.data.data.id,
    workingCalendarId: calendarId,
    statusDefinitionId: activityStatus.data.data.id,
    activityCode: 'A110-' + suffix,
    activityName: 'Detailed Excavation ' + suffix,
    plannedDurationWorkDays: '2',
    plannedStartDate: '2026-10-01',
    plannedFinishDate: '2026-10-02',
  },
  expected: 201,
});

await request(pm, `/activities/${activityB.data.data.id}`, {
  method: 'PATCH',
  json: { description: 'Updated through standalone Activity UUID route' },
});

const dependency = await request(pm, '/activity-dependencies', {
  method: 'POST',
  json: {
    projectId,
    predecessorActivityId: activityA.data.data.id,
    successorActivityId: activityB.data.data.id,
    dependencyType: 'FS',
    lagWorkDays: '-1',
  },
  expected: 201,
});
check(
  String(dependency.data.data.lagWorkDays) === '-1',
  'Signed dependency lag was not preserved.',
);

const activityList = await request(pm, '/activities?projectId=' + projectId);
check(
  activityList.data.data.length === 2,
  'Project scheduling Activity list did not return the expected records.',
);
record('V0.2-A scheduling data model through live HTTP API');


const plannedSchedule = await request(
  pm,
  '/schedule/projects/' + projectId + '/analysis?mode=planned',
);
check(
  plannedSchedule.data.data.activities.length === 2,
  'Schedule analysis did not return the expected Activities.',
);
const analysedB = plannedSchedule.data.data.activities.find(
  (item) => item.id === activityB.data.data.id,
);
check(
  analysedB?.calculatedStartDate === '2026-10-07',
  'Successor-calendar negative lag did not produce the expected calculated start.',
);
check(
  analysedB?.calculatedFinishDate === '2026-10-08',
  'Working-calendar duration did not produce the expected calculated finish.',
);
check(
  plannedSchedule.data.data.activities.some((item) => item.isCritical === true),
  'Schedule analysis did not identify a critical Activity.',
);

await request(pm, '/activity-dependencies', {
  method: 'POST',
  json: {
    projectId,
    predecessorActivityId: activityB.data.data.id,
    successorActivityId: activityA.data.data.id,
    dependencyType: 'FS',
    lagWorkDays: '0',
  },
  expected: 422,
});
record('V0.2-B scheduling engine through live HTTP API');

const projectActual = await request(pm, '/projects/' + projectId, {
  method: 'PATCH',
  json: {
    actualStartDate: '2026-10-01',
    actualCompletionDate: null,
  },
});
check(
  String(projectActual.data.data.actualStartDate).slice(0, 10) === '2026-10-01',
  'Project actual start date was not stored independently.',
);

const baseline = await request(pm, '/schedule-baselines/submit', {
  method: 'POST',
  json: {
    projectId,
    workflowCode: baselineWorkflowCode,
  },
  expected: 201,
});
check(baseline.data.data.versionNo === 1, 'Initial Schedule Baseline was not Version 1.');
check(
  baseline.data.data.approvalInstance?.approvalState === 'SUBMITTED',
  'Schedule Baseline did not enter approval.',
);

await request(pm, `/schedule-baselines/${baseline.data.data.id}/approve`, {
  method: 'POST',
  json: { comment: 'Maker must not self-approve' },
  expected: 403,
});

const checker = await login(checkerUser.data.data.email, checkerPassword);
const checkerBudgetProjects = await request(
  checker,
  '/budget/revision-projects',
);
check(
  checkerBudgetProjects.data.data.some((item) => item.id === projectId),
  'Revision-only Budget approver Project selector did not expose assigned Project.',
);
await request(checker, '/budget/projects', { expected: 403 });
record('V0.3-A revision-only Budget approver Project selector');

const approvedBaseline = await request(
  checker,
  `/schedule-baselines/${baseline.data.data.id}/approve`,
  {
    method: 'POST',
    json: { comment: 'Automated UAT approval' },
    expected: 201,
  },
);
check(
  approvedBaseline.data.data.approvalInstance?.approvalState === 'APPROVED',
  'Configured baseline approver could not approve the Schedule Baseline.',
);
check(
  approvedBaseline.data.data.isCurrent === true,
  'Approved Schedule Baseline did not become current.',
);

const projectBoq = await request(
  pm,
  '/budget/projects/' + projectId + '/boq',
  {
    method: 'POST',
    json: { boqName: 'Main Contract BOQ ' + suffix },
    expected: 201,
  },
);
const boqId = projectBoq.data.data.id;
const boqSection = await request(pm, '/budget/boqs/' + boqId + '/sections', {
  method: 'POST',
  json: {
    sectionCode: 'A',
    sectionName: 'Groundworks',
    description: 'Ground Floor Slab BOQ section',
    sortOrder: 10,
  },
  expected: 201,
});
const boqItem = await request(pm, '/budget/boqs/' + boqId + '/items', {
  method: 'POST',
  json: {
    sectionId: boqSection.data.data.id,
    itemCode: 'A001',
    description: 'Blinding concrete',
    quantity: '10',
    uomId,
    rate: '25',
    wbsId: rootWbs.data.data.id,
    costCodeId: costCode.data.data.id,
    sortOrder: 10,
  },
  expected: 201,
});
check(
  String(boqItem.data.data.amount) === '250',
  'BOQ Item amount was not derived as quantity × rate.',
);

const budgetDraft1 = await request(
  pm,
  '/budget/projects/' + projectId + '/revisions',
  {
    method: 'POST',
    json: { revisionNote: 'Original Budget' },
    expected: 201,
  },
);
check(
  budgetDraft1.data.data.lifecycleState === 'DRAFT' &&
    budgetDraft1.data.data.revisionNo === 1 &&
    budgetDraft1.data.data.lineCount === 1,
  'First Budget Revision did not start as a one-line Draft snapshot.',
);
check(
  /^BR26-\d{3}$/.test(budgetDraft1.data.data.revisionNumber),
  'Budget Revision business number was not generated from the configured sequence.',
);

await request(pm, '/budget/items/' + boqItem.data.data.id, {
  method: 'PATCH',
  json: { rate: '30' },
});
const draft1Detail = await request(
  pm,
  '/budget/revisions/' + budgetDraft1.data.data.id,
);
check(
  String(draft1Detail.data.data.lines[0]?.amount) === '250',
  'Draft Budget snapshot changed after the working BOQ was edited.',
);

const submittedBudget1 = await request(
  pm,
  '/budget/revisions/' + budgetDraft1.data.data.id + '/submit',
  {
    method: 'POST',
    json: { workflowCode: budgetWorkflowCode },
    expected: 201,
  },
);
check(
  submittedBudget1.data.data.approvalInstance?.approvalState === 'SUBMITTED',
  'Draft Budget Revision did not enter approval.',
);
await request(
  pm,
  '/budget/revisions/' + budgetDraft1.data.data.id + '/approve',
  {
    method: 'POST',
    json: { comment: 'Maker must not self-approve Budget.' },
    expected: 403,
  },
);
const approvedBudget1 = await request(
  checker,
  '/budget/revisions/' + budgetDraft1.data.data.id + '/approve',
  {
    method: 'POST',
    json: { comment: 'Approve Original Budget.' },
    expected: 201,
  },
);
check(
  approvedBudget1.data.data.isOriginal === true &&
    approvedBudget1.data.data.isCurrent === true &&
    approvedBudget1.data.data.approvalInstance?.approvalState === 'APPROVED',
  'First approved Budget did not become both Original and Current.',
);

const budgetSummary1 = await request(
  pm,
  '/budget/projects/' + projectId + '/summary',
);
check(
  String(budgetSummary1.data.data.original?.total) === '250' &&
    String(budgetSummary1.data.data.current?.total) === '250',
  'Original Budget summary was not derived from the first approved revision.',
);

const budgetDraft2 = await request(
  pm,
  '/budget/projects/' + projectId + '/revisions',
  {
    method: 'POST',
    json: { revisionNote: 'Revised Budget' },
    expected: 201,
  },
);
await request(
  pm,
  '/budget/revisions/' + budgetDraft2.data.data.id + '/submit',
  {
    method: 'POST',
    json: { workflowCode: budgetWorkflowCode },
    expected: 201,
  },
);
const approvedBudget2 = await request(
  checker,
  '/budget/revisions/' + budgetDraft2.data.data.id + '/approve',
  {
    method: 'POST',
    json: { comment: 'Approve Revised Budget.' },
    expected: 201,
  },
);
check(
  approvedBudget2.data.data.isOriginal === false &&
    approvedBudget2.data.data.isCurrent === true,
  'Second approved Budget did not become the Current Revised Budget.',
);

const budgetSummary2 = await request(
  pm,
  '/budget/projects/' + projectId + '/summary',
);
check(
  String(budgetSummary2.data.data.original?.total) === '250' &&
    String(budgetSummary2.data.data.current?.total) === '300',
  'Original Budget was overwritten or Current Revised Budget was not updated.',
);
check(
  budgetSummary2.data.data.current?.byWbs?.some(
    (row) =>
      row.wbsId === rootWbs.data.data.id &&
      String(row.amount) === '300',
  ) &&
    budgetSummary2.data.data.current?.byCostCode?.some(
      (row) =>
        row.costCodeId === costCode.data.data.id &&
        String(row.amount) === '300',
    ),
  'Budget WBS / Cost Code summaries did not preserve independent allocations.',
);

const downstreamBudget = await request(
  pm,
  '/budget/projects/' + projectId + '/approved',
);
check(
  downstreamBudget.data.data.id === approvedBudget2.data.data.id &&
    String(downstreamBudget.data.data.lines[0]?.amount) === '300',
  'Approved Budget downstream read model did not return the current approved revision.',
);
record('V0.3-A canonical BOQ, Draft/Approval history, Original/Revised Budget and dimensional reporting');

const checkerProcurementProjects = await request(
  checker,
  '/procurement/projects',
);
check(
  checkerProcurementProjects.data.data.some((item) => item.id === projectId),
  'Purchase Request approver Project selector did not expose assigned Project.',
);

const purchaseRequest = await request(
  pm,
  '/procurement/projects/' + projectId + '/purchase-requests',
  {
    method: 'POST',
    json: { remarks: 'Reinforcement and lifting demand ' + suffix },
    expected: 201,
  },
);
const purchaseRequestId = purchaseRequest.data.data.id;
check(
  /^PR\d{4}-\d{3}$/.test(purchaseRequest.data.data.prNumber) &&
    purchaseRequest.data.data.lifecycleState === 'DRAFT',
  'Purchase Request did not receive the approved immutable business-number format.',
);

const prMaterialLine = await request(
  pm,
  '/procurement/purchase-requests/' + purchaseRequestId + '/lines',
  {
    method: 'POST',
    json: {
      lineType: 'MATERIAL',
      materialId: material.data.data.id,
      quantity: '25',
      uomId,
      wbsId: rootWbs.data.data.id,
      costCodeId: costCode.data.data.id,
      activityId: activityA.data.data.id,
      requiredOnSite: '2026-10-12',
    },
    expected: 201,
  },
);
check(
  prMaterialLine.data.data.lineNo === 1 &&
    prMaterialLine.data.data.lineType === 'MATERIAL',
  'Material Purchase Request line was not created correctly.',
);

const prServiceLine = await request(
  pm,
  '/procurement/purchase-requests/' + purchaseRequestId + '/lines',
  {
    method: 'POST',
    json: {
      lineType: 'SERVICE',
      description: 'Mobile crane service',
      quantity: '2',
      uomId,
      costCodeId: costCode.data.data.id,
      requiredOnSite: '2026-10-13',
    },
    expected: 201,
  },
);
check(
  prServiceLine.data.data.lineNo === 2 &&
    prServiceLine.data.data.materialId === null,
  'Service Purchase Request line incorrectly used a Material reference.',
);

const prDetail = await request(
  pm,
  '/procurement/purchase-requests/' + purchaseRequestId,
);
check(
  prDetail.data.data.lines.length === 2 &&
    prDetail.data.data.lines[0]?.activity?.id === activityA.data.data.id &&
    prDetail.data.data.lines[0]?.requiredOnSite?.slice(0, 10) === '2026-10-12' &&
    prDetail.data.data.lines[0]?.materialCodeSnapshot ===
      material.data.data.materialCode,
  'Purchase Request demand context and Material snapshot were not retained.',
);

const submittedPr = await request(
  pm,
  '/procurement/purchase-requests/' + purchaseRequestId + '/submit',
  {
    method: 'POST',
    json: { workflowCode: prWorkflowCode },
    expected: 201,
  },
);
check(
  submittedPr.data.data.lifecycleState === 'SUBMITTED',
  'Purchase Request did not enter SUBMITTED state.',
);
await request(
  pm,
  '/procurement/purchase-requests/' + purchaseRequestId,
  {
    method: 'PATCH',
    json: { remarks: 'Submitted PR must be immutable.' },
    expected: 409,
  },
);
await request(
  pm,
  '/procurement/purchase-requests/' + purchaseRequestId + '/approve',
  {
    method: 'POST',
    json: { comment: 'Maker must not self-approve PR.' },
    expected: 403,
  },
);
const approvedPr = await request(
  checker,
  '/procurement/purchase-requests/' + purchaseRequestId + '/approve',
  {
    method: 'POST',
    json: { comment: 'Approved Purchase Request.' },
    expected: 201,
  },
);
check(
  approvedPr.data.data.lifecycleState === 'APPROVED',
  'Configured checker could not approve the Purchase Request.',
);

const approvedDemand = await request(
  pm,
  '/procurement/projects/' + projectId + '/approved-demand',
);
check(
  approvedDemand.data.data.some((line) => line.id === prMaterialLine.data.data.id) &&
    approvedDemand.data.data.some((line) => line.id === prServiceLine.data.data.id),
  'V0.3-C approved-demand selector did not expose active approved PR lines.',
);

await request(
  pm,
  '/procurement/projects/' + projectId + '/rfqs',
  {
    method: 'POST',
    json: {
      closingDate: utcDateOffset(-1),
      remarks: 'Past closing date must be rejected ' + suffix,
      lines: [
        {
          purchaseRequestLineId: prMaterialLine.data.data.id,
          quantity: '1',
        },
      ],
    },
    expected: 422,
  },
);

const sourcingRfq = await request(
  pm,
  '/procurement/projects/' + projectId + '/rfqs',
  {
    method: 'POST',
    json: {
      closingDate: utcDateOffset(7),
      remarks: 'Automated supplier sourcing ' + suffix,
      lines: [
        {
          purchaseRequestLineId: prMaterialLine.data.data.id,
          quantity: '10',
        },
        {
          purchaseRequestLineId: prServiceLine.data.data.id,
          quantity: '2',
        },
      ],
    },
    expected: 201,
  },
);
const sourcingRfqId = sourcingRfq.data.data.id;
check(
  /^RFQ\d{4}-\d{3}$/.test(sourcingRfq.data.data.rfqNumber) &&
    sourcingRfq.data.data.lines.length === 2,
  'RFQ did not receive approved immutable numbering and PR-line source traceability.',
);

await request(pm, '/procurement/rfqs/' + sourcingRfqId + '/suppliers', {
  method: 'POST',
  json: { supplierId: sourcingSupplierA.data.data.id },
  expected: 201,
});
await request(pm, '/procurement/rfqs/' + sourcingRfqId + '/suppliers', {
  method: 'POST',
  json: { supplierId: sourcingSupplierB.data.data.id },
  expected: 201,
});

const quotationOnlyProjects = await request(
  checker,
  '/procurement/quotation-projects',
);
check(
  quotationOnlyProjects.data.data.some((item) => item.id === projectId),
  'Quotation-only Project discovery did not expose assigned Project.',
);
await request(checker, '/procurement/rfq-projects', { expected: 403 });
const quotationOnlyRfqs = await request(
  checker,
  '/procurement/projects/' + projectId + '/quotation-rfqs',
);
check(
  quotationOnlyRfqs.data.data.some((item) => item.id === sourcingRfqId),
  'Quotation-only RFQ discovery did not expose the Project RFQ.',
);
await request(checker, '/procurement/rfqs/' + sourcingRfqId, {
  expected: 403,
});
const quotationOnlyDetail = await request(
  checker,
  '/procurement/quotation-rfqs/' + sourcingRfqId,
);
check(
  quotationOnlyDetail.data.data.id === sourcingRfqId &&
    quotationOnlyDetail.data.data.suppliers.length === 2,
  'Quotation-only manager could not load quotation-authorized RFQ detail.',
);

await request(
  checker,
  '/procurement/rfqs/' + sourcingRfqId + '/quotations',
  {
    method: 'POST',
    json: {
      supplierId: sourcingSupplierA.data.data.id,
      supplierReference: 'QA-INVALID-' + suffix,
      quotationDate: '2026-10-08',
      validityDate: '2026-10-01',
    },
    expected: 422,
  },
);

const quotationA = await request(
  checker,
  '/procurement/rfqs/' + sourcingRfqId + '/quotations',
  {
    method: 'POST',
    json: {
      supplierId: sourcingSupplierA.data.data.id,
      supplierReference: 'QA-' + suffix,
      quotationDate: '2026-10-08',
      validityDate: '2026-10-31',
      remarks: 'Supplier A quotation',
    },
    expected: 201,
  },
);
await request(
  checker,
  '/procurement/quotations/' + quotationA.data.data.id,
  {
    method: 'PATCH',
    json: { validityDate: '2026-10-01' },
    expected: 422,
  },
);
await request(
  checker,
  '/procurement/quotations/' + quotationA.data.data.id,
  {
    method: 'PATCH',
    json: { quotationDate: '2026-11-01' },
    expected: 422,
  },
);
record('V0.3-C quotation-only manager access and quotation date validation');

const quotationB = await request(
  pm,
  '/procurement/rfqs/' + sourcingRfqId + '/quotations',
  {
    method: 'POST',
    json: {
      supplierId: sourcingSupplierB.data.data.id,
      supplierReference: 'QB-' + suffix,
      quotationDate: '2026-10-08',
      validityDate: '2026-10-31',
      remarks: 'Supplier B quotation',
    },
    expected: 201,
  },
);

const sourcingRfqDetail = await request(
  pm,
  '/procurement/rfqs/' + sourcingRfqId,
);
const sourcingMaterialLine = sourcingRfqDetail.data.data.lines.find(
  (line) => line.purchaseRequestLineId === prMaterialLine.data.data.id,
);
const sourcingServiceLine = sourcingRfqDetail.data.data.lines.find(
  (line) => line.purchaseRequestLineId === prServiceLine.data.data.id,
);
check(
  sourcingMaterialLine && sourcingServiceLine,
  'RFQ detail did not preserve both source PR lines.',
);

const qaMaterial = await request(
  pm,
  '/procurement/quotations/' +
    quotationA.data.data.id +
    '/lines/' +
    sourcingMaterialLine.id,
  {
    method: 'PUT',
    json: { quantity: '10', unitPrice: '10', remarks: 'A material offer' },
  },
);
const qaService = await request(
  pm,
  '/procurement/quotations/' +
    quotationA.data.data.id +
    '/lines/' +
    sourcingServiceLine.id,
  {
    method: 'PUT',
    json: { quantity: '2', unitPrice: '90', remarks: 'A service offer' },
  },
);
const qbMaterial = await request(
  pm,
  '/procurement/quotations/' +
    quotationB.data.data.id +
    '/lines/' +
    sourcingMaterialLine.id,
  {
    method: 'PUT',
    json: { quantity: '10', unitPrice: '9', remarks: 'B material offer' },
  },
);
await request(
  pm,
  '/procurement/quotations/' +
    quotationB.data.data.id +
    '/lines/' +
    sourcingServiceLine.id,
  {
    method: 'PUT',
    json: { quantity: '2', unitPrice: '110', remarks: 'B service offer' },
  },
);

const sourcingComparison = await request(
  pm,
  '/procurement/rfqs/' + sourcingRfqId + '/comparison',
);
check(
  sourcingComparison.data.data.lines.length === 2 &&
    sourcingComparison.data.data.suppliers.length === 2 &&
    sourcingComparison.data.data.lines
      .find((line) => line.id === sourcingMaterialLine.id)
      ?.offers.some(
        (offer) =>
          offer.supplierId === sourcingSupplierB.data.data.id &&
          String(offer.unitPrice) === '9',
      ),
  'Derived quotation comparison did not reflect canonical Supplier quotation data.',
);

const materialSourcingAward = await request(
  pm,
  '/procurement/rfq-lines/' + sourcingMaterialLine.id + '/award',
  {
    method: 'POST',
    json: {
      supplierQuotationLineId: qbMaterial.data.data.id,
      decisionReason: 'Lower material commercial offer.',
    },
    expected: 201,
  },
);
const serviceSourcingAward = await request(
  pm,
  '/procurement/rfq-lines/' + sourcingServiceLine.id + '/award',
  {
    method: 'POST',
    json: {
      supplierQuotationLineId: qaService.data.data.id,
      decisionReason: 'Selected Supplier A for service value.',
    },
    expected: 201,
  },
);
check(
  materialSourcingAward.data.data.supplierId === sourcingSupplierB.data.data.id &&
    serviceSourcingAward.data.data.supplierId === sourcingSupplierA.data.data.id,
  'Line-level Supplier Award did not support different Suppliers across RFQ lines.',
);

await request(
  pm,
  '/procurement/quotations/' +
    quotationB.data.data.id +
    '/lines/' +
    sourcingMaterialLine.id,
  {
    method: 'PUT',
    json: { quantity: '10', unitPrice: '8' },
    expected: 409,
  },
);

const demandAfterSourcingAward = await request(
  pm,
  '/procurement/projects/' + projectId + '/approved-demand',
);
check(
  String(
    demandAfterSourcingAward.data.data.find(
      (line) => line.id === prMaterialLine.data.data.id,
    )?.awardedQuantity,
  ) === '10' &&
    String(
      demandAfterSourcingAward.data.data.find(
        (line) => line.id === prServiceLine.data.data.id,
      )?.awardedQuantity,
    ) === '2',
  'Approved demand did not derive awarded quantities from line-level Supplier Awards.',
);
record('V0.3-C RFQ, multi-Supplier quotations, derived comparison and split line-level Supplier Awards');

const poProjects = await request(pm, '/procurement/po-projects');
check(
  poProjects.data.data.some((item) => item.id === projectId),
  'Purchase Order Project selector did not expose the assigned Project.',
);

const availablePoAwards = await request(
  pm,
  '/procurement/projects/' + projectId + '/po-awards',
);
check(
  availablePoAwards.data.data.some(
    (item) => item.id === materialSourcingAward.data.data.id,
  ) &&
    availablePoAwards.data.data.some(
      (item) => item.id === serviceSourcingAward.data.data.id,
    ),
  'Purchase Order award selector did not expose unused line-level Supplier Awards.',
);

const purchaseOrder = await request(
  pm,
  '/procurement/projects/' + projectId + '/purchase-orders',
  {
    method: 'POST',
    json: {
      awardIds: [materialSourcingAward.data.data.id],
      remarks: 'Award-backed material Purchase Order ' + suffix,
    },
    expected: 201,
  },
);
const purchaseOrderId = purchaseOrder.data.data.id;
const purchaseOrderNumber = purchaseOrder.data.data.poNumber;
const purchaseOrderLineId = purchaseOrder.data.data.lines[0]?.id;
check(
  /^PO\d{4}-\d{3}$/.test(purchaseOrderNumber) &&
    purchaseOrder.data.data.revisionNo === 0 &&
    purchaseOrder.data.data.supplierId === sourcingSupplierB.data.data.id &&
    purchaseOrder.data.data.lines.length === 1 &&
    purchaseOrder.data.data.lines[0]?.quotationAwardId ===
      materialSourcingAward.data.data.id &&
    purchaseOrder.data.data.lines[0]?.purchaseRequestLineId ===
      prMaterialLine.data.data.id &&
    purchaseOrder.data.data.lines[0]?.rfqId === sourcingRfqId &&
    purchaseOrder.data.data.lines[0]?.supplierQuotationId ===
      quotationB.data.data.id,
  'Purchase Order did not retain immutable numbering, Supplier scope and PR → RFQ → quotation → award traceability.',
);
check(purchaseOrderLineId, 'Purchase Order source line was not created.');

await request(
  pm,
  '/procurement/purchase-requests/' + purchaseRequestId + '/cancel',
  {
    method: 'POST',
    expected: 409,
  },
);
record('V0.3-D active PO dependency prevents source Purchase Request cancellation');

await request(
  pm,
  '/procurement/projects/' + projectId + '/purchase-orders',
  {
    method: 'POST',
    json: {
      awardIds: [materialSourcingAward.data.data.id],
      remarks: 'Duplicate award must be rejected.',
    },
    expected: 409,
  },
);

const poOptions = await request(
  pm,
  '/procurement/projects/' + projectId + '/po-options',
);
check(
  poOptions.data.data.wbs.some((item) => item.id === rootWbs.data.data.id) &&
    poOptions.data.data.costCodes.some(
      (item) => item.id === costCode.data.data.id,
    ),
  'Purchase Order allocation options did not expose active Project WBS and Company Cost Codes.',
);

const initialExpectedDelivery = utcDateOffset(10);
const revisedExpectedDelivery = utcDateOffset(14);
const updatedPoLine = await request(
  pm,
  '/procurement/purchase-order-lines/' + purchaseOrderLineId,
  {
    method: 'PATCH',
    json: {
      quantity: '9',
      unitPrice: '9.5',
      wbsId: rootWbs.data.data.id,
      costCodeId: costCode.data.data.id,
      requiredOnSite: '2026-10-12',
      expectedDelivery: initialExpectedDelivery,
      remarks: 'Confirmed first delivery date.',
    },
  },
);
check(
  String(updatedPoLine.data.data.amount) === '85.5' &&
    updatedPoLine.data.data.expectedDelivery?.slice(0, 10) ===
      initialExpectedDelivery,
  'Draft Purchase Order line did not derive amount or retain Expected Delivery.',
);

const submittedPo = await request(
  pm,
  '/procurement/purchase-orders/' + purchaseOrderId + '/submit',
  {
    method: 'POST',
    json: { workflowCode: poWorkflowCode },
    expected: 201,
  },
);
check(
  submittedPo.data.data.lifecycleState === 'SUBMITTED',
  'Purchase Order did not enter SUBMITTED state.',
);
await request(
  pm,
  '/procurement/purchase-orders/' + purchaseOrderId + '/approve',
  {
    method: 'POST',
    json: { comment: 'Maker must not self-approve PO.' },
    expected: 403,
  },
);
const approvedPo = await request(
  checker,
  '/procurement/purchase-orders/' + purchaseOrderId + '/approve',
  {
    method: 'POST',
    json: { comment: 'Approved Purchase Order.' },
    expected: 201,
  },
);
check(
  approvedPo.data.data.lifecycleState === 'APPROVED' &&
    approvedPo.data.data.lines[0]?.expectedDelivery?.slice(0, 10) ===
      initialExpectedDelivery,
  'Configured checker could not approve the Purchase Order or delivery date was not retained.',
);
await request(
  pm,
  '/procurement/purchase-order-lines/' + purchaseOrderLineId,
  {
    method: 'PATCH',
    json: { unitPrice: '10' },
    expected: 409,
  },
);

const revisedPo = await request(
  pm,
  '/procurement/purchase-orders/' + purchaseOrderId + '/revise',
  {
    method: 'POST',
    json: { revisionReason: 'Supplier delivery and commercial revision.' },
    expected: 201,
  },
);
const revisedPoId = revisedPo.data.data.id;
check(
  revisedPo.data.data.poNumber === purchaseOrderNumber &&
    revisedPo.data.data.revisionNo === 1 &&
    revisedPo.data.data.previousRevisionId === purchaseOrderId &&
    revisedPo.data.data.lifecycleState === 'DRAFT',
  'Purchase Order revision did not preserve the stable PO identity and prior revision link.',
);

const revisedPoDetail = await request(
  pm,
  '/procurement/purchase-orders/' + revisedPoId,
);
const revisedPoLineId = revisedPoDetail.data.data.lines[0]?.id;
check(
  revisedPoDetail.data.data.lines.length === 1 &&
    revisedPoDetail.data.data.lines[0]?.quotationAwardId ===
      materialSourcingAward.data.data.id,
  'Purchase Order revision did not preserve source traceability.',
);
check(revisedPoLineId, 'Revised Purchase Order line was not created.');

await request(
  pm,
  '/procurement/purchase-order-lines/' + revisedPoLineId,
  {
    method: 'PATCH',
    json: {
      unitPrice: '9.75',
      expectedDelivery: revisedExpectedDelivery,
    },
  },
);
await request(
  pm,
  '/procurement/purchase-orders/' + revisedPoId + '/submit',
  {
    method: 'POST',
    json: { workflowCode: poWorkflowCode },
    expected: 201,
  },
);
const approvedPoRevision = await request(
  checker,
  '/procurement/purchase-orders/' + revisedPoId + '/approve',
  {
    method: 'POST',
    json: { comment: 'Approved PO revision.' },
    expected: 201,
  },
);
check(
  approvedPoRevision.data.data.lifecycleState === 'APPROVED' &&
    approvedPoRevision.data.data.lines[0]?.unitPrice === '9.75' &&
    approvedPoRevision.data.data.lines[0]?.expectedDelivery?.slice(0, 10) ===
      revisedExpectedDelivery,
  'Purchase Order revised commercial values or Expected Delivery were not approved correctly.',
);

const poHistory = await request(
  pm,
  '/procurement/purchase-orders/' + revisedPoId + '/revisions',
);
check(
  poHistory.data.data.length === 2 &&
    poHistory.data.data[0]?.revisionNo === 0 &&
    poHistory.data.data[0]?.lifecycleState === 'APPROVED' &&
    poHistory.data.data[1]?.revisionNo === 1 &&
    poHistory.data.data[1]?.lifecycleState === 'APPROVED',
  'Purchase Order revision history did not preserve both approved versions.',
);
const originalPoAfterRevision = await request(
  pm,
  '/procurement/purchase-orders/' + purchaseOrderId,
);
check(
  originalPoAfterRevision.data.data.lines[0]?.unitPrice === '9.5' &&
    originalPoAfterRevision.data.data.lines[0]?.expectedDelivery?.slice(0, 10) ===
      initialExpectedDelivery,
  'Earlier approved Purchase Order revision was modified by a later revision.',
);

const receiptStore = await request(pm, '/inventory/warehouses', {
  method: 'POST',
  json: {
    warehouseCode: 'GRN-WH-' + suffix,
    warehouseName: 'Goods Receipt Store ' + suffix,
    projectId,
    isSiteWarehouse: true,
  },
  expected: 201,
});
const receiptWarehouseId = receiptStore.data.data.id;
const eligibleReceiptPos = await request(
  pm, '/inventory/projects/' + projectId + '/eligible-receipt-pos',
);
check(
  eligibleReceiptPos.data.data.some((item) =>
    item.id === revisedPoId && item.lines.some((line) => line.id === revisedPoLineId)
  ),
  'Current approved PO material line was not eligible for Goods Receipt.',
);
const unassignedReceipt = await login(unassignedUser.data.data.email, unassignedPassword);
await request(
  unassignedReceipt, '/inventory/projects/' + projectId + '/eligible-receipt-pos',
  { expected: 403 },
);
const makeReceipt = async (quantity) => request(pm, '/inventory/goods-receipts', {
  method: 'POST',
  json: {
    projectId,
    purchaseOrderId: revisedPoId,
    warehouseId: receiptWarehouseId,
    lines: [{ purchaseOrderLineId: revisedPoLineId, quantity }],
  },
  expected: 201,
});
const receiptA = await makeReceipt('2');
check(/^GRN\d{4}-\d{3}$/.test(receiptA.data.data.receiptNumber), 'Goods Receipt numbering format mismatch.');
const receiptAId = receiptA.data.data.id;
const receiptADraft = await request(pm, '/inventory/goods-receipts/' + receiptAId);
await request(pm, '/inventory/goods-receipt-items/' + receiptADraft.data.data.items[0].id, {
  method: 'PATCH', json: { quantity: '3' },
});
await request(pm, '/inventory/goods-receipts/' + receiptAId, {
  method: 'PATCH', json: { remarks: 'Confirmed three units delivered' },
});
await request(pm, '/inventory/goods-receipts/' + receiptAId + '/submit', {
  method: 'POST', json: { workflowCode: receiptWorkflowCode }, expected: 201,
});
await request(pm, '/inventory/goods-receipts/' + receiptAId + '/approve', {
  method: 'POST', json: { postKey: 'post-a-' + suffix }, expected: 403,
});
const postedA = await request(checker, '/inventory/goods-receipts/' + receiptAId + '/approve', {
  method: 'POST', json: { postKey: 'post-a-' + suffix }, expected: 201,
});
check(
  postedA.data.data.postedAt &&
    postedA.data.data.stockTransactions.length === 1 &&
    String(postedA.data.data.stockTransactions[0]?.quantity) === '3',
  'First partial receipt did not atomically create one positive ledger effect.',
);
const postedARetry = await request(checker, '/inventory/goods-receipts/' + receiptAId + '/approve', {
  method: 'POST', json: { postKey: 'post-a-' + suffix }, expected: 201,
});
check(postedARetry.data.data.stockTransactions.length === 1, 'Posting retry duplicated stock effect.');

const financeProjects = await request(pm, '/finance/projects');
check(
  financeProjects.data.data.some((item) => item.id === projectId),
  'V0.6-A Finance Project selector did not expose the assigned Project.',
);
const unassignedFinanceProjects = await request(
  unassignedReceipt,
  '/finance/projects',
);
check(
  !unassignedFinanceProjects.data.data.some((item) => item.id === projectId),
  'V0.6-A Finance Project selector exposed an unauthorized Project.',
);

const financeOptions = await request(
  pm,
  '/finance/projects/' + projectId + '/supplier-invoice-options',
);
const receiptAItemId = receiptADraft.data.data.items[0]?.id;
check(receiptAItemId, 'V0.6-A source Goods Receipt item was not available.');
check(
  financeOptions.data.data.baseCurrencyCode === 'SGD' &&
    financeOptions.data.data.purchaseOrderLines.some(
      (line) => line.id === revisedPoLineId,
    ) &&
    financeOptions.data.data.goodsReceiptItems.some(
      (item) => item.id === receiptAItemId,
    ),
  'V0.6-A source options did not expose Company base currency and current same-Project PO/GR sources.',
);

const supplierInvoiceCreateKey = 'si-create-' + suffix;
const supplierInvoicePayload = {
  supplierId: sourcingSupplierB.data.data.id,
  supplierReference: 'SUP-INV-' + suffix,
  invoiceDate: '2026-10-01',
  dueDate: '2026-10-31',
  createKey: supplierInvoiceCreateKey,
  lines: [{
    description: 'Three delivered reinforcement units',
    amount: '29.25',
    purchaseOrderLineId: revisedPoLineId,
    goodsReceiptItemId: receiptAItemId,
    wbsId: rootWbs.data.data.id,
    costCodeId: costCode.data.data.id,
  }],
};
const supplierInvoice = await request(
  pm,
  '/finance/projects/' + projectId + '/supplier-invoices',
  {
    method: 'POST',
    json: supplierInvoicePayload,
    expected: 201,
  },
);
const supplierInvoiceId = supplierInvoice.data.data.id;
check(
  /^SI2610-\d{3}$/.test(supplierInvoice.data.data.supplierInvoiceNumber) &&
    supplierInvoice.data.data.state === 'DRAFT' &&
    supplierInvoice.data.data.currencyCode === 'SGD' &&
    String(supplierInvoice.data.data.totalAmount) === '29.25' &&
    supplierInvoice.data.data.projectId === projectId &&
    supplierInvoice.data.data.items[0]?.purchaseOrderLineId === revisedPoLineId &&
    supplierInvoice.data.data.items[0]?.goodsReceiptItemId === receiptAItemId,
  'V0.6-A Supplier Invoice Draft did not retain numbering, one-Project scope, base currency, total and PO/GR lineage.',
);
const supplierInvoiceRetry = await request(
  pm,
  '/finance/projects/' + projectId + '/supplier-invoices',
  {
    method: 'POST',
    json: supplierInvoicePayload,
    expected: 201,
  },
);
check(
  supplierInvoiceRetry.data.data.id === supplierInvoiceId,
  'V0.6-A stable create retry duplicated the Supplier Invoice.',
);

await request(
  pm,
  '/finance/projects/' + projectId + '/supplier-invoices',
  {
    method: 'POST',
    json: {
      ...supplierInvoicePayload,
      supplierId: sourcingSupplierA.data.data.id,
      supplierReference: 'CROSS-SUP-' + suffix,
      createKey: 'si-cross-supplier-' + suffix,
    },
    expected: 422,
  },
);
await request(
  unassignedReceipt,
  '/finance/projects/' + projectId + '/supplier-invoices',
  { expected: 403 },
);
await request(
  unassignedReceipt,
  '/finance/supplier-invoices/' + supplierInvoiceId,
  { expected: 403 },
);

const submittedSupplierInvoice = await request(
  pm,
  '/finance/supplier-invoices/' + supplierInvoiceId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: supplierInvoiceWorkflowCode,
      actionKey: 'si-submit-' + suffix,
    },
    expected: 201,
  },
);
check(
  submittedSupplierInvoice.data.data.state === 'SUBMITTED' &&
    submittedSupplierInvoice.data.data.approvalInstance?.approvalState ===
      'SUBMITTED',
  'V0.6-A Supplier Invoice did not enter configured approval.',
);
await request(
  pm,
  '/finance/supplier-invoices/' + supplierInvoiceId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'si-maker-approve-' + suffix,
      comment: 'Maker must not self-approve.',
    },
    expected: 403,
  },
);
const supplierInvoiceApprovalKey = 'si-approve-' + suffix;
const approvedSupplierInvoice = await request(
  checker,
  '/finance/supplier-invoices/' + supplierInvoiceId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: supplierInvoiceApprovalKey,
      comment: 'Configured Finance checker approval.',
    },
    expected: 201,
  },
);
check(
  approvedSupplierInvoice.data.data.state === 'APPROVED' &&
    approvedSupplierInvoice.data.data.approvalInstance?.approvalState ===
      'APPROVED' &&
    approvedSupplierInvoice.data.data.items[0]?.purchaseOrderLineId ===
      revisedPoLineId &&
    approvedSupplierInvoice.data.data.items[0]?.goodsReceiptItemId ===
      receiptAItemId,
  'V0.6-A Supplier Invoice approval did not retain PO/GR source history.',
);
const replayedSupplierInvoiceApproval = await request(
  checker,
  '/finance/supplier-invoices/' + supplierInvoiceId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: supplierInvoiceApprovalKey,
      comment: 'Configured Finance checker approval.',
    },
    expected: 201,
  },
);
check(
  replayedSupplierInvoiceApproval.data.data.state === 'APPROVED',
  'V0.6-A stable approval retry did not return the retained approved record.',
);

await request(
  pm,
  '/finance/supplier-invoices/' + supplierInvoiceId,
  {
    method: 'PATCH',
    json: { supplierReference: 'MUTATION-MUST-FAIL-' + suffix },
    expected: 409,
  },
);

const rejectedSupplierInvoiceDraft = await request(
  pm,
  '/finance/projects/' + projectId + '/supplier-invoices',
  {
    method: 'POST',
    json: {
      ...supplierInvoicePayload,
      supplierReference: 'SUP-INV-REJECT-' + suffix,
      createKey: 'si-create-reject-' + suffix,
    },
    expected: 201,
  },
);
const rejectedSupplierInvoiceId = rejectedSupplierInvoiceDraft.data.data.id;
await request(
  pm,
  '/finance/supplier-invoices/' + rejectedSupplierInvoiceId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: supplierInvoiceWorkflowCode,
      actionKey: 'si-submit-reject-' + suffix,
    },
    expected: 201,
  },
);
const rejectedSupplierInvoice = await request(
  checker,
  '/finance/supplier-invoices/' + rejectedSupplierInvoiceId + '/reject',
  {
    method: 'POST',
    json: {
      actionKey: 'si-reject-' + suffix,
      comment: 'Live HTTP rejection acceptance reason.',
    },
    expected: 201,
  },
);
check(
  rejectedSupplierInvoice.data.data.state === 'REJECTED' &&
    rejectedSupplierInvoice.data.data.approvalInstance?.approvalState ===
      'REJECTED' &&
    rejectedSupplierInvoice.data.data.rejectionReason ===
      'Live HTTP rejection acceptance reason.',
  'V0.6-A Supplier Invoice live HTTP rejection did not retain rejected state and reason.',
);

const poInvoiceTrace = await request(
  pm,
  '/finance/purchase-order-lines/' + revisedPoLineId + '/supplier-invoices',
);
check(
  poInvoiceTrace.data.data.some((invoice) => invoice.id === supplierInvoiceId),
  'V0.6-A PO source did not forward-trace to its Supplier Invoice.',
);
const grInvoiceTrace = await request(
  pm,
  '/finance/goods-receipt-items/' + receiptAItemId + '/supplier-invoices',
);
check(
  grInvoiceTrace.data.data.some((invoice) => invoice.id === supplierInvoiceId),
  'V0.6-A Goods Receipt source did not forward-trace to its Supplier Invoice.',
);
await request(
  unassignedReceipt,
  '/finance/purchase-order-lines/' + revisedPoLineId + '/supplier-invoices',
  { expected: 403 },
);
record('V0.6-A Supplier Invoice Draft → PO/GR lineage → submit → configured maker-checker approval/rejection → immutable retained history → source forward trace → unauthorized Project denial');

const clientWorkflowOptions = await request(
  pm,
  '/finance/client-invoice-workflow-options',
);
check(
  clientWorkflowOptions.data.data.some(
    (workflow) => workflow.workflowCode === clientInvoiceWorkflowCode,
  ),
  'V0.6-B Client Invoice workflow options did not expose the configured workflow.',
);

const clientInvoiceOptions = await request(
  pm,
  '/finance/projects/' + projectId + '/client-invoice-options',
);
check(
  clientInvoiceOptions.data.data.baseCurrencyCode === 'SGD' &&
    clientInvoiceOptions.data.data.customers.some(
      (item) => item.id === customerId,
    ),
  'V0.6-B Client Invoice options did not expose Company base currency and valid same-Company Customer.',
);

const clientInvoicePayload = {
  customerId,
  invoiceDate: '2026-10-02',
  dueDate: '2026-11-02',
  createKey: 'ci-create-' + suffix,
  lines: [{
    description: 'Generic Project billing',
    amount: '500.00',
  }],
};
await request(
  pm,
  '/finance/projects/' + projectId + '/client-invoices',
  {
    method: 'POST',
    json: {
      ...clientInvoicePayload,
      createKey: 'ci-no-csrf-' + suffix,
    },
    expected: 403,
    csrf: false,
  },
);
const clientInvoice = await request(
  pm,
  '/finance/projects/' + projectId + '/client-invoices',
  {
    method: 'POST',
    json: clientInvoicePayload,
    expected: 201,
  },
);
const clientInvoiceId = clientInvoice.data.data.id;
check(
  /^CI2610-\d{3}$/.test(clientInvoice.data.data.clientInvoiceNumber) &&
    clientInvoice.data.data.state === 'DRAFT' &&
    clientInvoice.data.data.currencyCode === 'SGD' &&
    clientInvoice.data.data.projectId === projectId &&
    clientInvoice.data.data.customerId === customerId &&
    String(clientInvoice.data.data.totalAmount) === '500',
  'V0.6-B Client Invoice Draft did not retain CIYYMM-### identity, Project/Customer scope, base currency and line total.',
);
const clientInvoiceRetry = await request(
  pm,
  '/finance/projects/' + projectId + '/client-invoices',
  {
    method: 'POST',
    json: clientInvoicePayload,
    expected: 201,
  },
);
check(
  clientInvoiceRetry.data.data.id === clientInvoiceId,
  'V0.6-B stable Client Invoice create retry duplicated the invoice.',
);

const updatedClientInvoice = await request(
  pm,
  '/finance/client-invoices/' + clientInvoiceId,
  {
    method: 'PATCH',
    json: { dueDate: '2026-11-15' },
  },
);
check(
  updatedClientInvoice.data.data.dueDate?.slice(0, 10) === '2026-11-15',
  'V0.6-B Client Invoice Draft header edit was not retained.',
);
const clientInvoiceLine = await request(
  pm,
  '/finance/client-invoices/' + clientInvoiceId + '/items',
  {
    method: 'POST',
    json: {
      description: 'Approved variation billing',
      amount: '100.00',
    },
    expected: 201,
  },
);
const clientInvoiceLineId = clientInvoiceLine.data.data.items.find(
  (item) => item.lineNo === 2,
)?.id;
check(clientInvoiceLineId, 'V0.6-B Client Invoice Draft line add did not return the new line.');
const editedClientInvoiceLine = await request(
  pm,
  '/finance/client-invoice-items/' + clientInvoiceLineId,
  {
    method: 'PATCH',
    json: {
      description: 'Generic variation billing',
      amount: '125.00',
    },
  },
);
check(
  String(editedClientInvoiceLine.data.data.totalAmount) === '625' &&
    editedClientInvoiceLine.data.data.items.some(
      (item) =>
        item.id === clientInvoiceLineId &&
        item.description === 'Generic variation billing' &&
        String(item.amount) === '125',
    ),
  'V0.6-B Client Invoice Draft line edit did not retain the updated amount and derived total.',
);

const clientInvoiceList = await request(
  pm,
  '/finance/projects/' + projectId + '/client-invoices',
);
check(
  clientInvoiceList.data.data.some((item) => item.id === clientInvoiceId),
  'V0.6-B Project Client Invoice list did not expose the Draft invoice.',
);
await request(
  unassignedReceipt,
  '/finance/projects/' + projectId + '/client-invoices',
  { expected: 403 },
);
await request(
  unassignedReceipt,
  '/finance/client-invoices/' + clientInvoiceId,
  { expected: 403 },
);
await request(
  admin,
  '/finance/client-invoices/' + clientInvoiceId,
  { expected: 403 },
);

const submittedClientInvoice = await request(
  pm,
  '/finance/client-invoices/' + clientInvoiceId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: clientInvoiceWorkflowCode,
      actionKey: 'ci-submit-' + suffix,
    },
    expected: 201,
  },
);
check(
  submittedClientInvoice.data.data.state === 'SUBMITTED' &&
    submittedClientInvoice.data.data.approvalInstance?.approvalState ===
      'SUBMITTED',
  'V0.6-B Client Invoice did not enter configured approval.',
);
await request(
  pm,
  '/finance/client-invoices/' + clientInvoiceId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'ci-maker-approve-' + suffix,
      comment: 'Maker must not self-approve.',
    },
    expected: 403,
  },
);
const clientInvoiceApproveKey = 'ci-approve-' + suffix;
const approvedClientInvoice = await request(
  checker,
  '/finance/client-invoices/' + clientInvoiceId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: clientInvoiceApproveKey,
      comment: 'Configured Finance checker approval.',
    },
    expected: 201,
  },
);
check(
  approvedClientInvoice.data.data.state === 'APPROVED' &&
    approvedClientInvoice.data.data.approvalInstance?.approvalState ===
      'APPROVED' &&
    String(approvedClientInvoice.data.data.totalAmount) === '625',
  'V0.6-B Client Invoice approval did not retain the approved total and history.',
);
const replayedClientInvoiceApproval = await request(
  checker,
  '/finance/client-invoices/' + clientInvoiceId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: clientInvoiceApproveKey,
      comment: 'Configured Finance checker approval.',
    },
    expected: 201,
  },
);
check(
  replayedClientInvoiceApproval.data.data.state === 'APPROVED',
  'V0.6-B stable Client Invoice approval retry did not return retained approved history.',
);
await request(
  pm,
  '/finance/client-invoices/' + clientInvoiceId,
  {
    method: 'PATCH',
    json: { dueDate: '2026-12-01' },
    expected: 409,
  },
);

const accountsReceivable = await request(
  pm,
  '/finance/projects/' + projectId + '/accounts-receivable',
);
const clientReceivable = accountsReceivable.data.data.find(
  (item) => item.id === clientInvoiceId,
);
check(
  clientReceivable &&
    String(clientReceivable.allocatedAmount) === '0' &&
    String(clientReceivable.outstandingAmount) === '625',
  'V0.6-B derived AR did not expose the approved Client Invoice outstanding balance.',
);
const accountsPayable = await request(
  pm,
  '/finance/projects/' + projectId + '/accounts-payable',
);
const supplierPayable = accountsPayable.data.data.find(
  (item) => item.id === supplierInvoiceId,
);
check(
  supplierPayable &&
    String(supplierPayable.allocatedAmount) === '0' &&
    String(supplierPayable.outstandingAmount) === '29.25',
  'V0.6-B derived AP did not expose the approved Supplier Invoice outstanding balance.',
);
await request(
  unassignedReceipt,
  '/finance/projects/' + projectId + '/accounts-receivable',
  { expected: 403 },
);
await request(
  unassignedReceipt,
  '/finance/projects/' + projectId + '/accounts-payable',
  { expected: 403 },
);

const rejectedClientInvoiceDraft = await request(
  pm,
  '/finance/projects/' + projectId + '/client-invoices',
  {
    method: 'POST',
    json: {
      customerId,
      invoiceDate: '2026-10-02',
      dueDate: '2026-11-02',
      createKey: 'ci-reject-create-' + suffix,
      lines: [{
        description: 'Rejected generic billing',
        amount: '50.00',
      }],
    },
    expected: 201,
  },
);
await request(
  pm,
  '/finance/client-invoices/' + rejectedClientInvoiceDraft.data.data.id + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: clientInvoiceWorkflowCode,
      actionKey: 'ci-reject-submit-' + suffix,
    },
    expected: 201,
  },
);
const rejectedClientInvoice = await request(
  checker,
  '/finance/client-invoices/' + rejectedClientInvoiceDraft.data.data.id + '/reject',
  {
    method: 'POST',
    json: {
      actionKey: 'ci-reject-' + suffix,
      comment: 'Live HTTP Client Invoice rejection reason.',
    },
    expected: 201,
  },
);
check(
  rejectedClientInvoice.data.data.state === 'REJECTED' &&
    rejectedClientInvoice.data.data.approvalInstance?.approvalState ===
      'REJECTED' &&
    rejectedClientInvoice.data.data.rejectionReason ===
      'Live HTTP Client Invoice rejection reason.',
  'V0.6-B Client Invoice rejection did not retain rejected state and reason.',
);
record('V0.6-B Client Invoice Draft/edit → configured maker-checker approval/rejection → derived AP/AR → CSRF and unauthorized Project denial through live HTTP API');

const paymentWorkflowOptions = await request(pm, '/finance/payment-workflow-options');
check(
  paymentWorkflowOptions.data.data.some(
    (workflow) => workflow.workflowCode === paymentWorkflowCode,
  ),
  'V0.6-C Payment workflow options did not expose the configured workflow.',
);
const paymentOptions = await request(
  pm,
  '/finance/projects/' + projectId + '/payment-options',
);
check(
  paymentOptions.data.data.baseCurrencyCode === 'SGD' &&
    paymentOptions.data.data.supplierInvoices.some(
      (invoice) => invoice.id === supplierInvoiceId,
    ) &&
    paymentOptions.data.data.clientInvoices.some(
      (invoice) => invoice.id === clientInvoiceId,
    ),
  'V0.6-C Payment options did not expose same-Project approved settlement targets.',
);
await request(admin, '/finance/payment-projects', { expected: 403 });

const outboundPaymentPayload = {
  direction: 'OUTBOUND',
  paymentDate: '2026-10-03',
  supplierId: sourcingSupplierB.data.data.id,
  amount: '20.00',
  paymentMethod: 'BANK_TRANSFER',
  reference: 'Supplier settlement ' + suffix,
  createKey: 'pay-out-create-' + suffix,
};
await request(
  pm,
  '/finance/projects/' + projectId + '/payments',
  {
    method: 'POST',
    json: {
      ...outboundPaymentPayload,
      createKey: 'pay-no-csrf-' + suffix,
    },
    expected: 403,
    csrf: false,
  },
);
const outboundPayment = await request(
  pm,
  '/finance/projects/' + projectId + '/payments',
  {
    method: 'POST',
    json: outboundPaymentPayload,
    expected: 201,
  },
);
const outboundPaymentId = outboundPayment.data.data.id;
check(
  /^PAY2610-\d{3}$/.test(outboundPayment.data.data.paymentNumber) &&
    outboundPayment.data.data.projectId === projectId &&
    outboundPayment.data.data.paymentDirection === 'OUTBOUND' &&
    outboundPayment.data.data.supplierId === sourcingSupplierB.data.data.id &&
    outboundPayment.data.data.state === 'DRAFT' &&
    outboundPayment.data.data.currencyCode === 'SGD' &&
    String(outboundPayment.data.data.amount) === '20',
  'V0.6-C outbound Payment did not retain stable identity, Project, direction, counterparty, base currency and amount.',
);
const outboundPaymentRetry = await request(
  pm,
  '/finance/projects/' + projectId + '/payments',
  {
    method: 'POST',
    json: outboundPaymentPayload,
    expected: 201,
  },
);
check(
  outboundPaymentRetry.data.data.id === outboundPaymentId,
  'V0.6-C stable Payment create retry duplicated the Payment.',
);
await request(
  unassignedReceipt,
  '/finance/projects/' + projectId + '/payments',
  { expected: 403 },
);
await request(
  unassignedReceipt,
  '/finance/payments/' + outboundPaymentId,
  { expected: 403 },
);

const supplierAllocationKey = 'pay-out-alloc-' + suffix;
const outboundAllocated = await request(
  pm,
  '/finance/payments/' + outboundPaymentId + '/allocations',
  {
    method: 'POST',
    json: {
      targetType: 'SUPPLIER_INVOICE',
      targetId: supplierInvoiceId,
      amount: '20.00',
      actionKey: supplierAllocationKey,
    },
    expected: 201,
  },
);
check(
  outboundAllocated.data.data.supplierAllocations.length === 1 &&
    String(outboundAllocated.data.data.supplierAllocations[0]?.allocatedAmount) ===
      '20',
  'V0.6-C supplier allocation was not retained on the Draft Payment.',
);
const outboundAllocationReplay = await request(
  pm,
  '/finance/payments/' + outboundPaymentId + '/allocations',
  {
    method: 'POST',
    json: {
      targetType: 'SUPPLIER_INVOICE',
      targetId: supplierInvoiceId,
      amount: '20.00',
      actionKey: supplierAllocationKey,
    },
    expected: 201,
  },
);
check(
  outboundAllocationReplay.data.data.supplierAllocations.length === 1,
  'V0.6-C stable allocation retry duplicated settlement evidence.',
);
await request(
  pm,
  '/finance/payments/' + outboundPaymentId + '/allocations',
  {
    method: 'POST',
    json: {
      targetType: 'CLIENT_INVOICE',
      targetId: clientInvoiceId,
      amount: '1.00',
      actionKey: 'pay-wrong-direction-' + suffix,
    },
    expected: 422,
  },
);

const apWithDraftPayment = await request(
  pm,
  '/finance/projects/' + projectId + '/accounts-payable',
);
const supplierPayableWithDraft = apWithDraftPayment.data.data.find(
  (item) => item.id === supplierInvoiceId,
);
check(
  supplierPayableWithDraft &&
    String(supplierPayableWithDraft.allocatedAmount) === '0' &&
    String(supplierPayableWithDraft.outstandingAmount) === '29.25',
  'V0.6-C Draft Payment incorrectly affected derived AP.',
);

await request(
  pm,
  '/finance/payments/' + outboundPaymentId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: paymentWorkflowCode,
      actionKey: 'pay-out-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  pm,
  '/finance/payments/' + outboundPaymentId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'pay-maker-approve-' + suffix,
      comment: 'Maker must not self-approve.',
    },
    expected: 403,
  },
);
const outboundApprovalKey = 'pay-out-approve-' + suffix;
const approvedOutboundPayment = await request(
  checker,
  '/finance/payments/' + outboundPaymentId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: outboundApprovalKey,
      comment: 'Configured Finance checker Payment approval.',
    },
    expected: 201,
  },
);
check(
  approvedOutboundPayment.data.data.state === 'APPROVED' &&
    approvedOutboundPayment.data.data.approvalInstance?.approvalState ===
      'APPROVED' &&
    approvedOutboundPayment.data.data.supplierAllocations.length === 1,
  'V0.6-C outbound Payment did not retain configured approval and allocation history.',
);
const replayedOutboundApproval = await request(
  checker,
  '/finance/payments/' + outboundPaymentId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: outboundApprovalKey,
      comment: 'Configured Finance checker Payment approval.',
    },
    expected: 201,
  },
);
check(
  replayedOutboundApproval.data.data.state === 'APPROVED',
  'V0.6-C stable Payment approval retry did not return retained approved history.',
);

const apWithApprovedPayment = await request(
  pm,
  '/finance/projects/' + projectId + '/accounts-payable',
);
const supplierPayableApproved = apWithApprovedPayment.data.data.find(
  (item) => item.id === supplierInvoiceId,
);
check(
  supplierPayableApproved &&
    String(supplierPayableApproved.allocatedAmount) === '20' &&
    String(supplierPayableApproved.outstandingAmount) === '9.25',
  'V0.6-C approved outbound Payment did not reduce derived AP by the allocation amount.',
);

const paymentCancelKey = 'pay-out-cancel-' + suffix;
const cancelledOutboundPayment = await request(
  pm,
  '/finance/payments/' + outboundPaymentId + '/cancel',
  {
    method: 'POST',
    json: {
      actionKey: paymentCancelKey,
      reason: 'Void supplier settlement and retain history.',
    },
    expected: 201,
  },
);
check(
  cancelledOutboundPayment.data.data.state === 'CANCELLED' &&
    cancelledOutboundPayment.data.data.supplierAllocations.length === 1 &&
    cancelledOutboundPayment.data.data.cancellationReason ===
      'Void supplier settlement and retain history.',
  'V0.6-C Payment cancellation did not retain historical allocation and cancellation evidence.',
);
const cancelledOutboundReplay = await request(
  pm,
  '/finance/payments/' + outboundPaymentId + '/cancel',
  {
    method: 'POST',
    json: {
      actionKey: paymentCancelKey,
      reason: 'Void supplier settlement and retain history.',
    },
    expected: 201,
  },
);
check(
  cancelledOutboundReplay.data.data.state === 'CANCELLED',
  'V0.6-C stable cancellation retry did not return retained cancellation history.',
);
const apAfterPaymentCancellation = await request(
  pm,
  '/finance/projects/' + projectId + '/accounts-payable',
);
const supplierPayableRestored = apAfterPaymentCancellation.data.data.find(
  (item) => item.id === supplierInvoiceId,
);
check(
  supplierPayableRestored &&
    String(supplierPayableRestored.allocatedAmount) === '0' &&
    String(supplierPayableRestored.outstandingAmount) === '29.25',
  'V0.6-C cancelled Payment did not restore derived AP while retaining history.',
);

const inboundPayment = await request(
  pm,
  '/finance/projects/' + projectId + '/payments',
  {
    method: 'POST',
    json: {
      direction: 'INBOUND',
      paymentDate: '2026-10-04',
      customerId,
      amount: '125.00',
      paymentMethod: 'BANK_TRANSFER',
      reference: 'Client receipt ' + suffix,
      createKey: 'pay-in-create-' + suffix,
    },
    expected: 201,
  },
);
const inboundPaymentId = inboundPayment.data.data.id;
await request(
  pm,
  '/finance/payments/' + inboundPaymentId + '/allocations',
  {
    method: 'POST',
    json: {
      targetType: 'CLIENT_INVOICE',
      targetId: clientInvoiceId,
      amount: '125.00',
      actionKey: 'pay-in-alloc-' + suffix,
    },
    expected: 201,
  },
);
await request(
  pm,
  '/finance/payments/' + inboundPaymentId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: paymentWorkflowCode,
      actionKey: 'pay-in-submit-' + suffix,
    },
    expected: 201,
  },
);
const approvedInboundPayment = await request(
  checker,
  '/finance/payments/' + inboundPaymentId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'pay-in-approve-' + suffix,
      comment: 'Approve client receipt.',
    },
    expected: 201,
  },
);
check(
  approvedInboundPayment.data.data.state === 'APPROVED' &&
    approvedInboundPayment.data.data.clientAllocations.length === 1,
  'V0.6-C inbound Payment did not retain approved Client Invoice allocation.',
);
const arWithApprovedReceipt = await request(
  pm,
  '/finance/projects/' + projectId + '/accounts-receivable',
);
const clientReceivablePaid = arWithApprovedReceipt.data.data.find(
  (item) => item.id === clientInvoiceId,
);
check(
  clientReceivablePaid &&
    String(clientReceivablePaid.allocatedAmount) === '125' &&
    String(clientReceivablePaid.outstandingAmount) === '500',
  'V0.6-C approved inbound Payment did not reduce derived AR by the allocation amount.',
);
record('V0.6-C Payment create/retry → direction-safe allocation → configured approval → AP/AR settlement → controlled cancellation/restoration → SYS_ADMIN/Project denial through live HTTP API');

await request(admin, '/finance/cash-flow-projects', { expected: 403 });
const cashFlowProjects = await request(pm, '/finance/cash-flow-projects');
check(
  cashFlowProjects.data.data.some((project) => project.id === projectId),
  'V0.6-E cash-flow Project selector did not expose an authorized Project.',
);

const unallocatedOutboundPayment = await request(
  pm,
  '/finance/projects/' + projectId + '/payments',
  {
    method: 'POST',
    json: {
      direction: 'OUTBOUND',
      paymentDate: '2026-10-05',
      supplierId: sourcingSupplierB.data.data.id,
      amount: '7.00',
      paymentMethod: 'BANK_TRANSFER',
      reference: 'Unallocated cash-flow proof ' + suffix,
      createKey: 'pay-cash-flow-unallocated-' + suffix,
    },
    expected: 201,
  },
);
const unallocatedOutboundPaymentId = unallocatedOutboundPayment.data.data.id;
await request(
  pm,
  '/finance/payments/' + unallocatedOutboundPaymentId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: paymentWorkflowCode,
      actionKey: 'pay-cash-flow-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  checker,
  '/finance/payments/' + unallocatedOutboundPaymentId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'pay-cash-flow-approve-' + suffix,
      comment: 'Approve unallocated Payment for Stage-E cash-flow evidence.',
    },
    expected: 201,
  },
);

const stageECashFlow = await request(
  pm,
  '/finance/projects/' + projectId + '/cash-flow',
);
const stageECancelledRow = stageECashFlow.data.data.rows.find(
  (row) => row.id === outboundPaymentId,
);
const stageEInboundRow = stageECashFlow.data.data.rows.find(
  (row) => row.id === inboundPaymentId,
);
const stageEUnallocatedRow = stageECashFlow.data.data.rows.find(
  (row) => row.id === unallocatedOutboundPaymentId,
);
check(
  !stageECancelledRow &&
    stageEInboundRow &&
    stageEUnallocatedRow &&
    Number(stageEInboundRow.inflowAmount) === 125 &&
    Number(stageEInboundRow.outflowAmount) === 0 &&
    Number(stageEUnallocatedRow.outflowAmount) === 7 &&
    Number(stageEUnallocatedRow.allocatedAmount) === 0 &&
    Number(stageEUnallocatedRow.unallocatedAmount) === 7 &&
    stageEUnallocatedRow.settlementStatus === 'UNALLOCATED' &&
    Number(stageECashFlow.data.data.totals.inflowAmount) === 125 &&
    Number(stageECashFlow.data.data.totals.outflowAmount) === 7 &&
    Number(stageECashFlow.data.data.totals.netCashFlow) === 118,
  'V0.6-E Project Cash Flow did not count approved Payment amounts exactly once while excluding cancelled Payments and preserving unallocated settlement state.',
);
const stageEOneDayCashFlow = await request(
  pm,
  '/finance/projects/' +
    projectId +
    '/cash-flow?fromDate=2026-10-04&toDate=2026-10-04',
);
check(
  stageEOneDayCashFlow.data.data.rows.length === 1 &&
    stageEOneDayCashFlow.data.data.rows[0]?.id === inboundPaymentId &&
    Number(stageEOneDayCashFlow.data.data.totals.inflowAmount) === 125 &&
    Number(stageEOneDayCashFlow.data.data.totals.outflowAmount) === 0 &&
    Number(stageEOneDayCashFlow.data.data.totals.netCashFlow) === 125,
  'V0.6-E Payment-date filter did not constrain Project Cash Flow to the inclusive requested day.',
);
await request(
  pm,
  '/finance/projects/' +
    projectId +
    '/cash-flow?fromDate=2026-10-06&toDate=2026-10-04',
  { expected: 422 },
);
await request(
  unassignedReceipt,
  '/finance/projects/' + projectId + '/cash-flow',
  { expected: 403 },
);

await request(admin, '/admin/company', {
  method: 'PATCH',
  json: { baseCurrencyCode: 'USD' },
});
await request(
  pm,
  '/finance/projects/' + projectId + '/cash-flow',
  { expected: 422 },
);
await request(admin, '/admin/company', {
  method: 'PATCH',
  json: { baseCurrencyCode: 'SGD' },
});
const restoredStageECashFlow = await request(
  pm,
  '/finance/projects/' + projectId + '/cash-flow',
);
check(
  Number(restoredStageECashFlow.data.data.totals.netCashFlow) === 118,
  'V0.6-E restoring Company base currency did not restore valid Project Cash Flow.',
);
record('V0.6-E rejects historical Payment currency when current Company base currency differs, preventing unsupported FX/mixed-currency aggregation');

record('V0.6-E authenticated Project Cash Flow counts approved non-cancelled Payment amounts once, supports Payment-date filtering, preserves unallocated settlement evidence, excludes cancelled history and enforces SYS_ADMIN/Project denial');

const postedBalance = await request(
  pm,
  '/inventory/stock-balances?projectId=' + projectId +
    '&warehouseId=' + receiptWarehouseId,
);
check(
  postedBalance.data.data.length === 1 &&
    postedBalance.data.data[0]?.quantity === '3.0000' &&
    postedBalance.data.data[0]?.projectId === projectId &&
    postedBalance.data.data[0]?.warehouseProjectId === projectId &&
    postedBalance.data.data[0]?.isSiteWarehouse === true,
  'Derived Stock Balance did not expose the exact posted Project/Site quantity.',
);
await request(
  unassignedReceipt,
  '/inventory/stock-balances?projectId=' + projectId,
  { expected: 403 },
);
await request(
  unassignedReceipt,
  '/inventory/reservation-availability?projectId=' + projectId +
    '&warehouseId=' + receiptWarehouseId +
    '&materialId=' + material.data.data.id +
    '&uomId=' + uomId,
  { expected: 403 },
);

const reservation = await request(pm, '/inventory/material-reservations', {
  method: 'POST',
  json: {
    projectId,
    warehouseId: receiptWarehouseId,
    materialId: material.data.data.id,
    uomId,
    wbsId: rootWbs.data.data.id,
    activityId: activityA.data.data.id,
    quantity: '2',
    requiredDate: '2026-10-12',
    remarks: 'V0.4-D live reservation',
  },
  expected: 201,
});
check(
  /^RSV\d{4}-\d{3}$/.test(reservation.data.data.reservationNumber) &&
    reservation.data.data.status === 'DRAFT',
  'Material Reservation Draft or numbering was incorrect.',
);
const reservationId = reservation.data.data.id;
const activeReservation = await request(
  pm,
  '/inventory/material-reservations/' + reservationId + '/activate',
  { method: 'POST', expected: 201 },
);
check(activeReservation.data.data.status === 'ACTIVE', 'Reservation activation failed.');
const reservedAvailability = await request(
  pm,
  '/inventory/reservation-availability?projectId=' + projectId +
    '&warehouseId=' + receiptWarehouseId +
    '&materialId=' + material.data.data.id +
    '&uomId=' + uomId,
);
check(
  reservedAvailability.data.data.onHand === '3.0000' &&
    reservedAvailability.data.data.reserved === '2.0000' &&
    reservedAvailability.data.data.available === '1.0000',
  'Reservation did not reduce derived available quantity exactly.',
);

const materialIssue = await request(pm, '/inventory/material-issues', {
  method: 'POST',
  json: {
    projectId,
    warehouseId: receiptWarehouseId,
    issueDate: '2026-10-10',
    issuedToEmployeeId: pmEmployee.data.data.id,
    remarks: 'V0.4-D live issue',
    lines: [{
      materialId: material.data.data.id,
      quantity: '2',
      uomId,
      reservationId,
      wbsId: rootWbs.data.data.id,
      costCodeId: costCode.data.data.id,
      activityId: activityA.data.data.id,
    }],
  },
  expected: 201,
});
check(/^MI\d{4}-\d{3}$/.test(materialIssue.data.data.issueNumber), 'Material Issue numbering mismatch.');
const materialIssueId = materialIssue.data.data.id;
await request(pm, '/inventory/material-issues/' + materialIssueId + '/submit', {
  method: 'POST',
  json: { workflowCode: issueWorkflowCode },
  expected: 201,
});
await request(pm, '/inventory/material-issues/' + materialIssueId + '/approve', {
  method: 'POST',
  json: { postKey: 'issue-maker-' + suffix },
  expected: 403,
});
const postedIssue = await request(
  checker,
  '/inventory/material-issues/' + materialIssueId + '/approve',
  {
    method: 'POST',
    json: { postKey: 'issue-post-' + suffix },
    expected: 201,
  },
);
check(
  postedIssue.data.data.postedAt &&
    postedIssue.data.data.stockTransactions.length === 1 &&
    postedIssue.data.data.stockTransactions[0]?.movementType === 'MATERIAL_ISSUE' &&
    String(postedIssue.data.data.stockTransactions[0]?.quantity) === '-2',
  'Material Issue approval did not atomically post one exact negative ledger effect.',
);
const fulfilledReservation = await request(
  pm,
  '/inventory/material-reservations/' + reservationId,
);
check(
  fulfilledReservation.data.data.status === 'FULFILLED',
  'Linked Reservation was not fulfilled atomically with Material Issue posting.',
);
const issueBalance = await request(
  pm,
  '/inventory/stock-balances?projectId=' + projectId +
    '&warehouseId=' + receiptWarehouseId,
);
check(issueBalance.data.data[0]?.quantity === '1.0000', 'Material Issue did not reduce on-hand exactly.');

const materialReturn = await request(pm, '/inventory/material-returns', {
  method: 'POST',
  json: {
    projectId,
    warehouseId: receiptWarehouseId,
    returnDate: '2026-10-10',
    remarks: 'V0.4-D live return',
    lines: [{
      materialIssueItemId: postedIssue.data.data.items[0].id,
      quantity: '1',
    }],
  },
  expected: 201,
});
check(/^MRT\d{4}-\d{3}$/.test(materialReturn.data.data.returnNumber), 'Material Return numbering mismatch.');
const materialReturnId = materialReturn.data.data.id;
await request(pm, '/inventory/material-returns/' + materialReturnId + '/submit', {
  method: 'POST',
  json: { workflowCode: returnWorkflowCode },
  expected: 201,
});
const postedReturn = await request(
  checker,
  '/inventory/material-returns/' + materialReturnId + '/approve',
  {
    method: 'POST',
    json: { postKey: 'return-post-' + suffix },
    expected: 201,
  },
);
check(
  postedReturn.data.data.postedAt &&
    postedReturn.data.data.stockTransactions.length === 1 &&
    postedReturn.data.data.stockTransactions[0]?.movementType === 'MATERIAL_RETURN' &&
    String(postedReturn.data.data.stockTransactions[0]?.quantity) === '1',
  'Material Return approval did not atomically post one exact positive ledger effect.',
);
await request(pm, '/inventory/material-issues/' + materialIssueId + '/reverse', {
  method: 'POST',
  json: {
    reversalKey: 'issue-too-early-' + suffix,
    reason: 'Must reject until Return is reversed',
  },
  expected: 409,
});
await request(pm, '/inventory/material-returns', {
  method: 'POST',
  json: {
    projectId,
    warehouseId: receiptWarehouseId,
    returnDate: '2026-10-10',
    lines: [{
      materialIssueItemId: postedIssue.data.data.items[0].id,
      quantity: '2',
    }],
  },
  expected: 422,
});
const reversedReturn = await request(
  pm,
  '/inventory/material-returns/' + materialReturnId + '/reverse',
  {
    method: 'POST',
    json: {
      reversalKey: 'return-reverse-' + suffix,
      reason: 'V0.4-D live Return reversal',
    },
    expected: 201,
  },
);
check(
  reversedReturn.data.data.stockTransactions.reduce(
    (sum, row) => sum + Number(row.quantity), 0,
  ) === 0,
  'Material Return reversal did not exactly negate its source movement.',
);
const reversedIssue = await request(
  pm,
  '/inventory/material-issues/' + materialIssueId + '/reverse',
  {
    method: 'POST',
    json: {
      reversalKey: 'issue-reverse-' + suffix,
      reason: 'V0.4-D live Issue reversal',
    },
    expected: 201,
  },
);
check(
  reversedIssue.data.data.stockTransactions.reduce(
    (sum, row) => sum + Number(row.quantity), 0,
  ) === 0,
  'Material Issue reversal did not exactly negate its source movement.',
);
const restoredBalance = await request(
  pm,
  '/inventory/stock-balances?projectId=' + projectId +
    '&warehouseId=' + receiptWarehouseId,
);
check(
  restoredBalance.data.data[0]?.quantity === '3.0000',
  'Issue/Return reversal sequence did not restore the original on-hand balance.',
);
const historicalReservation = await request(
  pm,
  '/inventory/material-reservations/' + reservationId,
);
check(
  historicalReservation.data.data.status === 'FULFILLED',
  'Issue reversal incorrectly reopened a fulfilled Reservation.',
);
record('V0.4-D reservation availability, Issue maker-checker/posting, Return ceiling, reversal ordering and exact balance restoration');

const transferStore = await request(pm, '/inventory/warehouses', {
  method: 'POST',
  json: {
    warehouseCode: 'XFER-WH-' + suffix,
    warehouseName: 'Transfer destination ' + suffix,
    projectId,
    isSiteWarehouse: true,
  },
  expected: 201,
});
const transferWarehouseId = transferStore.data.data.id;
const stageETransfer = await request(pm, '/inventory/stock-transfers', {
  method: 'POST',
  json: {
    sourceWarehouseId: receiptWarehouseId,
    destinationWarehouseId: transferWarehouseId,
    transferDate: '2026-10-10',
    lines: [{
      materialId: material.data.data.id,
      quantity: '1',
      uomId,
      sourceProjectId: projectId,
      destinationProjectId: projectId,
    }],
  },
  expected: 201,
});
const stageETransferId = stageETransfer.data.data.id;
check(/^ST\d{4}-\d{3}$/.test(stageETransfer.data.data.transferNumber),
  'Stock Transfer numbering format mismatch.');
await request(pm, '/inventory/stock-transfers/' + stageETransferId + '/submit', {
  method: 'POST',
  json: { workflowCode: transferWorkflowCode },
  expected: 201,
});
await request(pm, '/inventory/stock-transfers/' + stageETransferId + '/approve', {
  method: 'POST',
  json: { postKey: 'transfer-maker-' + suffix },
  expected: 403,
});
const postedStageETransfer = await request(
  checker, '/inventory/stock-transfers/' + stageETransferId + '/approve', {
    method: 'POST',
    json: { postKey: 'transfer-post-' + suffix },
    expected: 201,
  },
);
check(
  postedStageETransfer.data.data.stockTransactions.length === 2 &&
    postedStageETransfer.data.data.stockTransactions.some(
      (row) => row.movementType === 'STOCK_TRANSFER_OUT' && String(row.quantity) === '-1',
    ) &&
    postedStageETransfer.data.data.stockTransactions.some(
      (row) => row.movementType === 'STOCK_TRANSFER_IN' && String(row.quantity) === '1',
    ),
  'Stock Transfer did not post matched source and destination ledger effects.',
);
const transferMovements = await request(
  pm,
  '/inventory/reports/movements?projectId=' + projectId +
    '&sourceType=STOCK_TRANSFER',
);
check(
  transferMovements.data.data.filter(
    (row) => row.sourceId === stageETransferId,
  ).length === 2 &&
    transferMovements.data.data.every(
      (row) => row.sourceType === 'STOCK_TRANSFER',
    ),
  'Movement report did not preserve Transfer source identity and source-family filtering.',
);
const transferBalances = await request(
  pm,
  '/inventory/reports/balances?projectId=' + projectId +
    '&warehouseId=' + transferWarehouseId,
);
check(transferBalances.data.data[0]?.quantity === '1.0000',
  'Inventory balance report did not derive destination Transfer stock.');
await request(unassignedReceipt, '/inventory/reports/movements?projectId=' + projectId,
  { expected: 403 });
await request(unassignedReceipt, '/inventory/stock-transfers/' + stageETransferId,
  { expected: 403 });
const transferEvidenceType = await request(admin, '/document-types', {
  method: 'POST',
  json: {
    documentTypeCode: 'TRANSFER-' + suffix,
    documentTypeName: 'Transfer Evidence ' + suffix,
  },
  expected: 201,
});
const inventoryTargets = await request(
  pm, '/documents/projects/' + projectId + '/targets/options',
);
check(
  inventoryTargets.data.data.goodsReceipts.some((row) => row.id === receiptAId) &&
    inventoryTargets.data.data.materialReservations.some((row) => row.id === reservationId) &&
    inventoryTargets.data.data.materialIssues.some((row) => row.id === materialIssueId) &&
    inventoryTargets.data.data.materialReturns.some((row) => row.id === materialReturnId) &&
    inventoryTargets.data.data.stockTransfers.some((row) => row.id === stageETransferId),
  'Document target options omitted an authorized Inventory transaction family.',
);
const transferEvidence = new FormData();
transferEvidence.set('documentTypeId', transferEvidenceType.data.data.id);
transferEvidence.set('file', new Blob(
  [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
  { type: 'image/png' },
), 'transfer-' + suffix + '.png');
const transferDocument = await request(
  pm,
  '/documents/projects/' + projectId +
    '/targets/STOCK_TRANSFER/' + stageETransferId,
  { method: 'POST', body: transferEvidence, expected: 201 },
);
const transferDocuments = await request(
  pm,
  '/documents/projects/' + projectId +
    '/targets/STOCK_TRANSFER/' + stageETransferId,
);
check(
  transferDocuments.data.data.some((row) => row.id === transferDocument.data.data.id) &&
    !JSON.stringify(transferDocuments.data).includes('storageKey'),
  'Stock Transfer evidence was not securely linked through Documents.',
);
await request(
  unassignedReceipt,
  '/documents/projects/' + projectId +
    '/targets/STOCK_TRANSFER/' + stageETransferId,
  { expected: 403 },
);
record('V0.4-E Inventory document targets, secure Transfer evidence and Project denial');

const reversedStageETransfer = await request(
  pm, '/inventory/stock-transfers/' + stageETransferId + '/reverse', {
    method: 'POST',
    json: {
      reversalKey: 'transfer-reverse-' + suffix,
      reason: 'V0.4-E live Transfer reversal',
    },
    expected: 201,
  },
);
check(
  reversedStageETransfer.data.data.stockTransactions.length === 4 &&
    reversedStageETransfer.data.data.stockTransactions.reduce(
      (sum, row) => sum + Number(row.quantity), 0,
    ) === 0,
  'Stock Transfer reversal did not append exact opposite effects.',
);
record('V0.4-E Transfer maker-checker, matched posting, derived reports, scoped denial and reversal');



const receiptB = await makeReceipt('6');
const receiptBId = receiptB.data.data.id;
await request(pm, '/inventory/goods-receipts/' + receiptBId + '/submit', {
  method: 'POST', json: { workflowCode: receiptWorkflowCode }, expected: 201,
});
await request(checker, '/inventory/goods-receipts/' + receiptBId + '/approve', {
  method: 'POST', json: { postKey: 'post-b-' + suffix }, expected: 201,
});
const excess = await makeReceipt('1');
await request(pm, '/inventory/goods-receipts/' + excess.data.data.id + '/submit', {
  method: 'POST', json: { workflowCode: receiptWorkflowCode }, expected: 201,
});
await request(checker, '/inventory/goods-receipts/' + excess.data.data.id + '/approve', {
  method: 'POST', json: { postKey: 'post-excess-' + suffix }, expected: 409,
});
await request(checker, '/inventory/goods-receipts/' + excess.data.data.id + '/reject', {
  method: 'POST', json: { comment: 'Exceeds current approved PO quantity' }, expected: 201,
});
await request(pm, '/procurement/purchase-orders/' + revisedPoId + '/cancel', {
  method: 'POST', json: { reason: 'Blocked while receipts remain' }, expected: 409,
});
await request(unassignedReceipt, '/inventory/goods-receipts/' + receiptAId, {
  expected: 403,
});
await request(pm, '/inventory/goods-receipts/' + receiptAId + '/reverse', {
  method: 'POST',
  json: { reversalKey: 'reverse-a-' + suffix, reason: 'Blocked by approved Supplier Invoice lineage' },
  expected: 409,
});
const reversedReceiptB = await request(
  pm,
  '/inventory/goods-receipts/' + receiptBId + '/reverse',
  {
    method: 'POST',
    json: { reversalKey: 'reverse-b-' + suffix, reason: 'UAT full reversal' },
    expected: 201,
  },
);
check(
  reversedReceiptB.data.data.reversedAt &&
    reversedReceiptB.data.data.stockTransactions.length === 2 &&
    reversedReceiptB.data.data.stockTransactions.reduce(
      (sum, row) => sum + Number(row.quantity), 0,
    ) === 0,
  'Unreferenced Goods Receipt reversal did not append the exact negative stock effect.',
);
const hiddenZeroBalance = await request(
  pm,
  '/inventory/stock-balances?projectId=' + projectId +
    '&warehouseId=' + receiptWarehouseId,
);
check(
  hiddenZeroBalance.data.data.length === 1 &&
    hiddenZeroBalance.data.data[0]?.quantity === '3.0000',
  'Finance-linked retained receipt must remain visible in derived stock balance.',
);
const visibleZeroBalance = await request(
  pm,
  '/inventory/stock-balances?projectId=' + projectId +
    '&warehouseId=' + receiptWarehouseId +
    '&includeZero=true&includeInactiveWarehouses=true',
);
check(
  visibleZeroBalance.data.data.length === 1 &&
    visibleZeroBalance.data.data[0]?.quantity === '3.0000',
  'Finance-linked retained receipt balance was not derived exactly.',
);
record('V0.4-B partial/multiple PO receipt, maker-checker, over-receipt, retry, scope, PO cancellation guard and reversal');
record('V0.4-C derived Stock Balance, Project/Site filtering, reversal-to-zero and unauthorized Project denial');

await request(
  pm,
  '/procurement/purchase-orders/' + revisedPoId + '/cancel',
  {
    method: 'POST',
    json: { reason: 'Blocked by retained Finance-linked Goods Receipt.' },
    expected: 409,
  },
);
record('V0.3-D Purchase Order award sourcing, numbering, allocation, maker-checker approval, immutable revisions, delivery dates and cancellation guard');

const rejectedPo = await request(
  pm,
  '/procurement/projects/' + projectId + '/purchase-orders',
  {
    method: 'POST',
    json: {
      awardIds: [serviceSourcingAward.data.data.id],
      remarks: 'Rejected PO retry acceptance ' + suffix,
    },
    expected: 201,
  },
);
await request(
  pm,
  '/procurement/purchase-orders/' + rejectedPo.data.data.id + '/submit',
  {
    method: 'POST',
    json: { workflowCode: poWorkflowCode },
    expected: 201,
  },
);
const rejectedPoResult = await request(
  checker,
  '/procurement/purchase-orders/' + rejectedPo.data.data.id + '/reject',
  {
    method: 'POST',
    json: { comment: 'Correct supplier commercial detail and resubmit.' },
    expected: 201,
  },
);
check(
  rejectedPoResult.data.data.lifecycleState === 'REJECTED',
  'Purchase Order rejection was not retained.',
);
const retryPo = await request(
  pm,
  '/procurement/purchase-orders/' + rejectedPo.data.data.id + '/revise',
  {
    method: 'POST',
    json: { revisionReason: 'Correct rejected Purchase Order.' },
    expected: 201,
  },
);
check(
  retryPo.data.data.poNumber === rejectedPo.data.data.poNumber &&
    retryPo.data.data.revisionNo === 1 &&
    retryPo.data.data.lifecycleState === 'DRAFT',
  'Rejected Purchase Order could not be copied into a retained corrective revision.',
);
await request(
  pm,
  '/procurement/purchase-orders/' + retryPo.data.data.id + '/cancel',
  {
    method: 'POST',
    json: { reason: 'Rejected retry acceptance cleanup.' },
    expected: 201,
  },
);
record('V0.3-D rejected Purchase Order retry path');


const rejectedCandidate = await request(
  pm,
  '/procurement/projects/' + projectId + '/purchase-requests',
  {
    method: 'POST',
    json: { remarks: 'Rejected-copy acceptance candidate' },
    expected: 201,
  },
);
await request(
  pm,
  '/procurement/purchase-requests/' + rejectedCandidate.data.data.id + '/lines',
  {
    method: 'POST',
    json: {
      lineType: 'SERVICE',
      description: 'Temporary surveying service',
      quantity: '1',
      uomId,
      requiredOnSite: '2026-10-14',
    },
    expected: 201,
  },
);
await request(
  pm,
  '/procurement/purchase-requests/' + rejectedCandidate.data.data.id + '/submit',
  {
    method: 'POST',
    json: { workflowCode: prWorkflowCode },
    expected: 201,
  },
);
const rejectedPr = await request(
  checker,
  '/procurement/purchase-requests/' + rejectedCandidate.data.data.id + '/reject',
  {
    method: 'POST',
    json: { comment: 'Revise and resubmit as a new Draft.' },
    expected: 201,
  },
);
check(
  rejectedPr.data.data.lifecycleState === 'REJECTED' &&
    rejectedPr.data.data.approvalInstance?.actions?.some(
      (action) =>
        action.action === 'REJECT' &&
        action.comment === 'Revise and resubmit as a new Draft.' &&
        action.actionByUser?.id === checkerUser.data.data.id,
    ),
  'Purchase Request rejection action history was not retained/exposed.',
);
const copiedPr = await request(
  pm,
  '/procurement/purchase-requests/' + rejectedCandidate.data.data.id + '/copy-rejected',
  {
    method: 'POST',
    json: {},
    expected: 201,
  },
);
check(
  copiedPr.data.data.lifecycleState === 'DRAFT' &&
    copiedPr.data.data.sourceRequestId === rejectedCandidate.data.data.id &&
    copiedPr.data.data.prNumber !== rejectedCandidate.data.data.prNumber,
  'Rejected Purchase Request was not copied into a new independently numbered Draft.',
);
const cancelledCopy = await request(
  pm,
  '/procurement/purchase-requests/' + copiedPr.data.data.id + '/cancel',
  {
    method: 'POST',
    json: {},
    expected: 201,
  },
);
check(
  cancelledCopy.data.data.lifecycleState === 'CANCELLED',
  'Purchase Request cancellation was not retained as a lifecycle state.',
);
record('V0.3-B Purchase Request material/service demand, Required-on-Site, maker-checker approval, rejected copy and cancellation');

await request(pm, `/activity-progress/${activityA.data.data.id}`, {
  method: 'POST',
  json: {
    progressDate: '2026-10-08',
    percentComplete: '50',
    note: 'Initial progress',
  },
  expected: 201,
});
await request(pm, `/activity-progress/${activityA.data.data.id}`, {
  method: 'POST',
  json: {
    progressDate: '2026-10-09',
    percentComplete: '40',
    note: 'Correction retained as history',
  },
  expected: 201,
});
const progressHistory = await request(
  pm,
  `/activity-progress/${activityA.data.data.id}`,
);
check(
  progressHistory.data.data.length === 2 &&
    String(progressHistory.data.data[0].percentComplete) === '40',
  'Append-only progress correction history was not preserved.',
);

await request(pm, `/activities/${activityA.data.data.id}`, {
  method: 'PATCH',
  json: {
    forecastStartDate: '2026-10-01',
    forecastFinishDate: '2026-10-09',
  },
});

const comparison = await request(
  pm,
  '/schedule/projects/' + projectId + '/comparison',
);
const comparedA = comparison.data.data.activities.find(
  (item) => item.activityId === activityA.data.data.id,
);
check(
  comparison.data.data.currentBaseline?.versionNo === 1,
  'Current approved Schedule Baseline was not selected for comparison.',
);
check(
  comparedA?.currentPercentComplete === 40,
  'Latest progress entry was not derived as current progress.',
);
check(
  comparedA?.delayStatus === 'DELAYED' &&
    Number(comparedA?.delayWorkDays) > 0,
  'Baseline-versus-forecast delay was not classified correctly.',
);
record('V0.2-C baselines, progress and delay comparison through live HTTP API');

await request(pm, `/activity-progress/${activityB.data.data.id}`, {
  method: 'POST',
  json: {
    progressDate: '2026-10-09',
    percentComplete: '100',
    note: 'Completed Activity must remain visible in lookahead',
  },
  expected: 201,
});

const ganttPresentation = await request(
  pm,
  '/schedule/projects/' + projectId + '/gantt',
);
check(
  ganttPresentation.data.data.currentBaseline?.versionNo === 1,
  'Gantt presentation did not use the current approved baseline.',
);
const ganttA = ganttPresentation.data.data.activities.find(
  (item) => item.activityId === activityA.data.data.id,
);
const ganttB = ganttPresentation.data.data.activities.find(
  (item) => item.activityId === activityB.data.data.id,
);
check(
  ganttA?.delayStatus === 'DELAYED' &&
    typeof ganttA?.isCritical === 'boolean' &&
    typeof ganttA?.totalFloatWorkDays === 'number',
  'Gantt presentation did not expose backend-derived delay/critical/float indicators.',
);
check(
  Number(ganttA?.plannedDurationWorkDays) === 5 &&
    ganttA?.activityStatus?.id === activityStatus.data.data.id,
  'Gantt presentation did not expose Activity status and duration.',
);
check(
  ganttB?.predecessorActivityIds?.includes(activityA.data.data.id),
  'Gantt presentation did not preserve backend dependency references.',
);

const twoWeekLookahead = await request(
  pm,
  '/schedule/projects/' +
    projectId +
    '/lookahead?asOf=2026-10-01&days=14',
);
check(
  twoWeekLookahead.data.data.window?.asOfDate === '2026-10-01' &&
    twoWeekLookahead.data.data.window?.endDate === '2026-10-14' &&
    twoWeekLookahead.data.data.window?.days === 14,
  '2-week lookahead did not use the approved inclusive 14-calendar-day window.',
);
check(
  twoWeekLookahead.data.data.activities.some(
    (item) =>
      item.activityId === activityB.data.data.id &&
      Number(item.currentPercentComplete) === 100,
  ),
  'Completed overlapping Activity was incorrectly hidden from lookahead.',
);

const fourWeekLookahead = await request(
  pm,
  '/schedule/projects/' +
    projectId +
    '/lookahead?asOf=2026-10-01&days=28',
);
check(
  fourWeekLookahead.data.data.window?.endDate === '2026-10-28',
  '4-week lookahead did not use the approved inclusive 28-calendar-day window.',
);
record('V0.2-D Gantt and lookahead presentation through live HTTP API');

const referenceProject = await request(pm, '/projects', {
  method: 'POST',
  json: {
    projectCode: 'GW-UAT-' + suffix,
    projectName: 'Factory Construction',
    customerId,
    statusDefinitionId: statusId,
    contractValue: '90000000.00',
    location: 'Ground Floor Slab UAT Site',
    description: 'V0.2-G Groundworks reference programme',
    plannedStartDate: '2026-10-01',
    plannedCompletionDate: '2027-09-30',
  },
  expected: 201,
});
const referenceProjectId = referenceProject.data.data.id;
await request(admin, `/projects/${referenceProjectId}/members`, {
  method: 'POST',
  json: {
    employeeId: checkerEmployee.data.data.id,
    projectRole: 'Baseline Approver',
  },
  expected: 201,
});

const referenceGroundworks = await request(
  pm,
  `/wbs/projects/${referenceProjectId}`,
  {
    method: 'POST',
    json: { wbsCode: '01', wbsName: 'Groundworks' },
    expected: 201,
  },
);
const referenceSlab = await request(
  pm,
  `/wbs/projects/${referenceProjectId}`,
  {
    method: 'POST',
    json: {
      parentId: referenceGroundworks.data.data.id,
      wbsCode: '01.01',
      wbsName: 'Ground Floor Slab',
    },
    expected: 201,
  },
);
check(
  referenceSlab.data.data.parentId === referenceGroundworks.data.data.id,
  'V0.2-G reference WBS hierarchy was not retained.',
);

const referenceCalendar = await request(pm, '/working-calendars', {
  method: 'POST',
  json: {
    projectId: referenceProjectId,
    calendarName: 'V0.2-G Mon-Fri Calendar',
    timezoneName: 'Asia/Singapore',
    isDefault: true,
  },
  expected: 201,
});
const referenceCalendarId = referenceCalendar.data.data.id;
await request(
  pm,
  `/working-calendars/${referenceCalendarId}/weekdays`,
  {
    method: 'PUT',
    json: {
      weekdays: [
        { weekdayNo: 1, isWorking: true, startTime: '08:00', endTime: '17:00' },
        { weekdayNo: 2, isWorking: true, startTime: '08:00', endTime: '17:00' },
        { weekdayNo: 3, isWorking: true, startTime: '08:00', endTime: '17:00' },
        { weekdayNo: 4, isWorking: true, startTime: '08:00', endTime: '17:00' },
        { weekdayNo: 5, isWorking: true, startTime: '08:00', endTime: '17:00' },
        { weekdayNo: 6, isWorking: false, startTime: null, endTime: null },
        { weekdayNo: 7, isWorking: false, startTime: null, endTime: null },
      ],
    },
  },
);

const referenceSummary = await request(pm, '/activities', {
  method: 'POST',
  json: {
    projectId: referenceProjectId,
    wbsId: referenceSlab.data.data.id,
    activityTypeId: activityType.data.data.id,
    workingCalendarId: referenceCalendarId,
    statusDefinitionId: activityStatus.data.data.id,
    activityCode: 'GW-000',
    activityName: 'Ground Floor Slab Groundworks',
    isSummary: true,
    plannedDurationWorkDays: '20',
    plannedStartDate: '2026-10-01',
    plannedFinishDate: '2026-10-28',
  },
  expected: 201,
});

const referenceActivitySpecs = [
  ['GW-100', 'Setting Out', '1', '2026-10-01', '2026-10-01', '2026-10-02', '2026-10-02'],
  ['GW-200', 'Excavation', '3', '2026-10-02', '2026-10-06', '2026-10-05', '2026-10-07'],
  ['GW-300', 'Compaction', '2', '2026-10-07', '2026-10-08', '2026-10-08', '2026-10-09'],
  ['GW-400', 'Blinding Concrete', '2', '2026-10-09', '2026-10-12', '2026-10-12', '2026-10-13'],
  ['GW-500', 'Formwork', '3', '2026-10-13', '2026-10-15', '2026-10-14', '2026-10-16'],
  ['GW-600', 'Reinforcement', '4', '2026-10-16', '2026-10-21', '2026-10-19', '2026-10-22'],
  ['GW-700', 'Inspection', '1', '2026-10-22', '2026-10-22', '2026-10-23', '2026-10-23'],
  ['GW-800', 'Concrete Pour', '4', '2026-10-23', '2026-10-28', '2026-10-26', '2026-10-29'],
];
check(
  referenceActivitySpecs.reduce(
    (sum, row) => sum + Number(row[2]),
    0,
  ) === 20,
  'V0.2-G reference Activity durations do not total 20 working days.',
);

const referenceActivities = [];
for (const [
  code,
  name,
  duration,
  plannedStartDate,
  plannedFinishDate,
] of referenceActivitySpecs) {
  const created = await request(pm, '/activities', {
    method: 'POST',
    json: {
      projectId: referenceProjectId,
      wbsId: referenceSlab.data.data.id,
      parentActivityId: referenceSummary.data.data.id,
      activityTypeId: activityType.data.data.id,
      workingCalendarId: referenceCalendarId,
      statusDefinitionId: activityStatus.data.data.id,
      activityCode: code,
      activityName: name,
      plannedDurationWorkDays: duration,
      plannedStartDate,
      plannedFinishDate,
    },
    expected: 201,
  });
  referenceActivities.push(created.data.data);
}

for (let index = 1; index < referenceActivities.length; index += 1) {
  await request(pm, '/activity-dependencies', {
    method: 'POST',
    json: {
      projectId: referenceProjectId,
      predecessorActivityId: referenceActivities[index - 1].id,
      successorActivityId: referenceActivities[index].id,
      dependencyType: 'FS',
      lagWorkDays: '0',
    },
    expected: 201,
  });
}

const referencePlanned = await request(
  pm,
  '/schedule/projects/' + referenceProjectId + '/analysis?mode=planned',
);
check(
  referencePlanned.data.data.projectFinishDate === '2026-10-28',
  'V0.2-G reference programme did not finish on the independently expected 20th working day.',
);
for (const spec of referenceActivitySpecs) {
  const calculated = referencePlanned.data.data.activities.find(
    (item) => item.activityName === spec[1],
  );
  check(
    calculated?.calculatedStartDate === spec[3] &&
      calculated?.calculatedFinishDate === spec[4] &&
      Number(calculated?.totalFloatWorkDays) === 0 &&
      calculated?.isCritical === true,
    'V0.2-G planned backend result mismatch for ' + spec[1] + '.',
  );
}

const referenceBaseline = await request(pm, '/schedule-baselines/submit', {
  method: 'POST',
  json: {
    projectId: referenceProjectId,
    workflowCode: baselineWorkflowCode,
  },
  expected: 201,
});
const approvedReferenceBaseline = await request(
  checker,
  `/schedule-baselines/${referenceBaseline.data.data.id}/approve`,
  {
    method: 'POST',
    json: { comment: 'Approve V0.2-G Groundworks reference baseline' },
    expected: 201,
  },
);
check(
  approvedReferenceBaseline.data.data.isCurrent === true &&
    approvedReferenceBaseline.data.data.activities.length === 9,
  'V0.2-G reference baseline did not snapshot the summary plus eight detailed Activities.',
);

await request(pm, `/activities/${referenceSummary.data.data.id}`, {
  method: 'PATCH',
  json: {
    forecastStartDate: '2026-10-02',
    forecastFinishDate: '2026-10-29',
  },
});
await request(pm, `/activities/${referenceActivities[0].id}`, {
  method: 'PATCH',
  json: {
    actualStartDate: '2026-10-02',
    actualFinishDate: '2026-10-02',
    forecastStartDate: '2026-10-02',
    forecastFinishDate: '2026-10-02',
  },
});
await request(pm, `/activities/${referenceActivities[1].id}`, {
  method: 'PATCH',
  json: { actualStartDate: '2026-10-05' },
});
await request(pm, `/activity-progress/${referenceActivities[0].id}`, {
  method: 'POST',
  json: {
    progressDate: '2026-10-02',
    percentComplete: '100',
    note: 'Setting Out completed one working day behind baseline.',
  },
  expected: 201,
});
await request(pm, `/activity-progress/${referenceActivities[1].id}`, {
  method: 'POST',
  json: {
    progressDate: '2026-10-06',
    percentComplete: '25',
    note: 'Excavation first progress observation.',
  },
  expected: 201,
});
await request(pm, `/activity-progress/${referenceActivities[1].id}`, {
  method: 'POST',
  json: {
    progressDate: '2026-10-07',
    percentComplete: '50',
    note: 'Excavation latest progress observation.',
  },
  expected: 201,
});

const referenceForecast = await request(
  pm,
  '/schedule/projects/' + referenceProjectId + '/analysis?mode=forecast',
);
check(
  referenceForecast.data.data.projectFinishDate === '2026-10-29',
  'V0.2-G one-working-day forecast delay did not move Project finish to 2026-10-29.',
);
for (const spec of referenceActivitySpecs) {
  const calculated = referenceForecast.data.data.activities.find(
    (item) => item.activityName === spec[1],
  );
  check(
    calculated?.calculatedStartDate === spec[5] &&
      calculated?.calculatedFinishDate === spec[6],
    'V0.2-G forecast backend result mismatch for ' + spec[1] + '.',
  );
}

const referenceGantt = await request(
  pm,
  '/schedule/projects/' + referenceProjectId + '/gantt',
);
check(
  referenceGantt.data.data.currentBaseline?.versionNo === 1,
  'V0.2-G Gantt did not use the approved reference baseline.',
);
for (const spec of referenceActivitySpecs) {
  const backend = referenceForecast.data.data.activities.find(
    (item) => item.activityName === spec[1],
  );
  const presented = referenceGantt.data.data.activities.find(
    (item) => item.activityName === spec[1],
  );
  check(
    String(presented?.forecastStartDate).slice(0, 10) ===
        backend?.calculatedStartDate &&
      String(presented?.forecastFinishDate).slice(0, 10) ===
        backend?.calculatedFinishDate &&
      String(presented?.baselineStartDate).slice(0, 10) === spec[3] &&
      String(presented?.baselineFinishDate).slice(0, 10) === spec[4] &&
      Number(presented?.totalFloatWorkDays) ===
        Number(backend?.totalFloatWorkDays) &&
      presented?.isCritical === backend?.isCritical &&
      Number(presented?.delayWorkDays) === 1 &&
      presented?.delayStatus === 'DELAYED',
    'V0.2-G Gantt/backend agreement failed for ' + spec[1] + '.',
  );
}
const referenceSettingOut = referenceGantt.data.data.activities.find(
  (item) => item.activityName === 'Setting Out',
);
const referenceExcavation = referenceGantt.data.data.activities.find(
  (item) => item.activityName === 'Excavation',
);
check(
  String(referenceSettingOut?.actualStartDate).slice(0, 10) === '2026-10-02' &&
    String(referenceSettingOut?.actualFinishDate).slice(0, 10) === '2026-10-02' &&
    Number(referenceSettingOut?.currentPercentComplete) === 100,
  'V0.2-G Setting Out actual/progress presentation mismatch.',
);
check(
  String(referenceExcavation?.actualStartDate).slice(0, 10) === '2026-10-05' &&
    Number(referenceExcavation?.currentPercentComplete) === 50,
  'V0.2-G Excavation actual/progress presentation mismatch.',
);

const referenceTwoWeek = await request(
  pm,
  '/schedule/projects/' +
    referenceProjectId +
    '/lookahead?asOf=2026-10-01&days=14',
);
const referenceTwoWeekNames = new Set(
  referenceTwoWeek.data.data.activities.map((item) => item.activityName),
);
for (const name of [
  'Setting Out',
  'Excavation',
  'Compaction',
  'Blinding Concrete',
  'Formwork',
]) {
  check(
    referenceTwoWeekNames.has(name),
    'V0.2-G 2-week lookahead omitted ' + name + '.',
  );
}
for (const name of ['Reinforcement', 'Inspection', 'Concrete Pour']) {
  check(
    !referenceTwoWeekNames.has(name),
    'V0.2-G 2-week lookahead incorrectly included ' + name + '.',
  );
}

const referenceFourWeek = await request(
  pm,
  '/schedule/projects/' +
    referenceProjectId +
    '/lookahead?asOf=2026-10-01&days=28',
);
const referenceFourWeekNames = new Set(
  referenceFourWeek.data.data.activities.map((item) => item.activityName),
);
for (const spec of referenceActivitySpecs) {
  check(
    referenceFourWeekNames.has(spec[1]),
    'V0.2-G 4-week lookahead omitted ' + spec[1] + '.',
  );
}
record('V0.2-G 20-working-day Ground Floor Slab reference programme and Gantt/backend agreement');

const documentType = await request(admin, '/document-types', {
  method: 'POST',
  json: {
    documentTypeCode: 'CONTRACT-' + suffix,
    documentTypeName: 'Contract ' + suffix,
  },
  expected: 201,
});
const bytes = new TextEncoder().encode('%PDF-1.4 automated V0.1 UAT ' + suffix);
const form = new FormData();
form.set('documentTypeId', documentType.data.data.id);
form.set('file', new Blob([bytes], { type: 'application/pdf' }), 'factory-contract-' + suffix + '.pdf');

const uploaded = await request(pm, `/documents/projects/${projectId}`, {
  method: 'POST',
  body: form,
  expected: 201,
});
const documentId = uploaded.data.data.id;
const uploadedJson = JSON.stringify(uploaded.data.data);
check(!uploadedJson.includes('storageKey'), 'Document response exposed storageKey.');

const listedDocs = await request(pm, `/documents/projects/${projectId}`);
check(listedDocs.data.data.some((item) => item.id === documentId), 'Uploaded document missing from Project document list.');
check(!JSON.stringify(listedDocs.data).includes('storageKey'), 'Document list exposed storageKey.');

const downloaded = await request(pm, `/documents/projects/${projectId}/${documentId}/download`, {
  accept: '*/*',
});
const downloadedBytes = new Uint8Array(downloaded.data);
check(downloadedBytes.length === bytes.length, 'Downloaded document size mismatch.');
check(downloadedBytes.every((value, index) => value === bytes[index]), 'Downloaded document bytes mismatch.');
const wbsDocumentBytes = new TextEncoder().encode(
  '%PDF-1.4 WBS document ' + suffix,
);
const wbsDocumentForm = new FormData();
wbsDocumentForm.set('documentTypeId', documentType.data.data.id);
wbsDocumentForm.set(
  'file',
  new Blob([wbsDocumentBytes], { type: 'application/pdf' }),
  'groundworks-plan-' + suffix + '.pdf',
);
const wbsDocument = await request(
  pm,
  '/documents/projects/' +
    projectId +
    '/targets/WBS/' +
    rootWbs.data.data.id,
  {
    method: 'POST',
    body: wbsDocumentForm,
    expected: 201,
  },
);
const wbsDocumentList = await request(
  pm,
  '/documents/projects/' +
    projectId +
    '/targets/WBS/' +
    rootWbs.data.data.id,
);
check(
  wbsDocumentList.data.data.some(
    (item) => item.id === wbsDocument.data.data.id,
  ) &&
    !JSON.stringify(wbsDocumentList.data).includes('storageKey'),
  'WBS Document link/list did not preserve the secure Documents boundary.',
);

const activityDocumentBytes = new TextEncoder().encode(
  '%PDF-1.4 Activity document ' + suffix,
);
const activityDocumentForm = new FormData();
activityDocumentForm.set('documentTypeId', documentType.data.data.id);
activityDocumentForm.set(
  'file',
  new Blob([activityDocumentBytes], { type: 'application/pdf' }),
  'excavation-method-' + suffix + '.pdf',
);
const activityDocument = await request(
  pm,
  '/documents/projects/' +
    projectId +
    '/targets/ACTIVITY/' +
    activityA.data.data.id,
  {
    method: 'POST',
    body: activityDocumentForm,
    expected: 201,
  },
);
const activityDocumentDownload = await request(
  pm,
  '/documents/projects/' +
    projectId +
    '/targets/ACTIVITY/' +
    activityA.data.data.id +
    '/' +
    activityDocument.data.data.id +
    '/download',
  { accept: '*/*' },
);
const activityDownloadedBytes = new Uint8Array(
  activityDocumentDownload.data,
);
check(
  activityDownloadedBytes.length === activityDocumentBytes.length &&
    activityDownloadedBytes.every(
      (value, index) => value === activityDocumentBytes[index],
    ),
  'Activity Document link/download did not retain the original bytes.',
);
record('V0.2 DOC-006 WBS and Activity documents through live HTTP API');

const procurementDocumentBytes = new TextEncoder().encode(
  '%PDF-1.4 Purchase Order support ' + suffix,
);
const procurementDocumentForm = new FormData();
procurementDocumentForm.set(
  'documentTypeId',
  documentType.data.data.id,
);
procurementDocumentForm.set(
  'file',
  new Blob([procurementDocumentBytes], {
    type: 'application/pdf',
  }),
  'purchase-order-support-' + suffix + '.pdf',
);
const procurementDocument = await request(
  pm,
  '/documents/projects/' +
    projectId +
    '/targets/PURCHASE_ORDER/' +
    purchaseOrderId,
  {
    method: 'POST',
    body: procurementDocumentForm,
    expected: 201,
  },
);
const procurementDocumentList = await request(
  pm,
  '/documents/projects/' +
    projectId +
    '/targets/PURCHASE_ORDER/' +
    purchaseOrderId,
);
check(
  procurementDocumentList.data.data.some(
    (item) => item.id === procurementDocument.data.data.id,
  ) &&
    !JSON.stringify(procurementDocumentList.data).includes(
      'storageKey',
    ),
  'V0.3-E procurement Document target did not preserve the secure Project-owned Documents boundary.',
);
record('V0.3-E DOC-007 secure Purchase Order document target');

record('secure document upload, metadata listing and byte-for-byte download');

const unassigned = await login(unassignedUser.data.data.email, unassignedPassword);

const subcontractStatus = await request(admin, '/admin/statuses', {
  method: 'POST',
  json: {
    entityType: 'SUBCONTRACT_AGREEMENT',
    statusCode: 'ACTIVE-' + suffix,
    statusLabel: 'Active Subcontract ' + suffix,
    sortOrder: 10,
  },
  expected: 201,
});
const subcontractor = await request(pm, '/subcontracts/subcontractors', {
  method: 'POST',
  json: {
    subcontractorCode: 'SUB-' + suffix,
    subcontractorName: 'Groundworks Subcontractor ' + suffix,
    supplierId: sourcingSupplierA.data.data.id,
    registrationNumber: 'REG-' + suffix,
    contactName: 'Subcontracts UAT Contact',
    email: 'subcontracts-' + suffix.toLowerCase() + '@example.com',
  },
  expected: 201,
});
const subcontractorId = subcontractor.data.data.id;
check(
  subcontractor.data.data.supplier?.id === sourcingSupplierA.data.data.id,
  'Subcontractor did not retain the optional same-Company Supplier link.',
);
const companyRegisterForUnassigned = await request(
  unassigned,
  '/subcontracts/subcontractors?search=' + encodeURIComponent(suffix),
);
check(
  companyRegisterForUnassigned.data.data.some(
    (item) => item.id === subcontractorId,
  ),
  'Company-authorized user without Project membership could not read the Subcontractor register.',
);
record('V0.5-A Company Subcontractor register and optional Supplier link');

const subcontractProjects = await request(pm, '/subcontracts/projects');
check(
  subcontractProjects.data.data.some((item) => item.id === projectId),
  'Subcontracts Project selector did not expose the assigned Project.',
);
const unassignedSubcontractProjects = await request(
  unassigned,
  '/subcontracts/projects',
);
check(
  !unassignedSubcontractProjects.data.data.some(
    (item) => item.id === projectId,
  ),
  'Subcontracts Project selector exposed an unauthorized Project.',
);

const agreementPayload = {
  projectId,
  subcontractorId,
  originalValue: '125000.00',
  scopeOfWork: 'Groundworks package ' + suffix,
  currencyCode: 'SGD',
  operationalStatusId: subcontractStatus.data.data.id,
  createKey: 'uat-v05a-' + suffix,
};
const agreement = await request(pm, '/subcontracts/agreements', {
  method: 'POST',
  json: agreementPayload,
  expected: 201,
});
const agreementId = agreement.data.data.id;
check(
  /^SC\d{4}-\d{3}$/.test(agreement.data.data.agreementNumber) &&
    agreement.data.data.approvalState === 'DRAFT' &&
    agreement.data.data.projectId === projectId &&
    agreement.data.data.subcontractorId === subcontractorId &&
    String(agreement.data.data.originalValue) === '125000',
  'Agreement Draft identity, numbering, scope or original value was not retained.',
);
const agreementRetry = await request(pm, '/subcontracts/agreements', {
  method: 'POST',
  json: agreementPayload,
  expected: 201,
});
check(
  agreementRetry.data.data.id === agreementId &&
    agreementRetry.data.data.agreementNumber ===
      agreement.data.data.agreementNumber,
  'Agreement create-key retry created a duplicate commercial identity.',
);
await request(unassigned, '/subcontracts/agreements?projectId=' + projectId, {
  expected: 403,
});
await request(unassigned, '/subcontracts/agreements/' + agreementId, {
  expected: 403,
});
const editedAgreement = await request(
  pm,
  '/subcontracts/agreements/' + agreementId,
  {
    method: 'PATCH',
    json: { scopeOfWork: 'Groundworks package revised Draft ' + suffix },
  },
);
check(
  editedAgreement.data.data.scopeOfWork ===
    'Groundworks package revised Draft ' + suffix,
  'Agreement Draft edit did not retain the revised Scope of Work.',
);
const submittedAgreement = await request(
  pm,
  '/subcontracts/agreements/' + agreementId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractAgreementWorkflowCode,
      actionKey: 'uat-v05b-agreement-submit-' + suffix,
    },
    expected: 201,
  },
);
check(
  submittedAgreement.data.data.approvalState === 'SUBMITTED',
  'V0.5-B Agreement did not enter configured approval.',
);
await request(pm, '/subcontracts/agreements/' + agreementId + '/approve', {
  method: 'POST',
  json: {
    actionKey: 'uat-v05b-agreement-maker-approve-' + suffix,
    comment: 'Maker must not self-approve.',
  },
  expected: 403,
});
const approvedAgreement = await request(
  checker,
  '/subcontracts/agreements/' + agreementId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05b-agreement-approve-' + suffix,
      comment: 'Configured checker approval.',
    },
    expected: 201,
  },
);
check(
  approvedAgreement.data.data.approvalState === 'APPROVED' &&
    approvedAgreement.data.data.firstApprovedAt,
  'V0.5-B Agreement approval did not retain the first-approved checkpoint.',
);
const replayedAgreementSubmit = await request(
  pm,
  '/subcontracts/agreements/' + agreementId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractAgreementWorkflowCode,
      actionKey: 'uat-v05b-agreement-submit-' + suffix,
    },
    expected: 201,
  },
);
check(
  replayedAgreementSubmit.data.data.id === agreementId &&
    replayedAgreementSubmit.data.data.approvalState === 'APPROVED',
  'V0.5-B stable submit retry did not return the same visible Agreement.',
);
await request(pm, '/subcontracts/agreements/' + agreementId, {
  method: 'PATCH',
  json: { originalValue: '125001.00' },
  expected: 409,
});

const mobilizedStatus = await request(admin, '/admin/statuses', {
  method: 'POST',
  json: {
    entityType: 'SUBCONTRACT_AGREEMENT',
    statusCode: 'MOBILIZED-' + suffix,
    statusLabel: 'Mobilized Subcontract ' + suffix,
    sortOrder: 20,
  },
  expected: 201,
});
const agreementRevision = await request(
  pm,
  '/subcontracts/agreements/' + agreementId + '/revisions',
  {
    method: 'POST',
    json: {
      operationalStatusId: mobilizedStatus.data.data.id,
      reason: 'Mobilization status update ' + suffix,
    },
    expected: 201,
  },
);
check(
  agreementRevision.data.data.versionNo === 2 &&
    String(agreementRevision.data.data.originalValue) === '125000',
  'V0.5-B administrative revision did not retain the approved commercial snapshot.',
);
await request(
  pm,
  '/subcontracts/agreement-versions/' + agreementRevision.data.data.id + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractAgreementWorkflowCode,
      actionKey: 'uat-v05b-revision-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/agreement-versions/' + agreementRevision.data.data.id + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05b-revision-maker-approve-' + suffix,
    },
    expected: 403,
  },
);
const approvedAgreementRevision = await request(
  checker,
  '/subcontracts/agreement-versions/' + agreementRevision.data.data.id + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05b-revision-approve-' + suffix,
    },
    expected: 201,
  },
);
check(
  approvedAgreementRevision.data.data.approvalState === 'APPROVED',
  'V0.5-B administrative revision was not approved.',
);
const afterAdministrativeRevision = await request(
  pm,
  '/subcontracts/agreements/' + agreementId,
);
check(
  afterAdministrativeRevision.data.data.operationalStatusId ===
    mobilizedStatus.data.data.id &&
    String(afterAdministrativeRevision.data.data.originalValue) === '125000' &&
    afterAdministrativeRevision.data.data.scopeOfWork ===
      'Groundworks package revised Draft ' + suffix,
  'V0.5-B administrative revision changed commercial history or failed to update status.',
);

const workOrderOne = await request(
  pm,
  '/subcontracts/agreements/' + agreementId + '/work-orders',
  {
    method: 'POST',
    json: {
      scopeOfWork: 'Groundworks allocation one ' + suffix,
      amount: '75000.00',
      wbsElementId: rootWbs.data.data.id,
      costCodeId: costCode.data.data.id,
    },
    expected: 201,
  },
);
check(
  /^WO-\d{3}$/.test(workOrderOne.data.data.workOrderNumber) &&
    workOrderOne.data.data.approvalState === 'DRAFT',
  'V0.5-B Work Order did not retain agreement-local WO-### identity.',
);
await request(
  pm,
  '/subcontracts/work-orders/' + workOrderOne.data.data.id + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractWorkOrderWorkflowCode,
      actionKey: 'uat-v05b-wo1-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/work-orders/' + workOrderOne.data.data.id + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05b-wo1-maker-approve-' + suffix,
    },
    expected: 403,
  },
);
const approvedWorkOrderOne = await request(
  checker,
  '/subcontracts/work-orders/' + workOrderOne.data.data.id + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05b-wo1-approve-' + suffix,
    },
    expected: 201,
  },
);
check(
  approvedWorkOrderOne.data.data.approvalState === 'APPROVED',
  'V0.5-B configured checker could not approve a Work Order.',
);

const workOrderTwo = await request(
  pm,
  '/subcontracts/agreements/' + agreementId + '/work-orders',
  {
    method: 'POST',
    json: {
      scopeOfWork: 'Groundworks over-allocation probe ' + suffix,
      amount: '60000.00',
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/work-orders/' + workOrderTwo.data.data.id + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractWorkOrderWorkflowCode,
      actionKey: 'uat-v05b-wo2-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  checker,
  '/subcontracts/work-orders/' + workOrderTwo.data.data.id + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05b-wo2-over-ceiling-' + suffix,
    },
    expected: 409,
  },
);
const rejectedWorkOrderTwo = await request(
  checker,
  '/subcontracts/work-orders/' + workOrderTwo.data.data.id + '/reject',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05b-wo2-reject-' + suffix,
      comment: 'Rejected after the ceiling guard proof.',
    },
    expected: 201,
  },
);
check(
  rejectedWorkOrderTwo.data.data.approvalState === 'REJECTED',
  'V0.5-B over-ceiling Work Order did not remain available for a retained rejection.',
);
await request(
  pm,
  '/subcontracts/agreements/' + agreementId + '/cancel',
  {
    method: 'POST',
    json: {
      reason: 'Cancellation guard probe',
      actionKey: 'uat-v05b-cancel-blocked-' + suffix,
    },
    expected: 409,
  },
);
await request(
  unassigned,
  '/subcontracts/work-orders/' + workOrderOne.data.data.id,
  { expected: 403 },
);
const agreementVersions = await request(
  pm,
  '/subcontracts/agreements/' + agreementId + '/versions',
);
check(
  agreementVersions.data.data.length === 2 &&
    agreementVersions.data.data.every(
      (version) =>
        String(version.originalValue) === '125000' &&
        version.currencyCode === 'SGD',
    ),
  'V0.5-B retained Agreement versions lost the approved commercial snapshot.',
);

const cancellableAgreement = await request(pm, '/subcontracts/agreements', {
  method: 'POST',
  json: {
    projectId,
    subcontractorId,
    originalValue: '1000.00',
    scopeOfWork: 'Cancellation-only package ' + suffix,
    currencyCode: 'SGD',
    operationalStatusId: subcontractStatus.data.data.id,
    createKey: 'uat-v05b-cancellable-' + suffix,
  },
  expected: 201,
});
await request(
  pm,
  '/subcontracts/agreements/' + cancellableAgreement.data.data.id + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractAgreementWorkflowCode,
      actionKey: 'uat-v05b-cancellable-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  checker,
  '/subcontracts/agreements/' + cancellableAgreement.data.data.id + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05b-cancellable-approve-' + suffix,
    },
    expected: 201,
  },
);
const cancelledAgreement = await request(
  pm,
  '/subcontracts/agreements/' + cancellableAgreement.data.data.id + '/cancel',
  {
    method: 'POST',
    json: {
      reason: 'Package withdrawn in live acceptance',
      actionKey: 'uat-v05b-cancellable-cancel-' + suffix,
    },
    expected: 201,
  },
);
check(
  cancelledAgreement.data.data.approvalState === 'CANCELLED' &&
    cancelledAgreement.data.data.cancellationReason ===
      'Package withdrawn in live acceptance',
  'V0.5-B Agreement cancellation did not retain audited cancellation evidence.',
);
record('V0.5-B configured maker-checker Agreement/Revision/Work Order lifecycle, ceiling guard, stable retries, cancellation guard and Project authorization');

const claimAgreementOptions = await request(
  pm,
  '/subcontracts/claim-agreement-options',
);
check(
  claimAgreementOptions.data.data.some((item) => item.id === agreementId),
  'V0.5-C Claim Agreement selector did not expose the authorized approved Agreement.',
);
const unassignedClaimAgreementOptions = await request(
  unassigned,
  '/subcontracts/claim-agreement-options',
);
check(
  !unassignedClaimAgreementOptions.data.data.some(
    (item) => item.id === agreementId,
  ),
  'V0.5-C Claim Agreement selector exposed an unauthorized Project.',
);

const claimOptions = await request(
  pm,
  '/subcontracts/agreements/' + agreementId + '/claim-options',
);
check(
  claimOptions.data.data.workOrders.some(
    (item) => item.id === workOrderOne.data.data.id,
  ) &&
    !claimOptions.data.data.workOrders.some(
      (item) => item.id === workOrderTwo.data.data.id,
    ),
  'V0.5-C Claim options did not expose only approved same-Agreement Work Orders.',
);

const stageCClaim = await request(
  pm,
  '/subcontracts/agreements/' + agreementId + '/claims',
  {
    method: 'POST',
    json: {
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    },
    expected: 201,
  },
);
const stageCClaimId = stageCClaim.data.data.id;
check(
  /^SCL\d{4}-\d{3}$/.test(stageCClaim.data.data.claimNumber) &&
    stageCClaim.data.data.state === 'DRAFT',
  'V0.5-C Claim Draft did not retain the approved SCLYYMM-### identity and Draft state.',
);

const stageCClaimLine = await request(
  pm,
  '/subcontracts/claims/' + stageCClaimId + '/lines',
  {
    method: 'POST',
    json: {
      amount: '50000.00',
      workOrderId: workOrderOne.data.data.id,
    },
    expected: 201,
  },
);
check(
  stageCClaimLine.data.data.workOrderId === workOrderOne.data.data.id &&
    Number(stageCClaimLine.data.data.amount) === 50000,
  'V0.5-C Claim line did not retain the approved Work Order allocation.',
);

const submittedStageCClaim = await request(
  pm,
  '/subcontracts/claims/' + stageCClaimId + '/submit',
  {
    method: 'POST',
    json: { actionKey: 'uat-v05c-claim-submit-' + suffix },
    expected: 201,
  },
);
check(
  submittedStageCClaim.data.data.state === 'SUBMITTED',
  'V0.5-C Claim did not enter SUBMITTED state.',
);
const replayedStageCClaim = await request(
  pm,
  '/subcontracts/claims/' + stageCClaimId + '/submit',
  {
    method: 'POST',
    json: { actionKey: 'uat-v05c-claim-submit-' + suffix },
    expected: 201,
  },
);
check(
  replayedStageCClaim.data.data.id === stageCClaimId &&
    replayedStageCClaim.data.data.state === 'SUBMITTED',
  'V0.5-C stable submit retry did not return the same visible Claim.',
);

await request(
  pm,
  '/subcontracts/agreements/' + agreementId + '/claims',
  {
    method: 'POST',
    json: {
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    },
    expected: 409,
  },
);
await request(pm, '/subcontracts/claims/' + stageCClaimId, {
  method: 'PATCH',
  json: { periodEnd: '2026-11-01' },
  expected: 409,
});
await request(pm, '/subcontracts/claim-lines/' + stageCClaimLine.data.data.id, {
  method: 'PATCH',
  json: { amount: '49999.00' },
  expected: 409,
});

const overWorkOrderClaim = await request(
  pm,
  '/subcontracts/agreements/' + agreementId + '/claims',
  {
    method: 'POST',
    json: {
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/claims/' + overWorkOrderClaim.data.data.id + '/lines',
  {
    method: 'POST',
    json: {
      amount: '30000.00',
      workOrderId: workOrderOne.data.data.id,
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/claims/' + overWorkOrderClaim.data.data.id + '/submit',
  {
    method: 'POST',
    json: { actionKey: 'uat-v05c-wo-overclaim-' + suffix },
    expected: 409,
  },
);

const assessedStageCClaim = await request(
  checker,
  '/subcontracts/claims/' + stageCClaimId + '/assess',
  {
    method: 'POST',
    json: {
      assessedAmount: '45000.00',
      reason: 'Accepted lower assessed value in live acceptance.',
      actionKey: 'uat-v05c-assess-' + suffix,
    },
    expected: 201,
  },
);
check(
  assessedStageCClaim.data.data.state === 'ASSESSED' &&
    Number(assessedStageCClaim.data.data.lines[0]?.amount) === 50000 &&
    Number(assessedStageCClaim.data.data.assessment?.assessedAmount) === 45000,
  'V0.5-C Assessment did not preserve claimed and assessed values separately.',
);
const replayedAssessment = await request(
  checker,
  '/subcontracts/claims/' + stageCClaimId + '/assess',
  {
    method: 'POST',
    json: {
      assessedAmount: '45000.00',
      reason: 'Accepted lower assessed value in live acceptance.',
      actionKey: 'uat-v05c-assess-' + suffix,
    },
    expected: 201,
  },
);
check(
  replayedAssessment.data.data.state === 'ASSESSED' &&
    Number(replayedAssessment.data.data.assessment?.assessedAmount) === 45000,
  'V0.5-C stable Assessment retry did not return the retained decision.',
);

const rejectedAssessment = await request(
  checker,
  '/subcontracts/claims/' + stageCClaimId + '/assessment/reject',
  {
    method: 'POST',
    json: {
      reason: 'Correction requires a replacement Claim.',
      actionKey: 'uat-v05c-assessment-reject-' + suffix,
    },
    expected: 201,
  },
);
check(
  rejectedAssessment.data.data.state === 'REJECTED' &&
    rejectedAssessment.data.data.assessment?.state === 'REJECTED' &&
    Number(rejectedAssessment.data.data.lines[0]?.amount) === 50000 &&
    Number(rejectedAssessment.data.data.assessment?.assessedAmount) === 45000,
  'V0.5-C Assessment rejection rewrote retained Claim or Assessment values.',
);

const replacementClaim = await request(
  pm,
  '/subcontracts/claims/' + stageCClaimId + '/replacements',
  {
    method: 'POST',
    json: {},
    expected: 201,
  },
);
check(
  replacementClaim.data.data.state === 'DRAFT' &&
    replacementClaim.data.data.replacementForClaimId === stageCClaimId,
  'V0.5-C linked replacement Claim did not retain predecessor lineage.',
);
await request(
  pm,
  '/subcontracts/claims/' + replacementClaim.data.data.id + '/lines',
  {
    method: 'POST',
    json: {
      amount: '50000.00',
      workOrderId: workOrderOne.data.data.id,
    },
    expected: 201,
  },
);
const submittedReplacementClaim = await request(
  pm,
  '/subcontracts/claims/' + replacementClaim.data.data.id + '/submit',
  {
    method: 'POST',
    json: { actionKey: 'uat-v05c-replacement-submit-' + suffix },
    expected: 201,
  },
);
check(
  submittedReplacementClaim.data.data.state === 'SUBMITTED',
  'V0.5-C replacement Claim could not be submitted after rejection released the prior active ceiling.',
);
const replacedSourceClaim = await request(
  pm,
  '/subcontracts/claims/' + stageCClaimId,
);
check(
  replacedSourceClaim.data.data.state === 'REPLACED' &&
    replacedSourceClaim.data.data.replacementClaim?.id ===
      replacementClaim.data.data.id,
  'V0.5-C predecessor Claim did not retain replacement history after replacement submission.',
);
await request(
  unassigned,
  '/subcontracts/claims/' + replacementClaim.data.data.id,
  { expected: 403 },
);

const claimGuardAgreement = await request(pm, '/subcontracts/agreements', {
  method: 'POST',
  json: {
    projectId,
    subcontractorId,
    originalValue: '1000.00',
    scopeOfWork: 'Stage C Claim cancellation guard ' + suffix,
    currencyCode: 'SGD',
    operationalStatusId: subcontractStatus.data.data.id,
    createKey: 'uat-v05c-claim-guard-agreement-' + suffix,
  },
  expected: 201,
});
await request(
  pm,
  '/subcontracts/agreements/' + claimGuardAgreement.data.data.id + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractAgreementWorkflowCode,
      actionKey: 'uat-v05c-claim-guard-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  checker,
  '/subcontracts/agreements/' + claimGuardAgreement.data.data.id + '/approve',
  {
    method: 'POST',
    json: { actionKey: 'uat-v05c-claim-guard-approve-' + suffix },
    expected: 201,
  },
);
const claimGuardClaim = await request(
  pm,
  '/subcontracts/agreements/' + claimGuardAgreement.data.data.id + '/claims',
  {
    method: 'POST',
    json: {
      periodStart: '2026-12-01',
      periodEnd: '2026-12-31',
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/claims/' + claimGuardClaim.data.data.id + '/lines',
  {
    method: 'POST',
    json: { amount: '600.00' },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/claims/' + claimGuardClaim.data.data.id + '/submit',
  {
    method: 'POST',
    json: { actionKey: 'uat-v05c-claim-guard-claim-submit-' + suffix },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/agreements/' + claimGuardAgreement.data.data.id + '/cancel',
  {
    method: 'POST',
    json: {
      reason: 'Must remain blocked by the active Claim.',
      actionKey: 'uat-v05c-active-claim-cancel-' + suffix,
    },
    expected: 409,
  },
);

const overAgreementClaim = await request(
  pm,
  '/subcontracts/agreements/' + claimGuardAgreement.data.data.id + '/claims',
  {
    method: 'POST',
    json: {
      periodStart: '2027-01-01',
      periodEnd: '2027-01-31',
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/claims/' + overAgreementClaim.data.data.id + '/lines',
  {
    method: 'POST',
    json: { amount: '500.00' },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/claims/' + overAgreementClaim.data.data.id + '/submit',
  {
    method: 'POST',
    json: { actionKey: 'uat-v05c-agreement-overclaim-' + suffix },
    expected: 409,
  },
);

record('V0.5-C Claim Draft/line/submit lifecycle, exact-period and cumulative ceilings, immutable submitted source, lower Assessment, rejection/replacement history, retry safety, Claim-specific cancellation guard and Project authorization');

const stageDAgreement = await request(pm, '/subcontracts/agreements', {
  method: 'POST',
  json: {
    projectId,
    subcontractorId,
    originalValue: '1000.00',
    scopeOfWork: 'Stage D certification and retention package ' + suffix,
    currencyCode: 'SGD',
    retentionRate: '2.50',
    retentionCap: '5.01',
    operationalStatusId: subcontractStatus.data.data.id,
    createKey: 'uat-v05d-agreement-' + suffix,
  },
  expected: 201,
});
const stageDAgreementId = stageDAgreement.data.data.id;
check(
  stageDAgreement.data.data.approvalState === 'DRAFT' &&
    Number(stageDAgreement.data.data.retentionRate) === 2.5 &&
    Number(stageDAgreement.data.data.retentionCap) === 5.01,
  'V0.5-D Agreement Draft did not retain retention rate/cap.',
);
await request(
  pm,
  '/subcontracts/agreements/' + stageDAgreementId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractAgreementWorkflowCode,
      actionKey: 'uat-v05d-agreement-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/agreements/' + stageDAgreementId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05d-agreement-maker-approve-' + suffix,
    },
    expected: 403,
  },
);
const approvedStageDAgreement = await request(
  checker,
  '/subcontracts/agreements/' + stageDAgreementId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05d-agreement-approve-' + suffix,
      comment: 'Approve Stage D retention terms.',
    },
    expected: 201,
  },
);
check(
  approvedStageDAgreement.data.data.approvalState === 'APPROVED' &&
    Number(approvedStageDAgreement.data.data.retentionRate) === 2.5 &&
    Number(approvedStageDAgreement.data.data.retentionCap) === 5.01,
  'V0.5-D Agreement approval did not freeze the retention terms.',
);

async function createStageDAssessedClaim({
  periodStart,
  periodEnd,
  amount,
  key,
}) {
  const claim = await request(
    pm,
    '/subcontracts/agreements/' + stageDAgreementId + '/claims',
    {
      method: 'POST',
      json: { periodStart, periodEnd },
      expected: 201,
    },
  );
  await request(pm, '/subcontracts/claims/' + claim.data.data.id + '/lines', {
    method: 'POST',
    json: { amount },
    expected: 201,
  });
  await request(pm, '/subcontracts/claims/' + claim.data.data.id + '/submit', {
    method: 'POST',
    json: { actionKey: 'uat-v05d-claim-submit-' + key + '-' + suffix },
    expected: 201,
  });
  return request(
    checker,
    '/subcontracts/claims/' + claim.data.data.id + '/assess',
    {
      method: 'POST',
      json: {
        assessedAmount: amount,
        reason: 'Accepted Stage D measured progress.',
        actionKey: 'uat-v05d-assess-' + key + '-' + suffix,
      },
      expected: 201,
    },
  );
}

const stageDClaimOne = await createStageDAssessedClaim({
  periodStart: '2027-02-01',
  periodEnd: '2027-02-28',
  amount: '100.00',
  key: 'one',
});
const stageDClaimOneId = stageDClaimOne.data.data.id;
const stageDCertOne = await request(
  pm,
  '/subcontracts/claims/' + stageDClaimOneId + '/certifications',
  {
    method: 'POST',
    json: { certifiedGross: '100.00' },
    expected: 201,
  },
);
const stageDCertOneId = stageDCertOne.data.data.id;
check(
  /^SCT\d{4}-\d{3}$/.test(stageDCertOne.data.data.certificationNumber) &&
    stageDCertOne.data.data.state === 'DRAFT',
  'V0.5-D Certification Draft did not retain SCTYYMM-### identity.',
);
await request(
  unassigned,
  '/subcontracts/certifications/' + stageDCertOneId,
  { expected: 403 },
);
await request(
  admin,
  '/subcontracts/certifications/' + stageDCertOneId,
  { expected: 403 },
);
await request(
  pm,
  '/subcontracts/certifications/' + stageDCertOneId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractCertificationWorkflowCode,
      actionKey: 'uat-v05d-cert-one-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/certifications/' + stageDCertOneId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05d-cert-one-maker-approve-' + suffix,
    },
    expected: 403,
  },
);
const approvedStageDCertOne = await request(
  checker,
  '/subcontracts/certifications/' + stageDCertOneId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05d-cert-one-approve-' + suffix,
      comment: 'Configured checker final approval.',
    },
    expected: 201,
  },
);
check(
  approvedStageDCertOne.data.data.state === 'APPROVED' &&
    Number(approvedStageDCertOne.data.data.assessedAmountSnapshot) === 100 &&
    Number(approvedStageDCertOne.data.data.certifiedGross) === 100 &&
    Number(approvedStageDCertOne.data.data.retentionRateSnapshot) === 2.5 &&
    Number(approvedStageDCertOne.data.data.retentionCapSnapshot) === 5.01 &&
    Number(approvedStageDCertOne.data.data.retainedBeforeSnapshot) === 0 &&
    Number(approvedStageDCertOne.data.data.retainedAmount) === 2.5 &&
    Number(approvedStageDCertOne.data.data.netCertifiedAmount) === 97.5,
  'V0.5-D first Certification did not preserve gross/retention/net snapshots.',
);
const replayedStageDCertOne = await request(
  checker,
  '/subcontracts/certifications/' + stageDCertOneId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05d-cert-one-approve-' + suffix,
      comment: 'Configured checker final approval.',
    },
    expected: 201,
  },
);
check(
  replayedStageDCertOne.data.data.id === stageDCertOneId &&
    replayedStageDCertOne.data.data.state === 'APPROVED',
  'V0.5-D stable Certification approval retry duplicated the decision.',
);

const stageDRetentionProjects = await request(pm, '/finance/retention-projects');
check(
  stageDRetentionProjects.data.data.some((item) => item.id === projectId),
  'V0.6-D retention Project selector omitted the authorized Project.',
);
await request(admin, '/finance/retention-projects', { expected: 403 });
await request(
  unassigned,
  '/finance/projects/' + projectId + '/retention',
  { expected: 403 },
);
const stageDRetentionActive = await request(
  pm,
  '/finance/projects/' + projectId + '/retention',
);
const stageDCertOneRetention = stageDRetentionActive.data.data.find(
  (item) => item.id === stageDCertOneId,
);
check(
  stageDCertOneRetention &&
    stageDCertOneRetention.financeState === 'ACTIVE' &&
    Number(stageDCertOneRetention.retainedAmount) === 2.5 &&
    Number(stageDCertOneRetention.retentionBalance) === 2.5 &&
    stageDCertOneRetention.retentionLedgerEntries.length === 1 &&
    stageDCertOneRetention.retentionLedgerEntries[0]?.entryType === 'WITHHOLDING',
  'V0.6-D payable retention did not expose the immutable Certification withholding evidence.',
);
record('V0.6-D base-currency Certification approval materializes payable retention withholding with SYS_ADMIN and Project denial');

const stageDClaimTwo = await createStageDAssessedClaim({
  periodStart: '2027-03-01',
  periodEnd: '2027-03-31',
  amount: '100.20',
  key: 'two',
});
const stageDClaimTwoId = stageDClaimTwo.data.data.id;
await request(
  pm,
  '/subcontracts/claims/' + stageDClaimTwoId + '/certifications',
  {
    method: 'POST',
    json: { certifiedGross: '100.21' },
    expected: 422,
  },
);
const stageDCertTwo = await request(
  pm,
  '/subcontracts/claims/' + stageDClaimTwoId + '/certifications',
  {
    method: 'POST',
    json: { certifiedGross: '100.20' },
    expected: 201,
  },
);
const stageDCertTwoId = stageDCertTwo.data.data.id;
await request(
  pm,
  '/subcontracts/certifications/' + stageDCertTwoId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractCertificationWorkflowCode,
      actionKey: 'uat-v05d-cert-two-submit-' + suffix,
    },
    expected: 201,
  },
);
const approvedStageDCertTwo = await request(
  checker,
  '/subcontracts/certifications/' + stageDCertTwoId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05d-cert-two-approve-' + suffix,
      comment: 'Approve half-up and remaining-cap evidence.',
    },
    expected: 201,
  },
);
check(
  approvedStageDCertTwo.data.data.state === 'APPROVED' &&
    Number(approvedStageDCertTwo.data.data.assessedAmountSnapshot) === 100.2 &&
    Number(approvedStageDCertTwo.data.data.certifiedGross) === 100.2 &&
    Number(approvedStageDCertTwo.data.data.retainedBeforeSnapshot) === 2.5 &&
    Number(approvedStageDCertTwo.data.data.retainedAmount) === 2.51 &&
    Number(approvedStageDCertTwo.data.data.netCertifiedAmount) === 97.69,
  'V0.5-D half-up retention and remaining aggregate cap were not applied correctly.',
);

const stageDCertificationHistory = await request(
  pm,
  '/subcontracts/agreements/' + stageDAgreementId + '/certifications',
);
check(
  stageDCertificationHistory.data.data.length === 2 &&
    stageDCertificationHistory.data.data.some(
      (item) =>
        item.id === stageDCertOneId &&
        Number(item.retainedAmount) === 2.5,
    ) &&
    stageDCertificationHistory.data.data.some(
      (item) =>
        item.id === stageDCertTwoId &&
        Number(item.retainedAmount) === 2.51,
    ),
  'V0.5-D retained Certification history did not preserve both approved snapshots.',
);
check(
  !('paymentStatus' in approvedStageDCertTwo.data.data) &&
    !('invoiceId' in approvedStageDCertTwo.data.data) &&
    !('paymentId' in approvedStageDCertTwo.data.data),
  'V0.5-D Certification unexpectedly exposed a payment or Finance posting effect.',
);

// V0.6-C settlement hand-off: the approved Certification remains owned by
// Subcontracts while Finance retains the canonical Payment/allocation evidence.
const subcontractPaymentOptions = await request(
  pm,
  '/finance/projects/' + projectId + '/payment-options',
);
check(
  subcontractPaymentOptions.data.data.certifications.some(
    (item) =>
      item.id === stageDCertTwoId &&
      item.agreement?.subcontractorId === subcontractorId &&
      Number(item.netCertifiedAmount) === 97.69,
  ),
  'V0.6-C Payment options did not expose the approved same-Project Certification payable ceiling.',
);
const subcontractPayment = await request(
  pm,
  '/finance/projects/' + projectId + '/payments',
  {
    method: 'POST',
    json: {
      direction: 'OUTBOUND',
      paymentDate: '2027-03-15',
      subcontractorId,
      amount: '100.00',
      paymentMethod: 'BANK_TRANSFER',
      reference: 'Subcontract certification settlement ' + suffix,
      createKey: 'pay-sub-create-' + suffix,
    },
    expected: 201,
  },
);
const subcontractPaymentId = subcontractPayment.data.data.id;
check(
  /^PAY2703-\d{3}$/.test(subcontractPayment.data.data.paymentNumber) &&
    subcontractPayment.data.data.projectId === projectId &&
    subcontractPayment.data.data.subcontractorId === subcontractorId &&
    subcontractPayment.data.data.paymentDirection === 'OUTBOUND',
  'V0.6-C Subcontract Payment did not retain its required Project/direction/counterparty identity.',
);
await request(
  pm,
  '/finance/payments/' + subcontractPaymentId + '/allocations',
  {
    method: 'POST',
    json: {
      targetType: 'SUBCONTRACT_CERTIFICATION',
      targetId: stageDCertTwoId,
      amount: '97.70',
      actionKey: 'pay-sub-over-net-' + suffix,
    },
    expected: 409,
  },
);
const subcontractAllocation = await request(
  pm,
  '/finance/payments/' + subcontractPaymentId + '/allocations',
  {
    method: 'POST',
    json: {
      targetType: 'SUBCONTRACT_CERTIFICATION',
      targetId: stageDCertTwoId,
      amount: '50.00',
      actionKey: 'pay-sub-alloc-' + suffix,
    },
    expected: 201,
  },
);
check(
  subcontractAllocation.data.data.subcontractAllocations.length === 1 &&
    subcontractAllocation.data.data.subcontractAllocations[0]
      ?.subcontractCertification?.id === stageDCertTwoId &&
    String(
      subcontractAllocation.data.data.subcontractAllocations[0]?.allocatedAmount,
    ) === '50',
  'V0.6-C Subcontract allocation did not retain Certification settlement evidence.',
);
await request(
  pm,
  '/finance/payments/' + subcontractPaymentId + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: paymentWorkflowCode,
      actionKey: 'pay-sub-submit-' + suffix,
    },
    expected: 201,
  },
);
const approvedSubcontractPayment = await request(
  checker,
  '/finance/payments/' + subcontractPaymentId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'pay-sub-approve-' + suffix,
      comment: 'Approve Certification settlement.',
    },
    expected: 201,
  },
);
check(
  approvedSubcontractPayment.data.data.state === 'APPROVED' &&
    approvedSubcontractPayment.data.data.subcontractAllocations.length === 1,
  'V0.6-C Subcontract Payment approval did not retain active Certification allocation evidence.',
);
const approvedCertificationPaymentReference = await request(
  pm,
  '/subcontracts/certifications/' + stageDCertTwoId + '/finance-reference',
);
check(
  approvedCertificationPaymentReference.data.data.allocations.length === 1 &&
    approvedCertificationPaymentReference.data.data.allocations[0]?.payment.id ===
      subcontractPaymentId &&
    approvedCertificationPaymentReference.data.data.allocations[0]?.payment.state ===
      'APPROVED' &&
    String(
      approvedCertificationPaymentReference.data.data.allocations[0]
        ?.allocatedAmount,
    ) === '50',
  'V0.6-D Subcontract read model did not expose the Finance-owned approved Payment reference.',
);
await request(
  admin,
  '/subcontracts/certifications/' + stageDCertTwoId + '/finance-reference',
  { expected: 403 },
);
await request(
  unassigned,
  '/subcontracts/certifications/' + stageDCertTwoId + '/finance-reference',
  { expected: 403 },
);
await request(
  checker,
  '/subcontracts/certifications/' + stageDCertTwoId + '/reverse',
  {
    method: 'POST',
    json: {
      reason: 'Must remain blocked while Finance allocation is active.',
      actionKey: 'uat-v06c-blocked-cert-reverse-' + suffix,
    },
    expected: 409,
  },
);
const cancelledSubcontractPayment = await request(
  pm,
  '/finance/payments/' + subcontractPaymentId + '/cancel',
  {
    method: 'POST',
    json: {
      actionKey: 'pay-sub-cancel-' + suffix,
      reason: 'Cancel settlement before Certification correction.',
    },
    expected: 201,
  },
);
check(
  cancelledSubcontractPayment.data.data.state === 'CANCELLED' &&
    cancelledSubcontractPayment.data.data.subcontractAllocations.length === 1,
  'V0.6-C Subcontract Payment cancellation did not retain historical allocation evidence.',
);
const cancelledCertificationPaymentReference = await request(
  pm,
  '/subcontracts/certifications/' + stageDCertTwoId + '/finance-reference',
);
check(
  cancelledCertificationPaymentReference.data.data.allocations.length === 1 &&
    cancelledCertificationPaymentReference.data.data.allocations[0]?.payment.state ===
      'CANCELLED' &&
    cancelledCertificationPaymentReference.data.data.allocations[0]?.payment
      .cancellationReason ===
      'Cancel settlement before Certification correction.',
  'V0.6-D Subcontract Payment reference did not retain Finance cancellation history.',
);
record('V0.6-C Subcontract Certification settlement enforces net-certified ceiling, blocks reversal while active, and releases the reversal guard only after Finance cancellation');

const reversedStageDCertTwo = await request(
  checker,
  '/subcontracts/certifications/' + stageDCertTwoId + '/reverse',
  {
    method: 'POST',
    json: {
      reason: 'Correct the assessed Claim through linked replacement.',
      actionKey: 'uat-v05d-cert-two-reverse-' + suffix,
    },
    expected: 201,
  },
);
check(
  reversedStageDCertTwo.data.data.state === 'REVERSED' &&
    reversedStageDCertTwo.data.data.reversedAt &&
    reversedStageDCertTwo.data.data.reversedBy &&
    reversedStageDCertTwo.data.data.reversalReason ===
      'Correct the assessed Claim through linked replacement.' &&
    Number(reversedStageDCertTwo.data.data.retainedAmount) === 2.51 &&
    Number(reversedStageDCertTwo.data.data.netCertifiedAmount) === 97.69,
  'V0.5-D reversal did not retain original Certification snapshots and reversal evidence.',
);
const stageDRetentionReversed = await request(
  pm,
  '/finance/projects/' + projectId + '/retention',
);
const stageDCertTwoRetention = stageDRetentionReversed.data.data.find(
  (item) => item.id === stageDCertTwoId,
);
check(
  stageDCertTwoRetention &&
    stageDCertTwoRetention.financeState === 'REVERSED' &&
    Number(stageDCertTwoRetention.retentionBalance) === 0 &&
    stageDCertTwoRetention.retentionLedgerEntries.length === 2 &&
    stageDCertTwoRetention.retentionLedgerEntries.some(
      (entry) => entry.entryType === 'WITHHOLDING',
    ) &&
    stageDCertTwoRetention.retentionLedgerEntries.some(
      (entry) => entry.entryType === 'REVERSAL' && entry.reversesEntryId,
    ),
  'V0.6-D Certification reversal did not retain the linked compensating retention-withholding correction.',
);
record('V0.6-D Finance retention balance preserves linked withholding/reversal evidence without implementing retention release or manual adjustment');

const stageDReplacement = await request(
  pm,
  '/subcontracts/claims/' + stageDClaimTwoId + '/replacements',
  {
    method: 'POST',
    json: {},
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/claims/' + stageDReplacement.data.data.id + '/lines',
  {
    method: 'POST',
    json: { amount: '99.00' },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/claims/' + stageDReplacement.data.data.id + '/submit',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05d-replacement-submit-' + suffix,
    },
    expected: 201,
  },
);
const replacedStageDSource = await request(
  pm,
  '/subcontracts/claims/' + stageDClaimTwoId,
);
check(
  replacedStageDSource.data.data.state === 'REPLACED' &&
    replacedStageDSource.data.data.replacementClaim?.id ===
      stageDReplacement.data.data.id,
  'V0.5-D reversed Certification did not restore the approved linked replacement Claim path.',
);

record('V0.5-D Payment Certification, maker-checker, Project/permission denial, distinct gross/assessment values, half-up capped retention withholding, net certification, retry safety, retained reversal history, linked Claim correction and no Finance/payment posting');

const stageEAgreement = await request(pm, '/subcontracts/agreements', {
  method: 'POST',
  json: {
    projectId,
    subcontractorId,
    originalValue: '1000.00',
    scopeOfWork: 'Stage E Variation and reporting package ' + suffix,
    currencyCode: 'SGD',
    retentionRate: '5.00',
    operationalStatusId: subcontractStatus.data.data.id,
    createKey: 'uat-v05e-agreement-' + suffix,
  },
  expected: 201,
});
const stageEAgreementId = stageEAgreement.data.data.id;
await request(pm, '/subcontracts/agreements/' + stageEAgreementId + '/submit', {
  method: 'POST',
  json: {
    workflowCode: subcontractAgreementWorkflowCode,
    actionKey: 'uat-v05e-agreement-submit-' + suffix,
  },
  expected: 201,
});
await request(checker, '/subcontracts/agreements/' + stageEAgreementId + '/approve', {
  method: 'POST',
  json: {
    actionKey: 'uat-v05e-agreement-approve-' + suffix,
    comment: 'Approve Stage E baseline Agreement.',
  },
  expected: 201,
});

const stageEWorkOrder = await request(
  pm,
  '/subcontracts/agreements/' + stageEAgreementId + '/work-orders',
  {
    method: 'POST',
    json: {
      scopeOfWork: 'Stage E measured works allocation',
      amount: '600.00',
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/work-orders/' + stageEWorkOrder.data.data.id + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractWorkOrderWorkflowCode,
      actionKey: 'uat-v05e-wo-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  checker,
  '/subcontracts/work-orders/' + stageEWorkOrder.data.data.id + '/approve',
  {
    method: 'POST',
    json: { actionKey: 'uat-v05e-wo-approve-' + suffix },
    expected: 201,
  },
);

const stageEClaim = await request(
  pm,
  '/subcontracts/agreements/' + stageEAgreementId + '/claims',
  {
    method: 'POST',
    json: {
      periodStart: '2027-06-01',
      periodEnd: '2027-06-30',
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/claims/' + stageEClaim.data.data.id + '/lines',
  {
    method: 'POST',
    json: {
      workOrderId: stageEWorkOrder.data.data.id,
      amount: '500.00',
    },
    expected: 201,
  },
);
await request(pm, '/subcontracts/claims/' + stageEClaim.data.data.id + '/submit', {
  method: 'POST',
  json: { actionKey: 'uat-v05e-claim-submit-' + suffix },
  expected: 201,
});
await request(
  checker,
  '/subcontracts/claims/' + stageEClaim.data.data.id + '/assess',
  {
    method: 'POST',
    json: {
      assessedAmount: '450.00',
      reason: 'Stage E measured progress accepted.',
      actionKey: 'uat-v05e-claim-assess-' + suffix,
    },
    expected: 201,
  },
);

const stageECertification = await request(
  pm,
  '/subcontracts/claims/' + stageEClaim.data.data.id + '/certifications',
  {
    method: 'POST',
    json: { certifiedGross: '400.00' },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/certifications/' + stageECertification.data.data.id + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractCertificationWorkflowCode,
      actionKey: 'uat-v05e-cert-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  checker,
  '/subcontracts/certifications/' + stageECertification.data.data.id + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05e-cert-approve-' + suffix,
      comment: 'Approve Stage E Certification.',
    },
    expected: 201,
  },
);

const stageEVariationPayload = {
  valueDelta: '250.00',
  scopeChange: 'Authorize additional Stage E scope.',
  reason: 'Approved commercial scope growth.',
  createKey: 'uat-v05e-var-create-' + suffix,
};
const stageEVariation = await request(
  pm,
  '/subcontracts/agreements/' + stageEAgreementId + '/variations',
  {
    method: 'POST',
    json: stageEVariationPayload,
    expected: 201,
  },
);
const stageEVariationId = stageEVariation.data.data.id;
check(
  /^SVO\d{4}-\d{3}$/.test(stageEVariation.data.data.variationNumber) &&
    stageEVariation.data.data.state === 'DRAFT' &&
    Number(stageEVariation.data.data.valueDelta) === 250 &&
    stageEVariation.data.data.currencyCode === 'SGD',
  'V0.5-E Variation did not retain SVOYYMM-### identity, signed delta or inherited currency.',
);
const stageEVariationRetry = await request(
  pm,
  '/subcontracts/agreements/' + stageEAgreementId + '/variations',
  {
    method: 'POST',
    json: stageEVariationPayload,
    expected: 201,
  },
);
check(
  stageEVariationRetry.data.data.id === stageEVariationId &&
    stageEVariationRetry.data.data.variationNumber ===
      stageEVariation.data.data.variationNumber,
  'V0.5-E stable Variation create retry produced duplicate commercial history.',
);
await request(unassigned, '/subcontracts/variations/' + stageEVariationId, {
  expected: 403,
});
await request(admin, '/subcontracts/variations/' + stageEVariationId, {
  expected: 403,
});
await request(pm, '/subcontracts/variations/' + stageEVariationId + '/submit', {
  method: 'POST',
  json: {
    workflowCode: subcontractVariationWorkflowCode,
    actionKey: 'uat-v05e-var-submit-' + suffix,
  },
  expected: 201,
});
await request(pm, '/subcontracts/variations/' + stageEVariationId + '/approve', {
  method: 'POST',
  json: { actionKey: 'uat-v05e-var-maker-approve-' + suffix },
  expected: 403,
});
const approvedStageEVariation = await request(
  checker,
  '/subcontracts/variations/' + stageEVariationId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05e-var-approve-' + suffix,
      comment: 'Configured checker approval.',
    },
    expected: 201,
  },
);
check(
  approvedStageEVariation.data.data.state === 'APPROVED' &&
    Number(approvedStageEVariation.data.data.valueDelta) === 250,
  'V0.5-E configured maker-checker did not approve the Variation.',
);
const replayedStageEVariationApproval = await request(
  checker,
  '/subcontracts/variations/' + stageEVariationId + '/approve',
  {
    method: 'POST',
    json: {
      actionKey: 'uat-v05e-var-approve-' + suffix,
      comment: 'Configured checker approval.',
    },
    expected: 201,
  },
);
check(
  replayedStageEVariationApproval.data.data.id === stageEVariationId &&
    replayedStageEVariationApproval.data.data.state === 'APPROVED',
  'V0.5-E stable Variation approval retry duplicated the decision.',
);

const stageDFinanceSubcontractTargets = await request(
  pm,
  '/documents/projects/' + projectId + '/targets/options',
);
check(
  stageDFinanceSubcontractTargets.data.data.supplierInvoices.some(
    (row) => row.id === supplierInvoiceId,
  ) &&
    stageDFinanceSubcontractTargets.data.data.clientInvoices.some(
      (row) => row.id === clientInvoiceId,
    ) &&
    stageDFinanceSubcontractTargets.data.data.payments.some(
      (row) => row.id === subcontractPaymentId,
    ) &&
    stageDFinanceSubcontractTargets.data.data.subcontractAgreements.some(
      (row) => row.id === stageEAgreementId,
    ) &&
    stageDFinanceSubcontractTargets.data.data.subcontractWorkOrders.some(
      (row) => row.id === stageEWorkOrder.data.data.id,
    ) &&
    stageDFinanceSubcontractTargets.data.data.subcontractClaims.some(
      (row) => row.id === stageEClaim.data.data.id,
    ) &&
    stageDFinanceSubcontractTargets.data.data.subcontractCertifications.some(
      (row) => row.id === stageECertification.data.data.id,
    ) &&
    stageDFinanceSubcontractTargets.data.data.subcontractVariations.some(
      (row) => row.id === stageEVariationId,
    ),
  'V0.6-D DOC-009 options did not expose all eight approved Finance/Subcontract target families.',
);
await request(
  unassigned,
  '/documents/projects/' + projectId + '/targets/options',
  { expected: 403 },
);
const stageDCertDocumentBytes = new TextEncoder().encode(
  '%PDF-1.4 Subcontract Certification evidence ' + suffix,
);
const stageDCertDocumentForm = new FormData();
stageDCertDocumentForm.set('documentTypeId', documentType.data.data.id);
stageDCertDocumentForm.set(
  'file',
  new Blob([stageDCertDocumentBytes], { type: 'application/pdf' }),
  'subcontract-certification-' + suffix + '.pdf',
);
const stageDCertDocument = await request(
  pm,
  '/documents/projects/' +
    projectId +
    '/targets/SUBCONTRACT_CERTIFICATION/' +
    stageECertification.data.data.id,
  {
    method: 'POST',
    body: stageDCertDocumentForm,
    expected: 201,
  },
);
const stageDCertDocumentList = await request(
  pm,
  '/documents/projects/' +
    projectId +
    '/targets/SUBCONTRACT_CERTIFICATION/' +
    stageECertification.data.data.id,
);
check(
  stageDCertDocumentList.data.data.some(
    (item) => item.id === stageDCertDocument.data.data.id,
  ) &&
    !JSON.stringify(stageDCertDocumentList.data).includes('storageKey'),
  'V0.6-D DOC-009 Certification document did not retain the secure canonical Documents boundary.',
);
const stageDCertDocumentDownload = await request(
  pm,
  '/documents/projects/' +
    projectId +
    '/targets/SUBCONTRACT_CERTIFICATION/' +
    stageECertification.data.data.id +
    '/' +
    stageDCertDocument.data.data.id +
    '/download',
  { accept: '*/*' },
);
const stageDCertDownloadedBytes = new Uint8Array(
  stageDCertDocumentDownload.data,
);
check(
  stageDCertDownloadedBytes.length === stageDCertDocumentBytes.length &&
    stageDCertDownloadedBytes.every(
      (value, index) => value === stageDCertDocumentBytes[index],
    ),
  'V0.6-D DOC-009 Certification document download did not retain original bytes.',
);
const archivedStageDCertDocument = await request(
  pm,
  '/documents/projects/' +
    projectId +
    '/targets/SUBCONTRACT_CERTIFICATION/' +
    stageECertification.data.data.id +
    '/' +
    stageDCertDocument.data.data.id +
    '/archive',
  { method: 'POST', expected: 201 },
);
check(
  archivedStageDCertDocument.data.data.isActive === false,
  'V0.6-D DOC-009 archive did not retain the document as inactive history.',
);
record('V0.6-D DOC-009 exposes all eight approved Finance/Subcontract targets through the canonical Project-owned Documents abstraction');

const stageEExpandedWorkOrder = await request(
  pm,
  '/subcontracts/agreements/' + stageEAgreementId + '/work-orders',
  {
    method: 'POST',
    json: {
      scopeOfWork: 'Allocation enabled by approved Variation',
      amount: '500.00',
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/work-orders/' + stageEExpandedWorkOrder.data.data.id + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractWorkOrderWorkflowCode,
      actionKey: 'uat-v05e-expanded-wo-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  checker,
  '/subcontracts/work-orders/' + stageEExpandedWorkOrder.data.data.id + '/approve',
  {
    method: 'POST',
    json: { actionKey: 'uat-v05e-expanded-wo-approve-' + suffix },
    expected: 201,
  },
);

const stageEReport = await request(
  pm,
  '/subcontracts/reports/agreements?projectId=' + projectId,
);
const stageEReportRow = stageEReport.data.data.find(
  (item) => item.id === stageEAgreementId,
);
check(
  stageEReportRow &&
    Number(stageEReportRow.originalValue) === 1000 &&
    Number(stageEReportRow.approvedVariationDelta) === 250 &&
    Number(stageEReportRow.currentCeiling) === 1250 &&
    Number(stageEReportRow.approvedWorkOrderAllocation) === 1100 &&
    Number(stageEReportRow.activeClaimedValue) === 500 &&
    Number(stageEReportRow.assessedValue) === 450 &&
    Number(stageEReportRow.certifiedGross) === 400 &&
    Number(stageEReportRow.withheldRetention) === 20 &&
    Number(stageEReportRow.netCertification) === 380,
  'V0.5-E source-derived reporting did not keep Agreement, Variation, Work Order, Claim, Assessment, Certification, retention and net values distinct.',
);
check(
  !('actualCost' in stageEReportRow) &&
    !('paidCost' in stageEReportRow) &&
    !('paymentStatus' in stageEReportRow),
  'V0.5-E reporting exposed a prohibited Actual Cost, Paid Cost or settlement field.',
);
await request(
  unassigned,
  '/subcontracts/reports/agreements?projectId=' + projectId,
  { expected: 403 },
);
const unassignedStageEReport = await request(
  unassigned,
  '/subcontracts/reports/agreements',
);
check(
  !unassignedStageEReport.data.data.some(
    (item) => item.id === stageEAgreementId,
  ),
  'V0.5-E reporting leaked an unauthorized Project row through an unfiltered request.',
);

const reducingVariation = await request(
  pm,
  '/subcontracts/agreements/' + stageEAgreementId + '/variations',
  {
    method: 'POST',
    json: {
      valueDelta: '-900.00',
      scopeChange: 'Attempt unsafe commercial reduction.',
      reason: 'Protected-ceiling guard proof.',
      createKey: 'uat-v05e-reducing-var-' + suffix,
    },
    expected: 201,
  },
);
await request(
  pm,
  '/subcontracts/variations/' + reducingVariation.data.data.id + '/submit',
  {
    method: 'POST',
    json: {
      workflowCode: subcontractVariationWorkflowCode,
      actionKey: 'uat-v05e-reducing-submit-' + suffix,
    },
    expected: 201,
  },
);
await request(
  checker,
  '/subcontracts/variations/' + reducingVariation.data.data.id + '/approve',
  {
    method: 'POST',
    json: { actionKey: 'uat-v05e-reducing-approve-' + suffix },
    expected: 409,
  },
);
await request(
  checker,
  '/subcontracts/variations/' + reducingVariation.data.data.id + '/reject',
  {
    method: 'POST',
    json: {
      reason: 'Rejected after protected-ceiling proof.',
      actionKey: 'uat-v05e-reducing-reject-' + suffix,
    },
    expected: 201,
  },
);

await request(
  checker,
  '/subcontracts/variations/' + stageEVariationId + '/reverse',
  {
    method: 'POST',
    json: {
      reason: 'Would reduce below approved Work Order allocation.',
      actionKey: 'uat-v05e-positive-reverse-blocked-' + suffix,
    },
    expected: 409,
  },
);
const afterBlockedReverseReport = await request(
  pm,
  '/subcontracts/reports/agreements?projectId=' + projectId,
);
check(
  Number(
    afterBlockedReverseReport.data.data.find(
      (item) => item.id === stageEAgreementId,
    )?.currentCeiling,
  ) === 1250,
  'V0.5-E blocked Variation reversal changed the retained commercial ceiling.',
);

record('V0.5-E authenticated Agreement -> Work Order -> Claim -> Assessment -> Certification/retention -> Variation -> source-derived reporting walkthrough, maker-checker, stable retry, reducing/reversal guards and unauthorized Project denial');


await request(pm, '/subcontracts/subcontractors/' + subcontractorId + '/archive', {
  method: 'POST',
  expected: 201,
});
await request(pm, '/subcontracts/agreements', {
  method: 'POST',
  json: {
    ...agreementPayload,
    createKey: 'uat-v05a-archived-' + suffix,
  },
  expected: 422,
});
const retainedAgreement = await request(
  pm,
  '/subcontracts/agreements/' + agreementId,
);
check(
  retainedAgreement.data.data.id === agreementId &&
    retainedAgreement.data.data.subcontractor.id === subcontractorId,
  'Archiving the Subcontractor hid retained agreement history.',
);
record('V0.5-A Project-scoped agreement Draft, immutable numbering, idempotent retry, archive guard and unauthorized Project denial');

const warehouse = await request(pm, '/inventory/warehouses', {
  method: 'POST',
  json: {
    warehouseCode: 'WH-' + suffix,
    warehouseName: 'Factory Site Store ' + suffix,
    projectId,
    location: 'UAT Site Compound',
    isSiteWarehouse: true,
  },
  expected: 201,
});
const warehouseId = warehouse.data.data.id;
check(
  warehouse.data.data.projectId === projectId &&
    warehouse.data.data.isSiteWarehouse === true,
  'Stage A Site Warehouse did not retain the Project and Site identity.',
);
const warehouseList = await request(pm, '/inventory/warehouses?projectId=' + projectId);
check(
  warehouseList.data.data.some((item) => item.id === warehouseId),
  'Stage A Warehouse was not discoverable within the assigned Project.',
);
await request(unassigned, '/inventory/warehouses/' + warehouseId, {
  expected: 403,
});
await request(unassigned, '/inventory/warehouses?projectId=' + projectId, {
  expected: 403,
});
const warehouseUpdated = await request(
  pm,
  '/inventory/warehouses/' + warehouseId,
  {
    method: 'PATCH',
    json: { location: 'Updated Site Compound' },
  },
);
check(
  warehouseUpdated.data.data.location === 'Updated Site Compound',
  'Warehouse location update was not retained.',
);
const archivedWarehouse = await request(
  pm,
  '/inventory/warehouses/' + warehouseId + '/archive',
  { method: 'POST', expected: 201 },
);
check(archivedWarehouse.data.data.isActive === false, 'Warehouse archive failed.');
const reactivatedWarehouse = await request(
  pm,
  '/inventory/warehouses/' + warehouseId + '/reactivate',
  { method: 'POST', expected: 201 },
);
check(reactivatedWarehouse.data.data.isActive === true, 'Warehouse reactivate failed.');
record('V0.4-A Warehouse creation, Project scope, update and lifecycle');

const equipmentType = await request(pm, '/equipment/types', {
  method: 'POST',
  json: {
    equipmentTypeCode: 'EXC-' + suffix,
    equipmentTypeName: 'Excavator ' + suffix,
    description: 'V0.2-F runtime acceptance Equipment Type',
  },
  expected: 201,
});
const equipment = await request(pm, '/equipment/register', {
  method: 'POST',
  json: {
    equipmentTypeId: equipmentType.data.data.id,
    equipmentCode: 'EQ-' + suffix,
    equipmentName: 'Excavator ' + suffix,
    operationalStatus: 'AVAILABLE',
  },
  expected: 201,
});
const equipmentId = equipment.data.data.id;
const equipmentAssignment = await request(
  pm,
  '/equipment/register/' + equipmentId + '/assignments',
  {
    method: 'POST',
    json: {
      projectId,
      assignedFrom: '2026-10-01',
      remarks: 'UAT Project deployment',
    },
    expected: 201,
  },
);
check(
  equipmentAssignment.data.data.projectId === projectId,
  'Equipment assignment was not created against the Project.',
);

const assignedRegister = await request(
  pm,
  '/equipment/register?asOf=2026-10-10',
);
const assignedEquipment = assignedRegister.data.data.find(
  (item) => item.id === equipmentId,
);
check(
  assignedEquipment?.availability === 'ASSIGNED',
  'Derived Equipment availability did not report ASSIGNED.',
);

const projectEquipment = await request(
  pm,
  '/equipment/projects/' + projectId + '/available?asOf=2026-10-10',
);
check(
  projectEquipment.data.data.some(
    (item) => item.equipment?.id === equipmentId,
  ),
  'Assigned Equipment was not available to the Project on the as-of date.',
);

const manualEquipmentUsage = await request(pm, '/equipment/usage', {
  method: 'POST',
  json: {
    equipmentId,
    projectId,
    usageDate: '2026-10-09',
    operatingHours: '2.5',
    activityId: activityA.data.data.id,
    wbsId: rootWbs.data.data.id,
    remarks: 'Manual V0.2-F runtime usage',
  },
  expected: 201,
});
check(
  manualEquipmentUsage.data.data?.sourceType === 'MANUAL',
  'Manual Equipment Usage did not retain MANUAL source type.',
);
record('V0.2-F Equipment register, Project assignment, derived availability and manual usage');

const siteOptions = await request(
  pm,
  '/site-execution/projects/' + projectId + '/options',
);
check(
  siteOptions.data.data.equipmentIntegration?.available === true &&
    siteOptions.data.data.equipmentIntegration?.targetStage === 'V0.2-F',
  'Stage F did not activate canonical Equipment integration.',
);
check(
  siteOptions.data.data.materials.some(
    (item) => item.id === material.data.data.id,
  ),
  'Site Execution options did not expose the valid Material master.',
);

const dailyReport = await request(pm, '/site-execution/reports', {
  method: 'POST',
  json: {
    projectId,
    reportDate: '2026-10-10',
    weatherObservation: 'Dry morning; afternoon rain.',
    generalRemarks: 'Automated V0.2-E site report.',
    manpower: [
      {
        tradeRole: 'General Worker',
        headcount: 6,
        remarks: 'Groundworks crew',
      },
      {
        tradeRole: 'Steel Fixer',
        headcount: 4,
      },
    ],
    materialUsage: [
      {
        materialId: material.data.data.id,
        uomId,
        quantity: '12',
        activityId: activityA.data.data.id,
        wbsId: rootWbs.data.data.id,
        remarks: 'Observation only; no Inventory posting.',
      },
    ],
    equipmentUsage: [
      {
        equipmentId,
        operatingHours: '4',
        activityId: activityA.data.data.id,
        wbsId: rootWbs.data.data.id,
        remarks: 'Daily Site Report Equipment usage.',
      },
    ],
    progress: [
      {
        activityId: activityA.data.data.id,
        percentComplete: '45',
        note: 'Progress captured through Daily Site Report.',
      },
    ],
    issues: [
      {
        activityId: activityA.data.data.id,
        issueText: 'Temporary access route partially obstructed.',
      },
    ],
    delays: [
      {
        activityId: activityA.data.data.id,
        delayReason: 'Afternoon rain reduced productivity.',
      },
    ],
    inspections: [
      {
        activityId: activityA.data.data.id,
        inspectionReference: 'IR-' + suffix,
        remarks: 'Site inspection reference.',
      },
    ],
  },
  expected: 201,
});
const dailyReportId = dailyReport.data.data.id;
check(
  dailyReport.data.data.status === 'DRAFT' &&
    dailyReport.data.data.totalManpower === 10,
  'Daily Site Report draft/manpower totals were not created correctly.',
);

await request(pm, '/site-execution/reports', {
  method: 'POST',
  json: {
    projectId,
    reportDate: '2026-10-10',
    manpower: [],
    materialUsage: [],
    progress: [],
    issues: [],
    delays: [],
    inspections: [],
  },
  expected: 409,
});

const sitePhotoBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const sitePhotoForm = new FormData();
sitePhotoForm.set('documentTypeId', documentType.data.data.id);
sitePhotoForm.set(
  'file',
  new Blob([sitePhotoBytes], { type: 'image/png' }),
  'site-photo-' + suffix + '.png',
);
const sitePhoto = await request(
  pm,
  '/site-execution/reports/' + dailyReportId + '/photos',
  {
    method: 'POST',
    body: sitePhotoForm,
    expected: 201,
  },
);
check(
  sitePhoto.data.data.fileName === 'site-photo-' + suffix + '.png',
  'Daily Site Report photograph/file upload did not use Documents.',
);

const siteDocuments = await request(
  pm,
  '/site-execution/reports/' + dailyReportId + '/documents',
);
check(
  siteDocuments.data.data.some((item) => item.id === sitePhoto.data.data.id),
  'Daily Site Report document link was not retained.',
);
check(
  !JSON.stringify(siteDocuments.data).includes('storageKey'),
  'Daily Site Report document response exposed storageKey.',
);

const submittedDailyReport = await request(
  pm,
  '/site-execution/reports/' + dailyReportId + '/submit',
  {
    method: 'POST',
    expected: 201,
  },
);
check(
  submittedDailyReport.data.data.status === 'SUBMITTED',
  'Daily Site Report did not enter SUBMITTED state.',
);
const submittedProgressLine =
  submittedDailyReport.data.data.progressLines.find(
    (item) => item.activityId === activityA.data.data.id,
  );
check(
  submittedProgressLine?.activityProgress &&
    String(submittedProgressLine.activityProgress.percentComplete) === '45',
  'Daily Site Report submission did not append Activity Progress.',
);

const submittedEquipmentLine =
  submittedDailyReport.data.data.equipmentUsage.find(
    (item) => item.equipmentId === equipmentId,
  );
check(
  submittedEquipmentLine?.equipmentUsage?.sourceType ===
      'DAILY_SITE_REPORT' &&
    String(submittedEquipmentLine?.equipmentUsage?.operatingHours) === '4',
  'Daily Site Report submission did not materialize canonical Equipment Usage.',
);
const equipmentHistoryAfterSubmit = await request(
  pm,
  '/equipment/usage?projectId=' + projectId + '&equipmentId=' + equipmentId,
);
check(
  equipmentHistoryAfterSubmit.data.data.some(
    (item) =>
      item.sourceType === 'DAILY_SITE_REPORT' &&
      item.sourceEntityId === dailyReportId &&
      item.usageDate?.slice(0, 10) === '2026-10-10' &&
      String(item.operatingHours) === '4',
  ),
  'Daily Site Report Equipment Usage was not retained in canonical history.',
);

const siteProgressHistory = await request(
  pm,
  '/activity-progress/' + activityA.data.data.id,
);
check(
  siteProgressHistory.data.data.some(
    (item) =>
      item.sourceType === 'DAILY_SITE_REPORT' &&
      item.sourceEntityId === dailyReportId &&
      item.progressDate?.slice(0, 10) === '2026-10-10' &&
      String(item.percentComplete) === '45',
  ),
  'Daily Site Report progress was not retained in immutable Activity Progress history.',
);

await request(pm, '/site-execution/reports/' + dailyReportId, {
  method: 'PATCH',
  json: { generalRemarks: 'Submitted content must remain immutable.' },
  expected: 409,
});

await request(
  pm,
  '/site-execution/reports/' + dailyReportId + '/corrections',
  {
    method: 'POST',
    json: {
      correctionNote: 'Correction retained without overwriting submitted report.',
      progress: [
        {
          activityId: activityA.data.data.id,
          percentComplete: '42',
          note: 'Corrected Daily Site Report progress retained as history.',
        },
      ],
      equipmentUsage: [
        {
          equipmentId,
          operatingHours: '4.5',
          activityId: activityA.data.data.id,
          wbsId: rootWbs.data.data.id,
          remarks: 'Corrected Equipment usage retained as later history.',
        },
      ],
    },
    expected: 201,
  },
);
const correctedDailyReport = await request(
  pm,
  '/site-execution/reports/' + dailyReportId,
);
check(
  correctedDailyReport.data.data.corrections.length === 1 &&
    correctedDailyReport.data.data.corrections[0]?.progressCorrections?.length === 1 &&
    String(
      correctedDailyReport.data.data.corrections[0]?.progressCorrections?.[0]
        ?.percentComplete,
    ) === '42' &&
    correctedDailyReport.data.data.corrections[0]?.equipmentCorrections?.length === 1 &&
    String(
      correctedDailyReport.data.data.corrections[0]?.equipmentCorrections?.[0]
        ?.operatingHours,
    ) === '4.5' &&
    correctedDailyReport.data.data.generalRemarks ===
      'Automated V0.2-E site report.',
  'Submitted Daily Site Report correction did not remain append-only.',
);
const correctedSiteProgressHistory = await request(
  pm,
  '/activity-progress/' + activityA.data.data.id,
);
check(
  correctedSiteProgressHistory.data.data.some(
    (item) =>
      item.sourceType === 'DAILY_SITE_REPORT_CORRECTION' &&
      item.progressDate?.slice(0, 10) === '2026-10-10' &&
      String(item.percentComplete) === '42',
  ),
  'Corrected Daily Site Report progress was not appended to immutable history.',
);
const correctedEquipmentHistory = await request(
  pm,
  '/equipment/usage?projectId=' + projectId + '&equipmentId=' + equipmentId,
);
check(
  correctedEquipmentHistory.data.data.some(
    (item) =>
      item.sourceType === 'DAILY_SITE_REPORT_CORRECTION' &&
      item.usageDate?.slice(0, 10) === '2026-10-10' &&
      String(item.operatingHours) === '4.5',
  ),
  'Corrected Daily Site Report Equipment Usage was not appended to canonical history.',
);

const reportingProjects = await request(pm, '/reporting/projects');
check(
  reportingProjects.data.data.some((item) => item.id === projectId),
  'Operational reporting Project selector did not respect the assigned Project.',
);
const projectEngineerDashboard = await request(
  pm,
  '/reporting/projects/' +
    projectId +
    '/project-engineer?asOf=2026-10-10&days=14',
);
check(
  projectEngineerDashboard.data.data.project?.id === projectId &&
    projectEngineerDashboard.data.data.schedule?.summary?.total >= 2 &&
    projectEngineerDashboard.data.data.schedule?.currentBaseline?.versionNo === 1,
  'Project Engineer Dashboard did not expose current Project/Scheduling source data.',
);
check(
  projectEngineerDashboard.data.data.siteExecution?.latestReports?.some(
    (item) =>
      item.id === dailyReportId &&
      Number(item.totalManpower) === 10 &&
      Number(item.counts?.equipmentUsage) === 1,
  ),
  'Project Engineer Dashboard did not expose current Daily Site Report source data.',
);
check(
  projectEngineerDashboard.data.data.equipment?.assignments?.some(
    (item) => item.equipment?.id === equipmentId,
  ),
  'Project Engineer Dashboard did not expose current assigned operational Equipment.',
);
check(
  projectEngineerDashboard.data.data.schedule?.lookahead?.window?.days === 14,
  'Project Engineer Dashboard did not use the approved lookahead read model.',
);
record('V0.2 RPT-001/RPT-002 operational reporting and Project Engineer Dashboard');
const procurementReport = await request(
  pm,
  '/reporting/projects/' + projectId + '/procurement',
);
const materialProcurementLine = procurementReport.data.data.lines.find(
  (item) => item.id === prMaterialLine.data.data.id,
);
check(
  procurementReport.data.data.project?.id === projectId &&
    materialProcurementLine?.pr?.prNumber === purchaseRequest.data.data.prNumber &&
    materialProcurementLine?.rfqs?.some(
      (item) =>
        item.rfqNumber === sourcingRfq.data.data.rfqNumber &&
        item.award?.id === materialSourcingAward.data.data.id &&
        item.award?.supplierQuotationId === quotationB.data.data.id &&
        item.quotations?.some(
          (quotation) => quotation.id === quotationB.data.data.id,
        ),
    ) &&
    materialProcurementLine?.purchaseOrders?.some(
      (item) => item.poNumber === purchaseOrderNumber,
    ) &&
    ['AT_RISK', 'ON_TIME', 'UNAVAILABLE'].includes(
      materialProcurementLine?.scheduleRisk,
    ),
  'V0.3-E procurement reporting did not expose source-derived status, dates, risk and forward traceability.',
);
check(
  !JSON.stringify(materialProcurementLine).includes('unitPrice'),
  'Operational procurement reporting leaked commercial pricing outside the quotation/PO authority boundary.',
);
record('V0.3-E procurement schedule/risk reporting and forward/backward traceability');


await request(pm, '/equipment/register/' + equipmentId, {
  method: 'PATCH',
  json: { operationalStatus: 'UNAVAILABLE' },
});
const unavailableRegister = await request(
  pm,
  '/equipment/register?asOf=2026-10-10',
);
check(
  unavailableRegister.data.data.find((item) => item.id === equipmentId)
    ?.availability === 'UNAVAILABLE',
  'Derived Equipment availability did not report UNAVAILABLE after status change.',
);
const unavailableProjectEquipment = await request(
  pm,
  '/equipment/projects/' + projectId + '/available?asOf=2026-10-10',
);
check(
  !unavailableProjectEquipment.data.data.some(
    (item) => item.equipment?.id === equipmentId,
  ),
  'Operationally unavailable Equipment remained selectable for new Project usage.',
);
record('V0.2-F Equipment Daily Site Report usage, append-only correction and derived availability');

record('V0.2-E Daily Site Report, progress, observations, photos and corrections through live HTTP API');

await request(unassigned, '/projects/' + projectId, { expected: 403 });
await request(unassigned, `/documents/projects/${projectId}`, { expected: 403 });
await request(unassigned, '/activities?projectId=' + projectId, { expected: 403 });
await request(unassigned, '/working-calendars?projectId=' + projectId, { expected: 403 });
await request(
  unassigned,
  '/schedule/projects/' + projectId + '/analysis?mode=planned',
  { expected: 403 },
);
await request(
  unassigned,
  '/schedule-baselines?projectId=' + projectId,
  { expected: 403 },
);
await request(
  unassigned,
  '/schedule/projects/' + projectId + '/comparison',
  { expected: 403 },
);
await request(
  unassigned,
  '/site-execution/reports?projectId=' + projectId,
  { expected: 403 },
);
await request(
  unassigned,
  '/site-execution/reports/' + dailyReportId,
  { expected: 403 },
);
await request(
  unassigned,
  '/equipment/projects/' + projectId + '/available?asOf=2026-10-10',
  { expected: 403 },
);
await request(
  unassigned,
  '/equipment/usage?projectId=' + projectId,
  { expected: 403 },
);
await request(
  unassigned,
  '/documents/projects/' +
    projectId +
    '/targets/WBS/' +
    rootWbs.data.data.id,
  { expected: 403 },
);
await request(
  unassigned,
  '/reporting/projects/' +
    projectId +
    '/project-engineer?asOf=2026-10-10&days=14',
  { expected: 403 },
);
await request(
  unassigned,
  '/reporting/projects/' + projectId + '/procurement',
  { expected: 403 },
);
await request(
  unassigned,
  '/budget/projects/' + projectId + '/boq',
  { expected: 403 },
);
await request(
  unassigned,
  '/budget/projects/' + projectId + '/summary',
  { expected: 403 },
);
await request(
  unassigned,
  '/procurement/projects/' + projectId + '/purchase-requests',
  { expected: 403 },
);
await request(
  unassigned,
  '/procurement/purchase-requests/' + purchaseRequestId,
  { expected: 403 },
);
await request(
  unassigned,
  '/procurement/projects/' + projectId + '/rfqs',
  { expected: 403 },
);
await request(
  unassigned,
  '/procurement/rfqs/' + sourcingRfqId,
  { expected: 403 },
);
await request(
  unassigned,
  '/procurement/projects/' + projectId + '/purchase-orders',
  { expected: 403 },
);
await request(
  unassigned,
  '/procurement/purchase-orders/' + purchaseOrderId,
  { expected: 403 },
);
record('V0.3-A scoped Budget access denied');
record('V0.3-B scoped Purchase Request access denied');
record('V0.3-C scoped RFQ / quotation access denied');
record('V0.3-D scoped Purchase Order access denied');
record('unassigned Project, Document, Scheduling, Site Execution, Equipment, Reporting, Budget and Procurement access denied');

await logout(pm);
await request(pm, '/auth/me', { expected: 401 });
record('logout revokes the session');

await logout(unassigned);
await logout(checker);
await logout(admin);

process.stdout.write('\nAutomated current-release runtime acceptance PASSED.\n');
process.stdout.write(`Scenario suffix: ${suffix}\n`);
process.stdout.write(`Checks passed: ${stepResults.length}\n`);
