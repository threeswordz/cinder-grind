// #338: the missing real React/MUI write boundary on the retained API run.
// One reasoned request-note revision only; no stock, source, plan or receipt replay.
import {SOURCE} from './prototype-actors.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
export const UI_REASON='Synthetic deployed UI verification: retain signed handover and reversal history';
export const UI_NOTE='Synthetic handover retained; UI revision verified after canonical reversals';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function validMaterialUiBinding(b){
  return b?.sourceSha===SOURCE&&(
    b.api==='http://127.0.0.1:33071/api/v1'&&b.web==='http://127.0.0.1:44171'||
    process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&
    b.api==='http://127.0.0.1:31319/api/v1'&&b.web==='http://127.0.0.1:44319')&&
    ['companyId','projectId','warehouseId','requestId','documentId'].every(k=>uuid(b[k]))&&
    ['STORE_SITE','FOREMAN'].every(k=>{
      const a=b.actors?.[k];return a&&uuid(a.userId)&&a.email==='proto-'+k.toLowerCase()+'@example.invalid'&&
        /^[a-f0-9]{64}$/.test(a.password??'')&&a.expectedRoleCodes?.length===1&&a.expectedRoleCodes[0]==='PROTO_'+k&&
        Array.isArray(a.permissions)&&new Set(a.permissions).size===a.permissions.length;
    })&&b.actors.STORE_SITE.userId!==b.actors.FOREMAN.userId;
}
export function materialUiAllowedRequest(request,b,actor,original){
  try{
    const u=new URL(request.url),api=new URL(b.api),web=new URL(b.web);
    if(u.username||u.password||u.hash||u.protocol!=='http:'||/[\\%]/.test(request.url)||/(?:^|\/)\.{1,2}(?:\/|$|[?#])/.test(request.url))return false;
    if(u.origin===web.origin)return request.method==='GET'&&u.search===''&&
      (['/','/index.html','/vite.svg','/favicon.ico'].includes(u.pathname)||/^\/assets\/[A-Za-z0-9_.-]+$/.test(u.pathname));
    if(u.origin!==api.origin||!u.pathname.startsWith(api.pathname+'/'))return false;
    const path=u.pathname.slice(api.pathname.length),q=u.searchParams;
    if(request.method==='OPTIONS')return u.search===''&&(['/auth/login','/auth/logout'].includes(path)||
      path==='/inventory/material-requests/'+b.requestId+'/revisions'&&actor===b.actors.STORE_SITE&&Boolean(original));
    if(request.method==='GET'){
      if(['/auth/me','/auth/csrf','/projects','/procurement/projects','/documents/type-options',
        '/inventory/material-requests/projects','/inventory/material-requests/'+b.requestId,
        '/procurement/projects/'+b.projectId+'/purchase-requests'].includes(path))
        return u.search===''||(path==='/projects'&&u.search==='?active=true');
      if(path==='/inventory/material-requests')return u.search==='?projectId='+b.projectId;
      if(path==='/inventory/material-requests/choices')return q.get('projectId')===b.projectId&&
        ['warehouses','employees','materials','wbs','costCodes','activities'].includes(q.get('kind'))&&
        [...q.keys()].sort().join(',')==='kind,projectId';
      return false;
    }
    if(request.method!=='POST'||u.search!=='')return false;
    if(path==='/auth/logout')return true;
    const body=JSON.parse(request.postData??'null');
    if(path==='/auth/login')return body&&Object.keys(body).sort().join(',')==='email,password'&&
      body.email===actor.email&&body.password===actor.password;
    if(path!=='/inventory/material-requests/'+b.requestId+'/revisions'||actor!==b.actors.STORE_SITE||!original)return false;
    return body&&Object.keys(body).sort().join(',')==='expectedVersion,lines,reason,remarks,requestDate,requestKey'&&
      uuid(body.requestKey)&&body.expectedVersion===original.version&&body.reason===UI_REASON&&body.remarks===UI_NOTE&&
      body.requestDate===original.requestDate.slice(0,10)&&same(body.lines,original.lines.map(l=>({
        id:l.id,requestedQuantity:l.requestedQuantity,remarks:l.remarks})));
  }catch{return false;}
}
export function verifyMaterialUiRevision(before,after,b){
  demand(before?.id===b.requestId&&after?.id===before.id&&before.companyId===b.companyId&&after.companyId===b.companyId&&
    before.projectId===b.projectId&&after.projectId===b.projectId&&before.warehouseId===b.warehouseId&&
    after.warehouseId===b.warehouseId&&after.version===before.version+1&&after.remarks===UI_NOTE&&
    after.requestDate===before.requestDate&&after.requesterEmployeeId===before.requesterEmployeeId,
    'MATERIAL_UI_REVISION_SCOPE_OR_VERSION_CHANGED');
  demand(same(before.lines,after.lines)&&before.lines.length===1&&before.lines[0].issuedQuantity==='0.0000'&&
    before.lines[0].acknowledgedQuantity==='0.0000'&&before.lines[0].issueLinks.length===1&&
    before.lines[0].issueLinks[0].receipts.length===1&&
    before.lines[0].issueLinks[0].receipts[0].documentId===b.documentId&&
    after.revisions.length===before.revisions.length+1,'MATERIAL_UI_SIGNED_HISTORY_OR_QUANTITIES_CHANGED');
  const previous=new Map(before.revisions.map(r=>[r.id,r]));
  const added=after.revisions.filter(r=>!previous.has(r.id));
  demand(before.revisions.every(r=>same(r,after.revisions.find(x=>x.id===r.id)))&&added.length===1&&
    added[0].action==='REVISE'&&added[0].version===after.version&&added[0].reason===UI_REASON&&
    added[0].facts.remarks===UI_NOTE,'MATERIAL_UI_REVISION_HISTORY_CHANGED');
}
async function evaluate(p,session,fn,arg){
  const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',awaitPromise:true,returnByValue:true},session);
  demand(!r.exceptionDetails&&r.result?.type!=='error','MATERIAL_UI_PAGE_EVALUATION_FAILED');return r.result.value;
}
async function until(p,s,fn,arg,code){
  const until=Date.now()+20000;
  while(Date.now()<until){if(await evaluate(p,s,fn,arg))return;await new Promise(r=>setTimeout(r,200));}
  demand(false,code);
}
async function readRequest(p,s,b){
  return evaluate(p,s,async({api,id})=>{
    const r=await fetch(api+'/inventory/material-requests/'+id,{credentials:'include',redirect:'error'});
    return r.status===200?(await r.json()).data:null;
  },{api:b.api,id:b.requestId});
}
export async function materialUiRevision(protocol,binding){
  const b=structuredClone(binding);demand(validMaterialUiBinding(b),'MATERIAL_UI_BINDING_INVALID');
  const p=protocol,observations=[],violations=[],contexts=new Set(),sessions=new Map();let before,after;
  const intercept=event=>{
    if(event.method!=='Fetch.requestPaused')return;
    const actor=sessions.get(event.sessionId),{requestId,request}=event.params;
    const allowed=actor&&materialUiAllowedRequest(request,b,actor,before);
    if(!allowed)violations.push('MATERIAL_UI_REQUEST_REFUSED');
    p.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId}:{requestId,errorReason:'BlockedByClient'},event.sessionId)
      .catch(()=>violations.push('MATERIAL_UI_INTERCEPTION_FAILED'));
  };
  p.listeners.add(intercept);
  try{
    for(const key of ['STORE_SITE','FOREMAN']){
      const actor=b.actors[key],{browserContextId}=await p.send('Target.createBrowserContext');contexts.add(browserContextId);
      let session,primary;
      try{
        const {targetId}=await p.send('Target.createTarget',{url:'about:blank',browserContextId});
        session=(await p.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;sessions.set(session,actor);
        for(const method of ['Page.enable','Runtime.enable'])await p.send(method,{},session);
        await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},session);
        await p.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},session);
        await p.send('Page.navigate',{url:b.web},session);
        await until(p,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'MATERIAL_UI_LOGIN_FORM_MISSING');
        await evaluate(p,session,a=>{
          for(const [type,value] of [['email',a.email],['password',a.password]]){
            const el=document.querySelector('input[type="'+type+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);
            el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
          }
          document.querySelector('form').requestSubmit();return true;
        },{email:actor.email,password:actor.password});
        await until(p,session,()=>Boolean(document.querySelector('nav')),null,'MATERIAL_UI_LOGIN_FAILED');
        const identity=await evaluate(p,session,async({api,a,c})=>{
          const r=await fetch(api+'/auth/me',{credentials:'include',redirect:'error'});if(r.status!==200)return false;
          const me=(await r.json()).data;return me.id===a.userId&&me.companyId===c&&
            JSON.stringify([...me.roleCodes].sort())===JSON.stringify([...a.expectedRoleCodes].sort())&&
            JSON.stringify([...me.permissions].sort())===JSON.stringify([...a.permissions].sort());
        },{api:b.api,a:{userId:actor.userId,expectedRoleCodes:actor.expectedRoleCodes,permissions:actor.permissions},c:b.companyId});
        demand(identity,'MATERIAL_UI_IDENTITY_CHANGED');
        demand(await evaluate(p,session,()=>{
          const el=[...document.querySelectorAll('nav [role="button"]')].find(e=>e.textContent==='Inventory');
          if(!el)return false;el.click();return true;
        }),'MATERIAL_UI_INVENTORY_NAVIGATION_MISSING');
        await until(p,session,()=>[...document.querySelectorAll('main label')].some(e=>e.textContent==='Project'),null,'MATERIAL_UI_REQUEST_WORKSPACE_MISSING');
        await evaluate(p,session,()=>{
          const label=[...document.querySelectorAll('main label')].find(e=>e.textContent==='Project');
          document.getElementById(label.htmlFor).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;
        });
        await until(p,session,()=>[...document.querySelectorAll('[role="option"]')].some(e=>e.getAttribute('data-value')),null,'MATERIAL_UI_PROJECT_OPTIONS_MISSING');
        demand(await evaluate(p,session,id=>{
          const el=[...document.querySelectorAll('[role="option"]')].find(e=>e.getAttribute('data-value')===id);
          if(!el)return false;el.click();return true;
        },b.projectId),'MATERIAL_UI_ASSIGNED_PROJECT_MISSING');
        await until(p,session,id=>[...document.querySelectorAll('main button')].some(e=>e.textContent.startsWith('Open request:')&&e.textContent.endsWith(id.slice(0,8))),b.requestId,'MATERIAL_UI_RETAINED_REQUEST_MISSING');
        await evaluate(p,session,id=>{[...document.querySelectorAll('main button')].find(e=>e.textContent.startsWith('Open request:')&&e.textContent.endsWith(id.slice(0,8))).click();return true;},b.requestId);
        await until(p,session,()=>document.querySelector('main')?.textContent.includes('Issue reversed / not currently issued'),null,'MATERIAL_UI_SIGNED_REVERSED_HISTORY_MISSING');
        if(key==='STORE_SITE'){
          before=await readRequest(p,session,b);
          demand(before?.id===b.requestId&&before.companyId===b.companyId&&before.projectId===b.projectId&&
            before.warehouseId===b.warehouseId&&before.remarks!==UI_NOTE,'MATERIAL_UI_REQUEST_SCOPE_OR_PRIOR_RUN');
          demand(await evaluate(p,session,()=>{const el=[...document.querySelectorAll('main button')].find(e=>e.textContent==='Revise request');if(!el||el.disabled)return false;el.click();return true;}),'MATERIAL_UI_EDIT_ACTION_MISSING');
          await until(p,session,()=>[...document.querySelectorAll('main label')].some(e=>e.textContent==='Reason'),null,'MATERIAL_UI_REVISION_FORM_MISSING');
          for(const [label,value] of [['Note',UI_NOTE],['Reason',UI_REASON]])await evaluate(p,session,({label,value})=>{
            const fields=[...document.querySelectorAll('main label')].filter(e=>e.textContent===label),l=fields.at(-1),el=document.getElementById(l.htmlFor);
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);
            el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;
          },{label,value});
          await until(p,session,()=>[...document.querySelectorAll('main button')].some(e=>e.textContent==='Save revision'&&!e.disabled),null,'MATERIAL_UI_REVISION_NOT_READY');
          await evaluate(p,session,()=>{[...document.querySelectorAll('main button')].find(e=>e.textContent==='Save revision').click();return true;});
          await until(p,session,reason=>document.querySelector('main')?.textContent.includes(reason),UI_REASON,'MATERIAL_UI_REVISION_NOT_OBSERVED');
          after=await readRequest(p,session,b);verifyMaterialUiRevision(before,after,b);
          observations.push({actor:key,check:'ACTUAL_REACT_REQUEST_REVISION_RETAINED_SIGNED_HISTORY',passed:true});
        }else{
          const observed=await readRequest(p,session,b);demand(same(observed,after),'MATERIAL_UI_FOREMAN_READBACK_CHANGED');
          demand(await evaluate(p,session,reason=>document.querySelector('main')?.textContent.includes(reason)&&
            ![...document.querySelectorAll('main button')].some(e=>e.textContent==='Revise request'),UI_REASON),'MATERIAL_UI_FOREMAN_EDIT_EXPOSED');
          observations.push({actor:key,check:'REVISED_REQUEST_VISIBLE_WITHOUT_EDIT_RIGHT',passed:true});
        }
      }catch(e){primary=e;throw e;}
      finally{
        try{if(session){
          const revoked=await evaluate(p,session,async api=>{
            const me=await fetch(api+'/auth/me',{credentials:'include',redirect:'error'});if(me.status===401)return true;
            if(me.status!==200)return false;const csrf=await fetch(api+'/auth/csrf',{credentials:'include',redirect:'error'});
            if(csrf.status!==200)return false;const token=(await csrf.json()).data.csrfToken;
            const r=await fetch(api+'/auth/logout',{method:'POST',credentials:'include',redirect:'error',headers:{'X-CSRF-Token':token}});
            return r.status===204&&(await fetch(api+'/auth/me',{credentials:'include',redirect:'error'})).status===401;
          },b.api);demand(revoked,'MATERIAL_UI_SESSION_REVOCATION_FAILED');
        }}catch{if(primary)primary.safeCode='MATERIAL_UI_SESSION_REVOCATION_FAILED';else throw Object.assign(new Error(),{safeCode:'MATERIAL_UI_SESSION_REVOCATION_FAILED'});}
        finally{await p.send('Target.disposeBrowserContext',{browserContextId});contexts.delete(browserContextId);if(session)sessions.delete(session);}
      }
      demand(violations.length===0,'MATERIAL_UI_UNDECLARED_REQUEST');
    }
    return {status:'MATERIAL_RETAINED_REQUEST_UI_REVISION_VERIFIED',observations,requestId:b.requestId,
      priorVersion:before.version,version:after.version,signedHistoryPreserved:true,uiSessionsRevoked:true,
      materialRequestUiRevisionVerified:true,fullAuthenticatedBrowserJourneysVerified:false,
      populatedRecoveryVerified:false,prototypeFrozen:false,humanUatCompleted:false,productionAuthorized:false,secretsPrinted:false};
  }finally{
    for(const browserContextId of contexts)try{await p.send('Target.disposeBrowserContext',{browserContextId});}catch{}
    p.listeners.delete(intercept);
  }
}
