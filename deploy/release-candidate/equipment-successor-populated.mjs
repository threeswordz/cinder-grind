// Disposable PostgreSQL 17 equipment upgrade/independent restore proof only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [phase,manifest]=process.argv.slice(2);
const url=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid/');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.port,'5432');
assert.ok(['seed','before','after','restored'].includes(phase)&&manifest);
assert.equal(url.pathname,phase==='restored'?'/erp_m4_equipment_restore':'/erp_m4_equipment_upgrade');
const req=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const {PrismaClient}=req('@prisma/client'); const db=new PrismaClient();
const additions=['20261124023000_ss11_equipment_custody','20261124221500_jai_asset_register'];
const tablesAdded=['equipment_asset_register_versions','equipment_custody_loans'];
const newPermissions=['equipment.custody.manage','equipment.custody.view'];
const triggersAdded=new Map([
 ['equipment_custody_loan_guard','equipment_custody_loans'],
 ['equipment_assignment_open_custody_guard','equipment_assignments'],
 ['equipment_asset_register_version_guard','equipment_asset_register_versions'],
 ['equipment_registered_identity_guard','equipment'],
]);
try{
 if(phase==='seed'){
  const c=await db.company.create({data:{companyCode:'M4-EQUIPMENT-RECOVERY',companyName:'Disposable predecessor'}});
  const customer=await db.customer.create({data:{companyId:c.id,customerCode:'C',customerName:'Recovery customer'}});
  const project=await db.project.create({data:{companyId:c.id,customerId:customer.id,projectCode:'P',projectName:'Recovery site',contractValue:'1000',plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31')}});
  const employee=await db.employee.create({data:{companyId:c.id,employeeCode:'E',employeeName:'Recovery employee'}});
  const user=await db.user.create({data:{companyId:c.id,employeeId:employee.id,email:'m4-equipment-recovery@example.invalid',displayName:'Recovery actor',passwordHash:'fixture-no-login'}});
  const role=await db.role.create({data:{companyId:c.id,roleCode:'STOREKEEPER',roleName:'Disposable predecessor role'}});
  const permission=await db.permission.findUniqueOrThrow({where:{permissionCode:'equipment.equipment.view'}});
  await db.rolePermission.create({data:{roleId:role.id,permissionId:permission.id}});
  await db.userRole.create({data:{companyId:c.id,userId:user.id,roleId:role.id}});
  const type=await db.equipmentType.create({data:{companyId:c.id,equipmentTypeCode:'T',equipmentTypeName:'Tools'}});
  const equipment=await db.equipment.create({data:{companyId:c.id,equipmentTypeId:type.id,equipmentCode:'CG00001',equipmentName:'Existing equipment'}});
  await db.equipmentAssignment.create({data:{companyId:c.id,equipmentId:equipment.id,projectId:project.id,assignedFrom:new Date('2026-01-01')}});
  await db.auditLog.create({data:{companyId:c.id,entityType:'EQUIPMENT',entityId:equipment.id,action:'CREATE',actorUserId:user.id,newValues:{equipmentCode:'CG00001'}}});
  console.log('EQUIPMENT_PREDECESSOR_FIXTURE_SEEDED');
 }else{
  const rows=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename");
  const tables={};
  const present=rows.map(x=>x.tablename).filter(n=>tablesAdded.includes(n));
  assert.deepEqual(present,phase==='after'?tablesAdded:[]);
  for(const {tablename} of rows){
   assert.match(tablename,/^[a-z_]+$/);
   if(tablesAdded.includes(tablename)){
    const [row]=await db.$queryRawUnsafe('SELECT count(*)::text AS n FROM "'+tablename+'"');
    assert.equal(row.n,'0','No fabricated historical equipment records');continue;
   }
   const filter=tablename==='permissions'&&phase==='after'?' WHERE permission_code <> ALL($1::text[])':'';
   const sql='SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E\'\\n\' ORDER BY to_jsonb(t)::text),\'\'),\'UTF8\')),\'hex\') AS digest FROM "'+tablename+'" t'+filter;
   const [row]=await db.$queryRawUnsafe(sql,...(filter?[newPermissions]:[]));tables[tablename]=row;
  }
  for(const name of ['companies','employees','users','equipment_types','equipment','equipment_assignments','role_permissions','audit_logs'])assert.ok(Number(tables[name]?.count)>0,'Nonempty predecessor '+name);
  const perms=await db.$queryRawUnsafe('SELECT permission_code,module_code FROM permissions WHERE permission_code=ANY($1::text[]) ORDER BY permission_code',newPermissions);
  assert.deepEqual(perms,phase==='after'?newPermissions.map(permission_code=>({permission_code,module_code:'EQUIPMENT'})):[]);
  const migrations=await db.$queryRawUnsafe('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
  const triggers=await db.$queryRawUnsafe("SELECT c.relname AS relation,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition,t.tgenabled::text AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname");
  const newTriggers=triggers.filter(t=>triggersAdded.has(t.name));
  assert.equal(newTriggers.length,phase==='after'?4:0);
  for(const t of newTriggers){assert.equal(t.relation,triggersAdded.get(t.name));assert.equal(t.enabled,'O');}
  const historical=triggers.filter(t=>!triggersAdded.has(t.name));
  if(phase==='before'){
   assert.ok(!migrations.some(m=>additions.includes(m.migration_name)));
   writeFileSync(manifest,JSON.stringify({tables,migrations,triggers:historical}),{mode:0o600,flag:'wx'});
  }else{
   const prior=JSON.parse(readFileSync(manifest,'utf8'));
   assert.deepEqual(tables,prior.tables,'All historical table rows including role grants preserved');
   const extra=phase==='after'?additions.map(migration_name=>({migration_name,checksum:createHash('sha256').update(readFileSync(new URL('../../apps/api/prisma/migrations/'+migration_name+'/migration.sql',import.meta.url))).digest('hex')})):[];
   assert.deepEqual(migrations,[...prior.migrations,...extra].sort((a,b)=>a.migration_name.localeCompare(b.migration_name)));
   const old="((ARRAY['STOCK_TRANSFER_OUT'::character varying, 'STOCK_TRANSFER_IN'::character varying])::text[])";
   const restored="ARRAY[('STOCK_TRANSFER_OUT'::character varying)::text, ('STOCK_TRANSFER_IN'::character varying)::text]";
   const normalize=items=>items.map(t=>t.relation==='stock_transactions'&&t.name==='material_uom_copy_transfer_pin'?{...t,definition:t.definition.replace('ANY '+old,'ANY ('+restored+')')}:t);
   assert.deepEqual(normalize(historical),normalize(prior.triggers));
   console.log('EQUIPMENT_'+(phase==='after'?'POPULATED_UPGRADE':'SEPARATE_PREDECESSOR_RESTORE')+'_PASS tables='+Object.keys(tables).length);
  }
 }
}finally{await db.$disconnect();}
