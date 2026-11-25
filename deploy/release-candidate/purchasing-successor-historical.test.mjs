import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pur12Migration,pur07Migration,pur12Columns} from './purchasing-successor-schema-preparation.mjs';
import {verifiedPur12HistoricalColumns,verifiedPur07HistoricalTables} from './purchasing-successor-historical.mjs';
const migration=name=>[{migration_name:name,checksum:createHash('sha256').update(readFileSync(new URL('../../apps/api/prisma/migrations/'+name+'/migration.sql',import.meta.url))).digest('hex')}];
const identity=()=>[
 migration(pur12Migration),
 ...Object.values(pur12Columns).flatMap(names=>[[...names].sort().map(column_name=>({column_name,data_type:'character varying',character_maximum_length:column_name==='po_display_number'?240:100,is_nullable:'YES',column_default:null})),[{n:'0'}]]),
 [{conname:'po_pur12_display_snapshot_paired',convalidated:true,contype:'c'}],
 [{name:'trg_pur12_po_identity_immutable',enabled:'O'}]
];
const dispatch=()=>[
 migration(pur07Migration),
 [{relation:'po_dispatch_events'}],[{n:'0'}],
 [...['po_dispatch_kind_valid','po_dispatch_channel_valid','po_dispatch_recipient_present','po_dispatch_evidence_present','po_dispatch_sha_valid','po_dispatch_ack_ref_valid'].map(conname=>({conname,contype:'c',convalidated:true})),...Array.from({length:6},(_,i)=>({conname:'fk'+i,contype:'f',convalidated:true})),{conname:'pk',contype:'p',convalidated:true}],
 ['trg_pur07_external_event_immutable','trg_pur07_validate_external_event'].map(name=>({name,enabled:'O'}))
];
const db=rows=>({$queryRawUnsafe:async()=>{assert.ok(rows.length,'unexpected query');return rows.shift();}});
test('PUR12 historical exclusion requires exact migration, all four NULL fields and active guard',async()=>{
 assert.deepEqual(await verifiedPur12HistoricalColumns(db(identity())),pur12Columns);
 for(const modify of [r=>r[0][0].checksum='bad',r=>r[1][0].column_default='unknown',r=>r[2][0].n='1',r=>r[5].pop(),r=>r[7][0].convalidated=false,r=>r[8][0].enabled='D']){
  const rows=identity();modify(rows);await assert.rejects(()=>verifiedPur12HistoricalColumns(db(rows)));
 }
});
test('PUR07 new empty evidence table must have all exact migration and validated source guards',async()=>{
 assert.deepEqual(await verifiedPur07HistoricalTables(db(dispatch())),['po_dispatch_events']);
 for(const modify of [r=>r[0][0].checksum='bad',r=>r[1][0].relation=null,r=>r[2][0].n='1',r=>r[3].shift(),r=>r[3][6].convalidated=false,r=>r[4][0].enabled='D']){
  const rows=dispatch();modify(rows);await assert.rejects(()=>verifiedPur07HistoricalTables(db(rows)));
 }
});
