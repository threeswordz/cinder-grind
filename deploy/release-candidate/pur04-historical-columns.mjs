import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pur04Columns,pur04Migration} from './pur04-schema-preparation.mjs';
const expectedTypes={
 delivery_location:['character varying',500,null,null],delivery_contact:['character varying',200,null,null],
 delivery_terms:['text',null,null,null],payment_terms:['text',null,null,null],credit_terms:['text',null,null,null],
 discount_amount:['numeric',null,18,2],freight_amount:['numeric',null,18,2],
 additional_charge_amount:['numeric',null,18,2],vat_rate_percent:['numeric',null,5,2]
};
// Historical-only exclusion; never use after legitimate new commercial writes.
export async function verifiedPur04HistoricalColumns(db){
 const rows=await db.$queryRawUnsafe('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL AND migration_name=$1',pur04Migration);
 assert.deepEqual(rows,[{migration_name:pur04Migration,checksum:createHash('sha256').update(readFileSync(new URL('../../apps/api/prisma/migrations/'+pur04Migration+'/migration.sql',import.meta.url))).digest('hex')}]);
 const columns=await db.$queryRawUnsafe("SELECT column_name,data_type,character_maximum_length,numeric_precision,numeric_scale,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_orders' AND column_name=ANY($1::text[]) ORDER BY column_name",pur04Columns);
 assert.deepEqual(columns.map(c=>c.column_name).sort(),[...pur04Columns].sort());
 for(const c of columns){
  assert.deepEqual([c.data_type,c.character_maximum_length,c.numeric_precision,c.numeric_scale],expectedTypes[c.column_name]);
  assert.equal(c.is_nullable,'YES');assert.equal(c.column_default,null);
 }
 const [row]=await db.$queryRawUnsafe('SELECT count(*)::text AS n FROM purchase_orders WHERE '+pur04Columns.map(c=>'"'+c+'" IS NOT NULL').join(' OR '));
 assert.equal(row.n,'0','PUR04 historical values must remain NULL, never inferred zero');
 const checks=await db.$queryRawUnsafe("SELECT convalidated,contype FROM pg_constraint WHERE conrelid='public.purchase_orders'::regclass AND conname='purchase_orders_commercial_nonnegative'");
 assert.deepEqual(checks,[{convalidated:true,contype:'c'}]);
 return [...pur04Columns];
}
