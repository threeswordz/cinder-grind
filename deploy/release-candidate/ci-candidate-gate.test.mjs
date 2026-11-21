import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { candidateIdentity, runAdmission } from './ci-candidate-gate.mjs';

const head = 'a'.repeat(40), base = 'b'.repeat(40), merge = 'c'.repeat(40);
function fixture({ attempt = '1', draft = false, branch = 'vwork', fork = false } = {}) {
  const repository = 'owner/erp';
  const env = { GITHUB_REPOSITORY: repository, GITHUB_RUN_ATTEMPT: attempt,
    GITHUB_EVENT_NAME: 'pull_request', GITHUB_SHA: merge, GITHUB_REF: 'refs/pull/12/merge',
    EXACT_RELEASE_COMMIT: head, RELEASE_COMMIT: head };
  const event = { repository: { full_name: repository }, action: 'ready_for_review', number: 12,
    pull_request: { number: 12, state: 'open', merged: false, draft,
      head: { sha: head, ref: branch, repo: { full_name: fork ? 'fork/erp' : repository } },
      base: { sha: base, ref: 'main', repo: { full_name: repository } } } };
  const live = structuredClone(event.pull_request);
  return { env, event, live };
}
const admit = (f, phase = 'start', extra = {}) => runAdmission({ phase, env: f.env, event: f.event,
  checkoutSha: head, getLive: async () => f.live, assertAncestor: async () => true, ...extra });
const denied = (promise, code) => assert.rejects(promise, error => error.code === code);


test('full PR work is admitted only by explicit ready transition and stable head', async () => {
  for(const action of ['opened','synchronize','reopened','labeled','unlabeled']){
    const f=fixture();f.event.action=action;
    await denied(admit(f),'FULL_PR_EXPLICIT_READY_REQUIRED');
  }
  const draft=fixture({draft:true});
  await denied(admit(draft),'FULL_PR_STABLE_CANDIDATE_REQUIRED');
  for(const attempt of ['1','2']){
    const f=fixture({attempt});
    for(const phase of ['start','finish'])assert.equal((await admit(f,phase)).sha,head);
  }
});

test('exact ready head is checked again at finish',async()=>{
  const f=fixture();
  assert.equal((await admit(f)).status,'FULL_VALIDATION_ADMITTED');
  f.live.head.sha='d'.repeat(40);
  await denied(admit(f,'finish'),'STALE_PR_HEAD');
});

for (const phase of ['start', 'finish']) {
  for (const [label, mutate, code] of [
    ['changed head', f => { f.live.head.sha = 'd'.repeat(40); }, 'STALE_PR_HEAD'],
    ['changed head repository', f => { f.live.head.repo.full_name = 'other/repo'; }, 'STALE_PR_HEAD'],
    ['changed base', f => { f.live.base.sha = 'd'.repeat(40); }, 'STALE_PR_BASE'],
    ['retargeted base', f => { f.live.base.ref = 'v1.2-c-uat-coverage'; }, 'STALE_PR_BASE'],
    ['closed PR', f => { f.live.state = 'closed'; }, 'STALE_PR_STATE'],
    ['merged PR', f => { f.live.merged = true; }, 'STALE_PR_STATE'],
    ['wrong PR', f => { f.live.number = 13; }, 'STALE_PR_STATE'],
  ]) test(`${phase} rejects ${label}`, async () => {
    const f = fixture({ attempt: '2' }); mutate(f); await denied(admit(f, phase), code);
  });
  test(`${phase} rejects API errors, absent live data and a base outside the candidate`, async () => {
    const f = fixture({ attempt: '2' });
    await denied(admit(f, phase, { getLive: async () => { throw Error('secret server response'); } }), 'LIVE_IDENTITY_UNAVAILABLE');
    await denied(admit(f, phase, { getLive: async () => null }), 'STALE_PR_STATE');
    await denied(admit(f, phase, { assertAncestor: async () => false }), 'BASE_NOT_IN_CANDIDATE');
    await denied(admit(f, phase, { assertAncestor: async () => { throw Error('missing object'); } }), 'BASE_NOT_IN_CANDIDATE');
  });
}

