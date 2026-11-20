import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {REPO,inspectIntegration,planIntegration,integrationPush,pages,fullPrIdentity,readJobLog} from './ci-main-integration.mjs';
import {FULL_STEPS,fullJobSucceeded} from './ci-full-run-proof.mjs';
import {migrationInventory} from './ci-main-checks.mjs';

const sha='a'.repeat(40),before='b'.repeat(40),head='c'.repeat(40),tree='d'.repeat(40);
const ready='2026-11-20T10:00:00Z',clean='2026-11-20T10:01:00Z',merged='2026-11-20T10:02:00Z';
const repository={full_name:REPO};
function fixture(){
 const pr={number:42,state:'closed',draft:false,merged:true,merged_at:merged,merge_commit_sha:sha,
   base:{sha:before,ref:'main',repo:repository},head:{sha:head,ref:'vfeature',repo:repository}};
 const run={id:99,run_attempt:2,event:'pull_request',head_sha:head,head_branch:'vfeature',repository,head_repository:repository,
   path:'.github/workflows/validate.yml',name:'Validate Construction ERP',status:'completed',conclusion:'success',updated_at:'2026-11-20T09:59:00Z'};
 const job={id:555,name:'validate',run_id:99,status:'completed',conclusion:'success',completed_at:'2026-11-20T09:59:00Z',
   steps:FULL_STEPS.map(name=>({name,status:'completed',conclusion:'success'}))};
 const f={pr,run,job,threadState:{head,resolved:[true,true,true]},paths:['apps/api/src/inventory/material-return.service.ts'],ancestor:true,
   live:{commit:{sha}},integrated:{sha,tree:{sha:tree},parents:[{sha:before}]},source:{sha:head,tree:{sha:tree}},
   timeline:[{event:'committed',sha:head},{event:'ready_for_review',created_at:ready}],
   reactions:[{content:'+1',created_at:clean,user:{login:'chatgpt-codex-connector[bot]',type:'Bot'}}],reviews:[],
   log:'2026-11-20T09:59:00.000Z FULL_VALIDATION_IDENTITY_CONFIRMED; source='+head+'; attempt=2; pr=42; base='+before};
 const get=async path=>{
   if(path==='branches/main')return f.live;
   if(path==='git/commits/'+sha)return f.integrated;
   if(path==='git/commits/'+head)return f.source;
   if(path.split('?')[0]==='commits/'+sha+'/pulls')return [f.pr];
   if(path==='pulls/42')return f.pr;
   if(path.startsWith('issues/42/timeline?'))return f.timeline;
   if(path.startsWith('issues/42/reactions?'))return f.reactions;
   if(path.startsWith('pulls/42/reviews?'))return f.reviews;
   if(path.startsWith('actions/runs?head_sha='+before))throw Error('REDUNDANT_PREDECESSOR_MAIN_LOOKUP');
   if(path.startsWith('actions/runs?'))return {total_count:1,workflow_runs:[f.run]};
   if(path==='actions/runs/99/attempts/2/jobs?per_page=100')return {total_count:1,jobs:[f.job]};
   throw Error('Unexpected request '+path);
 };
 f.dependencies={get,threads:async()=>f.threadState,changedPaths:async()=>f.paths,ancestor:async()=>f.ancestor,jobLog:async()=>f.log};
 return f;
}
const inspect=f=>inspectIntegration({sha,before,...f.dependencies});
const env=()=>({GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:REPO,GITHUB_SHA:sha,
 GITHUB_RUN_ATTEMPT:'1',
 GITHUB_WORKFLOW_REF:REPO+'/.github/workflows/validate.yml@refs/heads/main'});
const event=()=>({repository,ref:'refs/heads/main',before,after:sha,deleted:false,forced:false});

test('eligible guarded tree carries real PR execution and review provenance, never full-main claims',async()=>{
 const f=fixture(),receipt=await inspect(f);
 assert.deepEqual(receipt,{schemaVersion:1,kind:'MAIN_INTEGRATION_REUSES_FULL_PR',repository:REPO,integratedSha:sha,
  tree,baseSha:before,pr:42,testedSha:head,fullPrRunId:99,fullPrAttempt:2,independentReviewAt:clean,
  fullSuiteExecutedOnMain:false});
 assert.equal((await planIntegration(env(),event(),sha,f.dependencies)).mode,'reuse');
});

