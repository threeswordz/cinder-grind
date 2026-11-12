import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {allowedRequest,PipeProtocol,browserReadback} from '../uat/prototype-browser.mjs';
import {SOURCE,ROLES} from '../uat/prototype-actors.mjs';
import {validActorReceipt,validPrivateActors,toolingOnly,summary,operator} from '../uat/prototype-browser-operator.mjs';

const api='http://127.0.0.1:33071/api/v1',web='http://127.0.0.1:44171';
test('browser boundary permits real loopback reads and authentication only',()=>{
  for(const method of ['GET','HEAD','OPTIONS']){
    assert.equal(allowedRequest(api+'/auth/me',method,api,web),true);
    assert.equal(allowedRequest(web+'/assets/app.js',method,api,web),true);
  }
  for(const path of ['/auth/login','/auth/logout'])assert.equal(allowedRequest(api+path,'POST',api,web),true);
  for(const [url,method] of [[api+'/inventory/stock-counts','POST'],[api+'/auth/login?override=1','POST'],
    [api+'/auth/login/','POST'],[web+'/auth/login','POST'],[api+'/hr/private','PATCH'],
    [api+'/projects/a','DELETE'],['https://example.invalid/','GET'],['http://localhost:33071/api/v1/auth/me','GET'],
    ['http://user:secret@127.0.0.1:33071/api/v1/auth/me','GET'],['file:///etc/passwd','GET'],
    ['data:text/html,test','GET'],['ws://127.0.0.1:33071','GET'],['http://127.0.0.1:55432','GET']])
    assert.equal(allowedRequest(url,method,api,web),false,url);
});
test('pipe parses fragmented and coalesced messages without leaking payloads',async()=>{
  const input=new PassThrough(),output=new PassThrough(),p=new PipeProtocol(input,output);
  const sent=[];output.on('data',chunk=>sent.push(JSON.parse(chunk.subarray(0,-1).toString())));
  const events=[];p.listeners.add(event=>events.push(event));
  try{
    const a=p.send('Runtime.enable',{},'private-session'),b=p.send('Page.enable',{},'other-session');
    assert.equal(sent[0].sessionId,'private-session');assert.equal(sent[1].sessionId,'other-session');
    const bytes=Buffer.from(JSON.stringify({id:2,result:{enabled:true}})+'\0'+JSON.stringify({id:1,result:{ok:true}})+'\0');
    input.write(bytes.subarray(0,11));input.write(bytes.subarray(11));
    assert.deepEqual(await a,{ok:true});assert.deepEqual(await b,{enabled:true});
    input.write(JSON.stringify({method:'Fetch.requestPaused',sessionId:'private-session',params:{requestId:'request'}})+'\0');
    assert.equal(events[0].sessionId,'private-session');
    const error=p.send('Runtime.evaluate',{expression:'PRIVATE_SENTINEL'});
    input.write(JSON.stringify({id:3,error:{message:'PRIVATE_SENTINEL'}})+'\0');
    await assert.rejects(error,e=>e.safeCode==='BROWSER_PROTOCOL_COMMAND_FAILED'&&!String(e).includes('PRIVATE_SENTINEL'));
  }finally{p.close();input.destroy();output.destroy();}
});
test('malformed pipe input and closed streams reject pending commands safely',async()=>{
  for(const malformed of [true,false]){
    const input=new PassThrough(),output=new PassThrough(),p=new PipeProtocol(input,output);
    const pending=p.send('Browser.getVersion');
    if(malformed)input.write('PRIVATE_NOT_JSON\0');else input.end();
    await assert.rejects(pending,e=>e.safeCode==='BROWSER_PIPE_CLOSED'&&!String(e).includes('PRIVATE_NOT_JSON'));
    await assert.rejects(p.send('Browser.getVersion'),e=>e.safeCode==='BROWSER_PIPE_CLOSED');
    input.destroy();output.destroy();
  }
});
const receipt=()=>({status:'SYNTHETIC_ACTORS_INITIAL_HTTP_VERIFIED',sourceSha:SOURCE,
  operatorMainSha:'28b043bd545f0d4d6f11dd34d3d877ea94c0e095',functionalActors:8,initialHttpChecks:123,
  syntheticRoleConfigurationVerified:true,stockCountRequestEmploymentJourneysVerified:true,
  productionAuthorized:false,retainedResourcesUsed:false,humanUatCompleted:false,prototypeFrozen:false,
  fullBusinessRoleMatrixVerified:false,authenticatedBrowserVerified:false,populatedRecoveryVerified:false,secretsPrinted:false});
