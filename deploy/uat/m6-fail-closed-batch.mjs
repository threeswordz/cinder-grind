// M6 retained source batch state machine: fixture gate, independent observations,
// then one explicit synthetic session run. No retries and no business replay.
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export const changedFixturePaths=Object.freeze([
 'deploy/uat/m6-rate-bucket-history.test.mjs',
 'deploy/uat/m6-retained-site-material.test.mjs',
 'deploy/uat/m6-retained-cd-readback.test.mjs',
 'deploy/uat/m6-retained-cd-operator.test.mjs',
]);
const sha=/^[a-f0-9]{40}$/;
export function batchStages(sourceSha){
 need(typeof sourceSha==='string'&&sha.test(sourceSha),'M6_BATCH_PIN_REQUIRED');
 return Object.freeze([
  Object.freeze({id:'CHANGED_FIXTURES',args:Object.freeze(['--test',...changedFixturePaths])}),
  Object.freeze({id:'RATE_HISTORY',args:Object.freeze(['deploy/uat/m6-native-inspect.mjs','--inspect-rate-history',sourceSha])}),
  Object.freeze({id:'SITE_HISTORY',args:Object.freeze(['deploy/uat/m6-native-inspect.mjs','--inspect-retained-site',sourceSha])}),
  Object.freeze({id:'AUTHENTICATED_CD',args:Object.freeze(['deploy/uat/m6-retained-cd-operator.mjs','--authorize-four-synthetic-sessions',sourceSha])}),
 ]);
}
export async function runM6Batch({sourceSha,authorizeSessions=false,execute}){
 need(typeof execute==='function'&&typeof authorizeSessions==='boolean','M6_BATCH_ARGUMENTS_INVALID');
 const stages=batchStages(sourceSha),results=[];
 const invoke=async stage=>{
  let pass=false;
  try{const result=await execute(stage.id,[...stage.args]);pass=result?.exitCode===0;}catch{}
  results.push({id:stage.id,status:pass?'PASS':'BLOCKED'});
  return pass;
 };
 if(!await invoke(stages[0]))return {
  status:'M6_BATCH_FIXTURE_BLOCKED',stages:results,readOnlyComplete:false,
  sessionsStarted:false,milestone6Accepted:false,productionAuthorized:false,
 };
 // These inspections do not depend on each other and are read-only. Continue
 // both once so one blocked observation does not require a second Mac session.
 const rateOk=await invoke(stages[1]),siteOk=await invoke(stages[2]);
 if(!rateOk||!siteOk)return {
  status:'M6_BATCH_READ_ONLY_BLOCKED',stages:results,readOnlyComplete:true,
  sessionsStarted:false,milestone6Accepted:false,productionAuthorized:false,
 };
 if(!authorizeSessions)return {
  status:'M6_BATCH_READ_ONLY_PASS',stages:results,readOnlyComplete:true,
  sessionsStarted:false,milestone6Accepted:false,productionAuthorized:false,
 };
 const cdOk=await invoke(stages[3]);
 return {
  status:cdOk?'M6_BATCH_AUTHENTICATED_CD_PASS':'M6_BATCH_AUTHENTICATED_CD_BLOCKED',
  stages:results,readOnlyComplete:true,sessionsStarted:true,
  milestone6Accepted:false,productionAuthorized:false,
 };
}
