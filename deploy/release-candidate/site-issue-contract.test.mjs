import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {classifySchema} from './schema-contract.mjs';
import {stripSiteIssueSchema,siteIssueMode,siteIssueTables} from './site-issue-schema-contract.mjs';
import {siteIssueCatalog,verifySiteIssueCatalog} from './site-issue-catalog-contract.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';
const current=readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8');
const previous=execFileSync('git',['show','480fd4c7ee5e1aeab3fecf9670607a32a8f23d8b:apps/api/prisma/schema.prisma'],{encoding:'utf8'});
test('FM03 exact three-model increment preserves predecessor fields and denies partial, altered or unrelated schema',()=>{
 assert.equal(classifySchema(previous,current),'migration-aware-site-issue-schema');assert.equal(stripSiteIssueSchema(current).present,true);
 for(const bad of [current.replace('siteIssueRouting SiteIssueRouting?',''),current.replace('category String @db.VarChar(30)','category String @db.VarChar(40)'),current.replace('siteIssueEvents SiteIssueEvent[]','siteIssueEvents SiteIssueEvent?'),current+'\nmodel UnapprovedBalance {\n id String @id\n}'])assert.throws(()=>classifySchema(previous,bad));
 assert.throws(()=>classifySchema(current,previous));
 assert.deepEqual(siteIssueMode('migration-aware-site-issue-plan-issue-material-plan-schema'),{present:true,prior:'migration-aware-plan-issue-material-plan-schema'});
});
test('FM03 seven exact capability definitions allow no retained grants or business backfill',()=>{
 verifySiteIssueCatalog(siteIssueCatalog,true);verifySiteIssueCatalog(siteIssueCatalog.map(p=>({...p,created_at:new Date()})),true);
 for(const bad of [siteIssueCatalog.slice(1),siteIssueCatalog.map((p,i)=>i?p:{...p,module_code:'FINANCE'}),siteIssueCatalog.map((p,i)=>i?p:{...p,created_at:'invalid'}),siteIssueCatalog.map((p,i)=>i?p:{...p,extra:true})])assert.throws(()=>verifySiteIssueCatalog(bad,true));
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/20261114140000_fm03_site_issue_lifecycle/migration.sql',import.meta.url),'utf8');
 for(const row of siteIssueCatalog)for(const value of Object.values(row))assert.ok(sql.includes(value));
 assert.doesNotMatch(sql,/INSERT\s+INTO\s+"?(role_permissions|user_roles|stock_transactions|payments|direct_cost_postings)"?/i);
});
test('FM03 historical snapshots admit only the complete empty group and preserve every old table',()=>{
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')},before={customer_boq_versions:empty,role_permissions:{count:'7',digest:'unchanged'},daily_site_report_issues:{count:'1',digest:'original-observation'}};
 const added=Object.fromEntries(siteIssueTables.map(t=>[t,empty]));
 const verify=after=>assertHistoricalTables(before,after,false,false,false,false,false,false,true);
 verify({...before,...added});assert.throws(()=>assertHistoricalTables(before,{...before,...added}));
 assert.throws(()=>verify({...before,...added,role_permissions:empty}));assert.throws(()=>verify({...before,...added,site_issues:{count:'1',digest:'backfill'}}));
 delete added.site_issue_events;assert.throws(()=>verify({...before,...added}));
});
