// Actual browser transport over Chrome's private debugging pipe. No HTTP mocks.
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {ROLES,safeEnvironment} from './prototype-actors.mjs';

const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const pause=ms=>new Promise(r=>setTimeout(r,ms));

export function allowedRequest(url,method,api,web){
  try{
    const u=new URL(url),a=new URL(api),w=new URL(web);
    if(u.username||u.password||u.hash)return false;
    if(!['http:','https:'].includes(u.protocol))return false;
    if(u.origin!==a.origin&&u.origin!==w.origin)return false;
    if(['GET','HEAD','OPTIONS'].includes(method))return true;
    return u.origin===a.origin&&method==='POST'&&u.search===''&&
      [a.pathname+'/auth/login',a.pathname+'/auth/logout'].includes(u.pathname);
  }catch{return false;}
}

// Errors deliberately contain no raw Chrome messages, evaluated expressions,
// responses, credentials or protocol payloads.
export class PipeProtocol{
  constructor(input,output){
    this.input=input;this.output=output;this.sequence=0;this.pending=new Map();this.buffer=Buffer.alloc(0);
    this.listeners=new Set();this.closed=false;
    input.on('data',chunk=>this.receive(chunk));
    input.on('error',()=>this.close());input.on('end',()=>this.close());
    output.on('error',()=>this.close());
  }
  receive(chunk){
    this.buffer=Buffer.concat([this.buffer,chunk]);
    if(this.buffer.length>8*1024*1024){this.close();return;}
    let end;
    while((end=this.buffer.indexOf(0))>=0){
      const packet=this.buffer.subarray(0,end);this.buffer=this.buffer.subarray(end+1);
      let message;try{message=JSON.parse(packet.toString());}catch{this.close();return;}
      if(message.id){
        const item=this.pending.get(message.id);if(!item)continue;
        this.pending.delete(message.id);clearTimeout(item.timeout);
        if(message.error)item.reject(Object.assign(new Error(),{safeCode:'BROWSER_PROTOCOL_COMMAND_FAILED'}));
        else item.resolve(message.result??{});
      }else for(const listener of this.listeners)listener(message);
    }
  }
  send(method,params={},sessionId){
    if(this.closed)return Promise.reject(Object.assign(new Error(),{safeCode:'BROWSER_PIPE_CLOSED'}));
    return new Promise((resolve,reject)=>{
      const id=++this.sequence;
      const timeout=setTimeout(()=>{this.pending.delete(id);reject(Object.assign(new Error(),{safeCode:'BROWSER_COMMAND_TIMEOUT'}));},20000);
      this.pending.set(id,{resolve,reject,timeout});
      this.output.write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');
    });
  }
  close(){
    if(this.closed)return;this.closed=true;
    for(const item of this.pending.values()){
      clearTimeout(item.timeout);item.reject(Object.assign(new Error(),{safeCode:'BROWSER_PIPE_CLOSED'}));
    }
    this.pending.clear();
  }
}

export async function startBrowser(executable,profileParent){
  const profile=await mkdtemp(join(profileParent,'browser-profile-'));
  const ci=process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true';
  const args=['--headless=new','--remote-debugging-pipe','--no-first-run','--no-default-browser-check',
    '--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions',
    '--disable-gpu','--no-proxy-server','--password-store=basic','--user-data-dir='+profile];
  if(ci)args.push('--no-sandbox','--disable-dev-shm-usage');
  const child=spawn(executable,args,{env:safeEnvironment(),stdio:['ignore','ignore','ignore','pipe','pipe']});
  const exited=new Promise(resolve=>child.once('close',resolve));
  const protocol=new PipeProtocol(child.stdio[4],child.stdio[3]);
  child.on('error',()=>protocol.close());child.on('exit',()=>protocol.close());
  let stopping;
  function stop(){return stopping??=stopOnce();}
  async function stopOnce(){
    if(child.exitCode===null&&child.signalCode===null){
      child.kill('SIGTERM');
      const timeout=setTimeout(()=>{try{child.kill('SIGKILL');}catch{}},5000);
      let deadline;
      try{await Promise.race([exited,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(
        Object.assign(new Error(),{safeCode:'BROWSER_EXIT_UNCONFIRMED_COPY_PRESERVED'})),15000);})]);}
      finally{clearTimeout(timeout);clearTimeout(deadline);}
    }
    await exited;
    protocol.close();
    // Only the exclusively created profile is removed, after our Chrome exits.
    await rm(profile,{recursive:true,force:true});
  }
  try{await protocol.send('Browser.getVersion');return {protocol,stop};}
  catch(e){await stop();e.browserProcessExited=true;throw e;}
}

