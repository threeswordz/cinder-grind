import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canOpenSourceLink,
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

test('quotation child selection only accepts a child loaded from its authorized RFQ detail', () => {
  const quotations = [{ id: 'quote-A' }, { id: 'quote-B' }];
  assert.equal(resolveLinkedChildRecordId('quote-B', quotations), 'quote-B');
  assert.equal(resolveLinkedChildRecordId('quote-Z', quotations), '');
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
});

test('incoming source link identity is consumed only once until the target changes', () => {
  const applied = { current: '' };
  assert.equal(consumeSourceLinkKey(applied, 'project-A:row-A'), true);
  assert.equal(consumeSourceLinkKey(applied, 'project-A:row-A'), false);
  assert.equal(consumeSourceLinkKey(applied, 'project-A:row-B'), true);
  assert.equal(consumeSourceLinkKey(applied, ''), false);
});
