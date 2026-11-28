// M6-01: isolated successor rehearsal contract. No retained cutover or release authority.
import {createHash} from 'node:crypto';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {lstat,realpath} from 'node:fs/promises';
import {readSuccessorSources,observeSuccessorMigrations} from './m6-successor-migrations.mjs';
import {verifyM6RecoveryCopy} from './m6-recovery-copy.mjs';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const sha40=/^[a-f0-9]{40}$/;
const tableName=/^[a-z_][a-z0-9_]*$/;
const kinds=['documents','uploads','hrkeys'];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const outside=(a,b)=>{const p=relative(a,b);return p==='..'||p.startsWith('../')||isAbsolute(p);};
const digest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const sourceDb='proto_a_01', role='proto_runtime', recoveryDb='m6_successor_rehearsal';
const successorNames=['20261127041000_ss16_movement_correction_request','20261127050000_ss16_unposted_cancellation_pin','20261127060000_ss16_controlled_submitted_cancellation','20261127070000_ss16_terminal_controlled_cancellation','20261127080000_ss16_plan_cancel_decision_proof','20261127150000_ss16_reciprocal_decision_integrity','20261127160000_ss16_terminal_outcome_ledger_proof'];
function ledger(rows,count){
  need(Array.isArray(rows)&&rows.length===count,'M6_SUCCESSOR_OPERATOR_LEDGER_COUNT');
  const result=rows.map(r=>{need(typeof r?.migration_name==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(r.migration_name)&&/^[a-f0-9]{64}$/.test(r.checksum??''),'M6_SUCCESSOR_OPERATOR_LEDGER_SHAPE');return [r.migration_name,r.checksum];}).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  need(new Set(result.map(r=>r[0])).size===count,'M6_SUCCESSOR_OPERATOR_LEDGER_DUPLICATE');return result;
}
export function verifySuccessorSourcePlan(predecessor,sources){
  const old=new Map(ledger(predecessor,177)),next=new Map(ledger(sources,184));
  need([...old].every(([n,h])=>next.get(n)===h),'M6_SUCCESSOR_OPERATOR_SOURCE_DRIFT');
  need(equal([...next.keys()].filter(n=>!old.has(n)),successorNames),'M6_SUCCESSOR_OPERATOR_ADDITIONS_DRIFT');
}
// Capture complete SQL row multisets (not JS numeric projections) with the ledger in one read-only transaction.
export async function captureSuccessorDatabase(db,database,count){
  need([sourceDb,recoveryDb].includes(database)&&[177,184].includes(count)&&!(database===sourceDb&&count!==177),'M6_SUCCESSOR_OPERATOR_DATABASE_SCOPE');
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const id=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
    need(id.length===1&&id[0].db===database&&id[0].role===role&&id[0].ro==='on'&&id[0].isolation==='repeatable read','M6_SUCCESSOR_OPERATOR_DB_IDENTITY');
    await requireNoLiveSessions(tx);
    const migrations=await tx.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name');
    const manifest=ledger(migrations,count);
    need(migrations.every(r=>r.finished_at instanceof Date&&Number.isFinite(+r.finished_at)&&r.rolled_back_at===null),'M6_SUCCESSOR_OPERATOR_INCOMPLETE_LEDGER');
    const tables=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(r=>r.tablename).sort();
    need(tables.includes('_prisma_migrations')&&tables.includes('user_sessions')&&tables.length>2&&new Set(tables).size===tables.length&&tables.every(t=>tableName.test(t)),'M6_SUCCESSOR_OPERATOR_TABLES');
    const rows={};
    for(const t of tables){
      const values=await tx.$queryRawUnsafe('SELECT row_to_json(t)::text AS raw FROM public."'+t+'" AS t');
      need(Array.isArray(values)&&values.every(r=>typeof r.raw==='string'),'M6_SUCCESSOR_OPERATOR_ROW_SHAPE');
      rows[t]={count:values.length,sha256:digest(values.map(r=>r.raw).sort())};
    }
    const rawLedger=await tx.$queryRawUnsafe('SELECT migration_name,row_to_json(t)::text AS raw FROM public._prisma_migrations AS t ORDER BY migration_name');
    need(Array.isArray(rawLedger)&&rawLedger.length===count&&equal(rawLedger.map(r=>r.migration_name),manifest.map(r=>r[0]))&&rawLedger.every(r=>typeof r.raw==='string'),'M6_SUCCESSOR_OPERATOR_LEDGER_ROW_SHAPE');
    return {manifest,rows,migrationRows:Object.fromEntries(rawLedger.map(r=>[r.migration_name,digest(r.raw)]))};
  },{isolationLevel:'RepeatableRead',timeout:120000});
}
export function verifySuccessorPreservation(before,restored,after){
  need(equal(before,restored),'M6_SUCCESSOR_OPERATOR_RESTORE_DRIFT');
  const old=Object.keys(before.rows).sort(),next=Object.keys(after.rows).sort();
  need(!old.includes('movement_correction_requests')&&equal(next,[...old,'movement_correction_requests'].sort()),'M6_SUCCESSOR_OPERATOR_TABLE_DRIFT');
  need(old.filter(t=>t!=='_prisma_migrations').every(t=>equal(before.rows[t],after.rows[t])),'M6_SUCCESSOR_OPERATOR_HISTORICAL_ROW_DRIFT');
  need(Object.entries(before.migrationRows).every(([n,h])=>after.migrationRows[n]===h),'M6_SUCCESSOR_OPERATOR_HISTORICAL_LEDGER_ROW_DRIFT');
  need(equal(after.rows.movement_correction_requests,{count:0,sha256:digest([])}),'M6_SUCCESSOR_OPERATOR_NEW_TABLE_NOT_EMPTY');
}
// The Release Coordinator supplies the owned restore/migrate adapter. No generic
// command execution or retained DB write is exposed by this lane. The claim must
// be exclusive and never reused. Restore and migrate receive ONLY the recovery target.
export async function runSuccessorUpgrade({candidate,sourceRoot,retainedRoot,predecessor,sourceDatabase,adapter,readCheckout,readInventory}){
  need(sha40.test(candidate?.sha??'')&&sha40.test(candidate?.tree??'')&&candidate.syntheticOnly===true&&candidate.productionAuthorized===false&&candidate.rehearsalOnly===true,'M6_SUCCESSOR_OPERATOR_PIN_REQUIRED');
  need([sourceRoot,retainedRoot].every(p=>typeof p==='string'&&resolve(p)===p)&&outside(sourceRoot,retainedRoot)&&outside(retainedRoot,sourceRoot),'M6_SUCCESSOR_OPERATOR_PATH');
  need(await realpath(sourceRoot)===sourceRoot&&await realpath(retainedRoot)===retainedRoot,'M6_SUCCESSOR_OPERATOR_PATH');
  const stage=join(retainedRoot,'m6-successor-'+candidate.sha),root=join(stage,'recovery');
  const absent=async path=>{try{await lstat(path);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}};
  const privateStage=async()=>{const s=await lstat(stage);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(stage)===stage,'M6_SUCCESSOR_OPERATOR_STAGE_UNSAFE');};
  const target=Object.freeze({root,database:recoveryDb,role,sha:candidate.sha,tree:candidate.tree});
  const check=async()=>{const id=await readCheckout(sourceRoot);need(id?.sha===candidate.sha&&id.tree===candidate.tree&&id.clean===true,'M6_SUCCESSOR_OPERATOR_CHECKOUT_DRIFT');await adapter.verifyRetainedCustody({candidate,sourceDatabase});};
  const files=async(base)=>Object.fromEntries(await Promise.all(kinds.map(async k=>[k,await readInventory(join(base,k))])));
  await check();
  const sources=await readSuccessorSources(sourceRoot);
  verifySuccessorSourcePlan(predecessor,sources);
  const before=await captureSuccessorDatabase(sourceDatabase,sourceDb,177),original=await files(retainedRoot);
  need(equal(before.manifest,ledger(predecessor,177)),'M6_SUCCESSOR_OPERATOR_PREDECESSOR_DRIFT');
  await check();
  // The coordinator must bind this exclusive claim to its private stage and
  // establish an isolated, owned database/container before any destructive action.
  need(await absent(stage),'M6_SUCCESSOR_OPERATOR_PRIOR_ATTEMPT');
  await adapter.claim(target);
  await privateStage();
  need(await absent(root),'M6_SUCCESSOR_OPERATOR_PRIOR_RECOVERY');
  await check();
  const recovery=await adapter.restore(target);
  need(recovery?.db&&recovery.db!==sourceDatabase&&await realpath(root)===root,'M6_SUCCESSOR_OPERATOR_RECOVERY_IDENTITY');
  await adapter.verifyRecoveryCustody(target,recovery.db);
  const dumpSha=recovery.dumpSha;
  const copy=()=>verifyM6RecoveryCopy({root,expected:original,expectedDumpSha:dumpSha,readInventory});
  const retained=async()=>{await check();need(equal(before,await captureSuccessorDatabase(sourceDatabase,sourceDb,177))&&equal(original,await files(retainedRoot)),'M6_SUCCESSOR_OPERATOR_RETAINED_DRIFT');};
  await copy();
  const restored=await captureSuccessorDatabase(recovery.db,recoveryDb,177);
  need(equal(before,restored),'M6_SUCCESSOR_OPERATOR_RESTORE_DRIFT');
  await retained();
  await adapter.verifyRecoveryCustody(target,recovery.db);
  await adapter.migrate(target);
  await adapter.verifyRecoveryCustody(target,recovery.db);
  const after=await captureSuccessorDatabase(recovery.db,recoveryDb,184);
  const proof=await observeSuccessorMigrations({db:recovery.db,expectedDatabase:recoveryDb,expectedRole:role,predecessor,sources});
  verifySuccessorPreservation(before,restored,after);
  need(equal(after.manifest,ledger(sources,184))&&equal(after,await captureSuccessorDatabase(recovery.db,recoveryDb,184)),'M6_SUCCESSOR_OPERATOR_REHEARSAL_DRIFT');
  await privateStage();await copy();await retained();
  need(equal(ledger(sources,184),ledger(await readSuccessorSources(sourceRoot),184)),'M6_SUCCESSOR_OPERATOR_SOURCE_DRIFT');
  await adapter.verifyRecoveryCustody(target,recovery.db);await check();
  return {status:'M6_SUCCESSOR_ISOLATED_REHEARSAL_PASS',candidateSha:candidate.sha,candidateTree:candidate.tree,migrationProof:proof,restoredRowsMatched:true,historicalTablesPreserved: Object.keys(before.rows).length-1,recoveryCopyUnchanged:true,retainedDatabaseAndFilesUnchanged:true,cutoverPerformed:false,milestone6Accepted:false,productionAuthorized:false};
}

