// Compare only the sealed M6 business/file slice, not the already-passed
// metadata/login batch. No sessions, decryption, business writes or release.
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
import {verifyDocumentInventory} from './prototype-transfer-upgrade.mjs';
import {addedColumns} from './m6-historical-rows.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_SEALED_'+code),{safeCode:'M6_SEALED_'+code});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sha=/^[a-f0-9]{64}$/;
const release='5535dd890fd84489d76b611929e70e3422c746e8',source='9fa0506e9a50fd556f1c4404e4db2e3d88093b85';
export const phases=Object.freeze(['upgrade','configure','finance','hr','boq','preserve']);
export const tables=Object.freeze(['supplier_invoices','supplier_invoice_items','payments','supplier_payment_allocations','goods_receipts','goods_receipt_items','purchase_orders','purchase_order_lines','budget_revisions','budget_revision_lines','customer_boq_versions','customer_boq_edits','customer_boq_lines','customer_boq_mappings','approval_instances','approval_actions','documents','document_links','hr_document_attachments']);
const required=tables.filter(t=>t!=='customer_boq_mappings');
export function verifySealedReceipt(ready,receipts){
 need(ready?.status==='M6_NEW_JOURNEYS_SEALED_FOR_TECHNICAL_REVIEW'&&ready.sourceSha===source&&ready.releaseSha===release&&ready.stageCount===6&&ready.automaticRetryAllowed===false&&ready.milestone6Accepted===false&&ready.humanUatCompleted===false&&ready.productionAuthorized===false,'READY');
 need(Array.isArray(receipts)&&receipts.length===phases.length&&receipts.every((r,i)=>r?.name===phases[i]&&r.status==='M6_PHASE_RECORDED'&&r.releaseSha===release&&sha.test(r.proofSha256??'')&&r.productionAuthorized===false),'PHASES');
}
export function expectedRows(snapshot,table){
 need(tables.includes(table)&&Array.isArray(snapshot?.[table])&&snapshot[table].length<=10000,'TABLE');
 const rows=snapshot[table].map(r=>{const raw=r?.__fm03_exact_row_json;need(typeof raw==='string'&&raw.length>0&&raw.length<=1048576,'RAW');return raw;});
 need(!required.includes(table)||rows.length>0,'EMPTY');
 return rows.sort();
}
export function sqlFor(table){
 need(tables.includes(table),'TABLE');
 const cols=Object.hasOwn(addedColumns,table)?addedColumns[table]:[];
 const row=cols.length?'(to_jsonb(t) - ARRAY['+cols.map(c=>"'"+c+"'").join(',')+']::text[])':'to_jsonb(t)';
 return 'SELECT '+row+'::text AS bytes FROM public."'+table+'" t LIMIT 10001';
}
export function compareSealedRows(snapshot,current){
 const mismatched=[];
 for(const table of tables){
  const expected=expectedRows(snapshot,table),actual=current?.[table];
  need(Array.isArray(actual)&&actual.length<=10000&&actual.every(r=>typeof r?.bytes==='string'),'CURRENT');
  if(!same(expected,actual.map(r=>r.bytes).sort()))mismatched.push(table);
 }
 return {compared:tables.length,matched:tables.length-mismatched.length,mismatched};
}
export function verifySealedFiles(snapshot,{documents,oldKeys,copyKeys,currentKeys}){
 const docs=expectedRows(snapshot,'documents').map(JSON.parse),attachments=expectedRows(snapshot,'hr_document_attachments').map(JSON.parse);
 need(attachments.length===1&&docs.filter(d=>d.id===attachments[0].document_id&&d.company_id===attachments[0].company_id&&d.is_active===true).length===1&&typeof attachments[0].encrypted_metadata==='string'&&attachments[0].encrypted_metadata.length>0,'HR_SCOPE');
 need(Array.isArray(oldKeys)&&oldKeys.length>=2&&same(oldKeys[0],['','directory'])&&same(oldKeys,copyKeys)&&same(oldKeys,currentKeys),'KEY_CUSTODY');
 verifyDocumentInventory(docs,documents);
 return {documentChecksumsMatched:docs.length,encryptedAttachmentChecksumMatched:true,originalHrKeyInventoryMatched:true,authorizedPlaintextReadbackRepeated:false};
}
export async function observeSealedM6(db,snapshot,files){
 const result=await db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const rows=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
  need(rows.length===1&&rows[0].db==='proto_a_01'&&rows[0].role==='proto_runtime'&&rows[0].ro==='on'&&rows[0].isolation==='repeatable read','DB');
  await requireNoLiveSessions(tx);
  const current={};for(const t of tables)current[t]=await tx.$queryRawUnsafe(sqlFor(t));
  return compareSealedRows(snapshot,current);
 },{isolationLevel:'RepeatableRead',timeout:60000});
 if(result.mismatched.length)return {status:'M6_SEALED_JOURNEY_ROWS_BLOCKED',...result,mayMutate:false,productionAuthorized:false};
 const bytes=verifySealedFiles(snapshot,files);
 return {status:'M6_SEALED_JOURNEY_CONTINUITY_PASS',...result,...bytes,originalAuthorizedAccessEvidenceReused:true,authenticatedWorkflowRepeated:false,historicalBaselineVerified:false,milestone6Accepted:false,mayMutate:false,productionAuthorized:false};
}
