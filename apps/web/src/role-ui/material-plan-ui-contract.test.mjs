import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const api = read('../api/material-plans.ts');
const panel = read('../inventory/MaterialPlansPanel.tsx');
const shell = read('../inventory/InventoryWorkspace.tsx');
const labels = read('../inventory/material-plan-labels.ts');

test('C plan client uses canonical guarded source endpoints and no alternative stock owner', () => {
  assert.match(api, /\/inventory\/material-plans/);
  for (const path of ['/projects', '/choices', '/revisions', '/submit', '/decision'])
    assert.ok(api.includes(path), 'Missing source endpoint ' + path);
  assert.doesNotMatch(api, /stockTransactions.*create|localStorage|budgetAmount|unitRate/);
});

test('C plan actions use server version and preserve requestKey on ambiguous result', () => {
  assert.match(panel, /const \[pending, setPending\]/);
  assert.match(panel, /mutation\.mutate\(pending\)/);
  assert.match(panel, /expectedVersion: current\.version/);
  assert.match(panel, /kind: 'DECIDE'/);
  assert.match(panel, /'APPROVE' \| 'REJECT'/);
});

test('C plan UI uses explicit permissions and does not impersonate checker', () => {
  assert.match(panel, /can\('view'\)/);
  assert.match(panel, /can\('create'\)/);
  assert.match(panel, /can\('revise'\)/);
  assert.match(panel, /can\('submit'\)/);
  assert.match(panel, /can\('approve'\)/);
  assert.doesNotMatch(panel, /approveAs|impersonate|SYS_ADMIN|setRole/);
});

test('C plan frontend exposes a guarded inventory tab, not a separate unsecured route', () => {
  assert.match(shell, /canSeePlans = permissions\.includes\('inventory\.material_plan\.view'\)/);
  assert.match(shell, /<MaterialPlansPanel permissions=\{permissions\}/);
  assert.match(shell, /value="plans"/);
});

test('C plan locale includes English, Thai and Traditional Chinese', () => {
  for (const locale of ['en:', 'th:', "'zh-TW':"]) assert.ok(labels.includes(locale), locale);
  for (const term of ['title:', 'description:', 'approve:', 'reject:', 'retry:', 'invalid:'])
    assert.equal(labels.split(term).length - 1, 3, term);
});

test('C plan list/detail queries are no-store and user cache is session-scoped upstream', () => {
  assert.match(api, /cache: 'no-store'/);
  assert.match(panel, /gcTime: 0/);
  const session = read('../AuthenticatedWorkspace.tsx');
  assert.match(session, /One data cache per authenticated identity/);
});
