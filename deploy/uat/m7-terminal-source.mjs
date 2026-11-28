// M7 predecessor admission: read-only, never starts or mutates a runtime.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const need=(ok,c)=>{if(!ok)throw Error('M7_TERMINAL_'+c);};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const terminalAnchor=Object.freeze({applicationSha:'3e35105edac7151aeca800c1175af736a99f6009',applicationTree:'319f843a36b880971fe0cba5d0c58eb01f68c044',operatorSha:'501a93747cc1a268a42205233a4533c719af25aa',buildSha256:'2f8cd6af4141d1fcb366884f460a17ecfae30248c59fbe16898f5512f764349d',planSha256:'30ceed720fed09c347881f51b10a2f651013eb1033846a3ba5725f6c5f272037',finalProofSha256:'0615e1cd86a2142eba287a8a7660e3d530558d6bcebc7d2cf0dda7222261b6cb',terminalSnapshotSha256:'4c14c03b3cb79b42d5b585edba45e6749ac9c60c98e58a6c261149de6c4f3769',supplierSealSha256:'7ef3f545cd2fe37d7a3afe6c7c5a250ae2bdfe9ef490c5fb8aa6c81a95993a71',database:'m6_successor_rehearsal'});
const planKeys=['applicationSha','applicationTree','operatorSha','buildSha256','previousOperatorSha','previousPlanSha256','snapshotSha256','previousAttemptSha256','previousBlockedSha256','supplierSealSha256','actorIdsSha256','sourceIdsSha256','database','businessMutationAuthorized','retainedMutationAuthorized','productionAuthorized','automaticRetryAllowed'];
export function verifyReceiptAgainstAnchor(receipt,anchor){
  need(receipt?.status==='M6_BROWSER_ONLY_RECOVERY_RECEIPT_SEALED','RECEIPT_STATUS');
  need(Object.entries(anchor).every(([k,v])=>receipt[k]===v),'RECEIPT_ANCHOR');
  const {status,finalProofSha256,...proof}=receipt;
  need(digest(proof)===finalProofSha256&&digest(Object.fromEntries(planKeys.map(k=>[k,receipt[k]])))===receipt.planSha256,'RECEIPT_DIGEST');
  need(['executionVerified','browserVerified','zeroActiveSessions','businessRowsUnchanged','retainedDatabaseAndFilesUnchanged','recoveryCopyUnchanged','priorAttemptsUnchanged','listenerPortsReleased'].every(k=>receipt[k]===true)&&['businessMutationAuthorized','retainedMutationAuthorized','productionAuthorized','automaticRetryAllowed','milestone6Accepted','humanUatCompleted','secretsPrinted'].every(k=>receipt[k]===false),'RECEIPT_FLAGS');
  need(receipt.sessionRows===144&&receipt.historicalSessionRowsPreserved===139&&receipt.newSessionsRevoked===5&&receipt.browserActors===5&&receipt.newBusinessTransactions===0&&receipt.newUploads===0&&receipt.supplierLifecycleEvents===7&&receipt.dispatchEvents===2&&receipt.totalResidualFiles===6,'RECEIPT_COUNTS');
  return true;
}
export function terminalPaths(root){
  need(typeof root==='string'&&root.startsWith('/')&&resolve(root)===root&&root.endsWith('/Construction-ERP-Prototype-Runtime'),'ROOT');
  const parent=join(root,'m6-successor-70013b5139292ef33563447f8937c8f132feabd2');
  const stage=join(parent,'event294-browser-only-runtime');
  return Object.freeze({receipt:join(parent,'event294-browser-only','ready-private.json'),stage,documents:join(stage,'documents'),uploads:join(stage,'uploads'),hrkeys:join(stage,'hrkeys')});
}
const sameStat=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','uid','mode','nlink'].every(k=>a[k]===b[k]);
export async function readM7PrivateTerminalReceipt(path){
  const before=await lstat(path);
  need(before.isFile()&&before.nlink===1&&before.uid===process.getuid()&&!(before.mode&0o077)&&before.size>0&&before.size<=1048576&&await realpath(path)===path,'PRIVATE_RECEIPT');
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    need(sameStat(before,await f.stat()),'RECEIPT_DRIFT');
    const bytes=Buffer.alloc(before.size);
    try{let offset=0;while(offset<bytes.length){const {bytesRead}=await f.read(bytes,offset,bytes.length-offset,offset);need(bytesRead>0,'RECEIPT_DRIFT');offset+=bytesRead;}need(sameStat(before,await f.stat())&&sameStat(before,await lstat(path))&&await realpath(path)===path,'RECEIPT_DRIFT');return JSON.parse(bytes.toString('utf8'));}finally{bytes.fill(0);}
  }finally{await f.close();}
}
// Match M6's exact ordered 174-table row-hash census, not a different M7 digest.
export async function readM7TerminalCensus(db){
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const ids=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
    need(ids.length===1&&ids[0].db===terminalAnchor.database&&ids[0].role==='proto_runtime'&&ids[0].ro==='on'&&ids[0].isolation==='repeatable read','DB_IDENTITY');
    const names=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(r=>r.tablename);
    need(names.length===174&&new Set(names).size===174&&names.every(n=>/^[a-z_][a-z0-9_]*$/.test(n)),'TABLES');
    const rows={};for(const name of names){const r=await tx.$queryRawUnsafe('SELECT encode(sha256(convert_to(to_jsonb(t)::text,\'UTF8\')),\'hex\') AS hash FROM public."'+name+'" t LIMIT 10001');need(r.length<=10000&&r.every(v=>hex(v.hash)),'ROWS');rows[name]=r.map(v=>v.hash).sort();}
    const active=await tx.$queryRawUnsafe('SELECT count(*)::text AS n FROM public.user_sessions WHERE revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP');
    need(rows.user_sessions?.length===144&&rows.po_dispatch_events?.length===2&&active.length===1&&active[0].n==='0','SESSION_CENSUS');
    return Object.freeze({snapshotSha256:digest(rows),tables:174,sessions:144,activeSessions:0});
  },{isolationLevel:'RepeatableRead',timeout:120000});
}
export async function admitM7TerminalSource({root,db,inspectSource}){
  need(typeof inspectSource==='function','SOURCE_INSPECTOR');
  const paths=terminalPaths(root),receipt=await readM7PrivateTerminalReceipt(paths.receipt);
  verifyReceiptAgainstAnchor(receipt,terminalAnchor);
  const inspect=async()=>{const s=await inspectSource(paths);need(s?.applicationSha===terminalAnchor.applicationSha&&s.applicationTree===terminalAnchor.applicationTree&&s.buildSha256===terminalAnchor.buildSha256&&s.database===terminalAnchor.database&&s.quiescent===true&&s.pathsMatch===true&&s.priorStorageMatched===true&&hex(s.storageSha256),'SOURCE_OBSERVATION');return s.storageSha256;};
  const before=await inspect(),census=await readM7TerminalCensus(db),after=await inspect();
  need(before===after&&census.snapshotSha256===terminalAnchor.terminalSnapshotSha256,'SOURCE_DRIFT');
  verifyReceiptAgainstAnchor(await readM7PrivateTerminalReceipt(paths.receipt),terminalAnchor);
  return Object.freeze({status:'M7_TERMINAL_SOURCE_ADMITTED_READ_ONLY',...census,storageSha256:before,actualCaptureVerified:false,nativeRecoveryVerified:false,milestone7Accepted:false,productionAuthorized:false});
}
