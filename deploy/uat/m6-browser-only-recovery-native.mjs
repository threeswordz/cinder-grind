// Event294 one-shot native continuation. The original failed attempt is immutable.
import {constants} from 'node:fs';
import {open,mkdir,lstat,realpath,readdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {directory,json,read,chain,noListener} from './m6-residual-recovery-observe-native.mjs';
import {recoveryAnchor as a} from './m6-residual-recovery-authority.mjs';
import {identifyRecoveredArtifacts,expectedRecoveryArtifacts,summarizeRecoveryLog} from './m6-residual-recovery-evidence.mjs';
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
import {planResidualSupplierSources} from './m6-residual-supplier-source.mjs';
import {selectSupplierDenialTarget,verifyPriorSupplierScopeSources,supplierScopeProof} from './m6-residual-denial-target.mjs';
import {createResidualSessionCustody,browserRecoveryAnchor as b,hasBrowserOnlyAuthority} from './m6-residual-session-custody.mjs';
import {createSuccessorSessionBatch} from './m6-successor-session-batch.mjs';
import {withSuccessorRuntime} from './m6-successor-runtime.mjs';
import {discoverResidualBrowser,runResidualBrowser} from './m6-residual-browser.mjs';

import {verifyResidualDocumentDelta} from './m6-residual-document-delta.mjs';
import {readRecoveredReceiving} from './m6-residual-recovery-execute-native.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_BROWSER_ONLY_'+c),{safeCode:'M6_BROWSER_ONLY_'+c});};
const hash=x=>createHash('sha256').update(x).digest('hex'),digest=x=>hash(JSON.stringify(x)),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const names=['BEN','FOREMAN','JAI','KHAIMOOK','STORE_SITE'],kinds=['documents','uploads','hrkeys'],keys=['dispatch','ack','transit','delay','handover'];
const oldCandidate={sha:a.previousApplicationSha,tree:'8152b5ac627325c91c36ed65875791966a1a8874',syntheticOnly:true,rehearsalOnly:true,productionAuthorized:false};
const safe=e=>/^(M6_|BROWSER_)[A-Z0-9_]{1,100}$/.test(e?.safeCode??'')?e.safeCode:'M6_BROWSER_ONLY_PRIVATE_FAILURE';
async function ro(db,database,fn){return db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const x=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");need(x.length===1&&x[0].db===database&&x[0].role==='proto_runtime'&&x[0].ro==='on'&&x[0].isolation==='repeatable read','DATABASE');return fn(tx);},{isolationLevel:'RepeatableRead',timeout:120000});}
async function absent(p){try{await lstat(p);need(false,'NO_REPLAY');}catch(e){if(e.code!=='ENOENT')throw e;}}
async function syncDir(p){const f=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW);try{await f.sync();}finally{await f.close();}}
async function exclusive(root,name,value){await directory(root);const bytes=Buffer.from(JSON.stringify(value)+'\n');need(bytes.length<=1048576,'RECEIPT_SIZE');const f=await open(join(root,name),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await f.writeFile(bytes);await f.sync();}finally{bytes.fill(0);await f.close();}await syncDir(root);}
export function verifyBrowserRecoveryChain({priorBinding:p,blocked,phaseReceipts,names:entries}){
 const {planSha256,...binding}=p??{};
 need(planSha256===b.previousPlanSha256&&digest(binding)===planSha256&&p.applicationSha===b.applicationSha&&p.applicationTree===b.applicationTree&&p.operatorSha===b.previousOperatorSha&&p.buildSha256===b.buildSha256&&p.database==='m6_successor_rehearsal'&&p.recoveryAttemptSha256===a.attemptSha256&&p.recoveryBlockedSha256===a.blockedSha256&&p.recoverySnapshotSha256===a.snapshotSha256&&p.retainedMutationAuthorized===false&&p.productionAuthorized===false&&p.automaticRetryAllowed===false,'PREVIOUS_PLAN');
 const expected=['sessions-started','sessions-committed','supplier-started','supplier-committed','browser-started'];
 need(same(Object.keys(phaseReceipts).sort(),[...expected].sort())&&same([...entries].sort(),['attempt-private.json','blocked-private.json',...expected.map(k=>k+'-private.json')].sort()),'PREVIOUS_PHASES');
 const bound=x=>x&&Object.keys(p).every(k=>x[k]===p[k]);
 for(const k of expected){const r=phaseReceipts[k];need(bound(r)&&r.phase===k.split('-')[0]&&(k.endsWith('committed')?hex(r.proofSha256):!('proofSha256' in r)),'PHASE_BINDING');}
 need(phaseReceipts['sessions-committed'].proofSha256===digest({historicalRows:134,newRows:5})&&bound(blocked)&&blocked.phase==='browser'&&blocked.safeCode==='M6_RESIDUAL_BROWSER_STORE_SITE_SS08'&&blocked.primarySafeCode===null&&same(blocked.cleanupCodes,[])&&blocked.mayHaveMutated===true&&blocked.automaticRetryAllowed===false,'PREVIOUS_BLOCKED');return true;
}
export function verifyCompletedSupplierLog(log){
 const summary=summarizeRecoveryLog(log);need(same(summary.auth,{login201:5,logout204:5,me401:5}),'PREVIOUS_AUTH');
 const expected=[['PUR07_GET',200],['SUPPLIER_DOWNLOAD',200],...Array.from({length:4},()=>[['SUPPLIER_UPLOAD',201],['SUPPLIER_DOWNLOAD',200]]).flat(),['PUR07_POST',201],['PUR07_POST',201],['PUR07_GET',200],['SUPPLIER_CASE_GET',200],['SUPPLIER_CASE_GET',404],['SUPPLIER_CASE_GET',403],['SUPPLIER_CASE_POST',201],['SUPPLIER_CASE_POST',201],['SUPPLIER_CASE_POST',201],['SUPPLIER_CASE_POST',409],...Array.from({length:4},()=>['SUPPLIER_CASE_POST',201]),['SUPPLIER_CASE_GET',200]];
 need(same(summary.supplierHttp.map(x=>[x.route,x.status]),expected),'PREVIOUS_SUPPLIER_LOG');
 const ids=[];for(const line of log.split('\n')){const i=line.indexOf('{"timestamp"');if(i<0)continue;let e;try{e=JSON.parse(line.slice(i,line.lastIndexOf('}')+1));}catch{continue;}if(e.method==='GET'&&e.status===404&&typeof e.path==='string'){const m=e.path.match(/^\/api\/v1\/procurement\/purchase-orders\/([^/]+)\/supplier-case$/);if(m)ids.push(m[1]);}}
 need(ids.length===1&&uuid(ids[0]),'PREVIOUS_DENIAL');return ids[0];
}
export function verifyCommittedSupplierProof(receipt,denial,orderId){
 const proof={status:'M6_SUPPLIER_CANONICAL_RETURN_VERIFIED',events:7,canonicalApiVerified:true,...supplierScopeProof(denial,orderId),unauthorizedActorDenied:true,staleVersionDenied:true,stockEffect:false,financeEffect:false,replacementJourneyVerified:false,browserVerified:false,productionAuthorized:false,automaticRetryAllowed:false,documentFilesAdded:4,recoveredFilesAdopted:2,totalResidualFiles:6};
 need(receipt?.proofSha256===digest(proof),'PREVIOUS_SUPPLIER_PROOF');return proof;
}
export async function runBrowserOnlyBatch({ctx,authorization,actorIds,selection},adapters){
 need(hasBrowserOnlyAuthority(authorization),'AUTHORITY');
 const {createResidualSessionCustody,createSuccessorSessionBatch,withSuccessorRuntime,runResidualBrowser}=adapters,d=ctx.data;
 const custody=createResidualSessionCustody({db:ctx.db,captureFixtureRows,verifyCustody:ctx.verifyCustody,actorIds,browserAuthorization:authorization});
 let session,browser;
 await withSuccessorRuntime({application:ctx.application,stage:ctx.stage,recovery:ctx.recovery,reuseWebRoot:ctx.priorWebRoot,password:ctx.password,readKeyring:ctx.readKeyring,inventory,verifyCustody:ctx.verifyCustody,verifyBeforeSessions:ctx.verifyBeforeSessions,callback:async runtime=>{
  await custody.captureBefore(d.snapshot);
  const batch=createSuccessorSessionBatch({candidate:ctx.candidate,authorization:{candidateSha:ctx.candidate.sha,candidateTree:ctx.candidate.tree,database:authorization.database,ownerAuthorizedSessions:true,retainedMutationAuthorized:false,productionAuthorized:false,actorIds},origin:runtime.origin,webOrigin:runtime.webOrigin,actors:names.map(k=>d.roster[k]),verifyRuntime:runtime.verifyRuntime,verifyQuiescent:ctx.quiescent});
  await batch(async live=>{const snapshot=await custody.admitLive(live);browser=await runResidualBrowser({ctx,selection,runtime,sessions:live,roster:d.roster,ss08Ids:d.ss08Ids,fm02Ids:d.fm02Ids,supplierBinding:d.supplierBinding});need(browser?.status==='M6_RESIDUAL_BROWSER_PASS'&&browser.browserVerified===true&&browser.actors===5&&browser.ss08SignedReceiptRendered===true&&browser.fm02WeightedProgressRendered===true&&browser.supplierReturnCustodyRendered===true&&browser.additionalLogins===0&&browser.businessMutationsPerformed===false&&browser.productionAuthorized===false,'BROWSER_PROOF');await runtime.readFiles();await custody.sealTerminal(snapshot);});
  session=await custody.verifyCleanup();await runtime.readFiles();
 }});
 return {session,browser};
}
async function observeSources(tx,{fixture:f,actors,files,artifacts,root,currentFiles,priorBinding,denialId}){
 const snapshot=await captureFixtureRows(tx);need(digest(snapshot)===b.snapshotSha256&&snapshot.user_sessions.length===139&&snapshot.po_dispatch_events.length===2,'SNAPSHOT');await requireNoLiveSessions(tx);
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
 const deliveryId=await readRecoveredReceiving(root,recovered.dispatch.entityId);
 const delivery=await tx.receivingDelivery.findUnique({where:{id:deliveryId},include:{replacement:true,lines:{include:{purchaseOrderLine:true}},evidence:{include:{replacement:true,document:{include:{links:true}}}}}});
 const dispatchDoc=docs.find(x=>x.id===recovered.dispatch.id),receiptDoc=docs.find(x=>x.id===recovered.receipt.id);need(dispatchDoc.documentTypeId===receiptDoc.documentTypeId,'DOCUMENT_TYPE');
 const plan=planResidualSupplierSources({binding:{...scope,orderId:recovered.dispatch.entityId,deliveryId,observed:'4.0000',good:'3.0000'},order,delivery,lines:(delivery?.lines??[]).map(x=>({...x,observedQuantity:String(x.observedQuantity),goodQuantity:String(x.goodQuantity)})),evidence:delivery?.evidence??[],dispatchEvents:[],roster,documentType:dispatchDoc.documentType,artifacts});
 need(await tx.auditLog.count({where:{companyId:f.companyId,entityType:'SUPPLIER_DELIVERY_CASE',entityId:plan.orderId}})===7,'SUPPLIER_EVENTS');
 need(digest(plan)===priorBinding.sourcePlanSha256&&digest(recovered)===priorBinding.recoveredArtifactsSha256&&digest(names.map(k=>roster[k].userId).sort())===priorBinding.actorIdsSha256,'SOURCE_BINDING');
 const newKeys=currentFiles.documents.filter(x=>!prior.some(y=>y[0]===x[0])).map(x=>x[0]);need(newKeys.length===6,'ARTIFACT_CENSUS');
 const all=await tx.document.findMany({where:{storageKey:{in:newKeys}},include:{links:true},take:7});
 const specs2=[{...recovered.receipt,actorUserId:roster.STORE_SITE.userId,projectId:f.projectId,entityType:'MATERIAL_REQUEST'},...plan.uploads.map(spec=>{const matches=all.filter(doc=>doc.checksum===spec.sha256&&doc.fileSizeBytes===spec.size);need(matches.length===1,'ARTIFACT_MATCH');return {...spec,id:matches[0].id,projectId:f.projectId};})];
 const baseline=Object.fromEntries(kinds.map(k=>[k,files[k].recovery]));
 verifyResidualDocumentDelta({before:baseline,after:currentFiles,recovery:baseline,expected:specs2,documents:all,companyId:f.companyId});
 need(specs2.find(x=>x.key==='dispatch').id===recovered.dispatch.id,'ADOPTED_DISPATCH');
 const events=await tx.poDispatchEvent.findMany({where:{companyId:f.companyId,projectId:f.projectId,purchaseOrderId:plan.orderId},take:3});
 const send=events.find(x=>x.kind==='DISPATCH'),ack=events.find(x=>x.kind==='ACKNOWLEDGMENT');
 need(events.length===2&&send?.evidenceDocumentId===recovered.dispatch.id&&ack?.evidenceDocumentId===specs2.find(x=>x.key==='ack').id&&ack.acknowledgesEventId===send.id&&events.every(x=>x.recordedByUserId===roster.JAI.userId),'DISPATCH_CHAIN');
 const supplierBinding={orderId:plan.orderId,handoverDocumentId:specs2.find(x=>x.key==='handover').id,returnQuantity:plan.returnQuantity};
 const request=await tx.materialRequest.findUnique({where:{id:recovered.receipt.entityId}}),receipts=await tx.materialRequestReceipt.findMany({where:{requestId:recovered.receipt.entityId,documentId:recovered.receipt.id},take:2});
 need(request?.companyId===f.companyId&&request.projectId===f.projectId&&request.version===3&&receipts.length===1&&receipts[0].supersedesReceiptId===null,'SS08');
 const link=await tx.materialRequestIssueLink.findUnique({where:{id:receipts[0].issueLinkId}}),item=link&&await tx.materialIssueItem.findUnique({where:{id:link.materialIssueItemId}}),issue=item&&await tx.materialIssue.findUnique({where:{id:item.materialIssueId}});need(link?.requestId===request.id&&issue?.companyId===f.companyId&&issue.projectId===f.projectId&&!issue.reversedAt,'SS08_ISSUE');
 const progress=await tx.projectProgressPlan.findMany({where:scope,include:{lines:true},take:2});need(progress.length===1&&progress[0].versionNo===1&&progress[0].confirmedByUserId===roster.BEN.userId&&progress[0].lines.length===2,'FM02');
 const q=progress[0].lines.find(x=>x.sourceKind==='QUANTITY'),m=progress[0].lines.find(x=>x.sourceKind==='MILESTONE');need(uuid(q?.activityId)&&uuid(m?.activityId)&&Number(q.weightPercent)===60&&Number(m.weightPercent)===40,'FM02_LINES');
 const activities=await tx.activity.findMany({where:{...scope,id:{in:[q.activityId,m.activityId]}}});need(activities.length===2&&activities.some(x=>x.id===q.activityId&&x.activityCode==='M6-RESIDUAL-266-Q')&&activities.some(x=>x.id===m.activityId&&x.activityCode==='M6-RESIDUAL-266-M'),'FM02_ACTIVITY');
 const denial=await selectSupplierDenialTarget(tx,f,plan.orderId,()=>denialId);need(denial.id===denialId&&digest({ss08:{requestId:request.id,issueId:issue.id},fm02:{planId:progress[0].id},denial})===priorBinding.sourceIdsSha256,'PRIOR_SOURCE_IDS');need(same(snapshot,await captureFixtureRows(tx)),'SOURCE_DRIFT');
 return {snapshot,recovered,roster,plan,denial,supplierBinding,ss08Ids:{requestId:request.id,issueId:issue.id},fm02Ids:{planId:progress[0].id},quantityActivityId:q.activityId,milestoneActivityId:m.activityId};
}
async function nativeAdmission({application,operatorSha,buildSha256},consume){
 need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(k))&&sha(operatorSha)&&buildSha256===b.buildSha256&&resolve(application)===application,'MAC');
 const source=resolve(fileURLToPath(new URL('../../',import.meta.url))),operator=await readCheckoutIdentity(source),app=await readCheckoutIdentity(application);need(operator.sha===operatorSha&&operator.clean&&app.sha===b.applicationSha&&app.tree===b.applicationTree&&app.clean&&source!==application,'CHECKOUT');
 const apiInventory=await inventory(join(application,'apps/api/dist'),{privateRoot:false});need(digest(apiInventory)===buildSha256&&(await lstat(join(application,'apps/api/dist/main.js'))).isFile(),'BUILD');
 const root=join(homedir(),'Construction-ERP-Prototype-Runtime'),parentStage=join(root,'m6-successor-'+a.previousApplicationSha),recovery=join(parentStage,'recovery'),priorRuntime=join(parentStage,'event266-residual-runtime'),priorAttempt=join(parentStage,'event266-residual-execution'),completedAttempt=join(parentStage,'event294-residual-continuation'),completedRuntime=join(parentStage,'event294-residual-continuation-runtime'),attempt=join(parentStage,'event294-browser-only'),stage=join(parentStage,'event294-browser-only-runtime');
 for(const p of [root,parentStage,recovery,priorRuntime,priorAttempt,completedAttempt,completedRuntime])await directory(p);await absent(attempt);await absent(stage);need(noListener(33072)&&noListener(44172),'PORTS');
 const receipt=await chain(priorAttempt);need(receipt.attemptSha256===a.attemptSha256&&receipt.blockedSha256===a.blockedSha256,'ANCHOR');
 const logBytes=await read(join(priorRuntime,'api.log'),16777216),logSha=hash(logBytes);let log;try{log=summarizeRecoveryLog(logBytes.toString('utf8'));}finally{logBytes.fill(0);}
 need(same(log.auth,{login201:5,logout204:5,me401:5})&&same(log.supplierHttp,[{route:'PUR07_GET',status:200},{route:'SUPPLIER_UPLOAD',status:201},{route:'SUPPLIER_DOWNLOAD',status:404}]),'LOG');
 const completedNames=await readdir(completedAttempt),priorBinding=await json(join(completedAttempt,'attempt-private.json')),blocked=await json(join(completedAttempt,'blocked-private.json'));
 const phaseReceipts={};for(const k of ['sessions-started','sessions-committed','supplier-started','supplier-committed','browser-started'])phaseReceipts[k]=await json(join(completedAttempt,k+'-private.json'));
 verifyBrowserRecoveryChain({priorBinding,blocked,phaseReceipts,names:completedNames});
 const completedLog=await read(join(completedRuntime,'api.log'),16777216);let completedLogSha,denialId;try{completedLogSha=hash(completedLog);denialId=verifyCompletedSupplierLog(completedLog.toString('utf8'));}finally{completedLog.fill(0);}
 const cfg=await json(join(root,'runtime-private.json')),manifest=await json(join(root,'prototype-target.json')),containerReceipt=await json(join(root,'container-owned.json')),privateActors=await json(join(root,'actors-private.json')),actorReceipt=await json(join(root,'actors-ready.json')),fixture=await json(join(root,'actors-fixture-private.json'));
 need(validConfig(cfg)&&validPrivateActors(privateActors)&&validActorReceipt(actorReceipt)&&manifest.expectedMainSha===SOURCE&&manifest.mode==='isolated-synthetic'&&manifest.productionConnected===false&&manifest.retainedDataUsed===false&&manifest.realCompanyGrantsModified===false&&manifest.runtime?.isolationRoot===root&&manifest.runtime.databaseRoot===join(root,'db')&&manifest.runtime.documentsRoot===join(root,'documents')&&manifest.runtime.hrKeysRoot===join(root,'hrkeys')&&manifest.runtime.postgresDbName==='proto_a_01'&&manifest.runtime.postgresHost==='127.0.0.1'&&manifest.runtime.postgresPort===55471,'MANIFEST');
 const sealed=await json(join(parentStage,'rehearsal-ready.json'));verifyCommonCandidate(oldCandidate,sealed);need(sealed.historicalTablesPreserved===172,'REHEARSAL');
 const historical=join(root,'m4-upgrade-9417f07c','rehearsal','application'),expected=await loadM4ProcessReceipts(root,historical),observe=createMacObservation({root,application:historical,expected,containerReceipt,validContainer});
 const files={};for(const k of kinds){const baseline=await inventory(join(recovery,k)),current=await inventory(join(priorRuntime,k));need(same(baseline,await inventory(join(root,k))),'RETAINED_FILES');files[k]={recovery:baseline,current};}
 const recoveryInventory=await inventory(recovery),priorReceiptInventory=await inventory(priorAttempt),priorWebInventory=await inventory(join(priorRuntime,'web'),{privateRoot:false});need(same(priorWebInventory,await inventory(join(parentStage,'operational-batch','web'),{privateRoot:false})),'WEB_HISTORY');
 const completedInventory=await inventory(completedAttempt),completedWeb=await inventory(join(completedRuntime,'web'),{privateRoot:false}),currentFiles=Object.fromEntries(await Promise.all(kinds.map(async k=>[k,await inventory(join(completedRuntime,k))])));need(same(completedWeb,priorWebInventory),'COMPLETED_WEB');
 const verifyCustody=async()=>{await inspectPostM4(root);verifyRuntimePair(expected,await observe(),historical,process.execPath,process.getuid());need(same(operator,await readCheckoutIdentity(source))&&same(app,await readCheckoutIdentity(application)),'CHECKOUT_DRIFT');};
 const verifyFiles=async()=>{await verifyCustody();need(same(apiInventory,await inventory(join(application,'apps/api/dist'),{privateRoot:false}))&&same(recoveryInventory,await inventory(recovery))&&same(priorReceiptInventory,await inventory(priorAttempt))&&same(receipt,await chain(priorAttempt))&&same(priorWebInventory,await inventory(join(priorRuntime,'web'),{privateRoot:false}))&&same(priorWebInventory,await inventory(join(parentStage,'operational-batch','web'),{privateRoot:false})),'CUSTODY_DRIFT');for(const k of kinds)need(same(files[k].current,await inventory(join(priorRuntime,k)))&&same(files[k].recovery,await inventory(join(root,k))),'FILES_DRIFT');need(same(completedInventory,await inventory(completedAttempt))&&same(completedWeb,await inventory(join(completedRuntime,'web'),{privateRoot:false})),'COMPLETED_CUSTODY');for(const k of kinds)need(same(currentFiles[k],await inventory(join(completedRuntime,k))),'COMPLETED_FILES');const cl=await read(join(completedRuntime,'api.log'),16777216);try{need(hash(cl)===completedLogSha,'COMPLETED_LOG_DRIFT');}finally{cl.fill(0);}const bytes=await read(join(priorRuntime,'api.log'),16777216);try{need(hash(bytes)===logSha,'LOG_DRIFT');}finally{bytes.fill(0);}};
 const {PrismaClient,Prisma}=createRequire(join(application,'apps/api/package.json'))('@prisma/client');need(Prisma.prismaVersion.client==='6.19.3','PRISMA');const client=database=>new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+cfg.databasePassword+'@127.0.0.1:55471/'+database+'?schema=public'}},log:[]});const db=client('m6_successor_rehearsal'),retained=client('proto_a_01');
 try{await verifyFiles();await observeSuccessorMigrations({db,expectedDatabase:'m6_successor_rehearsal',expectedRole:'proto_runtime',predecessor:await migrationSources(historical),sources:await readSuccessorSources(application)});
  const fixtureReceipt=await json(join(parentStage,'event237-fixture','committed-private.json'),33554432);need(fixtureReceipt.planSha256==='29dc83568b79bdb7d0b08fbd37bf8b5c8d7b1a4a8cc55549edf3ec2c67a02322','FIXTURE_RECEIPT');
  await ro(retained,'proto_a_01',async tx=>{await requireNoLiveSessions(tx);const tables=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(x=>x.tablename);need(tables.length===173&&tables.every(t=>/^[a-z_][a-z0-9_]*$/.test(t)),'RETAINED_TABLES');for(const t of tables.filter(t=>t!=='_prisma_migrations')){const rows=await tx.$queryRawUnsafe("SELECT encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AS hash FROM public.\""+t+"\" t LIMIT 10001");need(rows.length<=10000&&same(rows.map(x=>x.hash).sort(),fixtureReceipt.before[t]),'RETAINED_BASELINE');}});
  const retainedBefore=await captureSuccessorDatabase(retained,'proto_a_01',177),verifyRetained=async()=>{await verifyFiles();need(same(retainedBefore,await captureSuccessorDatabase(retained,'proto_a_01',177)),'RETAINED_DRIFT');};
  const allArtifacts=expectedRecoveryArtifacts(),artifacts=Object.fromEntries(keys.map(k=>[k,allArtifacts[k]])),data=await ro(db,'m6_successor_rehearsal',tx=>observeSources(tx,{fixture,actors:privateActors.actors,files,artifacts,root,currentFiles,priorBinding,denialId}));verifyCommittedSupplierProof(phaseReceipts['supplier-committed'],data.denial,data.plan.orderId);if(data.denial.priorEvidence)await verifyPriorSupplierScopeSources(application);
  const quiescent=async()=>{await verifyCustody();await ro(db,'m6_successor_rehearsal',requireNoLiveSessions);};
  const verifyBeforeSessions=async()=>{await quiescent();await ro(db,'m6_successor_rehearsal',async tx=>need(digest(await captureFixtureRows(tx))===b.snapshotSha256,'BASELINE_DRIFT'));verifyRateBucketAdmission(await captureSuccessorAuthPreservation(db));};
  await verifyBeforeSessions();await verifyRetained();
  return await consume({candidate:{sha:app.sha,tree:app.tree,syntheticOnly:true,rehearsalOnly:true,productionAuthorized:false},operatorSha,application,parentStage,recovery:completedRuntime,priorRuntime,attempt,stage,fixture,db,inventory,captureFixtureRows,verifyCustody,verifyBeforeSessions,verifyRetained,quiescent,password:cfg.databasePassword,readKeyring:json,priorWebRoot:join(parentStage,'operational-batch','web'),browserOnlyContinuation:true,data,buildSha256,previousAttemptSha256:digest(priorBinding),previousBlockedSha256:digest(blocked),supplierSealSha256:phaseReceipts['supplier-committed'].proofSha256});
 }finally{await db.$disconnect();await retained.$disconnect();}
}
async function runBrowserOnly(ctx){
 const d=ctx.data,actorIds=names.map(k=>d.roster[k].userId).sort(),selection=await discoverResidualBrowser();
 const binding={applicationSha:ctx.candidate.sha,applicationTree:ctx.candidate.tree,operatorSha:ctx.operatorSha,buildSha256:ctx.buildSha256,previousOperatorSha:b.previousOperatorSha,previousPlanSha256:b.previousPlanSha256,snapshotSha256:b.snapshotSha256,previousAttemptSha256:ctx.previousAttemptSha256,previousBlockedSha256:ctx.previousBlockedSha256,supplierSealSha256:ctx.supplierSealSha256,actorIdsSha256:digest(actorIds),sourceIdsSha256:digest({ss08:d.ss08Ids,fm02:d.fm02Ids,supplier:d.supplierBinding}),database:'m6_successor_rehearsal',businessMutationAuthorized:false,retainedMutationAuthorized:false,productionAuthorized:false,automaticRetryAllowed:false};
 const planSha256=digest(binding),receiptBinding={...binding,planSha256};
 need(process.stdin.isTTY===true&&process.stdout.isTTY===true,'OWNER_INTERACTIVE');
 console.log(JSON.stringify({status:'M6_BROWSER_ONLY_AWAITING_OWNER',...receiptBinding,priorSessions:139,newSessions:5,expectedFinalSessions:144,newBusinessTransactions:0,newUploads:0,secretsPrinted:false},null,2));
 const rl=createInterface({input:process.stdin,output:process.stdout});try{need(await rl.question('Authorize this exact browser-only continuation: EXECUTE '+planSha256+' : ')==='EXECUTE '+planSha256,'OWNER_DECLINED');}finally{rl.close();}
 const authorization={...receiptBinding,ownerAuthorizedBrowserOnly:true};need(hasBrowserOnlyAuthority(authorization)&&new Set(actorIds).size===5,'AUTHORITY');
 await ctx.verifyBeforeSessions();await ctx.verifyRetained();await absent(ctx.attempt);await absent(ctx.stage);await mkdir(ctx.attempt,{mode:0o700});await syncDir(ctx.parentStage);await exclusive(ctx.attempt,'attempt-private.json',receiptBinding);
 try{
  const {session,browser}=await runBrowserOnlyBatch({ctx,authorization,actorIds,selection},{createResidualSessionCustody,createSuccessorSessionBatch,withSuccessorRuntime,runResidualBrowser});
  await ctx.verifyRetained();await ctx.quiescent();need(noListener(33072)&&noListener(44172),'PORT_CLEANUP');
  const terminal=await ro(ctx.db,'m6_successor_rehearsal',async tx=>{await requireNoLiveSessions(tx);return captureFixtureRows(tx);});
  need(session?.historicalSessionRowsPreserved===139&&session.newSessionsRevoked===5&&session.nonSessionRowsMatchedTerminal===true&&terminal.user_sessions.length===144&&session.terminalSnapshotSha256===digest(terminal)&&Object.keys(d.snapshot).filter(k=>!['users','user_sessions','login_rate_limit_buckets'].includes(k)).every(k=>same(d.snapshot[k],terminal[k])),'TERMINAL');
  const proof={...receiptBinding,...session,browserVerified:true,browserActors:browser.actors,additionalBrowserLogins:0,ss08SignedReceiptRendered:browser.ss08SignedReceiptRendered,fm02WeightedProgressRendered:browser.fm02WeightedProgressRendered,fm02WeightedPercent:'40.00',supplierReturnCustodyRendered:browser.supplierReturnCustodyRendered,supplierCanonicalApiEvidenceReused:true,supplierLifecycleEvents:7,dispatchEvents:2,totalResidualFiles:6,newBusinessTransactions:0,newUploads:0,businessRowsUnchanged:true,retainedDatabaseAndFilesUnchanged:true,recoveryCopyUnchanged:true,priorAttemptsUnchanged:true,zeroActiveSessions:true,listenerPortsReleased:true,sessionRows:144,executionVerified:true,milestone6Accepted:false,humanUatCompleted:false,productionAuthorized:false,automaticRetryAllowed:false,secretsPrinted:false};
  const result={status:'M6_BROWSER_ONLY_RECOVERY_RECEIPT_SEALED',...proof,finalProofSha256:digest(proof)};await exclusive(ctx.attempt,'ready-private.json',result);return result;
 }catch(e){await exclusive(ctx.attempt,'blocked-private.json',{...receiptBinding,safeCode:safe(e),mayHaveMutated:true,automaticRetryAllowed:false,productionAuthorized:false});throw e;}
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===await realpath(new URL(import.meta.url))){
 try{need(process.argv.length===6&&process.argv[2]==='--execute-reviewed-browser-only','ARGS');console.log(JSON.stringify(await nativeAdmission({operatorSha:process.argv[3],application:process.argv[4],buildSha256:process.argv[5]},runBrowserOnly),null,2));}
 catch(e){console.log(JSON.stringify({status:'M6_BROWSER_ONLY_RECOVERY_BLOCKED',safeCode:safe(e),automaticRetryAllowed:false,mutationState:'CHECK_DURABLE_ATTEMPT',milestone6Accepted:false,productionAuthorized:false,secretsPrinted:false},null,2));process.exitCode=1;}
}
