import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRetainedCDMetadata} from './m6-retained-cd-readback.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(){
 const company=id(1),actors=Object.fromEntries(['BEN','NANCY','KOH','FOREMAN'].map((k,i)=>[k,{userId:id(i+2),companyId:company}]));
 const finance={companyId:company,projectId:id(10),claimId:id(11),certificationId:id(12),documentId:id(13),revisionIds:[id(14)],submissionRevisionId:id(14),sourceDigest:'a'.repeat(64),assessedAmount:'731.25',certifiedGross:'731.25',retainedAmount:'36.56'};
 const hr={companyId:company,employeeId:id(20),attachmentEmployeeId:id(24),employmentVersions:[1],attachments:[{id:id(21),version:1}],privateCategories:[{category:'identity',ids:[id(22),id(23)],versions:[1,2]}]};
 const calls=[],replies=new Map();
 const put=(actor,path,data,status=200)=>replies.set(actor+' '+path,{status,data});
 for(const [k,a]of Object.entries(actors))put(k,'/auth/me',{id:a.userId,companyId:a.companyId});
 const physical='/subcontracts/physical/claims/'+finance.claimId,cert='/subcontracts/certifications/'+finance.certificationId;
 const base='/hr/companies/'+hr.companyId+'/employees/'+hr.employeeId,documentBase='/hr/companies/'+hr.companyId+'/employees/'+hr.attachmentEmployeeId;
 put('BEN',physical,{controlled:true,claimId:finance.claimId,revisions:[{id:id(14)}],submission:{revisionId:id(14),sourceDigest:finance.sourceDigest,evidence:[{id:finance.documentId}]},decision:{actorUserId:actors.BEN.userId,assessedAmount:'731.25'},canCapture:false,canDecide:false});
 put('NANCY',cert,{id:finance.certificationId,companyId:company,projectId:finance.projectId,claimId:finance.claimId,state:'APPROVED',certifiedGross:'731.25',retainedAmount:'36.56'});
 put('KOH',base+'/employment',{employee:{id:hr.employeeId},employment:{currentVersion:1,revisions:[{version:1}]}});
 put('KOH',documentBase+'/documents',{nextCursor:null,items:[{...hr.attachments[0],createdAt:'synthetic'}]});
 put('KOH',base+'/private/identity/history',hr.privateCategories[0].ids.map((id,i)=>({id,version:i+1,createdAt:'synthetic',actorUserId:actors.KOH.userId})));
 put('KOH',base+'/private/identity',{version:2,values:{example:'••••'}});
 for(const path of [physical,base+'/employment',documentBase+'/documents',base+'/private/identity',base+'/private/identity/history'])put('FOREMAN',path,{},403);
 return {input:{actors,finance,hr,get:async(a,p)=>{calls.push([a,p]);const r=replies.get(a+' '+p);assert.ok(r,'Unexpected fixture path');return r;}},calls,replies,physical,cert,base,documentBase};
}
test('matched retained metadata only; no downloads, csrf or business writes',async()=>{
 const f=fixture(),r=await assertRetainedCDMetadata(f.input);
 assert.equal(r.status,'M6_CD_METADATA_ASSERTIONS_PASS');assert.equal(r.protectedBytesVerified,false);assert.equal(r.sessionRevocationVerified,false);assert.equal(r.historicalBaselineVerified,false);assert.equal(r.productionAuthorized,false);
 assert.equal(f.calls.length,15);assert.ok(f.calls.every(([,p])=>!p.includes('/download')&&!p.includes('/csrf')&&!p.includes('/reveal')));
});
test('wrong actor fails before business read',async()=>{const f=fixture();f.replies.get('BEN /auth/me').data.id=id(99);await assert.rejects(assertRetainedCDMetadata(f.input),/WRONG_ACTOR/);assert.equal(f.calls.length,1);});
test('physical source digest drift denied',async()=>{const f=fixture();f.replies.get('BEN '+f.physical).data.submission.sourceDigest='b'.repeat(64);await assert.rejects(assertRetainedCDMetadata(f.input),/PHYSICAL_HISTORY/);});
test('certification amount drift denied',async()=>{const f=fixture();f.replies.get('NANCY '+f.cert).data.retainedAmount='36.57';await assert.rejects(assertRetainedCDMetadata(f.input),/CERTIFICATION_HISTORY/);});
test('empty HR coverage refused before HTTP',async()=>{const f=fixture();f.input.hr.privateCategories=[];await assert.rejects(assertRetainedCDMetadata(f.input),/PRIVATE_COVERAGE/);assert.equal(f.calls.length,0);});
test('HR unmasked response denied',async()=>{const f=fixture();f.replies.get('KOH '+f.base+'/private/identity').data.values.example='synthetic-unmasked';await assert.rejects(assertRetainedCDMetadata(f.input),/PRIVATE_MASK/);});
test('extra attachment metadata denied',async()=>{const f=fixture();f.replies.get('KOH '+f.documentBase+'/documents').data.items[0].fileName='synthetic';await assert.rejects(assertRetainedCDMetadata(f.input),/ATTACHMENT_METADATA/);});
test('Foreman unexpected access denied',async()=>{const f=fixture();f.replies.get('FOREMAN '+f.physical).status=200;await assert.rejects(assertRetainedCDMetadata(f.input),/DENIAL_FAILED/);});

test('attachment readback is bound to a distinct original HR document subject',async()=>{const f=fixture();await assertRetainedCDMetadata(f.input);assert.ok(f.calls.some(([a,p])=>a==='KOH'&&p===f.documentBase+'/documents'));assert.ok(!f.calls.some(([,p])=>p===f.base+'/documents'));});
test('conflated employment and attachment subjects fail before HTTP',async()=>{const f=fixture();f.input.hr.attachmentEmployeeId=f.input.hr.employeeId;await assert.rejects(assertRetainedCDMetadata(f.input),/HR_DISTINCT_SUBJECTS/);assert.equal(f.calls.length,0);});
