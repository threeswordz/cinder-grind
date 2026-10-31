// GL07 admin handoff only: evaluate a read-only, supplied settings snapshot; never mutate GitHub.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const EXPECTED_REPO='threeswordz/cinder-grind';
const EXPECTED_BRANCH='main';
const CHECK_CONTEXT='validate';
const errors=items=>[...new Set(items)].sort();

export function targetApplies(ruleset){
  if(ruleset?.target!=='branch'||ruleset?.enforcement!=='active')return false;
  const include=ruleset.conditions?.ref_name?.include;
  const exclude=ruleset.conditions?.ref_name?.exclude;
  if(!Array.isArray(include)||!Array.isArray(exclude))return false;
  const matches=include.includes('~DEFAULT_BRANCH')||include.includes('refs/heads/main');
  // Fail closed: even an unfamiliar ref glob can exclude main. Admin review required for any exclusions.
  const excluded=exclude.length>0;
  return matches&&!excluded;
}
export function analyzeSnapshot(snapshot){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
     snapshot.repository?.full_name!==EXPECTED_REPO||
     snapshot.repository?.default_branch!==EXPECTED_BRANCH||
     snapshot.branch?.name!==EXPECTED_BRANCH||
     !Array.isArray(snapshot.rulesets)||snapshot.rulesets.length>100)
    throw new Error('INVALID_GITHUB_SETTINGS_SNAPSHOT');
  const gaps=[];
  if(snapshot.branch.protected!==true)gaps.push('MAIN_BRANCH_NOT_PROTECTED');
  const rulesets=snapshot.rulesets.filter(targetApplies);
  if(rulesets.length===0)gaps.push('NO_ACTIVE_DEFAULT_BRANCH_RULESET');
  const activeRules=rulesets.flatMap(x=>Array.isArray(x.rules)?x.rules:[]);
  const types=activeRules.map(x=>x?.type);
  const requiredStatuses=activeRules.filter(x=>x?.type==='required_status_checks')
    .flatMap(x=>Array.isArray(x.parameters?.required_status_checks)?x.parameters.required_status_checks:[]);
  if(!requiredStatuses.some(x=>x?.context===CHECK_CONTEXT))gaps.push('VALIDATE_REQUIRED_CHECK_MISSING');
  if(!activeRules.some(x=>x?.type==='pull_request'&&
      Number.isInteger(x.parameters?.required_approving_review_count)&&
      x.parameters.required_approving_review_count>=1))
     gaps.push('PR_APPROVAL_GATE_MISSING');
  if(!types.includes('non_fast_forward'))gaps.push('FORCE_PUSH_BLOCK_RULE_MISSING');
  if(!types.includes('deletion'))gaps.push('BRANCH_DELETION_BLOCK_RULE_MISSING');
  if(rulesets.some(x=>!Array.isArray(x.bypass_actors)||x.bypass_actors.length>0))
    gaps.push('BYPASS_ACTORS_UNVERIFIED');
  const issues=errors(gaps);
  return {
    purpose:'GL07_OFFLINE_GITHUB_RULESET_POLICY_PRECHECK',
    inputSource:'CALLER_SUPPLIED_READBACK_NOT_ATTESTED',
    expectedRepository:EXPECTED_REPO,expectedBranch:EXPECTED_BRANCH,expectedCheckContext:CHECK_CONTEXT,
    status:issues.length?'GOVERNANCE_READBACK_GAPS':'PROPOSED_POLICY_MATCHES_READBACK_ADMIN_ENFORCEMENT_TEST_PENDING',
    proposedPolicyMatchesReadback:issues.length===0,
    checkedActiveTargetingRulesets:rulesets.length,
    gaps:issues,
    greenCINotEnough:true,
    actualAdminEnforcementTest:'NOT_RUN',
    humanReviewAndBusinessAcceptance:'NOT_RUN',
    mainProtectionIndependentlyConfirmed:false,
    productionAuthorized:false,
    productionGateClosed:false,
    changesApplied:false,
  };
}
export const exampleSnapshot=()=>({
 repository:{full_name:EXPECTED_REPO,default_branch:EXPECTED_BRANCH},
 branch:{name:EXPECTED_BRANCH,protected:false},
 rulesets:[],
});
async function main(args){
  if(args.length===1&&args[0]==='--plan'){
    process.stdout.write(JSON.stringify({plan:exampleSnapshot(),
      note:'Fill with real read-only GitHub API fields. No automatic network, grant, branch or Production access.'},null,2)+'\n');
    return;
  }
  if(args.length!==2||args[0]!=='--evaluate')throw new Error('USAGE_PLAN_OR_EVALUATE_JSON_FILE');
  const path=resolve(args[1]);
  const buffer=await readFile(path);
  if(buffer.length>100_000)throw new Error('SNAPSHOT_TOO_LARGE');
  let obj;try{obj=JSON.parse(buffer.toString('utf8'));}catch{throw new Error('INVALID_JSON_SNAPSHOT');}
  const result=analyzeSnapshot(obj);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(!result.proposedPolicyMatchesReadback)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main(process.argv.slice(2)).catch(error=>{
    process.stderr.write('GL07_READONLY_PREFLIGHT_BLOCKED:'+error.message+'\n');
    process.exitCode=2;
  });
}
