// Offline GL04 synthetic role/access evidence preflight. No ERP network or retained access.
// Caller-supplied declarations are untrusted; this cannot certify permissions or close GL04.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SHA=/^[a-f0-9]{40}$/;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const EVIDENCE=/^[A-Za-z][A-Za-z0-9._:/#-]{7,159}$/;
const TOKEN=/^ACTOR_[A-Z0-9]{2,30}$/;
const safe=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const artifact=x=>typeof x==='string'&&EVIDENCE.test(x)&&!x.includes('://')&&!/^(SYNTHETIC-ONLY-|FILL_|TEMPLATE_|EXAMPLE_)/.test(x);
const utcTime=x=>{
  if(typeof x!=='string'||!UTC.test(x))return null;
  const ms=Date.parse(x);
  return Number.isFinite(ms)&&new Date(ms).toISOString()===x.slice(0,-1)+'.000Z'?ms:null;
};

// Fixed requirement probes, not an assertion about real users or grants.
// DENY_AUTH requires an authorization/scope denial, not an arbitrary HTTP 409.
// DENY_POLICY may use a business conflict enforcing maker/checker independence.
export const SCENARIOS=Object.freeze([
 ['STORE_PR_CREATE','STORE_SITE','PROTO_A','SITE_A','procurement.pr.manage','ALLOW'],
 ['JAI_PO_CREATE','JAI','PROTO_A','SITE_A','procurement.po.create','ALLOW'],
 ['BEN_PO_APPROVE','BEN','PROTO_A','SITE_A','procurement.po.approve','ALLOW'],
 ['JAI_PO_SELF_APPROVE','JAI','PROTO_A','SITE_A','procurement.po.approve','DENY_POLICY'],
 ['STORE_GR_CREATE','STORE_SITE','PROTO_A','SITE_A','inventory.receipt.create','ALLOW'],
 ['KHAIMOOK_GR_APPROVE','KHAIMOOK','PROTO_A','SITE_A','inventory.receipt.approve','ALLOW'],
 ['STORE_COUNT_CREATE','STORE_SITE','PROTO_A','SITE_A','inventory.stock_count.create','ALLOW'],
 ['KHAIMOOK_COUNT_APPROVE','KHAIMOOK','PROTO_A','SITE_A','inventory.stock_count.approve','ALLOW'],
 ['STORE_COUNT_SELF_APPROVE','STORE_SITE','PROTO_A','SITE_A','inventory.stock_count.approve','DENY_POLICY'],
 ['FOREMAN_COUNT_DENIED','FOREMAN','PROTO_A','SITE_A','inventory.stock_count.create','DENY_AUTH'],
 ['FOREMAN_PR_DENIED','FOREMAN','PROTO_A','SITE_A','procurement.pr.manage','DENY_AUTH'],
 ['FOREMAN_DAILY_SUBMIT','FOREMAN','PROTO_A','SITE_A','site.daily_report.submit','ALLOW'],
 ['FOREMAN_WEEKLY_VIEW','FOREMAN','PROTO_A','SITE_A','site.daily_report.view','ALLOW'],
 ['STORE_REQUEST_CAPTURE','STORE_SITE','PROTO_A','SITE_A','inventory.material_request.create','ALLOW'],
 ['STORE_RECEIPT_CONFIRM','STORE_SITE','PROTO_A','SITE_A','inventory.material_request.acknowledge','ALLOW'],
 ['KOH_EMPLOYEE_VIEW','KOH','PROTO_A','NONE','hr.employment.view','ALLOW'],
 ['KOH_DOCUMENT_VIEW','KOH','PROTO_A','NONE','hr.documents.view','ALLOW'],
 ['JAI_HR_DOC_DENIED','JAI','PROTO_A','NONE','hr.documents.view','DENY_AUTH'],
 ['PORN_HR_IDENTITY_DENIED','PORN','PROTO_A','NONE','hr.identity.view','DENY_AUTH'],
 ['NANCY_CUSTOMER_BOQ_APPROVE','NANCY','PROTO_A','SITE_A','budget.customer.approve','ALLOW'],
 ['BEN_CUSTOMER_BOQ_SELF_APPROVE','BEN','PROTO_A','SITE_A','budget.customer.approve','DENY_POLICY'],
 ['STORE_OTHER_PROJECT_DENIED','STORE_SITE','PROTO_A','SITE_B','inventory.stock_count.create','DENY_AUTH'],
 ['STORE_OTHER_COMPANY_DENIED','STORE_SITE','PROTO_B','SITE_B','inventory.stock_count.create','DENY_AUTH'],
 ['SYSADMIN_COUNT_APPROVE_DENIED','SYS_ADMIN','PROTO_A','SITE_A','inventory.stock_count.approve','DENY_AUTH'],
].map(([id,actor,company,project,permission,outcome])=>Object.freeze({id,actor,company,project,permission,outcome})));

