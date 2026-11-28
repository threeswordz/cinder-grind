// One authorized successor-only operational batch; no fixture/recovery replay or retained mutations.
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {open,lstat,realpath,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {inspectPostM4,readCheckoutIdentity} from './m6-post-m4-inspect.mjs';
import {validConfig,validContainer,SOURCE} from './prototype-actors.mjs';
import {validPrivateActors,validActorReceipt} from './prototype-browser-operator.mjs';
import {loadM4ProcessReceipts,createMacObservation} from './m6-mac-observation.mjs';
import {verifyRuntimePair,inventory} from './m6-runtime-evidence.mjs';
import {verifyCommonCandidate,runCommonSuccessorReadbacks} from './m6-common-successor.mjs';
import {migrationSources} from './m6-historical-backup.mjs';
import {readSuccessorSources,observeSuccessorMigrations} from './m6-successor-migrations.mjs';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
import {captureFixtureRows} from './m6-successor-fixture-writer.mjs';
import {captureSuccessorDatabase} from './m6-successor-upgrade-operator.mjs';
import {verifyM6RecoveryCopy} from './m6-recovery-copy.mjs';
import {bindSuccessorRoster,mapSuccessorSessions} from './m6-successor-roster.mjs';
import {verifyOperationalAuthority,verifyCommittedBaseline,verifyRateBucketAdmission} from './m6-operational-admission.mjs';
import {runOperationalBatch} from './m6-operational-batch.mjs';
import {withSuccessorRuntime} from './m6-successor-runtime.mjs';
import {createSuccessorSessionBatch} from './m6-successor-session-batch.mjs';
import {captureSuccessorAuthPreservation,verifySuccessorAuthPreservation} from './m6-successor-auth-preservation.mjs';
import {bindRetainedCD} from './m6-retained-cd-bind.mjs';
import {validateSiteBinding} from './m6-retained-site-material.mjs';
import {bindSuccessorSite} from './m6-successor-site-binding.mjs';
import {siteReadbackPaths} from './m6-parallel-02-site-readback.mjs';
import {createSuccessorSiteTransport} from './m6-successor-site-transport.mjs';
import {verifyHrSealedPhase} from './m6-hr-successor-exit.mjs';
import {discoverBrowser,prepareBrowser} from './prototype-browser-executable.mjs';
import {startBrowser} from './prototype-browser.mjs';
import {probeSuccessorBrowser} from './m6-successor-browser-probe.mjs';
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
  const authority=verifyOperationalAuthority(process.argv.slice(2));
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
    const recovery=join(stage,'recovery'),fixtureStage=join(stage,'event237-fixture'),runtimeStage=join(stage,'operational-batch');
    await directory(fixtureStage);
    const committed=await privateJson(join(fixtureStage,'committed-private.json'),33554432),attempt=await privateJson(join(fixtureStage,'attempt-private.json'));
    need(committed.planSha256===planSha256,'FIXTURE_PLAN');
    const sourceDb=new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+encodeURIComponent(cfg.databasePassword)+'@127.0.0.1:55471/proto_a_01?schema=public'}},log:[]});
    try{
      const readOnly=async(client,database,fn)=>client.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const a=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");need(a.length===1&&a[0].db===database&&a[0].role==='proto_runtime'&&a[0].ro==='on'&&a[0].isolation==='repeatable read','DATABASE');await requireNoLiveSessions(tx);return fn(tx);},{isolationLevel:'RepeatableRead',timeout:120000});
      const successorRead=fn=>readOnly(db,'m6_successor_rehearsal',fn);
      const retainedRows=await readOnly(sourceDb,'proto_a_01',async tx=>{const tables=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(r=>r.tablename);need(tables.length===173&&new Set(tables).size===173&&tables.every(t=>/^[a-z_][a-z0-9_]*$/.test(t)),'RETAINED_TABLES');const rows={};for(const t of tables){const r=await tx.$queryRawUnsafe('SELECT encode(sha256(convert_to(to_jsonb(t)::text,\'UTF8\')),\'hex\') AS hash FROM public."'+t+'" t LIMIT 10001');need(r.length<=10000,'ROW_LIMIT');rows[t]=r.map(x=>x.hash).sort();}return rows;});
      const verifyBeforeSessions=async()=>verifyCommittedBaseline(committed,retainedRows,await successorRead(captureFixtureRows));
      await verifyBeforeSessions();
      const binding=await successorRead(async tx=>bindSuccessorRoster({fixture,original:privateActors.actors,attempt,committed,users:await tx.user.findMany({take:101,include:{company:true,employee:true,userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}}),projects:await tx.project.findMany({include:{members:true}})}));
      const old=await captureSuccessorDatabase(sourceDb,'proto_a_01',177),files=Object.fromEntries(await Promise.all(['documents','uploads','hrkeys'].map(async k=>[k,await inventory(join(root,k))])));
      const dumpPath=join(recovery,'postgresql.custom'),dumpHandle=await open(dumpPath,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);let dumpSha;
      try{const a=await dumpHandle.stat();need(a.isFile()&&a.uid===process.getuid()&&a.nlink===1&&!(a.mode&0o077)&&a.size>1024,'DUMP');const h=createHash('sha256');for await(const c of dumpHandle.createReadStream({autoClose:false}))h.update(c);need(stable(a,await dumpHandle.stat())&&stable(a,await lstat(dumpPath)),'DUMP_DRIFT');dumpSha=h.digest('hex');}finally{await dumpHandle.close();}
      const verifyPreserved=async()=>{await verify();need(same(old,await captureSuccessorDatabase(sourceDb,'proto_a_01',177)),'RETAINED_DB_DRIFT');for(const k of Object.keys(files))need(same(files[k],await inventory(join(root,k))),'RETAINED_FILE_DRIFT');await verifyM6RecoveryCopy({root:recovery,expected:files,expectedDumpSha:dumpSha,readInventory:inventory});};
      const prior=join(root,'subcontract-upgrade'),hrStage=join(root,'m6-upgrade');await directory(prior);await directory(hrStage);
      const historicalCD=await privateJson(join(prior,'ready.json'));need(historicalCD.status==='SUBCONTRACT_POPULATED_MAC_UPGRADE_AND_BROWSER_VERIFIED'&&historicalCD.applicationSha==='f37867c9dd34d535e5d62bfdd01934773c6f5e8a'&&historicalCD.operatorMainSha==='bf3413caa26af4357bd57a38311f26dec86917c2'&&historicalCD.sessionsRevoked===true&&historicalCD.canonicalCertificationApprovalVerified===true&&historicalCD.protectedDownloadBytesVerified===true&&historicalCD.productionAuthorized===false,'CD_RECEIPT');
      const cdBinding=await bindRetainedCD(sourceDb,{actorReceipt,privateActors,fixture,source:await privateJson(join(prior,'source-source-private.json')),journey:await privateJson(join(prior,'source-journey-private.json'))});
      for(const k of ['BEN','KOH','FOREMAN'])need(cdBinding.actors[k].userId===binding.roster[k].userId&&same(cdBinding.actors[k].permissions,binding.roster[k].permissions),'HR_ACTOR_DRIFT');
      const ready=await privateJson(join(hrStage,'ready.json')),receipts=await Promise.all(['upgrade','configure','finance','hr','boq','preserve'].map(p=>privateJson(join(hrStage,'phase-'+p+'.json'))));verifyHrSealedPhase(ready,receipts);
      const sealedSnapshot=await privateJson(join(hrStage,'source-database-after-private.json'),33554432),original=await privateJson(join(hrStage,'original-inventory-private.json'),33554432),preservedKeys=await inventory(join(hrStage,'preserved','hrkeys'));
      const materialReady=await privateJson(join(root,'material-ready.json'));need(materialReady.status==='MATERIAL_AUTHENTICATED_API_JOURNEY_VERIFIED'&&materialReady.sourceSha===SOURCE&&materialReady.apiSessionsRevoked===true&&materialReady.financeUnchanged===true&&materialReady.productionAuthorized===false,'SITE_RECEIPT');
      const site=validateSiteBinding({sourceSha:SOURCE,actors:privateActors,fixture,initial:await privateJson(join(root,'actors-http-evidence-private.json')),journey:await privateJson(join(root,'material-journey-private.json'))});
      const siteBinding=bindSuccessorSite({site,fixture,roster:binding.roster,sealedSnapshot,boqPhase:receipts[4]}),paths=siteReadbackPaths(siteBinding);
      const ss16Binding={sourceSha:candidate.sha,companyId:fixture.companyId,storeUserId:binding.roster.STORE_SITE.userId,pmUserId:binding.roster.KHAIMOOK.userId,projectIds:[fixture.projectId,fixture.unassignedProjectId],kinds:['GOODS_RECEIPT','MATERIAL_ISSUE','MATERIAL_RETURN','STOCK_TRANSFER']};
      const certificationBinding={companyId:fixture.companyId,projectId:fixture.projectId,claimId:cdBinding.finance.claimId,certificationId:cdBinding.finance.certificationId,actorIds:binding.certification};
      const auth={candidateSha:candidate.sha,candidateTree:candidate.tree,database:'m6_successor_rehearsal',ownerAuthorizedSessions:authority.ownerAuthorizedSessions,retainedMutationAuthorized:false,productionAuthorized:false,actorIds:binding.actorIds};
      // No direct rate bucket writes. The native canonical login lifecycle may
      // purge expired buckets and reset its own client key within the approved bound.
      verifyRateBucketAdmission(await captureSuccessorAuthPreservation(db));
      const selection=await discoverBrowser();
      const seal=async(name,value)=>{await directory(runtimeStage);const f=await open(join(runtimeStage,name),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await f.writeFile(JSON.stringify(value)+'\n');await f.sync();}finally{await f.close();}};
      let result;
      try{result=await runOperationalBatch({
        verifyPreserved,verifyRateAdmission:verifyRateBucketAdmission,captureAuth:()=>captureSuccessorAuthPreservation(db),verifyAuth:(before,after)=>verifySuccessorAuthPreservation(before,after,{actorIds:binding.actorIds,allowBoundedRehearsalRateBucketChanges:authority.allowBoundedRehearsalRateBucketChanges}),
        withRuntime:callback=>withSuccessorRuntime({application:app,stage:runtimeStage,recovery,password:cfg.databasePassword,readKeyring:privateJson,inventory,verifyCustody:verify,verifyBeforeSessions,callback:async runtime=>{await seal('batch-started-private.json',{applicationSha:candidate.sha,applicationTree:candidate.tree,operatorSha:id.sha,rosterSha256:binding.rosterSha256,actorIds:binding.actorIds,productionAuthorized:false,automaticRetryAllowed:false});return callback(runtime);}}),
        prepareBrowser:async()=>{const owned=await prepareBrowser(selection,runtimeStage);try{const browser=await startBrowser(owned.executable,runtimeStage);return {protocol:browser.protocol,stop:async()=>{await browser.stop();await owned.cleanup();}};}catch(e){if(e.browserProcessExited===true)await owned.cleanup();throw e;}},
        makeSessionBatch:runtime=>createSuccessorSessionBatch({candidate,authorization:auth,origin:runtime.origin,webOrigin:runtime.webOrigin,actors:Object.values(binding.roster),verifyRuntime:runtime.verifyRuntime,verifyQuiescent:()=>successorRead(async()=>true)}),
        mapSessions:live=>mapSuccessorSessions(binding,live),probeBrowser:(browser,runtime,live)=>probeSuccessorBrowser({protocol:browser.protocol,binding,sessions:live,verifyRuntime:runtime.verifyRuntime}),
        runReadbacks:(runtime,withSessions,verifyFinal)=>runCommonSuccessorReadbacks({candidate,receipt,context:{database:'m6_successor_rehearsal',db,origin:runtime.origin,webOrigin:runtime.webOrigin,verifyRuntime:runtime.verifyRuntime,withSessions,verifyFinal,siteBinding,ss16Binding,certificationBinding,siteTransport:s=>createSuccessorSiteTransport({paths,sessions:s.site,verifyRuntime:runtime.verifyRuntime}),hr:{ready,receipts,sealedSnapshot,oldKeys:original.hrkeys,preservedKeys,cdBinding,readFiles:runtime.readFiles,fixtureReceipt:committed}}}),
        seal:proof=>seal('batch-ready.json',{...proof,operatorSha:id.sha,rosterSha256:binding.rosterSha256,automaticRetryAllowed:false})});
      }catch(e){await verifyPreserved();throw e;}
      return {...result,operatorSha:id.sha,rosterSha256:binding.rosterSha256,automaticRetryAllowed:false};
    }finally{await sourceDb.$disconnect();}
  }finally{await db.$disconnect();}
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===await realpath(new URL(import.meta.url))){
 try{console.log(JSON.stringify(await main(),null,2));}catch(e){console.log(JSON.stringify({status:'M6_SUCCESSOR_SHARED_OPERATIONAL_BATCH_BLOCKED',safeCode:/^(M6_|BROWSER_)[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'M6_OPERATIONAL_PRIVATE_FAILURE',automaticRetryAllowed:false,mayHaveCreatedSessions:true,secretsPrinted:false,productionAuthorized:false,milestone6Accepted:false}));process.exitCode=1;}
}
