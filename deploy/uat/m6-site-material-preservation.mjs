// Read-only successor proof for the completed site/material journeys. No replay.
const required = ['daily_site_reports','site_issues','site_issue_events','material_requests','material_request_lines','material_usage_plans','material_usage_plan_lines','material_issues','material_uom_request_line_pins'];
const optional = ['daily_site_report_manpower','daily_site_report_material_usage','daily_site_report_progress_lines','daily_site_report_issues','daily_site_report_delays','daily_site_report_inspections','daily_site_report_corrections','daily_site_report_equipment_usage','site_issue_routings','material_request_revisions','material_request_issue_links','material_request_receipts','material_request_operations','material_usage_plan_revisions','material_usage_plan_operations','material_plan_project_policies','material_plan_issue_bindings','material_plan_issue_authorizations','material_plan_issue_allocations','material_plan_issue_operations','material_issue_items','material_returns','material_return_items','material_uom_plan_allocation_pins','material_uom_plan_line_pins','material_uom_issue_source_pins'];
export const siteMaterialTables = Object.freeze([...required,...optional]);
const need = (ok,code) => { if(!ok) throw Object.assign(new Error(code),{safeCode:code}); };
function rows(snapshot,table) {
  need(Array.isArray(snapshot?.[table]),'M6_SM_TABLE_MISSING');
  return snapshot[table].map(row=>{
    const bytes=row?.__fm03_exact_row_json;
    need(typeof bytes==='string','M6_SM_EXACT_SQL_REQUIRED');
    let value; try { value=JSON.parse(bytes); } catch { need(false,'M6_SM_EXACT_SQL_INVALID'); }
    need(value && typeof value==='object' && !Array.isArray(value),'M6_SM_EXACT_SQL_INVALID');
    return {bytes,value};
  });
}
function equal(before,after) {
  need(JSON.stringify(before.map(r=>r.bytes).sort())===JSON.stringify(after.map(r=>r.bytes).sort()),'M6_SM_HISTORICAL_DRIFT');
}
function inventory(entries) {
  need(Array.isArray(entries),'M6_SM_INVENTORY_REQUIRED');
  const result=new Map();
  for(const e of entries){need(Array.isArray(e)&&typeof e[0]==='string'&&!result.has(e[0]),'M6_SM_INVENTORY_INVALID');result.set(e[0],e);}
  return result;
}
export function verifyM6SiteMaterial(before,after,filesBefore,filesAfter) {
  for(const table of siteMaterialTables){
    const old=rows(before,table),next=rows(after,table);
    if(required.includes(table))need(old.length>0,'M6_SM_COMPLETED_PREDECESSOR_REQUIRED');
    equal(old,next);
  }
  const requests=new Set(rows(before,'material_requests').map(r=>r.value.id));
  const priorLinks=rows(before,'document_links'),currentLinks=rows(after,'document_links');
  const requestLinks=priorLinks.filter(r=>r.value.entity_type==='MATERIAL_REQUEST'&&requests.has(r.value.entity_id));
  need(requestLinks.length>0,'M6_SM_REQUEST_EVIDENCE_REQUIRED');
  const ids=new Set(requestLinks.map(r=>r.value.document_id));
  // Detect both newly attached evidence and altered aliases of original evidence.
  const related=r=>ids.has(r.value.document_id)||(r.value.entity_type==='MATERIAL_REQUEST'&&requests.has(r.value.entity_id));
  equal(priorLinks.filter(related),currentLinks.filter(related));
  const priorDocs=rows(before,'documents').filter(r=>ids.has(r.value.id));
  const currentDocs=rows(after,'documents').filter(r=>ids.has(r.value.id));
  need(priorDocs.length===ids.size&&new Set(priorDocs.map(r=>r.value.id)).size===ids.size,'M6_SM_EVIDENCE_METADATA_MISSING');
  equal(priorDocs,currentDocs);
  const previous=inventory(filesBefore),current=inventory(filesAfter);
  for(const {value:d} of priorDocs){
    const a=previous.get(d.storage_key),b=current.get(d.storage_key);
    need(typeof d.storage_key==='string'&&Number.isSafeInteger(d.file_size_bytes)&&d.file_size_bytes>=0&&/^[a-f0-9]{64}$/.test(d.checksum??'')&&a?.[1]===d.file_size_bytes&&a[2]===d.checksum&&JSON.stringify(a)===JSON.stringify(b),'M6_SM_EVIDENCE_BYTES_DRIFT');
  }
  return {historicalSiteMaterialRowsPreserved:true,materialRequestEvidencePreserved:true};
}
