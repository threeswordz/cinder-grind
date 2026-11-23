import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approvedPoPdfFilename,
  approvedPoPdfSha256,
  PoPdfUnsupportedTextError,
  renderApprovedPoAsciiPdf,
  type ApprovedPoPdfText,
} from './purchase-order-pdf';

const sample: ApprovedPoPdfText = {
  number: 'K-PO2611-001 ABC', revision: 0,
  company: 'MKE', project: 'SITE 001',
  supplierLegalName: 'ABC Concrete Company Limited',
  approvedAt: '2026-11-23T10:00:00Z',
  currency: 'THB',
  lines: [{number: 1,description:'Concrete',quantity:'2',uom:'EA',unitPrice:'1000',amount:'2000'}],
  deliveryLocation:'Site A',deliveryTerms:null,paymentTerms:'Net 30',creditTerms:null,
  subtotal:'2000.00',discount:'0.00',freight:'0.00',charges:'0.00',
  vatPercent:'7.00',total:'2140.00',
};

test('PUR07: stable exact short-name filenames, no path traversal or colliding revision names', () => {
  assert.equal(approvedPoPdfFilename('PO2611-001','T-PO2611-001 ABC',0),'T-PO2611-001 ABC.pdf');
  assert.equal(approvedPoPdfFilename('PO2611-001','T-PO2611-001 ABC',2),'T-PO2611-001 ABC-rev02.pdf');
  assert.equal(approvedPoPdfFilename('PO2611-001',null,0),'PO2611-001.pdf');
  assert.equal(approvedPoPdfFilename('PO2611-001','T-PO2611-001 บริษัท ทดสอบ',0),
    'T-PO2611-001 บริษัท ทดสอบ.pdf');
  assert.throws(() => approvedPoPdfFilename('PO2611-001','T-PO2611-001 ../secret',0));
  assert.throws(() => approvedPoPdfFilename('PO2611-001','T-PO2611-001 A/B',0));
  assert.throws(() => approvedPoPdfFilename('PO2611-001','T-PO2611-001 A\u202EEXE',0));
  assert.throws(() => approvedPoPdfFilename('PO2611-001','T-PO2611-001 ABC',-1));
});

test('PUR07: actual deterministic valid ASCII PDF structure and financial text', () => {
  const bytes = renderApprovedPoAsciiPdf(sample);
  assert.ok(bytes.subarray(0,8).toString('ascii').startsWith('%PDF-1.4'));
  assert.ok(bytes.toString('ascii').includes('ABC Concrete Company Limited'));
  assert.ok(bytes.toString('ascii').includes('Total incl VAT: 2140.00'));
  assert.ok(bytes.toString('ascii').includes('xref\n'));
  assert.ok(bytes.toString('ascii').endsWith('%%EOF\n'));
  assert.match(approvedPoPdfSha256(bytes),/^[a-f0-9]{64}$/u);
  assert.equal(approvedPoPdfSha256(bytes),approvedPoPdfSha256(renderApprovedPoAsciiPdf(sample)));
});

test('PUR07: Thai/Unicode legal names must fail closed rather than disappear from PDF', () => {
  assert.throws(() => renderApprovedPoAsciiPdf({
    ...sample,supplierLegalName:'บริษัท เซมิคอนกรีต จำกัด',
  }), PoPdfUnsupportedTextError);
  assert.throws(() => renderApprovedPoAsciiPdf({
    ...sample,lines:[{...sample.lines[0]!,description:'คอนกรีต'}],
  }), PoPdfUnsupportedTextError);
});
