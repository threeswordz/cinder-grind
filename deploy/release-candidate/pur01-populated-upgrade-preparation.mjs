// Disposable CI-only proof. Preserve actual pre-PUR01 rows, including non-null PM02 metadata.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pur01Column,pur01Migration} from './pur01-schema-preparation.mjs';
import {verifiedPur01HistoricalColumns} from './pur01-historical-columns.mjs';
const target=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid');
const [phase,manifest]=process.argv.slice(2);
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1'].includes(target.hostname));
assert.equal(target.port,'5432');
assert.ok(['before','after','restored'].includes(phase)&&manifest);
assert.equal(target.pathname,phase==='restored'?'/erp_m4_pur01_predecessor_restore':'/erp_m4_pur01_upgrade');
const requireApi=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const {PrismaClient}=requireApi('@prisma/client');
const db=new PrismaClient();
try{
 const columns=await db.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_orders' AND column_name=ANY($1::text[]) ORDER BY column_name",[pur01Column]);
 const excluded=phase==='after'?await verifiedPur01HistoricalColumns(db):[];
 if(phase!=='after')assert.deepEqual(columns,[],'Predecessor must have no PUR01 exception column');
 const names=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename");
 const tables={};
 for(const {tablename} of names){
  assert.match(tablename,/^[a-z_]+$/);
  const [entry]=await db.$queryRawUnsafe(`SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg((to_jsonb(t)-$1::text[])::text,E'\\n' ORDER BY (to_jsonb(t)-$1::text[])::text),''),'UTF8')),'hex') AS digest FROM "${tablename}" t`,tablename==='purchase_orders'?excluded:[]);
  tables[tablename]=entry;
 }
 for(const name of ['purchase_requests','purchase_request_lines','approval_instances','approval_actions','audit_logs','purchase_orders','purchase_order_lines','stock_transactions'])
  assert.ok(Number(tables[name]?.count)>0,'Nonempty fixture required: '+name);
 const decisions=await db.$queryRawUnsafe("SELECT DISTINCT review_decision FROM purchase_request_lines WHERE review_decision IS NOT NULL ORDER BY review_decision");
 assert.deepEqual(decisions.map(d=>d.review_decision),['APPROVED','RETURNED'],'Real prior mixed-review metadata required');
 const poStates=await db.$queryRawUnsafe("SELECT DISTINCT a.approval_state FROM purchase_orders p JOIN approval_instances a ON a.id=p.approval_instance_id");
 assert.ok(poStates.some(x=>x.approval_state==='APPROVED'),'Historical approved PO required');
 const [commercial]=await db.$queryRawUnsafe("SELECT count(*)::text AS n FROM purchase_orders WHERE delivery_location IS NOT NULL AND freight_amount IS NOT NULL AND vat_rate_percent IS NOT NULL");
 assert.ok(Number(commercial.n)>0,'Historical non-null PUR04 commercial values required');
 const migrations=await db.$queryRawUnsafe('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
 assert.equal(new Set(migrations.map(m=>m.migration_name)).size,migrations.length);
 const triggers=await db.$queryRawUnsafe("SELECT c.relname AS relation,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition,t.tgenabled::text AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname");
 if(phase==='before'){
  assert.ok(!migrations.some(m=>m.migration_name===pur01Migration));
  writeFileSync(manifest,JSON.stringify({tables,migrations,triggers}),{mode:0o600,flag:'wx'});
 }else{
  const previous=JSON.parse(readFileSync(manifest,'utf8'));
  assert.deepEqual(tables,previous.tables,'Every prior business table digest and count must match, including PM02 and PUR04');
  if(phase==='after'){
   const migration={migration_name:pur01Migration,checksum:createHash('sha256').update(readFileSync(new URL('../../apps/api/prisma/migrations/'+pur01Migration+'/migration.sql',import.meta.url))).digest('hex')};
   assert.deepEqual(migrations,[...previous.migrations,migration].sort((a,b)=>a.migration_name.localeCompare(b.migration_name)));
   assert.deepEqual(triggers,previous.triggers);
  }else{
   assert.deepEqual(migrations,previous.migrations);
   // Same narrow PostgreSQL17 deparse equivalence verified in PM02 recovery.
   const original="((ARRAY['STOCK_TRANSFER_OUT'::character varying, 'STOCK_TRANSFER_IN'::character varying])::text[])";
   const restored="ARRAY[('STOCK_TRANSFER_OUT'::character varying)::text, ('STOCK_TRANSFER_IN'::character varying)::text]";
   const normalize=items=>items.map(t=>t.relation==='stock_transactions'&&t.name==='material_uom_copy_transfer_pin'?{...t,definition:t.definition.replace('ANY '+original,'ANY ('+restored+')')}:t);
   assert.deepEqual(normalize(triggers),normalize(previous.triggers));
  }
  console.log('PUR01_'+(phase==='after'?'POPULATED_UPGRADE':'SEPARATE_PREDECESSOR_RESTORE')+'_PASS tables='+Object.keys(tables).length+' PO_ROWS='+tables.purchase_orders.count);
 }
}finally{await db.$disconnect();}
