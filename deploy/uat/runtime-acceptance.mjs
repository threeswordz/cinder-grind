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
record('V0.3-A Budget, V0.3-B Purchase Request and V0.3-C RFQ numbering configuration');

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

const sourcingRfq = await request(
  pm,
  '/procurement/projects/' + projectId + '/rfqs',
  {
    method: 'POST',
    json: {
      closingDate: '2026-10-11',
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
record('V0.3-C quotation-only manager discovery, detail access and quotation creation');

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

record('secure document upload, metadata listing and byte-for-byte download');

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

const unassigned = await login(unassignedUser.data.data.email, unassignedPassword);
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
record('V0.3-A scoped Budget access denied');
record('V0.3-B scoped Purchase Request access denied');
record('V0.3-C scoped RFQ / quotation access denied');
record('unassigned Project, Document, Scheduling, Site Execution, Equipment, Reporting and Budget access denied');

await logout(pm);
await request(pm, '/auth/me', { expected: 401 });
record('logout revokes the session');

await logout(unassigned);
await logout(checker);
await logout(admin);

process.stdout.write('\nAutomated current-release runtime acceptance PASSED.\n');
process.stdout.write(`Scenario suffix: ${suffix}\n`);
process.stdout.write(`Checks passed: ${stepResults.length}\n`);
