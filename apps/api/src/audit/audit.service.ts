import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const SENSITIVE_KEY = /(password|token|secret|authorization|cookie|credential)/i;

export function sanitizeAuditValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return '[BINARY]';

  if (Array.isArray(value)) {
    return value.map((item) => {
      const sanitized = sanitizeAuditValue(item);
      return sanitized === undefined ? null : sanitized;
    });
  }

  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) {
        result[key] = '[REDACTED]';
        continue;
      }

      const sanitized = sanitizeAuditValue(item);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  }

  return undefined;
}

export type AuditRecordInput = {
  auth: AuthenticatedUserContext;
  entityType: string;
  entityId: string;
  action: string;
  correlationId?: string;
  oldValues?: unknown;
  newValues?: unknown;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: AuditRecordInput,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    const oldValues =
      input.oldValues === undefined
        ? undefined
        : (sanitizeAuditValue(input.oldValues) as Prisma.InputJsonValue);
    const newValues =
      input.newValues === undefined
        ? undefined
        : (sanitizeAuditValue(input.newValues) as Prisma.InputJsonValue);

    const db = client ?? this.prisma;

    await db.auditLog.create({
      data: {
        companyId: input.auth.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorUserId: input.auth.userId,
        ...(input.correlationId
          ? { correlationId: input.correlationId }
          : {}),
        ...(oldValues !== undefined ? { oldValues } : {}),
        ...(newValues !== undefined ? { newValues } : {}),
      },
    });
  }
}
