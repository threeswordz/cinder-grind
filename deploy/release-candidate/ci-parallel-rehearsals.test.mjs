import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GROUPS, runGroups, verifyEvidence} from './ci-parallel-rehearsals.mjs';

const SHA = 'a'.repeat(40);

test('inventory retains eight distinct exact historical predecessors in two lanes', () => {
  assert.equal(GROUPS.length, 2);
  assert.equal(GROUPS.flat().length, 8);
  assert.equal(new Set(GROUPS.flat().map(x=>x.file)).size, 8);
  assert.equal(new Set(GROUPS.flat().map(x=>x.previous)).size, 8);
  assert.ok(GROUPS.flat().every(x=>/^[0-9a-f]{40}$/.test(x.previous) && x.file.startsWith('/tmp/')));
});

test('both groups actually overlap while preserving in-group predecessor sequence', async () => {
  const timeline = [];
  let active = 0, peak = 0;
  await runGroups(GROUPS, async entry => {
    active++;
    peak = Math.max(peak, active);
    timeline.push('start:' + entry.name);
    await new Promise(resolve => setTimeout(resolve, 3));
    timeline.push('done:' + entry.name);
    active--;
  });
  assert.equal(peak, 2);
  assert.equal(active, 0);
  for (const group of GROUPS) for (let i = 1; i < group.length; i++) {
    assert.ok(timeline.indexOf('done:' + group[i - 1].name) < timeline.indexOf('start:' + group[i].name));
  }
});

test('one failing predecessor poisons result even when other group finishes', async () => {
  const completed = [];
  await assert.rejects(runGroups(GROUPS, async entry => {
    if (entry.name === 'V1.0-E') throw new Error('Synthetic historical migration failure');
    completed.push(entry.name);
  }), /Historical rehearsal group failed/);
  assert.ok(completed.includes('Material UOM approved entry'), 'unaffected group must reach cleanup/completion');
  assert.ok(!completed.includes('Customer BOQ'), 'failed group must not skip ahead');
});

test('missing, wrong-source, stale-run or non-PASS evidence fails closed', () => {
  const rows = new Map(GROUPS.flat().map(entry => [entry.file, JSON.stringify({
    version:17,releaseCommit:SHA,previousReleaseCommit:entry.previous,
    exactCheckout:'PASS',cleanTree:'PASS',freshMigration:'PASS',
    verifiedRecoveryPoint:'PASS',productionPreparation:'PASS',rollbackReadiness:'PASS',
    ci:{provider:'github-actions',runId:'1234'},
  })]));
  const read = path => rows.get(path);
  verifyEvidence(GROUPS,SHA,read,'1234');
  const first = GROUPS[0][0];
  rows.delete(first.file);
  assert.throws(()=>verifyEvidence(GROUPS,SHA,read,'1234'),/Missing or unreadable/);
  rows.set(first.file,JSON.stringify({version:17,releaseCommit:SHA,previousReleaseCommit:first.previous,
    exactCheckout:'PASS',cleanTree:'PASS',freshMigration:'PASS',
    verifiedRecoveryPoint:'PASS',productionPreparation:'PASS',rollbackReadiness:'PASS',
    ci:{provider:'github-actions',runId:'1234'}}));
  assert.throws(()=>verifyEvidence(GROUPS,'b'.repeat(40),read,'1234'),/Missing exact predecessor PASS/);
  assert.throws(()=>verifyEvidence(GROUPS,SHA,read,'5678'),/not from this GitHub Actions run/);
  rows.set(first.file,JSON.stringify({releaseCommit:SHA,previousReleaseCommit:first.previous,
    exactCheckout:'PASS',cleanTree:'PASS',freshMigration:'PASS',
    verifiedRecoveryPoint:'PASS',productionPreparation:'PASS',rollbackReadiness:'FAIL',
    ci:{provider:'github-actions',runId:'1234'}}));
  assert.throws(()=>verifyEvidence(GROUPS,SHA,read,'1234'),/Missing exact predecessor PASS/);
});
