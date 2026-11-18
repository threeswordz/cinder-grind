import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const full = readFileSync(new URL('../../.github/workflows/validate.yml', import.meta.url), 'utf8');
const focused = readFileSync(new URL('../../.github/workflows/validate-branch.yml', import.meta.url), 'utf8');

const routing = text => text.slice(text.indexOf('\non:\n'), text.indexOf('\nconcurrency:\n'));
const effectiveRouting = text => routing(text).split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n').trim();

test('full validation remains mandatory on all registered PRs and main; explicit full branch lane is retained', () => {
  assert.equal(effectiveRouting(full), "on:\n  pull_request:\n    branches: [main, 'v1.2-c-uat-coverage']\n  push:\n    branches: [main, 'vfull-*']");
  assert.match(full, /^name: Validate Construction ERP$/m);
  assert.match(full, /^jobs:\n  validate:\n    runs-on: ubuntu-latest$/m);
  assert.match(full, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
});

test('focused branch excludes explicit full lane; no PR/main event or full check identity', () => {
  assert.equal(effectiveRouting(focused), "on:\n  push:\n    branches: ['v*', '!vfull-*']");
  assert.match(focused, /^name: Focused Construction ERP Branch$/m);
  assert.match(focused, /^jobs:\n  validate-branch:\n    name: focused-branch$/m);
  assert.match(focused, /test "\$\(git rev-parse HEAD\)" = "\$EXACT_BRANCH_COMMIT"/);
  assert.match(focused, /FOCUSED_BRANCH_ONLY/);
  assert.doesNotMatch(focused, /^\s+name: validate$/m);
});

test('focused workflow keeps frozen dependencies and meaningful compile/schema checks', () => {
  for (const command of ['pnpm install --frozen-lockfile','pnpm prisma:generate','pnpm prisma:validate','pnpm typecheck','node --test apps/web/src/role-ui/*.test.mjs']) assert.ok(focused.includes(command), command);
});