for(const [name,change]of[
 ['stale main',f=>f.live.commit.sha=before],['wrong parent',f=>f.integrated.parents[0].sha=head],
 ['non-squash merge',f=>f.integrated.parents.push({sha:head})],['different entire tree',f=>f.source.tree.sha=before],
 ['changed source head',f=>f.pr.head.sha=before],['changed tested base',f=>f.pr.base.sha=head],
 ['foreign source repository',f=>f.pr.head={...f.pr.head,repo:{full_name:'evil/repo'}}],
 ['unmerged PR',f=>f.pr.merged=false],['unresolved finding',f=>f.threadState.resolved.push(false)],
 ['review on another head',f=>f.threadState.head=before],['unavailable ancestry',f=>f.ancestor=false],
 ['source changed after ready',f=>f.timeline.push({event:'committed',sha:head})],
 ['arbitrary user thumbs up',f=>f.reactions[0].user={login:'threeswordz',type:'User'}],
 ['arbitrary bot thumbs up',f=>f.reactions[0].user.login='other-bot[bot]'],
 ['stale review reaction',f=>f.reactions[0].created_at='2026-11-20T09:00:00Z'],
 ['reaction after merge',f=>f.reactions[0].created_at='2026-11-20T11:00:00Z'],
 ['later independent finding',f=>f.reviews.push({user:{login:'chatgpt-codex-connector[bot]'},submitted_at:merged,state:'COMMENTED'})],
 ['changes requested',f=>f.reviews.push({submitted_at:clean,state:'CHANGES_REQUESTED'})],
 ['failed full run',f=>f.run.conclusion='failure'],['focused run',f=>f.run.path='.github/workflows/validate-branch.yml'],
 ['wrong full-run source',f=>f.run.head_sha=before],['untrusted full workflow',f=>f.run.name='Other'],
 ['full run from another PR branch',f=>f.run.head_branch='vother'],
 ['full PR log from another base',f=>f.log=f.log.replace(before,head)],
 ['full PR log from another PR',f=>f.log=f.log.replace('pr=42','pr=43')],
 ['legacy full proof without PR binding',f=>f.log=f.log.split('; pr=')[0]],
 ['full proof after ready',f=>f.run.updated_at=merged],['skipped full job',f=>f.job.conclusion='skipped'],
 ['failed full step',f=>f.job.steps[0].conclusion='failure'],['missing recovery',f=>f.job.steps=f.job.steps.filter(s=>!s.name.includes('recovery'))],
 ['missing final identity',f=>f.job.steps.pop()],['unknown full run id',f=>f.run.id='99'],
 ['wrong run attempt',f=>f.run.run_attempt=3],
])test('fallback to full: '+name,async()=>{
 const f=fixture();change(f);
 assert.equal((await planIntegration(env(),event(),sha,f.dependencies)).mode,'full');
});

test('API failures never become reused success or forward arbitrary server/token messages',async()=>{
 const result=await planIntegration(env(),event(),sha,{...fixture().dependencies,get:async()=>{throw Error('secret-token');}});
 assert.deepEqual(result,{mode:'full',reason:'FULL_PROOF_REQUIRED'});
 assert.doesNotMatch(JSON.stringify(result),/secret-token/);
});

test('current full PR proof is sufficient without requesting another predecessor main run',async()=>{
 const receipt=await inspect(fixture());
 assert.equal(receipt.baseSha,before);
 assert.equal(receipt.fullPrRunId,99);
 assert.equal('parentMain' in receipt,false);
 assert.equal(receipt.fullSuiteExecutedOnMain,false);
});

for(const path of ['.github/workflows/validate.yml','deploy/release-candidate/ci-main-integration.mjs',
 'deploy/uat/prototype-transfer-upgrade.mjs','AGENTS.md','docs/CI-VALIDATION-POLICY.md']){
 test('reviewed exact full-PR tree reuses proof for '+path,async()=>{
  const f=fixture();f.paths=[path];
  f.dependencies.changedPaths=async()=>{throw Error('PATH_BASED_REPEAT_MUST_NOT_BE_REQUESTED');};
  assert.equal((await planIntegration(env(),event(),sha,f.dependencies)).mode,'reuse');
  f.source.tree.sha=before;
  assert.equal((await planIntegration(env(),event(),sha,f.dependencies)).mode,'full');
 });
}

test('only exact normal main pushes may request reuse; PR, explicit full, dispatch and malformed events use full',()=>{
 assert.equal(integrationPush(env(),event(),sha),true);
 for(const changed of [{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_EVENT_NAME:'workflow_dispatch'},
  {GITHUB_REF:'refs/heads/vfull-release'},{GITHUB_REPOSITORY:'wrong/repo'},
  {GITHUB_WORKFLOW_REF:'wrong'},{GITHUB_SHA:head},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_RUN_ATTEMPT:undefined}])assert.equal(integrationPush({...env(),...changed},event(),sha),false);
 for(const changed of [{deleted:true},{forced:true},{after:head},{before:'bad'},{ref:'refs/heads/other'}])
  assert.equal(integrationPush(env(),{...event(),...changed},sha),false);
});

test('all API pagination is bounded and complete; unknown truncation fails',async()=>{
 let calls=0;
 assert.equal((await pages(async()=>++calls===1?Array(100).fill(1):[2],'pulls/1/reviews')).length,101);
 await assert.rejects(pages(async()=>Array(100).fill(1),'pulls/1/reviews'),/PAGINATION_LIMIT/);
 await assert.rejects(pages(async()=>({}),'pulls/1/reviews'),/PAGINATION_INVALID/);
});

test('a skipped full job cannot supply full execution evidence',()=>{
 const f=fixture();assert.equal(fullJobSucceeded(f.job,99),true);
 assert.equal(fullJobSucceeded({...f.job,conclusion:'skipped'},99),false);
 assert.equal(fullJobSucceeded({...f.job,name:'integration-check'},99),false);
});

