// Shared real-browser FM03 journey. No fixture creation, source migration or reset.
import assert from 'node:assert/strict';
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
  await until(p,s,label=>[...document.querySelectorAll('[data-testid="site-issues"] label')].some(e=>{const input=document.getElementById(e.htmlFor);return e.textContent===label&&input&&!input.disabled&&input.getAttribute('aria-disabled')!=='true';}),label,'FM03_BROWSER_SELECT_UNAVAILABLE');
  await evaluate(p,s,label=>{const l=[...document.querySelectorAll('[data-testid="site-issues"] label')].find(e=>e.textContent===label);document.getElementById(l.htmlFor).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;},label);
  await until(p,s,value=>[...document.querySelectorAll('[role="option"]')].some(e=>e.getAttribute('data-value')===value),value,'FM03_BROWSER_OPTION_UNAVAILABLE');
  await evaluate(p,s,value=>{[...document.querySelectorAll('[role="option"]')].find(e=>e.getAttribute('data-value')===value).click();return true;},value);
}
async function requestState(p,s,api,id,status,version){
  await until(p,s,async({api,id,status,version})=>{
    const r=await fetch(api+'/site-issues/'+id,{credentials:'include',redirect:'error'});
    if(r.status!==200)return false;const d=(await r.json()).data;return d.status===status&&d.version===version;
  },{api,id,status,version},'FM03_BROWSER_COMMIT_NOT_OBSERVED');
}
export async function executeFm03Browser(protocol,binding,db){
  const {api:API,web:WEB,fixture:f}=binding;
  demand(API==='http://127.0.0.1:33071/api/v1'&&WEB==='http://127.0.0.1:44171'||
    process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&((API==='http://127.0.0.1:31327/api/v1'&&WEB==='http://127.0.0.1:44327')||(API==='http://127.0.0.1:31319/api/v1'&&WEB==='http://127.0.0.1:44319')),'FM03_BROWSER_ORIGINS_REFUSED');
  demand(new Set(['REPORTER','OWNER','MANAGER'].map(k=>f.actors[k].userId)).size===3,'FM03_BROWSER_ACTORS_MUST_DIFFER');
  const description='FM03 real browser work stoppage';let issueId,context,session,phase='START';
  const closing=new Set(),violations=[],csrfTokens=new Map();
  const reportBefore=f.report?JSON.stringify(await db.dailySiteReport.findUnique({where:{id:f.report.id},include:{issues:true}})):null;
  demand(await db.siteIssue.count({where:{companyId:f.company.id,description}})===0,'FM03_BROWSER_ALREADY_RUN_NO_REPLAY');
    const intercept=event=>{
      if(event.method!=='Fetch.requestPaused')return;
      const r=event.params.request;let allowed=false;
      const csrf=Object.entries(r.headers??{}).find(([key])=>key.toLowerCase()==='x-csrf-token')?.[1];
      if(typeof csrf==='string')csrfTokens.set(event.sessionId,csrf);
      try{
        const u=new URL(r.url);
        allowed=u.origin===WEB&&r.method==='GET'||u.origin===new URL(API).origin&&(
          ['GET','OPTIONS'].includes(r.method)||r.method==='POST'&&
          (['/api/v1/auth/login','/api/v1/auth/logout'].includes(u.pathname)||
            u.pathname==='/api/v1/site-issues'&&JSON.parse(r.postData??'null')?.projectId===f.assigned.id&&JSON.parse(r.postData??'null')?.description===description||
            issueId&&['follow-up','verify','close'].some(action=>u.pathname==='/api/v1/site-issues/'+issueId+'/'+action)||
            u.pathname==='/api/v1/site-issues/projects/'+f.assigned.id+'/routing'&&JSON.parse(r.postData??'null')?.ownerUserId===f.actors.OWNER.userId&&JSON.parse(r.postData??'null')?.escalationUserId===f.actors.MANAGER.userId));
      }catch{}
      if(!allowed)violations.push('FM03_BROWSER_UNDECLARED_REQUEST');
      protocol.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:event.params.requestId}:
        {requestId:event.params.requestId,errorReason:'BlockedByClient'},event.sessionId).catch(()=>{if(!closing.has(event.sessionId))violations.push('FM03_BROWSER_INTERCEPTION_FAILED');});
    };
    protocol.listeners.add(intercept);
    try{
    async function actor(key,work){
      phase=key+'_LOGIN';const a=f.actors[key];
      context=(await protocol.send('Target.createBrowserContext')).browserContextId;
      let primary,primaryPhase;
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
      }catch(e){primary=e;primaryPhase=phase;}
      try{
        phase=key+'_LOGOUT';
        // Retain only this ephemeral context's synthetic HttpOnly token in
        // memory, then prove the server rejects it after actual UI logout.
        const cookies=(await protocol.send('Storage.getCookies',{browserContextId:context})).cookies;
        const cookie=cookies.find(c=>c.name==='erp_session'&&c.domain==='127.0.0.1');
        demand(cookie&&typeof cookie.value==='string'&&cookie.value.length>0,'FM03_BROWSER_SESSION_COOKIE_MISSING');
        await click(protocol,session,'Sign out','header button');
        await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'FM03_BROWSER_LOGOUT_FAILED');
        demand(await evaluate(protocol,session,async api=>(await fetch(api+'/auth/me',{credentials:'include'})).status===401,API),'FM03_BROWSER_SESSION_NOT_REVOKED');
        const stale=await fetch(API+'/auth/me',{headers:{Cookie:'erp_session='+cookie.value},redirect:'error',signal:AbortSignal.timeout(10000)});
        const staleStatus=stale.status;await stale.body?.cancel();
        demand(staleStatus===401,'FM03_BROWSER_REVOKED_COOKIE_STILL_ACCEPTED');
      }catch(e){if(!primary){primary=e;primaryPhase=phase;}}finally{
        if(session)closing.add(session);
        try{await protocol.send('Target.disposeBrowserContext',{browserContextId:context});}catch(e){primary??=e;}
        context=undefined;session=undefined;
      }
      if(primary){phase=primaryPhase??phase;throw primary;}
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
    
    await actor('REPORTER',async(p,s)=>{
      await workspace(p,s);
      for(const projectId of [f.unassigned.id,f.foreign.id]){
        const denied=await evaluate(p,s,async({api,projectId})=>(await fetch(api+'/site-issues?projectId='+projectId,{credentials:'include',redirect:'error'})).status,{api:API,projectId});
        demand([403,404].includes(denied),'FM03_BROWSER_PROJECT_OR_COMPANY_LEAK');
      }
      await locales(p,s);await field(p,s,'Issue details',description);if(f.report)await select(p,s,'Daily report (optional)',f.report.id);
      if(f.activity)await select(p,s,'Activity (optional)',f.activity.id);
      await evaluate(p,s,()=>{const l=[...document.querySelectorAll('[data-testid="site-issues"] label')].find(e=>e.textContent==='Work stopped');l.querySelector('input').click();return true;});
      await click(p,s,'Report issue');
      await until(p,s,()=>document.querySelector('[data-testid="site-issues"]')?.textContent.includes('Recorded.'),null,'FM03_BROWSER_REPORT_NOT_SAVED');
      const issue=await db.siteIssue.findFirstOrThrow({where:{companyId:f.company.id,description}});
      issueId=issue.id;assert.equal(issue.version,1);assert.ok(issue.escalatedAt);
      assert.equal(issue.reportId,f.report?.id??null);assert.equal(issue.activityId,f.activity?.id??null);
      demand(await evaluate(p,s,()=>![...document.querySelectorAll('[data-testid="site-issues"] button')].some(e=>['Record follow-up','Close issue'].includes(e.textContent))),'FM03_BROWSER_REPORTER_AUTHORITY_LEAK');
      const csrf=csrfTokens.get(s);demand(typeof csrf==='string'&&csrf.length>0,'FM03_BROWSER_OWN_CSRF_HEADER_MISSING');
      const denied=await evaluate(p,s,async({api,id,csrf})=>(await fetch(api+'/site-issues/'+id+'/follow-up',
        {method:'POST',credentials:'include',redirect:'error',headers:{'Content-Type':'application/json','x-csrf-token':csrf},
          body:JSON.stringify({requestKey:crypto.randomUUID(),expectedVersion:1,note:'Synthetic wrong actor denial'})})).status,
        {api:API,id:issueId,csrf});
      demand(denied===403,'FM03_BROWSER_WRONG_ACTOR_NOT_DENIED');

    });
    for(const resolved of [false,true]){
      await actor('OWNER',async(p,s)=>{
        await workspace(p,s);await open(p,s,description);await field(p,s,'Action note',resolved?'Second follow-up':'First follow-up');
        await click(p,s,'Record follow-up');await requestState(p,s,API,issueId,'AWAITING_VERIFICATION',resolved?4:2);
      });
      await actor('REPORTER',async(p,s)=>{
        await workspace(p,s);await open(p,s,description);await field(p,s,'Action note',resolved?'Resolution verified':'Still unresolved');
        await click(p,s,resolved?'Verify resolved':'Verify unresolved');await requestState(p,s,API,issueId,resolved?'VERIFIED':'OPEN',resolved?5:3);
      });
    }
    if(f.actors.DENIED)await actor('DENIED',async(p,s)=>{
      const status=await evaluate(p,s,async({api,projectId})=>(await fetch(api+'/site-issues?projectId='+projectId,{credentials:'include',redirect:'error'})).status,{api:API,projectId:f.assigned.id});
      demand(status===403,'FM03_BROWSER_MISSING_PERMISSION_NOT_DENIED');
    });
    await actor('MANAGER',async(p,s)=>{
      await until(p,s,()=>Boolean(document.querySelector('[data-testid="site-issue-alerts"] button')),null,'FM03_BROWSER_MANAGEMENT_ALERT_MISSING');
      await evaluate(p,s,()=>{document.querySelector('[data-testid="site-issue-alerts"] button').click();return true;});
      await until(p,s,description=>document.querySelector('[data-testid="site-issues"]')?.textContent.includes(description),description,'FM03_BROWSER_ALERT_NAVIGATION_FAILED');
      demand(await evaluate(p,s,()=>![...document.querySelectorAll('[data-testid="site-issues"] button')].some(e=>['Record follow-up','Verify resolved','Close issue'].includes(e.textContent))),'FM03_BROWSER_MANAGER_BUSINESS_ACTION');
    });
    await actor('OWNER',async(p,s)=>{
      await workspace(p,s);await open(p,s,description);await field(p,s,'Action note','Owner closure after verified resolution');
      await click(p,s,'Close issue');await requestState(p,s,API,issueId,'CLOSED',6);
    });
    phase='PRESERVATION';
    assert.equal(await db.siteIssueEvent.count({where:{issueId}}),6);
    assert.equal(await db.userSession.count({where:{userId:{in:Object.values(f.actors).map(a=>a.userId)},revokedAt:null}}),0);
    if(f.report)assert.equal(JSON.stringify(await db.dailySiteReport.findUnique({where:{id:f.report.id},include:{issues:true}})),reportBefore);
    assert.deepEqual(violations,[]);
    return {status:'FM03_AUTHENTICATED_BROWSER_VERIFIED',issueId,events:6,unresolvedAndResolvedVerification:true,severeAlertNavigation:true,threeLocales:true,sessionsRevoked:true};
    }catch(e){throw Object.assign(new Error(),{safeCode:'FM03_JOURNEY_'+phase+'_'+(/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'ASSERTION_FAILED')});}
    finally{protocol.listeners.delete(intercept);csrfTokens.clear();if(context)try{await protocol.send('Target.disposeBrowserContext',{browserContextId:context});}catch{}}
}
