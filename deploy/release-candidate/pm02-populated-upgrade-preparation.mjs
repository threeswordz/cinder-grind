// Isolated predecessor-to-candidate preservation test. No production access.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pm02Columns,pm02Migrations} from './pm02-schema-preparation.mjs';
const target=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1'].includes(target.hostname));
assert.equal(target.port,'5432');
const [phase,manifest]=process.argv.slice(2);
assert.equal(target.pathname,phase==='restored'?'/erp_m4_pm02_predecessor_restore':'/erp_m4_pm02_upgrade');
assert.ok(['before','after','restored'].includes(phase)&&manifest);
const requireApi=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const {PrismaClient}=requireApi('@prisma/client');
const db=new PrismaClient();
const columnTypes={review_decision:['character varying',20,null],review_reason:['text',null,null],reviewed_by_user_id:['uuid',null,null],reviewed_at:['timestamp with time zone',null,6],correction_source_line_id:['uuid',null,null]};
try{
 const columns=await db.$queryRawUnsafe("SELECT column_name,data_type,character_maximum_length,datetime_precision,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_request_lines' AND column_name=ANY($1::text[]) ORDER BY column_name",pm02Columns);
 if(phase==='before'||phase==='restored')assert.deepEqual(columns,[]);
 else{
  assert.deepEqual(columns.map(c=>c.column_name).sort(),[...pm02Columns].sort());
  for(const c of columns){
   assert.deepEqual([c.data_type,c.character_maximum_length,c.datetime_precision],columnTypes[c.column_name]);
   assert.equal(c.is_nullable,'YES');assert.equal(c.column_default,null);
  }
  const [populated]=await db.$queryRawUnsafe('SELECT count(*)::text AS n FROM purchase_request_lines WHERE '+pm02Columns.map(c=>'"'+c+'" IS NOT NULL').join(' OR '));
  assert.equal(populated.n,'0','Historical PR review metadata must stay NULL');
  const constraints=await db.$queryRawUnsafe("SELECT convalidated, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.purchase_request_lines'::regclass AND conname='purchase_request_lines_review_decision_check'");
  assert.equal(constraints.length,1);assert.equal(constraints[0].convalidated,true);
  assert.match(constraints[0].definition,/IS TRUE/);
  const idx=await db.$queryRawUnsafe("SELECT i.indisunique, i.indisvalid, pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public.purchase_request_lines'::regclass AND c.relname='purchase_request_lines_correction_source_line_id_key'");
  assert.equal(idx.length,1);assert.equal(idx[0].indisunique,true);assert.equal(idx[0].indisvalid,true);assert.match(idx[0].definition,/\(correction_source_line_id\)/);
 }
 const rows=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename");
 const tables={};
 for(const {tablename} of rows){
  assert.match(tablename,/^[a-z_]+$/);
  const excluded=tablename==='purchase_request_lines'?pm02Columns:[];
  const [entry]=await db.$queryRawUnsafe(`SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg((to_jsonb(t)-$1::text[])::text,E'\\n' ORDER BY (to_jsonb(t)-$1::text[])::text),''),'UTF8')),'hex') AS digest FROM "${tablename}" t`,excluded);
  tables[tablename]=entry;
 }
 for(const name of ['purchase_requests','purchase_request_lines','approval_instances','approval_actions','audit_logs','purchase_orders','purchase_order_lines','stock_transactions'])
  assert.ok(Number(tables[name]?.count)>0,'Predecessor fixture must contain '+name);
 const states=await db.$queryRawUnsafe("SELECT DISTINCT a.approval_state FROM purchase_requests p JOIN approval_instances a ON a.id=p.approval_instance_id ORDER BY a.approval_state");
 assert.ok(states.some(x=>x.approval_state==='APPROVED'));
 assert.ok(states.some(x=>x.approval_state==='REJECTED'));
 const migrations=await db.$queryRawUnsafe('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
 assert.equal(new Set(migrations.map(m=>m.migration_name)).size,migrations.length);
 const triggers=await db.$queryRawUnsafe("SELECT c.relname AS relation,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition,t.tgenabled::text AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname");
 const snap={tables,migrations,triggers};
 if(phase==='before'){
  for(const name of Object.keys(pm02Migrations))assert.ok(!migrations.some(m=>m.migration_name===name));
  writeFileSync(manifest,JSON.stringify(snap),{mode:0o600,flag:'wx'});
 }else if(phase==='restored'){
  const before=JSON.parse(readFileSync(manifest,'utf8'));
  assert.deepEqual(tables,before.tables,'Restored predecessor row counts and digests must match exactly');
  assert.deepEqual(migrations,before.migrations,'Restored migration checksums must match exactly');
  // PG17 pg_dump/restore can deparse the same typed array coercion in two
  // forms. Accept ONLY this known equivalent spelling on this exact trigger.
  // Every other definition, enabled state, relation and name stays exact.
  const original="((ARRAY['STOCK_TRANSFER_OUT'::character varying, 'STOCK_TRANSFER_IN'::character varying])::text[])";
  const restored="ARRAY[('STOCK_TRANSFER_OUT'::character varying)::text, ('STOCK_TRANSFER_IN'::character varying)::text]";
  const normalize=items=>items.map(t=>t.relation==='stock_transactions'&&t.name==='material_uom_copy_transfer_pin'
    ?{...t,definition:t.definition.replace('ANY '+original,'ANY ('+restored+')')}:t);
  assert.deepEqual(normalize(triggers),normalize(before.triggers),'Restored predecessor trigger attachments and definitions must match');
  console.log('PM02_PAIRED_PREDECESSOR_RESTORE_PASS tables='+Object.keys(tables).length+' PR_LINES='+tables.purchase_request_lines.count);
 }else{
  const before=JSON.parse(readFileSync(manifest,'utf8'));
  assert.deepEqual(tables,before.tables,'Every prior table row digest must match');
  assert.deepEqual(triggers,before.triggers,'Existing trigger attachments must remain unchanged');
  const additions=Object.keys(pm02Migrations).map(name=>({migration_name:name,checksum:createHash('sha256').update(readFileSync(new URL('../../apps/api/prisma/migrations/'+name+'/migration.sql',import.meta.url))).digest('hex')}));
  assert.deepEqual(migrations,[...before.migrations,...additions].sort((a,b)=>a.migration_name.localeCompare(b.migration_name)));
  console.log('PM02_POPULATED_PREDECESSOR_ROWS_PRESERVED_PASS tables='+Object.keys(tables).length+' PR_LINES='+tables.purchase_request_lines.count);
 }
}finally{await db.$disconnect();}
