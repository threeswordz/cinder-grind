// Permit excluding only the exact new nullable PM02 metadata from an upgraded
// historical digest. Never call for an already-PM02 predecessor or its restore.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pm02Columns,pm02Migrations} from './pm02-schema-preparation.mjs';

const expectedTypes={
 review_decision:['character varying',20,null],review_reason:['text',null,null],
 reviewed_by_user_id:['uuid',null,null],reviewed_at:['timestamp with time zone',null,6],
 correction_source_line_id:['uuid',null,null]
};
export async function verifiedPm02HistoricalColumns(db){
 const migrations=await db.$queryRawUnsafe(
  'SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL AND migration_name=ANY($1::text[]) ORDER BY migration_name',Object.keys(pm02Migrations));
 const expected=Object.keys(pm02Migrations).sort().map(migration_name=>({
  migration_name,checksum:createHash('sha256').update(readFileSync(new URL('../../apps/api/prisma/migrations/'+migration_name+'/migration.sql',import.meta.url))).digest('hex')
 }));
 assert.deepEqual(migrations,expected,'Exact finished PM02 migration checksums required');
 const columns=await db.$queryRawUnsafe("SELECT column_name,data_type,character_maximum_length,datetime_precision,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_request_lines' AND column_name=ANY($1::text[]) ORDER BY column_name",pm02Columns);
 assert.deepEqual(columns.map(c=>c.column_name).sort(),[...pm02Columns].sort(),'Exact PM02 metadata columns required');
 for(const c of columns){
  assert.deepEqual([c.data_type,c.character_maximum_length,c.datetime_precision],expectedTypes[c.column_name],'PM02 column type changed');
  assert.equal(c.is_nullable,'YES');assert.equal(c.column_default,null);
 }
 const [row]=await db.$queryRawUnsafe('SELECT count(*)::text AS n FROM purchase_request_lines WHERE '+pm02Columns.map(c=>'"'+c+'" IS NOT NULL').join(' OR '));
 assert.equal(row.n,'0','PM02 historical PR review metadata must remain NULL');
 return [...pm02Columns];
}
