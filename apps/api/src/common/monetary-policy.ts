import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const policyDetails = {
  ERP_THB_COMPANY_REQUIRED: 'New monetary activity requires Company operating currency THB. Use the audited Company Settings action; existing sources retain their denomination.',
  ERP_THB_PROVENANCE_REQUIRED: 'New monetary activity requires verified THB source provenance. Historical foreign or unknown sources cannot be edited, approved, revised or reused as new THB business.',
  ERP_THB_PROVENANCE_IMMUTABLE: 'Retained monetary currency and source identity are immutable. No relabelling or currency conversion is supported.',
} as const;

// Match only our database contract and a Prisma database error. Do not expose
// SQL, credentials or arbitrary exception text in a public API response.
export function monetaryPolicyException(error: unknown): UnprocessableEntityException | undefined {
  let databaseError: string;
  if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2004','P2010'].includes(error.code)) {
    databaseError = String(error.meta?.database_error ?? error.meta?.message ?? '');
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError &&
    /PostgresError \{ code: "P1201", message: "ERP_THB_[A-Z_]+"/.test(error.message)) {
    databaseError = error.message;
  } else return;
  for (const [code, detail] of Object.entries(policyDetails)) {
    if (databaseError.includes(code)) return new UnprocessableEntityException({ code, detail });
  }
}
