import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { immediateIssueEscalation, issueCreateInput, issueCommandInput, issueTransition } from './site-issue-contract';

const facts = { category: 'GENERAL' as const, affectsCostOrDelivery: false, workStopped: false, deliveryDelayRisk: false };
test('FM03 work stoppage and delivery-delay risk escalate immediately across every category', () => {
  for (const category of ['GENERAL', 'SAFETY', 'QUALITY', 'ASSET_LOSS_DAMAGE'] as const) {
    assert.equal(immediateIssueEscalation({ ...facts, category, workStopped: true }), true);
    assert.equal(immediateIssueEscalation({ ...facts, category, deliveryDelayRisk: true }), true);
  }
  assert.equal(immediateIssueEscalation({ ...facts, category: 'SAFETY', affectsCostOrDelivery: true }), true);
  assert.equal(immediateIssueEscalation({ ...facts, category: 'QUALITY', affectsCostOrDelivery: true }), true);
  assert.equal(immediateIssueEscalation({ ...facts, category: 'ASSET_LOSS_DAMAGE', affectsCostOrDelivery: true }), false);
  assert.equal(immediateIssueEscalation(facts), false);
});
test('FM03 requires assigned actors and successful Foreman verification before owner closure', () => {
  const issue = { status: 'OPEN', category: 'GENERAL', reporterUserId: randomUUID(), ownerUserId: randomUUID() };
  const command = { requestKey: randomUUID(), expectedVersion: 1, note: 'Recorded work' };
  assert.throws(() => issueTransition(issue, issue.ownerUserId, 'CLOSE', command));
  assert.throws(() => issueTransition(issue, issue.reporterUserId, 'FOLLOW_UP', command));
  assert.equal(issueTransition(issue, issue.ownerUserId, 'FOLLOW_UP', command), 'AWAITING_VERIFICATION');
  const waiting = { ...issue, status: 'AWAITING_VERIFICATION' };
  assert.throws(() => issueTransition(waiting, issue.ownerUserId, 'VERIFY', { ...command, resolved: true }));
  assert.equal(issueTransition(waiting, issue.reporterUserId, 'VERIFY', { ...command, resolved: false }), 'OPEN');
  assert.equal(issueTransition(waiting, issue.reporterUserId, 'VERIFY', { ...command, resolved: true }), 'VERIFIED');
  assert.equal(issueTransition({ ...issue, status: 'VERIFIED' }, issue.ownerUserId, 'CLOSE', command), 'CLOSED');
  assert.throws(() => issueTransition({ ...issue, category: 'ASSET_LOSS_DAMAGE' }, issue.ownerUserId, 'FOLLOW_UP', command));
  assert.equal(issueTransition({ ...issue, category: 'ASSET_LOSS_DAMAGE' }, issue.ownerUserId, 'FOLLOW_UP', { ...command, assetSeverity: 'SEVERE' }), 'AWAITING_VERIFICATION');
});
test('FM03 strict inputs reject injected authority/state, coercion, missing facts and action-inappropriate fields', () => {
  const input = { ...facts, requestKey: randomUUID(), projectId: randomUUID(), description: 'Site issue' };
  assert.equal(issueCreateInput(input).reportId, null);
  for (const extra of [{ status: 'CLOSED' }, { ownerUserId: randomUUID() }, { workStopped: 'false' }, { category: 'UNKNOWN' }]) {
    assert.throws(() => issueCreateInput({ ...input, ...extra }));
  }
  const command = { requestKey: randomUUID(), expectedVersion: 1, note: 'Verification', resolved: true };
  assert.equal(issueCommandInput(command, 'VERIFY').resolved, true);
  assert.throws(() => issueCommandInput({ ...command, resolved: 'true' }, 'VERIFY'));
  assert.throws(() => issueCommandInput(command, 'CLOSE'));
  assert.throws(() => issueCommandInput({ ...command, expectedVersion: 0 }, 'VERIFY'));
});
