import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectActor} from './hr1a-role-assurance.mjs';

const companyId='11111111-1111-4111-8111-111111111111';
const projectId='22222222-2222-4222-8222-222222222222';
const employeeId='33333333-3333-4333-8333-333333333333';
const userId='44444444-4444-4444-8444-444444444444';
const baseUrl='http://127.0.0.1:3001/api/v1';
const actor={email:'synthetic@example.invalid',password:'synthetic-only',userId,companyId};
const args={baseUrl,companyId,projectId,employeeId,actor};
const reply=(status,data,headers={})=>new Response(data===undefined?null:JSON.stringify({data}),{status,
  headers:{'content-type':'application/json',...headers}});

function fixture({mismatch=false,unexpectedPrivate=false,brokenLogout=false,extraPrivate=false,extraEmployment=false,emptyProject=false,denyEmployment=false,validPrivate=false}={}){
  const calls=[];
  const fetchImpl=async(url,options)=>{
    const path=url.slice(baseUrl.length);
    calls.push({path,method:options.method,headers:options.headers,body:options.body,redirect:options.redirect});
    if(path==='/auth/login')return reply(201,{user:{id:mismatch?employeeId:userId,companyId},csrfToken:'csrf-fixture'},
      {'set-cookie':'erp_session='+'q'.repeat(43)+'; HttpOnly'});
    if(path==='/auth/me')return reply(200,{id:userId,companyId,email:actor.email});
    if(path==='/auth/logout')return reply(brokenLogout?500:204);
    if(path.endsWith('/employment'))return denyEmployment?reply(404):reply(200,{employee:{id:employeeId,employeeCode:'E01',employeeName:'Synthetic',
      jobTitle:'Tester',isActive:true},employment:null,...(extraEmployment?{rawValues:{unknown:'private'}}:{})});
    if(path.includes('/private/'))return extraPrivate
      ? reply(200,{version:1,values:{accountNumber:'••••'},rawValues:{accountNumber:'12345'}})
      : validPrivate?reply(200,{version:1,values:path.endsWith('/identity')?{identityNumber:'••••'}:{accountNumber:'••••'}})
      : unexpectedPrivate?reply(200,{version:1,values:{accountNumber:'12345'}}):reply(404);
    if(path.startsWith('/hr/projects/'))return reply(200,emptyProject?[]:[{id:employeeId,employeeCode:'E01',employeeName:'Synthetic',jobTitle:'Tester'}]);
    return reply(404);
  };
  return {calls,fetchImpl};
}

test('authenticated HR collector calls only GET for business endpoints and cleans up the session',async()=>{
  const {calls,fetchImpl}=fixture();
  const report=await inspectActor({...args,key:'KOH',fetchImpl});
  assert.equal(report.status,'BLOCKED_CONFIGURATION');
  assert.equal(report.logoutHttpStatus,204);
  assert.deepEqual(calls.filter(x=>x.method==='POST').map(x=>x.path),['/auth/login','/auth/logout']);
  assert.equal(calls.filter(x=>x.method==='GET').length,4);
  assert.ok(calls.every(x=>x.redirect==='error'));
  assert.equal(JSON.stringify(report).includes(actor.email),false);
  assert.equal(JSON.stringify(report).includes(actor.password),false);
});

test('unexpected private access for Ben fails and never exports private values',async()=>{
  const {calls,fetchImpl}=fixture({unexpectedPrivate:true});
  const report=await inspectActor({...args,key:'BEN',fetchImpl});
  assert.equal(report.status,'FAIL');
  assert.ok(report.checks.some(x=>x.kind==='bank'&&x.status.startsWith('FAIL')));
  assert.equal(JSON.stringify(report).includes('12345'),false);
  assert.equal(calls.at(-1).path,'/auth/logout');
});
test('wrong login user is rejected before HR reads; session always gets revoked',async()=>{
  const {calls,fetchImpl}=fixture({mismatch:true});
  const report=await inspectActor({...args,key:'KOH',fetchImpl});
  assert.equal(report.status,'FAIL_TRANSPORT_OR_BINDING');
  assert.equal(calls.some(x=>x.path.startsWith('/hr/')),false);
  assert.equal(calls.at(-1).path,'/auth/logout');
});
test('logout failure is never treated as a successful check',async()=>{
  const {fetchImpl}=fixture({brokenLogout:true});
  const report=await inspectActor({...args,key:'KOH',fetchImpl});
  assert.equal(report.status,'FAIL_LOGOUT_UNVERIFIED');
});

test('rejects additional unmasked private fields even when expected values are masked',async()=>{
  const {fetchImpl}=fixture({extraPrivate:true});
  const report=await inspectActor({...args,key:'KOH',fetchImpl});
  assert.equal(report.status,'FAIL');
  assert.ok(report.checks.some(x=>x.kind==='bank'&&x.status==='FAIL_UNSAFE_PROJECTION'));
  assert.equal(JSON.stringify(report).includes('12345'),false);
});
test('rejects unexpected sensitive top-level employment projections',async()=>{
  const {fetchImpl}=fixture({extraEmployment:true});
  const report=await inspectActor({...args,key:'KOH',fetchImpl});
  assert.equal(report.status,'FAIL');
  assert.equal(report.checks.find(x=>x.kind==='employment').status,'FAIL_UNSAFE_PROJECTION');
});
test('missing physical project fixture is BLOCKED, not a vacuous PASS',async()=>{
  const {fetchImpl}=fixture({emptyProject:true,denyEmployment:true});
  const report=await inspectActor({...args,key:'FOREMAN',fetchImpl});
  assert.equal(report.status,'BLOCKED_CONFIGURATION');
  assert.equal(report.checks.find(x=>x.kind==='project').status,'BLOCKED_CONFIGURATION');
});

test('complete synthetic KOH role permits only masked private data and never exports response fields',async()=>{
  const {fetchImpl}=fixture({validPrivate:true});
  const report=await inspectActor({...args,key:'KOH',fetchImpl});
  assert.equal(report.status,'PASS');
  assert.equal(report.checks.filter(x=>x.status==='PASS').length,3);
  assert.equal(JSON.stringify(report).includes('identityNumber'),false);
  assert.equal(JSON.stringify(report).includes('accountNumber'),false);
});
test('complete synthetic Foreman role denies HR private data and checks a real Project employee fixture',async()=>{
  const {fetchImpl}=fixture({denyEmployment:true});
  const report=await inspectActor({...args,key:'FOREMAN',fetchImpl});
  assert.equal(report.status,'PASS');
  assert.equal(report.checks.find(x=>x.kind==='project').status,'PASS');
});
