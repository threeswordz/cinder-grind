// M4 Lane C: guarded, read-only, authenticated React/MUI eight-role evidence.
// No retained account provisioning, production changes, business mutations, or DB resets.
// Execute ONLY against an independently created/disposable localhost fixture.
// An operator run is not DEC-042 human UAT or DEC-022 independent acceptance.
import assert from 'node:assert/strict';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {startBrowser,allowedRequest} from './prototype-browser.mjs';

// Historical unit-fixture default only. A real browser run must bind its approved
// source to the actual Git checkout SHA rather than this former integration parent.
export const BASE_SOURCE='680bca5767652522ef08f72d4df97b6df2732fca';
export const PERSONAS=Object.freeze({
  NANCY:{roles:['FINANCE_MANAGER'],section:'BOQ & Budget',requires:'budget.customer.view'},
  BEN:{roles:['MANAGEMENT'],section:'Purchase Orders',requires:'procurement.po.view'},
  KHAIMOOK:{roles:['PROJECT_MANAGER','STOREKEEPER'],section:'Inventory',requires:'inventory.receipt.view'},
  JAI:{roles:['PROCUREMENT_OFFICER'],section:'Purchase Orders',requires:'procurement.po.view'},
  STORE_SITE:{roles:['STOREKEEPER'],section:'Purchase Requests',requires:'procurement.pr.view'},
  FOREMAN:{roles:['PROJECT_ENGINEER'],section:'Site Execution',requires:'site.daily_report.view'},
  PORN:{roles:['FINANCE_OFFICER'],section:'Supplier Finance',requires:'finance.supplier_invoice.view'},
  KOH:{roles:['UAT_HR_STAFF'],section:'Employees & HR',requires:'hr.employment.view'},
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keys=Object.keys(PERSONAS);
const sorted=a=>[...a].sort();
const same=(a,b)=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b));
const fail=code=>{throw Object.assign(new Error(code),{safeCode:code});};
const demand=(v,code)=>{if(!v)fail(code);};

export function validateFixture(c,expectedSource=BASE_SOURCE){
  demand(c&&typeof c==='object'&&!Array.isArray(c),'INVALID_FIXTURE');
  demand(c.purpose==='M4_LANE_C_DISPOSABLE_SYNTHETIC_ONLY','DISPOSABLE_PROOF_REQUIRED');
  demand(typeof expectedSource==='string'&&/^[0-9a-f]{40}$/.test(expectedSource),
    'APPROVED_SOURCE_INVALID');
  demand(c.sourceSha===expectedSource,'INTEGRATED_BASE_SHA_MISMATCH');
  demand(c.apiBase==='http://127.0.0.1:31375/api/v1'&&
    c.webOrigin==='http://127.0.0.1:44375'&&
    c.databaseName==='erp_m4_lane_c_20261124','UNSAFE_TARGET');
  for(const id of ['companyId','projectId','sameCompanyOtherProjectId','foreignCompanyId','foreignProjectId','employeeId'])
    demand(uuid.test(c[id]??''),'INVALID_'+id.toUpperCase());
  demand(new Set([c.projectId,c.sameCompanyOtherProjectId,c.foreignProjectId]).size===3&&
    c.companyId!==c.foreignCompanyId,'SCOPE_FIXTURE_NOT_DISTINCT');
  demand(c.actors&&same(Object.keys(c.actors),keys),'EIGHT_ACTORS_REQUIRED');
  const ids=[],emails=[];
  for(const key of keys){
    const a=c.actors[key],target=PERSONAS[key];
    demand(a&&uuid.test(a.userId??'')&&typeof a.email==='string'&&
      /^[^@\s]+@[^@\s]+$/.test(a.email)&&
      typeof a.password==='string'&&a.password.length>=12,'INVALID_ACTOR_'+key);
    demand(Array.isArray(a.roleCodes)&&same(a.roleCodes,target.roles)&&
      !a.roleCodes.includes('SYS_ADMIN')&&
      new Set(a.roleCodes).size===a.roleCodes.length,'ACTOR_ROLE_UNEXPECTED_'+key);
    ids.push(a.userId);emails.push(a.email.toLowerCase());
  }
  demand(new Set(ids).size===8&&new Set(emails).size===8,'ACTOR_IDENTITY_REUSED');
  if(c.disabledActor!==undefined){
    demand(c.disabledActor&&typeof c.disabledActor.email==='string'&&
      /^[^@\s]+@[^@\s]+$/.test(c.disabledActor.email)&&
      typeof c.disabledActor.password==='string'&&c.disabledActor.password.length>=12&&
      !emails.includes(c.disabledActor.email.toLowerCase()),'INVALID_DISABLED_ACTOR');
  }
  for(const name of ['clientBoqVersionId','foreignDocumentId','otherProjectDocumentId','hrAttachmentId'])
    if(c[name]!==undefined)demand(uuid.test(c[name]),'INVALID_OPTIONAL_EVIDENCE_ID');
  return c;
}