test('malformed event, attempt, repository, checkout and unknown action cannot authorize full success', async () => {
  for (const [mutate, code] of [
    [f => { f.env.GITHUB_REPOSITORY = '../bad'; }, 'INVALID_REPOSITORY'],
    [f => { f.event.repository.full_name = 'other/repo'; }, 'REPOSITORY_MISMATCH'],
    [f => { f.env.GITHUB_RUN_ATTEMPT = undefined; }, 'INVALID_ATTEMPT'],
    [f => { f.env.GITHUB_RUN_ATTEMPT = '0'; }, 'INVALID_ATTEMPT'],
    [f => { f.env.GITHUB_RUN_ATTEMPT = '2; echo forged'; }, 'INVALID_ATTEMPT'],
    [f => { f.env.EXACT_RELEASE_COMMIT = base; }, 'CHECKOUT_MISMATCH'],
    [f => { f.env.GITHUB_SHA = 'missing'; }, 'INVALID_EVENT_SHA'],
    [f => { f.env.GITHUB_REF = 'refs/pull/99/merge'; }, 'INVALID_PR_IDENTITY'],
    [f => { f.event.pull_request.draft = undefined; }, 'INVALID_PR_STATE'],
    [f => { f.event.pull_request.base.sha = null; }, 'INVALID_BASE'],
    [f => { f.event.pull_request.head.sha = base; }, 'INVALID_HEAD'],
    [f => { f.event.action = 'synchronize'; }, 'FULL_PR_EXPLICIT_READY_REQUIRED'],
    [f => { f.env.GITHUB_EVENT_NAME = 'workflow_dispatch'; }, 'INVALID_FULL_MAIN_DISPATCH'],
  ]) {
    const f = fixture({ attempt: '2' }); mutate(f); await denied(admit(f), code);
  }
  await denied(admit(fixture({ attempt: '2' }), 'invented'), 'INVALID_PHASE');
});

test('main/full push always executes full and rejects a stale ref at both boundaries', async () => {
  for (const branch of ['main', 'vfull-ci']) {
    const f = fixture();
    f.env.GITHUB_EVENT_NAME = 'push'; f.env.GITHUB_REF = `refs/heads/${branch}`; f.env.GITHUB_SHA = head;
    f.event = { repository: f.event.repository, ref: f.env.GITHUB_REF, after: head, deleted: false };
    f.live = { name: branch, commit: { sha: head } };
    for (const phase of ['start', 'finish']) assert.equal((await admit(f, phase)).focusedDraft, false);
    f.live.commit.sha = base;
    for (const phase of ['start', 'finish']) await denied(admit(f, phase), 'STALE_PUSH');
    f.event.deleted = true;
    await denied(admit(f), 'INVALID_PUSH_IDENTITY');
  }
});


test('CLI refuses ordinary PR push before any expensive work, hides credentials', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ci-candidate-gate-'));
  try {
    const f = fixture();f.event.action='synchronize';
    const realHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    f.env.EXACT_RELEASE_COMMIT = f.env.RELEASE_COMMIT = f.event.pull_request.head.sha = realHead;
    const eventPath = join(directory, 'event.json'), summaryPath = join(directory, 'summary.md');
    writeFileSync(eventPath, JSON.stringify(f.event));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./ci-candidate-gate.mjs', import.meta.url)), 'start'], {
      encoding: 'utf8', env: { ...process.env, ...f.env, GITHUB_EVENT_PATH: eventPath,
        GITHUB_STEP_SUMMARY: summaryPath, GITHUB_TOKEN: 'never-print-this-token' },
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^FULL_PR_EXPLICIT_READY_REQUIRED\n$/);
    assert.doesNotMatch(result.stdout + result.stderr + readFileSync(summaryPath, 'utf8'), /never-print-this-token/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('explicit main dispatch executes full only and refuses arbitrary refs, inputs or stale main',async()=>{
 const f=fixture();f.env.GITHUB_EVENT_NAME='workflow_dispatch';f.env.GITHUB_REF='refs/heads/main';f.env.GITHUB_SHA=head;
 f.event={repository:f.event.repository,ref:'main',inputs:{}};f.live={name:'main',commit:{sha:head}};
 for(const phase of ['start','finish'])assert.equal((await admit(f,phase)).focusedDraft,false);
 f.event.inputs={sha:head};await denied(admit(f),'INVALID_FULL_MAIN_DISPATCH');
 f.event.inputs={};f.event.ref='vbranch';await denied(admit(f),'INVALID_FULL_MAIN_DISPATCH');
 f.event.ref='main';f.live.commit.sha=base;await denied(admit(f,'finish'),'STALE_PUSH');
});
