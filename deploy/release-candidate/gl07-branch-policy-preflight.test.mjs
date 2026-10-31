import assert from 'node:assert/strict';
import test from 'node:test';
import {analyzeSnapshot,targetApplies,exampleSnapshot} from '../uat/gl07-branch-policy-preflight.mjs';

const activeRuleset=()=>({
 target:'branch',enforcement:'active',conditions:{ref_name:{include:['~DEFAULT_BRANCH'],exclude:[]}},
 bypass_actors:[],rules:[
  {type:'required_status_checks',parameters:{required_status_checks:[{context:'validate'}]}},
  {type:'pull_request',parameters:{required_approving_review_count:1}},
  {type:'non_fast_forward'},
  {type:'deletion'}
 ]});
const snapshot=()=>({...exampleSnapshot(),branch:{name:'main',protected:true},rulesets:[activeRuleset()]});

test('unprotected main remains a blocker even when source CI would be green',()=>{
 const result=analyzeSnapshot(exampleSnapshot());
 assert.equal(result.status,'GOVERNANCE_READBACK_GAPS');
 assert.equal(result.proposedPolicyMatchesReadback,false);
 assert.ok(result.gaps.includes('MAIN_BRANCH_NOT_PROTECTED'));
 assert.ok(result.gaps.includes('VALIDATE_REQUIRED_CHECK_MISSING'));
 assert.equal(result.productionGateClosed,false);
});
test('matching rules are a policy proposal check, never deployment/security acceptance',()=>{
 const result=analyzeSnapshot(snapshot());
 assert.equal(result.proposedPolicyMatchesReadback,true);
 assert.equal(result.status,'PROPOSED_POLICY_MATCHES_READBACK_ADMIN_ENFORCEMENT_TEST_PENDING');
 assert.equal(result.mainProtectionIndependentlyConfirmed,false);
 assert.equal(result.actualAdminEnforcementTest,'NOT_RUN');
 assert.equal(result.productionGateClosed,false);
 assert.equal(result.changesApplied,false);
});
test('ruleset must enforce main and cannot quietly exempt default branch',()=>{
 const original=activeRuleset();
 assert.equal(targetApplies(original),true);
 for(const changed of [
  {...original,enforcement:'evaluate'},
  {...original,conditions:{ref_name:{include:['~DEFAULT_BRANCH'],exclude:['refs/heads/main']}}},
  {...original,conditions:{ref_name:{include:['refs/heads/feature'],exclude:[]}}},
  {...original,conditions:{ref_name:{include:['~DEFAULT_BRANCH']}}},
 ])assert.equal(targetApplies(changed),false);
});
test('fail closed on missing check, review, force-push and deletion prohibitions',()=>{
 for(const type of ['required_status_checks','pull_request','non_fast_forward','deletion']){
  const s=snapshot();
  s.rulesets[0].rules=s.rulesets[0].rules.filter(r=>r.type!==type);
  const result=analyzeSnapshot(s);
  assert.equal(result.proposedPolicyMatchesReadback,false);
  assert.ok(result.gaps.length);
 }
});
test('no unreviewed bypass actors or unverifiable ruleset actor field',()=>{
 const s=snapshot();
 s.rulesets[0].bypass_actors=[{actor_id:1,actor_type:'RepositoryRole',bypass_mode:'always'}];
 assert.ok(analyzeSnapshot(s).gaps.includes('BYPASS_ACTORS_UNVERIFIED'));
 delete s.rulesets[0].bypass_actors;
 assert.ok(analyzeSnapshot(s).gaps.includes('BYPASS_ACTORS_UNVERIFIED'));
});
test('reject wrong repository, branch and malformed snapshot',()=>{
 assert.throws(()=>analyzeSnapshot({...snapshot(),repository:{full_name:'someone/other',default_branch:'main'}}),/INVALID_GITHUB_SETTINGS_SNAPSHOT/);
 assert.throws(()=>analyzeSnapshot({...snapshot(),branch:{name:'staging',protected:true}}),/INVALID_GITHUB_SETTINGS_SNAPSHOT/);
 assert.throws(()=>analyzeSnapshot({}),/INVALID_GITHUB_SETTINGS_SNAPSHOT/);
});
