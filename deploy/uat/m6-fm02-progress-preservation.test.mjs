import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyM6Fm02Progress as verify} from './m6-fm02-progress-preservation.mjs';
const raw=__fm03_exact_row_json=>({__fm03_exact_row_json});
const add=',"completed_quantity":null,"source_budget_revision_line_id":null,"source_uom_id":null}';
const fixture=()=>({before:{activity_progress:[raw('{"id":"p1","quantity":9007199254740992.01}')]},after:{activity_progress:[raw('{"id":"p1","quantity":9007199254740992.01'+add)],project_progress_plans:[],project_progress_plan_lines:[]}});
const run=f=>verify(f.before,f.after);
const reject=(change,code)=>{const f=fixture();change(f);assert.throws(()=>run(f),{message:code});};
test('preserves historical exact SQL bytes with only declared nullable additions',()=>{assert.equal(run(fixture()),true);});
test('admits an empty historical progress table without inventing rows',()=>{const f=fixture();f.before.activity_progress=[];f.after.activity_progress=[];assert.equal(run(f),true);});
test('rejects any backfill or missing new field',()=>{for(const key of ['completed_quantity','source_budget_revision_line_id','source_uom_id']){
 reject(f=>{f.after.activity_progress[0].__fm03_exact_row_json=f.after.activity_progress[0].__fm03_exact_row_json.replace('"'+key+'":null','"'+key+'":1');},'M6_FM02_UNEXPECTED_BACKFILL');
 reject(f=>{f.after.activity_progress[0].__fm03_exact_row_json=f.after.activity_progress[0].__fm03_exact_row_json.replace(',"'+key+'":null','');},'M6_FM02_UNEXPECTED_BACKFILL');
}});
test('rejects precision drift invisible after JS parsing',()=>{const f=fixture();const old=f.before.activity_progress[0].__fm03_exact_row_json;const changed=old.replace('.01','.02');assert.deepEqual(JSON.parse(old),JSON.parse(changed));reject(g=>{g.after.activity_progress[0].__fm03_exact_row_json=g.after.activity_progress[0].__fm03_exact_row_json.replace('.01','.02');},'M6_EXACT_HISTORICAL_ROW_DRIFT');});
test('rejects missing or newly inserted historical rows',()=>{reject(f=>{delete f.after.activity_progress;},'M6_FM02_PROGRESS_TABLE_REQUIRED');reject(f=>{f.after.activity_progress.push(f.after.activity_progress[0]);},'M6_FM02_PROGRESS_COUNT_CHANGED');reject(f=>{f.after.activity_progress=[];},'M6_FM02_PROGRESS_COUNT_CHANGED');});
test('rejects unexpected schema additions and an already extended predecessor',()=>{reject(f=>{f.after.activity_progress[0].__fm03_exact_row_json=f.after.activity_progress[0].__fm03_exact_row_json.replace(/}$/,',"unexpected":null}');},'M6_FM02_PROGRESS_COLUMN_DRIFT');reject(f=>{f.before.activity_progress[0]=f.after.activity_progress[0];},'M6_FM02_PREDECESSOR_ALREADY_EXTENDED');});
test('rejects activation, missing new tables and predecessor already containing FM02 tables',()=>{for(const key of ['project_progress_plans','project_progress_plan_lines']){reject(f=>{f.after[key].push(raw('{"id":"new"}'));},'M6_FM02_UNEXPECTED_WEIGHTED_PROGRESS');reject(f=>{delete f.after[key];},'M6_FM02_UNEXPECTED_WEIGHTED_PROGRESS');reject(f=>{f.before[key]=[];},'M6_FM02_UNEXPECTED_WEIGHTED_PROGRESS');}});
