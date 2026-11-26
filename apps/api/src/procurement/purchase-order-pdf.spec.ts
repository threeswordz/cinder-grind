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
  assert.equal(approvedPoPdfFilename('PO2611-001','T-PO2611-001 ../secret',0),'T-PO2611-001 .._secret.pdf');
  assert.equal(approvedPoPdfFilename('PO2611-001','T-PO2611-001 A/B',0),'T-PO2611-001 A_B.pdf');
  assert.equal(approvedPoPdfFilename('PO2611-001','T-PO2611-001 A\u202EEXE',0),'T-PO2611-001 A_EXE.pdf');
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

test('PUR07: accepted punctuation and long Thai names produce bounded safe filenames', () => {
  assert.equal(approvedPoPdfFilename('PO2611-001','K-PO2611-001 A&B',0),'K-PO2611-001 A_B.pdf');
  const display = 'T-PO2611-001 ' + 'ท'.repeat(100);
  const filename = approvedPoPdfFilename('PO2611-001',display,2);
  assert.ok(Buffer.byteLength(filename,'utf8') <= 210);
  assert.ok(filename.endsWith('-rev02.pdf'));
  assert.ok(!filename.includes('�'));
  assert.equal(display,'T-PO2611-001 ' + 'ท'.repeat(100));
});

test('PUR07: supplementary legal names and descriptions must reach Unicode rendering', () => {
  for (const character of ['𠮷', '😀', '\u{10000}', '\u{10ffff}']) {
    assert.throws(() => renderApprovedPoAsciiPdf({...sample,supplierLegalName:'Supplier ' + character}), PoPdfUnsupportedTextError);
    assert.throws(() => renderApprovedPoAsciiPdf({...sample,lines:[{...sample.lines[0]!,description:'Material ' + character}]}), PoPdfUnsupportedTextError);
  }
});
