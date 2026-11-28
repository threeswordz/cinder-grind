// HR-only successor exit preparation. No session creation, grants, file writes,
// migration or release. The coordinator owns trusted source/receipt custody and
// the existing synthetic session batch plus its complete auth preservation.
import {createHash} from 'node:crypto';
import {captureHrSuccessorSnapshot,bindHrSuccessorDenials} from './m6-hr-successor-adapter.mjs';
import {verifyHrSuccessorCustody} from './m6-hr-successor-boundaries.mjs';
import {executeHrSuccessorDenials} from './m6-hr-successor-http.mjs';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
import {createHrFixtureProjection} from './m6-hr-fixture-projection.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_HR_EXIT_'+code),{safeCode:'M6_HR_EXIT_'+code});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const releaseSha='5535dd890fd84489d76b611929e70e3422c746e8',sourceSha='9fa0506e9a50fd556f1c4404e4db2e3d88093b85';
const phaseNames=['upgrade','configure','finance','hr','boq','preserve'];
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function verifyHrSealedPhase(ready,receipts){
 need(ready?.status==='M6_NEW_JOURNEYS_SEALED_FOR_TECHNICAL_REVIEW'&&ready.releaseSha===releaseSha&&ready.sourceSha===sourceSha&&ready.stageCount===6&&ready.automaticRetryAllowed===false&&ready.milestone6Accepted===false&&ready.humanUatCompleted===false&&ready.productionAuthorized===false,'SEALED_READY');
 need(Array.isArray(receipts)&&receipts.length===6&&receipts.every((r,i)=>r?.name===phaseNames[i]&&r.status==='M6_PHASE_RECORDED'&&r.releaseSha===releaseSha&&r.productionAuthorized===false&&sha(r.proofSha256)),'SEALED_PHASES');
 const expected={ok:true,releaseSha,proof:{status:'M6_ENCRYPTED_HR_ATTACHMENT_HTTP_VERIFIED',encryptedAtRestVerified:true}};
 need(receipts[3].proofSha256===digest(expected),'SEALED_HR_PROOF');
 const preserve={ok:true,releaseSha,originalPopulatedDumpPreserved:true,previousHrKeysAndUploadsIntact:true,protectedHrEncryptedFileVerified:true,oldHistoricalSnapshotPreserved:true};
 need(receipts[5].proofSha256===digest(preserve),'SEALED_PRESERVATION_PROOF');
 return true;
}
function rows(snapshot,t){const a=snapshot?.[t];need(Array.isArray(a)&&a.length<=10000,'ACCESS_TABLE');const r=a.map(x=>{const raw=x?.__fm03_exact_row_json;need(typeof raw==='string'&&raw.length>0&&raw.length<=1048576,'ACCESS_ROW');let v;try{v=JSON.parse(raw);}catch{need(false,'ACCESS_ROW');}need(uuid(v?.id),'ACCESS_ROW');return {v,raw};});need(new Set(r.map(x=>x.v.id)).size===r.length,'ACCESS_DUPLICATE');return r;}
const sortRaw=a=>a.map(x=>x.raw).sort();
export const accessTables=Object.freeze(['roles','user_roles','permissions','role_permissions']);
// HR-specific role-permission edges and their permission definitions must
// remain byte-exact. Native role and user-role membership remain unchanged;
// unrelated additive permission edges from other approved lanes are allowed.
export function hrAccessProjection(snapshot){
 const roles=rows(snapshot,'roles'),members=rows(snapshot,'user_roles'),permissions=rows(snapshot,'permissions'),edges=rows(snapshot,'role_permissions');
 const roleIds=new Set(roles.map(x=>x.v.id)),permissionIds=new Set(permissions.map(x=>x.v.id));
 need(roles.length>0&&members.length>0&&permissions.every(x=>typeof x.v.permission_code==='string')&&new Set(permissions.map(x=>x.v.permission_code)).size===permissions.length,'ACCESS_COVERAGE');
 need(members.every(x=>uuid(x.v.user_id)&&roleIds.has(x.v.role_id)&&uuid(x.v.company_id))&&edges.every(x=>roleIds.has(x.v.role_id)&&permissionIds.has(x.v.permission_id)),'ACCESS_ORPHAN');
 const hr=permissions.filter(x=>x.v.permission_code.startsWith('hr.')),hrIds=new Set(hr.map(x=>x.v.id)),hrEdges=edges.filter(x=>hrIds.has(x.v.permission_id));
 need(hr.length>0&&hrEdges.length>0,'ACCESS_COVERAGE');
 return {roles:sortRaw(roles),memberships:sortRaw(members),hrPermissions:sortRaw(hr),hrEdges:sortRaw(hrEdges)};
}
export async function captureHrAccessProjection(db,database='proto_a_01',fixtureProjection){
 need(fixtureProjection===undefined||database==='m6_successor_rehearsal','FIXTURE_SCOPE');
 need(['proto_a_01','m6_successor_rehearsal'].includes(database),'DB_SCOPE');
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const ids=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
  need(ids.length===1&&ids[0].db===database&&ids[0].role==='proto_runtime'&&ids[0].ro==='on'&&ids[0].isolation==='repeatable read','DB_IDENTITY');
  await requireNoLiveSessions(tx);
  const snapshot={};for(const t of accessTables){const a=await tx.$queryRawUnsafe('SELECT to_jsonb(t)::text AS bytes FROM public."'+t+'" t LIMIT 10001');need(Array.isArray(a)&&a.length<=10000,'ACCESS_TABLE');snapshot[t]=a.map(r=>({__fm03_exact_row_json:r.bytes}));}
  return hrAccessProjection(fixtureProjection?fixtureProjection.projectAccess(snapshot):snapshot);
 },{isolationLevel:'RepeatableRead',timeout:60000});
}
// A sealed post-upload SQL snapshot contains the historically attested HR
// ciphertext checksum and length. Build only its EXPECTED document projection,
// not a fabricated past disk inventory. Actual bytes come from readFiles().
export function sealedHrDocumentProjection(snapshot){
 const attachments=rows(snapshot,'hr_document_attachments'),docs=rows(snapshot,'documents');need(attachments.length>0,'ATTACHMENT_COVERAGE');
 const out=[['','directory']],seen=new Set();for(const a of attachments){const matched=docs.filter(x=>x.v.id===a.v.document_id);need(matched.length===1,'DOCUMENT_BINDING');const d=matched[0].v,k=d.storage_key;need(typeof k==='string'&&k.length>0&&k.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.includes('\\')&&!p.includes('\0'))&&!seen.has(k)&&sha(d.checksum)&&Number.isSafeInteger(d.file_size_bytes)&&d.file_size_bytes>0,'DOCUMENT_METADATA');seen.add(k);out.push([k,d.file_size_bytes,d.checksum]);}return out;
}
function normalizeSnapshot(snapshot){return Object.fromEntries(Object.entries(snapshot).map(([t,a])=>[t,a.map(x=>x.__fm03_exact_row_json).sort()]));}
// Run before the existing synthetic session batch, pass only its pre-bound
// callbacks to the coordinator, then finish AFTER all sessions are revoked.
// No callback invocation is a substitute for independent runtime attestation.
export async function prepareHrSuccessorExit({db,database='proto_a_01',ready,receipts,sealedSnapshot,oldKeys,preservedKeys,cdBinding,readFiles,verifyRuntime,fixtureReceipt}){
 need(typeof readFiles==='function'&&typeof verifyRuntime==='function','CONTEXT');
 verifyHrSealedPhase(ready,receipts);need(same(oldKeys,preservedKeys),'PRESERVED_KEYS');
 need(fixtureReceipt===undefined||database==='m6_successor_rehearsal','FIXTURE_SCOPE');
 const fixtureProjection=fixtureReceipt===undefined?undefined:createHrFixtureProjection(fixtureReceipt);
 const baseline=structuredClone(sealedSnapshot),expectedAccess=hrAccessProjection(baseline),expectedDocuments=sealedHrDocumentProjection(baseline),expectedKeys=structuredClone(oldKeys);
 const binding=bindHrSuccessorDenials(baseline,cdBinding);
 const capture=async()=>{await verifyRuntime();const snapshot=await captureHrSuccessorSnapshot(db,database),access=await captureHrAccessProjection(db,database,fixtureProjection),files=structuredClone(await readFiles());
  need(same(expectedAccess,access),'HR_ACCESS_DRIFT');
  const custody=verifyHrSuccessorCustody({before:baseline,after:fixtureProjection?fixtureProjection.projectEmployees(snapshot):snapshot,oldDocuments:expectedDocuments,currentDocuments:files?.documents,oldKeys:expectedKeys,currentKeys:files?.hrkeys});await verifyRuntime();return {snapshot:normalizeSnapshot(snapshot),access,files,custody};};
 const before=await capture();let attempted=false,denials,finished=false;
 return Object.freeze({
  async verifyDenials(sessions,fetchImpl,origins={}){need(!attempted&&!finished,'NO_REPLAY');attempted=true;denials=await executeHrSuccessorDenials({binding,sessions,fetchImpl,origin:origins.origin,webOrigin:origins.webOrigin});return {status:denials.status,denials:denials.denials,positiveControls:denials.positiveControls};},
  async finish(){need(!finished,'NO_REPLAY');finished=true;const after=await capture();need(same(before.snapshot,after.snapshot)&&same(before.access,after.access)&&same(before.files,after.files),'SESSION_BATCH_DRIFT');need(denials?.status==='M6_HR_SUCCESSOR_DENIAL_ASSERTIONS_PASS'&&denials.denials===15&&denials.positiveControls===2,'DENIALS_UNVERIFIED');
   return {...after.custody,status:'M6_HR_SUCCESSOR_EXIT_ASSERTIONS_PASS',historicalHrPhaseDigestVerified:true,historicalPreservationPhaseDigestVerified:true,hrRolePermissionContinuityVerified:true,originalKeyCopyMatched:true,sealedDocumentChecksumProjectionMatched:true,denials:15,positiveControls:2,privacyHeadersVerified:true,zeroActiveSessionsObserved:true,fullAuthHistoryRequiresCoordinator:true,protectedDataPrinted:false,milestone6Accepted:false,productionAuthorized:false};}
 });
}
