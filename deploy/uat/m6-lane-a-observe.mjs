// Isolated M6 lane evidence discovery. Aggregate counts only; not business acceptance.
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export const queries=Object.freeze({"dimensionedRequestIssueLinks":"SELECT count(*) AS n FROM public.material_request_issue_links l JOIN public.material_request_lines r ON r.id=l.request_line_id JOIN public.material_issue_items i ON i.id=l.material_issue_item_id WHERE r.wbs_id IS NOT NULL AND r.cost_code_id IS NOT NULL AND r.activity_id IS NOT NULL AND r.wbs_id=i.wbs_id AND r.cost_code_id=i.cost_code_id AND r.activity_id=i.activity_id","requestIssueDimensionDifferences":"SELECT count(*) AS n FROM public.material_request_issue_links l JOIN public.material_request_lines r ON r.id=l.request_line_id JOIN public.material_issue_items i ON i.id=l.material_issue_item_id WHERE r.wbs_id IS DISTINCT FROM public.i.wbs_id OR r.cost_code_id IS DISTINCT FROM public.i.cost_code_id OR r.activity_id IS DISTINCT FROM public.i.activity_id","confirmedWeightedPlans":"SELECT count(*) AS n FROM public.project_progress_plans WHERE confirmed_at IS NOT NULL AND confirmed_by_user_id IS NOT NULL","weightedPlanSourceLines":"SELECT count(*) AS n FROM public.project_progress_plan_lines WHERE approved_budget_revision_line_id IS NOT NULL AND planned_quantity IS NOT NULL AND uom_id IS NOT NULL"});
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
    return {lane:'A',observations,workflowVerified:false,mayMutate:false};
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
