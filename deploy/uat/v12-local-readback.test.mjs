import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { candidate, validatePlan, readback, assertRecord } from './v12-local-readback.mjs';

const companyId = randomUUID(), projectId = randomUUID(), actorId = randomUUID();
const plan = () => ({ schema: 'v12-c-passive-plan-v1', candidate, projectCode: 'V12-THB-001', records: [], boundaries: [] });
function harness({ roles = ['PROJECT_MANAGER'], permissions = ['projects.project.view', 'budget.revision.view'],
  budgetStatus = 200, original = null, record, logoutStatus = 204 } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    const path = new URL(url).pathname.replace('/api/v1', '');
    calls.push({ path, method: options.method });
    assert.equal(new URL(url).origin, 'http://127.0.0.1:3001');
    assert.equal(options.redirect, 'error');
    let status = 200, data;
    if (path === '/auth/login') {
      assert.deepEqual(JSON.parse(options.body), { email: 'test@example.invalid', password: 'never-save-me' });
      status = 201; data = { csrfToken: 'secret-csrf' };
    } else if (path === '/auth/me') data = { id: actorId, companyId, roleCodes: roles, permissions };
    else if (path === '/projects') data = [{ id: projectId, companyId, projectCode: 'V12-THB-001' }];
    else if (path.endsWith('/summary')) { status = budgetStatus; data = { projectId, original, current: null }; }
    else if (path.endsWith('/approved')) data = null;
    else if (path === '/auth/logout') status = logoutStatus;
    else if (path.startsWith('/projects/')) {
      const fixture = record;
      status = fixture?.kind === 'foreignCompany' ? 404 : 403;
      return new Response(JSON.stringify({ code: status === 404 ? 'PROJECT_NOT_FOUND' : 'PROJECT_ACCESS_DENIED' }), { status });
    } else if (record?.id && path.endsWith(record.id)) data = record.row;
    else throw new Error('Unexpected API path: ' + path);
    return new Response(status === 204 ? null : JSON.stringify({ data }), { status,
      headers: { 'content-type': 'application/json', ...(path === '/auth/login' ? { 'set-cookie': 'erp_session=secret-cookie; HttpOnly' } : {}) } });
  };
  return { calls, fetcher };
}
const run = (p, h) => readback(p, { email: 'test@example.invalid', password: 'never-save-me', fetcher: h.fetcher });

test('missing Mac fixtures remain BLOCKED; only authentication can use POST; secrets never enter evidence', async () => {
  const h = harness();
  const result = await run(plan(), h);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.checks.find((c) => c.name.startsWith('Budget')).status, 'PASS');
  assert.equal(result.checks.filter((c) => c.status === 'BLOCKED').length, 8);
  assert.ok(h.calls.every((c) => c.method === 'GET' || ['/auth/login', '/auth/logout'].includes(c.path)));
  assert.equal(h.calls.at(-1).path, '/auth/logout');
  for (const secret of ['never-save-me', 'secret-cookie', 'secret-csrf', 'test@example.invalid']) {
    assert.ok(!JSON.stringify(result).includes(secret));
  }
  assert.equal(result.businessWrites, false);
  assert.equal(result.ownerUatAcceptance, false);
});

test('permission denial is BLOCKED; a fabricated zero-valued approved baseline is FAIL', async () => {
  for (const [options, expected] of [[{ budgetStatus: 403 }, 'BLOCKED'], [{ original: { total: '0' } }, 'FAIL']]) {
    const result = await run(plan(), harness(options));
    assert.equal(result.checks[0].status, expected);
  }
});

test('missing permission is reported without probing protected source', async () => {
  const h = harness({ permissions: ['projects.project.view'] });
  const result = await run(plan(), h);
  assert.equal(result.checks[0].reason, 'MISSING_EXISTING_READ_PERMISSION');
  assert.ok(!h.calls.some((c) => c.path.includes('/budget/')));
});

