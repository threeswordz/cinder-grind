// Passive Mac observations only. Disposable business journeys stay in runtime-acceptance.mjs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { open, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const candidate = 'f3a98a036e3376a0ec4e3e6e3acec9aa64832a1f';
const base = 'http://127.0.0.1:3001/api/v1';
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const kinds = {
  workOrder: ['subcontracts/work-orders', 'subcontracts.work_order.view'],
  claim: ['subcontracts/claims', 'subcontracts.claim.view'],
  certification: ['subcontracts/certifications', 'subcontracts.certification.view'],
  variation: ['subcontracts/variations', 'subcontracts.variation.view'],
  historicalPo: ['procurement/purchase-orders', 'procurement.po.view'],
  historicalBudget: ['budget/revisions', 'budget.revision.view'],
};
const own = (object, key) => Object.hasOwn(object, key);
const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const requiredFields = {
  workOrder: { approvalState: 'APPROVED', 'agreement.currencyCode': 'THB', amount: undefined },
  claim: { state: 'ASSESSED', currencyCode: 'THB', 'assessment.state': 'ASSESSED', 'assessment.assessedAmount': undefined },
  certification: { state: 'APPROVED', currencyCode: 'THB', certifiedGross: undefined, retainedAmount: undefined, netCertifiedAmount: undefined },
  variation: { state: 'APPROVED', currencyCode: 'THB', valueDelta: undefined },
};

export function validatePlan(plan) {
  assert.equal(plan.schema, 'v12-c-passive-plan-v1');
  assert.equal(plan.candidate, candidate);
  assert.equal(plan.projectCode, 'V12-THB-001');
  assert.ok(Array.isArray(plan.records) && Array.isArray(plan.boundaries));
  for (const record of plan.records) {
    assert.ok(own(kinds, record.kind) && uuid.test(record.id) && uuid.test(record.projectId));
    assert.ok(record.expected && Object.keys(record.expected).length > 0);
    if (requiredFields[record.kind]) {
      for (const [field, required] of Object.entries(requiredFields[record.kind])) {
        assert.ok(own(record.expected, field), 'Missing required observation: ' + field);
        if (required !== undefined) assert.equal(record.expected[field], required);
        else assert.match(record.expected[field], /^-?\d+(?:\.\d+)?$/);
      }
    } else {
      assert.ok(own(record.expected, 'currencyCode') && ['SGD', null].includes(record.expected.currencyCode));
      const amounts = Object.entries(record.expected).filter(([key]) => /^lines\.\d+\.amount$/.test(key));
      assert.ok(amounts.length > 0,
        'Historical readback needs an owner-recorded original line amount.');
      for (const [, amount] of amounts) assert.match(amount, /^-?\d+(?:\.\d+)?$/);
    }
    // Only literal scalar comparisons; no arbitrary expressions or request paths.
    for (const [path, value] of Object.entries(record.expected)) {
      assert.match(path, /^[a-zA-Z][a-zA-Z\d]*(?:\.(?:[a-zA-Z][a-zA-Z\d]*|\d+))*$/);
      assert.ok(value === null || typeof value === 'string' || typeof value === 'boolean');
    }
  }
  for (const boundary of plan.boundaries) {
    assert.ok(['foreignCompany', 'unassignedProject'].includes(boundary.kind));
    assert.ok(uuid.test(boundary.projectId));
    assert.ok(typeof boundary.fixtureEvidence === 'string' && boundary.fixtureEvidence.trim().length > 0);
  }
  return plan;
}

function valueAt(row, path) {
  return path.split('.').reduce((value, key) => value !== null && typeof value === 'object' && own(value, key)
    ? value[key] : undefined, row);
}

export function assertRecord(row, record, companyId) {
  assert.equal(row.id, record.id);
  assert.equal(row.companyId, companyId);
  assert.equal(row.projectId, record.projectId);
  for (const [path, expected] of Object.entries(record.expected)) {
    const actual = valueAt(row, path);
    assert.notEqual(actual, undefined, 'Expected field absent: ' + path);
    // Compare money as exact decimal text. Never round or reinterpret currencies.
    assert.equal(actual, expected, 'Observed field differs: ' + path);
  }
  if (requiredFields[record.kind]) {
    // Passive retained evidence only; active maker/checker denials use existing CI.
    const checker = record.kind === 'claim' ? row.assessment?.assessedByUserId :
      record.kind === 'workOrder' ? row.approvalInstance?.actions?.findLast((a) => a.action === 'APPROVE')?.actionByUserId :
      row.approvedByUserId;
    assert.ok(uuid.test(row.createdByUserId) && uuid.test(row.submittedByUserId) && uuid.test(checker));
    // Match the maker passed to ApprovalService by each owning service.
    // assessClaim requires an authorized assessor, but no identity separation.
    if (record.kind !== 'claim') {
      const maker = record.kind === 'workOrder' ? row.submittedByUserId : row.createdByUserId;
      assert.notEqual(checker, maker);
    }
  }
}

