import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {equipmentMigrationNames,equipmentTables,equipmentIncrement,equipmentCatalogIds,assertEquipmentHistoricalTables,assertEquipmentReleaseEvidence,equipmentTriggerBindings,assertEquipmentTriggerBindings,verifyEquipmentTriggerBindings} from './equipment-successor-historical.mjs';

const before=[{migration_name:'old',checksum:'historical'}];
const pins=Object.fromEntries(equipmentMigrationNames.map((name,i)=>[name,String(i+1).repeat(64)]));
const additions=equipmentMigrationNames.map(migration_name=>({migration_name,checksum:pins[migration_name]}));
const after=[...before,...additions];
test('equipment migration history accepts exact additive group only',()=>{
 assert.equal(equipmentIncrement(before,after,pins),true);
 assert.equal(equipmentIncrement(before,before,pins),false);
 assert.equal(equipmentIncrement(after,after,pins),false);
 for(const changed of [after.slice(0,-1),[...before,...additions.map((x,i)=>i===0?{...x,checksum:'wrong'}:x)],after.slice(1),[...after,additions[0]]]){
  assert.throws(()=>equipmentIncrement(before,changed,pins));
 }
 assert.throws(()=>equipmentIncrement(before,after,{}));
});
const rows=[
 {id:'00000000-0000-4000-8000-000000000001',permission_code:'equipment.custody.view',module_code:'EQUIPMENT',description:'View scoped person-level Equipment custody'},
 {id:'00000000-0000-4000-8000-000000000002',permission_code:'equipment.custody.manage',module_code:'EQUIPMENT',description:'Issue and return scoped employee Equipment custody'}
];
test('only exact new ungranted catalog definitions can be excluded',()=>{
 assert.deepEqual(equipmentCatalogIds(rows,'0'),rows.map(row=>row.id));
 assert.throws(()=>equipmentCatalogIds(rows,'1'));
 for(const invalid of [rows.slice(0,1),[rows[0],rows[0]],[rows[0],{...rows[1],module_code:'HR'}],[rows[0],{...rows[1],description:'changed'}],[rows[0],{...rows[1],id:rows[0].id}],[rows[0],{...rows[1],id:'not-uuid'}]]){
  assert.throws(()=>equipmentCatalogIds(invalid,'0'));
 }
});
test('both new tables must be empty; existing tables are not excluded',()=>{
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')};
 const tables=Object.fromEntries(equipmentTables.map(name=>[name,empty]));
 assertEquipmentHistoricalTables({},tables);
 assert.throws(()=>assertEquipmentHistoricalTables({},{}));
 assert.throws(()=>assertEquipmentHistoricalTables({[equipmentTables[0]]:empty},tables));
 assert.throws(()=>assertEquipmentHistoricalTables({}, {...tables,[equipmentTables[0]]:{...empty,count:'1'}}));
});
test('release evidence cannot omit any equipment-specific proof or accept a partial migration group',()=>{
 assertEquipmentReleaseEvidence({migrationNames:['old']});
 const receipt={migrationNames:equipmentMigrationNames,equipmentSourceContractTests:'PASS',equipmentHistoricalPreservation:'PASS',equipmentPairedRecovery:'PASS',equipmentExternalHrKeyAndDocumentRecovery:'PASS',equipmentInstalledCalendarProof:'PASS'};
 assertEquipmentReleaseEvidence(receipt);
 for(const key of Object.keys(receipt).filter(key=>key!=='migrationNames'))assert.throws(()=>assertEquipmentReleaseEvidence({...receipt,[key]:'FAIL'}));
 assert.throws(()=>assertEquipmentReleaseEvidence({...receipt,migrationNames:equipmentMigrationNames.slice(0,2)}));
});

test('equipment trigger bindings are exact, enabled and absent on rollback',async()=>{
 const rows=Object.entries(equipmentTriggerBindings).map(([name,binding])=>({name,...binding,function_schema:'public',enabled:'O'}));
 assertEquipmentTriggerBindings(rows,true);
 assertEquipmentTriggerBindings([],false);
 assert.throws(()=>assertEquipmentTriggerBindings(rows,false));
 assert.throws(()=>assertEquipmentTriggerBindings(rows.slice(0,-1),true));
 assert.throws(()=>assertEquipmentTriggerBindings([...rows.slice(0,-1),rows[0]],true));
 for(const patch of [{enabled:'D'},{enabled:'R'},{relation:'equipment'},{function_name:'wrong_guard'},{function_schema:'other'},{trigger_type:1}]){
  assert.throws(()=>assertEquipmentTriggerBindings([{...rows[0],...patch},...rows.slice(1)],true));
 }
 let calls=0;
 await verifyEquipmentTriggerBindings({$queryRawUnsafe:async(sql,names)=>{
  calls++;assert.match(sql,/t\.tgfoid/);assert.match(sql,/t\.tgenabled/);assert.deepEqual(names,Object.keys(equipmentTriggerBindings));return rows;
 }},true);
 assert.equal(calls,1);
 await assert.rejects(()=>verifyEquipmentTriggerBindings({$queryRawUnsafe:async()=>rows.slice(1)},true));
});