// Production-independent entry for the coordinator's owned disposable adapter.
// Existing historical inspector remains unchanged; derive the predecessor from
// its pinned checkout, never a newly asserted baseline supplied by the caller.
export async function runPinnedSuccessorUpgrade({candidate,sourceRoot,retainedRoot,sourceDatabase,adapter}){
  const {inspectPostM4,readCheckoutIdentity}=await import('./m6-post-m4-inspect.mjs');
  const {migrationSources}=await import('./m6-historical-backup.mjs');
  const {inventory}=await import('./m6-runtime-evidence.mjs');
  await inspectPostM4(retainedRoot);
  const application=join(retainedRoot,'m4-upgrade-9417f07c','rehearsal','application');
  const predecessor=await migrationSources(application);
  const bound={
    verifyRetainedCustody:async context=>{await inspectPostM4(retainedRoot);await adapter.verifyRetainedCustody(context);},
    claim:target=>adapter.claim(target),restore:target=>adapter.restore(target),
    migrate:target=>adapter.migrate(target),verifyRecoveryCustody:(target,db)=>adapter.verifyRecoveryCustody(target,db),
  };
  return runSuccessorUpgrade({candidate,sourceRoot,retainedRoot,sourceDatabase,predecessor,adapter:bound,readCheckout:readCheckoutIdentity,readInventory:inventory});
}
