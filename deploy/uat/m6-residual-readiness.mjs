// Report only non-sensitive readiness counts/booleans, never identities or grants.
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RESIDUAL_'+c),{safeCode:'M6_RESIDUAL_'+c});};
const keys=['BEN','KHAIMOOK','FOREMAN','JAI','STORE_SITE'];
const required={BEN:['schedule.programme.view','schedule.work_plan.confirm'],KHAIMOOK:['schedule.programme.view','schedule.work_plan.prepare'],FOREMAN:['schedule.programme.view','schedule.progress.record'],JAI:['procurement.po.view','documents.document.view'],STORE_SITE:['documents.document.view']};
const codes={BEN:'MANAGEMENT',JAI:'PROCUREMENT_OFFICER'};
export function describeResidualReadiness({roster,canonicalRoles,site,activities,budgetLines,planCount,confirmedPlanCount,supplierEventCount}){
 need(keys.every(k=>Array.isArray(roster?.[k]?.roleCodes)&&Array.isArray(roster[k].permissions)),'ROSTER');
 need(Array.isArray(canonicalRoles)&&canonicalRoles.length<=2&&new Set(canonicalRoles.map(r=>r.roleCode)).size===canonicalRoles.length&&canonicalRoles.every(r=>Object.values(codes).includes(r.roleCode)&&typeof r.isActive==='boolean'&&Array.isArray(r.permissions)),'CANONICAL_ROLES');
 need([planCount,confirmedPlanCount,supplierEventCount].every(x=>Number.isSafeInteger(x)&&x>=0)&&confirmedPlanCount<=planCount,'COUNTS');
 need(Array.isArray(activities)&&activities.length<=200&&Array.isArray(budgetLines)&&budgetLines.length<=500,'FIXTURE_BOUND');
 const byId=new Map(activities.map(a=>[a.id,a]));need(byId.size===activities.length,'ACTIVITY_ID');
 function ancestorIds(a){const seen=new Set();let p=a.parentActivityId;while(p){need(!seen.has(p)&&p!==a.id&&seen.size<100,'ACTIVITY_CYCLE');seen.add(p);const parent=byId.get(p);if(!parent)return null;p=parent.parentActivityId;}return seen;}
 const eligible=activities.filter(a=>a.isActive===true&&a.isSummary===false);let pairs=0;
 for(const a of eligible.filter(a=>!a.isMilestone))for(const m of eligible.filter(a=>a.isMilestone)){const aa=ancestorIds(a),mm=ancestorIds(m);if(!aa||!mm||aa.has(m.id)||mm.has(a.id))continue;for(const line of budgetLines.filter(l=>l.wbsId===a.wbsId&&l.positiveQuantity===true))pairs++;}
 const canonicalRoleState=Object.fromEntries(Object.entries(codes).map(([k,code])=>{const role=canonicalRoles.find(r=>r.roleCode===code);return [k,{assigned:roster[k].roleCodes.includes(code),exists:!!role,active:role?.isActive===true,requiredPermissionPresent:role?.permissions.includes(k==='BEN'?'schedule.work_plan.confirm':'procurement.po.view')===true,additionalPermissionCount:role?.permissions.filter(p=>!roster[k].permissions.includes(p)).length??0}];}));
 const missingPermissions=Object.fromEntries(keys.map(k=>[k,required[k].filter(p=>!roster[k].permissions.includes(p))]));
 need(site&&['signedReceiptPresent','issueDimensionsPresent','threeLevelWbsPresent','activityTypePresent','boqAllocationPresent'].every(k=>typeof site[k]==='boolean'),'SITE');
 return {site:{...site},fm02:{planCount,confirmedPlanCount,eligiblePairCount:pairs,requiresPlanCreation:planCount===0},supplier:{eventCount:supplierEventCount,requiresNewEvents:supplierEventCount===0},canonicalRoleState,missingPermissions,executionAuthorized:false,sessionsCreated:0,businessMutationsPerformed:false};
}