test('SYS_ADMIN is rejected and its authenticated session is still logged out', async () => {
  const h = harness({ roles: ['SYS_ADMIN'] });
  const result = await run(plan(), h);
  assert.equal(result.status, 'FAIL');
  assert.equal(h.calls.at(-1).path, '/auth/logout');
  assert.ok(!h.calls.some((c) => c.path === '/projects'));
});

test('unknown paths, foreign endpoints, stale candidates and weak expected values cannot become a plan', () => {
  const id = randomUUID();
  for (const change of [
    { candidate: '0'.repeat(40) },
    { records: [{ kind: 'https://outside.invalid', id, projectId, expected: { state: 'APPROVED' } }] },
    { records: [{ kind: 'variation', id: '../admin/roles', projectId, expected: { state: 'APPROVED' } }] },
    { records: [{ kind: 'variation', id, projectId, expected: { state: 'APPROVED' } }] },
    { records: [{ kind: 'historicalPo', id, projectId, expected: { currencyCode: 'THB', 'lines.0.amount': '1205' } }] },
  ]) assert.throws(() => validatePlan({ ...plan(), ...change }));
});

test('historical amount/currency compares exact retained text and never converts unknown currency', async () => {
  const id = randomUUID();
  const record = { kind: 'historicalPo', id, projectId, expected: { currencyCode: null, 'lines.0.amount': '1205.1234' } };
  const row = { id, projectId, companyId, currencyCode: null, lines: [{ amount: '1205.1234' }] };
  validatePlan({ ...plan(), records: [record] });
  assertRecord(row, record, companyId);
  assert.throws(() => assertRecord({ ...row, currencyCode: 'THB' }, record, companyId));
  assert.throws(() => assertRecord({ ...row, lines: [{ amount: '1205.12' }] }, record, companyId));
  const h = harness({ permissions: ['projects.project.view', 'procurement.po.view'], record: { id, row } });
  const result = await run({ ...plan(), records: [record] }, h);
  assert.equal(result.checks.find((c) => c.name === 'historicalPo:' + id).status, 'PASS');
});

test('retained maker/checker evidence is required for approved Work Order readback', () => {
  const id = randomUUID(), maker = randomUUID(), checker = randomUUID();
  const record = { kind: 'workOrder', id, projectId,
    expected: { approvalState: 'APPROVED', 'agreement.currencyCode': 'THB', amount: '500' } };
  validatePlan({ ...plan(), records: [record] });
  const row = { id, projectId, companyId, approvalState: 'APPROVED', amount: '500', agreement: { currencyCode: 'THB' },
    createdByUserId: maker, submittedByUserId: maker,
    approvalInstance: { actions: [{ action: 'APPROVE', actionByUserId: checker }] } };
  assertRecord(row, record, companyId);
  // Work Order approval separates the checker from the submitter, not creator.
  assertRecord({ ...row, createdByUserId: checker }, record, companyId);
  assert.throws(() => assertRecord({ ...row, submittedByUserId: checker }, record, companyId));
  assert.throws(() => assertRecord({ ...row, approvalInstance: null }, record, companyId));
});

for (const kind of ['certification', 'variation']) {
  test(kind + ' readback compares the checker with the creator, not the submitter', async () => {
    const id = randomUUID(), creator = randomUUID(), checker = randomUUID();
    const expected = { state: 'APPROVED', currencyCode: 'THB', ...(kind === 'certification'
      ? { certifiedGross: '500', retainedAmount: '25', netCertifiedAmount: '475' }
      : { valueDelta: '500' }) };
    const record = { kind, id, projectId, expected };
    const row = { id, projectId, companyId, ...expected, createdByUserId: creator,
      submittedByUserId: checker, approvedByUserId: checker };
    const p = validatePlan({ ...plan(), records: [record] });
    // These owning services allow a different creator's record to be submitted
    // and approved by the same checker. They reject creator/checker collisions.
    assertRecord(row, record, companyId);
    assert.throws(() => assertRecord({ ...row, approvedByUserId: creator }, record, companyId));
    assert.throws(() => assertRecord({ ...row, createdByUserId: null }, record, companyId));
    assert.throws(() => assertRecord({ ...row, approvedByUserId: null }, record, companyId));
    const result = await run(p, harness({ record: { id, row },
      permissions: ['budget.revision.view', 'subcontracts.' + kind + '.view'] }));
    assert.equal(result.checks.find((c) => c.name === kind + ':' + id).status, 'PASS');
  });
}

