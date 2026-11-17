// Shared real React journey: guarded populated Mac operator or unique Linux CI target.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
async function evaluate(p,s,fn,arg){
  const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',awaitPromise:true,returnByValue:true},s);
  demand(!r.exceptionDetails&&r.result?.type!=='error','TRANSFER_BROWSER_EVALUATION_FAILED');return r.result?.value;
}
async function until(p,s,fn,arg,code){
  const end=Date.now()+20000;
  while(Date.now()<end){if(await evaluate(p,s,fn,arg))return;await new Promise(r=>setTimeout(r,100));}
  demand(false,code);
}
async function click(p,s,label,selector='[data-testid="transfer-receipts"] button'){
  await until(p,s,({label,selector})=>[...document.querySelectorAll(selector)].some(e=>e.textContent===label&&!e.disabled),{label,selector},'TRANSFER_BROWSER_ACTION_UNAVAILABLE');
  demand(await evaluate(p,s,({label,selector})=>{const e=[...document.querySelectorAll(selector)].find(e=>e.textContent===label&&!e.disabled);if(!e)return false;e.click();return true;},{label,selector}),'TRANSFER_BROWSER_ACTION_UNAVAILABLE');
}
async function field(p,s,label,value,scope='[data-testid="transfer-destination-detail"]'){
  await until(p,s,({label,scope})=>[...document.querySelectorAll(scope+' label')].some(e=>e.textContent===label),{label,scope},'TRANSFER_BROWSER_FIELD_UNAVAILABLE');
  await evaluate(p,s,({label,value,scope})=>{
    const l=[...document.querySelectorAll(scope+' label')].find(e=>e.textContent===label),e=document.getElementById(l.htmlFor);
    const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);
    e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;
  },{label,value,scope});
}
async function select(p,s,label,value,scope='[data-testid="transfer-receipts"]'){
  await until(p,s,({label,scope})=>[...document.querySelectorAll(scope+' label')].some(e=>{const input=document.getElementById(e.htmlFor);return e.textContent===label&&input&&!input.disabled&&input.getAttribute('aria-disabled')!=='true';}),{label,scope},'TRANSFER_BROWSER_SELECT_UNAVAILABLE');
  await evaluate(p,s,({label,scope})=>{const l=[...document.querySelectorAll(scope+' label')].find(e=>e.textContent===label);document.getElementById(l.htmlFor).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;},{label,scope});
  await until(p,s,value=>[...document.querySelectorAll('[role="option"]')].some(e=>e.getAttribute('data-value')===value),value,'TRANSFER_BROWSER_OPTION_UNAVAILABLE');
  await evaluate(p,s,value=>{[...document.querySelectorAll('[role="option"]')].find(e=>e.getAttribute('data-value')===value).click();return true;},value);
}
// Valid one-page synthetic evidence; never a real person's signature.
function syntheticPdf(label){
 const stream='BT /F1 12 Tf 30 150 Td (Synthetic receiving '+label+') Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 480 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  '<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,object]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+object+'\nendobj\n';}
 const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';return Buffer.from(pdf);
}
export async function executeTransferBrowser(protocol,binding,db){
 const {api:API,web:WEB,fixture:f}=structuredClone(binding);
 demand(process.platform==='darwin'&&API==='http://127.0.0.1:33071/api/v1'&&WEB==='http://127.0.0.1:44171'||
  process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&[
   ['http://127.0.0.1:31339/api/v1','http://127.0.0.1:44339'],
   ['http://127.0.0.1:31319/api/v1','http://127.0.0.1:44319']].some(([a,w])=>a===API&&w===WEB),'TRANSFER_BROWSER_ORIGINS_REFUSED');
 const before=await db.stockTransaction.findMany({where:{companyId:f.company.id}});
 demand(await db.transferDispatch.count({where:{transferId:f.id}})===0,'TRANSFER_BROWSER_NO_REPLAY');
 let context,session,phase='START',receiptId,documentId;const closing=new Set(),violations=[];
 const root='/api/v1/inventory/transfer-custody',destination=root+'/projects/'+f.destination.id+'/transfers/'+f.id;
 const intercept=event=>{
  if(event.method!=='Fetch.requestPaused')return;
  const r=event.params.request;let allowed=false;
  try{const u=new URL(r.url);allowed=u.origin===WEB&&r.method==='GET'||u.origin===new URL(API).origin&&(
   ['GET','OPTIONS'].includes(r.method)||r.method==='POST'&&(
   ['/api/v1/auth/login','/api/v1/auth/logout',root+'/transfers/'+f.id+'/dispatch',destination+'/receipts'].includes(u.pathname)||
   receiptId&&[destination+'/receipts/'+receiptId+'/receive','/api/v1/documents/projects/'+f.destination.id+'/targets/TRANSFER_RECEIPT/'+receiptId].includes(u.pathname)));
  }catch{}
  if(!allowed)violations.push('TRANSFER_UNDECLARED_BROWSER_WRITE');
  protocol.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:event.params.requestId}:{requestId:event.params.requestId,errorReason:'BlockedByClient'},event.sessionId).catch(()=>{if(!closing.has(event.sessionId))violations.push('TRANSFER_INTERCEPTION_FAILED');});
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
        await protocol.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},session);
        await protocol.send('Page.navigate',{url:WEB},session);
        await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'TRANSFER_BROWSER_LOGIN_FORM_MISSING');
        await evaluate(protocol,session,a=>{
          for(const [type,value]of[['email',a.email],['password',a.password]]){
            const e=document.querySelector('input[type="'+type+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);
            e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
          }document.querySelector('form').requestSubmit();return true;
        },{email:a.email,password:a.password});
        await until(protocol,session,()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')),null,'TRANSFER_BROWSER_LOGIN_FAILED');
        demand(await evaluate(protocol,session,async({api,id,companyId})=>{
          const r=await fetch(api+'/auth/me',{credentials:'include'});const v=await r.json();
          return r.status===200&&v.data.id===id&&v.data.companyId===companyId;
        },{api:API,id:a.userId,companyId:f.company.id}),'TRANSFER_BROWSER_WRONG_ACTOR');
        phase=key.toUpperCase()+'_WORKFLOW';await work(protocol,session);
      }catch(e){primary=e;primaryPhase=phase;}
      try{
        phase=key.toUpperCase()+'_LOGOUT';
        const cookies=(await protocol.send('Storage.getCookies',{browserContextId:context})).cookies;
        const cookie=cookies.find(c=>c.name==='erp_session'&&c.domain==='127.0.0.1');
        demand(cookie&&typeof cookie.value==='string'&&cookie.value.length>0,'TRANSFER_BROWSER_SESSION_COOKIE_MISSING');
        await click(protocol,session,'Sign out','header button');
        await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'TRANSFER_BROWSER_LOGOUT_FAILED');
        demand(await evaluate(protocol,session,async api=>(await fetch(api+'/auth/me',{credentials:'include'})).status===401,API),'TRANSFER_BROWSER_SESSION_NOT_REVOKED');
        const stale=await fetch(API+'/auth/me',{headers:{Cookie:'erp_session='+cookie.value},redirect:'error',signal:AbortSignal.timeout(10000)});
        const status=stale.status;await stale.body?.cancel();demand(status===401,'TRANSFER_BROWSER_REVOKED_COOKIE_ACCEPTED');
      }catch(e){if(!primary){primary=e;primaryPhase=phase;}}finally{
        if(session)closing.add(session);
        try{await protocol.send('Target.disposeBrowserContext',{browserContextId:context});}catch(e){primary??=e;}
        context=undefined;session=undefined;
      }
      if(primary){phase=primaryPhase??phase;throw primary;}
    }

 async function workspace(p,s){
  await until(p,s,()=>[...document.querySelectorAll('nav [role="button"]')].some(e=>e.textContent==='Inventory'),null,'TRANSFER_NAV_MISSING');
  await evaluate(p,s,()=>{[...document.querySelectorAll('nav [role="button"]')].find(e=>e.textContent==='Inventory').click();return true;});
 }
 await actor('store',async(p,s)=>{
  await workspace(p,s);await click(p,s,'Stock Transfers','[role="tablist"] button');
  await until(p,s,n=>[...document.querySelectorAll('main .MuiCard-root')].some(e=>e.textContent.includes(n)),f.number,'TRANSFER_ORIGIN_MISSING');
  await evaluate(p,s,n=>{[...document.querySelectorAll('main .MuiCard-root')].find(e=>e.textContent.includes(n)).click();return true;},f.number);
  await field(p,s,'Assignment reason','Actual browser origin dispatch','main');
  await click(p,s,'Dispatch actual stock','main button');
  await until(p,s,async({api,id})=>{const r=await fetch(api+'/inventory/stock-transfers/'+id,{credentials:'include'});return r.status===200&&Boolean((await r.json()).data.custody?.dispatch);},{api:API,id:f.id},'TRANSFER_DISPATCH_NOT_POSTED');
 });
 assert.equal(await db.stockTransaction.count({where:{stockTransferId:f.id,movementType:'STOCK_TRANSFER_IN'}}),0);
 await actor('receiver',async(p,s)=>{
  await workspace(p,s);await select(p,s,'Destination Project',f.destination.id);
  await click(p,s,f.number);await until(p,s,()=>Boolean(document.querySelector('[data-testid="transfer-destination-detail"]')),null,'TRANSFER_DESTINATION_MISSING');
  for(const [label,title]of [['ไทย','รับสินค้าที่โอนเข้าปลายทาง'],['繁中','目的地調撥收貨'],['EN','Destination transfer receipts']]){
   await evaluate(p,s,()=>{document.querySelector('header [role="combobox"]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;});
   await until(p,s,label=>[...document.querySelectorAll('[role="option"]')].some(e=>e.textContent===label),label,'TRANSFER_LOCALE_MENU');
   await evaluate(p,s,label=>{[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent===label).click();return true;},label);
   await until(p,s,title=>document.querySelector('[data-testid="transfer-receipts"]')?.textContent.includes(title),title,'TRANSFER_LOCALE_MISSING');
  }
  await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},s);
  await until(p,s,()=>window.innerWidth===390&&document.documentElement.scrollWidth<=391,null,'TRANSFER_MOBILE_OVERFLOW');
  await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false},s);
  await field(p,s,'Receipt note / reason','Actual destination delivery; one remains outstanding');
  await click(p,s,'Record destination delivery','[data-testid="transfer-destination-detail"] button');
  await until(p,s,()=>Boolean(document.querySelector('[data-testid="transfer-destination-detail"] input[type="file"]')),null,'TRANSFER_RECEIPT_DRAFT_MISSING');
  receiptId=(await db.transferReceipt.findFirstOrThrow({where:{transferId:f.id,postedAt:null}})).id;
  await select(p,s,'Evidence type',f.documentType.id,'[data-testid="transfer-destination-detail"]');
  const bytes=syntheticPdf('transfer-receipt');
  await evaluate(p,s,base64=>{const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],'transfer-ui.pdf',{type:'application/pdf'}));const input=document.querySelector('[data-testid="transfer-destination-detail"] input[type="file"]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;},bytes.toString('base64'));
  await click(p,s,'Upload receipt evidence','[data-testid="transfer-destination-detail"] button');
  await until(p,s,()=>[...document.querySelectorAll('[data-testid="transfer-destination-detail"] [role="option"], [data-testid="transfer-destination-detail"] input')].some(e=>e.value),null,'TRANSFER_EVIDENCE_PENDING');
  // Await committed canonical upload, then select that same evidence through the UI.
  const end=Date.now()+20000;while(Date.now()<end){const d=await db.documentLink.findFirst({where:{entityType:'TRANSFER_RECEIPT',entityId:receiptId}});if(d){documentId=d.documentId;break;}await new Promise(ok=>setTimeout(ok,50));}
  demand(documentId,'TRANSFER_UI_UPLOAD_MISSING');
  await select(p,s,'Receipt evidence',documentId,'[data-testid="transfer-destination-detail"]');
  await field(p,s,'Actual accepted quantity · '+f.materialCode,'4');
  await click(p,s,'Confirm accepted quantities','[data-testid="transfer-destination-detail"] button');
  await until(p,s,()=>document.querySelector('[data-testid="transfer-destination-detail"]')?.textContent.includes('Outstanding: 1.0000'),null,'TRANSFER_PARTIAL_NOT_POSTED');
  demand(await evaluate(p,s,async({api,path,expected,checksum})=>{const r=await fetch(api+path,{credentials:'include'});const b=await r.arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');return r.status===200&&b.byteLength===expected&&hash===checksum;},{api:API,path:'/documents/projects/'+f.destination.id+'/targets/TRANSFER_RECEIPT/'+receiptId+'/'+documentId+'/download',expected:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex')}),'TRANSFER_EVIDENCE_BYTES_MISSING');
 });
 await actor('outsider',async(p,s)=>{
  demand(await evaluate(p,s,async({api,project,id,receipt,document})=>{for(const path of ['/inventory/transfer-custody/projects/'+project+'/transfers/'+id,'/documents/projects/'+project+'/targets/TRANSFER_RECEIPT/'+receipt+'/'+document+'/download','/documents/projects/'+project+'/'+document+'/download']){const r=await fetch(api+path,{credentials:'include'});if(![403,404].includes(r.status))return false;await r.body?.cancel();}return true;},{api:API,project:f.destination.id,id:f.id,receipt:receiptId,document:documentId}),'TRANSFER_WRONG_ACTOR_OR_ALIAS_EXPOSED');
 });
 const rows=await db.stockTransaction.findMany({where:{companyId:f.company.id}});
 for(const row of before)assert.deepEqual(rows.find(r=>r.id===row.id),row);
 const added=rows.filter(r=>!before.some(old=>old.id===r.id));assert.equal(added.length,2);
 assert.equal(added.find(r=>r.movementType==='STOCK_TRANSFER_OUT').quantity.toFixed(4),'-5.0000');assert.equal(added.find(r=>r.movementType==='STOCK_TRANSFER_IN').quantity.toFixed(4),'4.0000');
 assert.deepEqual(violations,[]);
 return {status:'TRANSFER_BROWSER_NATIVE_PASS',transferId:f.id,receiptId,documentIds:[documentId],outstanding:'1.0000',sessionsRevoked:true};
 }catch(e){throw Object.assign(new Error(),{safeCode:'TRANSFER_BROWSER_'+phase+'_'+(/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'ASSERTION_FAILED')});}
 finally{protocol.listeners.delete(intercept);if(context)try{await protocol.send('Target.disposeBrowserContext',{browserContextId:context});}catch{}}
}
