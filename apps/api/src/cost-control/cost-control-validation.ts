import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

function invalid(field: string, message: string): never {
  throw new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors: [{ field, message }],
  });
}

export function costObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('body', 'Must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function costString(
  input: Record<string, unknown>,
  field: string,
  max = 500,
): string {
  const value = input[field];
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    return invalid(
      field,
      'Must be a non-empty string no longer than ' + max + ' characters.',
    );
  }
  return value.trim();
}

export function costNullableString(
  input: Record<string, unknown>,
  field: string,
  max = 5000,
): string | null {
  const value = input[field];
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > max) {
    return invalid(
      field,
      'Must be null or a string no longer than ' + max + ' characters.',
    );
  }
  return value.trim() || null;
}

export function costUuid(
  input: Record<string, unknown>,
  field: string,
  nullable = false,
): string | null {
  const value = input[field];
  if (
    nullable &&
    (value === null || value === undefined || value === '')
  ) {
    return null;
  }
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return invalid(field, 'Must be a UUID.');
  }
  return value;
}

export function costDate(
  input: Record<string, unknown>,
  field: string,
): Date {
  const value = input[field];
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return invalid(field, 'Must use YYYY-MM-DD.');
  }
  const date = new Date(value + 'T00:00:00.000Z');
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return invalid(field, 'Must be a valid calendar date.');
  }
  return date;
}

export function costPositiveDecimal(
  input: Record<string, unknown>,
  field: string,
): Prisma.Decimal {
  const value = input[field];
  if (
    typeof value !== 'string' ||
    !/^\d{1,16}(?:\.\d{1,2})?$/.test(value)
  ) {
    return invalid(
      field,
      'Must be an exact positive decimal string with up to 16 integer digits and 2 decimal places.',
    );
  }
  try {
    const decimal = new Prisma.Decimal(value);
    if (!decimal.isPositive()) {
      return invalid(field, 'Must be greater than zero.');
    }
    return decimal;
  } catch {
    return invalid(field, 'Must be a valid positive decimal string.');
  }
}

export function costNonEmpty(value: Record<string, unknown>): void {
  if (Object.keys(value).length === 0) {
    invalid('body', 'Provide at least one field to update.');
  }
}


export function costNonNegativeDecimal(
  input: Record<string, unknown>,
  field: string,
): Prisma.Decimal {
  const value = input[field];
  if (
    typeof value !== 'string' ||
    !/^\d{1,16}(?:\.\d{1,2})?$/.test(value)
  ) {
    return invalid(
      field,
      'Must be an exact non-negative decimal string with up to 16 integer digits and 2 decimal places.',
    );
  }
  try {
    const decimal = new Prisma.Decimal(value);
    if (decimal.isNegative()) {
      return invalid(field, 'Must be zero or greater.');
    }
    return decimal;
  } catch {
    return invalid(field, 'Must be a valid non-negative decimal string.');
  }
}

export function costArray(
  input: Record<string, unknown>,
  field: string,
  max = 500,
): Record<string, unknown>[] {
  const value = input[field];
  if (!Array.isArray(value) || value.length > max) {
    return invalid(field, 'Must be an array containing no more than ' + max + ' items.');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return invalid(field + '[' + index + ']', 'Must be a JSON object.');
    }
    return item as Record<string, unknown>;
  });
}
