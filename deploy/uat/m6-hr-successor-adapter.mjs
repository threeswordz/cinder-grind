// HR-only adapter for the coordinator's pinned successor operator. Does not
// open sessions, write DB rows, read key contents, run migrations or deploy.
import {hrTables,verifyHrSuccessorCustody} from './m6-hr-successor-boundaries.mjs';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_HR_ADAPTER_'+code),{safeCode:'M6_HR_ADAPTER_'+code});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const snapshotTables=Object.freeze([...hrTables,'documents','document_links']);
// Exact same SQL representation as the existing fm03Snapshot, with a fixed
// table allowlist and bounded size. Keep private snapshots in memory only.
export async function captureHrSuccessorSnapshot(db,database='proto_a_01'){
 need(['proto_a_01','m6_successor_rehearsal'].includes(database),'DB_SCOPE');
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const ids=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
  need(ids.length===1&&ids[0].db===database&&ids[0].role==='proto_runtime'&&ids[0].ro==='on'&&ids[0].isolation==='repeatable read','DB_IDENTITY');
  await requireNoLiveSessions(tx);
  const out={};for(const t of snapshotTables){
   const rows=await tx.$queryRawUnsafe('SELECT to_jsonb(t)::text AS bytes FROM public."'+t+'" t LIMIT 10001');
   need(Array.isArray(rows)&&rows.length<=10000&&rows.every(r=>typeof r?.bytes==='string'&&r.bytes.length>0&&r.bytes.length<=1048576),'SNAPSHOT_BOUND');
   out[t]=rows.map(r=>({__fm03_exact_row_json:r.bytes}));
  }
  return out;
 },{isolationLevel:'RepeatableRead',timeout:60000});
}
function read(snapshot,t){const r=snapshot?.[t];need(Array.isArray(r)&&r.length<=10000,'TABLE');return r.map(x=>{try{const v=JSON.parse(x.__fm03_exact_row_json);need(uuid(v?.id),'ROW');return v;}catch{need(false,'ROW');}});}
// cdBinding must come from the existing independently pinned bindRetainedCD,
// not user-provided IDs. Resolve the HR Document from sealed custody, rather
// than mistaking the attachment UUID for its distinct canonical Document UUID.
export function bindHrSuccessorDenials(snapshot,cdBinding){
 const h=cdBinding?.hr,f=cdBinding?.finance,actors=cdBinding?.actors;
 need(h&&f&&actors&&[h.companyId,h.employeeId,h.attachmentEmployeeId,f.companyId,f.projectId,f.documentId,cdBinding.foreignCompanyId].every(uuid)&&h.companyId===f.companyId&&h.companyId!==cdBinding.foreignCompanyId&&h.employeeId!==h.attachmentEmployeeId,'CD_BINDING');
 need(Array.isArray(h.attachments)&&h.attachments.length===1&&uuid(h.attachments[0]?.id)&&h.attachments[0].version===1,'SEALED_ATTACHMENT');
 const attachments=read(snapshot,'hr_document_attachments'),a=attachments.filter(x=>x.id===h.attachments[0].id);
 need(a.length===1&&a[0].company_id===h.companyId&&a[0].employee_id===h.attachmentEmployeeId&&a[0].actor_user_id===actors.KOH?.userId&&a[0].version===1&&uuid(a[0].document_id),'ATTACHMENT_SCOPE');
 const docId=a[0].document_id,docs=read(snapshot,'documents'),links=read(snapshot,'document_links');
 const d=docs.filter(x=>x.id===docId),control=docs.filter(x=>x.id===f.documentId),privateLinks=links.filter(x=>x.document_id===docId);
 need(docId!==f.documentId&&d.length===1&&d[0].company_id===h.companyId&&d[0].is_active===true&&privateLinks.length===1&&privateLinks[0].entity_type==='HR_ATTACHMENT'&&privateLinks[0].entity_id===h.attachmentEmployeeId,'PRIVATE_CUSTODY');
 need(control.length===1&&control[0].company_id===h.companyId&&control[0].is_active===true&&links.some(x=>x.document_id===f.documentId&&x.entity_type==='PROJECT'&&x.entity_id===f.projectId)&&!links.some(x=>x.document_id===f.documentId&&x.entity_type==='HR_ATTACHMENT'),'GENERIC_CONTROL');
 return {actors,companyId:h.companyId,foreignCompanyId:cdBinding.foreignCompanyId,employeeId:h.attachmentEmployeeId,otherEmployeeId:h.employeeId,attachmentId:a[0].id,documentId:docId,projectId:f.projectId,controlDocumentId:f.documentId};
}
// oldDocuments is the independently captured PRE-SUCCESSOR inventory, after
// the sealed M6 attachment exists. The pre-M6 upload inventory is not enough.
// The caller owns runtime identity, receipt validation, and secure inventories.
export async function observeHrSuccessorCustody({db,baseline,oldDocuments,oldKeys,readFiles,verifyRuntime}){
 need(typeof readFiles==='function'&&typeof verifyRuntime==='function','OBSERVATION_CONTEXT');
 await verifyRuntime();
 const capture=async()=>{const after=await captureHrSuccessorSnapshot(db),files=await readFiles();
  const result=verifyHrSuccessorCustody({before:baseline,after,oldDocuments,currentDocuments:files?.documents,oldKeys,currentKeys:files?.hrkeys});return {after,files,result};};
 const first=await capture(),second=await capture();
 // Other lanes may append unrelated files before this observation, but not
 // during it. Snapshot ordering from SQL is unspecified; compare row bytes.
 const normalized=s=>Object.fromEntries(snapshotTables.map(t=>[t,s[t].map(r=>r.__fm03_exact_row_json).sort()]));
 need(same(normalized(first.after),normalized(second.after))&&same(first.files,second.files),'OBSERVATION_DRIFT');
 await verifyRuntime();
 return {...second.result,status:'M6_HR_SUCCESSOR_CUSTODY_OBSERVED',repeatableRead:true,stableAcrossTwoCaptures:true,authenticatedWorkflowRepeated:false,protectedDataPrinted:false,milestone6Accepted:false,productionAuthorized:false};
}