function safePath(path) {
  return ['/auth/login', '/auth/me', '/auth/logout', '/projects'].includes(path) ||
    /^\/projects\/[a-f\d-]{36}$/.test(path) ||
    /^\/budget\/projects\/[a-f\d-]{36}\/(summary|approved)$/.test(path) ||
    Object.values(kinds).some(([prefix]) => new RegExp('^/' + prefix + '/[a-f\\d-]{36}$', 'i').test(path));
}

export async function readback(plan, { email, password, fetcher = fetch } = {}) {
  validatePlan(plan);
  assert.ok(email && password, 'Use the hidden-password shell wrapper.');
  const observations = [];
  const report = { schema: 'v12-c-passive-readback-v1', candidate,
    candidateEvidence: 'LOCAL_CHECKOUT_ONLY_SERVER_REVISION_NOT_ATTESTED',
    generatedAt: new Date().toISOString(), planHash: fingerprint(plan),
    businessWrites: false, authenticationSessionsUsed: true, ownerUatAcceptance: false,
    productionAuthorized: false, checks: [] };
  let cookie, csrf;
  async function request(path, method = 'GET', body) {
    assert.ok(safePath(path));
    assert.ok(method === 'GET' || method === 'POST' && ['/auth/login', '/auth/logout'].includes(path));
    const response = await fetcher(base + path, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = response.status === 204 ? null : await response.json();
    if (path === '/auth/login' && response.status === 201) {
      cookie = response.headers.get('set-cookie')?.split(';')[0];
      csrf = data?.data?.csrfToken;
      assert.ok(cookie?.startsWith('erp_session=') && csrf, 'Invalid login session.');
    }
    // Never persist credentials, cookies, names, raw bodies or unexpected error text.
    observations.push({ path, status: response.status });
    return { status: response.status, data: data?.data, code: data?.code };
  }
  async function check(name, permissions, action) {
    if (permissions.some((p) => !report.permissions.includes(p))) {
      report.checks.push({ name, status: 'BLOCKED', reason: 'MISSING_EXISTING_READ_PERMISSION' });
      return;
    }
    try {
      await action();
      report.checks.push({ name, status: 'PASS' });
    } catch (error) {
      report.checks.push({ name, status: error.blocked ? 'BLOCKED' : 'FAIL',
        reason: error.blocked ? 'MISSING_PREREQUISITE_OR_READ_DENIED' : 'READBACK_MISMATCH' });
    }
  }
  function present(response) {
    if ([403, 404].includes(response.status)) throw Object.assign(new Error(), { blocked: true });
    assert.equal(response.status, 200);
    return response.data;
  }
  try {
    assert.equal((await request('/auth/login', 'POST', { email, password })).status, 201, 'Login failed.');
    const user = present(await request('/auth/me'));
    assert.ok(Array.isArray(user.roleCodes) && !user.roleCodes.includes('SYS_ADMIN'), 'Use an existing business test persona.');
    assert.ok(uuid.test(user.id) && uuid.test(user.companyId) && Array.isArray(user.permissions));
    report.actorId = user.id;
    report.companyId = user.companyId;
    report.permissions = user.permissions;
    const projects = present(await request('/projects'));
    const matches = projects.filter((p) => p.projectCode === plan.projectCode && p.companyId === user.companyId);
    assert.equal(matches.length, 1, 'Expected assigned isolated Project is unavailable.');
    const project = matches[0];
    assert.ok(uuid.test(project.id));
    report.projectId = project.id;
    await check('Budget without approved baseline', ['budget.revision.view'], async () => {
      const summary = present(await request(`/budget/projects/${project.id}/summary`));
      const approved = present(await request(`/budget/projects/${project.id}/approved`));
      assert.equal(summary.projectId, project.id);
      assert.equal(summary.original, null);
      assert.equal(summary.current, null);
      assert.equal(approved, null);
    });
    for (const kind of Object.keys(kinds)) {
      const records = plan.records.filter((record) => record.kind === kind);
      if (!records.length) report.checks.push({ name: kind, status: 'BLOCKED', reason: 'NO_OWNER_IDENTIFIED_RECORD_AND_EXPECTED_VALUES' });
      for (const record of records) await check(kind + ':' + record.id,
        [kinds[kind][1], ...(kind === 'claim' ? ['subcontracts.assessment.view'] : [])], async () => {
        if (requiredFields[kind]) assert.equal(record.projectId, project.id);
        const row = present(await request('/' + kinds[kind][0] + '/' + record.id));
        assertRecord(row, record, user.companyId);
      });
    }
    for (const kind of ['foreignCompany', 'unassignedProject']) {
      const fixtures = plan.boundaries.filter((item) => item.kind === kind);
      if (!fixtures.length) report.checks.push({ name: kind, status: 'BLOCKED', reason: 'NO_KNOWN_EXISTING_BOUNDARY_FIXTURE' });
      for (const fixture of fixtures) await check(kind, ['projects.project.view'], async () => {
        assert.notEqual(fixture.projectId, project.id);
        if (kind === 'unassignedProject' && user.permissions.includes('projects.access_all')) {
          throw Object.assign(new Error(), { blocked: true });
        }
        const result = await request('/projects/' + fixture.projectId);
        assert.equal(result.status, kind === 'foreignCompany' ? 404 : 403);
        assert.equal(result.code, kind === 'foreignCompany' ? 'PROJECT_NOT_FOUND' : 'PROJECT_ACCESS_DENIED');
      });
    }
  } catch (error) {
    report.checks.push({ name: 'Identity/Project preflight', status: error.blocked ? 'BLOCKED' : 'FAIL',
      reason: error.blocked ? 'MISSING_PREREQUISITE_OR_READ_DENIED' : 'IDENTITY_OR_API_MISMATCH' });
  } finally {
    if (cookie) {
      try { assert.equal((await request('/auth/logout', 'POST')).status, 204); }
      catch { report.checks.push({ name: 'logout', status: 'FAIL', reason: 'SESSION_LOGOUT_NOT_CONFIRMED' }); }
    }
  }
  delete report.permissions;
  report.observations = observations;
  report.status = report.checks.some((c) => c.status === 'FAIL') ? 'FAIL' :
    report.checks.some((c) => c.status === 'BLOCKED') ? 'BLOCKED' : 'PASS';
  return report;
}

async function main(args) {
  const [mode, planFile, checkout, receiptFile] = args;
  if (mode === '--plan' && args.length === 2) {
    await writeFile(planFile, JSON.stringify({ schema: 'v12-c-passive-plan-v1', candidate,
      projectCode: 'V12-THB-001', records: [], boundaries: [] }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('PLAN_CREATED — no network or database access. Add only known existing records; see docs/V1.2-C-AUTOMATION.md.');
    return;
  }
  assert.ok(['--check', '--verify'].includes(mode) && args.length === 4,
    'Usage: --plan PLAN | --check PLAN RETAINED_CHECKOUT NEW_RECEIPT | --verify PLAN RETAINED_CHECKOUT PRIOR_RECEIPT');
  const plan = validatePlan(JSON.parse(await readFile(planFile, 'utf8')));
  const git = (...gitArgs) => execFileSync('git', ['-C', resolve(checkout), ...gitArgs], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  assert.equal(git('rev-parse', 'HEAD'), candidate, 'Retained checkout is not the pinned candidate.');
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Tracked retained checkout changes present.');
  let prior;
  let receipt;
  if (mode === '--verify') {
    prior = JSON.parse(await readFile(receiptFile, 'utf8'));
    assert.equal(prior.schema, 'v12-c-passive-readback-v1');
    assert.equal(prior.candidate, candidate);
    assert.equal(prior.planHash, fingerprint(plan));
    assert.equal(prior.businessWrites, false);
  } else {
    // Reserve evidence before authentication; an interrupted check cannot overwrite it.
    receipt = await open(receiptFile, 'wx', 0o600);
    await receipt.writeFile(JSON.stringify({ status: 'INCOMPLETE', businessWrites: false }) + '\n');
    await receipt.sync();
  }
  try {
    const report = await readback(plan, { email: process.env.V12_READBACK_EMAIL, password: process.env.V12_READBACK_PASSWORD });
    if (prior) {
      assert.equal(prior.actorId, report.actorId);
      assert.equal(prior.companyId, report.companyId);
      assert.equal(prior.projectId, report.projectId);
      assert.deepEqual(report.checks, prior.checks, 'Readback changed since prior receipt.');
      assert.deepEqual(report.observations, prior.observations, 'HTTP read outcomes changed.');
      console.log(JSON.stringify({ ...report, priorReadbackUnchanged: true }, null, 2));
    } else {
      await receipt.truncate(0);
      await receipt.write(JSON.stringify(report, null, 2) + '\n', 0, 'utf8');
      await receipt.sync();
      console.log(JSON.stringify(report, null, 2));
    }
    process.exitCode = report.status === 'PASS' ? 0 : report.status === 'BLOCKED' ? 2 : 1;
  } finally { await receipt?.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); }
  catch { console.error('BLOCKED — invalid plan/checkout, unavailable API/session, or changed evidence; no business write attempted.'); process.exitCode = 1; }
}