export const ACTOR_FUNCTIONS=Object.freeze(['BEN','NANCY','KHAIMOOK','JAI','STORE_SITE','FOREMAN','KOH','PORN','SYS_ADMIN']);
const independentIds=['BEN_PO_APPROVE','KHAIMOOK_GR_APPROVE','KHAIMOOK_COUNT_APPROVE','NANCY_CUSTOMER_BOQ_APPROVE'];
const successStatus=(outcome,status)=>Number.isInteger(status)&&
 (outcome==='ALLOW'?[200,201,204].includes(status):
  outcome==='DENY_AUTH'?[401,403,404].includes(status):[403,409].includes(status));
const result=(gaps,checked)=>({
 purpose:'GL04_SYNTHETIC_ROLE_MATRIX_OFFLINE_PREFLIGHT',
 status:gaps.length?'DECLARATIONS_INCOMPLETE':'DECLARED_MATRIX_CONSISTENT_INDEPENDENT_VERIFICATION_PENDING',
 checkedScenarios:checked,requiredScenarios:SCENARIOS.length,gaps,
 inputTrust:'UNVERIFIED_CALLER_SUPPLIED_EVIDENCE',networkRequests:0,retainedReads:0,
 grantsApplied:false,humanUatCompleted:false,realRoleConfigurationVerified:false,
 prototypeFreezeCertified:false,gl04GateClosed:false,productionAuthorized:false,
});

