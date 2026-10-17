import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canOpenSourceLink,
  canWriteSourceForm,
  consumeSourceLinkKey,
  resolveLinkedProjectId,
  resolveLinkedRecordId,
  resolveLinkedChildRecordId,
  sourceLinkTarget,
} from './source-link-policy.ts';

test('C1 source links require exact owning view permission', () => {
  assert.equal(canOpenSourceLink('purchase-requests', ['procurement.pr.approve']), false);
  assert.equal(canOpenSourceLink('purchase-requests', ['procurement.pr.view']), true);
  assert.equal(canOpenSourceLink('purchase-orders', ['procurement.po.approve']), false);
  assert.equal(canOpenSourceLink('purchase-orders', ['procurement.po.view']), true);
  assert.equal(canOpenSourceLink('inventory', ['inventory.receipt.approve']), false);
  assert.equal(canOpenSourceLink('inventory', ['inventory.receipt.view']), true);
  assert.equal(canOpenSourceLink('finance', ['finance.supplier_invoice.approve']), false);
  assert.equal(canOpenSourceLink('finance', ['finance.supplier_invoice.view']), true);
  assert.equal(canOpenSourceLink('payments', ['finance.payment.approve']), false);
  assert.equal(canOpenSourceLink('payments', ['finance.payment.view']), true);
});

test('C2 Subcontracts source links require an owning read permission', () => {
  assert.equal(canOpenSourceLink('subcontracts', ['subcontracts.agreement.approve']), false);
  assert.equal(canOpenSourceLink('subcontracts', ['subcontracts.agreement.view']), true);
  assert.equal(canOpenSourceLink('subcontracts', ['subcontracts.claim.view']), true);
  assert.equal(canOpenSourceLink('subcontracts', ['subcontracts.certification.view']), true);
});

test('C3 Project-to-Management links preserve owning read boundaries', () => {
  assert.equal(canOpenSourceLink('projects', ['projects.project.edit']), false);
  assert.equal(canOpenSourceLink('projects', ['projects.project.view']), true);
  assert.equal(canOpenSourceLink('wbs', ['wbs.wbs.edit']), false);
  assert.equal(canOpenSourceLink('wbs', ['wbs.wbs.view']), true);
  assert.equal(canOpenSourceLink('scheduling', ['schedule.activity.edit']), false);
  assert.equal(canOpenSourceLink('scheduling', ['schedule.programme.view']), true);
  assert.equal(canOpenSourceLink('budget', ['budget.revision.approve']), false);
  assert.equal(canOpenSourceLink('budget', ['budget.boq.view']), true);
  assert.equal(canOpenSourceLink('budget', ['budget.revision.view']), true);
  assert.equal(canOpenSourceLink('site-execution', ['site.daily_report.edit']), false);
  assert.equal(canOpenSourceLink('site-execution', ['site.daily_report.view']), true);
  assert.equal(canOpenSourceLink('cost-control', ['cost.direct_posting.create']), false);
  assert.equal(canOpenSourceLink('cost-control', ['cost.control.view']), true);
  assert.equal(canOpenSourceLink('management', ['management.portfolio.view']), false);
  assert.equal(canOpenSourceLink('management', ['management.dashboard.view']), true);
});

test('C3 WBS-scoped Budget links require owning BOQ read while project revisions stay accessible', () => {
  assert.equal(canOpenSourceLink('budget', ['budget.revision.view']), true);
  assert.equal(canOpenSourceLink('budget', ['budget.revision.view'], 'wbs'), false);
  assert.equal(canOpenSourceLink('budget', ['budget.revision.approve'], 'wbs'), false);
  assert.equal(canOpenSourceLink('budget', ['budget.boq.view'], 'wbs'), true);
  assert.equal(canOpenSourceLink('budget', ['budget.boq.manage'], 'wbs'), false);
  assert.equal(canOpenSourceLink('budget', ['budget.boq.manage', 'budget.boq.view'], 'wbs'), true);
  assert.equal(canOpenSourceLink('budget', [], 'wbs'), false);
  assert.equal(canOpenSourceLink('budget', ['budget.revision.view'], 'project'), true);
  assert.equal(canOpenSourceLink('budget', ['budget.revision.view'], 'budget-revision'), true);
});

