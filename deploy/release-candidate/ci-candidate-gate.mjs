import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const shaPattern = /^[a-f0-9]{40}$/;
const repositoryPattern = /^[A-Za-z0-9][A-Za-z0-9-]*\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;
const bases = new Set(['main', 'v1.2-c-uat-coverage']);

export class AdmissionError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const requireThat = (condition, code) => { if (!condition) throw new AdmissionError(code); };

// Only immutable event identity chooses the route. No label/input or skipped-success job.
export function candidateIdentity(env, event, checkoutSha) {
  const repository = env.GITHUB_REPOSITORY;
  requireThat(repositoryPattern.test(repository ?? ''), 'INVALID_REPOSITORY');
  requireThat(event?.repository?.full_name === repository, 'REPOSITORY_MISMATCH');
  requireThat(/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT ?? '') &&
    Number.isSafeInteger(Number(env.GITHUB_RUN_ATTEMPT)), 'INVALID_ATTEMPT');
  requireThat(shaPattern.test(checkoutSha ?? '') && checkoutSha === env.EXACT_RELEASE_COMMIT &&
    checkoutSha === env.RELEASE_COMMIT, 'CHECKOUT_MISMATCH');
  requireThat(shaPattern.test(env.GITHUB_SHA ?? ''), 'INVALID_EVENT_SHA');
  const attempt = Number(env.GITHUB_RUN_ATTEMPT);
  if (env.GITHUB_EVENT_NAME === 'pull_request') {
    const pr = event.pull_request;
    requireThat(event.action === 'ready_for_review',
      'FULL_PR_EXPLICIT_READY_REQUIRED');
    requireThat(Number.isSafeInteger(event.number) && event.number > 0 && pr?.number === event.number &&
      env.GITHUB_REF === `refs/pull/${event.number}/merge`, 'INVALID_PR_IDENTITY');
    requireThat(pr.state === 'open' && typeof pr.draft === 'boolean' && pr.merged !== true, 'INVALID_PR_STATE');
    requireThat(pr.base?.repo?.full_name === repository && bases.has(pr.base?.ref) &&
      shaPattern.test(pr.base?.sha ?? ''), 'INVALID_BASE');
    requireThat(shaPattern.test(pr.head?.sha ?? '') && pr.head.sha === checkoutSha &&
      repositoryPattern.test(pr.head?.repo?.full_name ?? '') &&
      typeof pr.head.ref === 'string' && pr.head.ref.length > 0, 'INVALID_HEAD');
    requireThat(pr.draft === false,'FULL_PR_STABLE_CANDIDATE_REQUIRED');
    // Ready transition is an intentional release action, not an accidental edit.
    // Live head/base and ancestry must still match both at start and finish.
    const focusedDraft = false;
    return { kind: 'pull_request', repository, attempt, sha: checkoutSha, number: event.number,
      headRepository: pr.head.repo.full_name, headRef: pr.head.ref,
      baseSha: pr.base.sha, baseRef: pr.base.ref, focusedDraft };
  }
  // Explicit final-release full execution on current main; no caller-supplied SHA
  // or dispatch-only replacement for a PR gate. Live main is rechecked at finish.
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    requireThat(env.GITHUB_REF === 'refs/heads/main' && ['main','refs/heads/main'].includes(event.ref) &&
      env.GITHUB_SHA === checkoutSha && (!event.inputs || Object.keys(event.inputs).length === 0), 'INVALID_FULL_MAIN_DISPATCH');
    return {kind:'push',repository,attempt,sha:checkoutSha,headRef:'main',focusedDraft:false};
  }
  requireThat(env.GITHUB_EVENT_NAME === 'push', 'INVALID_EVENT');
  requireThat(event.deleted === false && event.ref === env.GITHUB_REF &&
    /^refs\/heads\/(main|vfull-.+)$/.test(event.ref ?? '') &&
    event.after === checkoutSha && env.GITHUB_SHA === checkoutSha, 'INVALID_PUSH_IDENTITY');
  return { kind: 'push', repository, attempt, sha: checkoutSha,
    headRef: event.ref.slice('refs/heads/'.length), focusedDraft: false };
}

export function verifyLiveIdentity(identity, live) {
  if (identity.kind === 'push') {
    requireThat(live?.name === identity.headRef && live?.commit?.sha === identity.sha, 'STALE_PUSH');
    return;
  }
  requireThat(live?.number === identity.number && live.state === 'open' && live.merged !== true,
    'STALE_PR_STATE');
  requireThat(live.head?.sha === identity.sha && live.head?.ref === identity.headRef &&
    live.head?.repo?.full_name === identity.headRepository, 'STALE_PR_HEAD');
  requireThat(live.base?.sha === identity.baseSha && live.base?.ref === identity.baseRef &&
    live.base?.repo?.full_name === identity.repository, 'STALE_PR_BASE');
}

export async function runAdmission({ phase, env, event, checkoutSha, getLive, assertAncestor }) {
  requireThat(['start', 'finish'].includes(phase), 'INVALID_PHASE');
  const identity = candidateIdentity(env, event, checkoutSha);
  if (identity.focusedDraft) throw new AdmissionError('DRAFT_FOCUSED_ONLY');
  let live;
  try { live = await getLive(identity); } catch { throw new AdmissionError('LIVE_IDENTITY_UNAVAILABLE'); }
  verifyLiveIdentity(identity, live);
  if (identity.kind === 'pull_request') {
    let ancestor = false;
    try { ancestor = await assertAncestor(identity.baseSha, identity.sha); } catch { /* fail closed */ }
    requireThat(ancestor === true, 'BASE_NOT_IN_CANDIDATE');
  }
  return { status: phase === 'start' ? 'FULL_VALIDATION_ADMITTED' : 'FULL_VALIDATION_IDENTITY_CONFIRMED',
    ...identity };
}

async function getLive(identity) {
  requireThat(typeof process.env.GITHUB_TOKEN === 'string' && process.env.GITHUB_TOKEN.length > 0,
    'MISSING_READ_TOKEN');
  const resource = identity.kind === 'pull_request' ? `pulls/${identity.number}` :
    `branches/${encodeURIComponent(identity.headRef)}`;
  const response = await fetch(`https://api.github.com/repos/${identity.repository}/${resource}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28' },
    redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  requireThat(response.ok, 'LIVE_IDENTITY_UNAVAILABLE');
  return response.json();
}

function report(code, identity) {
  // Never print event payloads, network errors, headers, arbitrary server text or credentials.
  const detail = identity ? `; source=${identity.sha}; attempt=${identity.attempt}` +
    (identity.kind === 'pull_request' ? `; pr=${identity.number}; base=${identity.baseSha}` : '') : '';
  console.log(`${code}${detail}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const instruction = code === 'DRAFT_FOCUSED_ONLY' ?
      '\nDraft development uses focused branch feedback. This failed check blocks merge. When the exact candidate is stable, the Builder selects Re-run failed jobs on this PR run for the full suite before ready/review.\n' : '';
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${code}${detail}\n${instruction}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runAdmission({ phase: process.argv[2], env: process.env,
      event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
      checkoutSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), getLive,
      assertAncestor: (base, head) => {
        execFileSync('git', ['merge-base', '--is-ancestor', base, head], { stdio: 'ignore' });
        return true;
      } });
    report(result.status, result);
  } catch (error) {
    report(error instanceof AdmissionError ? error.code : 'ADMISSION_FAILED');
    process.exitCode = 1;
  }
}
