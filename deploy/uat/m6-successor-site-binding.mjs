// Bind the exact sealed DEC-054 phase to the earlier material/site journey.
import {createHash} from 'node:crypto';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_SITE_BIND_'+c),{safeCode:'M6_SITE_BIND_'+c});};
const releaseSha='5535dd890fd84489d76b611929e70e3422c746e8';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function rows(snapshot,t){need(Array.isArray(snapshot?.[t])&&snapshot[t].length<=10000,'TABLE');return snapshot[t].map(r=>{let v;try{v=JSON.parse(r.__fm03_exact_row_json);}catch{need(false,'ROW');}need(uuid(v?.id),'ROW');return v;});}
export function bindSuccessorSite({site,fixture,roster,sealedSnapshot,boqPhase}){
 need(site?.companyId===fixture?.companyId&&site.projectId===fixture.projectId&&site.foremanUserId===roster?.FOREMAN?.userId&&site.storeUserId===roster?.STORE_SITE?.userId&&site.pmUserId===roster?.KHAIMOOK?.userId&&[fixture.foreignProjectId,roster.BEN?.userId,roster.NANCY?.userId].every(uuid),'SITE');
 need(boqPhase?.name==='boq'&&boqPhase.status==='M6_PHASE_RECORDED'&&boqPhase.releaseSha===releaseSha&&boqPhase.productionAuthorized===false&&/^[a-f0-9]{64}$/.test(boqPhase.proofSha256??''),'PHASE');
 const scoped=r=>r.company_id===site.companyId&&r.project_id===site.projectId&&r.created_by_user_id===roster.BEN.userId;
 const costs=rows(sealedSnapshot,'budget_revisions').filter(r=>scoped(r)&&r.revision_note==='Synthetic DEC-054 Ben-approved Cost BOQ continuation');
 const clients=rows(sealedSnapshot,'customer_boq_versions').filter(scoped);
 const matches=[];for(const cost of costs)for(const client of clients.filter(v=>v.source_revision_id===cost.id)){
  const proof={ok:true,releaseSha,proof:{status:'M6_DEC054_COST_AND_BUFFERED_CLIENT_BOQ_HTTP_VERIFIED',sourceCostRevisionId:cost.id,clientBoqVersionId:client.id}};
  if(digest(proof)===boqPhase.proofSha256)matches.push([cost,client]);
 }
 need(matches.length===1,'PHASE_BINDING');const [cost,client]=matches[0];need(cost.id!==site.budgetRevisionId&&cost.id!==client.id,'BOQ_IDENTITY');
 return {...site,costRevisionId:cost.id,clientVersionId:client.id,foreignProjectId:fixture.foreignProjectId,benUserId:roster.BEN.userId,nancyUserId:roster.NANCY.userId};
}
