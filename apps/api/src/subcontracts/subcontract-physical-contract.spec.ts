import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { physicalCapture, physicalDecision } from './subcontract-physical-contract';
import { Prisma } from '@prisma/client';
import { physicalSourceException } from '../common/physical-source-error';

test('only the actual PostgreSQL physical error is mapped, irrespective of Prisma source excerpts', () => {
  const error = new Prisma.PrismaClientUnknownRequestError(
    'Invocation excerpt: PHYSICAL_EVIDENCE_CHANGED_DURING_SUBMIT\n' +
    'PostgresError { code: "P0001", message: "PHYSICAL_HELD_QUANTITY_ALREADY_ASSIGNED", severity: "ERROR" }',
    { clientVersion: '6.19.3' },
  );
  assert.equal((physicalSourceException(error)?.getResponse() as { code: string }).code, 'PHYSICAL_HELD_QUANTITY_ALREADY_ASSIGNED');
  assert.equal(physicalSourceException(new Error('PHYSICAL_HELD_QUANTITY_ALREADY_ASSIGNED')), undefined);
});

function source() {
  const lineId = randomUUID(), observationId = randomUUID();
  const body = { requestKey: randomUUID(), expectedVersion: 1, reason: 'Actual work captured', observations: [{
    id: observationId, claimLineId: lineId, basis: 'MEASURED', item: 'Installed work', location: 'Area A',
    quantity: '10', uomId: randomUUID(), progressPercent: '80', reason: 'Measured on site', documentIds: [randomUUID()],
  }] };
  const capture = physicalCapture(body);
  const decision = { requestKey: randomUUID(), expectedVersion: 2, reason: 'Independent physical decision', sourceDigest: 'a'.repeat(64),
    decisions: [{ observationId, acceptedQuantity: '8', acceptedAmount: '731.25', heldDisposition: 'REWORK', reason: 'Two units require rework' }] };
  return { body, capture, decision, amounts: new Map([[lineId, '1000.00']]) };
}

test('physical partial acceptance retains explicit money and held quantities without price proration', () => {
  const f = source(), result = physicalDecision(f.decision, f.capture.observations, f.amounts);
  assert.equal(result.assessedAmount, '731.25');
  assert.equal(result.decisions[0]!.acceptedQuantity, '8.0000');
  assert.equal(result.decisions[0]!.heldQuantity, '2.0000');
  assert.equal(result.decisions[0]!.heldDisposition, 'REWORK');
  assert.equal(result.hasAcceptedWork, true);
  f.decision.decisions[0]!.acceptedAmount = '0';
  assert.equal(physicalDecision(f.decision, f.capture.observations, f.amounts).assessedAmount, '0.00');
});

test('physical decisions reject missing, duplicate, overaccepted, unaccepted-money and overallocated sources', () => {
  const f = source();
  for (const mutate of [
    (d: typeof f.decision) => { d.decisions = []; },
    (d: typeof f.decision) => { d.decisions[0]!.observationId = randomUUID(); },
    (d: typeof f.decision) => { d.decisions[0]!.acceptedQuantity = '10.0001'; },
    (d: typeof f.decision) => { d.decisions[0]!.acceptedQuantity = '0'; },
    (d: typeof f.decision) => { d.decisions[0]!.acceptedAmount = '1000.01'; },
    (d: typeof f.decision) => { d.decisions[0]!.acceptedAmount = '731.251'; },
    (d: typeof f.decision) => { d.decisions[0]!.heldDisposition = 'COMPLETE'; },
  ]) {
    const altered = structuredClone(f.decision); mutate(altered);
    assert.throws(() => physicalDecision(altered, f.capture.observations, f.amounts));
  }
  const additional = { ...f.capture.observations[0]!, id: randomUUID() };
  const decisions = { ...f.decision, decisions: [f.decision.decisions[0]!, { ...f.decision.decisions[0]!, observationId: additional.id }] };
  assert.throws(() => physicalDecision(decisions, [...f.capture.observations, additional], f.amounts));
});

test('physical capture refuses binary-number/overprecision/duplicate facts and invented measurable units', () => {
  const f = source();
  for (const [key, value] of [['quantity', 10], ['quantity', '1.00001'], ['quantity', '100000000000000'],
    ['progressPercent', '100.0001'], ['uomId', null], ['basis', 'UNKNOWN']] as const) {
    const altered = structuredClone(f.body) as unknown as { observations: Record<string, unknown>[] };
    altered.observations[0]![key] = value; assert.throws(() => physicalCapture(altered));
  }
  const duplicate = structuredClone(f.body); duplicate.observations.push(duplicate.observations[0]!);
  assert.throws(() => physicalCapture(duplicate));
});

test('milestone and lump-sum acceptance retain explicit basis without inventing a unit or rate', () => {
  for (const basis of ['MILESTONE', 'LUMP_SUM']) {
    const f = source(), body = structuredClone(f.body) as unknown as { observations: Record<string, unknown>[] };
    Object.assign(body.observations[0]!, { basis, quantity: null, uomId: null, basisDescription: 'Named completion stage' });
    const capture = physicalCapture(body), observationId = capture.observations[0]!.id;
    const result = physicalDecision({ ...f.decision, decisions: [{ observationId, accepted: true, acceptedAmount: '125.10', reason: 'Explicit basis accepted' }] }, capture.observations, f.amounts);
    assert.equal(result.assessedAmount, '125.10'); assert.equal(result.decisions[0]!.acceptedQuantity, null);
    const held = physicalDecision({ ...f.decision, decisions: [{ observationId, accepted: false, acceptedAmount: '0', heldDisposition: 'REWORK', reason: 'Basis not complete' }] }, capture.observations, f.amounts);
    assert.equal(held.hasAcceptedWork, false); assert.equal(held.assessedAmount, '0.00');
  }
});
