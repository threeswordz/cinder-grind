import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const full = readFileSync(new URL('../../.github/workflows/validate.yml', import.meta.url), 'utf8');
const focused = readFileSync(new URL('../../.github/workflows/validate-branch.yml', import.meta.url), 'utf8');

const routing = text => text.slice(text.indexOf('\non:\n'), text.indexOf('\nconcurrency:\n'));
const effectiveRouting = text => routing(text).split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n').trim();

test('full validation identity and PR/main events remain; explicit full branch lane is retained', () => {
  assert.equal(effectiveRouting(full), "on:\n  pull_request:\n    branches: [main, 'v1.2-c-uat-coverage']\n  push:\n    branches: [main, 'vfull-*']");
  assert.match(full, /^name: Validate Construction ERP$/m);
  assert.match(full, /^jobs:\n  validate:\n    runs-on: ubuntu-latest$/m);
  assert.match(full, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
});

test('draft admission fails before install; final live identity follows all full evidence, without success skips', () => {
  const admission = full.indexOf('run: node deploy/release-candidate/ci-candidate-gate.mjs start');
  assert.ok(admission > full.indexOf('name: Checkout exact workflow commit'));
  assert.ok(admission < full.indexOf('name: Set up pnpm'));
  assert.ok(admission < full.indexOf('run: pnpm install --frozen-lockfile'));
  assert.match(full.trimEnd(), /run: node deploy\/release-candidate\/ci-candidate-gate.mjs finish$/);
  assert.doesNotMatch(full, /^\s+(if:|continue-on-error:)/m);
  assert.doesNotMatch(full, /ready_for_review|workflow_dispatch|pull_request_target/);
  assert.match(full, /permissions:\n  contents: read\n  pull-requests: read\n/);
  assert.match(focused, /node --test deploy\/release-candidate\/ci-routing-contract.test.mjs deploy\/release-candidate\/ci-candidate-gate.test.mjs/);
  for (const command of ['pnpm install --frozen-lockfile', 'node --test deploy/release-candidate/*.test.mjs',
    'deploy/release-candidate/verify-evidence.mjs']) assert.ok(full.includes(command), command);
  const direct = full.includes('deploy/release-candidate/rehearse.sh');
  const grouped = full.includes('node deploy/release-candidate/ci-parallel-rehearsals.mjs');
  assert.ok(direct || grouped, 'must execute original release predecessor rehearsals');
  if (grouped) {
    const source = readFileSync(new URL('./ci-parallel-rehearsals.mjs', import.meta.url), 'utf8');
    assert.ok(source.includes("spawn('bash', ['deploy/release-candidate/rehearse.sh']"), 'wrapper must run the original unchanged predecessor script');
    assert.ok(source.includes('verifyEvidence(GROUPS, release'), 'wrapper must fail closed on all eight evidence receipts');
    assert.ok(full.includes('node --test deploy/release-candidate/*.test.mjs'), 'complete source tests remain');
  }
});

test('focused branch excludes explicit full lane; no PR/main event or full check identity', () => {
  assert.equal(effectiveRouting(focused), "on:\n  push:\n    branches: ['v*', '!vfull-*']");
  assert.match(focused, /^name: Focused Construction ERP Branch$/m);
  assert.match(focused, /^jobs:\n  validate-branch:\n    name: focused-branch$/m);
  assert.match(focused, /test "\$\(git rev-parse HEAD\)" = "\$EXACT_BRANCH_COMMIT"/);
  // Vite SSR fixtures resolve /src relative to the web package cwd.
  assert.match(focused, /name: Run role UI focused tests\n        working-directory: apps\/web\n        run: node --test src\/role-ui\/\*\.test\.mjs/);
  assert.match(focused, /FOCUSED_BRANCH_ONLY/);
  // A colon-space in a plain YAML scalar is invalid even inside shell quotes.
  assert.match(focused, /name: Record focused-only boundary\n        run: \|\n          printf/);
  assert.doesNotMatch(focused, /^\s+name: validate$/m);
});

test('focused workflow keeps frozen dependencies and meaningful compile/schema checks', () => {
  for (const command of ['pnpm install --frozen-lockfile','pnpm prisma:generate','pnpm prisma:validate','pnpm typecheck','node --test src/role-ui/*.test.mjs']) assert.ok(focused.includes(command), command);
});
