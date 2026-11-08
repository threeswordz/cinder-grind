import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const ui = read('../inventory/MaterialPlanIssueControls.tsx');
const issues = read('../inventory/MaterialIssuesPanel.tsx');
const api = read('../api/material-plan-issues.ts');
const labels = read('../inventory/material-plan-issue-labels.ts');

test('C issue UI preserves legacy paths only for nonenabled or unbound historical issues', () => {
  assert.match(issues, /const scopedPolicy = authorizedProject && planPolicy\.isSuccess && !planPolicy\.isFetching/);
  assert.match(issues, /const scopedHistory = authorizedProject && planHistory\.isSuccess && !planHistory\.isFetching/);
  assert.match(issues, /scopedPolicy\?\.enabled === true && scopedHistory\?\.binding != null/);
  assert.match(issues, /scopedPolicy\.enabled === false \|\| scopedHistory\?\.binding === null/);
  assert.match(issues, /canSubmit && legacyIssue/);
  assert.match(issues, /canApprove && legacyIssue/);
});

test('C issue posting requires a complete pin set and an explicit preview outcome', () => {
  assert.match(ui, /issueLines\.length > 0 && bindings\.length === issueLines\.length/);
  assert.match(ui, /new Set\(bindings\.map\(x => x\.issueItemId\)\)/);
  assert.match(ui, /const verifiedPlans = new Map\(/);
  assert.match(ui, /planChecks\[index\]/);
  assert.match(ui, /!check\.isFetching/);
  assert.match(ui, /preview\?\.fingerprint === fingerprint/);
  assert.match(ui, /applicablePreview\.result === 'WITHIN_PLAN'/);
  assert.match(ui, /api\.withinPlan\(/);
  assert.match(ui, /api\.submitOverage\(/);
});

test('C issue controls preserve a stable operation intent for unknown commit response', () => {
  assert.match(issues, /const \[pendingPlanActions, setPendingPlanActions\]/);
  assert.match(issues, /pending=\{pendingPlanActions\[current\.id\] \?\? null\}/);
  assert.match(issues, /expectedRequestKey && old\[issueId\]\?\.requestKey !== expectedRequestKey/);
  assert.match(ui, /onPendingChange\(action\); actionMutation\.mutate\(action\)/);
  assert.match(ui, /onPendingChange\(null, intent\.requestKey\)/);
  assert.match(ui, /actionMutation\.mutate\(pending\)/);
  assert.match(ui, /requestKey: crypto\.randomUUID\(\)/);
  assert.match(api, /method: 'POST'/);
});

test('C issue review and final decision are distinct and backend owned', () => {
  assert.match(api, /'review' \| 'decision'/);
  assert.match(ui, /'REVIEW' \| 'DECIDE'/);
  assert.match(ui, /canReview/);
  assert.match(ui, /canApprove/);
  assert.match(ui, /historyPages\.length === 1 && visibleHistory\?\.binding\?\.issueId === issue\.id/);
  assert.match(ui, /\? visibleHistory\.items\[0\] : undefined/);
  assert.doesNotMatch(ui, /const review = history\.items\[0\]/);
  assert.doesNotMatch(ui, /approveAs|setCurrentApprover|SYS_ADMIN|impersonate/);
});

test('C issue locale and server source links cover EN TH Traditional Chinese', () => {
  for (const locale of ['en:', 'th:', "'zh-TW':"]) assert.ok(labels.includes(locale), locale);
  for (const name of ['title:', 'post:', 'submit:', 'overage:', 'review:', 'final:', 'pending:', 'signed:'])
    assert.equal((labels.match(new RegExp('\\b' + name, 'g')) ?? []).length, 3, name);
  assert.match(issues, /material-requests/);
  assert.match(ui, /t\.signed/);
});

test('C issue date checks normalize the ISO timestamp to its exact calendar day', () => {
  assert.equal((ui.match(/issue\.issueDate\.slice\(0, 10\)/g) ?? []).length, 4);
  assert.doesNotMatch(ui, /issue\.issueDate >= (?:approved|effective)\.validFrom/);
});

test('C preview retains the fingerprint actually submitted with in-flight bindings', () => {
  assert.match(ui, /mutationFn: \(intent: \{ bindings: PlanIssueBinding\[\]; fingerprint: string \}\)/);
  assert.match(ui, /api\.preview\(issue\.id, intent\.bindings\)/);
  assert.match(ui, /onSuccess: \(result, intent\) => \{/);
  assert.match(ui, /fingerprint: intent\.fingerprint/);
  assert.match(ui, /previewMutation\.mutate\(\{ bindings, fingerprint \}\)/);
  assert.doesNotMatch(ui, /setPreview\(\{ fingerprint, value: result\.data \}\)/);
});
