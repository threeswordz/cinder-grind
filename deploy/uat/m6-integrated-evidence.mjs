// Compare a separately rebuilt exact source tree to running compiled artifacts.
// Does not claim a historical byte manifest exists or authorize a deployment.
import {realpath} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {compareHistoricalRows} from './m6-historical-rows.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const TARGET='9417f07c609dbc091b5bbe2e09071c5e2c316459';
const TREE='bfcab1977ef80b8d7becf00d0056e892250052aa';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const outside=(a,b)=>{const p=relative(a,b);return p==='..'||p.startsWith('../')||isAbsolute(p);};
export async function inspectCompiledRebuild({application,rebuild,root,readCheckout,readInventory}){
  need([application,rebuild,root].every(p=>typeof p==='string'&&resolve(p)===p),'M6_REBUILD_PATH_INVALID');
  need(outside(application,rebuild)&&outside(rebuild,application)&&outside(root,rebuild)&&outside(rebuild,root),'M6_REBUILD_NOT_ISOLATED');
  need(await realpath(application)===application&&await realpath(rebuild)===rebuild&&await realpath(root)===root,'M6_REBUILD_PATH_ALIAS');
  const check=async path=>{const id=await readCheckout(path);need(id?.sha===TARGET&&id.tree===TREE&&id.clean===true,'M6_REBUILD_SOURCE_IDENTITY_INVALID');};
  const capture=async(path)=>{const result={};for(const kind of ['api','web']){
    const rows=await readInventory(join(path,'apps',kind,'dist'),{privateRoot:false});
    need(Array.isArray(rows)&&rows.some(r=>r[0]===(kind==='api'?'main.js':'index.html')&&Number.isSafeInteger(r[1])&&r[1]>0),'M6_REBUILD_ENTRY_MISSING');
    result[kind]=rows;
  }return result;};
  await check(application);await check(rebuild);
  const current=await capture(application),rebuilt=await capture(rebuild);
  need(same(current,await capture(application))&&same(rebuilt,await capture(rebuild)),'M6_REBUILD_CAPTURE_DRIFT');
  await check(application);await check(rebuild);
  const api=same(current.api,rebuilt.api),web=same(current.web,rebuilt.web);
  return {exactSourceRebuildCompared:true,apiRebuildBytesMatched:api,webRebuildBytesMatched:web,compiledRebuildBytesVerified:api&&web,historicalCompiledArtifactBytesVerified:false};
}
export async function readHistoricalRowEvidence({db,baseline,oldMigrationNames,requireNoLiveSessions}){
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const id=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
    need(id.length===1&&id[0].db==='proto_a_01'&&id[0].role==='proto_runtime'&&id[0].ro==='on'&&id[0].isolation==='repeatable read','M6_HISTORICAL_ROW_DB_IDENTITY_INVALID');
    await requireNoLiveSessions(tx);
    return compareHistoricalRows(tx,baseline,oldMigrationNames);
  },{isolationLevel:'RepeatableRead',timeout:120000});
}
