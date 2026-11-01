import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('FM01-A denies stale cached sources after failed current authorization', () => {
  const source = readFileSync(new URL('../../apps/web/src/site-execution/WeeklySiteSummaryPanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /week\.isSuccess && !week\.isFetching && !week\.isError/);
});

test('FM01-A derived week is invalidated after save, submit and correction', () => {
  const source = readFileSync(new URL('../../apps/web/src/site-execution/SiteExecutionPanel.tsx', import.meta.url), 'utf8');
  const weekly = source.match(/queryKey:\s*\['site-execution', 'weekly', projectId\]/g) ?? [];
  assert.equal(weekly.length, 3, 'Save, submit and correction must each refresh the weekly summary');
});
