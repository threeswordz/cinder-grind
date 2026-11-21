// Bounded extension of the completed subcontract prototype. No bootstrap/reset.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SOURCE,ROLES,httpClient} from './prototype-actors.mjs';
import {fm03Snapshot,digest,FM03_GRANTS} from './prototype-fm03-state.mjs';
import {RECEIVING_GRANTS} from './prototype-receiving-state.mjs';
import {TRANSFER_GRANTS} from './prototype-transfer-state.mjs';
import {SUBCONTRACT_GRANTS} from './prototype-subcontract-state.mjs';
import {materialUomTables,materialUomMigrations} from '../release-candidate/material-uom-schema-contract.mjs';
import {materialUomEffectTables,materialUomEffectMigration} from '../release-candidate/material-uom-effect-schema-contract.mjs';
import {stageCTables,stageCMigrations} from '../release-candidate/material-uom-stage-c-schema-contract.mjs';
import {materialUomCatalog,verifyMaterialUomCatalog} from '../release-candidate/material-uom-catalog-contract.mjs';
export {fm03Snapshot as uomSnapshot,digest};
export const UOM_TABLES=Object.freeze([...materialUomTables,...materialUomEffectTables,...stageCTables]);
export const UOM_MIGRATIONS=Object.freeze([...materialUomMigrations,materialUomEffectMigration,...stageCMigrations]);
export const UOM_GRANTS=Object.freeze({
 KHAIMOOK:['master.material.view','master.material.manage','master.material.conversion.manage','master.uom.view','master.uom.manage',
  'inventory.return.view','inventory.return.approve'],
 STORE_SITE:['master.material.view','master.uom.view','inventory.reservation.view','inventory.reservation.create',
  'inventory.reservation.activate','inventory.reservation.release','inventory.return.view','inventory.return.create',
  'inventory.return.submit','inventory.return.reverse'],
 JAI:['master.material.view','master.material.manage','master.uom.view'],
});
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const sorted=v=>JSON.stringify([...v].sort());
export function validUomOrigins(api,web){return process.platform==='darwin'&&api==='http://127.0.0.1:33071/api/v1'&&web==='http://127.0.0.1:44171'||
 process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&api==='http://127.0.0.1:31319/api/v1'&&web==='http://127.0.0.1:44319';}
