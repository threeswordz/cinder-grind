// FM03 populated recovery proof. Only disposable, explicitly named local targets.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(resolve('apps/api/package.json'));
export async function siteIssueRecovery(mode,manifestPath,databaseUrl){
 const url=new URL(databaseUrl);
 assert.equal(process.platform,'linux');
 assert.ok(['127.0.0.1','localhost'].includes(url.hostname)&&['5432','55485'].includes(url.port));
 assert.match(url.pathname,/^\/(?:fm03_[a-f0-9]{32}|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/);
 assert.ok(['protect','restored'].includes(mode));
 process.env.DATABASE_URL=url.href;process.env.NODE_ENV='test';require('reflect-metadata');
 const {PrismaService}=require('./dist/prisma/prisma.service.js'),db=new PrismaService();await db.$connect();
 const {NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/app.module.js');
 const {ProblemDetailsFilter}=require('./dist/common/problem-details.filter.js'),{securityHeadersMiddleware}=require('./dist/common/security-headers.js');
 const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());
 const sessions=new Map();let phase='DATABASE_IDENTITY';
 try{
  assert.equal((await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,url.pathname.slice(1));
  await app.listen(0,'127.0.0.1');const api=await app.getUrl()+'/api/v1';
  const state=mode==='protect'?{f:await require('./dist/site-execution/site-issue-test-fixture.js').siteIssueFixture(db)}:JSON.parse(await readFile(manifestPath,'utf8'));
  const f=state.f;
  async function call(key,path,body,status=body===undefined?200:201){
   const s=sessions.get(key),r=await fetch(api+path,{method:body===undefined?'GET':'POST',headers:{...(s?{Cookie:s.cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':s?.csrf??''})},...(body===undefined?{}:{body:JSON.stringify(body)})});
   assert.equal(r.status,status,key+' recovery HTTP '+path);
   if(r.status===204)return;return (await r.json()).data;
  }
  phase='AUTHENTICATION';
  for(const [key,actor]of Object.entries(f.actors)){
   const r=await fetch(api+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:actor.email,password:actor.password})});
   assert.equal(r.status,201);const v=(await r.json()).data;assert.equal(v.user.id,actor.userId);sessions.set(key,{cookie:r.headers.get('set-cookie').split(';')[0],csrf:v.csrfToken});
  }
  const report=()=>db.dailySiteReport.findUniqueOrThrow({where:{id:f.report.id},include:{issues:true}});
  const snapshot=async()=>({routing:await db.siteIssueRouting.findMany({where:{companyId:f.company.id},orderBy:{projectId:'asc'}}),issues:await db.siteIssue.findMany({where:{companyId:f.company.id},include:{events:{orderBy:{version:'asc'}}},orderBy:{id:'asc'}}),report:await report()});
  if(mode==='protect'){
   phase='PROTECT_HISTORY';
   const original=JSON.stringify(await report());
   await call('CONFIG','/site-issues/projects/'+f.assigned.id+'/routing',{requestKey:randomUUID(),expectedVersion:0,ownerUserId:f.actors.OWNER.userId,escalationUserId:f.actors.MANAGER.userId,reason:'Explicit synthetic recovery routing'});
   const input=extra=>({requestKey:randomUUID(),projectId:f.assigned.id,reportId:f.report.id,activityId:f.activity.id,description:'Synthetic populated FM03 recovery',category:'GENERAL',affectsCostOrDelivery:false,workStopped:true,deliveryDelayRisk:false,...extra});
   const closed=await call('REPORTER','/site-issues',input({}));
   await call('OWNER','/site-issues/'+closed.id+'/follow-up',{requestKey:randomUUID(),expectedVersion:1,note:'Recovery follow-up'});
   await call('REPORTER','/site-issues/'+closed.id+'/verify',{requestKey:randomUUID(),expectedVersion:2,note:'Recovery verified',resolved:true});
   await call('OWNER','/site-issues/'+closed.id+'/close',{requestKey:randomUUID(),expectedVersion:3,note:'Recovery closure'});
   const pending=await call('REPORTER','/site-issues',input({category:'ASSET_LOSS_DAMAGE',workStopped:false}));
   await call('OWNER','/site-issues/'+pending.id+'/follow-up',{requestKey:randomUUID(),expectedVersion:1,note:'PM severe asset assessment',assetSeverity:'SEVERE'});
   assert.equal(JSON.stringify(await report()),original);
   state.closed=closed.id;state.pending=pending.id;state.snapshot=JSON.parse(JSON.stringify(await snapshot()));
   state.history=await call('REPORTER','/site-issues/'+closed.id);
   assert.equal(state.history.status,'CLOSED');assert.equal(state.history.events.length,4);
   // Do not serialize a function or any session/cookie. Credentials are ephemeral
   // fixture-only, kept in the private manifest until the owned restore ends.
   await writeFile(manifestPath,JSON.stringify(state),{flag:'wx',mode:0o600});
   console.log('FM03_POPULATED_HISTORY_AND_PENDING_ESCALATION_PROTECTED');
  }else{
   phase='RESTORED_BUSINESS_SNAPSHOT';
   assert.deepEqual(JSON.parse(JSON.stringify(await snapshot())),state.snapshot);
   phase='RESTORED_AUTHENTICATED_HISTORY';
   assert.deepEqual(await call('REPORTER','/site-issues/'+state.closed),state.history);
   phase='RESTORED_ACCESS_DENIALS';
   await call('OUTSIDER','/site-issues/'+state.closed,undefined,403);
   await call(null,'/site-issues/'+state.closed,undefined,401);
   await call('CONFIG','/site-issues/'+state.closed,undefined,403);
   phase='RESTORED_PENDING_ESCALATION';
   const alert=await call('MANAGER','/site-issues/escalations');assert.equal(alert.total,1);assert.equal(alert.items[0].id,state.pending);
   assert.deepEqual(JSON.parse(JSON.stringify(await snapshot())),state.snapshot);
   console.log('FM03_RESTORED_HISTORY_ESCALATION_SCOPE_AND_ORIGINAL_REPORT_PASS');
  }
  phase='UNCHANGED_BUSINESS_STATE';
  for(const model of ['stockTransaction','payment','directCostPosting','hrEmployment'])assert.equal(await db[model].count({where:{companyId:f.company.id}}),0);
  phase='SESSION_REVOCATION';
  for(const key of sessions.keys())await call(key,'/auth/logout',{},204);
  assert.equal(await db.userSession.count({where:{userId:{in:Object.values(f.actors).map(a=>a.userId)},revokedAt:null}}),0);
 }catch{throw Object.assign(new Error('FM03 recovery check failed'),{safeCode:'FM03_RECOVERY_'+phase});}
 finally{
  // Revoke any remaining synthetic sessions even when an assertion fails.
  for(const s of sessions.values())await db.userSession.updateMany({where:{tokenHash:createHash('sha256').update(decodeURIComponent(s.cookie.split('=').slice(1).join('='))).digest('hex'),revokedAt:null},data:{revokedAt:new Date()}}).catch(()=>{});
  try{await app.close();}finally{await db.$disconnect();}
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [mode,manifest]=process.argv.slice(2);const url=new URL(process.env.DATABASE_URL??'');
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RC_NON_PRODUCTION_CONFIRMED,'YES');assert.equal(process.env.SITE_ISSUE_SCHEMA_UPGRADE,'YES');
 assert.match(url.pathname,/^\/construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12}$/);
 assert.match(manifest??'',/^\/tmp\/construction-erp-v10e-migration\.[^/]+\/site-issue-protected\.json$/);
 try{await siteIssueRecovery(mode,manifest,url.href);}catch(e){console.error(/^FM03_RECOVERY_[A-Z_]+$/.test(e.safeCode??'')?e.safeCode:'FM03_POPULATED_RECOVERY_FAILED');process.exitCode=1;}
}
