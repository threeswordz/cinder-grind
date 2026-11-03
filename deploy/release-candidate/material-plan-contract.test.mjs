import {stripPlanIssueSchema} from './material-plan-issue-schema-contract.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {classifySchema} from './schema-contract.mjs';
import {stripMaterialPlanSchema,materialPlanTables,materialPlanMode} from './material-plan-schema-contract.mjs';
import {materialPlanCatalog,verifyMaterialPlanCatalog} from './material-plan-catalog-contract.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';
const current=stripPlanIssueSchema(readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8')).text;
const previous=execFileSync('git',['show','34e022d5807d3e16458437a02ebba669ba838c6a:apps/api/prisma/schema.prisma'],{encoding:'utf8'});
test('DEC-044 foundation admits exact four models and parent relations, without an issue source or enablement flag',()=>{
 assert.equal(classifySchema(previous,current),'migration-aware-material-plan-schema');assert.equal(stripMaterialPlanSchema(current).present,true);
 for(const bad of [current.replace('quantity Decimal @db.Decimal(18,4)','quantity Float'),current.replace('snapshot Json @db.JsonB','snapshot Json? @db.JsonB'),current.replace('materialUsagePlans MaterialUsagePlan[]',''),current+'\nmodel UnapprovedPlanThing {\n id String @id\n}'])assert.throws(()=>classifySchema(previous,bad));
 assert.throws(()=>classifySchema(current,previous));
 assert.deepEqual(materialPlanMode('migration-aware-material-plan-material-request-stock-count-schema'),{present:true,prior:'migration-aware-material-request-stock-count-schema'});
});
test('material plan permission definitions stay exact and migration assigns no roles or stock/Finance records',()=>{
 verifyMaterialPlanCatalog(materialPlanCatalog,true);assert.equal(materialPlanCatalog.length,5);
 assert.throws(()=>verifyMaterialPlanCatalog(materialPlanCatalog.slice(1),true));assert.throws(()=>verifyMaterialPlanCatalog([{...materialPlanCatalog[0],permission_code:'inventory.issue.approve'}]));
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/20261102140000_op_material_plan_01_a/migration.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/INSERT\s+INTO\s+"?(role_permissions|user_roles|stock_transactions|material_issues|payments|direct_cost_postings)"?/i);
 for(const row of materialPlanCatalog)for(const value of Object.values(row))assert.ok(sql.includes(value));
});
test('historical snapshots admit only the complete empty plan group and preserve prior tables exactly',()=>{
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')},before={customer_boq_versions:empty,stock_transactions:{count:'3',digest:'unchanged'}};
 const added=Object.fromEntries(materialPlanTables.map(t=>[t,empty]));assertHistoricalTables(before,{...before,...added},false,false,false,false,true);
 assert.throws(()=>assertHistoricalTables(before,{...before,...added},false,false,false,false,false));
 assert.throws(()=>assertHistoricalTables(before,{...before,...added,material_usage_plan_operations:{count:'1',digest:'changed'}},false,false,false,false,true));
 assert.throws(()=>assertHistoricalTables(before,{...before,...added,stock_transactions:empty},false,false,false,false,true));delete added.material_usage_plan_lines;assert.throws(()=>assertHistoricalTables(before,{...before,...added},false,false,false,false,true));
});

test('catalog accepts only generated creation timestamps beside exact new permission definitions',()=>{
 const actual=materialPlanCatalog.map(row=>({...row,created_at:new Date('2026-11-02T14:08:05.829Z')}));
 verifyMaterialPlanCatalog(actual,true);
 assert.throws(()=>verifyMaterialPlanCatalog(actual.map((row,i)=>i?row:{...row,description:'Changed business capability'}),true));
 assert.throws(()=>verifyMaterialPlanCatalog(actual.map((row,i)=>i?row:{...row,created_at:'invalid'}),true));
 assert.throws(()=>verifyMaterialPlanCatalog(actual.map((row,i)=>i?row:{...row,unapprovedField:true}),true));
});
