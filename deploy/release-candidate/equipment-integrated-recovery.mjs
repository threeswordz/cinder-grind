// Same exact disposable predecessor and paired recovery set as the global rehearsal.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative,isAbsolute,sep} from 'node:path';
import {verifyEquipmentHistoricalIncrement,equipmentMigrationNames,equipmentTables,verifyEquipmentTriggerBindings} from './equipment-successor-historical.mjs';

const [phase,previousRoot,manifestPath]=process.argv.slice(2);
const target=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid/');
const role=phase==='rollback'?'rollback':phase==='restored'?'hrrestore':'upgrade';
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.RC_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(target.hostname));
assert.match(target.pathname,new RegExp('^/construction_erp_v10e_'+role+'_[a-f0-9]{12}$'));
assert.ok(['seed','after','rollback','restored'].includes(phase)&&previousRoot&&manifestPath);
const temp=realpathSync(dirname(manifestPath));
assert.match(temp,/^\/tmp\/construction-erp-v10e-migration\.[^/]+$/);
const inside=relative(temp,resolve(manifestPath));
assert.ok(inside&&!isAbsolute(inside)&&inside!=='..'&&!inside.startsWith('..'+sep));
const runtime=createRequire(resolve(phase==='seed'||phase==='rollback'?previousRoot:'.','apps/api/package.json'));
const {PrismaClient}=runtime('@prisma/client');
const db=new PrismaClient();
const history=()=>db.$queryRawUnsafe('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
const sourceRows=async ids=>{
 assert.deepEqual(Object.keys(ids).sort(),['equipment','equipment_assignments','equipment_types']);
 const result={};
 for(const [table,id] of Object.entries(ids)){
  assert.ok(['equipment_types','equipment','equipment_assignments'].includes(table));
  const rows=await db.$queryRawUnsafe('SELECT to_jsonb(t)::text AS value FROM "'+table+'" t WHERE id=$1::uuid',id);
  assert.equal(rows.length,1,'Missing exact equipment predecessor row: '+table);
  result[table]=rows[0].value;
 }
 return result;
};
const installed=async present=>{
 await verifyEquipmentTriggerBindings(db,present);
 const names=await db.$queryRawUnsafe("SELECT to_regclass('public.equipment_asset_register_versions')::text AS asset,to_regclass('public.equipment_custody_loans')::text AS custody");
 assert.deepEqual(names,[{asset:present?equipmentTables[0]:null,custody:present?equipmentTables[1]:null}]);
 const functions=await db.$queryRawUnsafe("SELECT p.proname AS name,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('equipment_custody_thailand_day','guard_equipment_custody_loan') ORDER BY p.proname");
 if(!present){assert.equal(functions.length,0);return;}
 assert.equal(functions.length,2);
 assert.match(functions[0].definition,/Asia\/Bangkok/);
 assert.match(functions[1].definition,/equipment_custody_thailand_day\(statement_timestamp\(\)\)/);
 assert.doesNotMatch(functions[1].definition,/CURRENT_DATE/i);
 await db.$transaction(async tx=>{
  for(const zone of ['UTC','Asia/Singapore','Asia/Bangkok']){
   await tx.$queryRawUnsafe("SELECT set_config('TimeZone',$1,true)",zone);
   const rows=await tx.$queryRawUnsafe("SELECT equipment_custody_thailand_day('2026-11-24T16:59:59.999Z'::timestamptz)::text AS before,equipment_custody_thailand_day('2026-11-24T17:00:00Z'::timestamptz)::text AS after");
   assert.deepEqual(rows,[{before:'2026-11-24',after:'2026-11-25'}]);
  }
 });
};
try{
 assert.equal((await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,target.pathname.slice(1));
 if(phase==='seed'){
  const migrations=await history();
  assert.ok(!migrations.some(m=>equipmentMigrationNames.includes(m.migration_name)));
  await installed(false);
  const company=await db.company.create({data:{companyCode:'RC-SS11-EQUIPMENT',companyName:'Disposable equipment predecessor'}});
  const customer=await db.customer.create({data:{companyId:company.id,customerCode:'RC-SS11',customerName:'Equipment recovery fixture'}});
  const project=await db.project.create({data:{companyId:company.id,customerId:customer.id,projectCode:'RC-SS11',projectName:'Equipment recovery site',contractValue:'1000',plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31')}});
  const type=await db.equipmentType.create({data:{companyId:company.id,equipmentTypeCode:'RC-SS11',equipmentTypeName:'Recovery tool type'}});
  const equipment=await db.equipment.create({data:{companyId:company.id,equipmentTypeId:type.id,equipmentCode:'CG00001',equipmentName:'Predecessor recovery tool'}});
  const assignment=await db.equipmentAssignment.create({data:{companyId:company.id,equipmentId:equipment.id,projectId:project.id,assignedFrom:new Date('2026-01-01')}});
  const ids={equipment_types:type.id,equipment:equipment.id,equipment_assignments:assignment.id};
  writeFileSync(manifestPath,JSON.stringify({ids,rows:await sourceRows(ids),migrations}),{mode:0o600,flag:'wx'});
 }else{
  const previous=JSON.parse(readFileSync(manifestPath,'utf8'));
  assert.deepEqual(await sourceRows(previous.ids),previous.rows,'Exact predecessor equipment rows changed');
  await installed(phase!=='rollback');
  if(phase==='rollback')assert.deepEqual(await history(),previous.migrations,'Exact predecessor migration history changed');
  else if(phase==='after'){
   const result=await verifyEquipmentHistoricalIncrement(db,previous.migrations);
   assert.equal(result.present,true,'Exact newly installed equipment increment required');
   writeFileSync(manifestPath+'.upgraded',JSON.stringify(await history()),{mode:0o600,flag:'wx'});
  }else{
   // The independent upgraded restore may contain synthetic fixture grants.
   // Global HR proof separately verifies the protected restored evidence.
   const upgradedHistory=JSON.parse(readFileSync(manifestPath+'.upgraded','utf8'));
   assert.deepEqual(await history(),upgradedHistory,'Exact upgraded migration history/checksums changed on restore');
   const names=new Set(upgradedHistory.map(row=>row.migration_name));
   assert.ok(equipmentMigrationNames.every(name=>names.has(name)),'Restored candidate lacks equipment migration history');
  }
 }
 console.log('EQUIPMENT_INTEGRATED_'+phase.toUpperCase()+'_PASS');
}finally{await db.$disconnect();}
