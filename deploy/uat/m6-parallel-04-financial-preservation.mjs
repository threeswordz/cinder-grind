// Successor migration-only custody check. Not a business transaction or acceptance.
// Use complete pre/post SQL snapshots from the same preserved database lineage.
export const financialTables = Object.freeze([
  'subcontract_variations', 'subcontract_certifications', 'retention_ledger_entries',
  'subcontract_payment_allocations', 'payments', 'supplier_payment_allocations',
  'client_receipt_allocations', 'supplier_invoices', 'supplier_invoice_items',
  'client_invoices', 'client_invoice_items',
]);
const required = new Set(['subcontract_certifications', 'retention_ledger_entries', 'payments', 'supplier_invoices', 'supplier_invoice_items', 'supplier_payment_allocations']);
const need = (ok, code, table) => {
  if (!ok) throw Object.assign(new Error(`M6_04_FINANCE_${code}:${table}`), { safeCode: `M6_04_FINANCE_${code}` });
};
function indexed(snapshot, table) {
  const rows = snapshot?.[table];
  need(Array.isArray(rows), 'TABLE_MISSING', table);
  const result = new Map();
  for (const row of rows) {
    const bytes = row?.__fm03_exact_row_json;
    need(typeof bytes === 'string', 'EXACT_SQL_REQUIRED', table);
    let value;
    try { value = JSON.parse(bytes); } catch { need(false, 'SQL_INVALID', table); }
    need(value && typeof value === 'object' && !Array.isArray(value) && typeof value.id === 'string' && value.id.length > 0, 'SQL_INVALID', table);
    need(!result.has(value.id), 'DUPLICATE_ID', table);
    result.set(value.id, bytes);
  }
  return result;
}
export function verifyM604FinancialPreservation(before, after) {
  const population = {};
  for (const table of financialTables) {
    const prior = indexed(before, table), current = indexed(after, table);
    need(!required.has(table) || prior.size > 0, 'REQUIRED_POPULATION_EMPTY', table);
    // The shared historical-row subset check does not reject new financial rows.
    // Here even an insert into an initially empty allocation/variation table fails.
    need(prior.size === current.size, 'ROW_COUNT_DRIFT', table);
    for (const [id, bytes] of prior) need(current.get(id) === bytes, 'ROW_DRIFT', table);
    population[table] = prior.size;
  }
  return { status: 'M6_04_FINANCIAL_SNAPSHOT_PRESERVED', population,
    emptyTables: financialTables.filter(table => population[table] === 0),
    financialRowsPreserved: true, liveDatabaseVerified: false,
    authenticatedWorkflowVerified: false, milestone6Accepted: false, mayMutate: false };
}
