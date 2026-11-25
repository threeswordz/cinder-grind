// Read-only M6 upgrade gate. Inputs are private pre/post snapshots and file inventories.
// No database connection, file writes, role grants, operator replay or acceptance claims.
const tables = ['subcontractors','subcontract_agreements','subcontract_agreement_versions',
  'subcontract_work_orders','subcontract_claims','subcontract_claim_lines',
  'subcontract_claim_assessments','subcontract_certifications','subcontract_action_replays',
  'subcontract_physical_policies','subcontract_physical_claims','subcontract_physical_revisions',
  'subcontract_physical_submissions','subcontract_physical_decisions','subcontract_physical_operations',
  'retention_ledger_entries'];
const requireCheck = (ok, code) => { if (!ok) throw Object.assign(new Error(code), { safeCode: code }); };
function rows(snapshot, table) {
  requireCheck(Array.isArray(snapshot?.[table]), 'M6_PA_MISSING_TABLE');
  return snapshot[table].map(row => {
    const bytes = row?.__fm03_exact_row_json;
    requireCheck(typeof bytes === 'string', 'M6_PA_MISSING_EXACT_SQL_BYTES');
    let value;
    try { value = JSON.parse(bytes); } catch { requireCheck(false, 'M6_PA_INVALID_SQL_BYTES'); }
    requireCheck(value && typeof value === 'object' && !Array.isArray(value), 'M6_PA_INVALID_SQL_BYTES');
    return { bytes, value };
  });
}
function exact(a, b) {
  requireCheck(JSON.stringify(a.map(r => r.bytes).sort()) === JSON.stringify(b.map(r => r.bytes).sort()), 'M6_PA_HISTORICAL_ROW_DRIFT');
}
function inventory(entries) {
  requireCheck(Array.isArray(entries), 'M6_PA_MISSING_FILE_INVENTORY');
  const map = new Map();
  for (const entry of entries) {
    requireCheck(Array.isArray(entry) && typeof entry[0] === 'string' && !map.has(entry[0]), 'M6_PA_INVALID_FILE_INVENTORY');
    map.set(entry[0], entry);
  }
  return map;
}
export function verifyM6SubcontractRetention(before, after, filesBefore, filesAfter) {
  for (const table of tables) {
    const old = rows(before, table), next = rows(after, table);
    requireCheck(old.length > 0, 'M6_PA_POPULATED_PREDECESSOR_REQUIRED');
    exact(old, next);
  }
  const claimIds = new Set(rows(before, 'subcontract_claims').map(r => r.value.id));
  const oldLinks = rows(before, 'document_links');
  const newLinks = rows(after, 'document_links');
  const claimLinks = oldLinks.filter(r => r.value.entity_type === 'SUBCONTRACT_CLAIM' && claimIds.has(r.value.entity_id));
  requireCheck(claimLinks.length > 0, 'M6_PA_CLAIM_EVIDENCE_REQUIRED');
  const documentIds = new Set(claimLinks.map(r => r.value.document_id));
  // Protect both historical evidence aliases and the complete link set of each old claim.
  const related = r => documentIds.has(r.value.document_id) ||
    (r.value.entity_type === 'SUBCONTRACT_CLAIM' && claimIds.has(r.value.entity_id));
  exact(oldLinks.filter(related), newLinks.filter(related));
  const oldDocs = rows(before, 'documents').filter(r => documentIds.has(r.value.id));
  const newDocs = rows(after, 'documents').filter(r => documentIds.has(r.value.id));
  requireCheck(oldDocs.length === documentIds.size && new Set(oldDocs.map(r => r.value.id)).size === documentIds.size, 'M6_PA_EVIDENCE_METADATA_MISSING');
  exact(oldDocs, newDocs);
  const previous = inventory(filesBefore), current = inventory(filesAfter);
  for (const { value: d } of oldDocs) {
    const a = previous.get(d.storage_key), b = current.get(d.storage_key);
    requireCheck(typeof d.storage_key === 'string' && Number.isSafeInteger(d.file_size_bytes) && d.file_size_bytes >= 0 && /^[a-f0-9]{64}$/.test(d.checksum ?? '') &&
      a?.[1] === d.file_size_bytes && a[2] === d.checksum && JSON.stringify(a) === JSON.stringify(b), 'M6_PA_EVIDENCE_BYTES_DRIFT');
  }
  return { historicalSubcontractRowsPreserved: true, protectedEvidenceMetadataAndBytesPreserved: true, evidenceFileCount: documentIds.size };
}
