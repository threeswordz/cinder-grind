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

import {SHARDS,ciIdentity,artifactName,checkShard,readArtifact,collectShards} from './ci-sharded-rehearsals.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
const shardEnv={GITHUB_ACTIONS:'true',RELEASE_COMMIT:SHA,EXACT_RELEASE_COMMIT:SHA,
  GITHUB_WORKFLOW:'Validate Construction ERP',GITHUB_WORKFLOW_REF:'fixture/erp/.github/workflows/validate.yml@refs/pull/42/merge',
  GITHUB_RUN_ID:'1234',GITHUB_RUN_NUMBER:'99',GITHUB_RUN_ATTEMPT:'2',GITHUB_REPOSITORY:'fixture/erp'};
function shardRows(job,env=shardEnv){
  return new Map(SHARDS[job].map(entry=>[entry.file,JSON.stringify({
    releaseCommit:env.RELEASE_COMMIT,previousReleaseCommit:entry.previous,
    exactCheckout:'PASS',cleanTree:'PASS',freshMigration:'PASS',
    verifiedRecoveryPoint:'PASS',productionPreparation:'PASS',rollbackReadiness:'PASS',
    ci:ciIdentity(env,job),
  })]));
}
test('four runner shards preserve exactly the existing eight source/evidence pairs',()=>{
  assert.equal(Object.keys(SHARDS).length,4);
  assert.ok(Object.values(SHARDS).every(s=>s.length===2));
  assert.deepEqual(Object.values(SHARDS).flat().map(x=>x.previous).sort(),GROUPS.flat().map(x=>x.previous).sort());
  assert.deepEqual(Object.values(SHARDS).flat().map(x=>x.file).sort(),GROUPS.flat().map(x=>x.file).sort());
  assert.equal(collectShards(shardEnv,job=>shardRows(job)).size,8);
});
test('historical shards reject stale attempt, wrong runner, wrong candidate and incomplete proof',()=>{
  for(const modify of [
    row=>({...row,ci:{...row.ci,runAttempt:'1'}}),
    row=>({...row,ci:{...row.ci,runId:'9999'}}),
    row=>({...row,ci:{...row.ci,job:'history-d'}}),
    row=>({...row,ci:{...row.ci,workflowRef:'unexpected'}}),
    row=>({...row,ci:{...row.ci,repository:'other/repo'}}),
    row=>({...row,releaseCommit:'b'.repeat(40)}),
    row=>({...row,previousReleaseCommit:'b'.repeat(40)}),
    row=>({...row,rollbackReadiness:'FAIL'}),
  ]){
    assert.throws(()=>collectShards(shardEnv,job=>{
      const rows=shardRows(job);
      if(job==='history-a'){const [path,raw]=rows.entries().next().value;rows.set(path,JSON.stringify(modify(JSON.parse(raw))));}
      return rows;
    }));
  }
  assert.throws(()=>collectShards(shardEnv,job=>job==='history-c'?new Map():shardRows(job)));
  assert.throws(()=>collectShards(shardEnv,job=>job==='history-a'?shardRows('history-d'):shardRows(job)));
  assert.throws(()=>ciIdentity(shardEnv,'validate'));
  assert.throws(()=>ciIdentity({...shardEnv,GITHUB_RUN_ATTEMPT:'0'},'history-a'));
  assert.throws(()=>ciIdentity({...shardEnv,EXACT_RELEASE_COMMIT:'b'.repeat(40)},'history-a'));
  assert.notEqual(artifactName(shardEnv,'history-a'),artifactName({...shardEnv,GITHUB_RUN_ATTEMPT:'3'},'history-a'));
});
test('artifact ingestion rejects missing, extra, symlink and stale-attempt evidence',()=>{
  const root=mkdtempSync(join(tmpdir(),'erp-shard-test-'));
  try{
    const job='history-a',dir=join(root,artifactName(shardEnv,job));
    mkdirSync(dir);
    const rows=shardRows(job);
    for(const [path,raw] of rows)writeFileSync(join(dir,basename(path)),raw);
    assert.equal(readArtifact(root,job,shardEnv).size,2);
    const extra=join(dir,'unexpected.json');
    writeFileSync(extra,'{}');
    assert.throws(()=>readArtifact(root,job,shardEnv),/inventory/);
    rmSync(extra);
    const first=join(dir,basename(SHARDS[job][0].file)),target=join(root,'target.json');
    writeFileSync(target,rows.get(SHARDS[job][0].file));
    rmSync(first);
    assert.throws(()=>readArtifact(root,job,shardEnv),/inventory/);
    symlinkSync(target,first);
    assert.throws(()=>readArtifact(root,job,shardEnv),/Invalid evidence file/);
    assert.throws(()=>readArtifact(root,job,{...shardEnv,GITHUB_RUN_ATTEMPT:'3'}));
  }finally{rmSync(root,{recursive:true,force:true});}
});