export function readOnlyPath(pathname){
  // Request routes are composed only here, never accepted from an operator JSON.
  return /^\/(auth\/me|projects\/[0-9a-f-]{36}|hr\/companies\/[0-9a-f-]{36}\/employees(\/[0-9a-f-]{36}(\/private\/bank|\/documents\/[0-9a-f-]{36}\/download))?|documents\/projects\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/download|budget\/customer\/projects\/[0-9a-f-]{36}\/versions\/[0-9a-f-]{36}\/export)$/i.test(pathname);
}

export function plannedChecks(c,key,permissions){
  const out=[
    {name:'ASSIGNED_PROJECT',path:'/projects/'+c.projectId,status:[200]},
    {name:'WRONG_SAME_COMPANY_PROJECT',path:'/projects/'+c.sameCompanyOtherProjectId,
      status:permissions.includes('projects.access_all')?[200]:[403,404]},
    {name:'FOREIGN_COMPANY_PROJECT',path:'/projects/'+c.foreignProjectId,status:[403,404]},
    {name:'FOREIGN_COMPANY_HR',path:'/hr/companies/'+c.foreignCompanyId+'/employees',status:[403,404]},
    {name:'HR_BANK_PERMISSION',path:'/hr/companies/'+c.companyId+'/employees/'+c.employeeId+'/private/bank',
      status:permissions.includes('hr.bank.view')?[200]:[403,404]},
  ];
  if(c.clientBoqVersionId){
    const canExport=['budget.cost.full_view','budget.boq.view','budget.revision.view',
      'budget.customer.view'].every(code=>permissions.includes(code));
    out.push({name:canExport?'CLIENT_BOQ_CSV_AUTHORIZED':'CLIENT_BOQ_CSV_EXPORT_DENIED',
      path:'/budget/customer/projects/'+c.projectId+'/versions/'+c.clientBoqVersionId+'/export',
      status:canExport?[200]:[403,404]});
  }
  if(c.foreignDocumentId)
    out.push({name:'FOREIGN_DOCUMENT_BYTES_DENIED',path:'/documents/projects/'+c.foreignProjectId+
      '/'+c.foreignDocumentId+'/download',status:[403,404]});
  if(c.otherProjectDocumentId&&!permissions.includes('projects.access_all'))
    out.push({name:'UNASSIGNED_PROJECT_DOCUMENT_BYTES_DENIED',
      path:'/documents/projects/'+c.sameCompanyOtherProjectId+'/'+c.otherProjectDocumentId+'/download',
      status:[403,404]});
  if(c.hrAttachmentId&&!permissions.includes('hr.documents.view'))
    out.push({name:'HR_ATTACHMENT_BYTES_DENIED',
      path:'/hr/companies/'+c.companyId+'/employees/'+c.employeeId+
       '/documents/'+c.hrAttachmentId+'/download',status:[403,404]});
  return out;
}

export function assessResponse(check,status,body,secret){
  demand(readOnlyPath(check.path),'UNAPPROVED_API_ROUTE');
  demand(check.status.includes(status),'API_AUTH_BOUNDARY_FAILED_'+check.name);
  // Even an HTTP denial is not proof of confidential byte masking unless its
  // body is checked. Never write the body, sentinel or raw response to logs.
  if(status>=400)demand(!body.includes(secret),'SENSITIVE_BYTES_EXPOSED_'+check.name);
  return {check:check.name,status:'PASS',httpStatus:status};
}

