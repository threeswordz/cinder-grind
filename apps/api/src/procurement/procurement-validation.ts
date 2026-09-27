import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function procurementInvalid(field: string, message: string): never {
  throw new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors: [{ field, message }],
  });
}

export function procurementObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return procurementInvalid('body', 'A JSON object is required.');
  }
  return value as Record<string, unknown>;
}

export function procurementString(
  input: Record<string, unknown>,
  field: string,
  maxLength: number,
): string {
  const value = input[field];
  if (typeof value !== 'string' || !value.trim()) {
    return procurementInvalid(field, 'A non-empty string is required.');
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    return procurementInvalid(field, `Maximum length is ${maxLength} characters.`);
  }
  return normalized;
}

export function procurementNullableString(
  input: Record<string, unknown>,
  field: string,
  maxLength: number,
): string | null | undefined {
  const value = input[field];
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    return procurementInvalid(field, 'A string or null is required.');
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    return procurementInvalid(field, `Maximum length is ${maxLength} characters.`);
  }
  return normalized || null;
}

export function procurementUuid(
  value: unknown,
  field: string,
  nullable = false,
): string | null {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    return procurementInvalid(field, 'A valid UUID is required.');
  }
  return value;
}

export function procurementDecimal(value: unknown, field: string): Prisma.Decimal {
  try {
    const decimal = new Prisma.Decimal(
      typeof value === 'number' || typeof value === 'string' ? value : '',
    );
    if (!decimal.isFinite() || decimal.lte(0)) {
      return procurementInvalid(field, 'A value greater than zero is required.');
    }
    if (decimal.decimalPlaces() > 4) {
      return procurementInvalid(field, 'Maximum precision is 4 decimal places.');
    }
    return decimal;
  } catch {
    return procurementInvalid(field, 'A valid decimal value is required.');
  }
}

export function procurementLineType(value: unknown): 'MATERIAL' | 'SERVICE' {
  if (value !== 'MATERIAL' && value !== 'SERVICE') {
    return procurementInvalid('lineType', 'Supported values are MATERIAL and SERVICE.');
  }
  return value;
}

export function procurementDate(
  value: unknown,
  field: string,
  nullable = true,
): Date | null {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return procurementInvalid(field, 'Use YYYY-MM-DD.');
  }
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return procurementInvalid(field, 'Use a valid calendar date in YYYY-MM-DD format.');
  }
  return date;
}

export function procurementNonEmpty(value: Record<string, unknown>): void {
  if (!Object.keys(value).length) {
    procurementInvalid('body', 'Provide at least one field to update.');
  }
}
