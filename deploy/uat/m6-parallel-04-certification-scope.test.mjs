import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyM604CertificationScope} from './m6-parallel-04-certification-scope.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(){
 const companyId=id(10),projectId=id(11),certificationId=id(12),cert='subcontracts.certification.view',pay='finance.payment.view';
 const actors=Object.fromEntries(['finance','certificationOnly','unassigned','foreign'].map((k,i)=>[k,{userId:id(i+1),companyId:k==='foreign'?id(20):companyId}]));
 const expected={companyId,projectId,certificationId,certificationNumber:'SC-1',currencyCode:'THB',state:'APPROVED',allocations:[{id:id(13),paymentId:id(14),paymentState:'CANCELLED',allocatedAmount:'69.40',paymentAmount:'69.40'}]};
 const path='/subcontracts/certifications/'+certificationId, reference=path+'/finance-reference';
 const responses={};for(const [k,a] of Object.entries(actors))responses[k]={'/auth/me':{status:200,data:{id:a.userId,companyId:a.companyId,permissions:k==='certificationOnly'?[cert]:[cert,pay]}}};
 responses.certificationOnly[path]={status:200,data:{id:certificationId,companyId,projectId}};responses.certificationOnly[reference]={status:403};
 responses.finance[reference]={status:200,data:{certificationId,projectId,certificationNumber:'SC-1',currencyCode:'THB',state:'APPROVED',allocations:[{id:id(13),allocatedAmount:'69.4',payment:{id:id(14),currencyCode:'THB',state:'CANCELLED',amount:'69.40'}}]}};
 for(const k of ['unassigned','foreign'])for(const p of [path,reference])responses[k][p]={status:k==='foreign'?404:403};
 return {actors,expected,responses,path,reference,get:async(k,p)=>responses[k][p]};
}
const verify=f=>verifyM604CertificationScope(f);
test('scoped positive, capability denial, assignment denial and foreign company denial with cancelled payment history',async()=>{const result=await verify(fixture());assert.equal(result.scopedDenialAssertions,5);assert.equal(result.allocationHistoryPopulated,true);assert.equal(result.liveTransportVerified,false);});
test('empty reference explicitly not populated',async()=>{const f=fixture();f.expected.allocations=[];f.responses.finance[f.reference].data.allocations=[];assert.equal((await verify(f)).allocationHistoryPopulated,false);});
test('wrong session identity rejected',async()=>{const f=fixture();f.responses.foreign['/auth/me'].data.id=f.actors.finance.userId;await assert.rejects(verify(f),/M6_04_SCOPE_IDENTITY/);});
test('denial without applicable permission is not project scope evidence',async()=>{const f=fixture();f.responses.unassigned['/auth/me'].data.permissions=[];await assert.rejects(verify(f),/M6_04_SCOPE_CAPABILITIES/);});
test('assignment bypass capability makes unassigned fixture invalid',async()=>{const f=fixture();f.responses.unassigned['/auth/me'].data.permissions.push('projects.access_all');await assert.rejects(verify(f),/M6_04_SCOPE_CAPABILITIES/);});
test('finance reference exposed to certification-only actor fails',async()=>{const f=fixture();f.responses.certificationOnly[f.reference]=f.responses.finance[f.reference];await assert.rejects(verify(f),/M6_04_SCOPE_DENIAL/);});
test('foreign company must be concealed with 404',async()=>{const f=fixture();f.responses.foreign[f.reference]={status:403};await assert.rejects(verify(f),/M6_04_SCOPE_DENIAL/);});
test('changed cancelled payment state fails exact history',async()=>{const f=fixture();f.responses.finance[f.reference].data.allocations[0].payment.state='APPROVED';await assert.rejects(verify(f),/M6_04_SCOPE_ALLOCATION_HISTORY/);});
test('precision drift in allocated amount rejected',async()=>{const f=fixture();f.responses.finance[f.reference].data.allocations[0].allocatedAmount='69.41';await assert.rejects(verify(f),/M6_04_SCOPE_ALLOCATION_HISTORY/);});
test('duplicate allocation cannot satisfy expected history',async()=>{const f=fixture();f.expected.allocations.push({...f.expected.allocations[0]});f.responses.finance[f.reference].data.allocations.push({...f.responses.finance[f.reference].data.allocations[0]});await assert.rejects(verify(f),/M6_04_SCOPE_ALLOCATION_ID/);});
