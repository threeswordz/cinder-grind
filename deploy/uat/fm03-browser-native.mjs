// Linux-only disposable FM03: real built React, real login/CSRF API and PostgreSQL.
// Never targets the populated Mac prototype; no transport mocks or human UAT.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn,spawnSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {PipeProtocol} from './prototype-browser.mjs';
import {prepareFm03Upgrade} from '../release-candidate/site-issue-predecessor.mjs';
import {safeEnvironment} from './prototype-actors.mjs';
const execute=promisify(execFile),root=fileURLToPath(new URL('../../',import.meta.url));
const apiRoot=join(root,'apps/api'),require=createRequire(join(apiRoot,'package.json'));
const API='http://127.0.0.1:31327/api/v1',WEB='http://127.0.0.1:44327';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
async function evaluate(p,s,fn,arg){
  const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',awaitPromise:true,returnByValue:true},s);
  demand(!r.exceptionDetails&&r.result?.type!=='error','FM03_BROWSER_EVALUATION_FAILED');return r.result?.value;
}
async function until(p,s,fn,arg,code){
  const end=Date.now()+20000;
  while(Date.now()<end){if(await evaluate(p,s,fn,arg))return;await new Promise(r=>setTimeout(r,100));}
  demand(false,code);
}
async function click(p,s,label,selector='[data-testid="site-issues"] button'){
  await until(p,s,({label,selector})=>[...document.querySelectorAll(selector)].some(e=>e.textContent===label&&!e.disabled),{label,selector},'FM03_BROWSER_ACTION_UNAVAILABLE');
  demand(await evaluate(p,s,({label,selector})=>{const e=[...document.querySelectorAll(selector)].find(e=>e.textContent===label&&!e.disabled);if(!e)return false;e.click();return true;},{label,selector}),'FM03_BROWSER_ACTION_UNAVAILABLE');
}
async function field(p,s,label,value){
  await until(p,s,label=>[...document.querySelectorAll('[data-testid="site-issues"] label')].some(e=>e.textContent===label),label,'FM03_BROWSER_FIELD_UNAVAILABLE');
  await evaluate(p,s,({label,value})=>{
    const l=[...document.querySelectorAll('[data-testid="site-issues"] label')].find(e=>e.textContent===label),e=document.getElementById(l.htmlFor);
    const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);
    e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;
  },{label,value});
}
async function select(p,s,label,value){
  await until(p,s,label=>[...document.querySelectorAll('[data-testid="site-issues"] label')].some(e=>e.textContent===label),label,'FM03_BROWSER_SELECT_UNAVAILABLE');
  await evaluate(p,s,label=>{const l=[...document.querySelectorAll('[data-testid="site-issues"] label')].find(e=>e.textContent===label);document.getElementById(l.htmlFor).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;},label);
  await until(p,s,value=>[...document.querySelectorAll('[role="option"]')].some(e=>e.getAttribute('data-value')===value),value,'FM03_BROWSER_OPTION_UNAVAILABLE');
  await evaluate(p,s,value=>{[...document.querySelectorAll('[role="option"]')].find(e=>e.getAttribute('data-value')===value).click();return true;},value);
}
async function requestState(p,s,id,status,version){
  await until(p,s,async({api,id,status,version})=>{
    const r=await fetch(api+'/site-issues/'+id,{credentials:'include',redirect:'error'});
    if(r.status!==200)return false;const d=(await r.json()).data;return d.status===status&&d.version===version;
  },{api:API,id,status,version},'FM03_BROWSER_COMMIT_NOT_OBSERVED');
}
export async function runFm03Browser(databaseUrl){
  const own=new URL(databaseUrl);
  assert.equal(process.platform,'linux');assert.equal(process.versions.node,'24.21.0');
  assert.ok(['localhost','127.0.0.1'].includes(own.hostname)&&['5432','55485'].includes(own.port)&&/^\/fm03_[a-f0-9]{32}$/.test(own.pathname));
  const temporary=await mkdtemp(join(tmpdir(),'erp-fm03-browser-'));
  const env={...safeEnvironment(),CI:'true',NODE_ENV:'test',DATABASE_URL:own.href,WEB_ORIGIN:WEB,
    STORAGE_ROOT:join(temporary,'documents'),DOCUMENT_UPLOAD_TEMP_ROOT:join(temporary,'uploads'),
    HR_PRIVATE_KEYS:JSON.stringify({fm03:randomBytes(32).toString('base64')}),HR_PRIVATE_ACTIVE_KEY_ID:'fm03'};
  Object.assign(process.env,env);require('reflect-metadata');
  const {PrismaService}=require('./dist/prisma/prisma.service.js'),db=new PrismaService();await db.$connect();
  const {NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/app.module.js');
  const {ProblemDetailsFilter}=require('./dist/common/problem-details.filter.js'),{securityHeadersMiddleware}=require('./dist/common/security-headers.js');
  const {corsOriginPolicy}=require('./dist/common/cors-origin.js');
  let app,server,child,protocol,exited,phase='FIXTURE',context,session;const closing=new Set(),violations=[];
  try{
    assert.equal((await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,own.pathname.slice(1));
    const {siteIssueFixture}=require('./dist/site-execution/site-issue-test-fixture.js'),f=await siteIssueFixture(db);
    const reportBefore=JSON.stringify(await db.dailySiteReport.findUnique({where:{id:f.report.id},include:{issues:true}}));
    app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');
    app.enableCors({origin:corsOriginPolicy(WEB),credentials:true,methods:['GET','POST','PATCH','PUT','DELETE','OPTIONS']});
    app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(31327,'127.0.0.1');
    phase='BUILT_WEB';
    const out=join(temporary,'web');
    await execute('pnpm',['--filter','@construction-erp/web','exec','vite','build','--outDir',out],
      {cwd:root,env:{...safeEnvironment(),VITE_API_BASE_URL:API},timeout:120000,maxBuffer:2097152});
    server=createServer(async(req,res)=>{
      try{
        const path=new URL(req.url,WEB).pathname,file=resolve(out,'.'+decodeURIComponent(path));
        if(req.method!=='GET'||file!==out&&!file.startsWith(out+'/')){res.writeHead(404);res.end();return;}
        const target=path==='/'?join(out,'index.html'):file,bytes=await readFile(target);
        res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':target.endsWith('.svg')?'image/svg+xml':'text/html');
        res.setHeader('Cache-Control','no-store');res.end(bytes);
      }catch{res.writeHead(404);res.end();}
    });
    await new Promise((ok,no)=>{server.once('error',no);server.listen(44327,'127.0.0.1',ok);});
    const chrome=['google-chrome','chromium','chromium-browser'].find(bin=>spawnSync(bin,['--version'],{stdio:'ignore'}).status===0);
    assert.ok(chrome,'Real disposable Chromium is required');
    child=spawn(chrome,['--headless=new','--remote-debugging-pipe','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
      '--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync',
      '--disable-extensions','--no-proxy-server','--password-store=basic','--user-data-dir='+join(temporary,'chrome')],
      {env:safeEnvironment(),stdio:['ignore','ignore','ignore','pipe','pipe']});
    exited=new Promise(ok=>child.once('close',ok));protocol=new PipeProtocol(child.stdio[4],child.stdio[3]);
    child.on('error',()=>protocol.close());child.on('exit',()=>protocol.close());await protocol.send('Browser.getVersion');
    protocol.listeners.add(event=>{
      if(event.method!=='Fetch.requestPaused')return;
      const r=event.params.request;let allowed=false;
      try{
        const u=new URL(r.url);
        allowed=u.origin===WEB&&r.method==='GET'||u.origin===new URL(API).origin&&(
          ['GET','OPTIONS'].includes(r.method)||r.method==='POST'&&
          (['/api/v1/auth/login','/api/v1/auth/logout'].includes(u.pathname)||
            u.pathname==='/api/v1/site-issues'||/^\/api\/v1\/site-issues\/[a-f0-9-]+\/(follow-up|verify|close)$/.test(u.pathname)||
            u.pathname==='/api/v1/site-issues/projects/'+f.assigned.id+'/routing'));
      }catch{}
      if(!allowed)violations.push('FM03_BROWSER_UNDECLARED_REQUEST');
      protocol.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:event.params.requestId}:
        {requestId:event.params.requestId,errorReason:'BlockedByClient'},event.sessionId).catch(()=>{if(!closing.has(event.sessionId))violations.push('FM03_BROWSER_INTERCEPTION_FAILED');});
    });
    async function actor(key,work){
      phase=key+'_LOGIN';const a=f.actors[key];
      context=(await protocol.send('Target.createBrowserContext')).browserContextId;
      try{
        const target=(await protocol.send('Target.createTarget',{url:'about:blank',browserContextId:context})).targetId;
        session=(await protocol.send('Target.attachToTarget',{targetId:target,flatten:true})).sessionId;
        for(const method of ['Page.enable','Runtime.enable'])await protocol.send(method,{},session);
        await protocol.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false},session);
        await protocol.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},session);
        await protocol.send('Page.navigate',{url:WEB},session);
        await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'FM03_BROWSER_LOGIN_FORM_MISSING');
        await evaluate(protocol,session,a=>{
          for(const [type,value]of[['email',a.email],['password',a.password]]){
            const e=document.querySelector('input[type="'+type+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);
            e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
          }document.querySelector('form').requestSubmit();return true;
        },{email:a.email,password:a.password});
        await until(protocol,session,()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')),null,'FM03_BROWSER_LOGIN_FAILED');
        demand(await evaluate(protocol,session,async({api,id,companyId})=>{
          const r=await fetch(api+'/auth/me',{credentials:'include'});const v=await r.json();
          return r.status===200&&v.data.id===id&&v.data.companyId===companyId;
        },{api:API,id:a.userId,companyId:f.company.id}),'FM03_BROWSER_WRONG_ACTOR');
        phase=key+'_WORKFLOW';await work(protocol,session);
        phase=key+'_LOGOUT';await click(protocol,session,'Sign out','header button');
        await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'FM03_BROWSER_LOGOUT_FAILED');
        demand(await evaluate(protocol,session,async api=>(await fetch(api+'/auth/me',{credentials:'include'})).status===401,API),'FM03_BROWSER_SESSION_NOT_REVOKED');
      }finally{
        if(session)closing.add(session);
        await protocol.send('Target.disposeBrowserContext',{browserContextId:context});context=undefined;session=undefined;
      }
    }
    async function workspace(p,s){
      await until(p,s,()=>[...document.querySelectorAll('nav [role="button"]')].some(e=>e.textContent==='Site Execution'),null,'FM03_BROWSER_NAV_MISSING');
      await evaluate(p,s,()=>{[...document.querySelectorAll('nav [role="button"]')].find(e=>e.textContent==='Site Execution').click();return true;});
      await select(p,s,'Project',f.assigned.id);
    }
    async function open(p,s,description){
      await until(p,s,description=>[...document.querySelectorAll('[data-testid="site-issues"] button')].some(e=>e.textContent.startsWith('Open issue: '+description)),description,'FM03_BROWSER_ISSUE_LIST_MISSING');
      await evaluate(p,s,description=>{[...document.querySelectorAll('[data-testid="site-issues"] button')].find(e=>e.textContent.startsWith('Open issue: '+description)).click();return true;},description);
      await until(p,s,()=>Boolean(document.querySelector('[data-testid="site-issues"] .MuiChip-label')),null,'FM03_BROWSER_DETAIL_MISSING');
    }
    await actor('CONFIG',async(p,s)=>{
      await workspace(p,s);await select(p,s,'Follow-up owner',f.actors.OWNER.userId);
      await select(p,s,'Escalation recipient',f.actors.MANAGER.userId);
      await field(p,s,'Reason for routing change','Synthetic explicit project routing');await click(p,s,'Save routing');
      await until(p,s,()=>document.querySelector('[data-testid="site-issues"]')?.textContent.includes('Recorded.'),null,'FM03_BROWSER_ROUTING_NOT_SAVED');
      demand(await evaluate(p,s,()=>![...document.querySelectorAll('[data-testid="site-issues"] button')].some(e=>e.textContent==='Report issue')), 'FM03_BROWSER_ADMIN_BUSINESS_ACTION');
    });
    async function locales(p,s){
      for(const [label,title,action]of [['ไทย','ปัญหาหน้างาน','แจ้งปัญหา'],['繁中','工地問題','回報問題'],['EN','Site issues','Report issue']]){
        await evaluate(p,s,()=>{document.querySelector('header [role="combobox"]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;});
        await until(p,s,label=>[...document.querySelectorAll('[role="option"]')].some(e=>e.textContent===label),label,'FM03_BROWSER_LOCALE_MENU_MISSING');
        await evaluate(p,s,label=>{[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent===label).click();return true;},label);
        await until(p,s,({title,action})=>{
          const box=document.querySelector('[data-testid="site-issues"]');return box?.textContent.includes(title)&&[...box.querySelectorAll('button')].some(e=>e.textContent===action);
        },{title,action},'FM03_BROWSER_TRANSLATED_FORM_MISSING');
      }
    }
    const description='FM03 real browser work stoppage';let issueId;
    await actor('REPORTER',async(p,s)=>{
      await workspace(p,s);
      await locales(p,s);await field(p,s,'Issue details',description);await select(p,s,'Daily report (optional)',f.report.id);
      await select(p,s,'Activity (optional)',f.activity.id);
      await evaluate(p,s,()=>{const l=[...document.querySelectorAll('[data-testid="site-issues"] label')].find(e=>e.textContent==='Work stopped');l.querySelector('input').click();return true;});
      await click(p,s,'Report issue');
      await until(p,s,()=>document.querySelector('[data-testid="site-issues"]')?.textContent.includes('Recorded.'),null,'FM03_BROWSER_REPORT_NOT_SAVED');
      const issue=await db.siteIssue.findFirstOrThrow({where:{companyId:f.company.id,description}});
      issueId=issue.id;assert.equal(issue.version,1);assert.ok(issue.escalatedAt);
      assert.equal(issue.reportId,f.report.id);assert.equal(issue.activityId,f.activity.id);
      demand(await evaluate(p,s,()=>![...document.querySelectorAll('[data-testid="site-issues"] button')].some(e=>['Record follow-up','Close issue'].includes(e.textContent))),'FM03_BROWSER_REPORTER_AUTHORITY_LEAK');
    });
    for(const resolved of [false,true]){
      await actor('OWNER',async(p,s)=>{
        await workspace(p,s);await open(p,s,description);await field(p,s,'Action note',resolved?'Second follow-up':'First follow-up');
        await click(p,s,'Record follow-up');await requestState(p,s,issueId,'AWAITING_VERIFICATION',resolved?4:2);
      });
      await actor('REPORTER',async(p,s)=>{
        await workspace(p,s);await open(p,s,description);await field(p,s,'Action note',resolved?'Resolution verified':'Still unresolved');
        await click(p,s,resolved?'Verify resolved':'Verify unresolved');await requestState(p,s,issueId,resolved?'VERIFIED':'OPEN',resolved?5:3);
      });
    }
    await actor('MANAGER',async(p,s)=>{
      await until(p,s,()=>Boolean(document.querySelector('[data-testid="site-issue-alerts"] button')),null,'FM03_BROWSER_MANAGEMENT_ALERT_MISSING');
      await evaluate(p,s,()=>{document.querySelector('[data-testid="site-issue-alerts"] button').click();return true;});
      await until(p,s,description=>document.querySelector('[data-testid="site-issues"]')?.textContent.includes(description),description,'FM03_BROWSER_ALERT_NAVIGATION_FAILED');
      demand(await evaluate(p,s,()=>![...document.querySelectorAll('[data-testid="site-issues"] button')].some(e=>['Record follow-up','Verify resolved','Close issue'].includes(e.textContent))),'FM03_BROWSER_MANAGER_BUSINESS_ACTION');
    });
    await actor('OWNER',async(p,s)=>{
      await workspace(p,s);await open(p,s,description);await field(p,s,'Action note','Owner closure after verified resolution');
      await click(p,s,'Close issue');await requestState(p,s,issueId,'CLOSED',6);
    });
    phase='PRESERVATION';
    assert.equal(await db.siteIssueEvent.count({where:{issueId}}),6);
    assert.equal(await db.userSession.count({where:{userId:{in:Object.values(f.actors).map(a=>a.userId)},revokedAt:null}}),0);
    assert.equal(JSON.stringify(await db.dailySiteReport.findUnique({where:{id:f.report.id},include:{issues:true}})),reportBefore);
    for(const model of ['stockTransaction','payment','directCostPosting','hrEmployment'])assert.equal(await db[model].count({where:{companyId:f.company.id}}),0);
    assert.deepEqual(violations,[]);
    console.log('FM03_BROWSER_NATIVE_PASS: built React and authenticated API/PostgreSQL; explicit routing, actual report/follow-up/unresolved and resolved verification/closure, management alert navigation, actor separation, actual EN/TH/zh-TW form rendering, retained report/stock/Finance/HR and revoked sessions. Disposable proof only; not Mac/UAT/freeze.');
  }catch(e){throw Object.assign(new Error(),{safeCode:'FM03_NATIVE_'+phase+'_'+(/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'ASSERTION_OR_SETUP_FAILED')});}
  finally{
    if(protocol&&context)try{await protocol.send('Target.disposeBrowserContext',{browserContextId:context});}catch{}
    if(child){
      if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
      const deadline=setTimeout(()=>{try{child.kill('SIGKILL');}catch{}},5000);try{await exited;}finally{clearTimeout(deadline);}
      protocol?.close();
    }
    try{if(server)await new Promise(ok=>server.close(ok));}finally{
      try{if(app)await app.close();}finally{await db.$disconnect();await rm(temporary,{recursive:true,force:true});}
    }
  }
}
async function native(){
  assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.platform,'linux');assert.equal(process.versions.node,'24.21.0');
  const baseUrl=new URL(process.env.DATABASE_URL??'');
  assert.ok(['localhost','127.0.0.1'].includes(baseUrl.hostname)&&baseUrl.port==='5432'&&baseUrl.username==='construction_erp'&&baseUrl.pathname==='/construction_erp');
  const {PrismaClient}=require('@prisma/client'),base=new PrismaClient({datasources:{db:{url:baseUrl.href}},log:[]});
  const name='fm03_'+randomUUID().replaceAll('-',''),own=new URL(baseUrl);own.pathname='/'+name;let created=false;
  try{
    await base.$executeRawUnsafe('CREATE DATABASE "'+name+'"');created=true;
    await prepareFm03Upgrade(own.href);
    await runFm03Browser(own.href);
  }finally{try{if(created)await base.$executeRawUnsafe('DROP DATABASE "'+name+'" WITH (FORCE)');}finally{await base.$disconnect();}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{await native();}catch(e){console.error(e.safeCode??'FM03_BROWSER_NATIVE_GUARD_OR_CLEANUP_FAILED');process.exitCode=1;}
}