export function verifyUomMigration(before,after){
 const normalized=structuredClone(after);
 verifyMaterialUomCatalog(after.permissions.filter(p=>materialUomCatalog.some(c=>c.id===p.id)).map(({__fm03_exact_row_json,...r})=>r),true);
 normalized.permissions=normalized.permissions.filter(p=>!materialUomCatalog.some(c=>c.id===p.id));
 for(const table of UOM_TABLES){demand(!Object.hasOwn(before,table)&&normalized[table]?.length===0,'UOM_UPGRADE_NONEMPTY_OR_PRIOR_UOM_TABLE');delete normalized[table];}
 const old=before._prisma_migrations,added=after._prisma_migrations.filter(n=>!old.some(m=>m.id===n.id));
 demand(after._prisma_migrations.length===old.length+UOM_MIGRATIONS.length&&sorted(added.map(r=>r.migration_name))===sorted(UOM_MIGRATIONS)&&
  added.every(r=>r.finished_at&&!r.rolled_back_at),'UOM_UPGRADE_WRONG_ADDITIVE_MIGRATIONS');
 normalized._prisma_migrations=after._prisma_migrations.filter(n=>old.some(m=>m.id===n.id));
 assert.deepEqual(normalized,before,'UOM migrations changed historical PostgreSQL rows or grants');
}
export async function configureUom(db,binding,expected){
 const b=structuredClone(binding),f=b.fixture;
 demand(b.sourceSha===SOURCE&&/^[a-f0-9]{64}$/.test(expected??''),'UOM_CONFIGURATION_BINDING_INVALID');
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('prototype-uom-configuration-v1'))");
  const before=await fm03Snapshot(tx);demand(digest(before)===expected,'UOM_CONFIGURATION_STATE_DRIFT');
  demand(UOM_TABLES.every(t=>before[t]?.length===0),'UOM_CONFIGURATION_EXISTING_DEFINITIONS_REFUSED');
  demand(await tx.auditLog.count({where:{entityType:'PROTOTYPE_UOM_CONFIGURATION'}})===0,'UOM_CONFIGURATION_ALREADY_STARTED');
  const companies=await tx.company.findMany();
  demand(companies.length===2&&companies.every(c=>c.isActive&&c.baseCurrencyCode==='THB')&&
   companies.some(c=>c.id===f.companyId&&c.companyCode==='PROTO_A')&&companies.some(c=>c.id===f.foreignCompanyId&&c.companyCode==='PROTO_B'),'UOM_SYNTHETIC_COMPANIES_REQUIRED');
  demand(await tx.project.count({where:{id:f.projectId,companyId:f.companyId,projectCode:'SITE_A',isActive:true}})===1&&
   await tx.subcontractCertification.count({where:{companyId:f.companyId,state:'APPROVED'}})===1&&await tx.transferReceipt.count()===1,'UOM_COMPLETED_PREDECESSORS_REQUIRED');
  demand(await tx.unitOfMeasure.count({where:{companyId:f.companyId,uomCode:{in:['EA','CTN']}}})===0&&
   await tx.material.count({where:{companyId:f.companyId,materialCode:'PROTO_UOM_NEW'}})===0,'UOM_NEW_SYNTHETIC_MASTER_ALREADY_EXISTS');
  const keys=Object.keys(ROLES),members=await tx.userRole.findMany({where:{roleId:{in:keys.map(k=>b.actors[k].roleId)}}});
  demand(members.length===keys.length&&members.every(m=>m.companyId===f.companyId&&keys.some(k=>m.userId===b.actors[k].userId&&m.roleId===b.actors[k].roleId)),'UOM_ROLE_MEMBERSHIP_MUST_BE_EXCLUSIVE');
  const added=[];
  for(const key of keys){
   const a=b.actors[key],user=await tx.user.findUnique({where:{id:a.userId},include:{userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
   demand(user?.isActive&&user.companyId===f.companyId&&user.employeeId===a.employeeId&&user.email==='proto-'+key.toLowerCase()+'@example.invalid'&&
    user.userRoles.length===1&&user.userRoles[0].roleId===a.roleId&&user.userRoles[0].role.companyId===f.companyId&&user.userRoles[0].role.roleCode==='PROTO_'+key&&user.userRoles[0].role.isActive&&
    await tx.employee.count({where:{id:a.employeeId,companyId:f.companyId,isActive:true}})===1&&
    await tx.projectMember.count({where:{employeeId:a.employeeId,projectId:f.projectId,isActive:true}})===1,'UOM_ACTOR_SCOPE_DRIFT');
   const delta=b.configuration?.changes?.find(c=>c.roleCode==='PROTO_'+key)?.addedCapabilities??[];
   const wanted=[...new Set([...ROLES[key].permissions,...delta,...(FM03_GRANTS[key]??[]),...(RECEIVING_GRANTS[key]??[]),...(TRANSFER_GRANTS[key]??[]),...(SUBCONTRACT_GRANTS[key]??[])])];
   demand(sorted(user.userRoles[0].role.rolePermissions.map(r=>r.permission.permissionCode))===sorted(wanted),'UOM_EXISTING_GRANT_MATRIX_CHANGED');
   const missing=(UOM_GRANTS[key]??[]).filter(code=>!wanted.includes(code)),catalog=await tx.permission.findMany({where:{permissionCode:{in:missing}}});
   demand(catalog.length===missing.length,'UOM_MIGRATED_CAPABILITY_CATALOG_REQUIRED');
   for(const permission of catalog)added.push(await tx.rolePermission.create({data:{roleId:a.roleId,permissionId:permission.id}}));
  }
  await tx.auditLog.create({data:{companyId:f.companyId,entityType:'PROTOTYPE_UOM_CONFIGURATION',entityId:f.projectId,action:'CONFIGURE',actorUserId:f.adminUserId,newValues:{syntheticOnly:true,grantMatrix:UOM_GRANTS}}});
  return {status:'UOM_SYNTHETIC_CONFIGURATION_APPLIED',addedRolePermissionIds:added.map(r=>r.id),productionAuthorized:false};
 },{isolationLevel:'Serializable',timeout:30000});
}
export async function prepareUomSource(db,binding,origins){
 const {api,web}=structuredClone(origins),b=structuredClone(binding),f=b.fixture;
 demand(validUomOrigins(api,web),'UOM_SOURCE_ORIGINS_REFUSED');
 const client=httpClient(api,web,async(url,options)=>{
  const path=url.slice(api.length),auth=['/auth/login','/auth/logout','/auth/me'].includes(path);
  demand(url.startsWith(api+'/')&&options.redirect==='error'&&options.headers.Origin===web&&
   (auth||options.method==='POST'&&['/master-data/uoms','/master-data/materials'].includes(path)),'UOM_SOURCE_UNDECLARED_REQUEST');
  return fetch(url,options);
 });
 let session,primary,result;
 try{
  session=await client.login('UOM_MASTER',b.actors.KHAIMOOK,f.companyId);
  const post=async(path,body)=>(await client.call(session,'UOM_NEW_MASTER',path,201,body)).value.data;
  const each=await post('/master-data/uoms',{uomCode:'EA',uomName:'Synthetic UOM stock pieces',decimalPlaces:0});
  const carton=await post('/master-data/uoms',{uomCode:'CTN',uomName:'Synthetic UOM cartons',decimalPlaces:4});
  const material=await post('/master-data/materials',{materialCode:'PROTO_UOM_NEW',materialName:'New synthetic UOM material',defaultUomId:carton.id});
  demand(each.companyId===f.companyId&&carton.companyId===f.companyId&&material.companyId===f.companyId&&material.defaultUomId===carton.id,'UOM_NEW_MASTER_SCOPE_INVALID');
  result={company:{id:f.companyId},each:{id:each.id},carton:{id:carton.id},material:{id:material.id,code:material.materialCode,name:material.materialName}};
 }catch(e){primary=e;}finally{if(session)try{await client.logout('UOM_MASTER',session);await client.call(session,'UOM_MASTER_REVOKED','/auth/me',401);}catch(e){primary??=e;}}
 if(primary)throw primary;return result;
}
// No activation may slip through an incidental definition-only prototype upgrade.
// Exercise actual authorization with fresh, strictly revoked sessions in both
// the isolated rehearsal and source runtime; never activate new or old stock.
export async function verifyUomActivationDenial(db,binding,source,origins){
 const b=structuredClone(binding),{api,web}=structuredClone(origins),path='/master-data/material-conversions/'+source.material.id+'/activation';
 demand(validUomOrigins(api,web)&&/^[a-f0-9-]{36}$/.test(source.material.id),'UOM_ACTIVATION_DENIAL_BINDING_REFUSED');
 demand(await db.materialUomActivation.count({where:{materialId:source.material.id}})===0,'UOM_DEFINITION_ALREADY_ACTIVATED');
 const client=httpClient(api,web,async(url,options)=>{
  const suffix=url.slice(api.length);
  demand(url.startsWith(api+'/')&&options.redirect==='error'&&options.headers.Origin===web&&
   (['/auth/login','/auth/logout','/auth/me'].includes(suffix)||suffix===path&&options.method==='POST'),
   'UOM_ACTIVATION_DENIAL_UNDECLARED_REQUEST');
  return fetch(url,options);
 });
 for(const key of ['STORE_SITE','JAI']){
  let session,primary;
  try{
   session=await client.login('UOM_'+key+'_DENIAL',b.actors[key],b.fixture.companyId);
   await client.call(session,'UOM_'+key+'_ACTIVATION_DENIED',path,403,{
    requestKey:randomUUID(),expectedVersion:3,reason:'Synthetic stock activation must be denied'});
   demand(await db.materialUomActivation.count({where:{materialId:source.material.id}})===0,
    'UOM_UNAUTHORIZED_ACTIVATION_POSTED');
  }catch(e){primary=e;}
  finally{if(session)try{
   await client.logout('UOM_'+key+'_DENIAL',session);
   await client.call(session,'UOM_'+key+'_REVOKED','/auth/me',401);
  }catch(e){primary??=e;}}
  if(primary)throw primary;
 }
 return {activationDenied:true,definitionOnly:true};
}
export function uomBrowserBinding(binding,source,origins,technical){
 const b=structuredClone(binding),f=b.fixture;
 demand(validUomOrigins(origins.api,origins.web)&&technical?.userId===f.adminUserId&&technical.email==='proto-admin@example.invalid'&&/^[a-f0-9]{64}$/.test(technical.password??''),'UOM_BROWSER_BINDING_REFUSED');
 return {...origins,fixture:{...source,actors:{maker:b.actors.KHAIMOOK,viewer:b.actors.STORE_SITE,noConversion:b.actors.JAI,technical}}};
}
export function verifyUomPreservation(before,after,c,b,source){
 const baseline=structuredClone(before),normalized=structuredClone(after),f=b.fixture;
 const logins=['KHAIMOOK','STORE_SITE','JAI'].map(k=>b.actors[k].userId).concat(f.adminUserId);
 for(const data of [baseline,normalized])data.users=data.users.map(row=>{if(!logins.includes(row.id))return row;const {last_login_at,updated_at,__fm03_exact_row_json,...r}=row;return r;});
 demand(sorted(Object.keys(baseline))===sorted(Object.keys(normalized)),'UOM_HISTORY_TABLE_SET_CHANGED');
 const counts={role_permissions:c.addedRolePermissionIds.length,units_of_measure:2,materials:1,material_uom_bases:1,material_uom_revisions:2,material_uom_operations:3};
 for(const [table,rows]of Object.entries(baseline)){
  const old=new Set(rows.map(r=>digest(r)));
  for(const row of rows)assert.ok(normalized[table].some(r=>digest(r)===digest(row)),'UOM changed historical '+table);
  const added=normalized[table].filter(r=>!old.has(digest(r)));
  if(table==='user_sessions'){demand(added.length>0&&added.every(r=>r.revoked_at&&logins.includes(r.user_id)),'UOM_SESSION_NOT_REVOKED');continue;}
  if(table==='audit_logs'){
   demand(added.length===7&&added.every(r=>r.company_id===f.companyId&&(
    r.entity_type==='PROTOTYPE_UOM_CONFIGURATION'&&r.entity_id===f.projectId&&r.actor_user_id===f.adminUserId||
    ['UNIT_OF_MEASURE','MATERIAL','MATERIAL_UOM'].includes(r.entity_type)&&[source.each.id,source.carton.id,source.material.id].includes(r.entity_id)&&r.actor_user_id===b.actors.KHAIMOOK.userId)), 'UOM_UNEXPECTED_AUDIT_ADDITION');continue;
  }
  demand(added.length===(counts[table]??0),'UOM_UNEXPECTED_ADDITIONS_'+table.toUpperCase());
  for(const row of added)if(Object.hasOwn(row,'company_id'))demand(row.company_id===f.companyId,'UOM_NEW_ROW_WRONG_COMPANY');
  if(table==='role_permissions')demand(sorted(added.map(r=>r.id))===sorted(c.addedRolePermissionIds),'UOM_GRANT_DELTA_CHANGED');
  if(table==='materials')demand(added[0]?.id===source.material.id&&added[0].default_uom_id===source.carton.id,'UOM_MATERIAL_SOURCE_CHANGED');
  if(table==='units_of_measure')demand(sorted(added.map(r=>r.id))===sorted([source.each.id,source.carton.id]),'UOM_UNIT_SOURCE_CHANGED');
  if(table.startsWith('material_uom_'))for(const row of added)demand(row.material_id===source.material.id,'UOM_HISTORICAL_MATERIAL_ACTIVATED');
 }
 demand(UOM_TABLES.filter(t=>!['material_uom_bases','material_uom_revisions','material_uom_operations'].includes(t)).every(t=>normalized[t].length===0),'UOM_STOCK_OR_LEGACY_ACTIVATION_REFUSED');
 const oldGrants=new Set(before.role_permissions.map(r=>r.role_id+':'+r.permission_id));
 const expected=Object.entries(UOM_GRANTS).flatMap(([key,codes])=>codes.map(code=>b.actors[key].roleId+':'+after.permissions.find(p=>p.permission_code===code)?.id)).filter(x=>!oldGrants.has(x));
 const actual=after.role_permissions.filter(r=>!before.role_permissions.some(o=>o.id===r.id));
 demand(sorted(actual.map(r=>r.role_id+':'+r.permission_id))===sorted(expected),'UOM_EXACT_GRANT_MATRIX_CHANGED');
}