test('full proof log binds PR, base, attempt and source, rejecting duplicate or arbitrary lines',()=>{
 const f=fixture();assert.equal(fullPrIdentity(f.log,head,2,42,before),true);
 assert.equal(fullPrIdentity(f.log,head,3,42,before),false);
 assert.equal(fullPrIdentity(f.log+'\n'+f.log,head,2,42,before),false);
 assert.equal(fullPrIdentity(f.log.slice(f.log.indexOf('FULL_VALIDATION')),head,2,42,before),false);
});

test('signed job-log download never forwards the GitHub credential to storage',async()=>{
 const calls=[];
 const text=await readJobLog(555,{token:'private-token',request:async(url,options)=>{
  calls.push({url:String(url),options});
  return calls.length===1?new Response('',{status:302,headers:{location:'https://logs.blob.core.windows.net/signed/log'}}):new Response('proof');
 }});
 assert.equal(text,'proof');assert.equal(calls[0].options.headers.Authorization,'Bearer private-token');
 assert.equal(calls[1].options.headers,undefined);assert.equal(calls[1].options.redirect,'error');
});
test('unknown signed-log hosts are rejected before a credentialless second request',async()=>{
 let calls=0;
 await assert.rejects(readJobLog(555,{token:'private-token',request:async()=>{calls++;return new Response('',{status:302,headers:{location:'https://attacker.invalid/log'}});}}),/UNTRUSTED_LOG_HOST/);
 assert.equal(calls,1);
});
test('unavailable or oversized job logs require full fallback',async()=>{
 await assert.rejects(readJobLog(555,{token:'private-token',request:async()=>new Response('',{status:403})}),/JOB_LOG_UNAVAILABLE/);
 await assert.rejects(readJobLog(555,{token:'private-token',request:async()=>({status:200,ok:true,body:{async *[Symbol.asyncIterator](){yield {length:50*1024*1024+1};}}})}),/JOB_LOG_TOO_LARGE/);
});

test('migration inventory binds exact filenames and bytes, not just count',()=>{
 const root=mkdtempSync(join(tmpdir(),'main-migrations-'));
 try{
  writeFileSync(join(root,'one.sql'),'original');const original=migrationInventory(root);
  writeFileSync(join(root,'one.sql'),'changed');assert.notEqual(migrationInventory(root),original);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('release consumers require an actual complete full job for push or explicit main dispatch',async()=>{
 const names=['actors','browser-operator','material-operator','material-ui-operator','fm03-upgrade','receiving-upgrade','transfer-upgrade','runtime-operator'];
 const run={id:123,run_attempt:2,head_sha:sha,head_branch:'main',path:'.github/workflows/validate.yml',event:'push',status:'completed',conclusion:'success'};
 const steps=Array.from({length:30},(_,i)=>({name:'step'+i,status:'completed',conclusion:'success'}));
 steps[0].name='Run V1.0-B paired recovery and isolated restore drill';steps[1].name='Verify V1.0-E consolidated technical evidence';
 const job={name:'validate',run_id:123,status:'completed',conclusion:'success',steps};
 for(const name of names){
  const {fullExecutionSucceeded}=await import('../uat/prototype-'+name+'.mjs');
  const request=async url=>{assert.match(url,/\/runs\/123\/attempts\/2\/jobs\?per_page=100$/);return {total_count:1,jobs:[job]};};
  assert.equal(await fullExecutionSucceeded(run,sha,request),true,name);
  assert.equal(await fullExecutionSucceeded({...run,event:'workflow_dispatch'},sha,request),true,name);
  assert.equal(await fullExecutionSucceeded({...run,event:'pull_request'},sha,request),false,name);
  assert.equal(await fullExecutionSucceeded({...run,head_sha:head},sha,request),false,name);
  assert.equal(await fullExecutionSucceeded(run,sha,async()=>({total_count:1,jobs:[{...job,conclusion:'skipped'}]})),false,name);
  assert.equal(await fullExecutionSucceeded(run,sha,async()=>({total_count:1,jobs:[{...job,name:'integration-check'}]})),false,name);
  assert.equal(await fullExecutionSucceeded(run,sha,async()=>({total_count:101,jobs:[job]})),false,name);
 }
});

test('CLI unknown/ordinary branch routing yields full only and does not print secrets',()=>{
 const directory=mkdtempSync(join(tmpdir(),'main-route-'));
 try{
  const input=join(directory,'event.json'),output=join(directory,'output');writeFileSync(input,'{}');
  const r=spawnSync(process.execPath,[fileURLToPath(new URL('./ci-main-integration.mjs',import.meta.url)),'plan'],{
   encoding:'utf8',env:{...process.env,GITHUB_EVENT_NAME:'pull_request',GITHUB_EVENT_PATH:input,GITHUB_OUTPUT:output,GITHUB_TOKEN:'never-print-token'}});
  assert.equal(r.status,0);assert.equal(readFileSync(output,'utf8'),'mode=full\n');
  assert.doesNotMatch(r.stdout+r.stderr,/never-print-token/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
