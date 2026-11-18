import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Only this approved source contract is public; never expose SQL/error text.
const physicalDatabaseCodes = new Set([
  'PHYSICAL_CURRENT_REVISION_REQUIRED',
  'PHYSICAL_OPERATION_SCOPE_INVALID',
  'PHYSICAL_ACCEPTED_AMOUNT_INVALID',
  'PHYSICAL_ACCEPTED_BASIS_INVALID',
  'PHYSICAL_ACCEPTED_QUANTITY_INVALID',
  'PHYSICAL_ACTIVE_REWORK_SOURCE_REQUIRES_CORRECTION',
  'PHYSICAL_ALL_LINES_REQUIRED',
  'PHYSICAL_BASIS_REQUIRED',
  'PHYSICAL_CAPTURE_DENIED',
  'PHYSICAL_CERTIFICATION_NOT_ELIGIBLE',
  'PHYSICAL_DECISION_INVALID',
  'PHYSICAL_DECISION_REQUIRED',
  'PHYSICAL_EVIDENCE_FROZEN',
  'PHYSICAL_EVIDENCE_REQUIRED',
  'PHYSICAL_HELD_ALLOCATION_INVALID',
  'PHYSICAL_HELD_BASIS_ALREADY_ASSIGNED',
  'PHYSICAL_HELD_QUANTITY_ALREADY_ASSIGNED',
  'PHYSICAL_HELD_SOURCE_INVALID',
  'PHYSICAL_HISTORY_IMMUTABLE',
  'PHYSICAL_INDEPENDENT_DECISION_REQUIRED',
  'PHYSICAL_MEASUREMENT_INVALID',
  'PHYSICAL_NEW_CLAIM_PROVENANCE_REQUIRED',
  'PHYSICAL_OBSERVATION_ID_REUSED',
  'PHYSICAL_OBSERVATION_INVALID',
  'PHYSICAL_POLICY_DENIED',
  'PHYSICAL_SOURCE_CHANGED',
  'PHYSICAL_SOURCE_FROZEN',
  'PHYSICAL_SUBMIT_DENIED',
]);
export function physicalSourceException(error: unknown): ConflictException | undefined {
  let databaseError: string;
  if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2004', 'P2010'].includes(error.code)) {
    databaseError = String(error.meta?.database_error ?? error.meta?.message ?? '');
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const database = error.message.match(/PostgresError \{ code: "(?:P0001|P1201)", message: "(PHYSICAL_[A-Z_]+)"/);
    if (!database) return;
    // Prisma may print source lines containing a different PHYSICAL_* literal
    // before its database error. Only the actual PostgreSQL message is public.
    databaseError = database[1]!;
  } else return;
  const code = databaseError.match(/\bPHYSICAL_[A-Z_]+\b/)?.[0];
  if (code && physicalDatabaseCodes.has(code)) return new ConflictException({
    code, detail: 'The physical source is frozen, changed or ineligible. Review its retained observations and correction history.',
  });
}
