// Residual M6 zero-session readiness: consume Event258 as evidence, never replay it.
// No native runtime startup, database/file writes, login, role changes or release authority.
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {open,lstat,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {inspectPostM4,readCheckoutIdentity} from './m6-post-m4-inspect.mjs';
import {validConfig,validContainer,SOURCE} from './prototype-actors.mjs';
import {validPrivateActors,validActorReceipt} from './prototype-browser-operator.mjs';
import {loadM4ProcessReceipts,createMacObservation} from './m6-mac-observation.mjs';
import {verifyRuntimePair,inventory} from './m6-runtime-evidence.mjs';
import {verifyCommonCandidate} from './m6-common-successor.mjs';
import {migrationSources} from './m6-historical-backup.mjs';
import {readSuccessorSources,observeSuccessorMigrations} from './m6-successor-migrations.mjs';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
import {captureFixtureRows} from './m6-successor-fixture-writer.mjs';
import {captureSuccessorDatabase} from './m6-successor-upgrade-operator.mjs';
import {verifyM6RecoveryCopy} from './m6-recovery-copy.mjs';
import {bindSuccessorRoster} from './m6-successor-roster.mjs';
import {verifyRateBucketAdmission} from './m6-operational-admission.mjs';
import {captureSuccessorAuthPreservation} from './m6-successor-auth-preservation.mjs';
import {bindRetainedCD} from './m6-retained-cd-bind.mjs';
import {verifyHrSealedPhase} from './m6-hr-successor-exit.mjs';
import {verifyFailedBatchLog,verifyFailedBatchBaseline,planQuantityCorrection,verifyQuantityDelta,permission} from './m6-boq-quantity-correction.mjs';
import {bindHrDownload} from './m6-hr-download-proof.mjs';
import {bindInventoryTerminal} from './m6-inventory-terminal-proof.mjs';
import {projectPostSubcontractBaseline} from './m6-inventory-post-subcontract-baseline.mjs';
import {projectPostInventoryBaseline} from './m6-post-inventory-admission.mjs';
import {describeResidualReadiness} from './m6-residual-readiness.mjs';
import {validateSiteBinding,assertSiteHistory} from './m6-retained-site-material.mjs';
const planSha256='29dc83568b79bdb7d0b08fbd37bf8b5c8d7b1a4a8cc55549edf3ec2c67a02322';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_ADMISSION_'+code),{safeCode:'M6_ADMISSION_'+code});};
const candidate=Object.freeze({sha:'70013b5139292ef33563447f8937c8f132feabd2',tree:'8152b5ac627325c91c36ed65875791966a1a8874',syntheticOnly:true,rehearsalOnly:true,productionAuthorized:false});
const stable=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
async function directory(path){const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(path)===path,'DIRECTORY');}
async function privateJson(path,max=1048576){
  need(await realpath(path)===path,'PRIVATE_PATH');
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const s=await f.stat();need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=max,'PRIVATE_RECEIPT');
    const b=await f.readFile();try{need(b.length===s.size&&stable(s,await f.stat())&&stable(s,await lstat(path)),'RECEIPT_DRIFT');return JSON.parse(b.toString('utf8'));}finally{b.fill(0);}
  }finally{await f.close();}
}
async function main(){
  need(process.argv[2]==='--preflight-read-only-residual'&&process.argv.length===5&&/^[a-f0-9]{40}$/.test(process.argv[3])&&process.argv[4].startsWith('/'),'PREFLIGHT_ARGS');
  const authority={operatorSha:process.argv[3],application:process.argv[4]};
  need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(k)),'MAC_REQUIRED');
  const source=resolve(fileURLToPath(new URL('../../',import.meta.url))),app=await realpath(authority.application);
  const id=await readCheckoutIdentity(source),applicationId=await readCheckoutIdentity(app);
  need(id.sha===authority.operatorSha&&id.clean&&applicationId.sha===candidate.sha&&applicationId.tree===candidate.tree&&applicationId.clean&&app!==source,'CHECKOUT');
  const root=join(homedir(),'Construction-ERP-Prototype-Runtime'),historical=join(root,'m4-upgrade-9417f07c','rehearsal','application'),stage=join(root,'m6-successor-'+candidate.sha);
  await directory(root);await directory(stage);await directory(join(stage,'recovery'));
  const receipt=await privateJson(join(stage,'rehearsal-ready.json'));verifyCommonCandidate(candidate,receipt);need(receipt.historicalTablesPreserved===172,'SEALED_TABLE_COUNT');
  const cfg=await privateJson(join(root,'runtime-private.json')),containerReceipt=await privateJson(join(root,'container-owned.json')),manifest=await privateJson(join(root,'prototype-target.json'));
  need(validConfig(cfg)&&manifest.expectedMainSha===SOURCE&&manifest.mode==='isolated-synthetic'&&manifest.productionConnected===false&&manifest.retainedDataUsed===false&&manifest.realCompanyGrantsModified===false&&manifest.runtime?.isolationRoot===root&&manifest.runtime.databaseRoot===join(root,'db')&&manifest.runtime.documentsRoot===join(root,'documents')&&manifest.runtime.hrKeysRoot===join(root,'hrkeys')&&manifest.runtime.postgresDbName==='proto_a_01'&&manifest.runtime.postgresHost==='127.0.0.1'&&manifest.runtime.postgresPort===55471,'SYNTHETIC_MANIFEST');
  await inspectPostM4(root);
  const expected=await loadM4ProcessReceipts(root,historical),observe=createMacObservation({root,application:historical,expected,containerReceipt,validContainer});
  const verify=async()=>{await inspectPostM4(root);verifyRuntimePair(expected,await observe(),historical,process.execPath,process.getuid());const a=await readCheckoutIdentity(app),o=await readCheckoutIdentity(source);need(a.sha===candidate.sha&&a.tree===candidate.tree&&a.clean&&o.sha===id.sha&&o.tree===id.tree&&o.clean,'CHECKOUT_DRIFT');};
  await verify();
  const privateActors=await privateJson(join(root,'actors-private.json')),actorReceipt=await privateJson(join(root,'actors-ready.json')),fixture=await privateJson(join(root,'actors-fixture-private.json'));
  need(validPrivateActors(privateActors)&&validActorReceipt(actorReceipt),'ACTOR_RECEIPT');
  const {PrismaClient}=createRequire(join(app,'apps/api/package.json'))('@prisma/client');
  const db=new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+encodeURIComponent(cfg.databasePassword)+'@127.0.0.1:55471/m6_successor_rehearsal?schema=public'}},log:[]});
  try{
    const proof=await observeSuccessorMigrations({db,expectedDatabase:'m6_successor_rehearsal',expectedRole:'proto_runtime',predecessor:await migrationSources(historical),sources:await readSuccessorSources(app)});
    need(proof.appliedChecksumsMatched===184,'MIGRATIONS');
    const recovery=join(stage,'recovery'),fixtureStage=join(stage,'event237-fixture'),completedInventory=join(stage,'event254-inventory-terminal-browser');
    await directory(fixtureStage);
    const committed=await privateJson(join(fixtureStage,'committed-private.json'),33554432),attempt=await privateJson(join(fixtureStage,'attempt-private.json'));
    need(committed.planSha256===planSha256,'FIXTURE_PLAN');
    const sourceDb=new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+encodeURIComponent(cfg.databasePassword)+'@127.0.0.1:55471/proto_a_01?schema=public'}},log:[]});
    try{
      const readOnly=async(client,database,fn)=>client.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const a=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");need(a.length===1&&a[0].db===database&&a[0].role==='proto_runtime'&&a[0].ro==='on'&&a[0].isolation==='repeatable read','DATABASE');await requireNoLiveSessions(tx);return fn(tx);},{isolationLevel:'RepeatableRead',timeout:120000});
      const successorRead=fn=>readOnly(db,'m6_successor_rehearsal',fn);
      const retainedRows=await readOnly(sourceDb,'proto_a_01',async tx=>{const tables=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(r=>r.tablename);need(tables.length===173&&new Set(tables).size===173&&tables.every(t=>/^[a-z_][a-z0-9_]*$/.test(t)),'RETAINED_TABLES');const rows={};for(const t of tables){const r=await tx.$queryRawUnsafe('SELECT encode(sha256(convert_to(to_jsonb(t)::text,\'UTF8\')),\'hex\') AS hash FROM public."'+t+'" t LIMIT 10001');need(r.length<=10000,'ROW_LIMIT');rows[t]=r.map(x=>x.hash).sort();}return rows;});
      const failedStage=join(stage,'operational-batch'),correctionStage=join(stage,'event245-boq-quantity');await directory(failedStage);await directory(correctionStage);
      const correction=await privateJson(join(correctionStage,'committed-private.json'),33554432),correctionAttempt=await privateJson(join(correctionStage,'attempt-private.json'),33554432),failed=await privateJson(join(failedStage,'batch-started-private.json'));
      need(correction.applicationSha===candidate.sha&&correction.applicationTree===candidate.tree&&correction.operatorSha==='e3d930b68c7c53d37399bc4cdf0a31d29af1584c'&&correction.failedOperatorSha==='e4f61df48a876560dcd8ef46ccaf5c638f4562e6'&&correction.fixturePlanSha256===planSha256&&same(correction.log,correctionAttempt.log)&&same(correction.before,correctionAttempt.expectedBefore)&&same(correction.plan,correctionAttempt.plan)&&correctionAttempt.operatorSha===correction.operatorSha,'CORRECTION_RECEIPT');
      need(failed.applicationSha===candidate.sha&&failed.applicationTree===candidate.tree&&failed.operatorSha===correction.failedOperatorSha&&failed.productionAuthorized===false&&failed.automaticRetryAllowed===false,'FAILED_ATTEMPT');
      const readLog=async()=>{const path=join(failedStage,'api.log');need(await realpath(path)===path,'LOG_PATH');const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const s=await f.stat();need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=16777216,'LOG_FILE');const bytes=await f.readFile();try{need(bytes.length===s.size&&stable(s,await f.stat())&&stable(s,await lstat(path)),'LOG_DRIFT');return verifyFailedBatchLog(bytes.toString('utf8'));}finally{bytes.fill(0);}}finally{await f.close();}};
      need(same(correction.log,await readLog()),'PRIOR_LOG');verifyQuantityDelta(correction.before,correction.after,correction.additions,correction.plan.length);
      need(Object.keys(retainedRows).filter(t=>t!=='_prisma_migrations').every(t=>same(retainedRows[t],committed.before[t])),'RETAINED_FIXTURE_BASELINE');
      const successStage=join(stage,'event245-operational-continuation');await directory(successStage);
      const success=await privateJson(join(successStage,'batch-ready.json')),successStarted=await privateJson(join(successStage,'batch-started-private.json'));
      need(success.status==='M6_SUCCESSOR_SHARED_OPERATIONAL_BATCH_PASS'&&success.operatorSha===correction.operatorSha&&success.candidateSha===candidate.sha&&success.candidateTree===candidate.tree&&success.priorSessionsPreserved===true&&success.revokedNewSessions===11&&success.nonAuthTablesPreserved===171&&success.sessionRevocationVerified===true&&success.auditRowsPreserved===true&&success.siteReadbackVerified===true&&success.certificationReadbackVerified===true&&success.hrDenialsVerified===15&&success.actors===11&&success.modulesOpened===26&&success.additionalLogins===0&&success.retainedDatabaseAndFilesUnchanged===true&&success.recoveryCopyUnchanged===true&&success.productionAuthorized===false&&success.milestone6Accepted===false&&success.automaticRetryAllowed===false,'PRIOR_SUCCESS');
      need(successStarted.applicationSha===candidate.sha&&successStarted.applicationTree===candidate.tree&&successStarted.operatorSha===success.operatorSha&&successStarted.rosterSha256===success.rosterSha256&&same(successStarted.actorIds,failed.actorIds),'PRIOR_SUCCESS_ATTEMPT');
      const prior=join(root,'subcontract-upgrade'),hrStage=join(root,'m6-upgrade');await directory(prior);await directory(hrStage);
      const historicalCD=await privateJson(join(prior,'ready.json'));need(historicalCD.status==='SUBCONTRACT_POPULATED_MAC_UPGRADE_AND_BROWSER_VERIFIED'&&historicalCD.applicationSha==='f37867c9dd34d535e5d62bfdd01934773c6f5e8a'&&historicalCD.operatorMainSha==='bf3413caa26af4357bd57a38311f26dec86917c2'&&historicalCD.sessionsRevoked===true&&historicalCD.canonicalCertificationApprovalVerified===true&&historicalCD.protectedDownloadBytesVerified===true&&historicalCD.productionAuthorized===false,'CD_RECEIPT');
      const cdBinding=await bindRetainedCD(sourceDb,{actorReceipt,privateActors,fixture,source:await privateJson(join(prior,'source-source-private.json')),journey:await privateJson(join(prior,'source-journey-private.json'))});
      const ready=await privateJson(join(hrStage,'ready.json')),receipts=await Promise.all(['upgrade','configure','finance','hr','boq','preserve'].map(p=>privateJson(join(hrStage,'phase-'+p+'.json'))));verifyHrSealedPhase(ready,receipts);
      const sealedSnapshot=await privateJson(join(hrStage,'source-database-after-private.json'),33554432),original=await privateJson(join(hrStage,'original-inventory-private.json'),33554432),preservedKeys=await inventory(join(hrStage,'preserved','hrkeys'));
      const hrDownload=bindHrDownload(sealedSnapshot,cdBinding),completedHr=join(stage,'event248-hr-download');await directory(completedHr);
      const hrReady=await privateJson(join(completedHr,'batch-ready.json')),hrStarted=await privateJson(join(completedHr,'batch-started-private.json'));
      const hrOperator='ab60acdde265aaf8c3a3fbe71de70e88833bd2df';
      need(hrReady.applicationSha===candidate.sha&&hrReady.operatorSha===hrOperator&&hrReady.automaticRetryAllowed===false&&hrStarted.applicationSha===candidate.sha&&hrStarted.applicationTree===candidate.tree&&hrStarted.operatorSha===hrOperator&&hrStarted.priorOperatorSha===success.operatorSha&&hrStarted.rosterSha256===success.rosterSha256&&same(hrStarted.actorIds,[hrDownload.actorId])&&hrStarted.productionAuthorized===false&&hrStarted.automaticRetryAllowed===false,'HR_COMPLETED_RECEIPT');
      const completedSubcontract=join(stage,'event251-subcontract-browser');await directory(completedSubcontract);
      const subcontractReady=await privateJson(join(completedSubcontract,'batch-ready.json')),subcontractStarted=await privateJson(join(completedSubcontract,'batch-started-private.json'));
      const subcontractOperator='6cbb39d3647af785551bbee5c967b25c0083b9a4',subcontractActorIds=['BEN','NANCY'].map(k=>cdBinding.actors[k].userId).sort();
      need(subcontractReady.applicationSha===candidate.sha&&subcontractReady.operatorSha===subcontractOperator&&subcontractReady.automaticRetryAllowed===false&&subcontractStarted.applicationSha===candidate.sha&&subcontractStarted.applicationTree===candidate.tree&&subcontractStarted.operatorSha===subcontractOperator&&subcontractStarted.priorOperatorSha===hrOperator&&subcontractStarted.rosterSha256===success.rosterSha256&&same(subcontractStarted.actorIds,subcontractActorIds)&&subcontractStarted.productionAuthorized===false&&subcontractStarted.automaticRetryAllowed===false,'SUBCONTRACT_COMPLETED_RECEIPT');
      await directory(completedInventory);
      const inventoryReady=await privateJson(join(completedInventory,'batch-ready.json')),inventoryStarted=await privateJson(join(completedInventory,'batch-started-private.json'));
      const initial=await successorRead(captureFixtureRows);const verifyBeforeSessions=async()=>need(same(initial,await successorRead(captureFixtureRows)),'SUCCESSOR_BASELINE_DRIFT');
      const rawHash="encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')",stableHash="encode(sha256(convert_to((to_jsonb(t)-ARRAY['last_login_at','updated_at']::text[])::text,'UTF8')),'hex')";
      const priorUsers=await readOnly(sourceDb,'proto_a_01',tx=>tx.$queryRawUnsafe('SELECT id::text AS id,'+stableHash+' AS stable FROM public.users t ORDER BY id'));need(priorUsers.length===9,'RETAINED_USERS');
      const admin=await readOnly(sourceDb,'proto_a_01',tx=>tx.$queryRawUnsafe('SELECT '+rawHash+' AS hash FROM public.users t WHERE id=$1::uuid',fixture.adminUserId));need(admin.length===1,'ADMIN');
      const binding=await successorRead(async tx=>{
        const users=await tx.user.findMany({take:101,include:{company:true,employee:true,userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}}),projects=await tx.project.findMany({include:{members:true}}),permissionRow=await tx.permission.findUnique({where:{permissionCode:permission}});
        const b=bindSuccessorRoster({fixture,original:privateActors.actors,attempt,committed,users,projects});
        need(same(b.actorIds,failed.actorIds),'ACTOR_DRIFT');
        const sessions=await tx.$queryRawUnsafe('SELECT user_id::text AS actor,(revoked_at IS NOT NULL) AS revoked,created_at AS created,revoked_at AS \"revokedAt\",'+rawHash+' AS hash FROM public.user_sessions t');
        const currentAdmin=await tx.$queryRawUnsafe('SELECT '+rawHash+' AS hash FROM public.users t WHERE id=$1::uuid',fixture.adminUserId);need(currentAdmin.length===1,'ADMIN');
        need(b.rosterSha256===success.rosterSha256,'SUCCESS_ROSTER');
        const nowUsers=await tx.$queryRawUnsafe('SELECT id::text AS id,'+stableHash+' AS stable FROM public.users t ORDER BY id');need(priorUsers.every(u=>nowUsers.some(v=>v.id===u.id&&v.stable===u.stable)),'USER_STABLE_DRIFT');
        for(const [k,a] of Object.entries(attempt.actors)){const u=users.find(u=>u.id===a.userId);need(u?.passwordHash===a.passwordHash&&u.displayName==='Synthetic M6 '+k&&u.lastLoginAt instanceof Date,'NEW_USER_DRIFT');}
        verifyFailedBatchBaseline({committed,current:correction.before,sessionRows:sessions.filter(s=>correction.before.user_sessions.includes(s.hash)),actorIds:b.actorIds,adminHash:currentAdmin[0].hash,originalAdminHash:admin[0].hash});
        const current=await captureFixtureRows(tx);need(same(initial,current),'BASELINE_DRIFT');
        const auditRows=await tx.$queryRawUnsafe('SELECT to_jsonb(t)::text AS raw FROM public.audit_logs t LIMIT 10001');need(auditRows.length<=10000,'AUDIT_BOUND');
        const postInventory=projectPostInventoryBaseline({baseline:correction.after,current,sessionRows:sessions.map(s=>({...s,created:s.created.toISOString(),revokedAt:s.revokedAt?.toISOString()??null})),roster:b.roster,rosterSha256:b.rosterSha256,receipt:inventoryReady,started:inventoryStarted});
        const projected=projectPostSubcontractBaseline({baseline:correction.after,current:postInventory.current,auditRows:auditRows.map(r=>r.raw),sessionRows:postInventory.sessionRows,actorIds:b.actorIds,koh:hrDownload,hrReceipt:hrReady,subcontractReceipt:subcontractReady,subcontractActorIds});
        verifyFailedBatchBaseline({committed:{after:correction.after},current:projected.current,sessionRows:projected.sessionRows,actorIds:b.actorIds,adminHash:currentAdmin[0].hash,originalAdminHash:admin[0].hash});
        const added=correction.addedIds?.role_permissions;need(Array.isArray(added)&&added.length===correction.plan.length&&new Set(added).size===added.length,'CORRECTION_IDS');
        for(let i=0;i<added.length;i++){const p=correction.plan[i],edge=await tx.rolePermission.findUnique({where:{id:added[i]}}),h=await tx.$queryRawUnsafe('SELECT '+rawHash+' AS hash FROM public.role_permissions t WHERE id=$1::uuid',added[i]);need(edge?.roleId===p.roleId&&edge.permissionId===permissionRow?.id&&p.permissionId===permissionRow.id&&h.length===1&&h[0].hash===correction.additions.role_permissions[i],'CORRECTION_EDGE');}
        const beforeUsers=structuredClone(users);for(const u of beforeUsers)for(const r of u.userRoles)r.role.rolePermissions=r.role.rolePermissions.filter(e=>!added.includes(e.id));
        const beforeBinding=bindSuccessorRoster({fixture,original:privateActors.actors,attempt,committed,users:beforeUsers,projects});need(beforeBinding.rosterSha256===failed.rosterSha256&&same(planQuantityCorrection({binding:beforeBinding,original:privateActors.actors,fixture,users:beforeUsers,projects,permissionRow}),correction.plan),'CORRECTION_SCOPE');
        for(const k of ['JAI','PORN','STORE_SITE','KHAIMOOK'])need(b.roster[k].permissions.includes(permission)&&!b.roster[k].permissions.some(p=>p==='budget.cost.full_view'||p.startsWith('budget.customer.')),'BOQ_PREFLIGHT');
        for(const k of ['BEN','NANCY'])need(['budget.cost.full_view','budget.boq.view','budget.revision.view','budget.customer.view'].every(p=>b.roster[k].permissions.includes(p)),'FULL_BOQ_PREFLIGHT');
        return b;
      });
      const old=await captureSuccessorDatabase(sourceDb,'proto_a_01',177),files=Object.fromEntries(await Promise.all(['documents','uploads','hrkeys'].map(async k=>[k,await inventory(join(root,k))])));
      const dumpPath=join(recovery,'postgresql.custom'),dumpHandle=await open(dumpPath,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);let dumpSha;
      try{const a=await dumpHandle.stat();need(a.isFile()&&a.uid===process.getuid()&&a.nlink===1&&!(a.mode&0o077)&&a.size>1024,'DUMP');const h=createHash('sha256');for await(const c of dumpHandle.createReadStream({autoClose:false}))h.update(c);need(stable(a,await dumpHandle.stat())&&stable(a,await lstat(dumpPath)),'DUMP_DRIFT');dumpSha=h.digest('hex');}finally{await dumpHandle.close();}
      const verifyPreserved=async()=>{await verify();need(same(old,await captureSuccessorDatabase(sourceDb,'proto_a_01',177))&&same(correction.log,await readLog())&&same(success,await privateJson(join(successStage,'batch-ready.json')))&&same(successStarted,await privateJson(join(successStage,'batch-started-private.json')))&&same(hrReady,await privateJson(join(completedHr,'batch-ready.json')))&&same(hrStarted,await privateJson(join(completedHr,'batch-started-private.json')))&&same(subcontractReady,await privateJson(join(completedSubcontract,'batch-ready.json')))&&same(subcontractStarted,await privateJson(join(completedSubcontract,'batch-started-private.json')))&&same(inventoryReady,await privateJson(join(completedInventory,'batch-ready.json')))&&same(inventoryStarted,await privateJson(join(completedInventory,'batch-started-private.json'))),'RETAINED_DB_OR_LOG_DRIFT');for(const k of Object.keys(files))need(same(files[k],await inventory(join(root,k))),'RETAINED_FILE_DRIFT');await verifyM6RecoveryCopy({root:recovery,expected:files,expectedDumpSha:dumpSha,readInventory:inventory});};
      for(const k of ['BEN','NANCY','KOH','FOREMAN'])need(cdBinding.actors[k].userId===binding.roster[k].userId&&same(cdBinding.actors[k].permissions,binding.roster[k].permissions),'CD_ACTOR_DRIFT');
      const rc=join(root,'receiving-upgrade'),tc=join(root,'transfer-continuation'),uc=join(root,'uom-upgrade');
      for(const p of [rc,tc,uc])await directory(p);
      const journeys={receiving:{ready:await privateJson(join(rc,'ready.json')),source:await privateJson(join(rc,'source-private.json')),journey:await privateJson(join(rc,'journey-private.json'))},transfer:{ready:await privateJson(join(tc,'ready.json')),source:await privateJson(join(tc,'source-source-private.json')),journey:await privateJson(join(tc,'source-journey-private.json'))},converted:{ready:await privateJson(join(uc,'ready.json')),journey:await privateJson(join(uc,'source-journey-private.json'))}};
      const inventoryBinding=bindInventoryTerminal(sealedSnapshot,fixture,binding.roster,journeys);
      const site=validateSiteBinding({sourceSha:SOURCE,actors:privateActors,fixture,initial:await privateJson(join(root,'actors-http-evidence-private.json')),journey:await privateJson(join(root,'material-journey-private.json'))});
      const readiness=await successorRead(async tx=>{
        const scope={companyId:fixture.companyId,projectId:fixture.projectId};
        const [report,request,plan,issues,document,roles,activities,budget,planCount,confirmedPlanCount,supplierEventCount]=await Promise.all([
          tx.dailySiteReport.findUnique({where:{id:site.reportId}}),
          tx.materialRequest.findUnique({where:{id:site.requestId},include:{lines:{include:{issueLinks:{include:{receipts:true}}}},revisions:{orderBy:{version:'asc'}}}}),
          tx.materialUsagePlan.findUnique({where:{id:site.planId},include:{revisions:{include:{lines:true}}}}),
          tx.materialIssue.findMany({where:{id:{in:[site.withinIssueId,site.overageIssueId]}},include:{items:{include:{materialPlanAllocations:true}},stockTransactions:true}}),
          tx.document.findUnique({where:{id:site.documentId},include:{links:true}}),
          tx.role.findMany({where:{companyId:scope.companyId,roleCode:{in:['MANAGEMENT','PROCUREMENT_OFFICER']}},include:{rolePermissions:{include:{permission:true}}}}),
          tx.activity.findMany({where:scope,select:{id:true,parentActivityId:true,wbsId:true,isActive:true,isSummary:true,isMilestone:true},take:201}),
          tx.budgetRevision.findFirst({where:{...scope,approvalInstance:{is:{approvalState:'APPROVED'}}},orderBy:{revisionNo:'desc'},select:{id:true}}),
          tx.projectProgressPlan.count({where:scope}),
          tx.projectProgressPlan.count({where:{...scope,confirmedAt:{not:null}}}),
          tx.auditLog.count({where:{companyId:scope.companyId,entityType:'SUPPLIER_DELIVERY_CASE',entityId:inventoryBinding.orderId}})
        ]);
        assertSiteHistory(site,{report,request,plan,issues,document});
        const issue=issues.find(x=>x.id===site.withinIssueId),item=issue.items[0],requestLine=request.lines[0];
        const dims=['wbsId','costCodeId','activityId'];
        const issueDimensionsPresent=dims.every(k=>!!item[k]&&item[k]===requestLine[k]&&issue.stockTransactions.every(t=>t[k]===item[k]));
        let threeLevelWbsPresent=false,activityTypePresent=false;
        if(item.wbsId){const path=[];let cursor=item.wbsId;while(cursor&&path.length<3){const row=await tx.wbsElement.findFirst({where:{id:cursor,projectId:scope.projectId,isActive:true},select:{id:true,parentId:true}});if(!row||path.includes(row.id))break;path.push(row.id);cursor=row.parentId;}threeLevelWbsPresent=path.length===3;}
        if(item.activityId){const a=await tx.activity.findFirst({where:{...scope,id:item.activityId,isActive:true},select:{activityTypeId:true,wbsId:true}});activityTypePresent=!!a?.activityTypeId&&a.wbsId===item.wbsId&&!!await tx.activityType.findFirst({where:{companyId:scope.companyId,id:a.activityTypeId,isActive:true},select:{id:true}});}
        const approved=plan.revisions.find(r=>r.status==='APPROVED'),planLine=approved.lines[0];
        const boqAllocationPresent=item.materialPlanAllocations.some(a=>a.planId===plan.id&&a.planLineId===planLine.id&&planLine.budgetRevisionLineId===site.budgetRevisionLineId);
        const lines=budget?await tx.budgetRevisionLine.findMany({where:{budgetRevisionId:budget.id,wbsId:{not:null},quantity:{gt:0}},select:{wbsId:true,quantity:true},take:501}):[];
        return describeResidualReadiness({roster:binding.roster,canonicalRoles:roles.map(r=>({roleCode:r.roleCode,isActive:r.isActive,permissions:r.rolePermissions.map(p=>p.permission.permissionCode)})),site:{signedReceiptPresent:true,issueDimensionsPresent,threeLevelWbsPresent,activityTypePresent,boqAllocationPresent},activities,budgetLines:lines.map(l=>({wbsId:l.wbsId,positiveQuantity:l.quantity.gt(0)})),planCount,confirmedPlanCount,supplierEventCount});
      });
      const authState=await captureSuccessorAuthPreservation(db);let rateBucketReady=true;
      try{verifyRateBucketAdmission(authState);}catch(e){if(e.safeCode!=='M6_OPERATIONAL_LIVE_LOCAL_BUCKET')throw e;rateBucketReady=false;}
      await verifyBeforeSessions();await verifyPreserved();
      return {status:'M6_RESIDUAL_READ_ONLY_READINESS_PASS',applicationSha:candidate.sha,operatorSha:id.sha,priorBatchSessionsPreserved:28,inventoryReceiptBound:true,siteHistoryBound:true,retainedDatabaseAndFilesUnchanged:true,recoveryCopyUnchanged:true,rateBucketReady,...readiness,productionAuthorized:false,milestone6Accepted:false,automaticRetryAllowed:false,secretsPrinted:false};
    }finally{await sourceDb.$disconnect();}
  }finally{await db.$disconnect();}
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===await realpath(new URL(import.meta.url))){
 try{console.log(JSON.stringify(await main(),null,2));}catch(e){console.log(JSON.stringify({status:'M6_RESIDUAL_READ_ONLY_READINESS_BLOCKED',safeCode:/^(M6_|BROWSER_)[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'M6_RESIDUAL_PRIVATE_FAILURE',automaticRetryAllowed:false,mayHaveCreatedSessions:false,secretsPrinted:false,productionAuthorized:false,milestone6Accepted:false}));process.exitCode=1;}
}
