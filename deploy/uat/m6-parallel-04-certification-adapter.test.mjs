import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {bindM604Certification,runM604CertificationReadback} from './m6-parallel-04-certification-adapter.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const keys=['finance','certificationOnly','unassigned','foreign'];
const certView='subcontracts.certification.view',payView='finance.payment.view';
function fixture(){
 const input={companyId:id(10),projectId:id(11),claimId:id(12),certificationId:id(13),actorIds:Object.fromEntries(keys.map((k,i)=>[k,id(i+1)]))};
 const c={id:input.certificationId,companyId:input.companyId,projectId:input.projectId,claimId:input.claimId,agreementId:id(14),assessmentId:id(15),state:'APPROVED',currencyCode:'THB',certificationNumber:'SCT1'};
 const scope={companyId:c.companyId,projectId:c.projectId,agreementId:c.agreementId};
 Object.assign(c,{claim:{id:c.claimId,...scope},assessment:{id:c.assessmentId,claimId:c.claimId,...scope},agreement:{id:c.agreementId,...scope,subcontractorId:id(16)}});
 const users=keys.map((k,i)=>{const companyId=k==='foreign'?id(20):c.companyId,employeeId=id(30+i);return {id:id(i+1),isActive:true,companyId,company:{isActive:true},employeeId,employee:{id:employeeId,companyId,isActive:true},userRoles:[{companyId,role:{companyId,isActive:true,rolePermissions:(k==='certificationOnly'?[certView]:[certView,payView]).map(permissionCode=>({permission:{permissionCode}}))}}]};});
 const payment={id:id(41),companyId:c.companyId,projectId:c.projectId,subcontractorId:c.agreement.subcontractorId,paymentDirection:'OUTBOUND',currencyCode:'THB',state:'CANCELLED',amount:100};
 const allocations=[{id:id(40),paymentId:payment.id,payment,allocatedAmount:100}];
 const identity={db:'m6_successor_rehearsal',role:'proto_runtime',ro:'on',isolation:'repeatable read'},sessions={unrevoked:0n,active:0n,expired:0n};
 const assigned=new Set(users.slice(0,2).map(u=>u.employeeId));
 const db={$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'RepeatableRead');return fn({$executeRawUnsafe:async sql=>assert.equal(sql,'SET TRANSACTION READ ONLY'),$queryRawUnsafe:async sql=>sql.includes('current_database')?[identity]:[sessions],subcontractCertification:{findUnique:async()=>c},user:{findUnique:async({where})=>users.find(u=>u.id===where.id)},projectMember:{count:async({where})=>Number(assigned.has(where.employeeId))},subcontractPaymentAllocation:{findMany:async()=>allocations}});}};
 return {input,db,c,users,allocations,identity,sessions,assigned};
}
const bind=f=>bindM604Certification(f.db,f.input);
test('binds real scope fields and exact expected cancelled allocation from independent DB adapter',async()=>{const f=fixture(),b=await bind(f);assert.equal(b.expected.allocations[0].allocatedAmount,'100.00');assert.equal(b.expected.allocations[0].paymentState,'CANCELLED');assert.equal(b.actors.foreign.companyId,id(20));});
test('refuses retained database identity before any session',async()=>{const f=fixture();f.identity.db='proto_a_01';await assert.rejects(bind(f),/M6_04_ADAPTER_DB/);});
test('refuses live sessions during binding',async()=>{const f=fixture();f.sessions.active=1n;f.sessions.unrevoked=1n;await assert.rejects(bind(f),/M6_NATIVE_ACTIVE_SESSIONS/);});
test('refuses inactive employee or unassigned positive actor',async()=>{const f=fixture();f.users[0].employee.isActive=false;await assert.rejects(bind(f),/M6_04_ADAPTER_ACTOR/);const g=fixture();g.assigned.delete(g.users[0].employeeId);await assert.rejects(bind(g),/M6_04_ADAPTER_ASSIGNMENT/);});
test('refuses foreign payment and cross-project assessment',async()=>{const f=fixture();f.allocations[0].payment.projectId=id(99);await assert.rejects(bind(f),/M6_04_ADAPTER_PAYMENT_SCOPE/);const g=fixture();g.c.assessment.projectId=id(99);await assert.rejects(bind(g),/M6_04_ADAPTER_SOURCE/);});
async function transportFixture(t,mutate){
 const f=fixture(),binding=await bind(f),cookies=Object.fromEntries(keys.map((k,i)=>[k,'erp_session='+String(i+1).repeat(32)]));
 const base='/api/v1/subcontracts/certifications/'+f.c.id,requests=[];
 const server=createServer((req,res)=>{
   const k=keys.find(k=>cookies[k]===req.headers.cookie);requests.push([k,req.method,req.url]);
   let status=200,data;
   if(req.url==='/api/v1/auth/me'){const u=f.users[keys.indexOf(k)];data={id:u.id,companyId:u.companyId,permissions:k==='certificationOnly'?[certView]:[certView,payView]};}
   else if(k==='unassigned'||k==='foreign'){status=k==='foreign'?404:403;}
   else if(k==='certificationOnly'&&req.url===base+'/finance-reference')status=403;
   else if(req.url===base)data={id:f.c.id,companyId:f.c.companyId,projectId:f.c.projectId};
   else if(req.url===base+'/finance-reference')data={certificationId:f.c.id,certificationNumber:f.c.certificationNumber,projectId:f.c.projectId,currencyCode:'THB',state:'APPROVED',allocations:[{id:id(40),allocatedAmount:'100',payment:{id:id(41),currencyCode:'THB',state:'CANCELLED',amount:'100'}}]};
   const result=mutate?.({k,req,status,data})??{status,data};res.statusCode=result.status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:result.data}));
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
 return {binding,options:{origin:'http://127.0.0.1:'+server.address().port,cookies},requests};
}
test('actual local HTTP transport passes scoped readback with GET-only requests',async t=>{const f=await transportFixture(t);const r=await runM604CertificationReadback(f.binding,f.options);assert.equal(r.scopedDenialAssertions,5);assert.equal(r.transport,'PINNED_LOOPBACK_GET_ONLY');assert.equal(r.sessionRevocationVerified,false);assert.equal(f.requests.length,11);assert.ok(f.requests.every(r=>r[1]==='GET'));});
test('actual unexpected successful denial fails closed',async t=>{const f=await transportFixture(t,x=>x.k==='foreign'&&x.req.url.includes('certifications')?{status:200,data:{private:'not authorized'}}:x);await assert.rejects(runM604CertificationReadback(f.binding,f.options),/M6_04_SCOPE_DENIAL/);});
test('invalid origin or shared cookie blocked before request',async()=>{const b=await bind(fixture());const cookies=Object.fromEntries(keys.map(k=>[k,'erp_session='+'x'.repeat(32)]));const fetchImpl=()=>{throw Error('unexpected request');};await assert.rejects(runM604CertificationReadback(b,{origin:'http://example.invalid:12345',cookies,fetchImpl}),/M6_04_ADAPTER_ORIGIN/);await assert.rejects(runM604CertificationReadback(b,{origin:'http://127.0.0.1:12345',cookies,fetchImpl}),/M6_04_ADAPTER_COOKIES/);});
