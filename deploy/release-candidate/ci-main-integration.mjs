// DEC-053: development integration proof, never a claim of full main execution.
import {readFileSync, writeFileSync, appendFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {fullJobSucceeded} from './ci-full-run-proof.mjs';
import {migrationInventory} from './ci-main-checks.mjs';

export const REPO = 'threeswordz/cinder-grind';
const SHA = /^[a-f0-9]{40}$/;
const BOT = 'chatgpt-codex-connector[bot]';
const API = 'https://api.github.com/repos/' + REPO + '/';
const need = (ok, code) => { if (!ok) throw new Error(code); };
const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;

// The mechanism, workflow and release-admission changes must validate themselves
// through full main. Ordinary application/schema changes can reuse reviewed proof.
export function protectedChange(paths) {
  return paths.some(p => p.startsWith('.github/') ||
    /^deploy\/release-candidate\/ci-/.test(p) ||
    /^deploy\/uat\/prototype-/.test(p) ||
    ['AGENTS.md','docs/CI-VALIDATION-POLICY.md','docs/PROJECT-GOVERNANCE.md',
      'docs/DECISION-LOG.md','docs/DEVELOPMENT-OPERATING-MODEL.md'].includes(p));
}

export function integrationPush(env, event, checkout) {
  return env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === 'refs/heads/main' &&
    env.GITHUB_RUN_ATTEMPT === '1' &&
    env.GITHUB_REPOSITORY === REPO && event.repository?.full_name === REPO &&
    event.ref === 'refs/heads/main' && event.deleted === false && event.forced === false &&
    SHA.test(event.before ?? '') && SHA.test(checkout ?? '') &&
    event.after === checkout && env.GITHUB_SHA === checkout &&
    env.GITHUB_WORKFLOW_REF === REPO + '/.github/workflows/validate.yml@refs/heads/main';
}

export async function pages(get, path) {
  const rows = [];
  for (let page = 1; page <= 10; page++) {
    const data = await get(path + (path.includes('?') ? '&' : '?') + 'per_page=100&page=' + page);
    need(Array.isArray(data), 'PAGINATION_INVALID');
    rows.push(...data);
    if (data.length < 100) return rows;
  }
  throw new Error('PAGINATION_LIMIT');
}

// API facts, not comments supplied by the Builder, bind the actual full run,
// clean independent review and guarded squash to one entire source tree.
export function fullPrIdentity(log,head,attempt,number,base) {
  const marker='FULL_VALIDATION_IDENTITY_CONFIRMED; source='+head+'; attempt='+attempt+'; pr='+number+'; base='+base;
  const lines=String(log).split(/\r?\n/).filter(l=>l.includes('FULL_VALIDATION_IDENTITY_CONFIRMED;'));
  return lines.length===1&&/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z /.test(lines[0])&&lines[0].slice(lines[0].indexOf(' ')+1)===marker;
}

async function previousMainProof(before,get){
  const result=await get('actions/runs?head_sha='+before+'&per_page=100');
  need(Number.isSafeInteger(result.total_count)&&result.total_count<=100&&result.workflow_runs?.length===result.total_count,'BASE_RUN_INVENTORY');
  for(const run of result.workflow_runs){
    if(run.head_sha!==before||run.head_branch!=='main'||!['push','workflow_dispatch'].includes(run.event)||
      run.repository?.full_name!==REPO||run.path!=='.github/workflows/validate.yml'||run.status!=='completed'||
      run.conclusion!=='success'||!Number.isSafeInteger(run.id)||run.id<=0||!Number.isSafeInteger(run.run_attempt)||run.run_attempt<1)continue;
    const jobs=await get('actions/runs/'+run.id+'/attempts/'+run.run_attempt+'/jobs?per_page=100');
    need(Number.isSafeInteger(jobs.total_count)&&jobs.total_count<=100&&jobs.jobs?.length===jobs.total_count,'BASE_JOB_INVENTORY');
    if(jobs.jobs.some(j=>fullJobSucceeded(j,run.id)))return {sha:before,runId:run.id,attempt:run.run_attempt,kind:'FULL_EXECUTION'};
    const quick=jobs.jobs.find(j=>j.name==='integration-check'&&j.run_id===run.id&&j.status==='completed'&&j.conclusion==='success'&&
      Array.isArray(j.steps)&&j.steps.every(s=>s.status==='completed'&&s.conclusion==='success')&&
      ['Build audit migrate and smoke exact main on fresh CI resources','Verify reviewed full-PR proof and emit integration receipt',
        'Preserve explicit integration receipt','Recheck live proof before admitting integration']
        .every(name=>j.steps.some(s=>s.name===name&&s.conclusion==='success')));
    if(quick)return {sha:before,runId:run.id,attempt:run.run_attempt,kind:'VERIFIED_INTEGRATION'};
  }
  throw Error('BASE_MAIN_GATE_UNPROVEN');
}

export async function inspectIntegration({sha, before, get, threads, ancestor, changedPaths, jobLog}) {
  need(SHA.test(sha ?? '') && SHA.test(before ?? ''), 'INVALID_SHA');
  need(!protectedChange(await changedPaths(before, sha)), 'PROOF_MECHANISM_CHANGED');
  const live = await get('branches/main');
  need(live?.commit?.sha === sha, 'STALE_MAIN');
  const integrated = await get('git/commits/' + sha);
  need(integrated.sha === sha && integrated.parents?.length === 1 && integrated.parents[0].sha === before &&
    SHA.test(integrated.tree?.sha ?? ''), 'NOT_GUARDED_SQUASH');
  const associated = await pages(get, 'commits/' + sha + '/pulls');
  const candidates = associated.filter(p => p.merged_at && p.merge_commit_sha === sha && p.base?.ref === 'main' &&
    p.base?.repo?.full_name === REPO && p.head?.repo?.full_name === REPO);
  need(candidates.length === 1, 'AMBIGUOUS_MERGE');
  const number = candidates[0].number;
  need(Number.isSafeInteger(number) && number > 0, 'INVALID_PR');
  const pr = await get('pulls/' + number);
  need(pr.merged === true && pr.state === 'closed' && pr.draft === false && pr.merge_commit_sha === sha &&
    pr.number === number && pr.base?.sha === before && pr.base.ref === 'main' &&
    pr.base.repo?.full_name === REPO && pr.head?.repo?.full_name === REPO && SHA.test(pr.head.sha ?? '') &&
    typeof pr.head.ref==='string'&&pr.head.ref.length>0, 'MERGE_IDENTITY');
  const head = pr.head.sha;
  need(await ancestor(before, head), 'BASE_NOT_ANCESTOR');
  const source = await get('git/commits/' + head);
  need(source.sha === head && source.tree?.sha === integrated.tree.sha, 'TREE_MISMATCH');
  const parentMain=await previousMainProof(before,get);
  const timeline = await pages(get, 'issues/' + number + '/timeline');
  const lastCommit = timeline.findLastIndex(e => e.event === 'committed');
  const readyIndex = timeline.findLastIndex(e => e.event === 'ready_for_review');
  need(lastCommit >= 0 && readyIndex > lastCommit && timeline[lastCommit].sha === head, 'REVIEW_HEAD_NOT_FROZEN');
  const ready = stamp(timeline[readyIndex].created_at), merged = stamp(pr.merged_at);
  need(Number.isFinite(ready) && merged > ready, 'REVIEW_TIME_INVALID');
  const reactions = await pages(get, 'issues/' + number + '/reactions');
  const clean = reactions.filter(r => r.content === '+1' && r.user?.login === BOT && r.user.type === 'Bot' &&
    stamp(r.created_at) >= ready && stamp(r.created_at) <= merged);
  need(clean.length === 1, 'INDEPENDENT_CLEAN_REVIEW_MISSING');
  const reviewedAt = stamp(clean[0].created_at);
  const reviews = await pages(get, 'pulls/' + number + '/reviews');
  need(!reviews.some(r => (r.state === 'CHANGES_REQUESTED' && stamp(r.submitted_at) >= ready) ||
    (r.user?.login === BOT && stamp(r.submitted_at) > reviewedAt)), 'LATER_REVIEW_CONFLICT');
  const threadState = await threads(number);
  need(threadState.head === head && Array.isArray(threadState.resolved) && threadState.resolved.every(x => x === true), 'UNRESOLVED_FINDINGS');
  const response = await get('actions/runs?head_sha=' + head + '&event=pull_request&per_page=100');
  need(Number.isSafeInteger(response.total_count) && response.total_count <= 100 &&
    response.workflow_runs?.length === response.total_count, 'RUN_INVENTORY_INCOMPLETE');
  const runs = response.workflow_runs.filter(r => r.event === 'pull_request' && r.head_sha === head &&
    r.head_branch===pr.head.ref &&
    r.repository?.full_name === REPO && r.head_repository?.full_name === REPO &&
    r.path === '.github/workflows/validate.yml' && r.name === 'Validate Construction ERP' &&
    r.status === 'completed' && r.conclusion === 'success' && Number.isSafeInteger(r.id) && r.id > 0 &&
    Number.isSafeInteger(r.run_attempt) && r.run_attempt > 0 && stamp(r.updated_at) <= ready);
  // More than one successful full run is not guessed away. Fall back to full.
  need(runs.length === 1, 'FULL_PR_PROOF_AMBIGUOUS_OR_MISSING');
  const run = runs[0];
  const jobs = await get('actions/runs/' + run.id + '/attempts/' + run.run_attempt + '/jobs?per_page=100');
  need(Number.isSafeInteger(jobs.total_count) && jobs.total_count <= 100 && jobs.jobs?.length === jobs.total_count, 'FULL_JOB_INVENTORY');
  const fullJobs=jobs.jobs.filter(j=>fullJobSucceeded(j,run.id)&&stamp(j.completed_at)<=ready);
  need(fullJobs.length===1&&Number.isSafeInteger(fullJobs[0].id)&&fullJobs[0].id>0,'FULL_JOB_NOT_EXECUTED');
  need(fullPrIdentity(await jobLog(fullJobs[0].id),head,run.run_attempt,number,before),'EXACT_PR_BASE_RECEIPT_MISSING');
  return {schemaVersion:1, kind:'MAIN_INTEGRATION_REUSES_FULL_PR', repository:REPO,
    integratedSha:sha, tree:integrated.tree.sha, baseSha:before, pr:number, testedSha:head,
    fullPrRunId:run.id, fullPrAttempt:run.run_attempt, independentReviewAt:clean[0].created_at,parentMain,
    fullSuiteExecutedOnMain:false};
}

async function api(path) {
  need(typeof process.env.GITHUB_TOKEN === 'string' && process.env.GITHUB_TOKEN.length > 0, 'MISSING_READ_TOKEN');
  need(typeof path === 'string' && !path.includes('://'), 'INVALID_API_PATH');
  const response = await fetch(API + path, {redirect:'error',signal:AbortSignal.timeout(20000),headers:{
    Accept:'application/vnd.github+json',Authorization:'Bearer ' + process.env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28'}});
  need(response.ok, 'GITHUB_READ_FAILED');
  return response.json();
}

export async function readJobLog(id,{request=fetch,token=process.env.GITHUB_TOKEN}={}){
  need(Number.isSafeInteger(id)&&id>0&&typeof token==='string'&&token.length>0,'JOB_LOG_ID_INVALID');
  let response=await request(API+'actions/jobs/'+id+'/logs',{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{
    Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}});
  if([301,302,303,307,308].includes(response.status)){
    const location=new URL(response.headers.get('location'));
    need(location.protocol==='https:'&&!location.username&&!location.password&&
      (location.hostname.endsWith('.blob.core.windows.net')||location.hostname.endsWith('.githubusercontent.com')),'UNTRUSTED_LOG_HOST');
    // Signed log URL only: NEVER forward the GitHub token to storage.
    response=await request(location,{redirect:'error',signal:AbortSignal.timeout(20000)});
  }
  need(response.ok,'JOB_LOG_UNAVAILABLE');
  let bytes=0,text='';
  for await(const chunk of response.body){bytes+=chunk.length;need(bytes<=50*1024*1024,'JOB_LOG_TOO_LARGE');text+=Buffer.from(chunk).toString('utf8');}
  return text;
}

async function reviewThreads(number) {
  const resolved = []; let cursor = null, head;
  for (let page = 0; page < 10; page++) {
    const response = await fetch('https://api.github.com/graphql', {method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{Authorization:'Bearer ' + process.env.GITHUB_TOKEN,'Content-Type':'application/json'},
      body:JSON.stringify({query:'query($number:Int!,$cursor:String){repository(owner:"threeswordz",name:"cinder-grind"){pullRequest(number:$number){headRefOid reviewThreads(first:100,after:$cursor){nodes{isResolved} pageInfo{hasNextPage endCursor}}}}}',variables:{number,cursor}})});
    need(response.ok, 'REVIEW_READ_FAILED');
    const result = await response.json(), pr = result.data?.repository?.pullRequest;
    need(!result.errors && pr && Array.isArray(pr.reviewThreads?.nodes), 'REVIEW_READ_INVALID');
    head ??= pr.headRefOid; need(head === pr.headRefOid, 'REVIEW_HEAD_CHANGED');
    resolved.push(...pr.reviewThreads.nodes.map(n => n.isResolved));
    if (pr.reviewThreads.pageInfo?.hasNextPage === false) return {head,resolved};
    need(typeof pr.reviewThreads.pageInfo?.endCursor === 'string', 'REVIEW_CURSOR_MISSING');
    cursor = pr.reviewThreads.pageInfo.endCursor;
  }
  throw new Error('REVIEW_PAGE_LIMIT');
}

function localDependencies() {
  return {get:api,threads:reviewThreads,jobLog:readJobLog,
    ancestor:async(base,head) => {try{execFileSync('git',['merge-base','--is-ancestor',base,head],{stdio:'ignore'});return true;}catch{return false;}},
    changedPaths:async(base,head) => execFileSync('git',['diff','--name-only',base,head],{encoding:'utf8'}).trim().split('\n').filter(Boolean)};
}

export async function planIntegration(env,event,sha,dependencies) {
  if (!integrationPush(env,event,sha)) return {mode:'full',reason:'FULL_EVENT_OR_INVALID_PUSH'};
  try {return {mode:'reuse',proof:await inspectIntegration({sha,before:event.before,...dependencies})};}
  catch {return {mode:'full',reason:'FULL_PROOF_REQUIRED'};}
}

async function cli() {
  const phase = process.argv[2]; need(['plan','finish'].includes(phase), 'INVALID_PHASE');
  const env = process.env, event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const result = await planIntegration(env,event,sha,localDependencies());
  if (phase === 'plan') {
    need(env.GITHUB_OUTPUT, 'MISSING_JOB_OUTPUT');
    appendFileSync(env.GITHUB_OUTPUT,'mode=' + result.mode + '\n');
    console.log(result.mode === 'reuse' ? 'REVIEWED_TREE_REUSE_ELIGIBLE' : 'FULL_VALIDATION_REQUIRED');
  } else {
    need(result.mode === 'reuse', 'INTEGRATION_PROOF_CHANGED');
    const checks = JSON.parse(readFileSync('/tmp/main-integration-checks.json','utf8'));
    need(checks.integratedSha === sha && checks.tree === result.proof.tree &&
      checks.runId===env.GITHUB_RUN_ID&&checks.attempt===env.GITHUB_RUN_ATTEMPT&&
      checks.node === 'v24.21.0' && checks.pnpm === '12.6.0' &&
      ['frozenBuild','freshSecurityAudit','freshMigrationStatus','ownedApiReady'].every(k => checks[k] === 'PASS') &&
      checks.migrationInventorySha256===migrationInventory('apps/api/prisma/migrations'), 'INTEGRATION_CHECKS_MISSING');
    const receipt = {...result.proof,checks,runId:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT};
    writeFileSync('/tmp/main-integration-receipt.json',JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
    need(env.GITHUB_OUTPUT && env.GITHUB_STEP_SUMMARY, 'MISSING_RECEIPT_OUTPUT');
    appendFileSync(env.GITHUB_STEP_SUMMARY,'\nMAIN INTEGRATION VERIFIED — full suite reused from exact reviewed PR tree; NOT full main execution.\n```json\n'+JSON.stringify(receipt,null,2)+'\n```\n');
    appendFileSync(env.GITHUB_OUTPUT,'verified=true\n');
    console.log('MAIN_INTEGRATION_VERIFIED_REUSED_FULL_PR ' + JSON.stringify(receipt));
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  cli().catch(() => {console.error('MAIN_INTEGRATION_PROOF_UNAVAILABLE');process.exitCode=1;});
}
