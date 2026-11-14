// One unique disposable DB for the NEW coordinator's complete API flow.
// Never accepts a target URL, existing DB or Mac execution; no initial browser,
// startup or 123-check actor scenarios are replayed here.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {SOURCE,safeEnvironment,provision} from './prototype-actors.mjs';
import {planMaterialConfiguration,applyMaterialConfiguration} from './prototype-material-configure.mjs';
import {executeMaterialRun} from './prototype-material-run.mjs';
import {businessFingerprint} from './prototype-browser-operator.mjs';
import {startBrowser} from './prototype-browser.mjs';
import {materialUiRevision} from './prototype-material-ui.mjs';
import {materialUiSnapshot,verifyMaterialUiPreservation} from './prototype-material-ui-state.mjs';
const execute=promisify(execFile);
async function native(){
  assert.equal(process.platform,'linux');assert.equal(process.env.GITHUB_ACTIONS,'true');
  assert.equal(process.versions.node,'24.21.0');
  const baseUrl=new URL(process.env.DATABASE_URL??'');
  assert.ok(['localhost','127.0.0.1'].includes(baseUrl.hostname)&&baseUrl.port==='5432'&&
    baseUrl.username==='construction_erp'&&baseUrl.pathname==='/construction_erp');
  const root=fileURLToPath(new URL('../../',import.meta.url)),apiRoot=join(root,'apps/api'),require=createRequire(join(apiRoot,'package.json'));
  require('reflect-metadata');
  const {PrismaClient}=require('@prisma/client'),base=new PrismaClient({datasources:{db:{url:baseUrl.href}},log:[]});
  const name='material_run_ci_'+randomUUID().replaceAll('-','');assert.match(name,/^material_run_ci_[a-f0-9]{32}$/);
  const own=new URL(baseUrl);own.pathname='/'+name;
  const temporary=await mkdtemp(join(tmpdir(),'erp-material-run-'));
  const env={...safeEnvironment(),CI:'true',NODE_ENV:'uat',DATABASE_URL:own.href,API_HOST:'127.0.0.1',API_PORT:'31319',
    WEB_ORIGIN:'http://127.0.0.1:44319',STORAGE_ROOT:join(temporary,'documents'),DOCUMENT_UPLOAD_TEMP_ROOT:join(temporary,'uploads'),
    HR_PRIVATE_KEYS:JSON.stringify({native:randomBytes(32).toString('base64')}),HR_PRIVATE_ACTIVE_KEY_ID:'native'};
  async function run(exe,args,childEnv){await execute(exe,args,{cwd:root,env:childEnv,timeout:120000,maxBuffer:2097152});}
  let created=false,db,app,webServer,browser,phase='UNIQUE_DATABASE';
  try{
    await base.$executeRawUnsafe('CREATE DATABASE "'+name+'"');created=true;
    phase='MIGRATE';await run('pnpm',['prisma:migrate:deploy'],env);
    await run(process.execPath,[join(apiRoot,'dist/scripts/bootstrap-admin.js')],{...env,BOOTSTRAP_COMPANY_CODE:'PROTO_A',
      BOOTSTRAP_COMPANY_NAME:'Synthetic follow-up fixture',BOOTSTRAP_ADMIN_EMAIL:'proto-admin@example.invalid',
      BOOTSTRAP_ADMIN_DISPLAY_NAME:'Synthetic technical admin',BOOTSTRAP_ADMIN_PASSWORD:randomBytes(32).toString('hex')});
    Object.assign(process.env,env);
    const {PrismaService}=require('./dist/prisma/prisma.service.js'),{PasswordService}=require('./dist/auth/password.service.js');
    db=new PrismaService();await db.$connect();
    assert.equal((await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,name);
    phase='EXISTING_SYNTHETIC_FIXTURE';
    const prepared=await provision(db,new PasswordService()),fixture=await prepared.commit();
    const dimension=Object.fromEntries(['companyId','projectId','warehouseId','materialId','uomId'].map(k=>[k,fixture[k]]));
    // Saved predecessor count only, inserted atomically with its immutable
    // effect under existing DB constraints. Not another count approval test.
    const count=await db.$transaction(async tx=>{
      const row=await tx.stockCount.create({data:{...dimension,countedAt:new Date(),status:'APPROVED',
        actualQuantity:'20.0000',varianceQuantity:'20.0000',expectedOnHand:'0.0000',expectedReserved:'0.0000',expectedLedgerEventCount:0,
        evidenceReference:'Disposable saved predecessor state; not approval execution evidence',
        createdByUserId:prepared.actors.STORE_SITE.userId,submittedByUserId:prepared.actors.STORE_SITE.userId,
        submittedAt:new Date(),decidedByUserId:prepared.actors.KHAIMOOK.userId,decidedAt:new Date(),postKey:randomUUID()}});
      await tx.stockTransaction.create({data:{...dimension,stockCountId:row.id,movementType:'STOCK_COUNT_ADJUSTMENT',
        quantity:'20.0000',effectKey:'stock-count:'+row.id+':'+row.postKey,postedByUserId:prepared.actors.KHAIMOOK.userId}});
      return row;
    });
    const binding={sourceSha:SOURCE,actors:prepared.actors,fixture,initial:{stockCountId:count.id}},before=await businessFingerprint(db);
    phase='GUARDED_CONFIGURATION';
    const plan=await planMaterialConfiguration(db,binding);
    assert.equal(await businessFingerprint(db),before);
    await assert.rejects(applyMaterialConfiguration(db,binding,'0'.repeat(64)),e=>e.safeCode==='MATERIAL_CONFIGURATION_STATE_DRIFT');
    assert.equal(await businessFingerprint(db),before);
    const configuration=await applyMaterialConfiguration(db,binding,plan.stateSha256);
    assert.equal(configuration.configurationApplied,true);assert.equal(configuration.sourceApproved,false);assert.equal(configuration.stockPosted,false);
    await assert.rejects(applyMaterialConfiguration(db,binding,plan.stateSha256),e=>e.safeCode==='MATERIAL_CONFIGURATION_ALREADY_STARTED');
    assert.equal(await db.stockTransaction.count(),1);assert.equal(await db.budgetRevision.count(),0);
    assert.equal(await db.materialPlanProjectPolicy.count(),0);
    phase='AUTHENTICATED_API_JOURNEY';
    const {NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/app.module.js'),
      {securityHeadersMiddleware}=require('./dist/common/security-headers.js'),{ProblemDetailsFilter}=require('./dist/common/problem-details.filter.js');
    app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');
    app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(31319,'127.0.0.1');
    const receipts=new Map();
    const result=await executeMaterialRun(db,binding,configuration,{api:'http://127.0.0.1:31319/api/v1',web:env.WEB_ORIGIN},
      async(key,value)=>{assert.equal(receipts.has(key),false);receipts.set(key,value);});
    assert.equal(result.status,'MATERIAL_AUTHENTICATED_API_JOURNEY_VERIFIED');
    assert.deepEqual(result.stockHistory,['20.0000','17.0000','13.0000','20.0000']);
    assert.equal(result.apiSessionsRevoked,true);assert.equal(result.actualUiJourneyVerified,false);
    assert.equal(receipts.get('sessions').revoked,true);assert.equal(receipts.has('failure'),false);
    assert.equal(await db.stockTransaction.count(),5);assert.equal(await db.document.count(),1);
    assert.equal(result.productionAuthorized,false);
    console.log('MATERIAL_RUN_NATIVE_PASS: same guarded configuration and authenticated API execution core; source Ben->Khaimook, plan Store->Khaimook, direct issue, Khaimook->Ben overage, protected receipt bytes/history, canonical 20->17->13->20, Finance unchanged and revoked API sessions. Not Mac/UI/recovery/freeze proof.');
    // Extend this existing owned fixture with the missing UI boundary. Do not
    // create a second API journey, database, count or stock cycle for it.
    phase='RETAINED_REQUEST_UI';
    const uiBinding={...binding,configuration,journey:receipts.get('journey')};
    const beforeUi=await materialUiSnapshot(db,uiBinding);
    const out=join(temporary,'web');
    await run('pnpm',['--filter','@construction-erp/web','exec','vite','build','--outDir',out],
      {...safeEnvironment(),VITE_API_BASE_URL:'http://127.0.0.1:31319/api/v1'});
    webServer=createServer(async(req,res)=>{
      try{
        const path=new URL(req.url,env.WEB_ORIGIN).pathname,file=resolve(out,'.'+decodeURIComponent(path));
        if(req.method!=='GET'||file!==out&&!file.startsWith(out+'/')){res.writeHead(404);res.end();return;}
        const target=path==='/'?join(out,'index.html'):file,bytes=await readFile(target);
        res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':
          target.endsWith('.svg')?'image/svg+xml':'text/html');res.setHeader('Cache-Control','no-store');res.end(bytes);
      }catch{res.writeHead(404);res.end();}
    });
    await new Promise((resolve,reject)=>{webServer.once('error',reject);webServer.listen(44319,'127.0.0.1',resolve);});
    const chrome=['google-chrome','chromium','chromium-browser'].find(bin=>spawnSync(bin,['--version'],{stdio:'ignore'}).status===0);
    assert.ok(chrome,'Existing CI Chromium required');browser=await startBrowser(chrome,temporary);
    const ui=await materialUiRevision(browser.protocol,{sourceSha:SOURCE,api:'http://127.0.0.1:31319/api/v1',web:env.WEB_ORIGIN,
      companyId:fixture.companyId,projectId:fixture.projectId,warehouseId:fixture.warehouseId,
      requestId:uiBinding.journey.requestId,documentId:uiBinding.journey.documentId,
      actors:Object.fromEntries(['STORE_SITE','FOREMAN'].map(key=>[key,{...prepared.actors[key],permissions:beforeUi.permissions[key]}]))});
    await browser.stop();browser=undefined;
    verifyMaterialUiPreservation(beforeUi,await materialUiSnapshot(db,uiBinding));
    assert.equal(ui.status,'MATERIAL_RETAINED_REQUEST_UI_REVISION_VERIFIED');
    assert.equal(ui.signedHistoryPreserved,true);assert.equal(ui.uiSessionsRevoked,true);
    assert.equal(await db.stockTransaction.count(),5);assert.equal(await db.document.count(),1);
    console.log('MATERIAL_UI_NATIVE_PASS: real built React/MUI request revision on retained API-run records, Foreman read-only view, unchanged stock/Finance/grants, preserved signed history and revoked browser sessions. No repeated API stock cycle or full role/UI/recovery/freeze claim.');
  }catch(e){
    console.error('MATERIAL_RUN_NATIVE_FAILED: '+phase+' '+(/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'NATIVE_ASSERTION_OR_SETUP_FAILED'));
    process.exitCode=1;
  }finally{
    try{if(browser)await browser.stop();}finally{try{if(webServer)await new Promise(resolve=>webServer.close(resolve));}finally{try{if(app)await app.close();}finally{
      try{if(db)await db.$disconnect();}finally{
        try{if(created)await base.$executeRawUnsafe('DROP DATABASE "'+name+'" WITH (FORCE)');}
        finally{await base.$disconnect();assert.ok(resolve(temporary).startsWith(resolve(tmpdir())+'/erp-material-run-'));
          await rm(temporary,{recursive:true,force:true});}
      }
    }}}
  }
}
await native().catch(()=>{console.error('MATERIAL_RUN_NATIVE_FAILED: GUARD_OR_CLEANUP_FAILED');process.exitCode=1;});
