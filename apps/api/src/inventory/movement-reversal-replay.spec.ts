import assert from 'node:assert/strict';
import test from 'node:test';
import { reversalReplayState } from './movement-reversal-replay';

const row = { reversedAt: new Date('2026-11-02'), reversalKey: 'key', reversalReason: 'Original reason' };
test('identical committed reason and key replay', () => assert.equal(reversalReplayState(row, 'key', 'Original reason'), 'MATCH'));
test('same key and changed reason conflict', () => assert.equal(reversalReplayState(row, 'key', 'Different reason'), 'CONFLICT'));
test('missing historical reason cannot match a new reason', () => assert.equal(reversalReplayState({ ...row, reversalReason: null }, 'key', 'Original reason'), 'CONFLICT'));
test('a different key is not a replay', () => assert.equal(reversalReplayState(row, 'new', 'Original reason'), 'NOT_REPLAY'));
test('an uncommitted reversal is not a replay', () => assert.equal(reversalReplayState({ ...row, reversedAt: null }, 'key', 'Original reason'), 'NOT_REPLAY'));
test('reason comparison is exact, including case and whitespace', () => {
  for (const reason of ['original reason', 'Original reason ', ' Original reason']) assert.equal(reversalReplayState(row, 'key', reason), 'CONFLICT');
});
