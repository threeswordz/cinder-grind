// HR1-A retained-role read-only assurance. No business/configuration mutations.
// Login/logout are the ONLY POST routes; no private reveal or document download.
import assert from 'node:assert/strict';
import { mkdir, lstat, realpath, open, readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha = /^[0-9a-f]{40}$/i;
export const functions = Object.freeze(['KOH','NANCY','BEN','PORN','KHAIMOOK','STORE_SITE','FOREMAN','JAI','SYS_ADMIN']);
const expected = Object.freeze({
  KOH: { employment: true, identity: true, bank: true, project: null },
  NANCY: { employment: true, identity: true, bank: true, project: null },
  BEN: { employment: true, identity: false, bank: false, project: null },
  PORN: { employment: null, identity: false, bank: true, project: null },
  KHAIMOOK: { employment: false, identity: false, bank: false, project: true },
  STORE_SITE: { employment: false, identity: false, bank: false, project: true },
  FOREMAN: { employment: false, identity: false, bank: false, project: true },
  JAI: { employment: false, identity: false, bank: false, project: null },
  SYS_ADMIN: { employment: false, identity: false, bank: false, project: null },
});
const fail = (code) => { throw new Error(code); };
const plain = (value) => value && typeof value === 'object' && !Array.isArray(value);
const banned = /^(?:salary|salaryAmount|wage|wages|bankAccount|bankDetails|identityNumber|passportNumber|accountNumber|identity|bank|ciphertext|reason|passwordHash|nationalId|dateOfBirth|contactPhone|contactEmail|address|emergencyContact)$/i;
const allowedEmployee = new Set(['id','employeeCode','employeeName','jobTitle','isActive']);
const allowedOperational = new Set(['id','employeeCode','employeeName','jobTitle']);

export function validateTarget({baseUrl,companyId,projectId,employeeId,expectedBuildSha}) {
  let url; try { url = new URL(baseUrl); } catch { fail('UNSAFE_TARGET'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
      !url.port || url.pathname !== '/api/v1' || url.search || url.hash ||
      url.username || url.password || url.href !== baseUrl) fail('UNSAFE_TARGET');
  if (![companyId,projectId,employeeId].every(x => typeof x === 'string' && uuid.test(x))) fail('INVALID_FIXTURE_ID');
  if (typeof expectedBuildSha !== 'string' || !sha.test(expectedBuildSha)) fail('EXPECTED_BUILD_SHA_REQUIRED');
}

export function validateActors(actors) {
  if (!plain(actors) || Object.keys(actors).some(x => !functions.includes(x))) fail('INVALID_ACTOR_MAP');
  for (const [key,actor] of Object.entries(actors)) {
    if (!plain(actor) || Object.keys(actor).some(x => !['email','password','userId','companyId'].includes(x)) ||
        !uuid.test(actor.userId ?? '') || !uuid.test(actor.companyId ?? '') ||
        typeof actor.email !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(actor.email) ||
        typeof actor.password !== 'string' || !actor.password) fail('INVALID_ACTOR_BINDING_' + key);
  }
}

function safeKeys(value, allowed) {
  return plain(value) && Object.keys(value).every(k => allowed.has(k) && !banned.test(k));
}
function noSecretKeys(value) {
  if (Array.isArray(value)) return value.every(noSecretKeys);
  return !plain(value) || Object.entries(value).every(([k,v]) => !banned.test(k) && noSecretKeys(v));
}
function validateData(kind, data, companyId, employeeId) {
  if (kind === 'employment') {
    if (!plain(data) || !safeKeys(data.employee,allowedEmployee) || data.employee.id !== employeeId ||
        !(data.employment === null || (plain(data.employment) &&
          Object.keys(data.employment).every(k=>['id','currentVersion','revisions'].includes(k)) &&
          Array.isArray(data.employment.revisions) &&
          data.employment.revisions.every(x => plain(x) &&
            Object.keys(x).every(k=>['id','version','payBasis','employmentForm','siteKind','startDate','endDate','projectId','createdAt'].includes(k))))))
      fail('UNSAFE_EMPLOYMENT_PROJECTION');
  } else if (kind === 'project') {
    if (!Array.isArray(data) || data.length > 100 || !data.every(x=>safeKeys(x,allowedOperational))) fail('UNSAFE_PROJECT_PROJECTION');
  } else if (kind === 'identity' || kind === 'bank') {
    if (!plain(data) || !Number.isInteger(data.version) || data.version < 0 || !plain(data.values) ||
        !Object.values(data.values).every(x=>x === '••••')) fail('PRIVATE_VALUE_EXPOSED');
  }
  // Never write data, names, masked values or identity markers to the report.
}
function classify(expectAllow, status) {
  if (expectAllow === null) return 'NOT_APPLICABLE';
  if (expectAllow && status === 200) return 'PASS';
  if (expectAllow && (status === 403 || status === 404)) return 'BLOCKED_CONFIGURATION';
  if (!expectAllow && (status === 403 || status === 404)) return 'PASS';
  if (!expectAllow && status === 200) return 'FAIL_UNAUTHORIZED_READ';
  return 'FAIL_UNEXPECTED_HTTP';
}

async function responseJson(response) {
  const length = Number(response.headers.get('content-length') || '0');
  if (length > 1048576) fail('UNBOUNDED_RESPONSE');
  const media = (response.headers.get('content-type') || '').split(';',1)[0].trim().toLowerCase();
  if (media !== 'application/json' && media !== 'application/problem+json') fail('UNEXPECTED_MEDIA');
  const body = await response.text();
  if (body.length > 1048576) fail('UNBOUNDED_RESPONSE');
  try { return JSON.parse(body); } catch { fail('INVALID_JSON'); }
}
function onlyStatus(response) {
  return response.status === 403 || response.status === 404 || response.status === 401;
}
export async function inspectActor({baseUrl,companyId,projectId,employeeId,key,actor,fetchImpl=fetch}) {
  const result={function:key,status:'BLOCKED',checks:[],logoutHttpStatus:null};
  let cookie,csrf;
  const request=async(path,method='GET',body) => {
    const headers={Accept:'application/json'};
    if(cookie)headers.Cookie=cookie;
    if(csrf && method!=='GET')headers['x-csrf-token']=csrf;
    if(body!==undefined)headers['Content-Type']='application/json';
    return fetchImpl(baseUrl+path,{method,headers,redirect:'error',signal:AbortSignal.timeout(15000),
      ...(body!==undefined?{body:JSON.stringify(body)}:{})});
  };
  try {
    const login=await request('/auth/login','POST',{email:actor.email,password:actor.password});
    if(login.status!==201){result.status='BLOCKED_LOGIN';return result;}
    const raw=login.headers.get('set-cookie')?.split(';',1)[0];
    if(!/^erp_session=[A-Za-z0-9_-]{20,}$/.test(raw??''))fail('INVALID_SESSION_COOKIE');
    cookie=raw;
    const loginPayload=await responseJson(login);
    csrf=loginPayload?.data?.csrfToken;
    if(typeof csrf!=='string'||!csrf)fail('INVALID_CSRF');
    if(loginPayload?.data?.user?.id!==actor.userId || loginPayload?.data?.user?.companyId!==actor.companyId) fail('WRONG_LOGIN_IDENTITY');
    const me=await request('/auth/me');
    if(me.status!==200)fail('IDENTITY_UNVERIFIED');
    const identity=(await responseJson(me))?.data;
    if(identity?.id!==actor.userId || identity?.companyId!==actor.companyId ||
       identity?.email?.toLowerCase()!==actor.email.toLowerCase())fail('IDENTITY_MISMATCH');
    const routes={
      employment:'/hr/companies/'+companyId+'/employees/'+employeeId+'/employment',
      identity:'/hr/companies/'+companyId+'/employees/'+employeeId+'/private/identity',
      bank:'/hr/companies/'+companyId+'/employees/'+employeeId+'/private/bank',
      project:'/hr/projects/'+projectId+'/employees',
    };
    for(const [kind,allow] of Object.entries(expected[key])){
      if(allow===null) continue;
      const response=await request(routes[kind]);
      let state=classify(allow,response.status);
      if(response.status===200){
        const data=(await responseJson(response))?.data;
        try{validateData(kind,data,companyId,employeeId);}catch{state='FAIL_UNSAFE_PROJECTION';}
      }else if(!onlyStatus(response))state='FAIL_UNEXPECTED_HTTP';
      result.checks.push({kind,status:state,httpStatus:response.status});
    }
    result.status=result.checks.some(x=>x.status.startsWith('FAIL'))?'FAIL':
      result.checks.some(x=>x.status.startsWith('BLOCKED'))?'BLOCKED_CONFIGURATION':'PASS';
  } catch {
    result.status='FAIL_TRANSPORT_OR_BINDING';
  } finally {
    if(cookie){
      try { result.logoutHttpStatus=(await request('/auth/logout','POST')).status; }
      catch { result.logoutHttpStatus='FAILED'; }
      if(result.logoutHttpStatus!==204)result.status='FAIL_LOGOUT_UNVERIFIED';
    }
  }
  return result;
}
export async function auditRoles({baseUrl,companyId,projectId,employeeId,expectedBuildSha,actors,fetchImpl=fetch}) {
  validateTarget({baseUrl,companyId,projectId,employeeId,expectedBuildSha});
  validateActors(actors);
  const observations=[];
  for(const key of functions){
    if(!actors[key]) {observations.push({function:key,status:'BLOCKED_ALIAS_NOT_SUPPLIED',checks:[]});continue;}
    observations.push(await inspectActor({baseUrl,companyId,projectId,employeeId,key,actor:actors[key],fetchImpl}));
  }
  const anyFail=observations.some(x=>x.status.startsWith('FAIL'));
  const anyBlocked=observations.some(x=>x.status.startsWith('BLOCKED'));
  return {schema:'construction-erp-hr1a-role-assurance-v1',
    status:anyFail?'FAIL':anyBlocked?'BLOCKED':'READ_ONLY_CHECKS_PASSED_ATTESTATION_PENDING',
    declaredBuildSha:expectedBuildSha.toLowerCase(),
    runtimeIdentity:'NOT_ATTESTED_BY_API',databaseIdentity:'NOT_ATTESTED_BY_API',
    snapshotAtomic:false,actualRoleConfiguration:'OBSERVED_READ_ONLY',
    actorCount:observations.length,observations,
    businessWrites:false,configurationWrites:false,privateReveals:false,
    authenticationSessionWrites:true,humanAcceptance:false,productionAuthorized:false,
    limitations:['Runtime/build/database identity cannot be attested by the existing health/auth API; independent binding is required before using this as release evidence.',
      'Only the supplied named fixture employee and project are checked, not complete employee coverage.',
      'Tests use existing credentials only, never create or grant roles. Missing or denied expected reads are not treated as accepted configuration.',
      'Sequential HTTP responses are not an atomic authorization snapshot.']};
}
async function privateInput(path) {
  if(typeof path!=='string'||!path)fail('PRIVATE_INPUT_REQUIRED');
  const stat=await lstat(path);
  if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)fail('PRIVATE_FILE_MODE_REQUIRED');
  const source=JSON.parse(await readFile(path,'utf8'));
  if(!plain(source))fail('PRIVATE_INPUT_INVALID');
  return source;
}
export async function saveReport(report,directory) {
  if(typeof directory!=='string'||!directory)fail('PRIVATE_OUTPUT_REQUIRED');
  const repo=await realpath(fileURLToPath(new URL('../../',import.meta.url)));
  const requested=resolve(directory);
  if(requested===repo||requested.startsWith(repo+sep))fail('PUBLIC_OUTPUT_DENIED');
  await mkdir(requested,{recursive:true,mode:0o700});
  const info=await lstat(requested);
  if(!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)!==0)fail('PRIVATE_DIRECTORY_REQUIRED');
  const actual=await realpath(requested);
  if(actual===repo||actual.startsWith(repo+sep))fail('PUBLIC_OUTPUT_DENIED');
  const dest=resolve(actual,'hr1a-roles-'+randomUUID()+'.json');
  const handle=await open(dest,'wx',0o600);
  try {await handle.writeFile(JSON.stringify(report,null,2)+'\n');}finally{await handle.close();}
  return dest;
}
async function main() {
  if(process.argv.length!==3||!['--plan','--capture'].includes(process.argv[2]))fail('USAGE_PLAN_OR_CAPTURE');
  if(process.argv[2]==='--plan') {
    console.log(JSON.stringify({schema:'construction-erp-hr1a-role-assurance-v1',functions,readOnlyBusiness:true,
      checks:['employment','identity-masked','bank-masked','project-operational'],
      runtimeAttestation:'REQUIRED_SEPARATELY',humanAcceptance:false,productionAuthorized:false}));
    return;
  }
  const config=await privateInput(process.env.HR1A_ROLE_INPUT);
  const report=await auditRoles(config);
  report.collectorSha256=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
  const destination=await saveReport(report,process.env.HR1A_ROLE_OUTPUT_DIR);
  console.log(JSON.stringify({status:report.status,evidencePath:destination,
    noBusinessWrites:true,noConfigurationWrites:true,humanAcceptance:false,productionAuthorized:false}));
  if(report.status==='FAIL')process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
  main().catch(()=>{console.error('HR1A_READONLY_ASSURANCE_INCOMPLETE — no business/configuration mutation issued');process.exitCode=1;});
