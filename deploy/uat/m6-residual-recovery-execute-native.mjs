// Event294 one-shot native continuation. The original failed attempt is immutable.
import {constants} from 'node:fs';
import {open,mkdir,lstat,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {directory,json,read,chain,noListener} from './m6-residual-recovery-observe-native.mjs';
import {recoveryAnchor as a,hasEvent294Authority,validateRecoveredDispatch} from './m6-residual-recovery-authority.mjs';
import {identifyRecoveredArtifacts,expectedRecoveryArtifacts,summarizeRecoveryLog,committedPrefix} from './m6-residual-recovery-evidence.mjs';
import {inventory,verifyRuntimePair} from './m6-runtime-evidence.mjs';
import {readCheckoutIdentity,inspectPostM4} from './m6-post-m4-inspect.mjs';
import {loadM4ProcessReceipts,createMacObservation} from './m6-mac-observation.mjs';
import {validConfig,validContainer,SOURCE} from './prototype-actors.mjs';
import {validPrivateActors,validActorReceipt} from './prototype-browser-operator.mjs';
import {verifyCommonCandidate} from './m6-common-successor.mjs';
import {captureSuccessorDatabase} from './m6-successor-upgrade-operator.mjs';
import {migrationSources} from './m6-historical-backup.mjs';
import {observeSuccessorMigrations,readSuccessorSources} from './m6-successor-migrations.mjs';
import {captureFixtureRows} from './m6-successor-fixture-writer.mjs';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
import {captureSuccessorAuthPreservation} from './m6-successor-auth-preservation.mjs';
import {verifyRateBucketAdmission} from './m6-operational-admission.mjs';
import {event284Specs} from './m6-residual-role-plan.mjs';
import {syntheticResidualPdf} from './m6-residual-executable-contract.mjs';
import {planResidualSupplierSources,createResidualSupplierSourceJourney,supplierSourceDigest} from './m6-residual-supplier-source.mjs';
import {selectSupplierDenialTarget,verifyPriorSupplierScopeSources,verifySupplierScopeProof} from './m6-residual-denial-target.mjs';
import {createResidualSupplierTransport} from './m6-residual-supplier-transport.mjs';
import {createResidualJourneyTransport} from './m6-residual-journey-transport.mjs';
import {createSupplierCanonicalJourney,supplierBindingDigest} from './m6-supplier-canonical-journey.mjs';
import {createResidualPhaseEvidence} from './m6-residual-phase-evidence.mjs';
import {createRecoveryFileRegistry} from './m6-residual-recovery-files.mjs';
import {createResidualSessionCustody} from './m6-residual-session-custody.mjs';
import {createSuccessorSessionBatch} from './m6-successor-session-batch.mjs';
import {withSuccessorRuntime} from './m6-successor-runtime.mjs';
import {discoverResidualBrowser,runResidualBrowser} from './m6-residual-browser.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RECOVERY_ENTRY_'+c),{safeCode:'M6_RECOVERY_ENTRY_'+c});};
const hash=x=>createHash('sha256').update(x).digest('hex'),digest=x=>hash(JSON.stringify(x)),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const names=['BEN','FOREMAN','JAI','KHAIMOOK','STORE_SITE'],kinds=['documents','uploads','hrkeys'],keys=['dispatch','ack','transit','delay','handover'];
const oldCandidate={sha:a.previousApplicationSha,tree:'8152b5ac627325c91c36ed65875791966a1a8874',syntheticOnly:true,rehearsalOnly:true,productionAuthorized:false};
const safe=e=>/^(M6_|BROWSER_)[A-Z0-9_]{1,100}$/.test(e?.safeCode??'')?e.safeCode:'M6_RECOVERY_ENTRY_PRIVATE_FAILURE';
async function ro(db,database,fn){return db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const x=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");need(x.length===1&&x[0].db===database&&x[0].role==='proto_runtime'&&x[0].ro==='on'&&x[0].isolation==='repeatable read','DATABASE');return fn(tx);},{isolationLevel:'RepeatableRead',timeout:120000});}
async function absent(p){try{await lstat(p);need(false,'NO_REPLAY');}catch(e){if(e.code!=='ENOENT')throw e;}}
async function syncDir(p){const f=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW);try{await f.sync();}finally{await f.close();}}
async function exclusive(root,name,value){await directory(root);const bytes=Buffer.from(JSON.stringify(value)+'\n');need(bytes.length<=1048576,'RECEIPT_SIZE');const f=await open(join(root,name),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await f.writeFile(bytes);await f.sync();}finally{bytes.fill(0);await f.close();}await syncDir(root);}
export function terminalRecoveryProof({session,files,browser,supplier,preserved,receiptBinding}){
 need(session?.historicalSessionRowsPreserved===134&&session.newSessionsRevoked===5&&session.nonSessionRowsMatchedTerminal===true&&files?.documentFilesAdded===4&&files.recoveredFilesAdopted===2&&files.totalResidualFiles===6,'TERMINAL_CUSTODY');
 need(browser?.status==='M6_RESIDUAL_BROWSER_PASS'&&browser.browserVerified===true&&browser.actors===5&&browser.ss08SignedReceiptRendered===true&&browser.fm02WeightedProgressRendered===true&&browser.supplierReturnCustodyRendered===true&&browser.additionalLogins===0&&browser.businessMutationsPerformed===false&&browser.productionAuthorized===false,'BROWSER_PROOF');
 need(supplier?.status==='M6_SUPPLIER_CANONICAL_RETURN_VERIFIED'&&supplier.events===7&&supplier.canonicalApiVerified===true&&supplier.stockEffect===false&&supplier.financeEffect===false&&supplier.replacementJourneyVerified===false&&verifySupplierScopeProof(supplier),'SUPPLIER_PROOF');
 need(preserved?.retainedDatabaseAndFilesUnchanged===true&&preserved.recoveryCopyUnchanged===true&&preserved.failedAttemptUnchanged===true&&preserved.zeroActiveSessions===true&&preserved.listenerPortsReleased===true&&preserved.sessionRows===139&&hex(preserved.terminalSnapshotSha256)&&session.terminalSnapshotSha256===preserved.terminalSnapshotSha256&&hex(receiptBinding?.planSha256),'PRESERVATION');
 return {...receiptBinding,...session,...files,...preserved,browserVerified:true,browserActors:5,additionalLogins:0,ss08SignedReceiptRendered:true,fm02WeightedProgressRendered:true,fm02WeightedPercent:'40.00',supplierReturnCustodyRendered:true,supplierCanonicalApiVerified:true,supplierLifecycleEvents:7,supplierReplacementJourneyVerified:false,supplierDenialKind:supplier.supplierDenialKind,foreignOrderDenied:supplier.foreignOrderDenied,absentOrderDenied:supplier.absentOrderDenied,priorNativeScopeEvidenceReused:supplier.priorNativeScopeEvidenceReused,priorNativeScopeReceipt:supplier.priorNativeScopeReceipt,committedPhasesPreserved:[...committedPrefix],executionVerified:true,milestone6Accepted:false,humanUatCompleted:false,productionAuthorized:false,automaticRetryAllowed:false,secretsPrinted:false};
}
// Source IDs come only from the exact observed post-failure census, never from a new write.
async function observeSources(tx,{fixture:f,actors,files,artifacts,root}){
 const snapshot=await captureFixtureRows(tx);need(digest(snapshot)===a.snapshotSha256&&snapshot.user_sessions.length===134&&snapshot.po_dispatch_events.length===0,'SNAPSHOT');await requireNoLiveSessions(tx);
 const scope={companyId:f.companyId,projectId:f.projectId},prior=files.documents.recovery,current=files.documents.current,old=new Set(prior.map(x=>x[0])),added=current.filter(x=>!old.has(x[0])).map(x=>x[0]);
 const docs=await tx.document.findMany({where:{storageKey:{in:added}},include:{links:true,documentType:true},take:3});
 const recovered=identifyRecoveredArtifacts({recovery:prior,current,documents:docs,fixture:f,actorIds:{JAI:actors.JAI.userId,STORE_SITE:actors.STORE_SITE.userId}});
 const roster={},specs=event284Specs(true);
 for(const key of names){const actor=actors[key],u=await tx.user.findUnique({where:{id:actor.userId},include:{company:true,employee:true,userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});const expected=['PROTO_'+key,...(key==='BEN'?['MANAGEMENT']:key==='JAI'?['PROCUREMENT_OFFICER']:key==='KHAIMOOK'?['PROJECT_MANAGER']:key==='STORE_SITE'?['STOREKEEPER']:[])].sort();
  need(u?.companyId===f.companyId&&u.id!==f.adminUserId&&u.isActive===true&&u.company?.isActive===true&&u.company.companyCode==='PROTO_A'&&u.email===actor.email&&u.email==='proto-'+key.toLowerCase()+'@example.invalid'&&u.employeeId===actor.employeeId&&u.employee?.companyId===f.companyId&&u.employee.isActive===true&&/^[a-f0-9]{64}$/.test(actor.password)&&u.userRoles.every(x=>x.companyId===f.companyId&&x.role.companyId===f.companyId&&x.role.isActive===true)&&same(u.userRoles.map(x=>x.role.roleCode).sort(),expected)&&u.userRoles.some(x=>x.roleId===actor.roleId),'ACTOR');
  const permissions=[...new Set(u.userRoles.flatMap(x=>x.role.rolePermissions.map(y=>y.permission.permissionCode)))].sort();need((specs.find(x=>x[0]===key)?.[2]??[]).every(x=>permissions.includes(x)),'ROLE');roster[key]={userId:u.id,companyId:u.companyId,email:u.email,password:actor.password,roleCodes:expected,permissions};
 }
 const project=await tx.project.findUnique({where:{id:f.projectId},include:{members:true}});need(project?.companyId===f.companyId&&project.projectCode==='SITE_A'&&project.isActive===true&&names.every(key=>roster[key].permissions.includes('projects.access_all')||project.members.some(x=>x.employeeId===actors[key].employeeId&&x.isActive===true)),'PROJECT');
 const order=await tx.purchaseOrder.findUnique({where:{id:recovered.dispatch.entityId},include:{approvalInstance:true,nextRevision:true}});
 const receiving=await json(join(root,'receiving-upgrade','source-journey-private.json'));need(receiving.status==='RECEIVING_BROWSER_JOURNEY_VERIFIED'&&uuid(receiving.deliveryId),'RECEIVING_RECEIPT');
 const delivery=await tx.receivingDelivery.findUnique({where:{id:receiving.deliveryId},include:{replacement:true,lines:{include:{purchaseOrderLine:true}},evidence:{include:{replacement:true,document:{include:{links:true}}}}}});
 const dispatchDoc=docs.find(x=>x.id===recovered.dispatch.id),receiptDoc=docs.find(x=>x.id===recovered.receipt.id);need(dispatchDoc.documentTypeId===receiptDoc.documentTypeId,'DOCUMENT_TYPE');
 const plan=planResidualSupplierSources({binding:{...scope,orderId:recovered.dispatch.entityId,deliveryId:receiving.deliveryId,observed:'4.0000',good:'3.0000'},order,delivery,lines:(delivery?.lines??[]).map(x=>({...x,observedQuantity:String(x.observedQuantity),goodQuantity:String(x.goodQuantity)})),evidence:delivery?.evidence??[],dispatchEvents:[],roster,documentType:dispatchDoc.documentType,artifacts});
 need(await tx.auditLog.count({where:{companyId:f.companyId,entityType:'SUPPLIER_DELIVERY_CASE',entityId:plan.orderId}})===0,'SUPPLIER_ALREADY_STARTED');
 const request=await tx.materialRequest.findUnique({where:{id:recovered.receipt.entityId}}),receipts=await tx.materialRequestReceipt.findMany({where:{requestId:recovered.receipt.entityId,documentId:recovered.receipt.id},take:2});
 need(request?.companyId===f.companyId&&request.projectId===f.projectId&&request.version===3&&receipts.length===1&&receipts[0].supersedesReceiptId===null,'SS08');
 const link=await tx.materialRequestIssueLink.findUnique({where:{id:receipts[0].issueLinkId}}),item=link&&await tx.materialIssueItem.findUnique({where:{id:link.materialIssueItemId}}),issue=item&&await tx.materialIssue.findUnique({where:{id:item.materialIssueId}});need(link?.requestId===request.id&&issue?.companyId===f.companyId&&issue.projectId===f.projectId&&!issue.reversedAt,'SS08_ISSUE');
 const progress=await tx.projectProgressPlan.findMany({where:scope,include:{lines:true},take:2});need(progress.length===1&&progress[0].versionNo===1&&progress[0].confirmedByUserId===roster.BEN.userId&&progress[0].lines.length===2,'FM02');
 const q=progress[0].lines.find(x=>x.sourceKind==='QUANTITY'),m=progress[0].lines.find(x=>x.sourceKind==='MILESTONE');need(uuid(q?.activityId)&&uuid(m?.activityId)&&Number(q.weightPercent)===60&&Number(m.weightPercent)===40,'FM02_LINES');
 const activities=await tx.activity.findMany({where:{...scope,id:{in:[q.activityId,m.activityId]}}});need(activities.length===2&&activities.some(x=>x.id===q.activityId&&x.activityCode==='M6-RESIDUAL-266-Q')&&activities.some(x=>x.id===m.activityId&&x.activityCode==='M6-RESIDUAL-266-M'),'FM02_ACTIVITY');
 const denial=await selectSupplierDenialTarget(tx,f,plan.orderId);need(same(snapshot,await captureFixtureRows(tx)),'SOURCE_DRIFT');
 return {snapshot,recovered,roster,plan,denial,ss08Ids:{requestId:request.id,issueId:issue.id},fm02Ids:{planId:progress[0].id},quantityActivityId:q.activityId,milestoneActivityId:m.activityId};
}
async function nativeAdmission({application,operatorSha,buildSha256},consume){
 need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(k))&&sha(operatorSha)&&hex(buildSha256)&&resolve(application)===application,'MAC');
 const source=resolve(fileURLToPath(new URL('../../',import.meta.url))),operator=await readCheckoutIdentity(source),app=await readCheckoutIdentity(application);need(operator.sha===operatorSha&&operator.clean&&app.sha===a.correctedApplicationSha&&app.clean&&source!==application,'CHECKOUT');
 const apiInventory=await inventory(join(application,'apps/api/dist'),{privateRoot:false});need(digest(apiInventory)===buildSha256&&(await lstat(join(application,'apps/api/dist/main.js'))).isFile(),'BUILD');
 const root=join(homedir(),'Construction-ERP-Prototype-Runtime'),parentStage=join(root,'m6-successor-'+a.previousApplicationSha),recovery=join(parentStage,'recovery'),priorRuntime=join(parentStage,'event266-residual-runtime'),priorAttempt=join(parentStage,'event266-residual-execution'),attempt=join(parentStage,'event294-residual-continuation'),stage=join(parentStage,'event294-residual-continuation-runtime');
 for(const p of [root,parentStage,recovery,priorRuntime,priorAttempt])await directory(p);await absent(attempt);await absent(stage);need(noListener(33072)&&noListener(44172),'PORTS');
 const receipt=await chain(priorAttempt);need(receipt.attemptSha256===a.attemptSha256&&receipt.blockedSha256===a.blockedSha256,'ANCHOR');
 const logBytes=await read(join(priorRuntime,'api.log'),16777216),logSha=hash(logBytes);let log;try{log=summarizeRecoveryLog(logBytes.toString('utf8'));}finally{logBytes.fill(0);}
 need(same(log.auth,{login201:5,logout204:5,me401:5})&&same(log.supplierHttp,[{route:'PUR07_GET',status:200},{route:'SUPPLIER_UPLOAD',status:201},{route:'SUPPLIER_DOWNLOAD',status:404}]),'LOG');
 const cfg=await json(join(root,'runtime-private.json')),manifest=await json(join(root,'prototype-target.json')),containerReceipt=await json(join(root,'container-owned.json')),privateActors=await json(join(root,'actors-private.json')),actorReceipt=await json(join(root,'actors-ready.json')),fixture=await json(join(root,'actors-fixture-private.json'));
 need(validConfig(cfg)&&validPrivateActors(privateActors)&&validActorReceipt(actorReceipt)&&manifest.expectedMainSha===SOURCE&&manifest.mode==='isolated-synthetic'&&manifest.productionConnected===false&&manifest.retainedDataUsed===false&&manifest.realCompanyGrantsModified===false&&manifest.runtime?.isolationRoot===root&&manifest.runtime.databaseRoot===join(root,'db')&&manifest.runtime.documentsRoot===join(root,'documents')&&manifest.runtime.hrKeysRoot===join(root,'hrkeys')&&manifest.runtime.postgresDbName==='proto_a_01'&&manifest.runtime.postgresHost==='127.0.0.1'&&manifest.runtime.postgresPort===55471,'MANIFEST');
 const sealed=await json(join(parentStage,'rehearsal-ready.json'));verifyCommonCandidate(oldCandidate,sealed);need(sealed.historicalTablesPreserved===172,'REHEARSAL');
 const historical=join(root,'m4-upgrade-9417f07c','rehearsal','application'),expected=await loadM4ProcessReceipts(root,historical),observe=createMacObservation({root,application:historical,expected,containerReceipt,validContainer});
 const files={};for(const k of kinds){const baseline=await inventory(join(recovery,k)),current=await inventory(join(priorRuntime,k));need(same(baseline,await inventory(join(root,k))),'RETAINED_FILES');files[k]={recovery:baseline,current};}
 const recoveryInventory=await inventory(recovery),priorReceiptInventory=await inventory(priorAttempt),priorWebInventory=await inventory(join(priorRuntime,'web'),{privateRoot:false});need(same(priorWebInventory,await inventory(join(parentStage,'operational-batch','web'),{privateRoot:false})),'WEB_HISTORY');
 const verifyCustody=async()=>{await inspectPostM4(root);verifyRuntimePair(expected,await observe(),historical,process.execPath,process.getuid());need(same(operator,await readCheckoutIdentity(source))&&same(app,await readCheckoutIdentity(application)),'CHECKOUT_DRIFT');};
 const verifyFiles=async()=>{await verifyCustody();need(same(apiInventory,await inventory(join(application,'apps/api/dist'),{privateRoot:false}))&&same(recoveryInventory,await inventory(recovery))&&same(priorReceiptInventory,await inventory(priorAttempt))&&same(receipt,await chain(priorAttempt))&&same(priorWebInventory,await inventory(join(priorRuntime,'web'),{privateRoot:false}))&&same(priorWebInventory,await inventory(join(parentStage,'operational-batch','web'),{privateRoot:false})),'CUSTODY_DRIFT');for(const k of kinds)need(same(files[k].current,await inventory(join(priorRuntime,k)))&&same(files[k].recovery,await inventory(join(root,k))),'FILES_DRIFT');const bytes=await read(join(priorRuntime,'api.log'),16777216);try{need(hash(bytes)===logSha,'LOG_DRIFT');}finally{bytes.fill(0);}};
 const {PrismaClient,Prisma}=createRequire(join(application,'apps/api/package.json'))('@prisma/client');need(Prisma.prismaVersion.client==='6.19.3','PRISMA');const client=database=>new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+cfg.databasePassword+'@127.0.0.1:55471/'+database+'?schema=public'}},log:[]});const db=client('m6_successor_rehearsal'),retained=client('proto_a_01');
 try{await verifyFiles();await observeSuccessorMigrations({db,expectedDatabase:'m6_successor_rehearsal',expectedRole:'proto_runtime',predecessor:await migrationSources(historical),sources:await readSuccessorSources(application)});
  const fixtureReceipt=await json(join(parentStage,'event237-fixture','committed-private.json'),33554432);need(fixtureReceipt.planSha256==='29dc83568b79bdb7d0b08fbd37bf8b5c8d7b1a4a8cc55549edf3ec2c67a02322','FIXTURE_RECEIPT');
  await ro(retained,'proto_a_01',async tx=>{await requireNoLiveSessions(tx);const tables=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(x=>x.tablename);need(tables.length===173&&tables.every(t=>/^[a-z_][a-z0-9_]*$/.test(t)),'RETAINED_TABLES');for(const t of tables.filter(t=>t!=='_prisma_migrations')){const rows=await tx.$queryRawUnsafe("SELECT encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AS hash FROM public.\""+t+"\" t LIMIT 10001");need(rows.length<=10000&&same(rows.map(x=>x.hash).sort(),fixtureReceipt.before[t]),'RETAINED_BASELINE');}});
  const retainedBefore=await captureSuccessorDatabase(retained,'proto_a_01',177),verifyRetained=async()=>{await verifyFiles();need(same(retainedBefore,await captureSuccessorDatabase(retained,'proto_a_01',177)),'RETAINED_DRIFT');};
  const allArtifacts=expectedRecoveryArtifacts(),artifacts=Object.fromEntries(keys.map(k=>[k,allArtifacts[k]])),data=await ro(db,'m6_successor_rehearsal',tx=>observeSources(tx,{fixture,actors:privateActors.actors,files,artifacts,root}));if(data.denial.priorEvidence)await verifyPriorSupplierScopeSources(application);
  const quiescent=async()=>{await verifyCustody();await ro(db,'m6_successor_rehearsal',requireNoLiveSessions);};
  const verifyBeforeSessions=async()=>{await quiescent();await ro(db,'m6_successor_rehearsal',async tx=>need(digest(await captureFixtureRows(tx))===a.snapshotSha256,'BASELINE_DRIFT'));verifyRateBucketAdmission(await captureSuccessorAuthPreservation(db));};
  await verifyBeforeSessions();await verifyRetained();
  return await consume({candidate:{sha:app.sha,tree:app.tree,syntheticOnly:true,rehearsalOnly:true,productionAuthorized:false},operatorSha,application,parentStage,recovery,priorRuntime,attempt,stage,fixture,db,inventory,captureFixtureRows,verifyCustody,verifyBeforeSessions,verifyRetained,quiescent,password:cfg.databasePassword,readKeyring:json,priorWebRoot:join(parentStage,'operational-batch','web'),recoveryContinuation:true,data,buildSha256});
 }finally{await db.$disconnect();await retained.$disconnect();}
}
export async function runRecoveryBatch({ctx,authorization,actorIds,binding,selection,artifacts,receiptBytes,revisedDate,mark,seal},adapters){
 const {data:d,operatorSha,fixture:f,candidate}=ctx;
 const {createRecoveryFileRegistry,createResidualSessionCustody,withSuccessorRuntime,createSuccessorSessionBatch,createResidualPhaseEvidence,createResidualSupplierTransport,createResidualSupplierSourceJourney,supplierSourceDigest,createResidualJourneyTransport,createSupplierCanonicalJourney,supplierBindingDigest,runResidualBrowser}=adapters;
 let sessionProof,fileProof,browserProof,supplierProof,terminalSnapshot;
  const files=createRecoveryFileRegistry({ctx,plan:d.plan,roster:d.roster,authorization,recoveredDispatch:d.recovered.dispatch,recoveredReceipt:d.recovered.receipt});
  const session=createResidualSessionCustody({db:ctx.db,captureFixtureRows,verifyCustody:ctx.verifyCustody,actorIds,recoveryAuthorization:authorization});
  await withSuccessorRuntime({application:ctx.application,stage:ctx.stage,recovery:ctx.recovery,reuseWebRoot:ctx.priorWebRoot,password:ctx.password,readKeyring:ctx.readKeyring,inventory,verifyCustody:ctx.verifyCustody,verifyBeforeSessions:ctx.verifyBeforeSessions,residualDocuments:files,recoveryContinuation:{priorRuntime:ctx.priorRuntime,authorization},callback:async runtime=>{
   await mark('sessions');await session.captureBefore(d.snapshot);
   const batch=createSuccessorSessionBatch({candidate,authorization:{candidateSha:candidate.sha,candidateTree:candidate.tree,database:binding.database,ownerAuthorizedSessions:true,retainedMutationAuthorized:false,productionAuthorized:false,actorIds},origin:runtime.origin,webOrigin:runtime.webOrigin,actors:names.map(k=>d.roster[k]),verifyRuntime:runtime.verifyRuntime,verifyQuiescent:ctx.quiescent});
   await batch(async live=>{
    const before=await session.admitLive(live);await seal('sessions',{historicalRows:134,newRows:5});
    const named=new Map(names.map(k=>[k,live.get(d.roster[k].userId)])),ev=createResidualPhaseEvidence({ctx,runtime,companyId:f.companyId,projectId:f.projectId}),recoveredDispatch=d.recovered.dispatch,recovery={authorization,recoveredDispatch};
    await mark('supplier');const t=createResidualSupplierTransport({plan:d.plan,sessions:named,artifacts,verifyRuntime:runtime.verifyRuntime,recovery});let prepared,sourceSnapshot;
    try{prepared=await createResidualSupplierSourceJourney({plan:d.plan,authorization:{...authorization,planSha256:supplierSourceDigest(d.plan)},operatorSha,verifyBefore:()=>ev.verifyUnchanged(before),verifyRuntime:runtime.verifyRuntime,request:t.request,upload:t.upload,download:t.download,recoveredDispatch,onUploaded:async x=>{await files.registerUploaded(x);await runtime.readFiles();},verifyDelta:async x=>{sourceSnapshot=(await ev.supplierSources({before,...x,recovery})).snapshot;return true;}})();}finally{t.close();}
    need(prepared.newUploads===4&&prepared.newDispatchEvents===2&&prepared.recoveredDispatchId===recoveredDispatch.id&&sourceSnapshot,'SUPPLIER_SOURCES');
    const b={companyId:f.companyId,projectId:f.projectId,orderId:d.plan.orderId,denialOrderId:d.denial.id,supplierDenialTarget:d.denial,...Object.fromEntries(['ackEventId','ackDocumentId','transitDocumentId','delayDocumentId','conditionDocumentId','conditionChecksum','handoverDocumentId','handoverChecksum','originalDeliveryId','originalDeliveryLineId','observedQuantity','goodQuantity','returnQuantity'].map(k=>[k,prepared[k]])),jaiUserId:d.roster.JAI.userId,storeUserId:d.roster.STORE_SITE.userId,pmUserId:d.roster.KHAIMOOK.userId,supplierSignatory:'Synthetic rehearsal signatory',revisedDate};
    const transport=createResidualJourneyTransport({binding:{companyId:f.companyId,projectId:f.projectId,foreignProjectId:f.foreignProjectId,orderId:d.plan.orderId,denialOrderId:d.denial.id,quantityActivityId:d.quantityActivityId,milestoneActivityId:d.milestoneActivityId,documentTypeId:d.plan.documentTypeId,documentSha256:hash(receiptBytes)},sessions:named,verifyRuntime:runtime.verifyRuntime,receiptBytes});
    const request=async x=>{need(x.path==='/procurement/purchase-orders/'+b.orderId+'/supplier-case'||x.path==='/procurement/purchase-orders/'+b.orderId+'/supplier-case/events'||x.method==='GET'&&x.path==='/procurement/purchase-orders/'+b.denialOrderId+'/supplier-case','SUPPLIER_ONLY');return transport.request(x);};
    try{supplierProof=await createSupplierCanonicalJourney({binding:b,authorization:{...authorization,bindingSha256:supplierBindingDigest(b)},operatorSha,request,verifyRuntime:runtime.verifyRuntime,verifySources:()=>ev.verifyUnchanged(sourceSnapshot),verifyDelta:async({events})=>{terminalSnapshot=await ev.supplier({before:sourceSnapshot,binding:b,events});return true;}})();}finally{transport.close();}
    fileProof=files.seal(prepared.expectedFiles);await runtime.readFiles();await seal('supplier',{...supplierProof,...fileProof});
    await mark('browser');browserProof=await runResidualBrowser({ctx,selection,runtime,sessions:live,roster:d.roster,ss08Ids:d.ss08Ids,fm02Ids:d.fm02Ids,supplierBinding:b});need(browserProof.browserVerified===true&&browserProof.actors===5&&browserProof.additionalLogins===0&&browserProof.businessMutationsPerformed===false,'BROWSER');
    await session.sealTerminal(terminalSnapshot);await seal('browser',browserProof);await mark('cleanup');
   });
   sessionProof=await session.verifyCleanup();await runtime.readFiles();
  }});
 return {sessionProof,fileProof,browserProof,supplierProof,terminalSnapshot};
}
async function runRecovery(ctx){
 const {data:d,operatorSha,fixture:f,candidate}=ctx,actorIds=names.map(k=>d.roster[k].userId).sort(),selection=await discoverResidualBrowser();
 const revised=new Date();revised.setUTCDate(revised.getUTCDate()+7);const revisedDate=revised.toISOString().slice(0,10);
 const binding={applicationSha:candidate.sha,applicationTree:candidate.tree,operatorSha,buildSha256:ctx.buildSha256,database:'m6_successor_rehearsal',recoveryAttemptSha256:a.attemptSha256,recoveryBlockedSha256:a.blockedSha256,recoverySnapshotSha256:a.snapshotSha256,sourcePlanSha256:supplierSourceDigest(d.plan),recoveredArtifactsSha256:digest(d.recovered),sourceIdsSha256:digest({ss08:d.ss08Ids,fm02:d.fm02Ids,denial:d.denial}),actorIdsSha256:digest(actorIds),revisedDate,retainedMutationAuthorized:false,productionAuthorized:false,automaticRetryAllowed:false};
 const planSha256=digest(binding),receiptBinding={...binding,planSha256};
 need(process.stdin.isTTY===true&&process.stdout.isTTY===true,'OWNER_INTERACTIVE');
 console.log(JSON.stringify({status:'M6_RECOVERY_EXACT_PLAN_AWAITING_OWNER',...receiptBinding,previousPhases:committedPrefix,priorSessions:134,newSessions:5,newUploads:4,adoptedFiles:2,newDispatchEvents:2,supplierLifecycleEvents:7,retainedMutationAuthorized:false,productionAuthorized:false,secretsPrinted:false},null,2));
 const rl=createInterface({input:process.stdin,output:process.stdout});try{need(await rl.question('Authorize this exact isolated recovery only: EXECUTE '+planSha256+' : ')==='EXECUTE '+planSha256,'OWNER_DECLINED');}finally{rl.close();}
 const authorization={...receiptBinding,ownerAuthorizedEvent294Continuation:true,ownerAuthorizedSupplierSources:true,ownerAuthorizedSupplierJourney:true};
 need(hasEvent294Authority(authorization)&&new Set(actorIds).size===5,'AUTHORITY');validateRecoveredDispatch(d.plan,authorization,d.recovered.dispatch);
 await ctx.verifyBeforeSessions();await ctx.verifyRetained();await absent(ctx.attempt);await absent(ctx.stage);
 await mkdir(ctx.attempt,{mode:0o700});await syncDir(ctx.parentStage);await exclusive(ctx.attempt,'attempt-private.json',receiptBinding);
 let phase='admission',sessionProof,fileProof,browserProof,supplierProof,terminalSnapshot;
 const mark=async(name)=>{phase=name;await exclusive(ctx.attempt,name+'-started-private.json',{...receiptBinding,phase:name});};
 const seal=async(name,proof)=>exclusive(ctx.attempt,name+'-committed-private.json',{...receiptBinding,phase:name,proofSha256:digest(proof)});
 const artifacts=new Map(keys.map(k=>[k,syntheticResidualPdf('M6 SUPPLIER '+(k==='delay'?'DELAY AND CLAIM CORRESPONDENCE':k.toUpperCase())+' REHEARSAL')]));
 const receiptBytes=syntheticResidualPdf('M6 SS08 SIGNED RECEIPT REHEARSAL');
 try{
  ({sessionProof,fileProof,browserProof,supplierProof,terminalSnapshot}=await runRecoveryBatch({ctx,authorization,actorIds,binding,selection,artifacts,receiptBytes,revisedDate,mark,seal},{createRecoveryFileRegistry,createResidualSessionCustody,withSuccessorRuntime,createSuccessorSessionBatch,createResidualPhaseEvidence,createResidualSupplierTransport,createResidualSupplierSourceJourney,supplierSourceDigest,createResidualJourneyTransport,createSupplierCanonicalJourney,supplierBindingDigest,runResidualBrowser}));
  await ctx.verifyRetained();await ctx.quiescent();need(noListener(33072)&&noListener(44172),'PORT_CLEANUP');
  const terminal=await ro(ctx.db,'m6_successor_rehearsal',async tx=>{await requireNoLiveSessions(tx);return captureFixtureRows(tx);});
  need(terminalSnapshot&&Object.keys(terminal).every(t=>t==='user_sessions'||same(terminal[t],terminalSnapshot[t]))&&sessionProof.terminalSnapshotSha256===digest(terminal),'TERMINAL_DRIFT');
  const proof=terminalRecoveryProof({session:sessionProof,files:fileProof,browser:browserProof,supplier:supplierProof,preserved:{retainedDatabaseAndFilesUnchanged:true,recoveryCopyUnchanged:true,failedAttemptUnchanged:true,zeroActiveSessions:true,listenerPortsReleased:true,sessionRows:terminal.user_sessions.length,terminalSnapshotSha256:digest(terminal)},receiptBinding});
  await seal('cleanup',proof);const result={status:'M6_EVENT294_RECOVERY_RECEIPT_SEALED',...proof,finalProofSha256:digest(proof)};await exclusive(ctx.attempt,'ready-private.json',result);return result;
 }catch(e){const blocked={...receiptBinding,phase,safeCode:safe(e),primarySafeCode:/^(M6_|BROWSER_)[A-Z0-9_]{1,100}$/.test(e.primarySafeCode??'')?e.primarySafeCode:null,cleanupCodes:Array.isArray(e.cleanupCodes)?e.cleanupCodes.filter(x=>['WEB_STOP','API_STOP','API_PORT','WEB_PORT','CUSTODY','FILES'].includes(x)):[],mayHaveMutated:true,automaticRetryAllowed:false,productionAuthorized:false};await exclusive(ctx.attempt,'blocked-private.json',blocked);throw Object.assign(Error(blocked.safeCode),blocked);}
 finally{receiptBytes.fill(0);for(const bytes of artifacts.values())bytes.fill(0);}
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===await realpath(new URL(import.meta.url))){
 try{need(process.argv.length===6&&process.argv[2]==='--execute-reviewed-event294','ARGS');console.log(JSON.stringify(await nativeAdmission({operatorSha:process.argv[3],application:process.argv[4],buildSha256:process.argv[5]},runRecovery),null,2));}
 catch(e){console.log(JSON.stringify({status:'M6_EVENT294_RECOVERY_BLOCKED',safeCode:safe(e),phase:typeof e.phase==='string'&&['admission','sessions','supplier','browser','cleanup'].includes(e.phase)?e.phase:null,primarySafeCode:/^(M6_|BROWSER_)[A-Z0-9_]{1,100}$/.test(e.primarySafeCode??'')?e.primarySafeCode:null,cleanupCodes:Array.isArray(e.cleanupCodes)?e.cleanupCodes.filter(x=>['WEB_STOP','API_STOP','API_PORT','WEB_PORT','CUSTODY','FILES'].includes(x)):[],automaticRetryAllowed:false,mutationState:'CHECK_DURABLE_ATTEMPT',milestone6Accepted:false,productionAuthorized:false,secretsPrinted:false},null,2));process.exitCode=1;}
}
