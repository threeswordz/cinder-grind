import assert from 'node:assert/strict';
import test from 'node:test';

import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  CustomerBoqCostSource,
  CustomerBoqPricingLine,
  priceCustomerBoq,
} from './customer-boq-pricing';

const scope = { companyId: 'company-a', projectId: 'project-a' };

function source(amount = '1000'): CustomerBoqCostSource {
  return {
    ...scope,
    revisionId: 'approved-revision-a',
    approvalState: 'APPROVED',
    currencyCode: 'THB',
    lines: [{ id: 'source-a', quantity: '10', uomId: 'EA', rate: '100', amount }],
  };
}

function line(patch: Partial<CustomerBoqPricingLine> = {}): CustomerBoqPricingLine {
  return {
    lineId: 'customer-a',
    quantity: '10',
    uomId: 'EA',
    uomDecimalPlaces: 4,
    method: 'MARKUP',
    ...(patch.method === 'MANUAL' ? { manualRate: '120' } : { markupPercent: '20' }),
    mappingReason: 'Explicit selection of approved cost source and customer scope.',
    mappings: [{ sourceLineId: 'source-a', sharePercent: '100' }],
    ...patch,
  };
}

function invalid(run: () => unknown) {
  assert.throws(run, UnprocessableEntityException);
}

test('E1 manual and markup retain approved source identity and give the same 1,200.00 line', () => {
  for (const method of ['MANUAL', 'MARKUP'] as const) {
    const result = priceCustomerBoq(scope, source(), [line({ method })]);
    assert.equal(result.totalAmount, '1200.00');
    assert.equal(result.sourceRevisionId, 'approved-revision-a');
    assert.equal(result.lines[0]!.rate, '120.0000');
    assert.equal(result.lines[0]!.costBasis, '1000.0000000000');
    assert.equal(result.lines[0]!.mappings[0]!.sourceLineId, 'source-a');
    assert.equal(result.currencyCode, 'THB');
  }
});

test('E2 roll-up retains different source UOMs and explicit customer L/S without conversion', () => {
  const cost = source();
  cost.lines = [
    ...cost.lines,
    { id: 'source-b', quantity: '5', uomId: 'M2', rate: '100', amount: '500' },
  ];
  const result = priceCustomerBoq(scope, cost, [line({
    quantity: '1', uomId: 'LS',
    mappings: [
      { sourceLineId: 'source-a', sharePercent: '100' },
      { sourceLineId: 'source-b', sharePercent: '100' },
    ],
  })]);
  assert.equal(result.totalAmount, '1800.00');
  assert.equal(result.lines[0]!.rate, '1800.0000');
  assert.deepEqual(result.lines[0]!.mappings.map(m => m.sourceSnapshot.uomId), ['EA', 'M2']);
  assert.deepEqual(result.lines[0]!.mappings.map(m => m.sourceSnapshot.quantity), ['10.0000', '5.0000']);
});

test('E3 split allocates source cost once, exposes unused coverage and rejects excess', () => {
  const first = line({ quantity: '6', mappings: [{ sourceLineId: 'source-a', sharePercent: '60' }] });
  const second = line({ lineId: 'customer-b', quantity: '4', mappings: [{ sourceLineId: 'source-a', sharePercent: '40' }] });
  const result = priceCustomerBoq(scope, source(), [first, second]);
  assert.deepEqual(result.lines.map(l => [l.costBasis, l.rate, l.amount]), [
    ['600.0000000000', '120.0000', '720.00'],
    ['400.0000000000', '120.0000', '480.00'],
  ]);
  assert.equal(result.totalAmount, '1200.00');
  assert.equal(result.sourceCoverage[0]!.allocatedPercent, '100.0000');
  assert.equal(result.sourceCoverage[0]!.unallocatedPercent, '0.0000');
  assert.equal(priceCustomerBoq(scope, source(), [first]).sourceCoverage[0]!.unallocatedPercent, '40.0000');
  invalid(() => priceCustomerBoq(scope, source(), [first, second, line({ lineId: 'extra' })]));
});

test('E4 stored four-place derived rate produces a 100.00 line', () => {
  const result = priceCustomerBoq(scope, source('100'), [line({ quantity: '3', markupPercent: '0' })]);
  assert.equal(result.lines[0]!.rate, '33.3333');
  assert.equal(result.totalAmount, '100.00');
});

test('E5 reports the adopted rate-first discrepancy without adjusting 0.99 to 1.00', () => {
  const result = priceCustomerBoq(scope, source('1'), [line({ quantity: '300', markupPercent: '0' })]);
  assert.equal(result.lines[0]!.rate, '0.0033');
  assert.equal(result.totalAmount, '0.99');
  assert.equal(result.lines[0]!.targetAmount, '1.00');
  assert.equal(result.lines[0]!.rateRoundingDifference, '-0.01');
});

