import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GROUPS, runGroups, verifyEvidence, withIsolatedLanes} from './ci-parallel-rehearsals.mjs';

const SHA = 'a'.repeat(40);
const ci={provider:'github-actions',runId:'1234',runAttempt:'2',job:'validate'};

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
    ci,
  })]));
  const read = path => rows.get(path);
  verifyEvidence(GROUPS,SHA,read,ci);
  const first = GROUPS[0][0];
  rows.delete(first.file);
  assert.throws(()=>verifyEvidence(GROUPS,SHA,read,ci),/Missing or unreadable/);
  rows.set(first.file,JSON.stringify({version:17,releaseCommit:SHA,previousReleaseCommit:first.previous,
    exactCheckout:'PASS',cleanTree:'PASS',freshMigration:'PASS',
    verifiedRecoveryPoint:'PASS',productionPreparation:'PASS',rollbackReadiness:'PASS',
    ci}));
  assert.throws(()=>verifyEvidence(GROUPS,'b'.repeat(40),read,ci),/Missing exact predecessor PASS/);
  assert.throws(()=>verifyEvidence(GROUPS,SHA,read,{...ci,runId:'5678'}),/not from this exact GitHub Actions run/);
  assert.throws(()=>verifyEvidence(GROUPS,SHA,read,{...ci,runAttempt:'3'}),/not from this exact GitHub Actions run/);
  assert.throws(()=>verifyEvidence(GROUPS,SHA,read,{...ci,job:'other'}),/not from this exact GitHub Actions run/);
  rows.set(first.file,JSON.stringify({releaseCommit:SHA,previousReleaseCommit:first.previous,
    exactCheckout:'PASS',cleanTree:'PASS',freshMigration:'PASS',
    verifiedRecoveryPoint:'PASS',productionPreparation:'PASS',rollbackReadiness:'FAIL',
    ci}));
  assert.throws(()=>verifyEvidence(GROUPS,SHA,read,ci),/Missing exact predecessor PASS/);
});

test('candidate lanes own separate worktrees and cleanup waits for both runs',async()=>{
  const log=[];
  await withIsolatedLanes(GROUPS,index=>{log.push('prepare'+index);return 'lane'+index;},
    async(group,lane)=>{log.push('start'+lane);await new Promise(r=>setTimeout(r,2));log.push('done'+lane);},
    lane=>log.push('cleanup'+lane));
  assert.deepEqual(log.slice(0,2),['prepare0','prepare1']);
  assert.ok(log.indexOf('startlane1')<log.indexOf('donelane0'));
  assert.ok(log.indexOf('cleanuplane1')>log.indexOf('donelane0'));
  assert.ok(log.indexOf('cleanuplane1')>log.indexOf('donelane1'));
  assert.deepEqual(log.slice(-2),['cleanuplane1','cleanuplane0']);
});
test('lane setup, execution or cleanup failure poisons gate and cleans completed setup',async()=>{
  for(const failure of ['prepare','execute','cleanup']){
    const cleaned=[];
    await assert.rejects(withIsolatedLanes(GROUPS,index=>{
      if(failure==='prepare'&&index===1)throw Error('setup failure');
      return 'lane'+index;
    },async(group,lane)=>{if(failure==='execute'&&lane==='lane0')throw Error('child failure');},
    lane=>{cleaned.push(lane);if(failure==='cleanup'&&lane==='lane1')throw Error('cleanup failure');}),
    /Isolated rehearsal lanes failed/);
    assert.deepEqual(cleaned,failure==='prepare'?['lane0']:['lane1','lane0']);
  }
});
