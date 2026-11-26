import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('FM01-A denies stale cached sources after failed current authorization', () => {
  const source = readFileSync(new URL('../../apps/web/src/site-execution/WeeklySiteSummaryPanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /week\.isSuccess && !week\.isFetching && !week\.isError/);
});

test('FM01-A derived week invalidates after every source mutation, including no-work history', () => {
  const source = readFileSync(new URL('../../apps/web/src/site-execution/SiteExecutionPanel.tsx', import.meta.url), 'utf8');
  const actions = ['saveMutation', 'submitMutation', 'correctionMutation', 'noWorkMutation', 'noWorkCorrectionMutation'];
  const query = /queryKey:\s*\['site-execution',\s*'weekly',\s*projectId\]/g;
  for (const [index, name] of actions.entries()) {
    const start = source.indexOf('const ' + name + ' = useMutation(');
    assert.ok(start >= 0, name + ' must remain an explicit mutation');
    const next = source.indexOf('const ' + (actions[index + 1] ?? 'photoMutation') + ' = useMutation(', start + 1);
    assert.ok(next > start, name + ' must have a bounded mutation body');
    const body = source.slice(start, next);
    const onSuccess = body.indexOf('onSuccess:');
    assert.ok(onSuccess >= 0, name + ' must invalidate on successful write');
    const sourceUpdates = body.slice(onSuccess).match(query) ?? [];
    assert.equal(sourceUpdates.length, 1, name + ' must invalidate the Project weekly source exactly once');
  }
  assert.equal((source.match(query) ?? []).length, actions.length,
    'each FM01 source action must have its own weekly invalidation');
});