test('sourcing link accepts RFQ-view or quotation-view but not mutation-only permission', () => {
  assert.equal(canOpenSourceLink('sourcing', ['procurement.rfq.manage']), false);
  assert.equal(canOpenSourceLink('sourcing', ['procurement.rfq.view']), true);
  assert.equal(canOpenSourceLink('sourcing', ['procurement.quotation.view']), true);
});

test('linked Project fails closed unless returned by the authorized source list', () => {
  const projects = [{ id: 'project-A' }, { id: 'project-B' }];
  assert.equal(resolveLinkedProjectId('project-A', projects), 'project-A');
  assert.equal(resolveLinkedProjectId('project-Z', projects), '');
  assert.equal(resolveLinkedProjectId(undefined, projects), '');
});

test('C3 Project Cost links honor Cost Control source inclusion, not just archived status', () => {
  const archivedWithHistory = { id: 'archived-historical', isActive: false };
  const archivedWithoutHistory = { id: 'archived-empty', isActive: false };
  const costSourceList = [{ id: archivedWithHistory.id }, { id: 'active-cost' }];
  assert.equal(
    resolveLinkedProjectId(archivedWithHistory.id, costSourceList),
    archivedWithHistory.id,
  );
  assert.equal(resolveLinkedProjectId(archivedWithoutHistory.id, costSourceList), '');
  assert.equal(resolveLinkedProjectId('cross-project-not-authorized', costSourceList), '');
  assert.equal(resolveLinkedProjectId('archived-empty', []), '');
});

test('linked record must match both ID and selected Project', () => {
  const rows = [
    { id: 'row-A', projectId: 'project-A' },
    { id: 'row-B', projectId: 'project-B' },
  ];
  assert.equal(resolveLinkedRecordId('row-A', 'project-A', rows), 'row-A');
  assert.equal(resolveLinkedRecordId('row-A', 'project-B', rows), '');
  assert.equal(resolveLinkedRecordId('row-Z', 'project-A', rows), '');
  assert.equal(resolveLinkedRecordId(undefined, 'project-A', rows), '');
});

test('child selection only accepts a record loaded from its authorized source list', () => {
  const rows = [{ id: 'row-A' }, { id: 'row-B' }];
  assert.equal(resolveLinkedChildRecordId('row-B', rows), 'row-B');
  assert.equal(resolveLinkedChildRecordId('row-Z', rows), '');
});

test('source targets never encode empty Project or record identities', () => {
  assert.equal(sourceLinkTarget('finance', '', 'invoice-A'), null);
  assert.equal(sourceLinkTarget('finance', 'project-A', ''), null);
  assert.deepEqual(
    sourceLinkTarget('sourcing', 'project-A', 'rfq-A', 'quote-A'),
    {
      sectionKey: 'sourcing',
      projectId: 'project-A',
      recordId: 'rfq-A',
      childRecordId: 'quote-A',
    },
  );
  assert.deepEqual(
    sourceLinkTarget(
      'subcontracts',
      'project-A',
      'certification-A',
      undefined,
      'subcontract-certification',
    ),
    {
      sectionKey: 'subcontracts',
      projectId: 'project-A',
      recordId: 'certification-A',
      recordKind: 'subcontract-certification',
    },
  );
  assert.deepEqual(
    sourceLinkTarget('cost-control', 'project-A', 'project-A', 'wbs-A', 'wbs'),
    {
      sectionKey: 'cost-control',
      projectId: 'project-A',
      recordId: 'project-A',
      childRecordId: 'wbs-A',
      recordKind: 'wbs',
    },
  );
});

test('C3 create-only users cannot submit edits after opening existing Project/WBS records', () => {
  assert.equal(canWriteSourceForm(true, false, false), true);
  assert.equal(canWriteSourceForm(true, false, true), false);
  assert.equal(canWriteSourceForm(false, true, false), false);
  assert.equal(canWriteSourceForm(false, true, true), true);
  assert.equal(canWriteSourceForm(true, true, true), true);
  assert.equal(canWriteSourceForm(false, false, true), false);
});

test('incoming source link identity is consumed only once until the target changes', () => {
  const applied = { current: '' };
  assert.equal(consumeSourceLinkKey(applied, 'project-A:row-A'), true);
  assert.equal(consumeSourceLinkKey(applied, 'project-A:row-A'), false);
  assert.equal(consumeSourceLinkKey(applied, 'project-A:row-B'), true);
  assert.equal(consumeSourceLinkKey(applied, ''), false);
});
