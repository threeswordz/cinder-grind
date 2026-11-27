// Compare the full successor row census around a separately authorized fixture
// transaction. Callers bind exact added rows privately before commit; never infer
// allowed changes from the post-transaction snapshot. No database mutation here.
const need=(ok,code)=>{if(!ok)throw Object.assign(Error('M6_FIXTURE_PRESERVATION_'+code),{safeCode:'M6_FIXTURE_PRESERVATION_'+code});};
const allowed=new Set(['employees','users','roles','user_roles','role_permissions','project_members','approval_workflows','approval_steps','approval_step_roles','audit_logs']);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function multiset(rows){need(Array.isArray(rows)&&rows.every(sha),'ROW_HASH');const counts=new Map();for(const h of rows)counts.set(h,(counts.get(h)??0)+1);return counts;}
export function verifySuccessorFixtureDelta(before,after,expectedAdditions,authorization){
 need(authorization?.database==='m6_successor_rehearsal'&&authorization.ownerAuthorizedFixture===true&&authorization.retainedMutationAuthorized===false&&authorization.productionAuthorized===false&&sha(authorization.planSha256),'AUTHORIZATION');
 const keys=Object.keys(before??{}).sort();need(keys.length===174&&JSON.stringify(keys)===JSON.stringify(Object.keys(after??{}).sort())&&keys.includes('_prisma_migrations')&&keys.includes('user_sessions')&&keys.includes('movement_correction_requests'),'TABLES');
 need(expectedAdditions&&Object.keys(expectedAdditions).every(k=>allowed.has(k)&&keys.includes(k)),'ADD_TABLE');
 let added=0;
 for(const t of keys){const expected=multiset(before[t]);const additions=multiset(expectedAdditions[t]??[]);for(const [h,n] of additions){expected.set(h,(expected.get(h)??0)+n);added+=n;}
  const actual=multiset(after[t]);need(actual.size===expected.size&&[...expected].every(([h,n])=>actual.get(h)===n),'ROW_DRIFT');}
 need(added>0,'EMPTY_DELTA');
 return {status:'M6_SUCCESSOR_FIXTURE_DELTA_VERIFIED',historicalTablesPreserved:174,exactAuthorizedAdditions:added,hrAndBusinessRowsPreserved:true,productionAuthorized:false,milestone6Accepted:false};
}
