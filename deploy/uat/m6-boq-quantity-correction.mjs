// Event244 remediation: exact successor-only additive quantity grants, no login.
import {createHash,randomUUID} from 'node:crypto';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_BOQ_FIX_'+c),{safeCode:'M6_BOQ_FIX_'+c});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sort=a=>[...a].sort();
const hash=s=>createHash('sha256').update(s).digest('hex');
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const authTables=['users','user_sessions','login_rate_limit_buckets'];
export const permission='budget.quantity.view';
const targets=['JAI','PORN'];
export function verifyFailedBatchLog(log){
 need(typeof log==='string'&&log.length<=16777216,'LOG');const events=[];
 for(const line of log.split('\n')){const i=line.indexOf('{"timestamp"');if(i<0)continue;let e;try{e=JSON.parse(line.slice(i,line.lastIndexOf('}')+1));}catch{continue;}if(typeof e.path==='string'&&Number.isInteger(e.status))events.push(e);}
 const auth=(path,status)=>events.filter(e=>e.path==='/api/v1/auth/'+path&&e.status===status).length;
 need(auth('login',201)===11&&auth('logout',204)===11&&auth('me',401)===11,'LOG_AUTH');
 const routes=[['REPORT',/^\/api\/v1\/site-execution\/reports\/[^/]+$/],['PLAN',/^\/api\/v1\/inventory\/material-plans\/[^/]+$/],['REQUEST',/^\/api\/v1\/inventory\/material-requests\/[^/]+$/],['DOCUMENT',/^\/api\/v1\/documents\/.*\/download$/],['QUANTITY',/^\/api\/v1\/budget\/quantity\/projects\/[^/]+\/revisions\/[^/]+$/],['COST',/^\/api\/v1\/budget\/revisions\/[^/]+$/],['CLIENT',/^\/api\/v1\/budget\/customer\/projects\/[^/]+\/versions\/[^/]+$/]];
 const reads=events.flatMap(e=>{const r=e.method==='GET'&&routes.find(([,re])=>re.test(e.path));return r?[[r[0],e.status]]:[];});
 const expected=[['REPORT',200],['PLAN',200],['PLAN',200],['REQUEST',200],['DOCUMENT',200],['DOCUMENT',403],['COST',200],['COST',200],['CLIENT',200],['CLIENT',200],['QUANTITY',200],['COST',200],['CLIENT',403],['QUANTITY',403]];
 need(same(reads,expected),'LOG_SEQUENCE');return {logSha256:hash(log),completedReadbacks:13,failedActor:'JAI',failedStatus:403,revokedSessions:11};
}
export function verifyFailedBatchBaseline({committed,current,sessionRows,actorIds,adminHash,originalAdminHash}){
 const keys=Object.keys(committed?.after??{}).sort();need(keys.length===174&&same(keys,Object.keys(current??{}).sort())&&authTables.every(t=>keys.includes(t)),'TABLES');
 need(keys.filter(t=>!authTables.includes(t)).every(t=>same(committed.after[t],current[t])),'BUSINESS_DRIFT');
 need(Array.isArray(actorIds)&&actorIds.length===11&&actorIds.every(uuid)&&new Set(actorIds).size===11&&sha(adminHash)&&adminHash===originalAdminHash&&committed.after.users.includes(adminHash)&&current.users.length===12,'USERS');
 need(Array.isArray(sessionRows)&&sessionRows.length===current.user_sessions.length&&same(sort(sessionRows.map(s=>s.hash)),current.user_sessions)&&sessionRows.every(s=>sha(s.hash)),'SESSION_ROWS');
 const old=new Set(committed.after.user_sessions);need(old.size===committed.after.user_sessions.length&&[...old].every(h=>current.user_sessions.includes(h)),'SESSION_HISTORY');
 const fresh=sessionRows.filter(s=>!old.has(s.hash));need(fresh.length===11&&actorIds.every(id=>fresh.filter(s=>s.actor===id).length===1)&&fresh.every(s=>s.revoked===true),'SESSION_DELTA');
 need(current.login_rate_limit_buckets.every(h=>committed.after.login_rate_limit_buckets.includes(h)),'RATE_BUCKETS');return true;
}
export function planQuantityCorrection({binding,original,fixture,users,projects,permissionRow}){
 need(uuid(permissionRow?.id)&&permissionRow.permissionCode===permission&&uuid(fixture?.companyId)&&uuid(fixture?.projectId),'CATALOG');
 need(binding?.roster&&Array.isArray(users)&&Array.isArray(projects),'CONTEXT');
 const restricted=['JAI','PORN','STORE_SITE','KHAIMOOK'];
 for(const k of restricted){const a=binding.roster[k];need(a&&a.companyId===fixture.companyId&&Array.isArray(a.permissions)&&!a.permissions.some(p=>p==='budget.cost.full_view'||p.startsWith('budget.customer.')),'DISCLOSURE');if(!targets.includes(k))need(a.permissions.includes(permission),'EXISTING_QUANTITY');}
 const p=projects.filter(p=>p.id===fixture.projectId&&p.companyId===fixture.companyId&&p.isActive===true);need(p.length===1,'PROJECT');
 const additions=[];for(const k of targets){const a=original[k],r=binding.roster[k],u=users.find(u=>u.id===r.userId);need(a?.userId===r.userId&&uuid(a.roleId)&&u?.companyId===fixture.companyId&&u.isActive&&u.employeeId===a.employeeId&&u.userRoles?.length===1&&u.userRoles[0].roleId===a.roleId&&u.userRoles[0].role?.roleCode==='PROTO_'+k&&u.userRoles[0].role.companyId===fixture.companyId&&u.userRoles[0].role.isActive,'ACTOR');need(p[0].members.some(m=>m.employeeId===a.employeeId&&m.isActive===true),'PROJECT_SCOPE');need(users.filter(x=>x.userRoles?.some(y=>y.roleId===a.roleId)).length===1,'ROLE_NOT_EXCLUSIVE');if(!r.permissions.includes(permission))additions.push({actor:k,roleId:a.roleId,permissionId:permissionRow.id});}
 need(additions.some(a=>a.actor==='JAI')&&additions.length<=2,'MISSING_JAI');return additions;
}
export async function writeQuantityCorrection({db,authorization,expectedBefore,plan,fixture,capture,verifyRuntime,sealAttempt,sealCommitted,observePlan}){
 need(authorization?.database==='m6_successor_rehearsal'&&authorization.ownerAuthorizedQuantityCorrection===true&&authorization.retainedMutationAuthorized===false&&authorization.productionAuthorized===false,'AUTHORITY');
 need(Array.isArray(plan)&&plan.length>=1&&plan.length<=2&&plan.some(p=>p.actor==='JAI')&&new Set(plan.map(p=>p.actor)).size===plan.length&&plan.every(p=>targets.includes(p.actor)&&uuid(p.roleId)&&uuid(p.permissionId))&&new Set(plan.map(p=>p.roleId)).size===plan.length&&new Set(plan.map(p=>p.permissionId)).size===1,'PLAN');
 await verifyRuntime();await sealAttempt({plan,expectedBefore});
 const result=await db.$transaction(async tx=>{
  const i=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");need(i.length===1&&i[0].db===authorization.database&&i[0].role==='proto_runtime'&&i[0].ro==='off'&&i[0].isolation==='serializable','DATABASE');
  await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('m6-event245-boq-quantity'))::text AS lock");
  need(await tx.userSession.count({where:{revokedAt:null,expiresAt:{gt:new Date()}}})===0,'ACTIVE_SESSIONS');
  const before=await capture(tx);need(same(before,expectedBefore)&&same(await observePlan(tx),plan),'BASELINE');
  const additions={role_permissions:[],audit_logs:[]},addedIds={role_permissions:[],audit_logs:[]};
  const add=async(model,table,data)=>{const id=randomUUID(),row=await tx[model].create({data:{id,...data}});need(row.id===id,'ROW_ID');const h=await tx.$queryRawUnsafe('SELECT encode(sha256(convert_to(to_jsonb(t)::text,\'UTF8\')),\'hex\') AS hash FROM public."'+table+'" t WHERE id=$1::uuid',id);need(h.length===1&&sha(h[0].hash),'ROW_HASH');additions[table].push(h[0].hash);addedIds[table].push(id);};
  for(const p of plan)await add('rolePermission','role_permissions',{roleId:p.roleId,permissionId:p.permissionId});
  await add('auditLog','audit_logs',{companyId:fixture.companyId,entityType:'M6_BOQ_QUANTITY_CORRECTION',entityId:fixture.projectId,actorUserId:fixture.adminUserId,action:'CONFIGURE',newValues:{syntheticOnly:true,permission,actors:plan.map(p=>p.actor),productionAuthorized:false}});
  const after=await capture(tx);verifyQuantityDelta(before,after,additions,plan.length);return {before,after,additions,addedIds};
 },{isolationLevel:'Serializable',timeout:120000});
 await verifyRuntime();await sealCommitted(result);return {status:'M6_SUCCESSOR_BOQ_QUANTITY_CORRECTION_COMMITTED',addedGrants:plan.length,addedAuditRows:1,allPriorRowsPreserved:true,sessionsCreated:false,productionAuthorized:false};
}
export function verifyQuantityDelta(before,after,additions,grants){
 const keys=Object.keys(before??{}).sort();need(keys.length===174&&same(keys,Object.keys(after??{}).sort())&&same(Object.keys(additions??{}).sort(),['audit_logs','role_permissions'])&&[1,2].includes(grants)&&additions.role_permissions.length===grants&&additions.audit_logs.length===1,'DELTA');
 for(const t of keys)need(same(sort([...before[t],...(additions[t]??[])]),after[t]),'UNEXPECTED_DELTA');return true;
}
