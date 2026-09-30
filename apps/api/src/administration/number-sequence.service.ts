import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export const SEQUENCE_RESET_RULES = ['NONE', 'YEARLY', 'MONTHLY'] as const;
export type SequenceResetRule = (typeof SEQUENCE_RESET_RULES)[number];

const RESERVED_SEQUENCE_POLICIES = new Map<
  string,
  { formatTemplate: string; resetRule: SequenceResetRule }
>([
  [
    'SUBCONTRACT_AGREEMENT',
    {
      formatTemplate: 'SCYYMM-###',
      resetRule: 'MONTHLY',
    },
  ],
  [
    'SUBCONTRACT_CLAIM',
    {
      formatTemplate: 'SCLYYMM-###',
      resetRule: 'MONTHLY',
    },
  ],
]);

type LockedSequence = {
  id: string;
  format_template: string;
  reset_rule: string;
  last_period_key: string | null;
  next_value: number;
};

export function normalizeResetRule(value: string): SequenceResetRule {
  const normalized = value.toUpperCase();
  if (!SEQUENCE_RESET_RULES.includes(normalized as SequenceResetRule)) {
    throw new UnprocessableEntityException({
      code: 'VALIDATION_ERROR',
      detail: 'One or more fields are invalid.',
      errors: [
        {
          field: 'resetRule',
          message: 'Supported values are NONE, YEARLY and MONTHLY.',
        },
      ],
    });
  }
  return normalized as SequenceResetRule;
}

export function validateFormatTemplate(value: string): string {
  const groups = value.match(/#+/g) ?? [];
  if (
    groups.length !== 1 ||
    value.length > 120 ||
    !/^[A-Za-z0-9._/#-]+$/.test(value)
  ) {
    throw new UnprocessableEntityException({
      code: 'VALIDATION_ERROR',
      detail: 'One or more fields are invalid.',
      errors: [
        {
          field: 'formatTemplate',
          message:
            'Use a safe template containing exactly one # number group, for example POYYMM-###.',
        },
      ],
    });
  }
  return value;
}

export function formatBusinessNumber(
  template: string,
  sequenceValue: number,
  at: Date,
): string {
  const year = at.getUTCFullYear();
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(year).slice(-2);

  let output = template
    .replaceAll('YYYY', String(year))
    .replaceAll('YY', yy)
    .replaceAll('MM', month);

  output = output.replace(/#+/, (group) =>
    String(sequenceValue).padStart(group.length, '0'),
  );
  return output;
}

function periodKey(rule: SequenceResetRule, at: Date): string | null {
  const year = String(at.getUTCFullYear());
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');
  if (rule === 'YEARLY') return year;
  if (rule === 'MONTHLY') return year + month;
  return null;
}

@Injectable()
export class NumberSequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async next(
    companyId: string,
    sequenceCode: string,
    at = new Date(),
  ): Promise<string> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<LockedSequence[]>(Prisma.sql`
          SELECT
            "id",
            "format_template",
            "reset_rule",
            "last_period_key",
            "next_value"
          FROM "number_sequences"
          WHERE "company_id" = ${companyId}::uuid
            AND "sequence_code" = ${sequenceCode}
          FOR UPDATE
        `);

        const sequence = rows[0];
        if (!sequence) {
          throw new NotFoundException({
            code: 'NUMBER_SEQUENCE_NOT_FOUND',
            detail: 'Number sequence not found.',
          });
        }

        const resetRule = normalizeResetRule(sequence.reset_rule);
        const reservedPolicy = RESERVED_SEQUENCE_POLICIES.get(sequenceCode);
        if (
          reservedPolicy &&
          (sequence.format_template !== reservedPolicy.formatTemplate ||
            resetRule !== reservedPolicy.resetRule)
        ) {
          throw new ConflictException({
            code: 'NUMBER_SEQUENCE_POLICY_MISMATCH',
            detail:
              'This reserved number sequence does not match its approved format and reset policy.',
          });
        }
        const currentPeriod = periodKey(resetRule, at);
        if (
          currentPeriod !== null &&
          sequence.last_period_key !== null &&
          currentPeriod < sequence.last_period_key
        ) {
          throw new ConflictException({
            code: 'NUMBER_SEQUENCE_PERIOD_REGRESSION',
            detail:
              'A number sequence cannot allocate an identifier for an earlier reset period.',
          });
        }
        const shouldReset =
          currentPeriod !== null &&
          sequence.last_period_key !== null &&
          sequence.last_period_key < currentPeriod;
        const value = shouldReset ? 1 : sequence.next_value;

        const businessNumber = formatBusinessNumber(
          sequence.format_template,
          value,
          at,
        );

        await tx.numberSequence.update({
          where: { id: sequence.id },
          data: {
            nextValue: value + 1,
            lastPeriodKey: currentPeriod,
          },
        });

        return businessNumber;
      },
      // The sequence row is explicitly locked FOR UPDATE above. READ COMMITTED
      // lets a waiter observe the prior allocator's committed next_value instead
      // of retaining a stale SERIALIZABLE snapshot and failing with P2034.
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  assertCreatable(sequenceCode: string): void {
    if (RESERVED_SEQUENCE_POLICIES.has(sequenceCode)) {
      throw new ConflictException({
        code: 'NUMBER_SEQUENCE_RESERVED',
        detail:
          'This number-sequence code is reserved by an approved business numbering policy and cannot be created through generic administration.',
      });
    }
  }

  assertEditable(
    nextValue: number,
    lastPeriodKey: string | null,
    sequenceCode?: string,
  ): void {
    if (sequenceCode && RESERVED_SEQUENCE_POLICIES.has(sequenceCode)) {
      throw new ConflictException({
        code: 'NUMBER_SEQUENCE_RESERVED',
        detail:
          'This number sequence is reserved by an approved business numbering policy and cannot be edited.',
      });
    }
    if (nextValue > 1 || lastPeriodKey !== null) {
      throw new ConflictException({
        code: 'NUMBER_SEQUENCE_ALREADY_USED',
        detail:
          'A number sequence format cannot be changed after it has generated business numbers.',
      });
    }
  }
}
