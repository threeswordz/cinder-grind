import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyM7Restored} from './m7-restored-verification.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hash=s=>createHash('sha256').update(s).digest('hex');
function setup(mode='correct',fault=''){
 const company=id(1),project=id(2),employee=id(3),foreignCompany=id(4),foreignProject=id(5),unassignedProject=id(6),otherEmployee=id(7);
 const ordinary={id:id(8),size:3,sha256:hash('one')},signed={id:id(9),agreementId:id(10),size:3,sha256:hash('two')},hr={id:id(11),documentId:id(12),size:5,sha256:hash('three'),history:[{id:id(11),version:1,createdAt:'2026-01-01T00:00:00Z'}]};
 const preservation=Object.fromEntries(['businessRows','historicalAuditRows','documentInventory','keyInventory','sourceInventory','grants'].map(k=>[k,hash(k)]));
 const fixture={company,project,employee,foreignCompany,foreignProject,unassignedProject,otherEmployee,ordinary,signed,hr,preservation};
 const actors={};for(const [i,[k,permissions]] of Object.entries({reader:['documents.document.view'],signedReader:['documents.document.view','subcontracts.agreement.view'],hrReader:['hr.documents.view'],restricted:['documents.document.view']}).entries())actors[k]={id:id(20+i),companyId:company,email:k+'@example.invalid',password:'synthetic',roles:['PROTO_'+k],permissions};
 const target={api:'http://127.0.0.1:39123/api/v1',appSha:'a'.repeat(40),manifestSha:hash('manifest'),keyMode:mode};const active=new Map();let requests=0,reads=0;
 const j=(data,status=200,headers={})=>new Response(JSON.stringify({data}),{status,headers:{'Content-Type':'application/json',...headers}});
 const fetchImpl=async(url,o)=>{requests++;const p=url.slice(target.api.length),cookie=o.headers.Cookie,a=active.get(cookie);
 if(p==='/auth/login'){const key=JSON.parse(o.body).email.split('@')[0],actor=actors[key],c='erp_session='+actor.id.replaceAll('-','');active.set(c,actor);return j({csrfToken:fault==='csrf'&&key==='reader'?null:'csrf'},201,{'Set-Cookie':c+'; HttpOnly'});}
 if(p==='/auth/csrf')return j({csrfToken:'csrf'});
 if(p==='/auth/logout'){if(fault!=='logout')active.delete(cookie);return new Response(null,{status:204});}
 if(p==='/auth/me')return a?j({id:a.id,companyId:a.companyId,roleCodes:a.roles,permissions:fault==='identity'?[]:a.permissions}):new Response(null,{status:401});
 const root='/documents/projects/'+project,h='/hr/companies/'+company+'/employees/'+employee+'/documents';
 if(p===root+'/'+ordinary.id+'/download')return new Response(fault==='bytes'?'bad':'one');
 if(p===root+'/targets/SUBCONTRACT_AGREEMENT/'+signed.agreementId+'/'+signed.id+'/download')return new Response('two');
 if(p===h&&a===actors.hrReader)return j({items:fault==='history'?[]:hr.history,nextCursor:null});
 if(p===h+'/'+hr.id+'/download'&&a===actors.hrReader)return mode==='correct'||fault==='key'?new Response('three',{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}):new Response(null,{status:503});
 return new Response(null,{status:!a?401:fault==='denial'?200:404});};
 const args={target,fixture,actors,mode,fetchImpl,inspectTarget:async()=>({...target,isolated:fault!=='target'}),readPreservation:async()=>{reads++;return fault==='drift'&&reads>1?{...preservation,grants:hash('changed')}:preservation;}};
 return {args,active,requests:()=>requests};
}
for(const mode of ['correct','missing','wrong'])test(mode+' key mode',async()=>{const f=setup(mode);const r=await verifyM7Restored(f.args);assert.equal(r.status,'M7_VERIFICATION_PREPARATION_CHECK_PASS');assert.equal(r.hrPlaintextVerified,mode==='correct');assert.equal(r.keyDenialVerified,mode!=='correct');assert.equal(f.active.size,0);});
for(const [fault,code] of [['bytes','DOWNLOAD_BYTES'],['history','HISTORY_DRIFT'],['identity','ACTOR_DRIFT'],['denial','DENIAL'],['csrf','CSRF'],['drift','PRESERVATION_DRIFT'],['logout','SESSION_CLEANUP']])test(fault+' fails closed',async()=>{const f=setup('correct',fault);const r=await verifyM7Restored(f.args);assert.equal(r.code,'M7_VERIFY_'+code);if(fault!=='logout')assert.equal(f.active.size,0);});
test('wrong target makes no HTTP request',async()=>{const f=setup('correct','target');assert.equal((await verifyM7Restored(f.args)).code,'M7_VERIFY_TARGET_IDENTITY');assert.equal(f.requests(),0);});
test('wrong key cannot return plaintext',async()=>{const f=setup('wrong','key');assert.equal((await verifyM7Restored(f.args)).code,'M7_VERIFY_DENIAL');assert.equal(f.active.size,0);});
