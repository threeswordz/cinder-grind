import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const full = readFileSync(new URL('../../.github/workflows/validate.yml', import.meta.url), 'utf8');
const focused = readFileSync(new URL('../../.github/workflows/validate-branch.yml', import.meta.url), 'utf8');

const routing = text => text.slice(text.indexOf('\non:\n'), text.indexOf('\nconcurrency:\n'));
const effectiveRouting = text => routing(text).split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n').trim();

test('full validation identity and PR/main events remain; explicit full branch lane is retained', () => {
  assert.equal(effectiveRouting(full), "on:\n  workflow_dispatch:\n  pull_request:\n    types: [ready_for_review]\n    branches: [main, 'v1.2-c-uat-coverage']\n  push:\n    branches: [main, 'vfull-*']");
  assert.match(full, /^name: Validate Construction ERP$/m);
  assert.match(full,/types: \[ready_for_review\]/);
  assert.doesNotMatch(full,/github\.event\.label\.name/);
  assert.doesNotMatch(full,/types: \[(?:opened|synchronize|reopened|labeled)/);
  assert.match(full, /^  validate:\n    needs: \[integration-plan, integration-check\]/m);
  assert.match(full,/github.event_name != 'push' \|\| github.ref != 'refs\/heads\/main'/);
  assert.match(full, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
});

test('draft admission fails before install; final live identity follows all full evidence, without success skips', () => {
  const execution=full.slice(full.indexOf('\n  validate:\n'));
  const admission = execution.indexOf('run: node deploy/release-candidate/ci-candidate-gate.mjs start');
  assert.ok(admission > execution.indexOf('name: Checkout exact workflow commit'));
  assert.ok(admission < execution.indexOf('name: Set up pnpm'));
  assert.ok(admission < execution.indexOf('run: pnpm install --frozen-lockfile'));
  assert.match(full.trimEnd(), /run: node deploy\/release-candidate\/ci-candidate-gate.mjs finish$/);
  const fullSteps=full.slice(full.indexOf('\n  validate:\n'));
  assert.doesNotMatch(fullSteps.slice(fullSteps.indexOf('    steps:')), /^\s+(if:|continue-on-error:)/m);
  assert.doesNotMatch(full, /pull_request_target|types: \[synchronize\]/);
  assert.match(full,/needs.integration-check.result != 'success' \|\| needs.integration-check.outputs.verified != 'true'/);
  for(const id of ['checkout','pnpm','node','checks','proof','artifact'])
    assert.ok(full.includes(`steps.${id}.outcome == 'success'`),id);
  assert.match(full,/steps.admit.outputs.verified/);
  assert.match(full,/if-no-files-found: error/);
  assert.match(full, /permissions:\n  actions: read\n  contents: read\n  pull-requests: read\n/);
  assert.match(focused, /node --test deploy\/release-candidate\/ci-routing-contract.test.mjs deploy\/release-candidate\/ci-candidate-gate.test.mjs/);
  for (const command of ['pnpm install --frozen-lockfile', 'node --test deploy/release-candidate/*.test.mjs',
    'deploy/release-candidate/ci-parallel-rehearsals.mjs', 'deploy/release-candidate/verify-evidence.mjs']) assert.ok(full.includes(command), command);
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

const parallel = readFileSync(new URL('./ci-parallel-rehearsals.mjs', import.meta.url), 'utf8');
test('parallel rehearsal retains all eight original source and evidence pairs, full verifier and final gate', () => {
  assert.match(full,/name: Rehearse all eight historical predecessors in two isolated lanes/);
  assert.match(parallel,/deploy\/release-candidate\/rehearse.sh/);
  assert.match(parallel,/worktree', 'add', '--detach'/);
  assert.match(parallel,/worktree', 'remove', '--force'/);
  for(const [sha,file] of [["65857a384005e1734028ffb6945b1077ed3449e5","/tmp/v1-0-e-rehearsal.json"],["fc52a867c96a8b3a369b480b9799bad1a5e9f399","/tmp/v1-3-customer-boq-rehearsal.json"],["e86ed846f30ac3feeb09f74ba9084571b9955520","/tmp/hr1-a-employee-rehearsal.json"],["3a5ae8a92083a2bd03f4159b1e84d0565e7e78ec","/tmp/material-request-rehearsal.json"],["34e022d5807d3e16458437a02ebba669ba838c6a","/tmp/material-plan-rehearsal.json"],["5209c30a1b7b282a603ba09d4a5bd82a700a183f","/tmp/material-plan-issue-rehearsal.json"],["d2b790801119fb1b5b4176ad416086ee7363d091","/tmp/receiving-rehearsal.json"],["59d67d1f2e54e6bfde51e4c5be336ea97906bf52","/tmp/material-uom-rehearsal.json"]]) {
    assert.ok(parallel.includes(sha)); assert.ok(parallel.includes(file)); assert.ok(full.includes(file));
  }
  assert.match(full,/cache: pnpm\n          cache-dependency-path: pnpm-lock.yaml/);
  assert.match(full,/run: pnpm install --frozen-lockfile/);
  assert.match(full,/pnpm audit --prod/);
});
