import { createHash } from 'node:crypto';

// PUR07: keep a dependency-free ASCII-only PDF path for exact, reproducible
// approved documents. Non-ASCII legal names/line text MUST fail closed until
// a reviewed Thai/Unicode embedding path is added; do not omit/replace names.
export class PoPdfUnsupportedTextError extends Error {
  constructor() {
    super('PO_PDF_UNSUPPORTED_SCRIPT: reviewed Unicode/Thai font rendering is required; text must not be omitted.');
    this.name = 'PoPdfUnsupportedTextError';
  }
}

const forbiddenFilename = /[\\/<>:"|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const approvedFilenameChar = /^[\p{L}\p{M}\p{N} .()_-]+$/u;

export function approvedPoPdfFilename(
  poNumber: string,
  displayNumber: string | null,
  revisionNo: number,
): string {
  if (!Number.isSafeInteger(revisionNo) || revisionNo < 0 || revisionNo > 9999) {
    throw new Error('PO_PDF_REVISION_INVALID');
  }
  const value = (displayNumber ?? poNumber).normalize('NFKC').trim();
  if (!value || value === '.' || value === '..' ||
      forbiddenFilename.test(value) || !approvedFilenameChar.test(value) ||
      !/^([TK]-)?PO\d{4}-\d{3,}/u.test(value)) {
    throw new Error('PO_PDF_FILENAME_INVALID');
  }
  const filename = value + (revisionNo ? '-rev' + String(revisionNo).padStart(2, '0') : '') + '.pdf';
  if (Buffer.byteLength(filename, 'utf8') > 210) {
    throw new Error('PO_PDF_FILENAME_TOO_LONG');
  }
  return filename;
}

function safePdfText(value: string): string {
  if (/[\x00-\x1f\x7f-\uffff]/u.test(value)) {
    throw new PoPdfUnsupportedTextError();
  }
  // Every caller must use PDF-string escaping, not HTML or URL escaping.
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrap(line: string, width = 90): string[] {
  if (line.length <= width) return [line];
  const result: string[] = [];
  let rest = line;
  while (rest.length > width) {
    const candidate = rest.slice(0, width);
    const boundary = candidate.lastIndexOf(' ');
    const cut = boundary > width / 2 ? boundary : width;
    result.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  result.push(rest);
  return result;
}

export type ApprovedPoPdfText = {
  number: string;
  revision: number;
  company: string;
  project: string;
  supplierLegalName: string;
  approvedAt: string;
  currency: string;
  lines: Array<{number: number; description: string; quantity: string; uom: string; unitPrice: string; amount: string}>;
  deliveryLocation: string | null;
  deliveryTerms: string | null;
  paymentTerms: string | null;
  creditTerms: string | null;
  subtotal: string;
  discount: string | null;
  freight: string | null;
  charges: string | null;
  vatPercent: string | null;
  total: string | null;
};

// Deterministic, printable, minimal PDF 1.4 with standard Helvetica base font.
// Intentionally refuses unsupported non-ASCII glyphs rather than generating a
// misleading supplier document. No use of untrusted raw PDF operators.
export function renderApprovedPoAsciiPdf(input: ApprovedPoPdfText): Buffer {
  const rows = [
    'PURCHASE ORDER - APPROVED',
    'Document: ' + input.number + ' | Revision: ' + input.revision,
    'Company: ' + input.company,
    'Project: ' + input.project,
    'Supplier (legal): ' + input.supplierLegalName,
    'Approval completed: ' + input.approvedAt,
    'Currency: ' + input.currency,
    '------------------------------------------------------------',
    'LINE | DESCRIPTION | QTY / UOM | UNIT PRICE | AMOUNT',
    ...input.lines.flatMap(line => [
      String(line.number) + ' | ' + line.description +
      ' | ' + line.quantity + ' ' + line.uom + ' | ' +
      line.unitPrice + ' | ' + line.amount,
    ]),
    '------------------------------------------------------------',
    'Subtotal: ' + input.subtotal,
    'Discount: ' + (input.discount ?? 'NOT SPECIFIED'),
    'Freight: ' + (input.freight ?? 'NOT SPECIFIED'),
    'Additional charges: ' + (input.charges ?? 'NOT SPECIFIED'),
    'VAT rate (%): ' + (input.vatPercent ?? 'NOT SPECIFIED'),
    'Total incl VAT: ' + (input.total ?? 'NOT CALCULATED (missing commercial inputs)'),
    'Delivery location: ' + (input.deliveryLocation ?? 'NOT SPECIFIED'),
    'Delivery terms: ' + (input.deliveryTerms ?? 'NOT SPECIFIED'),
    'Payment terms: ' + (input.paymentTerms ?? 'NOT SPECIFIED'),
    'Credit terms: ' + (input.creditTerms ?? 'NOT SPECIFIED'),
    'This document reflects one approved PO revision. External sending is manual.',
  ].flatMap(line => wrap(line));

  if (rows.length === 0 || rows.length > 5500) {
    throw new Error('PO_PDF_PAGE_LIMIT');
  }
  // Validate every glyph BEFORE writing any bytes, including all line text.
  rows.forEach(safePdfText);
  const perPage = 54;
  const pages: string[][] = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  if (pages.length > 110) throw new Error('PO_PDF_PAGE_LIMIT');

  const objects = new Map<number, Buffer>();
  objects.set(1, Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii'));
  objects.set(3, Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', 'ascii'));
  const kids = pages.map((_, i) => String(4 + i * 2) + ' 0 R').join(' ');
  objects.set(2, Buffer.from('<< /Type /Pages /Kids [ ' + kids + ' ] /Count ' + pages.length + ' >>', 'ascii'));

  for (let i = 0; i < pages.length; i++) {
    const pageId = 4 + i * 2, contentId = pageId + 1;
    const ops = [
      'BT', '/F1 9 Tf', '48 792 Td',
      ...pages[i]!.flatMap((line, j) =>
        j === 0 ? ['(' + safePdfText(line) + ') Tj'] :
          ['0 -13 Td', '(' + safePdfText(line) + ') Tj']),
      'ET',
    ].join('\n') + '\n';
    const bytes = Buffer.from(ops, 'ascii');
    objects.set(contentId, Buffer.concat([
      Buffer.from('<< /Length ' + bytes.length + ' >>\nstream\n', 'ascii'),
      bytes,
      Buffer.from('endstream', 'ascii'),
    ]));
    objects.set(pageId, Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 3 0 R >> >> /Contents ' + contentId + ' 0 R >>',
      'ascii',
    ));
  }

  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%ERP\n', 'ascii')];
  const offsets: number[] = [0];
  let offset = parts[0]!.length;
  const maxObject = 3 + pages.length * 2;
  for (let id = 1; id <= maxObject; id++) {
    const value = objects.get(id);
    if (!value) throw new Error('PO_PDF_OBJECT_MISSING');
    offsets[id] = offset;
    const obj = Buffer.concat([Buffer.from(id + ' 0 obj\n', 'ascii'), value, Buffer.from('\nendobj\n', 'ascii')]);
    parts.push(obj);
    offset += obj.length;
  }
  const xrefAt = offset;
  const xref = ['xref', '0 ' + (maxObject + 1), '0000000000 65535 f '];
  for (let id = 1; id <= maxObject; id++) {
    xref.push(String(offsets[id]).padStart(10, '0') + ' 00000 n ');
  }
  parts.push(Buffer.from(
    xref.join('\n') + '\ntrailer\n<< /Size ' + (maxObject + 1) +
    ' /Root 1 0 R >>\nstartxref\n' + xrefAt + '\n%%EOF\n',
    'ascii',
  ));
  return Buffer.concat(parts);
}

export function approvedPoPdfSha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
