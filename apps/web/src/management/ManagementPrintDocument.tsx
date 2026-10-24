import type { ManagementReport } from '../api/management';

const printStyles = "@page {\n  size: A4 landscape;\n  margin: 12mm;\n}\n@media screen {\n  #erp-management-print-document { display: none !important; }\n}\n@media print {\n  html, body { width: auto !important; height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }\n  body #root { display: none !important; }\n  #erp-management-print-document { display: block !important; position: static !important; box-sizing: border-box; width: 100%; max-width: none; margin: 0; padding: 0; color: #151515; background: #fff; font: 9pt/1.35 Arial, Helvetica, sans-serif; }\n  #erp-management-print-document h1 { margin: 0 0 2mm; font-size: 17pt; line-height: 1.2; }\n  #erp-management-print-document .print-context { margin: 0 0 4mm; font-size: 9pt; overflow-wrap: anywhere; }\n  #erp-management-print-document .print-details { display: flex; flex-wrap: wrap; gap: 2mm 7mm; margin: 0 0 5mm; padding-bottom: 3mm; border-bottom: 1px solid #aaa; }\n  #erp-management-print-document .print-details span { white-space: normal; overflow-wrap: anywhere; }\n  #erp-management-print-document table { width: 100%; table-layout: fixed; border-collapse: collapse; }\n  #erp-management-print-document thead { display: table-header-group; }\n  #erp-management-print-document tr { break-inside: avoid; page-break-inside: avoid; }\n  #erp-management-print-document th, #erp-management-print-document td { box-sizing: border-box; padding: 2mm 2.5mm; border-bottom: 1px solid #d5d5d5; vertical-align: top; text-align: left; overflow-wrap: anywhere; word-break: normal; }\n  #erp-management-print-document th { background: #f1f1f1 !important; font-weight: 700; border-bottom-color: #888; -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  #erp-management-print-document .print-value { text-align: right; }\n  #erp-management-print-document .print-metric-code { display: block; margin-top: 1mm; font-size: 7pt; color: #555; }\n  #erp-management-print-document .print-footer { margin-top: 5mm; font-size: 8pt; color: #444; }\n}";

function reportValue(row: ManagementReport['rows'][number]): string {
  if (row.value === null) return 'Unavailable';
  return row.unit === 'MONEY'
    ? [row.currencyCode, String(row.value)].filter(Boolean).join(' ')
    : String(row.value);
}

/**
 * Render only the server-authorized Management report already visible on screen.
 * This lives in a document.body portal, outside the responsive ERP shell,
 * avoiding sidebar/overflow constraints without changing API/export permissions.
 */
export function ManagementPrintDocument({ report }: { report: ManagementReport }) {
  return (
    <>
      <style>{printStyles}</style>
      <section id="erp-management-print-document" aria-labelledby="erp-management-print-title">
        <header>
          <h1 id="erp-management-print-title">Management Report</h1>
          <p className="print-context">
            {report.project.projectCode} · {report.project.projectName}
          </p>
          <div className="print-details">
            <span>As of: {report.asOfDate}</span>
            <span>Domain: {report.filters.domain}</span>
            <span>Status: {report.filters.status ?? 'ANY'}</span>
            <span>Lookahead: {report.lookaheadDays} days</span>
            <span>Currency: {report.baseCurrencyCode}</span>
            <span>Rows: {report.rowCount}</span>
            {report.filters.fromDate || report.filters.toDate ? (
              <span>
                Cash flow: {report.filters.fromDate ?? 'start'} to {report.filters.toDate ?? 'end'}
              </span>
            ) : null}
          </div>
        </header>
        <table>
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '31%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '27%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Domain</th>
              <th scope="col">Metric</th>
              <th scope="col">Status</th>
              <th scope="col" className="print-value">Value</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.domain + ':' + row.metric}>
                <td>{row.domain}</td>
                <td>
                  {row.label}
                  <span className="print-metric-code">{row.metric}</span>
                </td>
                <td>{row.status}</td>
                <td className="print-value">{reportValue(row)}</td>
                <td>{row.canonicalSource}</td>
              </tr>
            ))}
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={5}>No report rows match the selected filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <footer className="print-footer">
          Source-derived, read-only Management report. Detailed source access remains subject
          to owning-module permissions.
        </footer>
      </section>
    </>
  );
}
