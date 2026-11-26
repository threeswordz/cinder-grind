// Read-only historical fingerprint comparison. No session/history exceptions are waived.
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const name=/^[a-z_][a-z0-9_]*$/;
const hex=/^[a-f0-9]{64}$/;
const migrationName=/^[A-Za-z0-9_-]{1,200}$/;
export const addedColumns=Object.freeze({
  activity_progress:['completed_quantity','source_budget_revision_line_id','source_uom_id'],
  purchase_request_lines:['review_decision','review_reason','reviewed_by_user_id','reviewed_at','correction_source_line_id'],
  purchase_orders:['delivery_location','delivery_contact','delivery_terms','payment_terms','credit_terms','discount_amount','freight_amount','additional_charge_amount','vat_rate_percent','supplier_quote_exception_reason','po_display_number','supplier_short_name_snapshot'],
  customers:['short_name'],suppliers:['short_name']
});
export const addedTables=Object.freeze(['equipment_asset_register_versions','equipment_custody_loans','po_dispatch_events','project_progress_plan_lines','project_progress_plans']);
const permissionCodes=Object.freeze(['schedule.work_plan.prepare','schedule.work_plan.confirm','equipment.custody.view','equipment.custody.manage']);
const quote=s=>"'"+s+"'"; // Callers validate or use fixed literals before interpolation.
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function validateBaseline(baseline){
  need(Array.isArray(baseline)&&baseline.length===168&&baseline.every(r=>r&&typeof r.table==='string'&&name.test(r.table)&&Number.isSafeInteger(r.rows)&&r.rows>=0&&typeof r.sha256==='string'&&hex.test(r.sha256))&&new Set(baseline.map(r=>r.table)).size===168,'M6_HISTORICAL_ROW_BASELINE_INVALID');
  need(['_prisma_migrations','permissions',...Object.keys(addedColumns)].every(t=>baseline.some(r=>r.table===t))&&!addedTables.some(t=>baseline.some(r=>r.table===t)),'M6_HISTORICAL_ROW_BASELINE_SCOPE_INVALID');
  return baseline;
}
export function fingerprintSql(table,{oldMigrationNames=[],excludedPermissions=[]}={}){
  need(typeof table==='string'&&name.test(table),'M6_HISTORICAL_ROW_TABLE_INVALID');
  const cols=Object.hasOwn(addedColumns,table)?addedColumns[table]:[];
  let row='to_jsonb(t)';
  if(cols.length)row+=' - ARRAY['+cols.map(quote).join(',')+']::text[]';
  let filter='';
  if(table==='_prisma_migrations'){
    need(Array.isArray(oldMigrationNames)&&oldMigrationNames.length===166&&oldMigrationNames.every(n=>typeof n==='string'&&migrationName.test(n))&&new Set(oldMigrationNames).size===166,'M6_HISTORICAL_ROW_MIGRATION_SCOPE_INVALID');
    filter=' WHERE t.migration_name IN ('+oldMigrationNames.map(quote).join(',')+')';
  }
  if(excludedPermissions.length){
    need(table==='permissions'&&Array.isArray(excludedPermissions)&&new Set(excludedPermissions).size===excludedPermissions.length&&excludedPermissions.every(c=>permissionCodes.includes(c)),'M6_HISTORICAL_ROW_PERMISSION_SCOPE_INVALID');
    filter=' WHERE t.permission_code NOT IN ('+excludedPermissions.map(quote).join(',')+')';
  }
  return `SELECT count(*) AS rows,encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex') AS sha256 FROM (SELECT encode(sha256(convert_to((${row})::text,'UTF8')),'hex') AS h FROM public."${table}" AS t${filter}) AS fingerprints`;
}
function matches(expected,actual){
  need(Array.isArray(actual)&&actual.length===1&&typeof actual[0]?.rows==='bigint'&&actual[0].rows>=0n&&typeof actual[0].sha256==='string'&&hex.test(actual[0].sha256),'M6_HISTORICAL_ROW_QUERY_INVALID');
  return actual[0].rows===BigInt(expected.rows)&&actual[0].sha256===expected.sha256;
}
export async function compareHistoricalRows(tx,baseline,oldMigrationNames){
  validateBaseline(baseline);
  const tables=await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename");
  need(Array.isArray(tables)&&equal(tables.map(r=>r.tablename).sort(),[...baseline.map(r=>r.table),...addedTables].sort()),'M6_HISTORICAL_ROW_TABLE_SET_DRIFT');
  const mismatchedTables=[];let matched=0;
  for(const b of baseline){
    let ok=matches(b,await tx.$queryRawUnsafe(fingerprintSql(b.table,{oldMigrationNames})));
    // The only permitted projection candidates are subsets of the four exact
    // migration-added permission codes. The original digest must still match.
    if(!ok&&b.table==='permissions'){
      for(let mask=1;mask<16&&!ok;mask++){
        const excludedPermissions=permissionCodes.filter((_,i)=>mask&(1<<i));
        ok=matches(b,await tx.$queryRawUnsafe(fingerprintSql(b.table,{excludedPermissions})));
      }
    }
    if(ok)matched++;else mismatchedTables.push(b.table);
  }
  const nonEmptyAddedTables=[];
  for(const table of addedTables){
    const rows=await tx.$queryRawUnsafe('SELECT count(*) AS rows FROM public."'+table+'"');
    need(Array.isArray(rows)&&rows.length===1&&typeof rows[0]?.rows==='bigint'&&rows[0].rows>=0n,'M6_HISTORICAL_ROW_QUERY_INVALID');
    if(rows[0].rows!==0n)nonEmptyAddedTables.push(table);
  }
  return {originalTablesCompared:168,originalTablesMatched:matched,mismatchedTables:mismatchedTables.sort(),nonEmptyAddedTables,historicalDatabaseRowsVerified:matched===168&&nonEmptyAddedTables.length===0};
}
