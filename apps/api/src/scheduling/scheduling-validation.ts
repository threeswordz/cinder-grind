import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function schedulingInvalid(field: string, message: string) {
  return new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors: [{ field, message }],
  });
}

export function requireSchedulingObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw schedulingInvalid('body', 'Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export function requiredSchedulingString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string {
  const value = optionalSchedulingString(body, field, maxLength);
  if (value === undefined) throw schedulingInvalid(field, 'Is required.');
  return value;
}

export function optionalSchedulingString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw schedulingInvalid(field, 'Must be a string.');
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxLength) {
    throw schedulingInvalid(
      field,
      'Must be between 1 and ' + maxLength + ' characters.',
    );
  }
  return trimmed;
}

export function nullableSchedulingString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (body[field] === undefined) return undefined;
  if (body[field] === null) return null;
  return optionalSchedulingString(body, field, maxLength);
}

export function optionalSchedulingBoolean(
  body: Record<string, unknown>,
  field: string,
): boolean | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw schedulingInvalid(field, 'Must be a boolean.');
  }
  return value;
}

export function normalizeSchedulingCode(value: string, field: string): string {
  const normalized = value.toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(normalized)) {
    throw schedulingInvalid(
      field,
      'Use letters, numbers, dot, underscore or hyphen only.',
    );
  }
  return normalized;
}

export function validateSchedulingUuid(value: string, field: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw schedulingInvalid(field, 'Must be a valid UUID.');
  }
  return value;
}

export function nullableSchedulingUuid(
  body: Record<string, unknown>,
  field: string,
): string | null | undefined {
  if (body[field] === undefined) return undefined;
  if (body[field] === null || body[field] === '') return null;
  if (typeof body[field] !== 'string') {
    throw schedulingInvalid(field, 'Must be a UUID or null.');
  }
  return validateSchedulingUuid(body[field] as string, field);
}

export function parseSchedulingDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw schedulingInvalid(field, 'Use YYYY-MM-DD.');
  }
  const date = new Date(value + 'T00:00:00.000Z');
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw schedulingInvalid(field, 'Use a valid calendar date.');
  }
  return date;
}

export function optionalSchedulingDate(
  body: Record<string, unknown>,
  field: string,
): Date | undefined {
  if (body[field] === undefined) return undefined;
  return parseSchedulingDate(body[field], field);
}

export function nullableSchedulingDate(
  body: Record<string, unknown>,
  field: string,
): Date | null | undefined {
  if (body[field] === undefined) return undefined;
  if (body[field] === null || body[field] === '') return null;
  return parseSchedulingDate(body[field], field);
}

export function parseWorkDays(value: unknown, field: string): Prisma.Decimal {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(value))
  ) {
    throw schedulingInvalid(
      field,
      'Use a non-negative number with at most two decimal places.',
    );
  }
  const decimal = new Prisma.Decimal(String(value));
  if (decimal.isNegative()) {
    throw schedulingInvalid(field, 'Must not be negative.');
  }
  return decimal;
}

export function optionalWorkDays(
  body: Record<string, unknown>,
  field: string,
): Prisma.Decimal | undefined {
  if (body[field] === undefined) return undefined;
  return parseWorkDays(body[field], field);
}

export function parseTime(value: unknown, field: string): Date | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw schedulingInvalid(field, 'Use HH:MM in 24-hour time.');
  }
  return new Date('1970-01-01T' + value + ':00.000Z');
}

export function parseWeekdayNo(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 7) {
    throw schedulingInvalid(field, 'Use an integer from 1 (Monday) to 7 (Sunday).');
  }
  return Number(value);
}

export function parseDependencyType(value: unknown): 'FS' | 'SS' | 'FF' | 'SF' {
  if (value !== 'FS' && value !== 'SS' && value !== 'FF' && value !== 'SF') {
    throw schedulingInvalid('dependencyType', 'Use FS, SS, FF or SF.');
  }
  return value;
}

export function parseActiveFilter(value: string | undefined) {
  if (value === undefined || value === '' || value === 'all') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw schedulingInvalid('active', 'Use true, false or all.');
}

export function ensureSchedulingFields(data: Record<string, unknown>) {
  if (Object.keys(data).length === 0) {
    throw schedulingInvalid('body', 'Provide at least one field to update.');
  }
}
