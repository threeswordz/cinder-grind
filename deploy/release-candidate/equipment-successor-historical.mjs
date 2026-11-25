import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expected} from './equipment-successor-preflight.mjs';

// This bounded increment is the three-migration equipment successor only.
// Existing equipment installations keep their full historical table/catalog digests.
export const equipmentTables=Object.freeze(['equipment_asset_register_versions','equipment_custody_loans']);
export const equipmentMigrationNames=Object.freeze(Object.keys(expected).map(p=>p.split('/').at(-2)));
const definitions=Object.freeze({
 'equipment.custody.view':'View scoped person-level Equipment custody',
 'equipment.custody.manage':'Issue and return scoped employee Equipment custody',
});
export function equipmentIncrement(before,after,pins){
 const index=rows=>{
  assert.ok(Array.isArray(rows),'Migration history missing');
  const map=new Map();
  for(const row of rows){
   assert.ok(typeof row.migration_name==='string'&&!map.has(row.migration_name),'Ambiguous migration history');
   map.set(row.migration_name,row.checksum);
  }
  return map;
 };
 const old=index(before),next=index(after);
 for(const [name,checksum] of old)assert.equal(next.get(name),checksum,'Historical migration changed: '+name);
 const added=equipmentMigrationNames.filter(name=>next.has(name)&&!old.has(name));
 if(!added.length)return false;
 assert.equal(added.length,equipmentMigrationNames.length,'Partial equipment successor requires a separate contract');
 for(const name of equipmentMigrationNames){
  assert.ok(/^[a-f0-9]{64}$/.test(pins[name]??''),'Missing exact equipment checksum');
  assert.equal(next.get(name),pins[name],'Equipment migration checksum differs: '+name);
 }
 return true;
}
export function equipmentCatalogIds(rows,grantCount){
 assert.equal(rows.length,2,'Exact two equipment permission definitions required');
 assert.equal(grantCount,'0','Equipment successor may not grant any retained role');
 const seen=new Set(),ids=new Set();
 for(const row of rows){
  assert.ok(Object.hasOwn(definitions,row.permission_code)&&!seen.has(row.permission_code),'Unexpected/duplicate equipment permission');
  assert.equal(row.module_code,'EQUIPMENT');
  assert.equal(row.description,definitions[row.permission_code]);
  assert.match(row.id,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
  assert.ok(!ids.has(row.id),'Duplicate equipment permission identity');
  seen.add(row.permission_code);ids.add(row.id);
 }
 return [...ids];
}
export function assertEquipmentHistoricalTables(before,after){
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')};
 for(const table of equipmentTables){
  assert.ok(!Object.hasOwn(before,table),'Equipment predecessor already contains successor table');
  assert.deepEqual(after[table],empty,'Equipment successor table must be present and empty: '+table);
 }
}
function exactChecksums(){
 const pins={};
 for(const [path,blob] of Object.entries(expected)){
  const bytes=readFileSync(new URL('../../'+path,import.meta.url));
  const gitHash=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  assert.equal(gitHash,blob,'Equipment migration source differs from pinned Git blob');
  pins[path.split('/').at(-2)]=createHash('sha256').update(bytes).digest('hex');
 }
 return pins;
}
export async function verifyEquipmentHistoricalIncrement(db,before){
 if(!before)return {present:false,ids:[]};
 const after=await db.$queryRawUnsafe('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
 const names=new Set(before.map(row=>row.migration_name));
 if(!after.some(row=>equipmentMigrationNames.includes(row.migration_name)&&!names.has(row.migration_name)))return {present:false,ids:[]};
 assert.equal(equipmentIncrement(before,after,exactChecksums()),true);
 const rows=await db.$queryRawUnsafe('SELECT id,permission_code,module_code,description FROM permissions WHERE permission_code=ANY($1::text[]) ORDER BY permission_code',Object.keys(definitions));
 const grants=await db.$queryRawUnsafe('SELECT count(*)::text AS n FROM role_permissions WHERE permission_id=ANY($1::uuid[])',rows.map(row=>row.id));
 return {present:true,ids:equipmentCatalogIds(rows,grants[0]?.n)};
}
// Exact bindings from the three pinned forward-only SQL migrations.
export const equipmentTriggerBindings=Object.freeze({
 equipment_custody_loan_guard: Object.freeze({relation:'equipment_custody_loans',function_name:'guard_equipment_custody_loan',trigger_type:31,update_columns:Object.freeze([])}),
 equipment_assignment_open_custody_guard: Object.freeze({relation:'equipment_assignments',function_name:'protect_assigned_equipment_with_open_custody',trigger_type:23,update_columns:Object.freeze(['assigned_to','equipment_id','project_id'])}),
 equipment_asset_register_version_guard: Object.freeze({relation:'equipment_asset_register_versions',function_name:'guard_equipment_asset_register_version',trigger_type:31,update_columns:Object.freeze([])}),
 equipment_registered_identity_guard: Object.freeze({relation:'equipment',function_name:'protect_equipment_registered_identity',trigger_type:19,update_columns:Object.freeze(['equipment_code'])}),
});
export function assertEquipmentTriggerBindings(rows,present){
 if(!present){assert.deepEqual(rows,[],'Predecessor must not contain successor trigger bindings');return;}
 assert.equal(rows.length,Object.keys(equipmentTriggerBindings).length,'Exact four equipment triggers required');
 const seen=new Set();
 for(const row of rows){
  assert.ok(Object.hasOwn(equipmentTriggerBindings,row.name)&&!seen.has(row.name),'Unexpected or duplicate equipment trigger');
  const expected=equipmentTriggerBindings[row.name];
  assert.equal(row.relation,expected.relation);
  assert.equal(row.function_name,expected.function_name);
  assert.equal(row.function_schema,'public');
  assert.equal(row.trigger_type,expected.trigger_type);
  assert.deepEqual(row.update_columns,expected.update_columns,'Equipment trigger UPDATE OF columns differ');
  assert.equal(row.unconditional,true,'Equipment trigger must not have a WHEN predicate');
  assert.equal(row.argument_count,0,'Equipment trigger must not accept extra arguments');
  assert.equal(row.enabled,'O','Equipment trigger must be enabled for ordinary writes');
  seen.add(row.name);
 }
}
export async function verifyEquipmentTriggerBindings(db,present){
 const rows=await db.$queryRawUnsafe("SELECT t.tgname AS name,c.relname AS relation,p.proname AS function_name,pn.nspname AS function_schema,t.tgtype::int AS trigger_type,t.tgenabled::text AS enabled, ARRAY(SELECT a.attname::text FROM pg_attribute a WHERE a.attrelid=t.tgrelid AND a.attnum=ANY(t.tgattr::smallint[]) ORDER BY a.attname::text COLLATE \"C\") AS update_columns, (t.tgqual IS NULL) AS unconditional, t.tgnargs::int AS argument_count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname=ANY($1::text[]) ORDER BY t.tgname",Object.keys(equipmentTriggerBindings));
 assertEquipmentTriggerBindings(rows,present);
}
export function assertEquipmentReleaseEvidence(rehearsal){
 const names=rehearsal.migrationNames??[];
 if(!names.some(name=>equipmentMigrationNames.includes(name)))return;
 assert.ok(equipmentMigrationNames.every(name=>names.includes(name)),'Partial equipment migration group cannot be admitted');
 for(const key of ['equipmentSourceContractTests','equipmentHistoricalPreservation','equipmentPairedRecovery','equipmentExternalHrKeyAndDocumentRecovery','equipmentInstalledCalendarProof']){
  assert.equal(rehearsal[key],'PASS','Missing equipment release evidence: '+key);
 }
}
