// Shared actual receiving UI journey. No provisioning, migrations, reset or CLI.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
async function evaluate(p,s,fn,arg){
  const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',awaitPromise:true,returnByValue:true},s);
  demand(!r.exceptionDetails&&r.result?.type!=='error','RECEIVING_BROWSER_EVALUATION_FAILED');return r.result?.value;
}
async function until(p,s,fn,arg,code){
  const end=Date.now()+20000;
  while(Date.now()<end){if(await evaluate(p,s,fn,arg))return;await new Promise(r=>setTimeout(r,100));}
  demand(false,code);
}
async function click(p,s,label,selector='[data-testid="receiving"] button'){
  await until(p,s,({label,selector})=>[...document.querySelectorAll(selector)].some(e=>e.textContent===label&&!e.disabled),{label,selector},'RECEIVING_BROWSER_ACTION_UNAVAILABLE');
  demand(await evaluate(p,s,({label,selector})=>{const e=[...document.querySelectorAll(selector)].find(e=>e.textContent===label&&!e.disabled);if(!e)return false;e.click();return true;},{label,selector}),'RECEIVING_BROWSER_ACTION_UNAVAILABLE');
}
async function field(p,s,label,value,scope='[data-testid="receiving-detail"]'){
  await until(p,s,({label,scope})=>[...document.querySelectorAll(scope+' label')].some(e=>e.textContent===label),{label,scope},'RECEIVING_BROWSER_FIELD_UNAVAILABLE');
  await evaluate(p,s,({label,value,scope})=>{
    const l=[...document.querySelectorAll(scope+' label')].find(e=>e.textContent===label),e=document.getElementById(l.htmlFor);
    const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);
    e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;
  },{label,value,scope});
}
async function select(p,s,label,value,scope='[data-testid="receiving"]'){
  await until(p,s,({label,scope})=>[...document.querySelectorAll(scope+' label')].some(e=>{const input=document.getElementById(e.htmlFor);return e.textContent===label&&input&&!input.disabled&&input.getAttribute('aria-disabled')!=='true';}),{label,scope},'RECEIVING_BROWSER_SELECT_UNAVAILABLE');
  await evaluate(p,s,({label,scope})=>{const l=[...document.querySelectorAll(scope+' label')].find(e=>e.textContent===label);document.getElementById(l.htmlFor).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;},{label,scope});
  await until(p,s,value=>[...document.querySelectorAll('[role="option"]')].some(e=>e.getAttribute('data-value')===value),value,'RECEIVING_BROWSER_OPTION_UNAVAILABLE');
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
export async function executeReceivingBrowser(protocol,binding,db){
  const {api:API,web:WEB,fixture:f}=structuredClone(binding);
  demand(API==='http://127.0.0.1:33071/api/v1'&&WEB==='http://127.0.0.1:44171'||
    process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&
    ((API==='http://127.0.0.1:31329/api/v1'&&WEB==='http://127.0.0.1:44329')||
     (API==='http://127.0.0.1:31319/api/v1'&&WEB==='http://127.0.0.1:44319')),'RECEIVING_BROWSER_ORIGINS_REFUSED');
  demand(new Set(['store','jai','pm'].map(k=>f.actors[k].userId)).size===3,'RECEIVING_BROWSER_ACTORS_MUST_DIFFER');
  demand(await db.receivingDelivery.count({where:{companyId:f.company.id,receiverName:'Browser physical receiver'}})===0,'RECEIVING_BROWSER_ALREADY_RUN_NO_REPLAY');
  let deliveryId,context,session,gr,phase='START';const uploaded=[],closing=new Set(),violations=[];
  const stockBefore=await db.stockTransaction.findMany({where:{companyId:f.company.id}}),unrelatedBefore={};
  for(const model of ['payment','directCostPosting','hrEmployment'])unrelatedBefore[model]=await db[model].count({where:{companyId:f.company.id}});
    const intercept=event=>{
      if(event.method!=='Fetch.requestPaused')return;
      const r=event.params.request;let allowed=false;
      try{
        const u=new URL(r.url);
        const contentType=Object.entries(r.headers??{}).find(([k])=>k.toLowerCase()==='content-type')?.[1];
        const body=r.method==='POST'&&String(contentType).includes('application/json')?JSON.parse(r.postData??'null'):null;
        allowed=u.origin===WEB&&r.method==='GET'||u.origin===new URL(API).origin&&(
          ['GET','OPTIONS'].includes(r.method)||r.method==='POST'&&(
            ['/api/v1/auth/login','/api/v1/auth/logout'].includes(u.pathname)||
            u.pathname==='/api/v1/inventory/receiving/deliveries'&&body?.projectId===f.project.id&&body?.warehouseId===f.warehouse.id&&body?.supplierId===f.supplier.id||
            deliveryId&&u.pathname==='/api/v1/documents/projects/'+f.project.id+'/targets/RECEIVING_DELIVERY/'+deliveryId||
            deliveryId&&['link-po','check','evidence'].some(a=>u.pathname==='/api/v1/inventory/receiving/deliveries/'+deliveryId+'/'+a)||
            deliveryId&&u.pathname==='/api/v1/inventory/goods-receipts'&&body?.deliveryId===deliveryId&&body?.projectId===f.project.id&&body?.purchaseOrderId===f.po.id||
            gr&&['submit','approve'].some(a=>u.pathname==='/api/v1/inventory/goods-receipts/'+gr.id+'/'+a)));

      }catch{}
      if(!allowed)violations.push('RECEIVING_BROWSER_UNDECLARED_REQUEST');
      protocol.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:event.params.requestId}:
        {requestId:event.params.requestId,errorReason:'BlockedByClient'},event.sessionId).catch(()=>{if(!closing.has(event.sessionId))violations.push('RECEIVING_BROWSER_INTERCEPTION_FAILED');});
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
        await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'RECEIVING_BROWSER_LOGIN_FORM_MISSING');
        await evaluate(protocol,session,a=>{
          for(const [type,value]of[['email',a.email],['password',a.password]]){
            const e=document.querySelector('input[type="'+type+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);
            e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
          }document.querySelector('form').requestSubmit();return true;
        },{email:a.email,password:a.password});
        await until(protocol,session,()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')),null,'RECEIVING_BROWSER_LOGIN_FAILED');
        demand(await evaluate(protocol,session,async({api,id,companyId})=>{
          const r=await fetch(api+'/auth/me',{credentials:'include'});const v=await r.json();
          return r.status===200&&v.data.id===id&&v.data.companyId===companyId;
        },{api:API,id:a.userId,companyId:f.company.id}),'RECEIVING_BROWSER_WRONG_ACTOR');
        phase=key.toUpperCase()+'_WORKFLOW';await work(protocol,session);
      }catch(e){primary=e;primaryPhase=phase;}
      try{
        phase=key.toUpperCase()+'_LOGOUT';
        const cookies=(await protocol.send('Storage.getCookies',{browserContextId:context})).cookies;
        const cookie=cookies.find(c=>c.name==='erp_session'&&c.domain==='127.0.0.1');
        demand(cookie&&typeof cookie.value==='string'&&cookie.value.length>0,'RECEIVING_BROWSER_SESSION_COOKIE_MISSING');
        await click(protocol,session,'Sign out','header button');
        await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'RECEIVING_BROWSER_LOGOUT_FAILED');
        demand(await evaluate(protocol,session,async api=>(await fetch(api+'/auth/me',{credentials:'include'})).status===401,API),'RECEIVING_BROWSER_SESSION_NOT_REVOKED');
        const stale=await fetch(API+'/auth/me',{headers:{Cookie:'erp_session='+cookie.value},redirect:'error',signal:AbortSignal.timeout(10000)});
        const status=stale.status;await stale.body?.cancel();demand(status===401,'RECEIVING_BROWSER_REVOKED_COOKIE_ACCEPTED');
      }catch(e){if(!primary){primary=e;primaryPhase=phase;}}finally{
        if(session)closing.add(session);
        try{await protocol.send('Target.disposeBrowserContext',{browserContextId:context});}catch(e){primary??=e;}
        context=undefined;session=undefined;
      }
      if(primary){phase=primaryPhase??phase;throw primary;}
    }
    async function workspace(p,s){
      await until(p,s,()=>[...document.querySelectorAll('nav [role="button"]')].some(e=>e.textContent==='Inventory'),null,'RECEIVING_BROWSER_NAV_MISSING');
      await evaluate(p,s,()=>{[...document.querySelectorAll('nav [role="button"]')].find(e=>e.textContent==='Inventory').click();return true;});
      await select(p,s,'Project',f.project.id);
    }
    async function open(p,s){
      await until(p,s,()=>[...document.querySelectorAll('[data-testid="receiving"] button')].some(e=>e.textContent.startsWith('Open delivery')&&e.textContent.includes('Browser physical receiver')),null,'RECEIVING_BROWSER_LIST_MISSING');
      await evaluate(p,s,()=>{[...document.querySelectorAll('[data-testid="receiving"] button')].find(e=>e.textContent.startsWith('Open delivery')&&e.textContent.includes('Browser physical receiver')).click();return true;});
      await until(p,s,()=>Boolean(document.querySelector('[data-testid="receiving-detail"]')),null,'RECEIVING_BROWSER_DETAIL_MISSING');
    }
    await actor('store',async(p,s)=>{
      await workspace(p,s);
      for(const [label,title]of [['ไทย','รับสินค้าฝากชั่วคราว'],['繁中','收貨暫管'],['EN','Receiving custody']]){
        await evaluate(p,s,()=>{document.querySelector('header [role="combobox"]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;});
        await until(p,s,label=>[...document.querySelectorAll('[role="option"]')].some(e=>e.textContent===label),label,'RECEIVING_BROWSER_LOCALE_MENU');
        await evaluate(p,s,label=>{[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent===label).click();return true;},label);
        await until(p,s,title=>document.querySelector('[data-testid="receiving"]')?.textContent.includes(title),title,'RECEIVING_BROWSER_LOCALE_FORM');
      }
      await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},s);
      await until(p,s,()=>window.innerWidth===390&&Boolean(document.querySelector('[data-testid="receiving-capture"]'))&&document.documentElement.scrollWidth<=window.innerWidth+1,null,'RECEIVING_BROWSER_MOBILE_FORM_OVERFLOW');
      await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false},s);
      const scope='[data-testid="receiving-capture"]';
      await select(p,s,'Warehouse',f.warehouse.id,scope);await select(p,s,'Supplier',f.supplier.id,scope);
      await field(p,s,'Receiver name','Browser physical receiver',scope);await field(p,s,'Reason','Actual browser physical capture',scope);
      await select(p,s,'Material 1',f.material.id,scope);await select(p,s,'Unit',f.uom.id,scope);
      await field(p,s,'Observed quantity','4',scope);await field(p,s,'Good quantity for GR','3',scope);await select(p,s,'Condition','DAMAGED',scope);await field(p,s,'Line note','One damaged synthetic item remains held',scope);
      const received=await evaluate(p,s,()=>{const d=new Date(Date.now()-49*3600000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
      await field(p,s,'Physical receipt time',received,scope);
      await click(p,s,'Record physical receipt',scope+' button');
      await until(p,s,()=>document.querySelector('[data-testid="receiving-detail"]')?.textContent.includes('Browser physical receiver'),null,'RECEIVING_BROWSER_CAPTURE_NOT_SAVED');
      deliveryId=(await db.receivingDelivery.findFirstOrThrow({where:{companyId:f.company.id,receiverName:'Browser physical receiver'}})).id;
      assert.equal(await db.stockTransaction.count({where:{companyId:f.company.id}}),stockBefore.length);
      for(const purpose of ['DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO']){
        phase='STORE_EVIDENCE_'+purpose;
        await field(p,s,'Reason','Synthetic browser '+purpose+' evidence');
        await select(p,s,'Evidence purpose',purpose,'[data-testid="receiving-detail"]');
        await select(p,s,'Document type',f.documentType.id,'[data-testid="receiving-detail"]');
        const bytes=syntheticPdf(purpose),fileName='browser-'+purpose+'.pdf';
        await evaluate(p,s,({fileName,base64})=>{
          const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),data=new DataTransfer();data.items.add(new File([bytes],fileName,{type:'application/pdf'}));
          const input=document.querySelector('[data-testid="receiving-detail"] input[type="file"]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;
        },{fileName,base64:bytes.toString('base64')});
        await click(p,s,'Upload file','[data-testid="receiving-detail"] button');
        await until(p,s,fileName=>{const label=[...document.querySelectorAll('[data-testid="receiving-detail"] label')].find(e=>e.textContent==='Evidence');return label&&document.getElementById(label.htmlFor)?.textContent.includes(fileName);},fileName,'RECEIVING_BROWSER_UPLOAD_NOT_SELECTED');
        const doc=await db.document.findFirstOrThrow({where:{companyId:f.company.id,fileName,links:{some:{entityType:'RECEIVING_DELIVERY',entityId:deliveryId}}}});
        assert.equal(doc.checksum,createHash('sha256').update(bytes).digest('hex'));uploaded.push(doc.id);
        if(purpose==='RECEIVER_SIGNATURE')await evaluate(p,s,()=>{const label=[...document.querySelectorAll('[data-testid="receiving-detail"] label')].find(e=>e.textContent.includes('I confirm the evidence records the actual receiver signature.'));label.querySelector('input').click();return true;});
        await click(p,s,'Bind uploaded evidence','[data-testid="receiving-detail"] button');
        await until(p,s,async({api,id,documentId})=>{const r=await fetch(api+'/inventory/receiving/deliveries/'+id,{credentials:'include'});return r.status===200&&(await r.json()).data.evidence.some(e=>e.documentId===documentId);},{api:API,id:deliveryId,documentId:doc.id},'RECEIVING_BROWSER_EVIDENCE_NOT_BOUND');
        const downloaded=await evaluate(p,s,async({api,projectId,id,documentId})=>{
          const r=await fetch(api+'/documents/projects/'+projectId+'/targets/RECEIVING_DELIVERY/'+id+'/'+documentId+'/download',{credentials:'include'});
          const data=await r.arrayBuffer();return {status:r.status,size:data.byteLength,checksum:[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('')};
        },{api:API,projectId:f.project.id,id:deliveryId,documentId:doc.id});
        assert.deepEqual(downloaded,{status:200,size:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex')});
        await until(p,s,()=>{const label=[...document.querySelectorAll('[data-testid="receiving-detail"] label')].find(e=>e.textContent==='Reason'),input=label&&document.getElementById(label.htmlFor);return input&&!input.disabled&&input.value==='';},null,'RECEIVING_BROWSER_EVIDENCE_FORM_NOT_REFRESHED');
      }
      assert.equal(await db.receivingDeliveryEvidence.count({where:{deliveryId}}),3);
      await field(p,s,'Reason','Browser PO source link');await select(p,s,'Approved purchase order',f.po.id,'[data-testid="receiving-detail"]');
      await select(p,s,'Matching PO line · '+f.material.materialName,f.po.lines[0].id,'[data-testid="receiving-detail"]');await click(p,s,'Link approved PO','[data-testid="receiving-detail"] button');
      await until(p,s,()=>document.querySelector('[data-testid="receiving-detail"]')?.textContent.includes('PO linked late'),null,'RECEIVING_BROWSER_PO_LINK_FAILED');
      demand(await evaluate(p,s,()=>![...document.querySelectorAll('[data-testid="receiving-detail"] button')].some(e=>e.textContent==='Accept document and quantity check')),'RECEIVING_BROWSER_SELF_CHECK');
    });
    await actor('jai',async(p,s)=>{
      await workspace(p,s);await open(p,s);await field(p,s,'Reason','Jai browser delivery documents and quantities checked');
      await click(p,s,'Accept document and quantity check','[data-testid="receiving-detail"] button');
      await until(p,s,()=>document.querySelector('[data-testid="receiving-detail"]')?.textContent.includes('Independent check accepted'),null,'RECEIVING_BROWSER_CHECK_FAILED');
    });
    await actor('store',async(p,s)=>{
      await workspace(p,s);await open(p,s);await field(p,s,'Reason','Canonical GR from actual checked delivery');
      await click(p,s,'Create canonical GR','[data-testid="receiving-detail"] button');
      await until(p,s,()=>[...document.querySelectorAll('[data-testid="receiving-detail"] button')].some(e=>e.textContent.startsWith('Open GR for submission / approval')),null,'RECEIVING_BROWSER_GR_MISSING');
      gr=await db.goodsReceipt.findUniqueOrThrow({where:{deliveryId}});assert.equal(gr.postedAt,null);
      await evaluate(p,s,()=>{[...document.querySelectorAll('[data-testid="receiving-detail"] button')].find(e=>e.textContent.startsWith('Open GR for submission / approval')).click();return true;});
      await until(p,s,()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='Submit for approval'),null,'RECEIVING_BROWSER_GR_NAVIGATION');
      await until(p,s,number=>[...document.querySelectorAll('main .MuiTypography-subtitle1')].some(e=>e.textContent===number),gr.receiptNumber,'RECEIVING_BROWSER_FIRST_GR_SELECTION');
      await click(p,s,'Receiving custody','[role="tab"]');
      await select(p,s,'Project',f.project.id);await open(p,s);
      await evaluate(p,s,()=>{[...document.querySelectorAll('[data-testid="receiving-detail"] button')].find(e=>e.textContent.startsWith('Open GR for submission / approval')).click();return true;});
      await until(p,s,number=>[...document.querySelectorAll('main .MuiTypography-subtitle1')].some(e=>e.textContent===number),gr.receiptNumber,'RECEIVING_BROWSER_REPEAT_GR_SELECTION');
      // Existing canonical GR form remains the approval authority.
      await select(p,s,'Approval workflow',f.receiptWorkflow.workflowCode,'main');
      await click(p,s,'Submit for approval','main button');
      await until(p,s,async({api,id})=>{const r=await fetch(api+'/inventory/goods-receipts/'+id,{credentials:'include'});return r.status===200&&Boolean((await r.json()).data.submittedAt);},{api:API,id:gr.id},'RECEIVING_BROWSER_SUBMISSION');
    });
    await actor('pm',async(p,s)=>{
      await workspace(p,s);await open(p,s);
      await evaluate(p,s,()=>{[...document.querySelectorAll('[data-testid="receiving-detail"] button')].find(e=>e.textContent.startsWith('Open GR for submission / approval')).click();return true;});
      await click(p,s,'Approve and post','main button');
      await until(p,s,async({api,id})=>{const r=await fetch(api+'/inventory/goods-receipts/'+id,{credentials:'include'});return r.status===200&&Boolean((await r.json()).data.postedAt);},{api:API,id:gr.id},'RECEIVING_BROWSER_APPROVAL');
    });
    await actor('outsider',async(p,s)=>{
      demand(await evaluate(p,s,async({api,id})=>[403,404].includes((await fetch(api+'/inventory/receiving/deliveries/'+id,{credentials:'include'})).status),{api:API,id:deliveryId}),'RECEIVING_BROWSER_WRONG_ACTOR_READ_ALLOWED');
      demand(await evaluate(p,s,async({api,id,projectId,documentId})=>{
        for(const path of ['/documents/projects/'+projectId+'/targets/RECEIVING_DELIVERY/'+id+'/'+documentId+'/download',
          '/documents/projects/'+projectId+'/'+documentId+'/download']){
          const r=await fetch(api+path,{credentials:'include'}),ok=[403,404].includes(r.status);await r.body?.cancel();if(!ok)return false;
        }return true;
      },{api:API,id:deliveryId,projectId:f.project.id,documentId:uploaded[0]}),'RECEIVING_BROWSER_WRONG_ACTOR_DOCUMENT_ALIAS_ALLOWED');
    });
    phase='PRESERVATION';
    const source=await db.receivingDelivery.findUniqueOrThrow({where:{id:deliveryId},include:{lines:true,goodsReceipt:true,evidence:true}});
    assert.equal(source.evidence.length,3);assert.deepEqual(source.evidence.map(e=>e.documentId).sort(),uploaded.sort());assert.equal(source.status,'CHECKED');assert.ok(source.goodsReceipt.postedAt);assert.equal(source.lines[0].observedQuantity.toFixed(4),'4.0000');assert.equal(source.lines[0].goodQuantity.toFixed(4),'3.0000');
    const ledger=await db.stockTransaction.findMany({where:{companyId:f.company.id}});assert.equal(ledger.length,stockBefore.length+1);
    for(const row of stockBefore)assert.deepEqual(ledger.find(r=>r.id===row.id),row);
    const posted=ledger.filter(r=>!stockBefore.some(old=>old.id===r.id));assert.equal(posted.length,1);assert.equal(posted[0].quantity.toFixed(4),'3.0000');assert.equal(posted[0].goodsReceiptItemId,(await db.goodsReceiptItem.findFirstOrThrow({where:{goodsReceiptId:gr.id}})).id);
    for(const [model,count]of Object.entries(unrelatedBefore))assert.equal(await db[model].count({where:{companyId:f.company.id}}),count);
    assert.equal(await db.userSession.count({where:{userId:{in:Object.values(f.actors).map(a=>a.userId)},revokedAt:null}}),0);assert.deepEqual(violations,[]);
    return {status:'RECEIVING_BROWSER_JOURNEY_VERIFIED',deliveryId,goodsReceiptId:gr.id,documentIds:uploaded,
      stockIncrease:'3.0000',damagedQuantityHeld:'1.0000',threeLocalesVerified:true,latePoLinkPreserved:true,
      sameDeliveryEvidenceUploaded:true,independentCheckVerified:true,canonicalGrApprovalVerified:true,
      wrongActorDenied:true,owningAndGenericDocumentDenialsVerified:true,evidenceDownloadBytesVerified:true,sessionsRevoked:true,productionAuthorized:false,humanUatCompleted:false};
    }catch(e){throw Object.assign(new Error(),{safeCode:'RECEIVING_BROWSER_'+phase+'_'+(/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'ASSERTION_FAILED')});}
    finally{protocol.listeners.delete(intercept);if(context)try{await protocol.send('Target.disposeBrowserContext',{browserContextId:context});}catch{}}
}
