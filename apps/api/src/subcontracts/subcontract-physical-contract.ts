import { Prisma } from '@prisma/client';
import { subcontractInvalid, subcontractObject } from './subcontract-validation';

export const PHYSICAL = 'subcontracts.physical.';
export type PhysicalObservation = {
  id: string;
  claimLineId: string;
  basis: 'MEASURED' | 'MILESTONE' | 'LUMP_SUM';
  item: string;
  location: string;
  basisDescription: string;
  quantity: string | null;
  uomId: string | null;
  progressPercent: string;
  reason: string;
  documentIds: string[];
  heldSourceId: string | null;
};
export type PhysicalDecisionLine = {
  observationId: string;
  claimLineId: string;
  acceptedQuantity: string | null;
  heldQuantity: string | null;
  accepted: boolean;
  acceptedAmount: string;
  heldDisposition: 'REWORK' | 'REJECTED' | null;
  reason: string;
};

function invalid(field: string): never {
  return subcontractInvalid(field, 'Provide an explicit valid physical source; quantities and money are separate.');
}
function text(value: unknown, field: string, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) return invalid(field);
  return value.trim();
}
export function physicalUuid(value: unknown, field: string): string {
  const id = text(value, field, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return invalid(field);
  return id.toLowerCase();
}
function decimal(value: unknown, field: string, scale: number, integerDigits: number, positive = false): string {
  // Input stays a string: binary floating point must never hide overprecision.
  if (typeof value !== 'string' || !new RegExp('^(?:0|[1-9]\\d{0,' + (integerDigits - 1) + '})(?:\\.\\d{1,' + scale + '})?$').test(value)) return invalid(field);
  const number = new Prisma.Decimal(value);
  if (positive && !number.gt(0)) return invalid(field);
  return number.toFixed(scale);
}
export function physicalCommand(value: unknown) {
  const input = subcontractObject(value);
  if (!Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 1) return invalid('expectedVersion');
  return {
    requestKey: physicalUuid(input.requestKey, 'requestKey'),
    expectedVersion: Number(input.expectedVersion),
    reason: text(input.reason, 'reason'),
  };
}

export function physicalCapture(value: unknown) {
  const input = subcontractObject(value), command = physicalCommand(value);
  if (!Array.isArray(input.observations) || !input.observations.length || input.observations.length > 100) return invalid('observations');
  const observations: PhysicalObservation[] = input.observations.map((value, index) => {
    const row = subcontractObject(value), field = 'observations.' + index;
    if (!['MEASURED', 'MILESTONE', 'LUMP_SUM'].includes(String(row.basis))) return invalid(field + '.basis');
    const measured = row.basis === 'MEASURED';
    if (!measured && (row.quantity != null || row.uomId != null)) return invalid(field + '.quantity');
    if (!Array.isArray(row.documentIds) || row.documentIds.length > 20) return invalid(field + '.documentIds');
    const documentIds = row.documentIds.map(id => physicalUuid(id, field + '.documentIds')).sort();
    if (new Set(documentIds).size !== documentIds.length) return invalid(field + '.documentIds');
    const progressPercent = decimal(row.progressPercent, field + '.progressPercent', 4, 3);
    if (new Prisma.Decimal(progressPercent).gt(100)) return invalid(field + '.progressPercent');
    return {
      id: physicalUuid(row.id, field + '.id'),
      claimLineId: physicalUuid(row.claimLineId, field + '.claimLineId'),
      basis: row.basis as PhysicalObservation['basis'],
      item: text(row.item, field + '.item'),
      location: text(row.location, field + '.location'),
      basisDescription: measured ? '' : text(row.basisDescription, field + '.basisDescription'),
      quantity: measured ? decimal(row.quantity, field + '.quantity', 4, 14, true) : null,
      uomId: measured ? physicalUuid(row.uomId, field + '.uomId') : null,
      progressPercent,
      reason: text(row.reason, field + '.reason'),
      documentIds,
      heldSourceId: row.heldSourceId == null ? null : physicalUuid(row.heldSourceId, field + '.heldSourceId'),
    };
  });
  if (new Set(observations.map(row => row.id)).size !== observations.length) return invalid('observations.id');
  return { ...command, observations: observations.sort((a, b) => a.id.localeCompare(b.id)) };
}

export function physicalDecision(value: unknown, observations: PhysicalObservation[], amounts: Map<string, string>) {
  const input = subcontractObject(value), command = physicalCommand(value);
  if (typeof input.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(input.sourceDigest)) return invalid('sourceDigest');
  if (!Array.isArray(input.decisions) || input.decisions.length !== observations.length || !observations.length) return invalid('decisions');
  const seen = new Set<string>(), allocations = new Map<string, Prisma.Decimal>();
  const decisions: PhysicalDecisionLine[] = input.decisions.map(value => {
    const row = subcontractObject(value), id = physicalUuid(row.observationId, 'observationId');
    const source = observations.find(item => item.id === id);
    if (!source || seen.has(id) || !amounts.has(source.claimLineId)) return invalid('observationId');
    seen.add(id);
    let acceptedQuantity: string | null = null, heldQuantity: string | null = null, accepted: boolean, held: boolean;
    if (source.basis === 'MEASURED') {
      if (row.accepted !== undefined) return invalid('accepted');
      acceptedQuantity = decimal(row.acceptedQuantity, 'acceptedQuantity', 4, 14);
      const acceptedNumber = new Prisma.Decimal(acceptedQuantity), submitted = new Prisma.Decimal(source.quantity!);
      if (acceptedNumber.gt(submitted)) return invalid('acceptedQuantity');
      heldQuantity = submitted.minus(acceptedNumber).toFixed(4);
      accepted = acceptedNumber.gt(0); held = new Prisma.Decimal(heldQuantity).gt(0);
    } else {
      if (typeof row.accepted !== 'boolean' || row.acceptedQuantity != null) return invalid('accepted');
      accepted = row.accepted; held = !accepted;
    }
    const acceptedAmount = decimal(row.acceptedAmount, 'acceptedAmount', 2, 16);
    if (!accepted && !new Prisma.Decimal(acceptedAmount).isZero()) return invalid('acceptedAmount');
    if (held ? !['REWORK', 'REJECTED'].includes(String(row.heldDisposition)) : row.heldDisposition != null) return invalid('heldDisposition');
    const total = (allocations.get(source.claimLineId) ?? new Prisma.Decimal(0)).plus(acceptedAmount);
    if (total.gt(new Prisma.Decimal(amounts.get(source.claimLineId)!))) return invalid('acceptedAmount');
    allocations.set(source.claimLineId, total);
    return {
      observationId: id, claimLineId: source.claimLineId, acceptedQuantity, heldQuantity, accepted, acceptedAmount,
      heldDisposition: held ? row.heldDisposition as 'REWORK' | 'REJECTED' : null,
      reason: text(row.reason, 'decisions.reason'),
    };
  });
  if (seen.size !== observations.length) return invalid('decisions');
  return {
    ...command, sourceDigest: input.sourceDigest,
    decisions: decisions.sort((a, b) => a.observationId.localeCompare(b.observationId)),
    assessedAmount: [...allocations.values()].reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0)).toFixed(2),
    hasAcceptedWork: decisions.some(row => row.accepted),
  };
}
