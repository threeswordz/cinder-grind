import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pur01Column,pur01Migration} from './pur01-schema-preparation.mjs';
// Only before new business actions: existing exception values must remain unknown.
export async function verifiedPur01HistoricalColumns(db){
 const rows=await db.$queryRawUnsafe('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL AND migration_name=$1',pur01Migration);
 assert.deepEqual(rows,[{migration_name:pur01Migration,checksum:createHash('sha256').update(readFileSync(new URL('../../apps/api/prisma/migrations/'+pur01Migration+'/migration.sql',import.meta.url))).digest('hex')}]);
 const cols=await db.$queryRawUnsafe("SELECT column_name,data_type,character_maximum_length,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_orders' AND column_name=$1",pur01Column);
 assert.deepEqual(cols,[{column_name:pur01Column,data_type:'character varying',character_maximum_length:2000,is_nullable:'YES',column_default:null}]);
 const [row]=await db.$queryRawUnsafe('SELECT count(*)::text AS n FROM purchase_orders WHERE supplier_quote_exception_reason IS NOT NULL');
 assert.equal(row.n,'0','Existing PO exception reason must remain NULL');
 return [pur01Column];
}