async function evaluate(p,session,fn,arg){
  const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',
    awaitPromise:true,returnByValue:true},session);
  demand(!r.exceptionDetails&&r.result&&r.result.type!=='error','BROWSER_PAGE_EVALUATION_FAILED');
  return r.result.value;
}
async function until(p,session,fn,arg,code){
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){if(await evaluate(p,session,fn,arg))return;await pause(200);}
  demand(false,code);
}

export async function browserReadback({protocol:p,api,web,actors,fixture,initial}){
  demand(Object.keys(actors).length===9&&Object.keys(ROLES).every(k=>actors[k])&&actors.SYS_ADMIN,
    'EXACT_BROWSER_ACTOR_SET_REQUIRED');
  const observations=[],violations=[],contexts=new Set(),closingSessions=new Set();
  // Interception is an outbound safety boundary. Every allowed request is
  // continued to the real application/server, never fulfilled synthetically.
  const intercept=message=>{
    if(message.method!=='Fetch.requestPaused')return;
    const {requestId,request}=message.params;
    const allowed=allowedRequest(request.url,request.method,api,web);
    if(!allowed)violations.push('OUTBOUND_OR_BUSINESS_WRITE_REFUSED');
    p.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',
      allowed?{requestId}:{requestId,errorReason:'BlockedByClient'},message.sessionId)
      .catch(()=>{if(!closingSessions.has(message.sessionId))violations.push('BROWSER_INTERCEPTION_FAILED');});
  };
  p.listeners.add(intercept);
  const record=(key,check)=>observations.push({actor:key,check,passed:true,requestId:randomUUID(),observedAt:new Date().toISOString()});
  try{
    for(const [key,actor] of Object.entries(actors)){
      const {browserContextId}=await p.send('Target.createBrowserContext');contexts.add(browserContextId);
      let session,primaryError;
      try{
        const {targetId}=await p.send('Target.createTarget',{url:'about:blank',browserContextId});
        session=(await p.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
        await p.send('Page.enable',{},session);await p.send('Runtime.enable',{},session);
        await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},session);
        await p.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},session);
        await p.send('Page.navigate',{url:web},session);
        await until(p,session,()=>Boolean(document.querySelector('input[type="email"]')&&document.querySelector('input[type="password"]')),
          null,'BROWSER_LOGIN_FORM_NOT_READY');
        const anonymous=await evaluate(p,session,async api=>(await fetch(api+'/auth/me',{credentials:'include',redirect:'error'})).status,api);
        demand(anonymous===401,'BROWSER_CONTEXT_NOT_ANONYMOUS');record(key,'ANONYMOUS_CONTEXT');
        await evaluate(p,session,credentials=>{
          for(const [type,value] of [['email',credentials.email],['password',credentials.password]]){
            const input=document.querySelector('input[type="'+type+'"]');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
            input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
          }
          document.querySelector('form').requestSubmit();return true;
        },{email:actor.email,password:actor.password});
        await until(p,session,()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')&&
          [...document.querySelectorAll('button')].some(b=>b.textContent==='Sign out')),null,'BROWSER_LOGIN_WORKSPACE_NOT_READY');
        const identity=await evaluate(p,session,async({api,userId,companyId,roles,permissions})=>{
          const r=await fetch(api+'/auth/me',{credentials:'include',redirect:'error'});
          if(r.status!==200)return false;const me=(await r.json()).data;
          return me.id===userId&&me.companyId===companyId&&
            JSON.stringify([...me.roleCodes].sort())===JSON.stringify([...roles].sort())&&
            JSON.stringify([...me.permissions].sort())===JSON.stringify([...permissions].sort());
        },{api,userId:actor.userId,companyId:fixture.companyId,roles:actor.expectedRoleCodes,permissions:actor.permissions});
        demand(identity,'BROWSER_EFFECTIVE_IDENTITY_MISMATCH');record(key,'UI_LOGIN_EFFECTIVE_IDENTITY');
        const permissions=actor.permissions;
        const tests=[['ASSIGNED_PROJECT','/projects/'+fixture.projectId,permissions.includes('projects.project.view')?200:403],
          ['SECOND_PROJECT','/projects/'+fixture.unassignedProjectId,permissions.includes('projects.project.view')?
            (permissions.includes('projects.access_all')?200:403):403],
          ['FOREIGN_PROJECT','/projects/'+fixture.foreignProjectId,permissions.includes('projects.project.view')?404:403],
          ['COUNT_ACCESS','/inventory/stock-count-projects',permissions.includes('inventory.stock_count.view')?200:403],
          ['FOREIGN_HR','/hr/companies/'+fixture.foreignCompanyId+'/employees',permissions.includes('hr.employment.view')?404:403]];
        const root='/hr/companies/'+fixture.companyId+'/employees/'+actors.FOREMAN.employeeId;
        for(const category of ['employment','identity','bank']){
          const allowed=key!=='SYS_ADMIN'&&ROLES[key].categories.includes(category);
          tests.push(['HR_'+category.toUpperCase(),root+(category==='employment'?'/employment':'/private/'+category),
            allowed?200:category==='employment'?403:404]);
        }
        for(const [check,path,status] of tests){
          const result=await evaluate(p,session,async({api,path})=>{
            const r=await fetch(api+path,{credentials:'include',redirect:'error'}),body=await r.text();
            return {status:r.status,leak:body.includes('SYNTHETIC_PRIVATE_ID')||body.includes('SYNTHETIC_ACCOUNT')};
          },{api,path});
          demand(result?.status===status&&!result.leak,'BROWSER_AUTHORIZATION_OR_MASKING_MISMATCH');record(key,check);
        }
        // Verify actual populated count/request records through browser cookies.
        if(permissions.includes('inventory.material_request.view')){
          const ok=await evaluate(p,session,async({api,id,projectId})=>{
            const r=await fetch(api+'/inventory/material-requests/'+id,{credentials:'include',redirect:'error'});
            if(r.status!==200)return false;const v=(await r.json()).data;return v.id===id&&v.projectId===projectId;
          },{api,id:initial.requestId,projectId:fixture.projectId});
          demand(ok,'BROWSER_POPULATED_REQUEST_MISSING');record(key,'POPULATED_REQUEST_READ');
        }
        if(permissions.includes('inventory.stock_count.view')){
          const ok=await evaluate(p,session,async({api,id,projectId})=>{
            const r=await fetch(api+'/inventory/stock-counts/'+id,{credentials:'include',redirect:'error'});
            if(r.status!==200)return false;const v=(await r.json()).data;return v.id===id&&v.projectId===projectId&&v.status==='APPROVED';
          },{api,id:initial.stockCountId,projectId:fixture.projectId});
          demand(ok,'BROWSER_POPULATED_COUNT_MISSING');record(key,'POPULATED_COUNT_READ');
        }
        // Render the source-owned HR workspace using its actual server data.
        if(permissions.includes('hr.employment.view')){
          await evaluate(p,session,()=>{
            const item=[...document.querySelectorAll('nav [role="button"]')].find(b=>b.textContent==='Employees & HR');
            if(!item)return false;item.click();return true;
          });
          await until(p,session,()=>document.querySelector('main')?.textContent.includes('Employees')&&
            document.querySelector('main')?.textContent.includes('Synthetic FOREMAN'),null,'BROWSER_HR_SOURCE_ROWS_NOT_READY');
          record(key,'HR_WORKSPACE_ACTUAL_ROWS');
        }
        // Exercise the shell's three real locale selections, without asserting
        // that every module or all translated business journeys were covered.
        for(const [label,signOut] of [['ไทย','ออกจากระบบ'],['繁中','登出'],['EN','Sign out']]){
          const clicked=await evaluate(p,session,()=>{
            const select=document.querySelector('header [role="combobox"]');
            if(!select)return false;select.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;
          });demand(clicked,'BROWSER_LOCALE_CONTROL_MISSING');
          await until(p,session,label=>[...document.querySelectorAll('[role="option"]')].some(x=>x.textContent===label),label,'BROWSER_LOCALE_MENU_MISSING');
          await evaluate(p,session,label=>{[...document.querySelectorAll('[role="option"]')].find(x=>x.textContent===label).click();return true;},label);
          await until(p,session,signOut=>[...document.querySelectorAll('header button')].some(b=>b.textContent===signOut),signOut,'BROWSER_LOCALE_DID_NOT_RENDER');
        }
        record(key,'SHELL_EN_TH_ZH_TW');
        const leaked=await evaluate(p,session,()=>document.body.textContent.includes('SYNTHETIC_PRIVATE_ID')||document.body.textContent.includes('SYNTHETIC_ACCOUNT'));
        demand(!leaked,'BROWSER_PRIVATE_VALUE_RENDERED');record(key,'NO_PRIVATE_VALUES_RENDERED');
        await evaluate(p,session,()=>{[...document.querySelectorAll('header button')].find(b=>b.textContent==='Sign out').click();return true;});
        await until(p,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'BROWSER_UI_LOGOUT_NOT_READY');
        const revoked=await evaluate(p,session,async api=>(await fetch(api+'/auth/me',{credentials:'include',redirect:'error'})).status,api);
        demand(revoked===401,'BROWSER_LOGOUT_NOT_REVOKED');record(key,'UI_LOGOUT_REVOKED');
      }catch(e){e.safeCode='BROWSER_'+key+'_'+(e.safeCode??'READBACK_FAILED');primaryError=e;throw e;}
      finally{
        // A failed login/readback may still have established a server session.
        // Revoke it through the actual API before discarding the owned context.
        let cleanupError;
        if(session)try{
          const revoked=await evaluate(p,session,async api=>{
            const me=await fetch(api+'/auth/me',{credentials:'include',redirect:'error'});
            if(me.status===401)return true;if(me.status!==200)return false;
            const csrf=await fetch(api+'/auth/csrf',{credentials:'include',redirect:'error'});
            if(csrf.status!==200)return false;const value=await csrf.json();
            const r=await fetch(api+'/auth/logout',{method:'POST',credentials:'include',redirect:'error',
              headers:{'X-CSRF-Token':value.data.csrfToken}});
            return r.status===204&&(await fetch(api+'/auth/me',{credentials:'include',redirect:'error'})).status===401;
          },api);demand(revoked,'BROWSER_SESSION_CLEANUP_FAILED');
        }catch{cleanupError=Object.assign(new Error(),{safeCode:'BROWSER_SESSION_CLEANUP_FAILED'});}
        if(session)closingSessions.add(session);
        try{await p.send('Target.disposeBrowserContext',{browserContextId});contexts.delete(browserContextId);}
        catch{cleanupError??=Object.assign(new Error(),{safeCode:'BROWSER_CONTEXT_CLEANUP_FAILED'});}
        if(cleanupError){if(primaryError)primaryError.safeCode='BROWSER_SESSION_OR_CONTEXT_CLEANUP_FAILED';else throw cleanupError;}
      }
      demand(violations.length===0,'BROWSER_UNEXPECTED_NETWORK_OR_BUSINESS_WRITE');
    }
    return {observations,functionalActors:8,technicalAdminProbed:true,browserChecks:observations.length};
  }finally{
    for(const browserContextId of contexts)try{await p.send('Target.disposeBrowserContext',{browserContextId});}catch{}
    p.listeners.delete(intercept);
  }
}