test('E6 fractional quantity rounds the exact 1.255 product half-up to 1.26', () => {
  const input = line({ method: 'MANUAL', quantity: '0.1250', manualRate: '10.0400' });
  assert.equal(priceCustomerBoq(scope, source(), [input]).totalAmount, '1.26');
  invalid(() => priceCustomerBoq(scope, source(), [{ ...input, uomDecimalPlaces: 0 }]));
});

test('E7 explicit free rate needs a reason and a source link; missing price is not zero', () => {
  const input = line({ method: 'MANUAL', quantity: '1', manualRate: '0', zeroPriceReason: 'Included in the agreed package.' });
  const result = priceCustomerBoq(scope, source(), [input]);
  assert.equal(result.totalAmount, '0.00');
  assert.equal(result.lines[0]!.mappings.length, 1);
  const noReason = { ...input }; delete noReason.zeroPriceReason;
  const noPrice = { ...input }; delete noPrice.manualRate;
  invalid(() => priceCustomerBoq(scope, source(), [noReason]));
  invalid(() => priceCustomerBoq(scope, source(), [noPrice]));
  invalid(() => priceCustomerBoq(scope, source(), [{ ...input, mappings: [] }]));
});

test('E8 changed manual price retains the prior rate/reason for caller-owned audit', () => {
  const input = line({ method: 'MANUAL', manualRate: '115', previousRate: '120', pricingReason: 'Negotiated discount.' });
  const result = priceCustomerBoq(scope, source(), [input]);
  assert.equal(result.totalAmount, '1150.00');
  assert.equal(result.lines[0]!.previousRate, '120.0000');
  assert.equal(result.lines[0]!.pricingReason, 'Negotiated discount.');
  const unexplained = { ...input }; delete unexplained.pricingReason;
  invalid(() => priceCustomerBoq(scope, source(), [unexplained]));
});

test('approved-zero source is usable with an explicit free-line reason; missing/submitted source is not zero', () => {
  const input = line({ zeroPriceReason: 'Included, with approved zero cost.' });
  assert.equal(priceCustomerBoq(scope, source('0'), [input]).totalAmount, '0.00');
  assert.equal(priceCustomerBoq(scope, source('0'), [line({ method: 'MANUAL', manualRate: '5' })]).totalAmount, '50.00');
  const noReason = { ...input }; delete noReason.zeroPriceReason;
  invalid(() => priceCustomerBoq(scope, source('0'), [noReason]));
  invalid(() => priceCustomerBoq(scope, null, [input]));
  invalid(() => priceCustomerBoq(scope, { ...source(), approvalState: 'SUBMITTED' }, [input]));
});

test('foreign/NULL provenance and different Company/Project sources fail without mutation', () => {
  invalid(() => priceCustomerBoq({ ...scope, companyId: '' }, source(), [line()]));
  invalid(() => priceCustomerBoq({ ...scope, projectId: '' }, source(), [line()]));
  for (const patch of [
    { currencyCode: 'SGD' }, { currencyCode: null }, { companyId: 'company-b' }, { projectId: 'project-b' },
  ]) {
    const cost = { ...source(), ...patch };
    const before = JSON.stringify(cost);
    invalid(() => priceCustomerBoq(scope, cost, [line()]));
    assert.equal(JSON.stringify(cost), before);
  }
});

test('unknown/cross-revision source IDs, repeated mapping IDs and repeated customer IDs fail', () => {
  invalid(() => priceCustomerBoq(scope, source(), [line({ mappings: [{ sourceLineId: 'another-revision-line', sharePercent: '100' }] })]));
  invalid(() => priceCustomerBoq(scope, source(), [line({ mappings: [
    { sourceLineId: 'source-a', sharePercent: '50' }, { sourceLineId: 'source-a', sharePercent: '50' },
  ] })]));
  invalid(() => priceCustomerBoq(scope, source(), [line(), line()]));
  const cost = source(); cost.lines = [...cost.lines, { ...cost.lines[0]! }];
  invalid(() => priceCustomerBoq(scope, cost, [line()]));
});

test('independent UOM/quantity, partial coverage and split/roll-up require mapping rationale', () => {
  const input = line(); delete input.mappingReason;
  assert.equal(priceCustomerBoq(scope, source(), [input]).totalAmount, '1200.00');
  for (const patch of [
    { uomId: 'LS' }, { quantity: '5' },
    { mappings: [{ sourceLineId: 'source-a', sharePercent: '50' }] },
  ]) invalid(() => priceCustomerBoq(scope, source(), [{ ...input, ...patch }]));
});

test('source allocation preserves all ten fractional places without early money rounding', () => {
  const result = priceCustomerBoq(scope, source('0.0001'), [line({
    method: 'MANUAL', manualRate: '1',
    mappings: [{ sourceLineId: 'source-a', sharePercent: '0.0001' }],
  })]);
  assert.equal(result.lines[0]!.costBasis, '0.0000000001');
  assert.equal(result.lines[0]!.mappings[0]!.allocatedCost, '0.0000000001');
  assert.equal(result.sourceCoverage[0]!.unallocatedPercent, '99.9999');
});

