import {stripSiteIssueSchema} from './site-issue-schema-contract.mjs';
import {stripPlanIssueSchema} from './material-plan-issue-schema-contract.mjs';
import {stripMaterialPlanSchema} from './material-plan-schema-contract.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {classifySchema} from './schema-contract.mjs';
import {stripMaterialRequestSchema,materialRequestTables,materialRequestMode} from './material-request-schema-contract.mjs';
import {materialRequestCatalog,verifyMaterialRequestCatalog} from './material-request-catalog-contract.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';
const current=stripMaterialPlanSchema(stripPlanIssueSchema(stripSiteIssueSchema(readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8')).text).text).text;
const previous=execFileSync('git',['show','3a5ae8a92083a2bd03f4159b1e84d0565e7e78ec:apps/api/prisma/schema.prisma'],{encoding:'utf8'});
test('DEC-043 admits exactly six request/history/link/receipt/replay models, no stock source addition',()=>{
 assert.equal(classifySchema(previous,current),'migration-aware-material-request-schema');
 assert.equal(stripMaterialRequestSchema(current).present,true);
 for(const invalid of [current.replace('requestedQuantity Decimal','requestedQuantity Float'),current.replace('evidenceChecksum String','evidenceChecksum String?'),
  current.replace('materialRequestLink MaterialRequestIssueLink?','materialRequestLink MaterialRequestIssueLink[]'),current.replace('materialRequests MaterialRequest[]',''),
  current+'\nmodel UnapprovedThing {\n id String @id\n}'])assert.throws(()=>classifySchema(previous,invalid));
 assert.throws(()=>classifySchema(current,previous));
 assert.deepEqual(materialRequestMode('migration-aware-material-request-stock-count-hr-schema'),{present:true,prior:'migration-aware-stock-count-hr-schema'});
});
test('material request permission definitions are exact and never assign retained roles',()=>{
 verifyMaterialRequestCatalog(materialRequestCatalog,true);assert.equal(materialRequestCatalog.length,5);
 assert.throws(()=>verifyMaterialRequestCatalog(materialRequestCatalog.slice(1),true));
 assert.throws(()=>verifyMaterialRequestCatalog([{...materialRequestCatalog[0],permission_code:'inventory.issue.approve'}]));
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/20261102080000_op_material_request_01/migration.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/INSERT\s+INTO\s+"?(role_permissions|user_roles|stock_transactions|payments|direct_cost_postings)"?/i);
 for(const row of materialRequestCatalog)for(const value of Object.values(row))assert.ok(sql.includes(value));
 // Copying the old guard forward must preserve every existing Company/Project/HR/BOQ branch exactly.
 const prior=readFileSync(new URL('../../apps/api/prisma/migrations/20261030160000_hr1_a_document_custody/migration.sql',import.meta.url),'utf8').match(/CREATE OR REPLACE FUNCTION validate_document_link_scope\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/)[0];
 const revised=sql.match(/CREATE OR REPLACE FUNCTION validate_document_link_scope\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/)[0];
 assert.equal(revised.replace(/  ELSIF NEW\."entity_type" = 'MATERIAL_REQUEST' THEN\n    SELECT company_id,project_id INTO target_company,target_project\n    FROM material_requests WHERE id=NEW\."entity_id";\n/,''),prior);
});
test('historical snapshots admit only the complete empty six-table group; prior rows stay strict',()=>{
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')},before={customer_boq_versions:empty,stock_transactions:{count:'7',digest:'prior-stock'}};
 const added=Object.fromEntries(materialRequestTables.map(t=>[t,empty]));
 assertHistoricalTables(before,{...before,...added},false,false,false,true);
 assert.throws(()=>assertHistoricalTables(before,{...before,...added},false,false,false,false));
 assert.throws(()=>assertHistoricalTables(before,{...before,...added,material_request_receipts:{count:'1',digest:empty.digest}},false,false,false,true));
 assert.throws(()=>assertHistoricalTables(before,{...before,...added,stock_transactions:empty},false,false,false,true));
 delete added.material_request_operations;assert.throws(()=>assertHistoricalTables(before,{...before,...added},false,false,false,true));
});
