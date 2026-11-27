// Successor-only adapter for the disposable historical material/UOM acceptance
// fixture. Never change named/retained actor configuration or replay the Mac.
import {SOURCE,httpClient} from './prototype-actors.mjs';
import {randomUUID} from 'node:crypto';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('SS16_FIXTURE_'+code),{safeCode:'SS16_FIXTURE_'+code});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const kinds={MATERIAL_ISSUE:{route:'material-issues',model:'materialIssue',prefix:'inventory.issue'},
 MATERIAL_RETURN:{route:'material-returns',model:'materialReturn',prefix:'inventory.return'}};
export async function requireDisposableCorrectionFixture(db,b,{api,web}){
 need(process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&api==='http://127.0.0.1:31319/api/v1'&&web==='http://127.0.0.1:44319'&&b.sourceSha===SOURCE,'OWNED_DISPOSABLE_ONLY');
 const i=await db.$queryRawUnsafe('SELECT current_database() AS name,current_user AS role');
 need(i.length===1&&/^material_run_ci_[a-f0-9]{32}$/.test(i[0].name)&&i[0].role==='construction_erp','OWNED_DATABASE');
 const f=b.fixture,co=await db.company.findUnique({where:{id:f.companyId}}),project=await db.project.findUnique({where:{id:f.projectId}});
 need(co?.companyCode==='PROTO_A'&&project?.companyId===co.id&&project.projectCode==='SITE_A','COMPANY');
}
export async function reverseDisposableSources(db,b,origins,targets){
 await requireDisposableCorrectionFixture(db,b,origins);
 const f=b.fixture,actors=b.actors;
 need(Array.isArray(targets)&&targets.length>=1&&targets.length<=2&&new Set(targets.map(t=>t.id)).size===targets.length,'TARGETS');
 for(const t of targets){
  const k=kinds[t.kind];need(k&&typeof t.id==='string'&&typeof t.reason==='string'&&t.reason.length>0,'TARGET');
  const source=await db[k.model].findUnique({where:{id:t.id},include:{items:true}});
  need(source?.companyId===f.companyId&&source.projectId===f.projectId&&source.postedAt&&!source.reversedAt&&
    source.items.length>0&&source.items.every(i=>i.materialId===t.materialId),'SOURCE_SCOPE');
 }
 // The old synthetic actor fixture deliberately uses PROTO_* role codes and
 // asserts its exact original grants in later checkpoints. Temporarily use
 // real SS16 codes on the same exclusive disposable roles, restore codes and
 // only the new grants after revoking the two dedicated sessions. The actual
 // workflow, decisions and stock history are retained. No production grants.
 const roles=[['STORE_SITE','STOREKEEPER',['view','edit']],['KHAIMOOK','PROJECT_MANAGER',['view','approve','reverse']]];
 const config=await db.$transaction(async tx=>{
  const saved=[];
  for(const [key,code,actions] of roles){
   const actor=actors[key],role=await tx.role.findUnique({where:{id:actor.roleId},include:{rolePermissions:true}});
   const u=await tx.user.findUnique({where:{id:actor.userId},include:{userRoles:true}});
   need(role?.roleCode==='PROTO_'+key&&role.companyId===f.companyId&&role.isActive&&u?.companyId===f.companyId&&u.employeeId===actor.employeeId&&
     u.userRoles.length===1&&u.userRoles[0].roleId===role.id&&await tx.userRole.count({where:{roleId:role.id}})===1&&
     await tx.projectMember.count({where:{projectId:f.projectId,employeeId:actor.employeeId,isActive:true}})===1&&
     await tx.role.count({where:{companyId:f.companyId,roleCode:code}})===0,'ROLE_SCOPE');
   const codes=[...new Set(targets.flatMap(t=>actions.map(action=>kinds[t.kind].prefix+'.'+action)))];
   const perms=await tx.permission.findMany({where:{permissionCode:{in:codes}}});
   need(perms.length===codes.length,'PERMISSIONS');
   const added=perms.filter(p=>!role.rolePermissions.some(g=>g.permissionId===p.id)).map(p=>p.id);
   await tx.role.update({where:{id:role.id},data:{roleCode:code}});
   if(added.length)await tx.rolePermission.createMany({data:added.map(permissionId=>({roleId:role.id,permissionId}))});
   saved.push({id:role.id,key,code,added});
  }
  const existing=await tx.approvalWorkflow.findUnique({where:{companyId_workflowCode:{companyId:f.companyId,workflowCode:'SS16_MOVEMENT_CORRECTION'}},
   include:{steps:{include:{stepRoles:true}}}});
  if(existing)need(existing.isActive&&existing.entityType==='MOVEMENT_CORRECTION'&&existing.steps.length===1&&existing.steps[0].requiredApprovals===1&&
    existing.steps[0].stepRoles.length===1&&existing.steps[0].stepRoles[0].roleId===actors.KHAIMOOK.roleId,'WORKFLOW');
  else await tx.approvalWorkflow.create({data:{companyId:f.companyId,workflowCode:'SS16_MOVEMENT_CORRECTION',entityType:'MOVEMENT_CORRECTION',
   workflowName:'Disposable successor correction',steps:{create:[{stepNo:1,stepName:'Independent PM',requiredApprovals:1,
    stepRoles:{create:[{roleId:actors.KHAIMOOK.roleId}]}}]}}});
  return saved;
 },{isolationLevel:'Serializable'});
 const allowed=new Map();
 for(const t of targets){
  const source='/inventory/'+kinds[t.kind].route+'/'+t.id,req='/inventory/movement-corrections/sources/'+t.kind+'/'+t.id+'/requests';
  allowed.set('GET '+source,null);allowed.set('POST '+req,{requestKey:t.key,reason:t.reason});
  allowed.set('GET '+req,null);
 }
 const client=httpClient(origins.api,origins.web,async(url,options)=>{
  need(url.startsWith(origins.api+'/')&&options.redirect==='error'&&options.headers.Origin===origins.web,'TRANSPORT');
  const path=url.slice(origins.api.length),body=options.body===undefined?null:JSON.parse(options.body);
  if(path==='/auth/login'&&options.method==='POST')need(roles.some(([key])=>body.email===actors[key].email&&body.password===actors[key].password),'LOGIN');
  else if(path==='/auth/logout'&&options.method==='POST')need(same(body,{}),'LOGOUT');
  else if(path==='/auth/me'&&options.method==='GET')need(body===null,'ME');
  else {const key=options.method+' '+path;need(allowed.has(key)&&same(allowed.get(key),body),'PATH');}
  return fetch(url,options);
 });
 const sessions={};let primary;
 try{
  for(const [key,code] of roles)sessions[key]=await client.login('SS16_'+key,{...actors[key],expectedRoleCodes:[code]},f.companyId);
  const maker=sessions.STORE_SITE,pm=sessions.KHAIMOOK;
  for(const t of targets){
   const source='/inventory/'+kinds[t.kind].route+'/'+t.id,req='/inventory/movement-corrections/sources/'+t.kind+'/'+t.id+'/requests';
   const body={requestKey:t.key,reason:t.reason};
   const call=async(actor,label,path,expected,data)=>(await client.call(actor,label,path,expected,data)).value;
   const made=(await call(maker,'CORRECTION_REQUEST',req,201,body)).data;
   need(made?.sourceId===t.id&&made.sourceKind===t.kind&&made.approvalInstance?.approvalState==='SUBMITTED'&&/^[a-f0-9-]{36}$/.test(made.id),'REQUEST');
   need((await call(maker,'CORRECTION_REPLAY',req,201,body)).data.id===made.id,'REPLAY');
   const approve='/inventory/movement-corrections/'+made.id+'/approve',decision={comment:'Independent disposable PM reversal'};
   allowed.set('POST '+approve,decision);
   await call(maker,'CORRECTION_SELF_DENIED',approve,403,decision);
   const done=(await call(pm,'CORRECTION_APPROVE',approve,201,decision)).data;
   need(done.id===made.id&&done.approvalInstance.approvalState==='APPROVED','DECISION');
   const replay=await call(pm,'CORRECTION_DECISION_REPLAY_DENIED',approve,409,decision);
   need(replay.code==='SS16_DECISION_ALREADY_RECORDED','DECISION_REPLAY');
   const history=(await call(maker,'CORRECTION_HISTORY',req,200)).data.find(x=>x.id===made.id);
   need(history?.approvalInstance.actions.length===1&&history.approvalInstance.actions[0].actionByUserId===actors.KHAIMOOK.userId,'HISTORY');
   const read=(await call(maker,'CORRECTION_SOURCE_READ',source,200)).data;
   need(read?.id===t.id&&read.reversalKey==='ss16:'+made.id&&read.reversedAt,'SOURCE_OUTCOME');
  }
 }catch(e){primary=e;}
 finally{
  for(const [key,s] of Object.entries(sessions))try{await client.logout('SS16_'+key,s);await client.call(s,'SS16_REVOKED','/auth/me',401);}catch(e){primary??=e;}
  try{await db.$transaction(async tx=>{
    for(const x of config){
     const live=await tx.role.findUnique({where:{id:x.id}});need(live?.roleCode===x.code&&live.companyId===f.companyId,'RESTORE_ROLE');
     if(x.added.length)need((await tx.rolePermission.deleteMany({where:{roleId:x.id,permissionId:{in:x.added}}})).count===x.added.length,'RESTORE_GRANTS');
     await tx.role.update({where:{id:x.id},data:{roleCode:'PROTO_'+x.key}});
    }
  },{isolationLevel:'Serializable'});}catch(e){primary??=e;}
 }
 if(primary)throw primary;
 return {observations:client.observations};
}