export function assessRoleMatrix(input,{now=Date.now(),expectedSha}={}){
 if(!SHA.test(expectedSha??'')||!Number.isFinite(now))throw Error('GL04_EXPECTED_SHA_OR_CLOCK_INVALID');
 const gaps=[],add=(code,id)=>gaps.push(id?{code,scenario:id}:{code});
 if(!safe(input)){add('INVALID_MATRIX_PACKET');return result(gaps,0);}
 const packetKeys=['schemaVersion','purpose','mainSha','runtimeSha','capturedAt',
  'environment','retainedReads','productionConnected','transport','realRoleGrantsModified',
  'humanUatPerformed','fixture','scenarios'];
 if(Object.keys(input).some(k=>!packetKeys.includes(k)))add('UNEXPECTED_PACKET_FIELD');
 if(input.schemaVersion!==1||input.purpose!=='GL04_SYNTHETIC_ROLE_READBACK')add('INVALID_MATRIX_IDENTITY');
 if(input.mainSha!==expectedSha||input.runtimeSha!==expectedSha)add('SOURCE_RUNTIME_SHA_MISMATCH');
 if(input.environment!=='ISOLATED_SYNTHETIC'||input.retainedReads!==false||
    input.productionConnected!==false||input.transport!=='AUTHENTICATED_HTTP'||
    input.realRoleGrantsModified!==false||input.humanUatPerformed!==false)
   add('ISOLATION_OR_UAT_BOUNDARY_UNVERIFIED');
 const captured=utcTime(input.capturedAt);
 if(captured===null||captured>now+5*60_000||captured<now-48*60*60_000)add('CAPTURE_TIME_NOT_CURRENT');
 const f=input.fixture,fixtureKeys=['positiveCompany','denialCompany','projectA','projectB','functions','fixtureEvidenceId'];
 if(!safe(f)||Object.keys(f).some(k=>!fixtureKeys.includes(k))||
    f.positiveCompany!=='PROTO_A'||f.denialCompany!=='PROTO_B'||
    f.projectA!=='SITE_A'||f.projectB!=='SITE_B'||!Array.isArray(f.functions)||
    f.functions.length!==ACTOR_FUNCTIONS.length||new Set(f.functions).size!==ACTOR_FUNCTIONS.length||
    !ACTOR_FUNCTIONS.every(k=>f.functions.includes(k))||!artifact(f.fixtureEvidenceId))
   add('SYNTHETIC_FIXTURE_SCOPE_UNVERIFIED');
 const evidence=input.scenarios;
 if(!Array.isArray(evidence)||evidence.length>SCENARIOS.length*2){
  add('SCENARIO_ARRAY_INVALID');return result(gaps,0);
 }
 const index=new Map();
 for(const row of evidence){
  if(!safe(row)||typeof row.id!=='string'||!SCENARIOS.some(s=>s.id===row.id)){
   add('UNEXPECTED_OR_INVALID_SCENARIO');continue;
  }
  if(index.has(row.id)){add('DUPLICATE_SCENARIO',row.id);continue;}
  index.set(row.id,row);
 }
 let checked=0;
 const rowKeys=['id','actor','company','project','permission','expectedOutcome','transport',
  'httpStatus','observedAt','evidenceId','requestAuditId','separation'];
 const separationKeys=['actorKey','makerKey','immutableDecisionEvidenceId'];
 for(const s of SCENARIOS){
  const row=index.get(s.id);
  if(!row){add('SCENARIO_NOT_OBSERVED',s.id);continue;}
  checked++;
  if(Object.keys(row).some(k=>!rowKeys.includes(k)))add('UNEXPECTED_SCENARIO_FIELD',s.id);
  if(row.expectedOutcome!==s.outcome||row.actor!==s.actor||row.company!==s.company||
     row.project!==s.project||row.permission!==s.permission||
     row.transport!=='AUTHENTICATED_HTTP'||!artifact(row.evidenceId)||
     !artifact(row.requestAuditId)||row.observedAt!==input.capturedAt)
   add('SCENARIO_PROVENANCE_OR_SCOPE_INVALID',s.id);
  if(!successStatus(s.outcome,row.httpStatus))add('SCENARIO_OUTCOME_INVALID',s.id);
  const sep=row.separation;
  if(safe(sep)&&Object.keys(sep).some(k=>!separationKeys.includes(k)))
   add('UNEXPECTED_SEPARATION_FIELD',s.id);
  if(s.outcome==='DENY_POLICY'&&
    (!safe(sep)||sep.actorKey!==sep.makerKey||!TOKEN.test(sep.actorKey??'')||
     !TOKEN.test(sep.makerKey??'')||!artifact(sep.immutableDecisionEvidenceId)))
    add('MAKER_CHECKER_DENIAL_NOT_TRACED',s.id);
  if(s.outcome==='ALLOW'&&independentIds.includes(s.id)&&
    (!safe(sep)||sep.actorKey===sep.makerKey||!TOKEN.test(sep.actorKey??'')||
     !TOKEN.test(sep.makerKey??'')||!artifact(sep.immutableDecisionEvidenceId)))
    add('INDEPENDENT_APPROVAL_NOT_TRACED',s.id);
 }
 return result(gaps,checked);
}
export function emptyRoleMatrixTemplate(){
 return {
  schemaVersion:1,purpose:'GL04_SYNTHETIC_ROLE_READBACK',
  mainSha:'FILL_EXACT_MAIN_SHA',runtimeSha:'FILL_EXACT_MAIN_SHA',
  capturedAt:'YYYY-MM-DDTHH:MM:SSZ',environment:'ISOLATED_SYNTHETIC',
  retainedReads:false,productionConnected:false,transport:'AUTHENTICATED_HTTP',
  realRoleGrantsModified:false,humanUatPerformed:false,
  fixture:{positiveCompany:'PROTO_A',denialCompany:'PROTO_B',projectA:'SITE_A',projectB:'SITE_B',
   functions:[...ACTOR_FUNCTIONS],fixtureEvidenceId:'FILL_PRIVATE_EVIDENCE_ID'},
  scenarios:SCENARIOS.map(({id,actor,company,project,permission,outcome})=>({
   id,actor,company,project,permission,expectedOutcome:outcome,
   transport:'AUTHENTICATED_HTTP',httpStatus:null,observedAt:'FILL_CAPTURE_TIME',
   evidenceId:'FILL_PRIVATE_EVIDENCE_ID',requestAuditId:'FILL_PRIVATE_AUDIT_ID',
   ...((outcome==='DENY_POLICY'||independentIds.includes(id))?{separation:{
    actorKey:'FILL_SYNTHETIC_ACTOR_TOKEN',makerKey:'FILL_SYNTHETIC_MAKER_TOKEN',
    immutableDecisionEvidenceId:'FILL_PRIVATE_EVIDENCE_ID'}}:{})
  })),
 };
}
async function main(args){
 if(args.length===1&&args[0]==='--template'){
  process.stdout.write(JSON.stringify(emptyRoleMatrixTemplate(),null,2)+'\n');return;
 }
 if(args.length!==3||args[0]!=='--evaluate')throw Error('USAGE');
 const data=await readFile(resolve(args[1]));
 if(data.length>128*1024)throw Error('INPUT_TOO_LARGE');
 const packet=JSON.parse(data.toString('utf8'));
 const outcome=assessRoleMatrix(packet,{expectedSha:args[2]});
 process.stdout.write(JSON.stringify(outcome,null,2)+'\n');
 if(outcome.gaps.length)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main(process.argv.slice(2)).catch(()=>{
  process.stderr.write('GL04_SYNTHETIC_READBACK_PREFLIGHT_BLOCKED\n');
  process.exitCode=2;
 });
}
