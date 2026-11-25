import test from 'node:test';
import assert from 'node:assert/strict';
import {executeM6HrDocumentJourney,validateM6HrSource} from './prototype-m6-hr-document-journey.mjs';
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const fixture={companyId:uuid(1),foreignCompanyId:uuid(2)};
const source={employeeId:uuid(3),documentTypeId:uuid(4),expectedVersion:0,syntheticOnly:true};
function fake(failAt){
 const history={id:uuid(7),version:1,createdAt:'2026-11-22T00:00:00Z'};
 const calls=[],sessionLog=[];
 const client={
  login:async(k)=>{sessionLog.push('login:'+k);return {cookie:'x='+k,csrf:'csrf-'+k};},
  logout:async(k)=>sessionLog.push('logout:'+k),
  call:async(actor,label,path,expected)=>{
   calls.push({label,path,expected});
   if(failAt===label)throw Error('MOCK_FAILURE');
   let data;
   if(label==='M6_HR_PRIOR_HISTORY')data={items:[],nextCursor:null};
   if(label==='M6_HR_MASKED_HISTORY')data={items:[history],nextCursor:null};
   return {value:{data}};
  },
 };
 const fetches=[],fetchImpl=async(url,request)=>{
  fetches.push({url,request});
  if(failAt==='UPLOAD')return new Response(JSON.stringify({code:'DENIED'}),{status:403});
  if(request.method==='POST'){
   assert.equal(url,'http://127.0.0.1:33071/api/v1/hr/companies/'+fixture.companyId+
     '/employees/'+source.employeeId+'/documents');
   assert.equal(request.headers['x-csrf-token'],'csrf-M6_HR_KOH');
   assert.equal(request.headers.Cookie,'x=M6_HR_KOH');
   assert.equal(request.body.get('documentTypeId'),source.documentTypeId);
   assert.equal(request.body.get('expectedVersion'),'0');
   const file=request.body.get('file');
   assert.equal(file.type,'text/plain');
   assert.equal(file.name,'synthetic-m6-hr-proof.txt');
   assert.equal((await file.text()).startsWith('CONSTRUCTION_ERP_SYNTHETIC_M6'),true);
   return new Response(JSON.stringify({data:{id:uuid(7),version:1}}),{status:201});
  }
  return new Response(Buffer.from('CONSTRUCTION_ERP_SYNTHETIC_M6_ENCRYPTED_HR_FILE_PROOF_20261122\n'),
    {status:200,headers:{'content-type':'text/plain','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
 };
 return {client,fetchImpl,calls,fetches,sessionLog};
}
const base={actors:{KOH:{},STORE_SITE:{}},fixture,source,requestKey:uuid(10)};
test('requires pinned synthetic valid UUID identities and version',()=>{
 validateM6HrSource(fixture,source);
 for(const patch of [{employeeId:'x'},{documentTypeId:null},{expectedVersion:-1},
  {syntheticOnly:false},{expectedVersion:0.5}])
  assert.throws(()=>validateM6HrSource(fixture,{...source,...patch}),
    /M6_HR_EXPLICIT_SYNTHETIC_SOURCE_REQUIRED/);
});
test('Koh upload + masked list + exact downloaded bytes, store denials, both session revocations',async()=>{
 const x=fake(),result=await executeM6HrDocumentJourney({...base,client:x.client,
   fetchImpl:x.fetchImpl});
 assert.equal(result.status,'M6_ENCRYPTED_HR_ATTACHMENT_HTTP_VERIFIED');
 assert.equal(result.sessionsRevoked,true);
 assert.equal(result.privateNoStoreDownloadVerified,true);
 assert.equal(result.macDeploymentVerified,false);
 assert.equal(result.encryptedStorageProofRequiresPrivateInspection,true);
 assert.equal(x.fetches.length,2);
 assert.deepEqual(x.calls.filter(x=>x.expected===403).map(x=>x.label),[
  'M6_HR_STORE_LIST_DENIED','M6_HR_STORE_FOREIGN_DENIED','M6_HR_STORE_DOWNLOAD_DENIED']);
 assert.deepEqual(x.sessionLog,[
  'login:M6_HR_KOH','login:M6_HR_STORE_SITE',
  'logout:M6_HR_STORE_SITE','logout:M6_HR_KOH']);
 assert.equal(x.calls.filter(x=>x.expected===401).length,2);
});
test('failed upload performs no unsafe retry and revokes both sessions',async()=>{
 const x=fake('UPLOAD');
 await assert.rejects(executeM6HrDocumentJourney({...base,client:x.client,
  fetchImpl:x.fetchImpl}),/M6_HR_UPLOAD_HTTP_403/);
 assert.equal(x.fetches.length,1);
 assert.deepEqual(x.sessionLog.slice(-2),['logout:M6_HR_STORE_SITE','logout:M6_HR_KOH']);
});
test('missing completed source prevents HTTP request',async()=>{
 const x=fake();
 await assert.rejects(executeM6HrDocumentJourney({...base,source:{...source,syntheticOnly:false},
  client:x.client,fetchImpl:x.fetchImpl}),/M6_HR_EXPLICIT_SYNTHETIC_SOURCE_REQUIRED/);
 assert.equal(x.fetches.length,0);assert.equal(x.sessionLog.length,0);
});
test('history drift refuses upload and cleans up sessions',async()=>{
 const x=fake();
 await assert.rejects(executeM6HrDocumentJourney({...base,source:{...source,expectedVersion:1},
  client:x.client,fetchImpl:x.fetchImpl}),/M6_HR_SOURCE_HISTORY_DRIFT/);
 assert.equal(x.fetches.length,0);
 assert.deepEqual(x.sessionLog.slice(-2),['logout:M6_HR_STORE_SITE','logout:M6_HR_KOH']);
});
