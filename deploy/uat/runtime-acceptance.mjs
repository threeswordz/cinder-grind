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
record('administrator login and current-user endpoint');

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
record('secure document upload, metadata listing and byte-for-byte download');

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
record('unassigned Project, Document and Scheduling access denied');

await logout(pm);
await request(pm, '/auth/me', { expected: 401 });
record('logout revokes the session');

await logout(unassigned);
await logout(checker);
await logout(admin);

process.stdout.write('\nAutomated current-release runtime acceptance PASSED.\n');
process.stdout.write(`Scenario suffix: ${suffix}\n`);
process.stdout.write(`Checks passed: ${stepResults.length}\n`);
