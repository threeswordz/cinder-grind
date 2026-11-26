// Isolated M6 lane evidence discovery. Aggregate counts only; not business acceptance.
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export const queries=Object.freeze({"privateRevisionCount":"SELECT count(*) AS n FROM public.hr_private_revisions","employmentRevisionCount":"SELECT count(*) AS n FROM public.hr_employment_revisions","privateAttachmentCount":"SELECT count(*) AS n FROM public.hr_document_attachments","attachmentScopeDifferences":"SELECT count(*) AS n FROM public.hr_document_attachments h LEFT JOIN public.documents d ON d.id=h.document_id AND d.company_id=h.company_id LEFT JOIN public.employees e ON e.id=h.employee_id AND e.company_id=h.company_id WHERE d.id IS NULL OR e.id IS NULL"});
export async function observeLane(db){
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const id=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
    need(id.length===1&&id[0].db==='proto_a_01'&&id[0].role==='proto_runtime'&&id[0].ro==='on'&&id[0].isolation==='repeatable read','M6_LANE_DB_IDENTITY_INVALID');
    await requireNoLiveSessions(tx);
    const observations={};
    for(const [key,sql] of Object.entries(queries)){
      const rows=await tx.$queryRawUnsafe(sql);
      need(Array.isArray(rows)&&rows.length===1&&typeof rows[0]?.n==='bigint'&&rows[0].n>=0n,'M6_LANE_COUNT_INVALID');
      observations[key]=rows[0].n.toString();
    }
    return {lane:'D',observations,workflowVerified:false,mayMutate:false};
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