async function privateFixture(path,expectedSource){
  demand(typeof path==='string'&&path.startsWith('/'),'ABSOLUTE_PRIVATE_FIXTURE_REQUIRED');
  const s=await lstat(path);
  demand(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&
    (s.mode&0o077)===0&&s.size>0&&s.size<65536,'UNSAFE_PRIVATE_FIXTURE');
  if(typeof process.getuid==='function')demand(s.uid===process.getuid(),'FIXTURE_OWNER_MISMATCH');
  const checked=await realpath(path);
  demand(checked===path,'SYMLINK_FIXTURE_DENIED');
  const root=await realpath(fileURLToPath(new URL('../../',import.meta.url)));
  demand(checked!==root&&!checked.startsWith(root+sep),'REPOSITORY_FIXTURE_DENIED');
  return validateFixture(JSON.parse(await readFile(checked,'utf8')),expectedSource);
}
async function evaluate(p,s,fn,arg){
  const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg??null)+')',
    awaitPromise:true,returnByValue:true},s);
  demand(!r.exceptionDetails&&r.result&&r.result.type!=='error','REAL_BROWSER_EVALUATION_FAILED');
  return r.result.value;
}
async function wait(p,s,fn,arg,label){
  for(let n=0;n<100;n++){
    try{if(await evaluate(p,s,fn,arg))return;}catch(error){
      if(error.safeCode!=='BROWSER_PROTOCOL_COMMAND_FAILED'&&
        error.safeCode!=='REAL_BROWSER_EVALUATION_FAILED')throw error;
    }
    await new Promise(r=>setTimeout(r,150));
  }
  fail('REAL_BROWSER_TIMEOUT_'+label);
}
async function observe(p,s,c,key){
  const a=c.actors[key],target=PERSONAS[key];
  await p.send('Page.navigate',{url:c.webOrigin+'/'},s);
  await wait(p,s,()=>Boolean(document.querySelector('input[type="email"]')&&
    document.querySelector('input[type="password"]')),null,'LOGIN_'+key);
  const anonymous=await evaluate(p,s,async()=>{
    return (await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'})).status;
  });
  demand(anonymous===401,'NOT_ANONYMOUS_'+key);
  await evaluate(p,s,credentials=>{
    for(const kind of ['email','password']){
      const input=document.querySelector('input[type="'+kind+'"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,credentials[kind]);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }
    document.querySelector('form').requestSubmit();
    return true;
  },{email:a.email,password:a.password});
  await wait(p,s,()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')&&
    [...document.querySelectorAll('header button')].some(b=>b.textContent==='Sign out')),
  null,'AUTH_WORKSPACE_'+key);
  const me=await evaluate(p,s,async()=>{
    const r=await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'});
    return r.status===200?(await r.json()).data:null;
  });
  demand(me?.id===a.userId&&me.companyId===c.companyId&&
    Array.isArray(me.roleCodes)&&same(me.roleCodes,a.roleCodes)&&
    Array.isArray(me.permissions)&&
    !me.roleCodes.includes('SYS_ADMIN'),'REAL_IDENTITY_OR_ROLE_MISMATCH_'+key);
  demand(me.permissions.includes(target.requires),'MISSING_EXPECTED_MODULE_PERMISSION_'+key);
  const adminMenu=await evaluate(p,s,()=>{
    const nav=document.querySelector('nav[aria-label="Main navigation"]');
    return [...(nav?.querySelectorAll('button,[role="button"]')??[])].some(b=>
      ['Roles & Permissions','Users','System Settings'].includes(b.textContent?.trim()));
  });
  demand(!adminMenu,'UNAUTHORIZED_ADMIN_NAVIGATION_VISIBLE_'+key);
  if(['STORE_SITE','FOREMAN','PORN','KOH'].includes(key))
    demand(!me.permissions.includes('projects.access_all'),'UNAPPROVED_WIDE_PROJECT_SCOPE_'+key);
  // Actual navigation + rendered React/MUI page, not an isolated mocked component.
  const selected=await evaluate(p,s,label=>{
    const nav=document.querySelector('nav[aria-label="Main navigation"]');
    const buttons=[...nav.querySelectorAll('button,[role="button"]')];
    const button=buttons.find(b=>b.textContent?.trim()===label);
    if(!button)return false;
    button.click();return true;
  },target.section);
  demand(selected,'REQUIRED_NAV_SECTION_NOT_VISIBLE_'+key);
  await wait(p,s,()=>Boolean(document.querySelector('main')),null,'REACT_MAIN_'+key);
  const summary=[{check:'AUTHENTICATED_REACT_MUI_'+target.section,status:'PASS'}];
  const secret='LANEC_SYNTHETIC_SECRET';
  for(const check of plannedChecks(c,key,me.permissions)){
    const result=await evaluate(p,s,async pathname=>{
      const r=await fetch('/api/v1'+pathname,{credentials:'include',redirect:'error'});
      const b=await r.arrayBuffer();
      if(b.byteLength>1048576)return {status:r.status,oversized:true,body:''};
      return {status:r.status,oversized:false,body:new TextDecoder('utf-8',{ignoreBOM:true}).decode(b)};
    },check.path);
    demand(!result.oversized,'UNBOUNDED_RESPONSE_'+check.name);
    summary.push(assessResponse(check,result.status,result.body,secret));
    if(check.name==='CLIENT_BOQ_CSV_AUTHORIZED')
      demand(result.body.startsWith('\uFEFF')&&result.body.includes('Amount')&&
        result.body.includes('Rate'),'CLIENT_BOQ_POSITIVE_CONTROL_EMPTY');
  }
  const loggedOut=await evaluate(p,s,()=>{
    const button=[...document.querySelectorAll('header button')]
      .find(x=>x.textContent==='Sign out');
    if(!button)return false;button.click();return true;
  });
  demand(loggedOut,'LOGOUT_UI_MISSING_'+key);
  await wait(p,s,()=>Boolean(document.querySelector('input[type="password"]')),null,'LOGOUT_'+key);
  const revoked=await evaluate(p,s,async()=>
    (await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'})).status===401);
  demand(revoked,'SESSION_NOT_REVOKED_'+key);
  summary.push({check:'REAL_UI_LOGOUT_SESSION_REVOKED',status:'PASS'});
  return summary;
}
async function disabledLogin(p,c){
  const context=(await p.send('Target.createBrowserContext')).browserContextId;
  let session=null;
  try{
    const target=(await p.send('Target.createTarget',{url:'about:blank',browserContextId:context})).targetId;
    session=(await p.send('Target.attachToTarget',{targetId:target,flatten:true})).sessionId;
    await p.send('Page.enable',{},session);await p.send('Runtime.enable',{},session);
    await p.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},session);
    await p.send('Page.navigate',{url:c.webOrigin+'/'},session);
    await wait(p,session,()=>Boolean(document.querySelector('input[type="email"]')&&
      document.querySelector('input[type="password"]')),null,'DISABLED_LOGIN_FORM');
    await evaluate(p,session,credentials=>{
      for(const kind of ['email','password']){
        const input=document.querySelector('input[type="'+kind+'"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')
          .set.call(input,credentials[kind]);
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      }
      document.querySelector('form').requestSubmit();return true;
    },c.disabledActor);
    // Negative login is deliberately not interpreted from a transient 401.
    // Wait for UI's failed-login response before asserting no session.
    await wait(p,session,()=>Boolean(document.querySelector('input[type="password"]')&&
      document.querySelector('[role="alert"]')),null,'DISABLED_LOGIN_DENIAL');
    const status=await evaluate(p,session,async()=>
      (await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'})).status);
    demand(status===401,'DISABLED_ACTOR_AUTHENTICATED');
    return {check:'DISABLED_ACTOR_LOGIN_DENIED',status:'PASS'};
  }finally{if(context)await p.send('Target.disposeBrowserContext',{browserContextId:context});}
}
export async function execute(c,bin){
  const temp=await mkdtemp(resolve(tmpdir(),'erp-m4-lanec-browser-'));
  let browser;const records=[];let stage='START_BROWSER';
  try{
    browser=await startBrowser(bin,temp);
    const p=browser.protocol,violations=[];
    const intercept=event=>{
      if(event.method!=='Fetch.requestPaused')return;
      const request=event.params?.request??{},requestId=event.params?.requestId;
      const ok=allowedRequest(request.url,request.method,c.webOrigin+'/api/v1',c.webOrigin);
      if(!ok)violations.push('OUTBOUND_OR_BUSINESS_WRITE_DENIED');
      p.send(ok?'Fetch.continueRequest':'Fetch.failRequest',
        ok?{requestId}:{requestId,errorReason:'BlockedByClient'},event.sessionId)
        .catch(()=>violations.push('FETCH_INTERCEPTION_FAILED'));
    };
    p.listeners.add(intercept);
    try{
      for(const key of keys){
        stage=key;let context=null,s=null,primary=null;
        try{
          context=(await p.send('Target.createBrowserContext')).browserContextId;
          const target=(await p.send('Target.createTarget',{url:'about:blank',browserContextId:context})).targetId;
          s=(await p.send('Target.attachToTarget',{targetId:target,flatten:true})).sessionId;
          await p.send('Page.enable',{},s);
          await p.send('Runtime.enable',{},s);
          await p.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},s);
          const checks=await observe(p,s,c,key);
          records.push({persona:key,checks});
          demand(violations.length===0,'BROWSER_OUTBOUND_POLICY_FAILED');
        }catch(error){primary=error;throw error;}
        finally{
          if(s){
            // Best-effort logout of any partially authenticated browser session.
            const clean=await evaluate(p,s,async()=>{
              const me=await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'});
              if(me.status===401)return true;
              if(me.status!==200)return false;
              const csrf=await fetch('/api/v1/auth/csrf',{credentials:'include',redirect:'error'});
              if(csrf.status!==200)return false;
              const token=(await csrf.json())?.data?.csrfToken;
              if(!token)return false;
              const r=await fetch('/api/v1/auth/logout',{method:'POST',credentials:'include',
                redirect:'error',headers:{'X-CSRF-Token':token}});
              return r.status===204;
            }).catch(()=>false);
            if(!clean&&!primary)fail('SESSION_CLEANUP_FAILED_'+key);
          }
          if(context)await p.send('Target.disposeBrowserContext',{browserContextId:context})
            .catch(()=>{if(!primary)fail('BROWSER_CONTEXT_CLEANUP_FAILED_'+key);});
        }
      }
      if(c.disabledActor){
        stage='DISABLED_ACTOR';
        records.push({persona:'DISABLED_SYNTHETIC_ACTOR',
          checks:[await disabledLogin(p,c)]});
        demand(violations.length===0,'DISABLED_ACTOR_BROWSER_OUTBOUND_POLICY_FAILED');
      }
    }finally{p.listeners.delete(intercept);}
    // Optional persisted synthetic target artifacts are mandatory for full
    // export/bytes coverage. A missing one must never be reported as PASS.
    const missing=['clientBoqVersionId','foreignDocumentId','otherProjectDocumentId','hrAttachmentId',
      'disabledActor'].filter(k=>!c[k]);
    return {status:missing.length?'PARTIAL_BLOCKED_FIXTURE':'DISPOSABLE_BROWSER_BOUNDARIES_PASS',
      sourceSha:c.sourceSha,personas:records,browser:'REAL_CHROMIUM_REACT_MUI',
      missingSyntheticArtifacts:missing,retainedRoleAcceptance:false,humanAcceptance:false,
      independentReview:false,productionAuthorized:false,businessWrites:false,
      technicalAdminUsed:false,activeRoleGrantsChanged:false,stage:'COMPLETE'};
  }catch(error){
    return {status:'FAILED',stage,safeCode:error?.safeCode??'UNCLASSIFIED_BROWSER_FAILURE',
      sourceSha:c.sourceSha,retainedRoleAcceptance:false,personas:records};
  }finally{if(browser)await browser.stop();await rm(temp,{recursive:true,force:true});}
}
async function main(){
  demand(process.argv.length===4&&process.argv[2]==='--disposable-readback',
    'USAGE_DISPOSABLE_READBACK_ONLY');
  demand(process.env.GITHUB_ACTIONS==='true'&&process.platform==='linux'&&
    process.env.M4_LANE_C_DISPOSABLE_VERIFIED==='YES','CI_DISPOSABLE_AUTHORIZATION_REQUIRED');
  const sourceRoot=await realpath(fileURLToPath(new URL('../../',import.meta.url)));
  const git=spawnSync('git',['rev-parse','HEAD'],{
    cwd:sourceRoot,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000});
  const exactSource=git.status===0?git.stdout?.trim():null;
  demand(typeof exactSource==='string'&&/^[0-9a-f]{40}$/.test(exactSource),
    'EXACT_GIT_SOURCE_REQUIRED');
  demand(process.env.M4_LANE_C_APPROVED_SOURCE_SHA===exactSource,
    'APPROVED_SOURCE_SHA_MISMATCH');
  const dirty=spawnSync('git',['status','--porcelain','--untracked-files=no'],{
    cwd:sourceRoot,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000});
  demand(dirty.status===0&&dirty.stdout?.trim()==='','SOURCE_TREE_DIRTY');
  const c=await privateFixture(process.argv[3],exactSource);
  const bin=['google-chrome','chromium','chromium-browser']
    .find(name=>spawnSync(name,['--version'],{stdio:'ignore'}).status===0);
  demand(bin,'ACTUAL_CHROMIUM_REQUIRED');
  const report=await execute(c,bin);
  console.log(JSON.stringify(report)); // No passwords, tokens, IDs or response bytes.
  if(report.status!=='DISPOSABLE_BROWSER_BOUNDARIES_PASS')process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
  main().catch(error=>{
    console.error('M4_LANE_C_BLOCKED_'+(error?.safeCode??'SAFE_RUNNER_FAILED'));
    process.exitCode=1;
  });
