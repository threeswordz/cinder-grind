import {configureTransfer,prepareTransferSource,transferBrowserBinding,verifyTransferJourneyPreservation} from './prototype-transfer-state.mjs';
import {executeTransferBrowser} from './transfer-browser.mjs';
import {configureSubcontract,prepareSubcontractSource,subcontractBrowserBinding,verifySubcontractPreservation} from './prototype-subcontract-state.mjs';
import {executePhysicalBrowser} from './subcontract-physical-browser.mjs';
import {configureUom,prepareUomSource,uomBrowserBinding,verifyUomActivationDenial,verifyUomPreservation} from './prototype-uom-state.mjs';
import {executeMaterialUomBrowser} from './material-uom-browser.mjs';
import {verifyUomPriorProtectedReadback} from './prototype-uom-protected-readback.mjs';
import {convertedReceiving} from './prototype-uom-converted-receiving.mjs';
import {prepareTransferContinuationSource} from './prototype-transfer-continuation-core.mjs';
import {beforeTransferSchema,createFailedTransferCheckpoint} from './prototype-transfer-continuation-native-fixture.mjs';
import {verifyFailedTransferState} from './prototype-transfer-failure-state.mjs';
import {configureReceiving,prepareReceivingSource,receivingBrowserBinding,verifyReceivingJourneyPreservation} from './prototype-receiving-state.mjs';
import {executeReceivingBrowser} from './prototype-receiving-browser.mjs';
import {executeFm03Browser} from './prototype-fm03-browser.mjs';
import {privateInventory,verifyDocumentInventory} from './prototype-fm03-upgrade.mjs';
import {fm03Snapshot,configureFm03,digest,fm03BrowserBinding,verifyFm03JourneyPreservation} from './prototype-fm03-state.mjs';
// One unique disposable DB for the NEW coordinator's complete API flow.
// Never accepts a target URL, existing DB or Mac execution; no initial browser,
// startup or 123-check actor scenarios are replayed here.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
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
  // Match the populated Mac's private storage root before the app creates files.
  await mkdir(env.STORAGE_ROOT,{mode:0o700});
  async function run(exe,args,childEnv){await execute(exe,args,{cwd:root,env:childEnv,timeout:120000,maxBuffer:2097152});}
  let created=false,db,app,webServer,browser,phase='UNIQUE_DATABASE';
  try{
    await base.$executeRawUnsafe('CREATE DATABASE "'+name+'"');created=true;
    phase='MIGRATE';await run('pnpm',['prisma:migrate:deploy'],env);
    const adminPassword=randomBytes(32).toString('hex');
    await run(process.execPath,[join(apiRoot,'dist/scripts/bootstrap-admin.js')],{...env,BOOTSTRAP_COMPANY_CODE:'PROTO_A',
      BOOTSTRAP_COMPANY_NAME:'Synthetic follow-up fixture',BOOTSTRAP_ADMIN_EMAIL:'proto-admin@example.invalid',
      BOOTSTRAP_ADMIN_DISPLAY_NAME:'Synthetic technical admin',BOOTSTRAP_ADMIN_PASSWORD:adminPassword});
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
    const {corsOriginPolicy}=require('./dist/common/cors-origin.js');
    app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');
    // Browser runs on the separate owned web origin. Reuse the production
    // origin policy and credentials setting; Node fetch alone cannot prove it.
    app.enableCors({origin:corsOriginPolicy(env.WEB_ORIGIN),credentials:true,
      methods:['GET','POST','PATCH','PUT','DELETE','OPTIONS']});
    app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(31319,'127.0.0.1');
    phase='BROWSER_CORS_CONTRACT';
    const cors=await fetch('http://127.0.0.1:31319/api/v1/auth/me',{headers:{Origin:env.WEB_ORIGIN}});
    assert.equal(cors.status,401);assert.equal(cors.headers.get('access-control-allow-origin'),env.WEB_ORIGIN);
    assert.equal(cors.headers.get('access-control-allow-credentials'),'true');
    const preflight=await fetch('http://127.0.0.1:31319/api/v1/auth/login',{method:'OPTIONS',
      headers:{Origin:env.WEB_ORIGIN,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),env.WEB_ORIGIN);
    const foreign=await fetch('http://127.0.0.1:31319/api/v1/auth/me',{headers:{Origin:'https://example.invalid'}});
    assert.equal(foreign.headers.get('access-control-allow-origin'),null);
    phase='AUTHENTICATED_API_JOURNEY';
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
    // Reuse this now-populated signed material fixture for the new FM03
    // deployment engine. No second material cycle, actor setup or database.
    phase='FM03_POPULATED_DELTA';
    const fmBinding={...binding,configuration},fmBefore=await fm03Snapshot(db);
    verifyDocumentInventory(fmBefore.documents,await privateInventory(env.STORAGE_ROOT));
    // Reproduce a membership change after the earlier snapshot. A fresh state
    // digest must not authorize another user to inherit the capability delta.
    const extraMember=await db.userRole.create({data:{companyId:fixture.companyId,userId:prepared.actors.NANCY.userId,
      roleId:prepared.actors.KHAIMOOK.roleId}});
    try{await assert.rejects(configureFm03(db,fmBinding,digest(await fm03Snapshot(db))),e=>e.safeCode==='FM03_ROLE_MEMBERSHIP_MUST_BE_EXCLUSIVE');}
    finally{await db.userRole.delete({where:{id:extraMember.id}});}
    const hrManage=await db.permission.findUniqueOrThrow({where:{permissionCode:'hr.identity.manage'}});
    const extraRight=await db.rolePermission.create({data:{roleId:prepared.actors.KHAIMOOK.roleId,permissionId:hrManage.id}});
    try{await assert.rejects(configureFm03(db,fmBinding,digest(await fm03Snapshot(db))),e=>e.safeCode==='FM03_EXISTING_ROLE_GRANT_MATRIX_CHANGED');}
    finally{await db.rolePermission.delete({where:{id:extraRight.id}});}
    assert.equal(digest(await fm03Snapshot(db)),digest(fmBefore));
    await assert.rejects(configureFm03(db,fmBinding,'0'.repeat(64)),e=>e.safeCode==='FM03_CONFIGURATION_STATE_DRIFT');
    const fmConfig=await configureFm03(db,fmBinding,digest(fmBefore));
    await assert.rejects(configureFm03(db,fmBinding,digest(await fm03Snapshot(db))),e=>e.safeCode==='FM03_CONFIGURATION_OR_JOURNEY_ALREADY_EXISTS'||e.safeCode==='FM03_GRANT_CATALOG_OR_PRIOR_DELTA_INVALID'||e.safeCode==='FM03_EXISTING_ROLE_GRANT_MATRIX_CHANGED');
    browser=await startBrowser(chrome,temporary);
    const fmResult=await executeFm03Browser(browser.protocol,fm03BrowserBinding(fmBinding,
      {api:'http://127.0.0.1:31319/api/v1',web:env.WEB_ORIGIN}),db);
    await browser.stop();browser=undefined;
    verifyFm03JourneyPreservation(fmBefore,await fm03Snapshot(db),fmConfig,fmBinding,fmResult);
    console.log('FM03_POPULATED_ENGINE_NATIVE_PASS: existing synthetic actors, minimal exact grants, real lifecycle/unresolved/refollowup/closure/severe alert, Company/Project/actor denial, EN/TH/zh-TW and retained material/signed/private/history/session preservation. Not Mac upgrade/recovery/freeze proof.');
    // Next missing deployed slice reuses the populated material/FM03 fixture.
    // No additional actor bootstrap, material cycle or issue lifecycle replay.
    phase='RECEIVING_BASELINE_SNAPSHOT';
    const receivingBefore=await fm03Snapshot(db);
    phase='RECEIVING_EXPECTED_DRIFT_REJECTION';
    await assert.rejects(configureReceiving(db,fmBinding,'0'.repeat(64)),e=>e.safeCode==='RC_CONFIGURATION_STATE_DRIFT');
    phase='RECEIVING_EXCLUSIVE_ROLE_REJECTION';
    const sharedRole=await db.userRole.create({data:{companyId:fixture.companyId,userId:prepared.actors.NANCY.userId,roleId:prepared.actors.JAI.roleId}});
    try{await assert.rejects(configureReceiving(db,fmBinding,digest(await fm03Snapshot(db))),e=>e.safeCode==='RC_ROLE_MEMBERSHIP_MUST_BE_EXCLUSIVE');}
    finally{await db.userRole.delete({where:{id:sharedRole.id}});}
    phase='RECEIVING_BASELINE_UNCHANGED';
    assert.equal(digest(await fm03Snapshot(db)),digest(receivingBefore));
    phase='RECEIVING_CONFIGURATION';
    const receivingConfig=await configureReceiving(db,fmBinding,digest(receivingBefore));
    const origins={api:'http://127.0.0.1:31319/api/v1',web:env.WEB_ORIGIN};
    phase='RECEIVING_CANONICAL_SOURCE';
    const receivingSource=await prepareReceivingSource(db,fmBinding,receivingConfig,origins);
    phase='RECEIVING_BROWSER_START';
    browser=await startBrowser(chrome,temporary);
    phase='RECEIVING_BROWSER_JOURNEY';
    const receivingResult=await executeReceivingBrowser(browser.protocol,await receivingBrowserBinding(db,fmBinding,receivingConfig,receivingSource,origins),db);
    await browser.stop();browser=undefined;
    phase='RECEIVING_PRESERVATION';
    verifyReceivingJourneyPreservation(receivingBefore,await fm03Snapshot(db),receivingConfig,fmBinding,receivingSource,receivingResult);
    console.log('RECEIVING_POPULATED_ENGINE_NATIVE_PASS: prior material/signed/FM03 preserved; minimal explicit configuration, actual PR/PO approval chain, same shared real-browser receiving/evidence/Jai-check/canonical-GR journey and revoked API/UI sessions. Not Mac execution, whole recovery or freeze proof.');
    // Extend this same populated target once. Keep completed source history and
    // exercise the actual configuration/API/browser code used by the Mac package.
    phase='TRANSFER_BASELINE';const transferBefore=await fm03Snapshot(db);
    await assert.rejects(configureTransfer(db,fmBinding,'0'.repeat(64)),e=>e.safeCode==='TR_CONFIGURATION_STATE_DRIFT');
    const sharedTransferRole=await db.userRole.create({data:{companyId:fixture.companyId,userId:prepared.actors.NANCY.userId,roleId:prepared.actors.PORN.roleId}});
    try{await assert.rejects(configureTransfer(db,fmBinding,digest(await fm03Snapshot(db))),e=>e.safeCode==='TR_ROLE_MEMBERSHIP_MUST_BE_EXCLUSIVE');}
    finally{await db.userRole.delete({where:{id:sharedTransferRole.id}});}
    assert.equal(digest(await fm03Snapshot(db)),digest(transferBefore));
    phase='TRANSFER_CONFIGURATION';const transferConfig=await configureTransfer(db,fmBinding,digest(transferBefore));
    phase='TRANSFER_FAILED_SOURCE_CHECKPOINT';const transferOld=beforeTransferSchema(transferBefore);
    await createFailedTransferCheckpoint(fmBinding,transferConfig,origins);
    const failedTransfer=await fm03Snapshot(db);
    assert.equal(verifyFailedTransferState(transferOld,failedTransfer,transferConfig,fmBinding).failedNumberConsumed,true);
    phase='TRANSFER_CANONICAL_CONTINUATION';const transferSource=await prepareTransferContinuationSource(db,fmBinding,transferConfig,
      {before:transferOld,stateSha256:digest(failedTransfer)},origins);
    assert.equal(transferSource.spentNumberPreserved,true);assert.equal(transferSource.policyReplayed,false);
    phase='TRANSFER_ACTUAL_BROWSER';browser=await startBrowser(chrome,temporary);
    const transferResult=await executeTransferBrowser(browser.protocol,await transferBrowserBinding(db,fmBinding,transferConfig,transferSource,origins),db);
    await browser.stop();browser=undefined;
    phase='TRANSFER_PRESERVATION';verifyTransferJourneyPreservation(transferBefore,await fm03Snapshot(db),transferConfig,fmBinding,transferSource,transferResult);
    console.log('TRANSFER_CONTINUATION_NATIVE_PASS: actual failed-create number allocation and committed policy/revoked sessions; strict old-state proof; canonical continuation uses002 without reset or policy replay, then the same real dispatch/receipt browser and full preserved history. Disposable CI only, not actual Mac continuation.');
    console.log('TRANSFER_POPULATED_ENGINE_NATIVE_PASS: completed material/FM03/receiving rows and grants preserved; exact new synthetic rights, canonical approval with zero stock, explicit Khaimook receiver assignment, real React dispatch5/receive4/outstanding1, protected evidence/locales/denials and revoked sessions. Not Mac execution or final recovery/freeze.');
    phase='SUBCONTRACT_BASELINE';const physicalBefore=await fm03Snapshot(db);
    await assert.rejects(configureSubcontract(db,fmBinding,'0'.repeat(64)),e=>e.safeCode==='PA_CONFIGURATION_STATE_DRIFT');
    const sharedPhysicalRole=await db.userRole.create({data:{companyId:fixture.companyId,userId:prepared.actors.NANCY.userId,roleId:prepared.actors.BEN.roleId}});
    try{await assert.rejects(configureSubcontract(db,fmBinding,digest(await fm03Snapshot(db))),e=>e.safeCode==='PA_ROLE_MEMBERSHIP_MUST_BE_EXCLUSIVE');}
    finally{await db.userRole.delete({where:{id:sharedPhysicalRole.id}});}
    assert.equal(digest(await fm03Snapshot(db)),digest(physicalBefore));
    phase='SUBCONTRACT_CONFIGURATION';const physicalConfig=await configureSubcontract(db,fmBinding,digest(physicalBefore));
    phase='SUBCONTRACT_CANONICAL_SOURCE';const physicalSource=await prepareSubcontractSource(db,fmBinding,physicalConfig,origins);
    phase='SUBCONTRACT_ACTUAL_BROWSER';const downloadRoot=join(temporary,'physical-downloads');await mkdir(downloadRoot,{mode:0o700});
    browser=await startBrowser(chrome,temporary);
    const physicalResult=await executePhysicalBrowser(browser.protocol,subcontractBrowserBinding(fmBinding,physicalConfig,physicalSource,origins,downloadRoot,
      {userId:fixture.adminUserId,email:'proto-admin@example.invalid',password:adminPassword}),db);
    await browser.stop();browser=undefined;
    phase='SUBCONTRACT_PRESERVATION';verifySubcontractPreservation(physicalBefore,await fm03Snapshot(db),physicalConfig,fmBinding,physicalSource,physicalResult);
    console.log('SUBCONTRACT_POPULATED_ENGINE_NATIVE_PASS: prior material/FM03/receiving/partial-transfer preserved; exact synthetic grants; canonical Khaimook agreement/WO and independent Ben approvals; shared real browser capture/evidence/8 accepted/2 held/explicit731.25/certification/Nancy approval/retention36.56, locales/denials/download/retries/revocation. Disposable CI only, not Mac execution or final recovery/freeze.');
    phase='UOM_BASELINE';const uomBefore=await fm03Snapshot(db);
    await assert.rejects(configureUom(db,fmBinding,'0'.repeat(64)),e=>e.safeCode==='UOM_CONFIGURATION_STATE_DRIFT');
    phase='UOM_CONFIGURATION';const uomConfiguration=await configureUom(db,fmBinding,digest(uomBefore));
    await assert.rejects(configureUom(db,fmBinding,digest(await fm03Snapshot(db))),e=>e.safeCode==='UOM_CONFIGURATION_ALREADY_STARTED');
    phase='UOM_NEW_MASTER';const uomSource=await prepareUomSource(db,fmBinding,origins);
    phase='UOM_ACTUAL_BROWSER';browser=await startBrowser(chrome,temporary);
    await executeMaterialUomBrowser(browser.protocol,uomBrowserBinding(fmBinding,uomSource,origins,
      {userId:fixture.adminUserId,email:'proto-admin@example.invalid',password:adminPassword}),db);
    await browser.stop();browser=undefined;
    phase='UOM_ACTIVATION_DENIAL';assert.equal((await verifyUomActivationDenial(db,fmBinding,uomSource,origins)).activationDenied,true);
    phase='UOM_PRIOR_PROTECTED_READBACK';
     const priorReadback=await verifyUomPriorProtectedReadback(db,fmBinding,origins,
       {userId:fixture.adminUserId,email:'proto-admin@example.invalid',password:adminPassword});
     assert.equal(priorReadback.priorProtectedDocumentReadbackVerified,true);
     phase='UOM_PRESERVATION';verifyUomPreservation(uomBefore,await fm03Snapshot(db),uomConfiguration,fmBinding,uomSource);
     phase='UOM_CONVERTED_RECEIVING';const receipt=await convertedReceiving(db,fmBinding,uomSource,origins);
     assert.equal(receipt.convertedReceivingVerified,true);
     console.log('UOM_CONVERTED_RECEIVING_NATIVE_PASS: synthetic new material only, approved PR/PO, Jai evidence check and Khaimook GR, three good cartons posted as 60 stock pieces, prior documents/Finance/stock preserved. Not full plan/request/issue/Mac/M7 proof.');
    console.log('UOM_POPULATED_ENGINE_NATIVE_PASS: same guarded definition browser kernel; prior stock/Finance/subcontract/partial-transfer/signed-file history and grants preserved; explicit new synthetic master/definition capability, dated20-to24 revisions, dropped-response retry, three locales/mobile/read-only/technical denials and sessions revoked. Not actual Mac execution, converted stock journey or final M7 recovery/freeze.');
  }catch(e){
    console.error('MATERIAL_RUN_NATIVE_FAILED: '+phase+' '+(/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'NATIVE_ASSERTION_OR_SETUP_FAILED')+
      (e.cleanupFailed===true?' CLEANUP_ALSO_FAILED':''));
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
