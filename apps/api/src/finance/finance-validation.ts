import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

function invalid(field: string, message: string): never {
  throw new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors: [{ field, message }],
  });
}

export function financeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('body', 'Must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function financeString(
  input: Record<string, unknown>,
  field: string,
  max = 500,
): string {
  const value = input[field];
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    return invalid(field, 'Must be a non-empty string no longer than ' + max + ' characters.');
  }
  return value.trim();
}

export function financeNullableString(
  input: Record<string, unknown>,
  field: string,
  max = 5000,
): string | null {
  const value = input[field];
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > max) {
    return invalid(field, 'Must be null or a string no longer than ' + max + ' characters.');
  }
  return value.trim() || null;
}

export function financeUuid(
  input: Record<string, unknown>,
  field: string,
  nullable = false,
): string | null {
  const value = input[field];
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    return invalid(field, 'Must be a UUID.');
  }
  return value;
}

export function financeDate(
  input: Record<string, unknown>,
  field: string,
  nullable = false,
): Date | null {
  const value = input[field];
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return invalid(field, 'Must use YYYY-MM-DD.');
  }
  const date = new Date(value + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime())) return invalid(field, 'Must be a valid date.');
  return date;
}

export function financePositiveDecimal(
  input: Record<string, unknown>,
  field: string,
): Prisma.Decimal {
  const value = input[field];
  try {
    const decimal = new Prisma.Decimal(
      typeof value === 'number' || typeof value === 'string' ? value : '',
    );
    if (!decimal.isPositive()) return invalid(field, 'Must be greater than zero.');
    if (decimal.decimalPlaces() > 2) return invalid(field, 'Use at most 2 decimal places.');
    return decimal;
  } catch {
    return invalid(field, 'Must be a positive decimal amount.');
  }
}

export function financeArray(
  input: Record<string, unknown>,
  field: string,
): unknown[] {
  const value = input[field];
  if (!Array.isArray(value)) return invalid(field, 'Must be an array.');
  return value;
}

export function financeNonEmpty(value: Record<string, unknown>): void {
  if (Object.keys(value).length === 0) invalid('body', 'Provide at least one field to update.');
}
