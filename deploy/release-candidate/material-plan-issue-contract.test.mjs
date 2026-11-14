import {stripSiteIssueSchema} from './site-issue-schema-contract.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {classifySchema} from './schema-contract.mjs';
import {stripPlanIssueSchema,planIssueTables,planIssueMode} from './material-plan-issue-schema-contract.mjs';
import {planIssueCatalog,verifyPlanIssueCatalog} from './material-plan-issue-catalog-contract.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';
const current=stripSiteIssueSchema(readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8')).text;
const previous=execFileSync('git',['show','5209c30a1b7b282a603ba09d4a5bd82a700a183f:apps/api/prisma/schema.prisma'],{encoding:'utf8'});
test('B schema admits exactly five additive models and parent relations; previous business fields remain strict',()=>{
 assert.equal(classifySchema(previous,current),'migration-aware-plan-issue-schema');assert.equal(stripPlanIssueSchema(current).present,true);
 for(const bad of [current.replace('overageQuantity Decimal @map("overage_quantity") @db.Decimal(18,4)','overageQuantity Float'),current.replace('materialPlanPolicy MaterialPlanProjectPolicy?',''),current.replace('materialPlanBinding MaterialPlanIssueBinding?','materialPlanBinding MaterialPlanIssueBinding'),current.replace('syntheticOnly Boolean @default(true)','syntheticOnly Boolean @default(false)'),current+'\nmodel UnauthorizedConsumptionBalance {\n id String @id\n}'])assert.throws(()=>classifySchema(previous,bad));
 assert.throws(()=>classifySchema(current,previous));
 assert.deepEqual(planIssueMode('migration-aware-plan-issue-material-plan-material-request-schema'),{present:true,prior:'migration-aware-material-plan-material-request-schema'});
});
test('only exact four new permission definitions and generated timestamps are excluded from predecessor catalog hashes',()=>{
 verifyPlanIssueCatalog(planIssueCatalog,true);verifyPlanIssueCatalog(planIssueCatalog.map(p=>({...p,created_at:new Date('2026-11-03T08:00:00Z')})),true);
 for(const bad of [planIssueCatalog.slice(1),planIssueCatalog.map((p,i)=>i?p:{...p,permission_code:'inventory.issue.approve'}),planIssueCatalog.map((p,i)=>i?p:{...p,created_at:'not-a-timestamp'}),planIssueCatalog.map((p,i)=>i?p:{...p,extra:true})])assert.throws(()=>verifyPlanIssueCatalog(bad,true));
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/20261103080000_material_plan_issue_controls/migration.sql',import.meta.url),'utf8');
 for(const row of planIssueCatalog)for(const value of Object.values(row))assert.ok(sql.includes(value));
 assert.doesNotMatch(sql,/INSERT\s+INTO\s+"?(role_permissions|user_roles|stock_transactions|payments|direct_cost_postings)"?/i);
 assert.doesNotMatch(sql,/ALTER\s+TABLE\s+"?(material_issues|material_issue_items|material_returns|stock_transactions|projects)"?\s+ADD/i);
});
test('B predecessor preservation accepts complete empty five-table addition only, and keeps existing histories exact',()=>{
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')};
 const before={customer_boq_versions:empty,stock_transactions:{count:'3',digest:'retained'},material_usage_plans:{count:'1',digest:'retained-plan'}};
 const added=Object.fromEntries(planIssueTables.map(t=>[t,empty]));const verify=after=>assertHistoricalTables(before,after,false,false,false,false,false,true);
 verify({...before,...added});
 assert.throws(()=>assertHistoricalTables(before,{...before,...added}));
 assert.throws(()=>verify({...before,...added,material_plan_issue_operations:{count:'1',digest:'backfill'}}));
 assert.throws(()=>verify({...before,...added,stock_transactions:empty}));
 assert.throws(()=>verify({...before,...added,material_usage_plans:empty}));
 delete added.material_plan_issue_bindings;assert.throws(()=>verify({...before,...added}));
});
