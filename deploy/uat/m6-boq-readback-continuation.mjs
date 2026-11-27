// Resume only the unread DEC-054 role matrix, preserving Event244 evidence.
import {siteReadbackPaths,assertM6QuantityProjection} from './m6-parallel-02-site-readback.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_BOQ_RESUME_'+c),{safeCode:'M6_BOQ_RESUME_'+c});};
const decimal=v=>{need(typeof v==='string'&&/^\d{1,14}(?:\.\d{1,4})?$/.test(v),'QUANTITY');const [a,b='']=v.split('.');return BigInt(a)*10000n+BigInt(b.padEnd(4,'0'));};
const denied=r=>r?.status===403||r?.status===404;
export function bindRemainingBoqSource(binding,sealed){
 const parse=t=>{need(Array.isArray(sealed?.[t]),'SOURCE');return sealed[t].map(r=>{try{return JSON.parse(r.__fm03_exact_row_json);}catch{need(false,'SOURCE');}});};
 const revisions=parse('budget_revisions').filter(r=>r.id===binding.costRevisionId&&r.company_id===binding.companyId&&r.project_id===binding.projectId&&r.created_by_user_id===binding.benUserId);need(revisions.length===1,'REVISION');
 // Parse numeric SQL JSON quantities directly from Prisma's decimal strings if
 // provided; the raw jsonb numeric representation is accepted only via exact
 // decimal token extraction, never by converting a JS Number back to a string.
 const lines=sealed.budget_revision_lines;need(Array.isArray(lines),'SOURCE');const raw=[];
 for(const row of lines){const s=row.__fm03_exact_row_json;let r;try{r=JSON.parse(s);}catch{need(false,'SOURCE');}if(r.budget_revision_id!==binding.costRevisionId)continue;
  const token=s.match(/"quantity"\s*:\s*(?:"(\d{1,14}(?:\.\d{1,4})?)"|(\d{1,14}(?:\.\d{1,4})?))\s*[,}]/);need(token&&typeof r.id==='string'&&typeof r.uom_id==='string','SOURCE_LINE');const quantity=token[1]??token[2];decimal(quantity);raw.push({id:r.id,uomId:r.uom_id,quantity});}
 need(raw.length>0&&new Set(raw.map(r=>r.id)).size===raw.length,'SOURCE_LINE');return raw;
}
export async function verifyRemainingBoqReadback(binding,{get},raw,prior){
 need(prior?.failedActor==='JAI'&&prior.failedStatus===403&&prior.completedReadbacks===13&&prior.revokedSessions===11&&/^[a-f0-9]{64}$/.test(prior.logSha256??''),'PRIOR');
 need(Array.isArray(raw)&&raw.length>0&&new Set(raw.map(r=>r.id)).size===raw.length&&typeof get==='function','CONTEXT');const p=siteReadbackPaths(binding);
 const check=(r,actor,route)=>{if(r?.status!==200||!r.data){const status=Number.isInteger(r?.status)&&r.status>=100&&r.status<=599?r.status:'UNKNOWN';need(false,actor+'_'+route+'_'+status);}const row=r.data;assertM6QuantityProjection(row);need(row.id===binding.costRevisionId&&row.companyId===binding.companyId&&row.projectId===binding.projectId&&Array.isArray(row.lines)&&row.lines.length===raw.length&&new Set(row.lines.map(x=>x.id)).size===raw.length&&raw.every(x=>row.lines.some(y=>y.id===x.id&&y.uomId===x.uomId&&decimal(y.quantity)===decimal(x.quantity))),'RAW_QUANTITY');};
 for(const actor of ['JAI','PORN','STORE_SITE']){check(await get(actor,p.quantity),actor,'QUANTITY');const alternate=await get(actor,p.cost);if(!denied(alternate))check(alternate,actor,'COST');need(denied(await get(actor,p.client)),actor+'_CLIENT_DENIAL');}
 need(denied(await get('STORE_SITE',p.foreign)),'FOREIGN_PROJECT_DENIAL');
 return {status:'M6_02_SITE_MATERIAL_ROLE_READBACK_VERIFIED',priorReadbacksReused:13,remainingActors:3,boqRoleMatrix:true,mismatchedProjectDenial:true,mutationsPerformed:false,humanUatCompleted:false,productionAuthorized:false};
}