test('only the exact completed populated actor receipt qualifies',()=>{
  assert.equal(validActorReceipt(receipt()),true);
  for(const [key,value] of [['sourceSha','f'.repeat(40)],['operatorMainSha','e'.repeat(40)],['functionalActors',7],
    ['initialHttpChecks',0],['status','SYNTHETIC_ACTORS_BLOCKED'],['syntheticRoleConfigurationVerified',false],
    ['productionAuthorized',true],['retainedResourcesUsed',true],['prototypeFrozen',true],['populatedRecoveryVerified',true]])
    assert.equal(validActorReceipt({...receipt(),[key]:value}),false);
});
const privateActors=()=>({sourceSha:SOURCE,actors:Object.fromEntries(Object.keys(ROLES).map((key,i)=>[key,
  {userId:randomUUID(),employeeId:randomUUID(),roleId:randomUUID(),password:String(i).repeat(64),
    email:'proto-'+key.toLowerCase()+'@example.invalid',expectedRoleCodes:['PROTO_'+key]}]))});
test('private actors require eight distinct bound identities and credentials',()=>{
  const good=privateActors();assert.equal(validPrivateActors(good),true);
  assert.equal(validPrivateActors({...good,sourceSha:'f'.repeat(40)}),false);
  for(const mutate of [x=>delete x.actors.KOH,x=>x.actors.EXTRA=x.actors.BEN,x=>x.actors.BEN.email='real@example.com',
    x=>x.actors.BEN.password='default',x=>x.actors.BEN.expectedRoleCodes=['SYS_ADMIN'],
    x=>x.actors.KOH.employeeId=x.actors.BEN.employeeId,x=>x.actors.KOH.userId=x.actors.BEN.userId]){
    const x=structuredClone(good);mutate(x);assert.equal(validPrivateActors(x),false);
  }
});
test('browser operator provenance never permits application/schema/dependency changes',()=>{
  const entry={filename:'deploy/uat/prototype-browser.mjs',status:'added'};
  assert.equal(toolingOnly({status:'ahead',files:[entry]}),true);
  for(const x of [{status:'identical',files:[entry]},{status:'ahead',files:[]},
    {status:'ahead',files:[{...entry,filename:'apps/web/src/App.tsx'}]},
    {status:'ahead',files:[{...entry,filename:'apps/api/prisma/schema.prisma'}]},
    {status:'ahead',files:[{...entry,filename:'pnpm-lock.yaml'}]},
    {status:'ahead',files:[{...entry,status:'renamed',previous_filename:'old'}]}])assert.equal(toolingOnly(x),false);
});
test('invalid actor census is refused before any browser context or login',async()=>{
  let calls=0;
  await assert.rejects(browserReadback({protocol:{send:async()=>{calls++;}},actors:{},api,web}),
    e=>e.safeCode==='EXACT_BROWSER_ACTOR_SET_REQUIRED');
  assert.equal(calls,0);
});
test('non-Mac operator execution stops before target access and carries no broad claims',async()=>{
  if(process.platform!=='darwin')await assert.rejects(operator('--plan'),e=>e.safeCode==='NONROOT_MAC_OPERATOR_REQUIRED');
  await assert.rejects(operator('--configure'),e=>e.safeCode==='USE_PLAN_OR_VERIFY');
  const r=summary('SYNTHETIC_BROWSER_BLOCKED');
  for(const key of ['productionAuthorized','retainedResourcesUsed','humanUatCompleted','prototypeFrozen',
    'fullBusinessRoleMatrixVerified','fullAuthenticatedBrowserJourneysVerified','populatedRecoveryVerified','secretsPrinted'])
    assert.equal(r[key],false);
});
