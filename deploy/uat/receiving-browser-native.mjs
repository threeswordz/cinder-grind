import {executeReceivingBrowser} from './prototype-receiving-browser.mjs';
// Linux-only disposable RECEIVING: real built React, real login/CSRF API and PostgreSQL.
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
import {prepareReceivingUpgrade} from '../release-candidate/receiving-predecessor.mjs';
import {safeEnvironment} from './prototype-actors.mjs';
const execute=promisify(execFile),root=fileURLToPath(new URL('../../',import.meta.url));
const apiRoot=join(root,'apps/api'),require=createRequire(join(apiRoot,'package.json'));
const API='http://127.0.0.1:31329/api/v1',WEB='http://127.0.0.1:44329';
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
  let app,server,child,protocol,exited,phase='FIXTURE';
  try{
    assert.equal((await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,own.pathname.slice(1));
    let f,proof;
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
    await executeReceivingBrowser(protocol,{api:API,web:WEB,fixture:f},db);
    console.log('RECEIVING_BROWSER_NATIVE_PASS: real built React, cookie/CSRF login, same-delivery physical capture, actual UI upload/binding of three evidence files, EN/TH/zh-TW, PO matching, independent Jai check, canonical GR navigation/submission/PM approval and one good-quantity stock effect. Disposable proof; human UAT deferred.');
  }catch(e){throw Object.assign(new Error(),{safeCode:'RECEIVING_NATIVE_'+phase+'_'+(/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'ASSERTION_OR_SETUP_FAILED')});}
  finally{
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
