// Aggregate-only retained C/D integrity observations. No credentials, rows, writes or acceptance.
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
export const queries=Object.freeze({
  "physicalClaimScopeMismatch": "SELECT count(*) AS n FROM public.subcontract_physical_claims p LEFT JOIN public.subcontract_claims c ON c.id=p.claim_id AND c.company_id=p.company_id AND c.project_id=p.project_id AND c.agreement_id=p.agreement_id WHERE c.id IS NULL",
  "physicalRevisionOrphan": "SELECT count(*) AS n FROM public.subcontract_physical_revisions r LEFT JOIN public.subcontract_physical_claims p ON p.claim_id=r.claim_id WHERE p.claim_id IS NULL",
  "physicalSubmissionMismatch": "SELECT count(*) AS n FROM public.subcontract_physical_submissions s LEFT JOIN public.subcontract_physical_claims p ON p.claim_id=s.claim_id LEFT JOIN public.subcontract_physical_revisions r ON r.id=s.revision_id AND r.claim_id=s.claim_id WHERE p.claim_id IS NULL OR r.id IS NULL",
  "physicalDecisionMismatch": "SELECT count(*) AS n FROM public.subcontract_physical_decisions d LEFT JOIN public.subcontract_physical_claims p ON p.claim_id=d.claim_id LEFT JOIN public.subcontract_claim_assessments a ON a.id=d.assessment_id AND a.claim_id=d.claim_id AND a.company_id=p.company_id AND a.project_id=p.project_id AND a.agreement_id=p.agreement_id WHERE p.claim_id IS NULL OR a.id IS NULL",
  "retentionCertificationMismatch": "SELECT count(*) AS n FROM public.retention_ledger_entries l LEFT JOIN public.subcontract_certifications c ON c.id=l.certification_id AND c.company_id=l.company_id AND c.project_id=l.project_id AND c.agreement_id=l.agreement_id AND c.currency_code=l.currency_code WHERE c.id IS NULL",
  "retentionReversalScopeMismatch": "SELECT count(*) AS n FROM public.retention_ledger_entries l LEFT JOIN public.retention_ledger_entries o ON o.id=l.reverses_entry_id AND o.company_id=l.company_id AND o.project_id=l.project_id AND o.agreement_id=l.agreement_id AND o.certification_id=l.certification_id AND o.currency_code=l.currency_code WHERE l.reverses_entry_id IS NOT NULL AND (o.id IS NULL OR o.id=l.id)",
  "hrPrivateRevisionGaps": "SELECT count(*) AS n FROM (SELECT company_id,employee_id,category FROM public.hr_private_revisions GROUP BY company_id,employee_id,category HAVING min(version)<>1 OR max(version)<>count(*) OR count(DISTINCT version)<>count(*)) q",
  "hrEmploymentRevisionGaps": "SELECT count(*) AS n FROM public.hr_employments e LEFT JOIN (SELECT company_id,employment_id,count(*) AS n,min(version) AS lo,max(version) AS hi,count(DISTINCT version) AS distinct_n FROM public.hr_employment_revisions GROUP BY company_id,employment_id) r ON r.company_id=e.company_id AND r.employment_id=e.id WHERE e.current_version<>coalesce(r.n,0) OR (r.n IS NOT NULL AND (r.lo<>1 OR r.hi<>r.n OR r.distinct_n<>r.n))",
  "hrAttachmentDocumentTypeMismatch": "SELECT count(*) AS n FROM public.hr_document_attachments h LEFT JOIN public.documents d ON d.id=h.document_id AND d.company_id=h.company_id LEFT JOIN public.document_types t ON t.id=d.document_type_id AND t.company_id=d.company_id WHERE d.id IS NULL OR t.id IS NULL",
  "hrAttachmentVersionGaps": "SELECT count(*) AS n FROM (SELECT company_id,employee_id FROM public.hr_document_attachments GROUP BY company_id,employee_id HAVING min(version)<>1 OR max(version)<>count(*) OR count(DISTINCT version)<>count(*)) q"
});
export const population=Object.freeze({
  "physicalSubmissions": "SELECT count(*) AS n FROM public.subcontract_physical_submissions",
  "physicalDecisions": "SELECT count(*) AS n FROM public.subcontract_physical_decisions",
  "retentionEntries": "SELECT count(*) AS n FROM public.retention_ledger_entries",
  "hrPrivateRevisions": "SELECT count(*) AS n FROM public.hr_private_revisions",
  "hrEmploymentRevisions": "SELECT count(*) AS n FROM public.hr_employment_revisions",
  "hrAttachments": "SELECT count(*) AS n FROM public.hr_document_attachments"
});
export function aggregateResult(violations,populated) {
  const valid = (v,keys) => v && Object.keys(v).length===keys.length && keys.every(k=>Object.hasOwn(v,k)&&typeof v[k]==='bigint'&&v[k]>=0n);
  if(!valid(violations,Object.keys(queries))||!valid(populated,Object.keys(population))) throw Object.assign(new Error('M6_CD_AGGREGATE_INVALID'),{safeCode:'M6_CD_AGGREGATE_INVALID'});
  const counts=v=>Object.fromEntries(Object.entries(v).map(([k,n])=>[k,n.toString()]));
  return {status:Object.values(violations).some(n=>n!==0n)?'M6_CD_INTEGRITY_DIFFERENCES':Object.values(populated).some(n=>n===0n)?'M6_CD_INTEGRITY_EMPTY_COVERAGE':'M6_CD_RETAINED_INTEGRITY_OBSERVED',violations:counts(violations),population:counts(populated),authenticatedWorkflowVerified:false,historicalBaselineVerified:false,mayMutate:false,productionAuthorized:false};
}
export async function observeRetainedCD(db){
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const identity=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
  const i=identity[0];
  if(identity.length!==1||i.db!=='proto_a_01'||i.role!=='proto_runtime'||i.ro!=='on'||i.isolation!=='repeatable read')throw Object.assign(new Error('M6_CD_DB_IDENTITY_INVALID'),{safeCode:'M6_CD_DB_IDENTITY_INVALID'});
  await requireNoLiveSessions(tx);
  const read=async entries=>{const result={};for(const [k,sql] of Object.entries(entries)){
    const rows=await tx.$queryRawUnsafe(sql);
    if(!Array.isArray(rows)||rows.length!==1||typeof rows[0]?.n!=='bigint'||rows[0].n<0n)throw Object.assign(new Error('M6_CD_AGGREGATE_INVALID'),{safeCode:'M6_CD_AGGREGATE_INVALID'});
    result[k]=rows[0].n;
  }return result;};
  return aggregateResult(await read(queries),await read(population));
 },{isolationLevel:'RepeatableRead',timeout:30000});
}
