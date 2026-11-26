// M6 does not activate FM02 weighted progress or rewrite historical progress.
import {verifyExactHistoricalRows} from './m6-exact-historical-rows.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const additions=['completed_quantity','source_budget_revision_line_id','source_uom_id'];
const newTables=['project_progress_plans','project_progress_plan_lines'];
function decode(row){
 const raw=row?.__fm03_exact_row_json;
 need(typeof raw==='string','M6_FM02_EXACT_SQL_REQUIRED');
 let value;try{value=JSON.parse(raw);}catch{need(false,'M6_FM02_EXACT_SQL_INVALID');}
 need(value&&typeof value==='object'&&!Array.isArray(value),'M6_FM02_EXACT_SQL_INVALID');
 return value;
}
export function verifyM6Fm02Progress(before,after){
 need(Array.isArray(before?.activity_progress)&&Array.isArray(after?.activity_progress),'M6_FM02_PROGRESS_TABLE_REQUIRED');
 const old=before.activity_progress,next=after.activity_progress;
 need(old.length===next.length,'M6_FM02_PROGRESS_COUNT_CHANGED');
 for(const table of newTables)need(!Object.hasOwn(before,table)&&Array.isArray(after[table])&&after[table].length===0,'M6_FM02_UNEXPECTED_WEIGHTED_PROGRESS');
 const columns=old.length?Object.keys(decode(old[0])):[];
 for(const row of old){const value=decode(row);need(additions.every(k=>!Object.hasOwn(value,k)),'M6_FM02_PREDECESSOR_ALREADY_EXTENDED');}
 for(const row of next){const value=decode(row);
  need(additions.every(k=>Object.hasOwn(value,k)&&value[k]===null),'M6_FM02_UNEXPECTED_BACKFILL');
  need(Object.keys(value).length===columns.length+additions.length&&columns.every(k=>Object.hasOwn(value,k)),'M6_FM02_PROGRESS_COLUMN_DRIFT');
 }
 verifyExactHistoricalRows({activity_progress:old},{activity_progress:next});
 return true;
}
