// Synthetic master-data roles: actual authenticated Company scope, maker audit, no Finance/stock effects.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const apiRequire=createRequire(path.join(ROOT,'apps/api/package.json'));
const url=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.port,'5432');
assert.equal(url.pathname,'/erp_m4_master_role_scope');
const API='http://127.0.0.1:31364';
const temp=await mkdtemp(path.join(os.tmpdir(),'erp-m4-master-role-'));
process.env.STORAGE_ROOT=path.join(temp,'docs');
process.env.DOCUMENT_UPLOAD_TEMP_ROOT=path.join(temp,'uploads');
const {NestFactory}=apiRequire('@nestjs/core');
apiRequire('reflect-metadata');
const {AppModule}=apiRequire('./dist/app.module.js');
const {PrismaService}=apiRequire('./dist/prisma/prisma.service.js');
const {SessionService}=apiRequire('./dist/auth/session.service.js');
const {ProcurementService}=apiRequire('./dist/procurement/procurement.service.js');
const {SourcingService}=apiRequire('./dist/procurement/sourcing.service.js');
const {PurchaseOrderService}=apiRequire('./dist/procurement/purchase-order.service.js');
const {ProblemDetailsFilter}=apiRequire('./dist/common/problem-details.filter.js');
const {securityHeadersMiddleware}=apiRequire('./dist/common/security-headers.js');
const {Prisma}=apiRequire('@prisma/client');
const D=value=>new Prisma.Decimal(value);
const app=await NestFactory.create(AppModule,{logger:['warn','error']});
app.setGlobalPrefix('api/v1');
app.use(securityHeadersMiddleware(false));
app.useGlobalFilters(new ProblemDetailsFilter());
await app.listen(31364,'127.0.0.1');
const db=app.get(PrismaService),sessions=app.get(SessionService),prs=app.get(ProcurementService),sourcing=app.get(SourcingService),pos=app.get(PurchaseOrderService);
async function run(){
 const suffix=randomUUID().slice(0,8);
 const makeCompany=code=>db.company.create({data:{companyCode:code,companyName:'Disposable '+code}});
 const mke=await makeCompany('MKE'),tcj=await makeCompany('TCJ');
 const grantCodes=['master.supplier.view','master.supplier.manage','master.material.view','master.material.manage'];
 const ids=new Map();
 for(const permissionCode of grantCodes){const p=await db.permission.upsert({where:{permissionCode},update:{},create:{permissionCode,moduleCode:'MASTER_DATA'}});ids.set(permissionCode,p.id);}
 async function actor(company,roleCode,codes,label){
  const employee=await db.employee.create({data:{companyId:company.id,employeeCode:label+'-'+suffix,employeeName:'Synthetic '+label}});
  const user=await db.user.create({data:{companyId:company.id,employeeId:employee.id,email:label+'-'+suffix+'@example.invalid',passwordHash:'not-used',displayName:'Synthetic '+label}});
  const role=await db.role.create({data:{companyId:company.id,roleCode,roleName:'Synthetic '+roleCode}});
  await db.userRole.create({data:{companyId:company.id,userId:user.id,roleId:role.id}});
  await db.rolePermission.createMany({data:codes.map(code=>({roleId:role.id,permissionId:ids.get(code)}))});
  const tokens=await sessions.create(user.id);
  return {id:user.id,companyId:company.id,roleCode,codes,tokens};
 }
 const nancy=await actor(mke,'FINANCE_MANAGER',grantCodes,'Nancy');
 const jai=await actor(mke,'PROCUREMENT_OFFICER',grantCodes,'Jai');
 const store=await actor(mke,'STOREKEEPER',['master.supplier.view','master.material.view'],'Store');
 const foreign=await actor(tcj,'PROCUREMENT_OFFICER',grantCodes,'TCJ-Jai');
 const ea=await db.unitOfMeasure.create({data:{companyId:mke.id,uomCode:'EA',uomName:'Each',decimalPlaces:0}});
 const otherEa=await db.unitOfMeasure.create({data:{companyId:tcj.id,uomCode:'EA',uomName:'Each',decimalPlaces:0}});
 async function call(a,route,method='GET',body,csrf=true){
  return fetch(API+'/api/v1'+route,{method,headers:{Cookie:'erp_session='+a.tokens.sessionToken,...(csrf?{'X-CSRF-Token':a.tokens.csrfToken}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 }
 async function data(a,route,method='GET',body,status=200){const r=await call(a,route,method,body);assert.equal(r.status,status,route+' expected status');return (await r.json()).data;}
 async function denied(a,route,method,body,status,code,csrf=true){const r=await call(a,route,method,body,csrf);assert.equal(r.status,status,route+' denied');if(code)assert.equal((await r.json()).code,code);}
 for(const a of [nancy,jai,store,foreign]){const me=await data(a,'/auth/me');assert.equal(me.id,a.id);assert.equal(me.companyId,a.companyId);assert.deepEqual(me.roleCodes,[a.roleCode]);assert.deepEqual([...me.permissions].sort(),[...a.codes].sort());}
 const root='/master-data';
 const stock=await db.stockTransaction.count(),finance=await db.directCostPosting.count();
 const supplier=await data(nancy,root+'/suppliers','POST',{supplierCode:'SUP-'+suffix,supplierName:'Synthetic Nancy supplier'},201);
 const edited=await data(jai,root+'/suppliers/'+supplier.id,'PATCH',{supplierName:'Synthetic Jai maintained supplier'});
 assert.equal(edited.supplierName,'Synthetic Jai maintained supplier');
 const initialMaterial=await data(nancy,root+'/materials','POST',{materialCode:'INIT-'+suffix,materialName:'Initial material',defaultUomId:ea.id},201);
 const normalMaterial=await data(jai,root+'/materials','POST',{materialCode:'NORMAL-'+suffix,materialName:'Normal material',defaultUomId:ea.id},201);
 assert.equal(initialMaterial.defaultUomId,ea.id);assert.equal(normalMaterial.defaultUomId,ea.id);
 const audit=await db.auditLog.findMany({where:{companyId:mke.id,entityId:{in:[supplier.id,initialMaterial.id,normalMaterial.id]}}});
 for(const [entityId,actorUserId,action] of [[supplier.id,nancy.id,'CREATE'],[supplier.id,jai.id,'UPDATE'],[initialMaterial.id,nancy.id,'CREATE'],[normalMaterial.id,jai.id,'CREATE']])
  assert.equal(audit.filter(x=>x.entityId===entityId&&x.actorUserId===actorUserId&&x.action===action).length,1);
 console.log('M4_MASTER_NANCY_INITIAL_JAI_NORMAL_CREATE_AND_HANDOFF_ACTOR_AUDIT_PASS');
 const snapshot=await db.auditLog.count({where:{companyId:mke.id}});
 assert.equal((await data(store,root+'/suppliers/'+supplier.id)).id,supplier.id);
 assert.equal((await data(store,root+'/materials/'+normalMaterial.id)).id,normalMaterial.id);
 await denied(store,root+'/suppliers/'+supplier.id,'PATCH',{supplierName:'Forbidden edit'},403);
 await denied(store,root+'/materials','POST',{materialCode:'DENIED',materialName:'Forbidden',defaultUomId:ea.id},403);
 await denied(jai,root+'/suppliers/'+supplier.id,'PATCH',{supplierName:'Forbidden CSRF'},403,'CSRF_TOKEN_INVALID',false);
 await denied(foreign,root+'/suppliers/'+supplier.id,'GET',undefined,404,'MASTER_RECORD_NOT_FOUND');
 await denied(foreign,root+'/materials/'+normalMaterial.id,'PATCH',{materialName:'Foreign edit'},404,'MASTER_RECORD_NOT_FOUND');
 await denied(jai,root+'/materials','POST',{materialCode:'FOREIGN-UOM',materialName:'Foreign UOM',defaultUomId:otherEa.id},422);
 assert.equal(await db.auditLog.count({where:{companyId:mke.id}}),snapshot);
 assert.equal((await data(nancy,root+'/suppliers/'+supplier.id)).supplierName,edited.supplierName);
 assert.equal((await data(jai,root+'/materials/'+normalMaterial.id)).materialName,'Normal material');
 assert.ok(!(await data(foreign,root+'/suppliers')).some(x=>x.id===supplier.id));
 assert.ok(!(await data(foreign,root+'/materials')).some(x=>x.id===normalMaterial.id));
 assert.equal(await db.stockTransaction.count(),stock);assert.equal(await db.directCostPosting.count(),finance);
 console.log('M4_MASTER_STORE_READONLY_FOREIGN_COMPANY_CSRF_UOM_AND_NONPOSTING_PASS');
}
try{await run();}finally{await app.close();await rm(temp,{recursive:true,force:true});}
