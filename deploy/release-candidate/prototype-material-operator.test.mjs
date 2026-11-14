import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE} from '../uat/prototype-actors.mjs';
import {toolingOnly,validBrowserProof,operator} from '../uat/prototype-material-operator.mjs';

test('material operator allows no write mode or non-Mac target access',async()=>{
  for(const mode of ['--configure','--verify','--run','--reset',undefined])
    await assert.rejects(operator(mode),e=>e.safeCode==='MATERIAL_READ_ONLY_PLAN_ONLY');
  if(process.platform!=='darwin')await assert.rejects(operator('--plan'),e=>e.safeCode==='NONROOT_MAC_OPERATOR_REQUIRED');
});
test('new operator provenance bounds tooling and pins the separately reviewed API test blob',()=>{
  const file={filename:'deploy/uat/prototype-material-operator.mjs',status:'added'};
  const spec={filename:'apps/api/src/inventory/prototype-material-journey.integration.spec.ts',status:'modified',
    sha:'f77c9503a39a2dea6a9047599802a19097a5e026'};
  assert.equal(toolingOnly({status:'ahead',files:[file,spec]}),true);
  for(const files of [[{...spec,sha:'f'.repeat(40)}],[{...spec,status:'added'}],
    [{...file,filename:'apps/api/src/inventory/material-plan.service.ts'}],
    [{...file,filename:'apps/api/prisma/schema.prisma'}],[{...file,filename:'pnpm-lock.yaml'}],
    [{...file,status:'renamed',previous_filename:'old'}],[{...file,status:'removed'}],[]])
    assert.equal(toolingOnly({status:'ahead',files}),false);
  assert.equal(toolingOnly({status:'identical',files:[file]}),false);
});
function proof(){
  const r={status:'SYNTHETIC_BROWSER_INITIAL_READBACK_VERIFIED',sourceSha:SOURCE,
    operatorMainSha:'76295ef9ecc3ada2dca2549cf514f3fbdc6a634b',functionalActors:8,technicalAdminProbed:true,
    browserChecks:126,initialAuthenticatedBrowserVerified:true,businessStateUnchanged:true,browserSessionsRevoked:true,
    productionAuthorized:false,retainedResourcesUsed:false,humanUatCompleted:false,prototypeFrozen:false,
    fullBusinessRoleMatrixVerified:false,fullAuthenticatedBrowserJourneysVerified:false,populatedRecoveryVerified:false,secretsPrinted:false};
  const e={sourceSha:SOURCE,operatorMainSha:r.operatorMainSha,functionalActors:8,technicalAdminProbed:true,
    browserChecks:126,businessFingerprint:'a'.repeat(64),observations:Array.from({length:126},()=>({passed:true}))};
  return {r,e};
}
test('completed browser proof must match original 126-check receipt and private evidence',()=>{
  const good=proof();assert.equal(validBrowserProof(good.r,good.e),true);
  for(const mutate of [t=>t.r.sourceSha='a'.repeat(40),t=>t.r.operatorMainSha='b'.repeat(40),
    t=>t.r.businessStateUnchanged=false,t=>t.r.browserSessionsRevoked=false,t=>t.r.functionalActors=7,
    t=>t.r.productionAuthorized=true,t=>t.r.fullAuthenticatedBrowserJourneysVerified=true,
    t=>t.e.observations.pop(),t=>t.e.observations[0].passed=false,t=>delete t.e.observations[0].passed,
    t=>t.e.businessFingerprint='',t=>t.e.sourceSha='c'.repeat(40),t=>t.e.operatorMainSha='d'.repeat(40)]){
    const t=proof();mutate(t);assert.equal(validBrowserProof(t.r,t.e),false);
  }
});
