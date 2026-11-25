import { PurchaseOrderDetail } from '../api/purchase-orders';
import { approvedPrintTotals, formatPoLineAmount } from './purchase-order-print-money';

// Browser-native printing supports Thai shaping via the operator's installed
// fonts. This is a manual Print -> Save as PDF workflow, not an automatic PDF
// file download or proof of third-party transmission.
const escape = (value: string): string =>
  value.replace(/[&<>"']/gu, (match) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;',
  })[match]!);

export function printApprovedPurchaseOrderHtml(order: PurchaseOrderDetail): {
  html: string; suggestedFileName: string;
} {
  if (order.lifecycleState !== 'APPROVED' || order.cancelledAt) {
    throw new Error('Only the exact approved, active PO revision may be printed.');
  }
  if (!order.lines.length || order.currencyCode !== 'THB') {
    throw new Error('PO_PRINT_SOURCE_CURRENCY_OR_LINES_UNVERIFIED');
  }
  const label = (order.displayNumber ?? order.poNumber).trim().normalize('NFKC');
  if (!/^([TK]-)?PO\d{4}-\d{3,}/u.test(label) ||
      /[\\/<>:"|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(label) ||
      !/^[\p{L}\p{M}\p{N} .()_-]+$/u.test(label)) {
    throw new Error('PO display identity is not safe as a filename.');
  }
  const suffix = order.revisionNo > 0 ? '-rev' + String(order.revisionNo).padStart(2, '0') : '';
  const suggestedFileName = label + suffix + '.pdf';
  if (new TextEncoder().encode(suggestedFileName).length > 210) {
    throw new Error('PO_PRINT_FILENAME_TOO_LONG');
  }
  const totals = approvedPrintTotals(order);
  const verified = order.approvalInstance?.approvalState === 'APPROVED' &&
    Boolean(order.approvalInstance.completedAt);
  if (!verified) {
    throw new Error('PO_PRINT_INDEPENDENT_APPROVAL_EVIDENCE_MISSING');
  }
  const legalNames = new Set(order.lines.map(line => line.quotationAward?.supplierNameSnapshot?.trim()));
  if (legalNames.size !== 1 || [...legalNames][0] === undefined || ![...legalNames][0]) {
    throw new Error('The approved PO has inconsistent or missing immutable supplier legal names.');
  }
  const legalName = [...legalNames][0]!;
  const lines = order.lines.map(line => `<tr>
    <td>${line.lineNo}</td><td>${escape(line.description)}</td>
    <td>${escape(line.quantity)} ${escape(line.uomCodeSnapshot)}</td>
    <td class="number">${escape(line.unitPrice)}</td>
    <td class="number">${formatPoLineAmount(line.amount)}</td></tr>`).join('\n');
  const value = (v: string | null) => escape(v ?? 'Not specified');
  const approvedAt = order.approvalInstance?.completedAt ?? '';
  const html = `<!doctype html><html lang="th"><head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escape(suggestedFileName.replace(/\.pdf$/u,''))}</title>
<style>
@page { size:A4; margin:14mm; }
body { font: 11pt/1.45 'Noto Sans Thai','Tahoma','Arial',sans-serif; color:#1f2937; }
h1 {font-size:20pt; margin:0 0 12px;} h2 {font-size:12pt;}
.header {border-bottom:2px solid #333; padding-bottom:12px; margin-bottom:15px;}
.meta {display:grid; grid-template-columns:1fr 1fr; gap:7px 20px;}
table {border-collapse:collapse; width:100%; margin-top:15px; font-size:9pt;}
th,td {padding:6px; border-bottom:1px solid #ddd; text-align:left; vertical-align:top;}
th {background:#f5f5f5;} .number {text-align:right; white-space:nowrap;}
tr {break-inside:avoid;} .footer{border-top:1px solid #777; margin-top:22px; padding-top:10px;}
.warning {font-size:8pt;color:#555;}
</style></head><body>
<section class="header"><h1>Purchase Order / ใบสั่งซื้อ</h1>
<div><strong>${escape(label)}</strong> · Revision ${order.revisionNo} · APPROVED</div></section>
<div class="meta">
<div><strong>Supplier (legal):</strong> ${escape(legalName)}</div>
<div><strong>Project:</strong> ${escape(order.project.projectCode)} — ${escape(order.project.projectName)}</div>
<div><strong>Approval completed:</strong> ${escape(approvedAt)}</div>
<div><strong>Currency:</strong> ${escape(order.currencyCode ?? 'NOT VERIFIED')}</div>
<div><strong>Delivery location:</strong> ${value(order.deliveryLocation)}</div>
<div><strong>Delivery contact:</strong> ${value(order.deliveryContact)}</div>
</div>
<table><thead><tr><th>#</th><th>Description / รายละเอียด</th>
<th>Qty / Unit</th><th>Unit price</th><th>Amount</th></tr></thead>
<tbody>${lines}</tbody></table>
<h2>Commercial totals (THB)</h2>
<div class="warning">Line amounts and totals are rounded independently to satang from the full stored precision. Unit prices retain their approved precision.</div>
<div class="meta">
<div><strong>Subtotal:</strong> ${totals.subtotal}</div>
<div><strong>Net before VAT:</strong> ${totals.net ?? 'NOT CALCULATED — missing inputs'}</div>
<div><strong>VAT amount:</strong> ${totals.vatAmount ?? 'NOT CALCULATED — missing inputs'}</div>
<div><strong>Grand total (including VAT):</strong> ${totals.grandTotal ?? 'NOT CALCULATED — missing inputs'}</div>
</div>
<h2>Commercial terms</h2><div class="meta">
<div><strong>Discount:</strong> ${value(order.discountAmount)}</div>
<div><strong>Freight:</strong> ${value(order.freightAmount)}</div>
<div><strong>Additional charges:</strong> ${value(order.additionalChargeAmount)}</div>
<div><strong>VAT rate (%):</strong> ${value(order.vatRatePercent)}</div>
<div><strong>Delivery terms:</strong> ${value(order.deliveryTerms)}</div>
<div><strong>Payment terms:</strong> ${value(order.paymentTerms)}</div>
<div><strong>Credit terms:</strong> ${value(order.creditTerms)}</div>
</div>
<div class="footer"><strong>Supplier-facing approved revision only.</strong>
<div class="warning">This preview uses your browser's Print / Save as PDF. It does not send
email/LINE, verify the final file, or alter existing approved PO/receipt/invoice records.
Choose the filename shown in the document title and attach the real sent file as evidence.</div></div>
</body></html>`;
  return { html, suggestedFileName };
}