test('Claim assessment readback requires identities without inventing assessor separation', async () => {
  const id = randomUUID();
  const record = { kind: 'claim', id, projectId, expected: { state: 'ASSESSED', currencyCode: 'THB',
    'assessment.state': 'ASSESSED', 'assessment.assessedAmount': '500' } };
  const row = { id, projectId, companyId, state: 'ASSESSED', currencyCode: 'THB',
    createdByUserId: actorId, submittedByUserId: actorId,
    assessment: { state: 'ASSESSED', assessedAmount: '500', assessedByUserId: actorId } };
  const p = validatePlan({ ...plan(), records: [record] });
  assertRecord(row, record, companyId);
  assert.throws(() => assertRecord({ ...row, assessment: { ...row.assessment, assessedByUserId: null } }, record, companyId));
  const allowed = await run(p, harness({ record: { id, row }, permissions:
    ['budget.revision.view', 'subcontracts.claim.view', 'subcontracts.assessment.view'] }));
  assert.equal(allowed.checks.find((c) => c.name === 'claim:' + id).status, 'PASS');
  const denied = harness({ record: { id, row }, permissions: ['budget.revision.view', 'subcontracts.claim.view'] });
  const blocked = await run(p, denied);
  assert.equal(blocked.checks.find((c) => c.name === 'claim:' + id).reason, 'MISSING_EXISTING_READ_PERMISSION');
  assert.ok(!denied.calls.some((c) => c.path.endsWith('/' + id)));
});

test('known boundary fixtures require exact denial codes; access_all cannot prove unassigned-Project denial', async () => {
  for (const kind of ['foreignCompany', 'unassignedProject']) {
    const p = { ...plan(), boundaries: [{ kind, projectId: randomUUID(), fixtureEvidence: 'Owner fixture receipt reference' }] };
    const h = harness({ record: { kind } });
    const result = await run(p, h);
    assert.equal(result.checks.find((c) => c.name === kind).status, 'PASS');
    if (kind === 'unassignedProject') {
      const wide = harness({ permissions: ['projects.project.view', 'projects.access_all'], record: { kind } });
      const result = await run(p, wide);
      assert.equal(result.checks.find((c) => c.name === kind).status, 'BLOCKED');
      assert.ok(!wide.calls.some((c) => c.path.endsWith(p.boundaries[0].projectId)));
    }
  }
});

test('logout failure cannot return PASS', async () => {
  const result = await run(plan(), harness({ logoutStatus: 403 }));
  assert.equal(result.status, 'FAIL');
  assert.equal(result.checks.at(-1).name, 'logout');
});

test('an absent nested field cannot impersonate a retained explicit null', () => {
  const id = randomUUID();
  const record = { id, projectId, kind: 'historicalPo', expected: { 'lines.0.amount': null } };
  assert.throws(() => assertRecord({ id, projectId, companyId, lines: null }, record, companyId));
});

test('missing or non-decimal historical amounts cannot pass as preserved money', () => {
  const id = randomUUID();
  for (const amount of [null, true, 'unknown', '1,205.00']) {
    assert.throws(() => validatePlan({ ...plan(), records: [{ kind: 'historicalPo', id, projectId,
      expected: { currencyCode: null, 'lines.0.amount': amount } }] }));
  }
});
