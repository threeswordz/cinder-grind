// Linux-only disposable RECEIVING: real built React, real login/CSRF API and PostgreSQL.
// Never targets the populated Mac prototype; no transport mocks or human UAT.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn,spawnSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {PipeProtocol} from './prototype-browser.mjs';
import {prepareReceivingUpgrade} from '../release-candidate/receiving-predecessor.mjs';
import {safeEnvironment,httpClient} from './prototype-actors.mjs';
const execute=promisify(execFile),root=fileURLToPath(new URL('../../',import.meta.url));
const apiRoot=join(root,'apps/api'),require=createRequire(join(apiRoot,'package.json'));
const API='http://127.0.0.1:31329/api/v1',WEB='http://127.0.0.1:44329';
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
export async function runReceivingBrowser(databaseUrl){
  const own=new URL(databaseUrl);
  assert.equal(process.platform,'linux');assert.equal(process.versions.node,'24.21.0');
  assert.ok(['localhost','127.0.0.1'].includes(own.hostname)&&Number(own.port)>0&&/^\/receiving_[a-f0-9]{32}$/.test(own.pathname));
  const temporary=await mkdtemp(join(tmpdir(),'erp-receiving-browser-'));
  const env={...safeEnvironment(),CI:'true',NODE_ENV:'test',DATABASE_URL:own.href,WEB_ORIGIN:WEB,
    STORAGE_ROOT:join(temporary,'documents'),DOCUMENT_UPLOAD_TEMP_ROOT:join(temporary,'uploads'),
    HR_PRIVATE_KEYS:JSON.stringify({receiving:randomBytes(32).toString('base64')}),HR_PRIVATE_ACTIVE_KEY_ID:'receiving'};
  Object.assign(process.env,env);require('reflect-metadata');
  const {PrismaService}=require('./dist/prisma/prisma.service.js'),db=new PrismaService();await db.$connect();
  const {NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/app.module.js');
  const {ProblemDetailsFilter}=require('./dist/common/problem-details.filter.js'),{securityHeadersMiddleware}=require('./dist/common/security-headers.js');
  const {corsOriginPolicy}=require('./dist/common/cors-origin.js');
  let app,server,child,protocol,exited,phase='FIXTURE',context,session;const closing=new Set(),violations=[];
  try{
    assert.equal((await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,own.pathname.slice(1));
    let f,proof,deliveryId;const uploaded=[];
    app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');
    app.enableCors({origin:corsOriginPolicy(WEB),credentials:true,methods:['GET','POST','PATCH','PUT','DELETE','OPTIONS']});
    app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(31329,'127.0.0.1');
    proof=await require('./dist/inventory/receiving-proof-fixture.js').receivingProofFixture(db,app,false);f=proof.f;
    f.actors=Object.fromEntries(['store','jai','pm','viewer','outsider'].map(k=>[k,{userId:f[k].user.id,email:f[k].user.email,password:f[k].password}]));
    await db.userSession.updateMany({where:{userId:{in:[f.store,f.jai,f.pm,f.config,f.outsider,f.viewer,f.buyer,f.buyerChecker].map(a=>a.user.id)},revokedAt:null},data:{revokedAt:new Date()}});
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
    await new Promise((ok,no)=>{server.once('error',no);server.listen(44329,'127.0.0.1',ok);});
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
            u.pathname==='/api/v1/inventory/receiving/deliveries'||/^\/api\/v1\/documents\/projects\/[a-f0-9-]+\/targets\/RECEIVING_DELIVERY\/[a-f0-9-]+$/.test(u.pathname)||/^\/api\/v1\/inventory\/receiving\/deliveries\/[a-f0-9-]+\/(link-po|check|evidence|revise|void)$/.test(u.pathname)||
            /^\/api\/v1\/inventory\/goods-receipts(?:\/[a-f0-9-]+\/(submit|approve))?$/.test(u.pathname)));
      }catch{}
      if(!allowed)violations.push('RECEIVING_BROWSER_UNDECLARED_REQUEST');
      protocol.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:event.params.requestId}:
        {requestId:event.params.requestId,errorReason:'BlockedByClient'},event.sessionId).catch(()=>{if(!closing.has(event.sessionId))violations.push('RECEIVING_BROWSER_INTERCEPTION_FAILED');});
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
        phase=key+'_WORKFLOW';await work(protocol,session);
        phase=key+'_LOGOUT';await click(protocol,session,'Sign out','header button');
        await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),null,'RECEIVING_BROWSER_LOGOUT_FAILED');
        demand(await evaluate(protocol,session,async api=>(await fetch(api+'/auth/me',{credentials:'include'})).status===401,API),'RECEIVING_BROWSER_SESSION_NOT_REVOKED');
      }finally{
        if(session)closing.add(session);
        await protocol.send('Target.disposeBrowserContext',{browserContextId:context});context=undefined;session=undefined;
      }
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
      assert.equal(await db.stockTransaction.count({where:{companyId:f.company.id}}),0);
      for(const purpose of ['DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO']){
        phase='store_EVIDENCE_'+purpose;
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
        await until(p,s,()=>{const label=[...document.querySelectorAll('[data-testid="receiving-detail"] label')].find(e=>e.textContent==='Reason'),input=label&&document.getElementById(label.htmlFor);return input&&!input.disabled&&input.value==='';},null,'RECEIVING_BROWSER_EVIDENCE_FORM_NOT_REFRESHED');
      }
      assert.equal(await db.receivingDeliveryEvidence.count({where:{deliveryId}}),3);
      await field(p,s,'Reason','Browser PO source link');await select(p,s,'Approved purchase order',f.po.id,'[data-testid="receiving-detail"]');
      await select(p,s,'Matching PO line · Synthetic steel',f.po.lines[0].id,'[data-testid="receiving-detail"]');await click(p,s,'Link approved PO','[data-testid="receiving-detail"] button');
      await until(p,s,()=>document.querySelector('[data-testid="receiving-detail"]')?.textContent.includes('PO linked late'),null,'RECEIVING_BROWSER_PO_LINK_FAILED');
      demand(await evaluate(p,s,()=>![...document.querySelectorAll('[data-testid="receiving-detail"] button')].some(e=>e.textContent==='Accept document and quantity check')),'RECEIVING_BROWSER_SELF_CHECK');
    });
    await actor('jai',async(p,s)=>{
      await workspace(p,s);await open(p,s);await field(p,s,'Reason','Jai browser delivery documents and quantities checked');
      await click(p,s,'Accept document and quantity check','[data-testid="receiving-detail"] button');
      await until(p,s,()=>document.querySelector('[data-testid="receiving-detail"]')?.textContent.includes('Independent check accepted'),null,'RECEIVING_BROWSER_CHECK_FAILED');
    });
    let gr;
    await actor('store',async(p,s)=>{
      await workspace(p,s);await open(p,s);await field(p,s,'Reason','Canonical GR from actual checked delivery');
      await click(p,s,'Create canonical GR','[data-testid="receiving-detail"] button');
      await until(p,s,()=>[...document.querySelectorAll('[data-testid="receiving-detail"] button')].some(e=>e.textContent.startsWith('Open GR for submission / approval')),null,'RECEIVING_BROWSER_GR_MISSING');
      gr=await db.goodsReceipt.findUniqueOrThrow({where:{deliveryId}});assert.equal(gr.postedAt,null);
      await evaluate(p,s,()=>{[...document.querySelectorAll('[data-testid="receiving-detail"] button')].find(e=>e.textContent.startsWith('Open GR for submission / approval')).click();return true;});
      await until(p,s,()=>[...document.querySelectorAll('button')].some(e=>e.textContent==='Submit for approval'),null,'RECEIVING_BROWSER_GR_NAVIGATION');
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
    phase='PRESERVATION';
    const source=await db.receivingDelivery.findUniqueOrThrow({where:{id:deliveryId},include:{lines:true,goodsReceipt:true,evidence:true}});
    assert.equal(source.evidence.length,3);assert.deepEqual(source.evidence.map(e=>e.documentId).sort(),uploaded.sort());assert.equal(source.status,'CHECKED');assert.ok(source.goodsReceipt.postedAt);assert.equal(source.lines[0].observedQuantity.toFixed(4),'4.0000');assert.equal(source.lines[0].goodQuantity.toFixed(4),'3.0000');
    const ledger=await db.stockTransaction.findMany({where:{companyId:f.company.id}});assert.equal(ledger.length,1);assert.equal(ledger[0].quantity.toFixed(4),'3.0000');
    for(const model of ['payment','directCostPosting','hrEmployment'])assert.equal(await db[model].count({where:{companyId:f.company.id}}),0);
    assert.equal(await db.userSession.count({where:{userId:{in:Object.values(f.actors).map(a=>a.userId)},revokedAt:null}}),0);assert.deepEqual(violations,[]);
    console.log('RECEIVING_BROWSER_NATIVE_PASS: real built React, cookie/CSRF login, same-delivery physical capture, actual UI upload/binding of three evidence files, EN/TH/zh-TW, PO matching, independent Jai check, canonical GR navigation/submission/PM approval and one good-quantity stock effect. Disposable proof; human UAT deferred.');
  }catch(e){throw Object.assign(new Error(),{safeCode:'RECEIVING_NATIVE_'+phase+'_'+(/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'ASSERTION_OR_SETUP_FAILED')});}
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
  const name='receiving_'+randomUUID().replaceAll('-',''),own=new URL(baseUrl);own.pathname='/'+name;let created=false;
  try{
    await base.$executeRawUnsafe('CREATE DATABASE "'+name+'"');created=true;
    await prepareReceivingUpgrade(own.href);
    await runReceivingBrowser(own.href);
  }finally{try{if(created)await base.$executeRawUnsafe('DROP DATABASE "'+name+'" WITH (FORCE)');}finally{await base.$disconnect();}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{await native();}catch(e){console.error(e.safeCode??'RECEIVING_BROWSER_NATIVE_GUARD_OR_CLEANUP_FAILED');process.exitCode=1;}
}