test('markup-derived rate uses half-up at the fourth decimal', () => {
  const result = priceCustomerBoq(scope, source('0.0001'), [line({
    quantity: '1', markupPercent: '0', mappings: [{ sourceLineId: 'source-a', sharePercent: '50' }],
  })]);
  assert.equal(result.lines[0]!.rate, '0.0001');
});

test('total sums stored rounded lines: two 1.255 products total 2.52, not 2.51', () => {
  const first = line({ method: 'MANUAL', quantity: '0.1250', manualRate: '10.0400', mappings: [{ sourceLineId: 'source-a', sharePercent: '50' }] });
  const result = priceCustomerBoq(scope, source(), [first, { ...first, lineId: 'customer-b' }]);
  assert.deepEqual(result.lines.map(l => l.amount), ['1.26', '1.26']);
  assert.equal(result.totalAmount, '2.52');
});

test('approved stored cost amount is used without recalculating quantity times rate', () => {
  const result = priceCustomerBoq(scope, source('1000.0001'), [line()]);
  assert.equal(result.lines[0]!.costBasis, '1000.0001000000');
  assert.equal(result.lines[0]!.mappings[0]!.sourceSnapshot.amount, '1000.0001');
});

test('monetary strings retain more precision than JavaScript numbers and do not change global Decimal settings', () => {
  const precision = Prisma.Decimal.precision;
  const result = priceCustomerBoq(scope, source(), [line({ method: 'MANUAL', quantity: '1', manualRate: '90071992547409.9999' })]);
  assert.equal(result.lines[0]!.rate, '90071992547409.9999');
  assert.equal(result.totalAmount, '90071992547410.00');
  assert.equal(Prisma.Decimal.precision, precision);
});

test('invalid decimal forms, excess precision and nonpositive quantities fail explicitly', () => {
  for (const quantity of ['0', '-1', '0.00001', '1e3', 'NaN', 'Infinity', '', ' 1 ', '100000000000000']) {
    invalid(() => priceCustomerBoq(scope, source(), [line({ quantity })]));
  }
  invalid(() => priceCustomerBoq(scope, source(), [line({ quantity: 1 as unknown as string })]));
  invalid(() => priceCustomerBoq(scope, source(), [line({ method: 'MANUAL', manualRate: '-1' })]));
  invalid(() => priceCustomerBoq(scope, source(), [line({ method: 'MANUAL', manualRate: '1.00001' })]));
  invalid(() => priceCustomerBoq(scope, source(), [line({ markupPercent: '-1' })]));
  invalid(() => priceCustomerBoq(scope, source(), [line({ markupPercent: '1.00001' })]));
});

test('invalid source shares and calculated storage overflow fail instead of rounding or wrapping', () => {
  for (const sharePercent of ['0', '-1', '100.0001', '101', '1.00001', 'NaN', '']) {
    invalid(() => priceCustomerBoq(scope, source(), [line({ mappings: [{ sourceLineId: 'source-a', sharePercent }] })]));
  }
  invalid(() => priceCustomerBoq(scope, source('9999999999999999.9999'), [line({ quantity: '0.0001', markupPercent: '20' })]));
  invalid(() => priceCustomerBoq(scope, source(), [line({ method: 'MANUAL', quantity: '99999999999999.9999', manualRate: '99999999999999.9999' })]));
});

test('UOM precision is capped at four and must be a nonnegative integer', () => {
  assert.equal(priceCustomerBoq(scope, source(), [line({ quantity: '0.1234', uomDecimalPlaces: 6 })]).lines[0]!.quantity, '0.1234');
  for (const uomDecimalPlaces of [-1, 0.5, NaN]) {
    invalid(() => priceCustomerBoq(scope, source(), [line({ uomDecimalPlaces })]));
  }
});

test('mixed pricing inputs, unsupported gross-margin method and empty versions fail', () => {
  invalid(() => priceCustomerBoq(scope, source(), [line({ manualRate: '120' })]));
  invalid(() => priceCustomerBoq(scope, source(), [line({ method: 'MANUAL', markupPercent: '20' })]));
  invalid(() => priceCustomerBoq(scope, source(), [line({ method: 'GROSS_MARGIN' as 'MARKUP' })]));
  invalid(() => priceCustomerBoq(scope, source(), []));
});

test('calculation and result mutation cannot alter caller-owned approved snapshots or Draft inputs', () => {
  const cost = source(); const input = line();
  const before = JSON.stringify({ cost, input });
  const result = priceCustomerBoq(scope, cost, [input]);
  result.lines[0]!.mappings[0]!.sourceSnapshot.amount = '999';
  assert.equal(JSON.stringify({ cost, input }), before);
});
