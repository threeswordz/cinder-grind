// CI-only controlled two-lane rehearsal scheduler. Every historical release
// predecessor still runs the unmodified rehearsal and produces the same evidence.
// Distinct current-candidate worktrees isolate node_modules, generated clients,
// and builds; the unchanged child scripts isolate their own database, ports,
// predecessor worktree and recovery storage.
// The combined evidence verifier in validate.yml remains unchanged.
import {spawn, execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {performance} from 'node:perf_hooks';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const GROUPS = Object.freeze([
  Object.freeze([
    {name:'V1.0-E', previous:'65857a384005e1734028ffb6945b1077ed3449e5', file:'/tmp/v1-0-e-rehearsal.json'},
    {name:'Customer BOQ', previous:'fc52a867c96a8b3a369b480b9799bad1a5e9f399', file:'/tmp/v1-3-customer-boq-rehearsal.json'},
    {name:'HR1-A', previous:'e86ed846f30ac3feeb09f74ba9084571b9955520', file:'/tmp/hr1-a-employee-rehearsal.json'},
    {name:'Material request', previous:'3a5ae8a92083a2bd03f4159b1e84d0565e7e78ec', file:'/tmp/material-request-rehearsal.json'},
  ]),
  Object.freeze([
    {name:'Material plan entry', previous:'34e022d5807d3e16458437a02ebba669ba838c6a', file:'/tmp/material-plan-rehearsal.json'},
    {name:'Material plan B1', previous:'5209c30a1b7b282a603ba09d4a5bd82a700a183f', file:'/tmp/material-plan-issue-rehearsal.json'},
    {name:'Post-FM03 receiving', previous:'d2b790801119fb1b5b4176ad416086ee7363d091', file:'/tmp/receiving-rehearsal.json'},
    {name:'Material UOM approved entry', previous:'59d67d1f2e54e6bfde51e4c5be336ea97906bf52', file:'/tmp/material-uom-rehearsal.json'},
  ]),
]);

// Wait for BOTH groups so independent on-exit database/worktree cleanup finishes.
// An unsuccessful group can never yield a successful combined step.
export async function runGroups(groups, runOne) {
  const outcomes = await Promise.allSettled(groups.map(async group => {
    for (const entry of group) await runOne(entry);
  }));
  const failures = outcomes.filter(outcome => outcome.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(f => f.reason), 'Historical rehearsal group failed; full release evidence is invalid');
}

export function verifyEvidence(groups, releaseCommit, read = readFileSync, expectedCi = null) {
  const seenPaths = new Set();
  const seenCommits = new Set();
  for (const entry of groups.flat()) {
    if (!/^[0-9a-f]{40}$/.test(entry.previous) || seenPaths.has(entry.file) || seenCommits.has(entry.previous)) {
      throw new Error('Duplicate or invalid historical predecessor: ' + entry.name);
    }
    seenPaths.add(entry.file);
    seenCommits.add(entry.previous);
    let evidence;
    try { evidence = JSON.parse(read(entry.file, 'utf8')); }
    catch { throw new Error('Missing or unreadable historical evidence: ' + entry.name); }
    if (evidence.releaseCommit !== releaseCommit ||
        evidence.previousReleaseCommit !== entry.previous ||
        evidence.exactCheckout !== 'PASS' ||
        evidence.cleanTree !== 'PASS' ||
        evidence.freshMigration !== 'PASS' ||
        evidence.verifiedRecoveryPoint !== 'PASS' ||
        evidence.productionPreparation !== 'PASS' ||
        evidence.rollbackReadiness !== 'PASS') {
      throw new Error('Missing exact predecessor PASS proof: ' + entry.name);
    }
    if (expectedCi && Object.entries(expectedCi).some(([key,value]) => evidence.ci?.[key] !== value)) {
      throw new Error('Historical evidence is not from this exact GitHub Actions run/attempt/job: ' + entry.name);
    }
  }
  if (seenPaths.size !== 8) throw new Error('Expected exactly eight historical predecessor evidences');
}

// Create each detached current worktree before concurrent use; wait for both
// lanes before removing any. Cleanup failure is itself a failed full gate.
export async function withIsolatedLanes(groups, prepare, runLane, cleanup) {
  const prepared = [];
  const failures = [];
  try {
    for (let index=0; index<groups.length; index++) prepared.push(await prepare(index));
    const outcomes = await Promise.allSettled(groups.map((group,index)=>runLane(group,prepared[index])));
    for (const outcome of outcomes) if (outcome.status==='rejected') failures.push(outcome.reason);
  } catch(error) { failures.push(error); }
  finally {
    for (const lane of prepared.reverse()) {
      try { await cleanup(lane); } catch(error) { failures.push(error); }
    }
  }
  if (failures.length) throw new AggregateError(failures,'Isolated rehearsal lanes failed; full evidence invalid');
}

function command(file,args,cwd,env) {
  return new Promise((accept,reject)=>{
    const child=spawn(file,args,{cwd,env,stdio:'inherit'});
    child.once('error',reject);
    child.once('close',(code,signal)=>code===0&&!signal?accept():reject(
      new Error(file+' '+args.join(' ')+' failed (code '+code+', signal '+signal+')')));
  });
}

export async function main() {
  const release=process.env.RELEASE_COMMIT||'';
  const database=process.env.RC_BASE_DATABASE_URL||process.env.DATABASE_URL||'';
  const expectedCi={provider:'github-actions',workflow:process.env.GITHUB_WORKFLOW,
    workflowRef:process.env.GITHUB_WORKFLOW_REF,runId:process.env.GITHUB_RUN_ID,
    runNumber:process.env.GITHUB_RUN_NUMBER,runAttempt:process.env.GITHUB_RUN_ATTEMPT,
    job:process.env.GITHUB_JOB,repository:process.env.GITHUB_REPOSITORY};
  if(!/^[0-9a-f]{40}$/.test(release)||!database||
    process.env.RC_NON_PRODUCTION_CONFIRMED!=='YES'||process.env.RC_ENVIRONMENT!=='ci'||
    process.env.RC_POSTGRES_TOOL_MODE!=='docker'||process.env.GITHUB_ACTIONS!=='true'||
    Object.values(expectedCi).some(value=>!value)||expectedCi.job!=='validate')
    throw new Error('Parallel rehearsal requires exact non-Production GitHub validate job identity');
  const repo=resolve(fileURLToPath(import.meta.url),'..','..','..');
  const git=(args,cwd=repo)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
  if(git(['rev-parse','HEAD'])!==release||git(['status','--porcelain']))
    throw new Error('Current release checkout must be exact and clean');
  const entries=GROUPS.flat();
  if(entries.length!==8||new Set(entries.map(x=>x.file)).size!==8||
     new Set(entries.map(x=>x.previous)).size!==8)throw new Error('Historical inventory invalid');
  for(const entry of entries)
    writeFileSync(entry.file,'{"version":1,"rehearsalStatus":"INCOMPLETE"}\n',{mode:0o600});
  const root=mkdtempSync(join(tmpdir(),'erp-ci-rehearsal-lanes-'));
  const started=performance.now();
  let completed=false;
  try {
    await withIsolatedLanes(GROUPS,index=>{
      const lane=join(root,'lane-'+(index+1));
      git(['worktree', 'add', '--detach',lane,release]);
      return lane;
    },async(group,lane)=>{
      const env={...process.env,GITHUB_WORKSPACE:lane,RELEASE_COMMIT:release,
        RC_NON_PRODUCTION_CONFIRMED:'YES',RC_ENVIRONMENT:'ci',
        RC_POSTGRES_TOOL_MODE:'docker',RC_BASE_DATABASE_URL:database};
      if(git(['rev-parse','HEAD'],lane)!==release)throw new Error('Lane checkout mismatch');
      await command('pnpm',['install','--frozen-lockfile'],lane,env);
      await command('pnpm',['prisma:generate'],lane,env);
      await runGroups([group],async entry=>{
        const t=performance.now();
        process.stdout.write('START '+entry.name+' / '+entry.previous+'\n');
        await command('bash',['deploy/release-candidate/rehearse.sh'],lane,{
          ...env,RC_PREVIOUS_RELEASE_COMMIT:entry.previous,RC_EVIDENCE_FILE:entry.file});
        process.stdout.write('PASS '+entry.name+' elapsedSeconds='+Math.round((performance.now()-t)/1000)+'\n');
      });
    },lane=>{git(['worktree', 'remove', '--force',lane]);});
    // Never substitute this identity/basic PASS check for the existing full
    // source-specific consolidated verifier after recovery.
    verifyEvidence(GROUPS,release,readFileSync,expectedCi);
    completed=true;
  } finally {
    // Do not erase a still-registered worktree after a cleanup failure.
    if(completed)rmSync(root,{recursive:true,force:true});
  }
  process.stdout.write('PASS: eight exact historical predecessors, two isolated lanes, elapsedSeconds='+
    Math.round((performance.now()-started)/1000)+'\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error);
    process.exitCode=1;
  });
}
