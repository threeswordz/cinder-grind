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
  'projects.team.view',
  'wbs.wbs.view',
  'wbs.wbs.create',
  'wbs.cost_code.view',
  'wbs.cost_code.create',
  'documents.document.view',
  'documents.document.upload',
  'documents.document.link',
];
await request(admin, `/admin/roles/${roleId}/permissions`, {
  method: 'PUT',
  json: { permissionCodes },
});

const pmPassword = 'Uat-PM-' + suffix + '-Strong-2026!';
const unassignedPassword = 'Uat-PE-' + suffix + '-Strong-2026!';
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
check(pmUser.data.data.employeeId === pmEmployee.data.data.id, 'Project Manager User/Employee link missing.');
check(unassignedUser.data.data.employeeId === unassignedEmployee.data.data.id, 'Unassigned User/Employee link missing.');
record('roles, permissions and Employee-linked Users');

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
record('unassigned Project and Document access denied');

await logout(pm);
await request(pm, '/auth/me', { expected: 401 });
record('logout revokes the session');

await logout(unassigned);
await logout(admin);

process.stdout.write('\nAutomated V0.1 runtime acceptance PASSED.\n');
process.stdout.write(`Scenario suffix: ${suffix}\n`);
process.stdout.write(`Checks passed: ${stepResults.length}\n`);
