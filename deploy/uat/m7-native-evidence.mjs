// Native persisted-evidence composition. No login, grants, restore or source mutation.
import {createHash} from 'node:crypto';
import {normalizeInventory} from './m6-backup-receipts.mjs';
const need=(ok,c)=>{if(!ok)throw Error('M7_NATIVE_EVIDENCE_'+c);};
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const keys=['cluster','oid','database','role'];
const sameDb=(a,b)=>keys.every(k=>a?.[k]===b?.[k]);
const grantTables=['hr_company_access','permissions','project_members','role_permissions','roles','user_roles'];
const kinds=['documents','uploads','hrkeys'];
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
// All grant rows, not just the four tested users. User/employee/company/project
// activity and all remaining business rows are separately covered by the census.
export async function readM7GrantDigest(tx){
 const out=[];for(const t of grantTables){const rows=await tx.$queryRawUnsafe('SELECT encode(sha256(convert_to(to_jsonb(t)::text,\'UTF8\')),\'hex\') AS hash FROM ONLY public."'+t+'" t ORDER BY hash LIMIT 10001');need(Array.isArray(rows)&&rows.length<=10000&&rows.every(r=>hex(r.hash)),'GRANTS');out.push([t,rows.map(r=>r.hash)]);}return hash(out);
}
export async function readM7EvidenceTables(db,pin){
 return db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const i=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation,(SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid");need(i.length===1&&i[0].db===pin.database&&i[0].role===pin.role&&i[0].oid===String(pin.oid)&&i[0].ro==='on'&&i[0].isolation==='repeatable read','TABLE_IDENTITY');const names=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(r=>r.tablename);need(names.length===174&&new Set(names).size===174&&names.every(n=>/^[a-z_][a-z0-9_]*$/.test(n))&&same(names,names.slice().sort())&&grantTables.every(n=>names.includes(n)),'TABLES');return names.map(n=>'public.'+n);},{isolationLevel:'RepeatableRead',timeout:30000});
}
function historicalAuditDigest(snapshot,original){
 const map=new Map(snapshot.audits.map(a=>[a.id,a]));need(map.size===snapshot.audits.length,'AUDIT_ALIAS');const history=original.audits.map(a=>{const r=map.get(a.id);need(r&&same(canonical(r),canonical(a)),'HISTORICAL_AUDIT');return canonical(r);});return hash(history.sort((a,b)=>a.id.localeCompare(b.id)));
}
export function createM7PreservationReader({sourceSnapshot,capture,sourceStateSha,expectedKeySha,readSnapshot,readInventory}){
 need(hex(sourceStateSha)&&hex(expectedKeySha)&&hex(capture?.documentsSha)&&hex(capture?.uploadsSha)&&typeof readSnapshot==='function'&&typeof readInventory==='function'&&Array.isArray(sourceSnapshot?.audits)&&hex(sourceSnapshot.businessRowsSha256)&&hex(sourceSnapshot.grantsSha256),'CONTEXT');
 const original=structuredClone(sourceSnapshot),baseline=Object.freeze({businessRows:original.businessRowsSha256,historicalAuditRows:historicalAuditDigest(original,original),documentInventory:capture.documentsSha,keyInventory:expectedKeySha,sourceInventory:sourceStateSha,grants:original.grantsSha256});
 return Object.freeze({baseline,async read(){const s=await readSnapshot();need(s.sourceStateSha256===sourceStateSha&&s.businessRowsSha256===baseline.businessRows&&s.grantsSha256===baseline.grants,'PRESERVATION');const inv=Object.fromEntries(await Promise.all(kinds.map(async k=>[k,hash(normalizeInventory(await readInventory(k),false))])));need(inv.documents===baseline.documentInventory&&inv.uploads===capture.uploadsSha&&inv.hrkeys===expectedKeySha,'INVENTORY');return {businessRows:s.businessRowsSha256,historicalAuditRows:historicalAuditDigest(s,original),documentInventory:inv.documents,keyInventory:inv.hrkeys,sourceInventory:s.sourceStateSha256,grants:s.grantsSha256};}});
}
// Keep each target snapshot connection short-lived, disconnect before catalog
// checks so the target API's independently attributed pool is the only client.
export async function createM7NativeEvidence({source,binding,observe,readTables=readM7EvidenceTables,readGrants=readM7GrantDigest},deps){
 need(typeof source?.db?.$transaction==='function'&&typeof binding?.capture==='function'&&typeof observe==='function','SOURCE_CONTEXT');
 const makeReader=deps?.createM7PersistedSnapshotReader??(await import('./m7-persisted-snapshot.mjs')).createM7PersistedSnapshotReader;
 const c=binding.capture(),sourcePin=c.sourceDatabase;const state=await observe();need(sameDb(state.sourceDatabase,sourcePin)&&hex(state.stateSha256),'SOURCE_IDENTITY');const stateSha=state.stateSha256;
 const readSourceStateDigest=async()=>{const s=await observe();need(sameDb(s.sourceDatabase,sourcePin)&&s.stateSha256===stateSha,'SOURCE_DRIFT');return s.stateSha256;};
 const expectedTables=await readTables(source.db,sourcePin);
 const readSource=makeReader({db:source.db,target:sourcePin,expectedTables,verifyCustody:async()=>{const s=await observe();need(sameDb(s.sourceDatabase,sourcePin)&&s.stateSha256===stateSha,'SOURCE_DRIFT');return {...s.sourceDatabase,readOnlyInspection:true};},readGrantsDigest:readGrants,readSourceStateDigest});
 const sourceSnapshot=await readSource();need(sourceSnapshot.sessions.length===144&&sourceSnapshot.sessions.every(s=>s.revokedAt!==null||Date.parse(s.expiresAt)<=Date.parse(sourceSnapshot.clock))&&sourceSnapshot.sourceStateSha256===stateSha,'SOURCE_SESSIONS');
 return Object.freeze({sourceSnapshot:structuredClone(sourceSnapshot),async forTarget({claim,database,makeClient,inventory,expectedKeySha}){
   const plan=claim.plan;need(typeof database?.inspectDatabase==='function'&&typeof database.targetConnection==='function'&&typeof makeClient==='function'&&typeof inventory==='function'&&hex(expectedKeySha),'TARGET_CONTEXT');
   const target=await database.inspectDatabase(plan);need(target.cluster!==sourcePin.cluster&&target.database===plan.database&&target.role===plan.role&&target.roleIsolated===true&&target.canConnectSource===false&&target.otherSessions===0,'TARGET_IDENTITY');
   let busy=false;const readSnapshot=async()=>{need(!busy,'CONCURRENT_SNAPSHOT');busy=true;let client;try{client=makeClient(database.targetConnection());const verifyCustody=async()=>{await client.$disconnect();await claim.verifyPaths();const o=await database.inspectDatabase(plan);need(sameDb(o,target)&&o.roleIsolated===true&&o.canConnectSource===false&&o.otherSessions===0,'TARGET_DRIFT');return {...o,readOnlyInspection:true};};return await makeReader({db:client,target,expectedTables,verifyCustody,readGrantsDigest:readGrants,readSourceStateDigest})();}finally{try{await client?.$disconnect();}finally{busy=false;}}};
   const preservation=createM7PreservationReader({sourceSnapshot,capture:c,sourceStateSha:stateSha,expectedKeySha,readSnapshot,readInventory:k=>inventory(plan.storage[k])});
   return Object.freeze({readSnapshot,readPreservation:preservation.read,preservation:preservation.baseline,target:structuredClone(target)});
 }});
}
