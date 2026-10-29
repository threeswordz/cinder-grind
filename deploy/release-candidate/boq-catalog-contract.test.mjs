import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {boqCatalog,verifyBoqCatalog} from './boq-catalog-contract.mjs';

test('upgrade catalog exception is exactly five new definitions; old grants and business tables have no exception',()=>{
  verifyBoqCatalog([]);verifyBoqCatalog(boqCatalog);
  assert.equal(boqCatalog.length,5);assert.equal(new Set(boqCatalog.map(x=>x.id)).size,5);
  for(const field of ['id','permission_code','module_code','description'])assert.throws(()=>verifyBoqCatalog([{...boqCatalog[0],[field]:'unapproved'}]));
  const sql=readFileSync(new URL('../../apps/api/prisma/migrations/20261029010000_v1_3_boq_permission_catalog/migration.sql',import.meta.url),'utf8').replace(/--[^\n]*/g,'');
  assert.equal((sql.match(/INSERT INTO permissions/gi)??[]).length,1);
  assert.doesNotMatch(sql,/role_permissions|user_roles|UPDATE |DELETE |ALTER |DROP |TRUNCATE /i);
  for(const definition of boqCatalog)for(const value of Object.values(definition))assert.ok(sql.includes("'"+value+"'"));
});
