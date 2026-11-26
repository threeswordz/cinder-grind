import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compareCDPreservation} from './m6-retained-cd-preservation.mjs';
import {allowedReadbackPaths,runRetainedCDMetadata} from './m6-retained-cd-http.mjs';
const ids=['a','b','c','d'];
const local=createHash('sha256').update('login:127.0.0.1').digest('hex');
function snapshots(){
 const before={clock:'100',business:{audit_logs:{count:'1',hash:'audit'},stock_transactions:{count:'2',hash:'stock'}},users:[...ids,'other'].map(id=>({id,hash:id,stable:id,login:'50',updated:'50'})),sessions:[{id:'old',hash:'old'}],buckets:[{key:local,hash:'local',reset:'999'},{key:'expired',hash:'expired',reset:'90'},{key:'unrelated',hash:'unrelated',reset:'999'}]};
 const after=structuredClone(before);after.clock='200';for(const u of after.users.filter(x=>ids.includes(x.id))){u.login='120';u.updated='120';u.hash+='new';}after.sessions.push(...ids.map(actor=>({id:'new-'+actor,actor,created:'110',revoked:'150',expires:'999'})));after.buckets=after.buckets.filter(x=>x.key==='unrelated');return {before,after};
}
test('four revoked sessions and only legitimate rate bucket removal',()=>{const {before,after}=snapshots();const r=compareCDPreservation(before,after,ids);assert.equal(r.revokedNewSessions,4);assert.equal(r.auditRowsPreserved,true);assert.equal(r.removedRateBuckets,2);});
test('audit change rejected',()=>{const {before,after}=snapshots();after.business.audit_logs.count='2';assert.throws(()=>compareCDPreservation(before,after,ids),/NONAUTH_DRIFT/);});
test('unrelated user and historical session changes rejected',()=>{const {before,after}=snapshots();after.users.at(-1).hash='changed';assert.throws(()=>compareCDPreservation(before,after,ids),/UNEXPECTED_USER_CHANGE/);after.users.at(-1).hash='other';after.sessions[0].hash='changed';assert.throws(()=>compareCDPreservation(before,after,ids),/HISTORIC_SESSION_DRIFT/);});
test('unrevoked or unexpected actor session rejected',()=>{const {before,after}=snapshots();after.sessions[1].revoked=null;assert.throws(()=>compareCDPreservation(before,after,ids),/SESSION_DELTA/);after.sessions[1].revoked='150';after.sessions[1].actor='other';assert.throws(()=>compareCDPreservation(before,after,ids),/SESSION_DELTA/);});
test('unrelated active bucket removal rejected',()=>{const {before,after}=snapshots();after.buckets=[];assert.throws(()=>compareCDPreservation(before,after,ids),/RATE_BUCKET_REMOVAL/);});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function binding(){
 const companyId=id(1),actors=Object.fromEntries(['BEN','NANCY','KOH','FOREMAN'].map((k,i)=>[k,{userId:id(i+2),companyId,email:'proto-'+k.toLowerCase()+'@example.invalid',password:'a'.repeat(64),expectedRoleCodes:['PROTO_'+k],permissions:[]}]));
 return {actors,finance:{claimId:id(10),certificationId:id(11)},hr:{companyId,employeeId:id(12),privateCategories:[{category:'identity'},{category:'bank'}]},foreignCompanyId:id(13)};
}
test('allowlist only exact scoped metadata paths',()=>{const b=binding(),p=allowedReadbackPaths(b);assert.ok(p.BEN.has('/subcontracts/physical/claims/'+b.finance.claimId));assert.ok(!p.FOREMAN.has('/subcontracts/certifications/'+b.finance.certificationId));for(const paths of Object.values(p))assert.ok([...paths].every(x=>!x.includes('/download')&&!x.includes('/reveal')&&!x.includes('/csrf')&&!x.includes('/logout')));});
test('reject invalid actor before any network',async()=>{const b=binding();b.actors.BEN.email='other@example.invalid';let calls=0;await assert.rejects(runRetainedCDMetadata(b,{fetchImpl:async()=>{calls++;throw Error('unexpected');}}),/ACTOR/);assert.equal(calls,0);});
test('wrong identity still logs out and verifies revoked cookie',async()=>{const b=binding(),calls=[],cookie='erp_session='+'x'.repeat(43),csrf='y'.repeat(43);const fetchImpl=async(url,options)=>{calls.push({url,method:options.method,redirect:options.redirect,cookie:options.headers.Cookie});if(url.endsWith('/auth/login'))return new Response(JSON.stringify({data:{user:{id:id(99),companyId:id(1)},csrfToken:csrf}}),{status:201,headers:{'content-type':'application/json','set-cookie':cookie+'; Path=/; HttpOnly'}});if(url.endsWith('/auth/logout'))return new Response(null,{status:204});return new Response(null,{status:401});};await assert.rejects(runRetainedCDMetadata(b,{fetchImpl}),/LOGIN_BINDING/);assert.equal(calls.length,3);assert.ok(calls.every(c=>c.url.startsWith('http://127.0.0.1:33071/api/v1/')&&c.redirect==='error'));assert.equal(calls[1].cookie,cookie);assert.equal(calls[2].cookie,cookie);});
