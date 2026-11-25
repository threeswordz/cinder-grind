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
export function assertEquipmentReleaseEvidence(rehearsal){
 const names=rehearsal.migrationNames??[];
 if(!names.some(name=>equipmentMigrationNames.includes(name)))return;
 assert.ok(equipmentMigrationNames.every(name=>names.includes(name)),'Partial equipment migration group cannot be admitted');
 for(const key of ['equipmentSourceContractTests','equipmentHistoricalPreservation','equipmentPairedRecovery','equipmentExternalHrKeyAndDocumentRecovery','equipmentInstalledCalendarProof']){
  assert.equal(rehearsal[key],'PASS','Missing equipment release evidence: '+key);
 }
}
