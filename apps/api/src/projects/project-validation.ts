import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function projectInvalid(field: string, message: string) {
  return new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors: [{ field, message }],
  });
}

export function requireProjectObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw projectInvalid('body', 'Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export function requiredProjectString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string {
  const value = optionalProjectString(body, field, maxLength);
  if (value === undefined) throw projectInvalid(field, 'Is required.');
  return value;
}

export function optionalProjectString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw projectInvalid(field, 'Must be a string.');
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxLength) {
    throw projectInvalid(
      field,
      'Must be between 1 and ' + maxLength + ' characters.',
    );
  }
  return trimmed;
}

export function nullableProjectString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (body[field] === undefined) return undefined;
  if (body[field] === null) return null;
  return optionalProjectString(body, field, maxLength);
}

export function optionalProjectBoolean(
  body: Record<string, unknown>,
  field: string,
): boolean | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw projectInvalid(field, 'Must be a boolean.');
  }
  return value;
}

export function normalizeProjectCode(
  value: string,
  field = 'projectCode',
): string {
  const normalized = value.toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(normalized)) {
    throw projectInvalid(
      field,
      'Use letters, numbers, dot, underscore or hyphen only.',
    );
  }
  return normalized;
}

export function validateProjectUuid(value: string, field: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw projectInvalid(field, 'Must be a valid UUID.');
  }
  return value;
}

export function validateProjectEmail(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined || value === null) return value;
  const normalized = value.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(normalized)) {
    throw projectInvalid('email', 'Enter a valid email address.');
  }
  return normalized;
}

export function parseProjectDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw projectInvalid(field, 'Use YYYY-MM-DD.');
  }

  const date = new Date(value + 'T00:00:00.000Z');
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw projectInvalid(field, 'Use a valid calendar date.');
  }
  return date;
}

export function optionalProjectDate(
  body: Record<string, unknown>,
  field: string,
): Date | undefined {
  if (body[field] === undefined) return undefined;
  return parseProjectDate(body[field], field);
}

export function nullableProjectDate(
  body: Record<string, unknown>,
  field: string,
): Date | null | undefined {
  if (body[field] === undefined) return undefined;
  if (body[field] === null) return null;
  return parseProjectDate(body[field], field);
}

export function parseContractValue(value: unknown): Prisma.Decimal {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(value))
  ) {
    throw projectInvalid(
      'contractValue',
      'Use a non-negative amount with at most two decimal places.',
    );
  }

  const decimal = new Prisma.Decimal(String(value));
  if (decimal.isNegative()) {
    throw projectInvalid('contractValue', 'Must not be negative.');
  }
  return decimal;
}

export function parseProjectActive(value: string | undefined) {
  if (value === undefined || value === '' || value === 'all') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw projectInvalid('active', 'Use true, false or all.');
}

export function parseProjectSearch(value: string | undefined) {
  if (value === undefined || value.trim() === '') return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 200) {
    throw projectInvalid('search', 'Search is too long.');
  }
  return trimmed;
}
