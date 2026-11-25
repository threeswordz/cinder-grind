import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pm02Migrations,pm02Columns} from './pm02-schema-preparation.mjs';
import {verifiedPm02HistoricalColumns} from './pm02-historical-columns.mjs';

const goodMigrations=()=>Object.keys(pm02Migrations).sort().map(migration_name=>({migration_name,checksum:createHash('sha256').update(readFileSync(new URL('../../apps/api/prisma/migrations/'+migration_name+'/migration.sql',import.meta.url))).digest('hex')}));
const goodColumns=()=>[
 ['review_decision','character varying',20,null],['review_reason','text',null,null],
 ['reviewed_by_user_id','uuid',null,null],['reviewed_at','timestamp with time zone',null,6],
 ['correction_source_line_id','uuid',null,null]
].map(([column_name,data_type,character_maximum_length,datetime_precision])=>({column_name,data_type,character_maximum_length,datetime_precision,is_nullable:'YES',column_default:null}));
function fixture({migrations=goodMigrations(),columns=goodColumns(),n='0'}={}){
 return {$queryRawUnsafe:async(sql,params)=>{
  if(sql.includes('"_prisma_migrations"')){assert.deepEqual(params,Object.keys(pm02Migrations));return migrations;}
  if(sql.includes('information_schema.columns')){assert.deepEqual(params,pm02Columns);return columns;}
  if(sql.includes('count(*)')){for(const c of pm02Columns)assert.ok(sql.includes('"'+c+'" IS NOT NULL'));return [{n}];}
  throw Error('Unexpected query');
 }};
}
test('PM02 historical exclusion requires exact migration checksums, types and NULL-only data',async()=>{
 assert.deepEqual(await verifiedPm02HistoricalColumns(fixture()),pm02Columns);
 for(const invalid of [
  {migrations:goodMigrations().slice(1)},
  {migrations:goodMigrations().map(x=>({...x,checksum:'bad'}))},
  {columns:goodColumns().slice(1)},
  {columns:goodColumns().map(x=>({...x,is_nullable:'NO'}))},
  {columns:goodColumns().map(x=>({...x,column_default:'now()'}))},
  {columns:goodColumns().map(x=>({...x,data_type:'text'}))},
  {n:'1'}
 ])await assert.rejects(()=>verifiedPm02HistoricalColumns(fixture(invalid)));
});
