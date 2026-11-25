// Stage A: isolated historical jobs, not yet wired into the mandatory workflow.
// No release gate is satisfied by this module alone. The existing detailed
// consolidation verifier and actual-job proof must be adapted before activation.
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { GROUPS, verifyEvidence } from './ci-parallel-rehearsals.mjs';

const [left,right]=GROUPS;
export const SHARDS=Object.freeze({
  'history-a':Object.freeze([left[0],right[3]]),
  'history-b':Object.freeze([right[0],right[2]]),
  'history-c':Object.freeze([left[1],left[3]]),
  'history-d':Object.freeze([left[2],right[1]]),
});
const need=(condition,message)=>{if(!condition)throw new Error(message);};
const SHA=/^[a-f0-9]{40}$/;
const POS=/^[1-9][0-9]*$/;

export function ciIdentity(env,job){
  need(Object.hasOwn(SHARDS,job),'Unknown historical job');
  need(env.GITHUB_ACTIONS==='true'&&SHA.test(env.RELEASE_COMMIT??'')&&
    env.EXACT_RELEASE_COMMIT===env.RELEASE_COMMIT&&
    POS.test(env.GITHUB_RUN_ID??'')&&POS.test(env.GITHUB_RUN_NUMBER??'')&&
    POS.test(env.GITHUB_RUN_ATTEMPT??''),'Missing exact run identity');
  const ci={provider:'github-actions',workflow:env.GITHUB_WORKFLOW,
    workflowRef:env.GITHUB_WORKFLOW_REF,runId:env.GITHUB_RUN_ID,
    runNumber:env.GITHUB_RUN_NUMBER,runAttempt:env.GITHUB_RUN_ATTEMPT,
    job,repository:env.GITHUB_REPOSITORY};
  need(Object.values(ci).every(v=>typeof v==='string'&&v.trim()===v&&v.length>0),
    'Incomplete CI provenance');
  return ci;
}

export function artifactName(env,job){
  const ci=ciIdentity(env,job);
  return 'erp-history-'+ci.runId+'-'+ci.runAttempt+'-'+job;
}

export function checkShard(job,env,read){
  const ci=ciIdentity(env,job);
  const result=new Map();
  for(const entry of SHARDS[job]){
    const raw=read(basename(entry.file));
    need(typeof raw==='string'&&raw.length>0&&Buffer.byteLength(raw)<=1024*1024,
      'Missing or oversized shard evidence: '+entry.name);
    const evidence=JSON.parse(raw);
    need(evidence.releaseCommit===env.RELEASE_COMMIT&&evidence.previousReleaseCommit===entry.previous&&
      ['exactCheckout','cleanTree','freshMigration','verifiedRecoveryPoint',
       'productionPreparation','rollbackReadiness'].every(key=>evidence[key]==='PASS'),
      'Historical PASS proof missing: '+entry.name);
    need(Object.entries(ci).every(([key,value])=>evidence.ci?.[key]===value),
      'Historical provenance mismatch: '+entry.name);
    result.set(entry.file,raw);
  }
  return result;
}

// Expected layout: one downloaded artifact directory per exact run/attempt/job.
// Reject extra, absent, duplicate, swapped or non-regular files before passing
// the complete set through the existing eight-predecessor verifier.
export function readArtifact(root,job,env){
  const dir=join(root,artifactName(env,job));
  need(lstatSync(dir).isDirectory(),'Artifact directory is not a real directory');
  const expected=SHARDS[job].map(e=>basename(e.file)).sort();
  const actual=readdirSync(dir).sort();
  need(actual.length===expected.length&&actual.every((v,i)=>v===expected[i]),
    'Artifact file inventory mismatch: '+job);
  return checkShard(job,env,name=>{
    const file=join(dir,name), stat=lstatSync(file);
    need(stat.isFile()&&stat.size<=1024*1024,'Invalid evidence file: '+name);
    return readFileSync(file,'utf8');
  });
}

export function collectShards(env,readJob){
  const collected=new Map();
  for(const job of Object.keys(SHARDS)){
    const rows=readJob(job);
    need(rows instanceof Map&&rows.size===SHARDS[job].length,'Missing shard inventory: '+job);
    // Revalidate the raw data at aggregation, not just at the producing runner.
    const checked=checkShard(job,env,name=>rows.get('/tmp/'+name));
    for(const [path,raw] of checked){
      need(!collected.has(path),'Duplicate historical evidence');
      collected.set(path,raw);
    }
  }
  verifyEvidence(GROUPS,env.RELEASE_COMMIT,path=>collected.get(path));
  return collected;
}

function run(file,args,env){
  return new Promise((ok,fail)=>{
    const child=spawn(file,args,{env,stdio:'inherit'});
    child.once('error',fail);
    child.once('close',(code,signal)=>code===0&&!signal?ok():fail(new Error('Historical command failed: '+file)));
  });
}

export async function runShard(env=process.env){
  const job=env.GITHUB_JOB;
  ciIdentity(env,job);
  need(env.RC_NON_PRODUCTION_CONFIRMED==='YES'&&env.RC_ENVIRONMENT==='ci'&&
    env.RC_POSTGRES_TOOL_MODE==='docker'&&
    env.RC_BASE_DATABASE_URL==='postgresql://construction_erp:construction_erp_dev_only@localhost:5432/construction_erp?schema=public',
    'Only the disposable CI PostgreSQL service is permitted');
  need(typeof env.RUNNER_TEMP==='string'&&env.RUNNER_TEMP.startsWith('/')&&env.GITHUB_OUTPUT,
    'Missing isolated runner paths');
  const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
  need(git(['rev-parse','HEAD'])===env.RELEASE_COMMIT&&!git(['status','--porcelain']),
    'Historical job needs exact clean checkout');
  const root=join(env.RUNNER_TEMP,artifactName(env,job));
  mkdirSync(root,{mode:0o700}); // exclusive: never overwrite/reuse prior output
  const start=performance.now();
  for(const entry of SHARDS[job]){
    const t=performance.now();
    await run('bash',['deploy/release-candidate/rehearse.sh'],{
      ...env,RC_PREVIOUS_RELEASE_COMMIT:entry.previous,RC_EVIDENCE_FILE:join(root,basename(entry.file))});
    console.log('PASS '+entry.name+' elapsedSeconds='+Math.round((performance.now()-t)/1000));
  }
  readArtifact(env.RUNNER_TEMP,job,env);
  // Publish output only after both child rehearsals and identity checks succeed.
  appendFileSync(env.GITHUB_OUTPUT,'evidence_path='+root+'\n');
  console.log('PASS '+job+' elapsedSeconds='+Math.round((performance.now()-start)/1000));
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  runShard().catch(error=>{console.error(error.message);process.exitCode=1;});
}
