// Disposable actual React physical source journey; never a retained/Mac operator.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
async function evaluate(p,s,fn,arg){
  const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',awaitPromise:true,returnByValue:true},s);
  demand(!r.exceptionDetails&&r.result?.type!=='error','PHYSICAL_BROWSER_EVALUATION_FAILED');return r.result?.value;
}
async function until(p,s,fn,arg,code){
  const end=Date.now()+20000;
  while(Date.now()<end){if(await evaluate(p,s,fn,arg))return;await new Promise(r=>setTimeout(r,100));}
  demand(false,code);
}
async function click(p,s,label,selector='main button'){
  await until(p,s,({label,selector})=>[...document.querySelectorAll(selector)].some(e=>e.textContent===label&&!e.disabled),{label,selector},'PHYSICAL_BROWSER_ACTION_UNAVAILABLE');
  demand(await evaluate(p,s,({label,selector})=>{const e=[...document.querySelectorAll(selector)].find(e=>e.textContent===label&&!e.disabled);if(!e)return false;e.click();return true;},{label,selector}),'PHYSICAL_BROWSER_ACTION_UNAVAILABLE');
}
async function field(p,s,label,value,scope='main'){
  await until(p,s,({label,scope})=>[...document.querySelectorAll(scope+' label')].some(e=>e.textContent===label),{label,scope},'PHYSICAL_BROWSER_FIELD_UNAVAILABLE');
  await evaluate(p,s,({label,value,scope})=>{
    const l=[...document.querySelectorAll(scope+' label')].find(e=>e.textContent===label),e=document.getElementById(l.htmlFor);
    const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);
    e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;
  },{label,value,scope});
}
async function select(p,s,label,value,scope='main'){
  await until(p,s,({label,scope})=>[...document.querySelectorAll(scope+' label')].some(e=>{const input=document.getElementById(e.htmlFor);return e.textContent===label&&input&&!input.disabled&&input.getAttribute('aria-disabled')!=='true';}),{label,scope},'PHYSICAL_BROWSER_SELECT_UNAVAILABLE');
  await evaluate(p,s,({label,scope})=>{const l=[...document.querySelectorAll(scope+' label')].find(e=>e.textContent===label);document.getElementById(l.htmlFor).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;},{label,scope});
  await until(p,s,value=>[...document.querySelectorAll('[role="option"]')].some(e=>e.getAttribute('data-value')===value),value,'PHYSICAL_BROWSER_OPTION_UNAVAILABLE');
  await evaluate(p,s,value=>{[...document.querySelectorAll('[role="option"]')].find(e=>e.getAttribute('data-value')===value).click();return true;},value);
}
// Valid one-page synthetic evidence; never a real person's signature.
function syntheticPdf(label){
 const stream='BT /F1 12 Tf 30 150 Td (Synthetic physical acceptance '+label+') Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 480 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  '<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,object]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+object+'\nendobj\n';}
 const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';return Buffer.from(pdf);
}
export async function executePhysicalBrowser(protocol,binding,db){
 const {api:API,web:WEB,fixture:f,downloadRoot}=structuredClone(binding);
 demand(process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&API==='http://127.0.0.1:31349/api/v1'&&WEB==='http://127.0.0.1:44349','PHYSICAL_BROWSER_ORIGINS_REFUSED');
 demand(/^\/tmp\/erp-physical-browser-[^/]+\/downloads$/.test(downloadRoot??''),'PHYSICAL_DOWNLOAD_ROOT_REFUSED');
 demand(await db.subcontractPhysicalRevision.count({where:{claimId:f.claim.id}})===0,'PHYSICAL_BROWSER_NO_REPLAY');
 const financialBefore={stock:await db.stockTransaction.findMany({where:{companyId:f.company.id}}),payments:await db.payment.findMany({where:{companyId:f.company.id}})};
 let context,session,phase='START',documentId,certificationId,downloadGuid,downloadComplete=false;let droppedCapture=false,droppedDecision=false;const closing=new Set(),violations=[];
 const claim='/api/v1/subcontracts/claims/'+f.claim.id,physical='/api/v1/subcontracts/physical/claims/'+f.claim.id;
 const intercept=event=>{
  if(event.method==='Browser.downloadWillBegin')downloadGuid=event.params.guid;
  if(event.method==='Browser.downloadProgress'&&event.params.guid===downloadGuid&&event.params.state==='completed')downloadComplete=true;
  if(event.method!=='Fetch.requestPaused')return;
  const r=event.params.request;let allowed=false;
  if(event.params.responseStatusCode!==undefined){
   const capture=new URL(r.url).pathname===physical+'/capture',decision=new URL(r.url).pathname===physical+'/decide';
   if(event.params.responseStatusCode===201&&(capture&&!droppedCapture||decision&&!droppedDecision)){
    if(capture)droppedCapture=true;else droppedDecision=true;
    protocol.send('Fetch.failRequest',{requestId:event.params.requestId,errorReason:'Failed'},event.sessionId).catch(()=>violations.push('PHYSICAL_RESPONSE_DROP_FAILED'));
   }else protocol.send('Fetch.continueRequest',{requestId:event.params.requestId},event.sessionId).catch(()=>violations.push('PHYSICAL_RESPONSE_CONTINUE_FAILED'));
   return;
  }

  try{const u=new URL(r.url);allowed=u.origin===WEB&&r.method==='GET'||u.origin===new URL(API).origin&&(
   ['GET','OPTIONS'].includes(r.method)||r.method==='POST'&&(
    ['/api/v1/auth/login','/api/v1/auth/logout',physical+'/capture',physical+'/decide',claim+'/submit',claim+'/certifications',
     '/api/v1/documents/projects/'+f.project.id+'/targets/SUBCONTRACT_CLAIM/'+f.claim.id].includes(u.pathname)||
    certificationId&&['/api/v1/subcontracts/certifications/'+certificationId+'/submit','/api/v1/subcontracts/certifications/'+certificationId+'/approve'].includes(u.pathname)));
  }catch{}
  if(!allowed)violations.push('PHYSICAL_UNDECLARED_BROWSER_WRITE');
  protocol.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:event.params.requestId}:{requestId:event.params.requestId,errorReason:'BlockedByClient'},event.sessionId).catch(()=>{if(!closing.has(event.sessionId))violations.push('PHYSICAL_INTERCEPTION_FAILED');});
 };
 protocol.listeners.add(intercept);
 try{
    async function actor(key,work){
      phase=key.toUpperCase()+'_LOGIN';const a=f.actors[key];
      context=(await protocol.send('Target.createBrowserContext')).browserContextId;
      let primary,primaryPhase;
      try{
        const target=(await protocol.send('Target.createTarget',{url:'about:blank',browserContextId:context})).targetId;
        session=(await protocol.send('Target.attachToTarget',{targetId:target,flatten:true})).sessionId;
        for(const method of ['Page.enable','Runtime.enable'])await protocol.send(method,{},session);
        await protocol.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false},session);
        await protocol.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'},{urlPattern:'*'+physical+'/capture',requestStage:'Response'},{urlPattern:'*'+physical+'/decide',requestStage:'Response'}]},session);
        await protocol.send('Page.navigate',{url:WEB},session);
        await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'PHYSICAL_BROWSER_LOGIN_FORM_MISSING');
        await evaluate(protocol,session,a=>{
          for(const [type,value]of[['email',a.email],['password',a.password]]){
            const e=document.querySelector('input[type="'+type+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);
            e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
          }document.querySelector('form').requestSubmit();return true;
        },{email:a.email,password:a.password});
        await until(protocol,session,()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')),null,'PHYSICAL_BROWSER_LOGIN_FAILED');
        demand(await evaluate(protocol,session,async({api,id,companyId})=>{
          const r=await fetch(api+'/auth/me',{credentials:'include'});const v=await r.json();
          return r.status===200&&v.data.id===id&&v.data.companyId===companyId;
        },{api:API,id:a.userId,companyId:f.company.id}),'PHYSICAL_BROWSER_WRONG_ACTOR');
        phase=key.toUpperCase()+'_WORKFLOW';await work(protocol,session);
      }catch(e){primary=e;primaryPhase=phase;}
      try{
        phase=key.toUpperCase()+'_LOGOUT';
        const cookies=(await protocol.send('Storage.getCookies',{browserContextId:context})).cookies;
        const cookie=cookies.find(c=>c.name==='erp_session'&&c.domain==='127.0.0.1');
        demand(cookie&&typeof cookie.value==='string'&&cookie.value.length>0,'PHYSICAL_BROWSER_SESSION_COOKIE_MISSING');
        await click(protocol,session,'Sign out','header button');
        await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'PHYSICAL_BROWSER_LOGOUT_FAILED');
        demand(await evaluate(protocol,session,async api=>(await fetch(api+'/auth/me',{credentials:'include'})).status===401,API),'PHYSICAL_BROWSER_SESSION_NOT_REVOKED');
        const stale=await fetch(API+'/auth/me',{headers:{Cookie:'erp_session='+cookie.value},redirect:'error',signal:AbortSignal.timeout(10000)});
        const status=stale.status;await stale.body?.cancel();demand(status===401,'PHYSICAL_BROWSER_REVOKED_COOKIE_ACCEPTED');
      }catch(e){if(!primary){primary=e;primaryPhase=phase;}}finally{
        if(session)closing.add(session);
        try{await protocol.send('Target.disposeBrowserContext',{browserContextId:context});}catch(e){primary??=e;}
        context=undefined;session=undefined;
      }
      if(primary){phase=primaryPhase??phase;throw primary;}
    }

 async function workspace(p,s){
  await until(p,s,()=>[...document.querySelectorAll('nav [role="button"]')].some(e=>e.textContent==='Subcontracts'),null,'PHYSICAL_NAV_MISSING');
  await evaluate(p,s,()=>{[...document.querySelectorAll('nav [role="button"]')].find(e=>e.textContent==='Subcontracts').click();return true;});
  await click(p,s,'Claims','[role="tablist"] button');
  await select(p,s,'Agreement (active or history)',f.agreement.id);
  await until(p,s,n=>[...document.querySelectorAll('main .MuiChip-clickable')].some(e=>e.textContent.startsWith(n)),f.claim.number,'PHYSICAL_CLAIM_MISSING');
  await evaluate(p,s,n=>{[...document.querySelectorAll('main .MuiChip-clickable')].find(e=>e.textContent.startsWith(n)).click();return true;},f.claim.number);
  await until(p,s,()=>Boolean(document.querySelector('[data-testid="physical-acceptance"]')),null,'PHYSICAL_PANEL_MISSING');
 }
 await actor('maker',async(p,s)=>{
  await workspace(p,s);
  for(const [label,title]of [['ไทย','ผลงานจริงและการตรวจรับ'],['繁中','實際工程與驗收'],['EN','Physical work and acceptance']]){
   await click(p,s,label,'header button');
   await until(p,s,title=>document.querySelector('[data-testid="physical-acceptance"]')?.textContent.includes(title),title,'PHYSICAL_LOCALE_MISSING');
  }
  await protocol.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},s);
  demand(await evaluate(p,s,()=>{const el=document.querySelector('[data-testid="physical-acceptance"]');return el.getBoundingClientRect().right<=innerWidth+2&&el.scrollWidth<=el.clientWidth+2;}),'PHYSICAL_MOBILE_OVERFLOW');
  await select(p,s,'Evidence type',f.documentType.id,'[data-testid="physical-evidence"]');
  const bytes=syntheticPdf('work-evidence');
  await evaluate(p,s,base64=>{const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],'physical-ui.pdf',{type:'application/pdf'}));const input=document.querySelector('[data-testid="physical-evidence"] input[type="file"]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;},bytes.toString('base64'));
  await click(p,s,'Upload work evidence','[data-testid="physical-evidence"] button');
  await until(p,s,()=>[...document.querySelectorAll('[data-testid="physical-evidence"] button')].some(e=>e.textContent.includes('physical-ui.pdf')),null,'PHYSICAL_UPLOAD_NOT_LINKED');
  documentId=(await db.document.findFirstOrThrow({where:{companyId:f.company.id,fileName:'physical-ui.pdf'}})).id;
  const scope='[data-testid="physical-observation"]';
  await field(p,s,'Work item','Installed work',scope);await field(p,s,'Area / location','Area A',scope);
  await field(p,s,'Submitted quantity','10',scope);await select(p,s,'Unit of measure',f.uom.id,scope);
  await field(p,s,'Observed progress (%)','80',scope);await field(p,s,'Reason / observation','Ten actual measured units',scope);
  await select(p,s,'Supporting evidence',documentId,scope);
  await protocol.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'},s);await protocol.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'},s);
  await field(p,s,'Capture / revision reason','Authenticated browser physical source','[data-testid="physical-capture"]');
  await click(p,s,'Save physical observations','[data-testid="physical-capture"] button');
  await until(p,s,()=>document.querySelector('[data-testid="physical-capture"]')?.textContent.includes('The result is uncertain'),null,'PHYSICAL_CAPTURE_UNCERTAIN_STATE_MISSING');
  assert.equal(await db.subcontractPhysicalRevision.count({where:{claimId:f.claim.id}}),1);
  await click(p,s,'Retry same request','[data-testid="physical-capture"] button');
  await until(p,s,()=>[...document.querySelectorAll('main button')].some(e=>e.textContent==='Submit Claim'&&!e.disabled),null,'PHYSICAL_CAPTURE_REPLAY_NOT_RECOVERED');
  assert.equal(await db.subcontractPhysicalRevision.count({where:{claimId:f.claim.id}}),1);
  await click(p,s,'Submit Claim');
  await until(p,s,()=>document.querySelector('[data-testid="physical-acceptance"]')?.textContent.includes('Submitted'),null,'PHYSICAL_NOT_SUBMITTED');
  demand(!await evaluate(p,s,()=>Boolean(document.querySelector('[data-testid="physical-decision"]'))),'PHYSICAL_MAKER_CAN_DECIDE');
 });
 await actor('ben',async(p,s)=>{
  await workspace(p,s);
  await field(p,s,'Accepted quantity','8','[data-testid="physical-decision"]');
  await select(p,s,'Held-work decision','REWORK','[data-testid="physical-decision"]');
  await field(p,s,'Explicit amount for accepted work · THB','731.25','[data-testid="physical-decision"]');
  await field(p,s,'Reason / observation','Two units remain held for rework','[data-testid="physical-decision"]');
  await field(p,s,'Independent decision reason','Independent eight accepted; explicit amount','[data-testid="physical-decision"]');
  await click(p,s,'Confirm physical acceptance and assessed amount','[data-testid="physical-decision"] button');
  await until(p,s,()=>document.querySelector('[data-testid="physical-decision"]')?.textContent.includes('The result is uncertain'),null,'PHYSICAL_DECISION_UNCERTAIN_STATE_MISSING');
  assert.equal(await db.subcontractPhysicalDecision.count({where:{claimId:f.claim.id}}),1);
  await click(p,s,'Retry same request','[data-testid="physical-decision"] button');
  await until(p,s,()=>!document.querySelector('[data-testid="physical-decision"]')&&document.querySelector('[data-testid="physical-acceptance"]')?.textContent.includes('731.25'),null,'PHYSICAL_DECISION_REPLAY_NOT_RECOVERED');
  const saved=await db.subcontractPhysicalDecision.findUniqueOrThrow({where:{claimId:f.claim.id}});
  assert.equal(saved.assessedAmount.toFixed(2),'731.25');assert.equal(saved.decisions[0].heldQuantity,'2.0000');
  await protocol.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloadRoot,browserContextId:context,eventsEnabled:true});
  await click(p,s,'Download evidence · physical-ui.pdf','[data-testid="physical-evidence"] button');
  const deadline=Date.now()+20000;
  while(!downloadComplete&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
  demand(downloadComplete&&/^[a-f0-9-]+$/.test(downloadGuid??''),'PHYSICAL_UI_DOWNLOAD_NOT_COMPLETED');
  const downloaded=await readFile(join(downloadRoot,downloadGuid)),document=await db.document.findUniqueOrThrow({where:{id:documentId}});
  assert.equal(createHash('sha256').update(downloaded).digest('hex'),document.checksum);assert.equal(downloaded.length,document.fileSizeBytes);
  demand(await evaluate(p,s,async({api,project,claim,document})=>{
   for(const suffix of ['/'+document+'/download','/targets/SUBCONTRACT_CLAIM/'+claim+'/'+document+'/download']){
    const r=await fetch(api+'/documents/projects/'+project+suffix,{credentials:'include'});if(r.status!==200)return false;await r.body.cancel();
   }return true;
  },{api:API,project:f.project.id,claim:f.claim.id,document:documentId}),'PHYSICAL_DOCUMENT_ALIAS_FAILED');
 });
 await actor('porn',async(p,s)=>{
  await workspace(p,s);
  demand(!await evaluate(p,s,()=>Boolean(document.querySelector('[data-testid="physical-decision"]'))),'PHYSICAL_PORN_CAN_DECIDE');
  await field(p,s,'Certified gross','731.25');await click(p,s,'Create Certification Draft');
  await until(p,s,()=>[...document.querySelectorAll('main button')].some(e=>e.textContent==='Submit Certification'),null,'PHYSICAL_CERTIFICATION_NOT_CREATED');
  certificationId=(await db.subcontractCertification.findFirstOrThrow({where:{claimId:f.claim.id,state:'DRAFT'}})).id;
  await select(p,s,'Certification approval workflow',f.workflowCode);await click(p,s,'Submit Certification');
  await until(p,s,()=>![...document.querySelectorAll('main button')].some(e=>e.textContent==='Submit Certification'),null,'PHYSICAL_CERTIFICATION_NOT_SUBMITTED');
 });
 await actor('nancy',async(p,s)=>{
  await workspace(p,s);await field(p,s,'Approval comment (optional)','Independent financial approval');await click(p,s,'Approve Certification');
  await until(p,s,()=>document.querySelector('main')?.textContent.includes('36.56'),null,'PHYSICAL_RETENTION_NOT_APPROVED');
 });
 for(const key of ['outsider','technical'])await actor(key,async(p,s)=>{
  demand(await evaluate(p,s,async({api,claim,project,document})=>{
   for(const path of ['/subcontracts/physical/claims/'+claim,'/documents/projects/'+project+'/targets/SUBCONTRACT_CLAIM/'+claim+'/'+document+'/download','/documents/projects/'+project+'/'+document+'/download']){
    const r=await fetch(api+path,{credentials:'include'});if(![403,404].includes(r.status))return false;await r.body.cancel();
   }return true;
  },{api:API,claim:f.claim.id,project:f.project.id,document:documentId}),'PHYSICAL_WRONG_ACTOR_EXPOSED');
 });
 const certification=await db.subcontractCertification.findUniqueOrThrow({where:{id:certificationId}});
 assert.equal(certification.state,'APPROVED');assert.equal(certification.certifiedGross.toFixed(2),'731.25');assert.equal(certification.retainedAmount.toFixed(2),'36.56');
 assert.deepEqual(await db.stockTransaction.findMany({where:{companyId:f.company.id}}),financialBefore.stock);
 assert.deepEqual(await db.payment.findMany({where:{companyId:f.company.id}}),financialBefore.payments);
 assert.equal(await db.subcontractClaimAssessment.count({where:{claimId:f.claim.id}}),1);
 assert.equal(await db.userSession.count({where:{userId:{in:Object.values(f.actors).map(a=>a.userId)},revokedAt:null}}),0);
 demand(droppedCapture&&droppedDecision,'PHYSICAL_UNCERTAIN_RESPONSE_NOT_EXERCISED');demand(violations.length===0,'PHYSICAL_UNDECLARED_BROWSER_WRITE');
 return {status:'PHYSICAL_BROWSER_NATIVE_PASS',sessionsRevoked:true};
 }catch(e){throw Object.assign(new Error(),{safeCode:'PHYSICAL_'+phase+'_'+(/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'ASSERTION_FAILED')});}
 finally{protocol.listeners.delete(intercept);if(context)await protocol.send('Target.disposeBrowserContext',{browserContextId:context}).catch(()=>{});}
}
