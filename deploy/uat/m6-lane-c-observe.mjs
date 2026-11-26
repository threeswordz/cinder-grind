// Isolated M6 lane evidence discovery. Aggregate counts only; not business acceptance.
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export const queries=Object.freeze({"physicalClaims":"SELECT count(*) AS n FROM public.subcontract_physical_claims","physicalDecisions":"SELECT count(*) AS n FROM public.subcontract_physical_decisions","certificationScopeDifferences":"SELECT count(*) AS n FROM public.subcontract_certifications c LEFT JOIN public.subcontract_claims cl ON cl.id=c.claim_id AND cl.company_id=c.company_id AND cl.project_id=c.project_id AND cl.agreement_id=c.agreement_id LEFT JOIN public.subcontract_claim_assessments a ON a.id=c.assessment_id AND a.claim_id=c.claim_id AND a.company_id=c.company_id AND a.project_id=c.project_id AND a.agreement_id=c.agreement_id WHERE cl.id IS NULL OR a.id IS NULL","retentionEntries":"SELECT count(*) AS n FROM public.retention_ledger_entries"});
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
    return {lane:'C',observations,workflowVerified:false,mayMutate:false};
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
