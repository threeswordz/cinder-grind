// Historical verification only, before any new post-upgrade business writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pur12Migration,pur07Migration,pur12Columns} from './purchasing-successor-schema-preparation.mjs';
async function exactMigration(db,migration){
 const checksum=createHash('sha256').update(readFileSync(new URL('../../apps/api/prisma/migrations/'+migration+'/migration.sql',import.meta.url))).digest('hex');
 const rows=await db.$queryRawUnsafe('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL AND migration_name=$1',migration);
 assert.deepEqual(rows,[{migration_name:migration,checksum}]);
}
async function triggerNames(db,table,names){
 const rows=await db.$queryRawUnsafe("SELECT t.tgname AS name,t.tgenabled::text AS enabled FROM pg_trigger t WHERE t.tgrelid=to_regclass('public.'||$1) AND NOT t.tgisinternal AND t.tgname=ANY($2::text[]) ORDER BY t.tgname",table,names);
 assert.deepEqual(rows,[...names].sort().map(name=>({name,enabled:'O'})));
}
export async function verifiedPur12HistoricalColumns(db){
 await exactMigration(db,pur12Migration);
 for(const [table,names] of Object.entries(pur12Columns)){
  const rows=await db.$queryRawUnsafe("SELECT column_name,data_type,character_maximum_length,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=ANY($2::text[]) ORDER BY column_name",table,names);
  assert.deepEqual(rows,[...names].sort().map(column_name=>({column_name,data_type:'character varying',character_maximum_length:column_name==='po_display_number'?240:100,is_nullable:'YES',column_default:null})));
  // All identifiers originate exclusively from the constant table/column allowlist.
  const [value]=await db.$queryRawUnsafe('SELECT count(*)::text AS n FROM "'+table+'" WHERE '+names.map(n=>'"'+n+'" IS NOT NULL').join(' OR '));
  assert.equal(value.n,'0','PUR12 historical identity must remain unknown: '+table);
 }
 const checks=await db.$queryRawUnsafe("SELECT conname,convalidated,contype::text AS contype FROM pg_constraint WHERE conrelid='public.purchase_orders'::regclass AND conname='po_pur12_display_snapshot_paired'");
 assert.deepEqual(checks,[{conname:'po_pur12_display_snapshot_paired',convalidated:true,contype:'c'}]);
 await triggerNames(db,'purchase_orders',['trg_pur12_po_identity_immutable']);
 return Object.fromEntries(Object.entries(pur12Columns).map(([name,columns])=>[name,[...columns]]));
}
export async function verifiedPur07HistoricalTables(db){
 await exactMigration(db,pur07Migration);
 const [exists]=await db.$queryRawUnsafe("SELECT to_regclass('public.po_dispatch_events')::text AS relation");
 assert.ok(exists.relation==='po_dispatch_events'||exists.relation==='public.po_dispatch_events');
 const [count]=await db.$queryRawUnsafe('SELECT count(*)::text AS n FROM "po_dispatch_events"');
 assert.equal(count.n,'0','Migration cannot fabricate historical supplier dispatch evidence');
 const constraints=await db.$queryRawUnsafe("SELECT conname,contype::text AS contype,convalidated FROM pg_constraint WHERE conrelid='public.po_dispatch_events'::regclass ORDER BY conname");
 const checks=['po_dispatch_kind_valid','po_dispatch_channel_valid','po_dispatch_recipient_present','po_dispatch_evidence_present','po_dispatch_sha_valid','po_dispatch_ack_ref_valid'];
 for(const name of checks)assert.ok(constraints.some(c=>c.conname===name&&c.contype==='c'&&c.convalidated),'Missing validated dispatch check '+name);
 assert.equal(constraints.filter(c=>c.contype==='f'&&c.convalidated).length,6,'Six source foreign keys required');
 assert.equal(constraints.filter(c=>c.contype==='p'&&c.convalidated).length,1);
 await triggerNames(db,'po_dispatch_events',['trg_pur07_validate_external_event','trg_pur07_external_event_immutable']);
 return ['po_dispatch_events'];
}
