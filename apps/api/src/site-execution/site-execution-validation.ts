import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function siteInvalid(field: string, message: string): never {
  throw new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more Site Execution fields are invalid.',
    errors: [{ field, message }],
  });
}

export function siteObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return siteInvalid('body', 'Must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function siteString(
  input: Record<string, unknown>,
  field: string,
  max: number,
  required = true,
): string | null | undefined {
  const value = input[field];
  if (value === undefined) {
    if (required) return siteInvalid(field, 'Is required.');
    return undefined;
  }
  if (value === null || value === '') {
    if (required) return siteInvalid(field, 'Is required.');
    return null;
  }
  if (typeof value !== 'string') {
    return siteInvalid(field, 'Must be a string.');
  }
  const trimmed = value.trim();
  if (!trimmed && required) return siteInvalid(field, 'Is required.');
  if (trimmed.length > max) {
    return siteInvalid(field, `Must be at most ${max} characters.`);
  }
  return trimmed || null;
}

export function siteUuid(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return siteInvalid(field, 'Must be a valid UUID.');
  }
  return value;
}

export function optionalSiteUuid(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return siteUuid(value, field);
}

export function siteDate(value: unknown, field: string): Date {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return siteInvalid(field, 'Must use YYYY-MM-DD.');
  }
  const date = new Date(value + 'T00:00:00.000Z');
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return siteInvalid(field, 'Must be a valid calendar date.');
  }
  return date;
}

export function sitePositiveInt(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > 100000
  ) {
    return siteInvalid(field, 'Must be a positive whole number.');
  }
  return value;
}

export function sitePositiveDecimal(
  value: unknown,
  field: string,
): Prisma.Decimal {
  try {
    const decimal = new Prisma.Decimal(
      typeof value === 'number' || typeof value === 'string'
        ? value
        : '',
    );
    if (!decimal.isFinite() || decimal.lte(0)) {
      return siteInvalid(field, 'Must be greater than zero.');
    }
    return decimal;
  } catch {
    return siteInvalid(field, 'Must be a valid positive number.');
  }
}

export function sitePercent(
  value: unknown,
  field: string,
): Prisma.Decimal {
  try {
    const decimal = new Prisma.Decimal(
      typeof value === 'number' || typeof value === 'string'
        ? value
        : '',
    );
    if (!decimal.isFinite() || decimal.lt(0) || decimal.gt(100)) {
      return siteInvalid(field, 'Must be between 0 and 100.');
    }
    return decimal;
  } catch {
    return siteInvalid(field, 'Must be a number between 0 and 100.');
  }
}

export function siteArray(
  value: unknown,
  field: string,
): Record<string, unknown>[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    return siteInvalid(field, 'Must be an array.');
  }
  if (value.length > 500) {
    return siteInvalid(field, 'Must contain 500 rows or fewer.');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return siteInvalid(`${field}[${index}]`, 'Must be an object.');
    }
    return item as Record<string, unknown>;
  });
}

export function requiredSiteString(
  input: Record<string, unknown>,
  field: string,
  max: number,
): string {
  return siteString(input, field, max, true) as string;
}

export function nullableSiteString(
  input: Record<string, unknown>,
  field: string,
  max: number,
): string | null | undefined {
  return siteString(input, field, max, false);
}

export function optionalSiteHours(
  value: unknown,
  field: string,
): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  try {
    const decimal = new Prisma.Decimal(
      typeof value === 'number' || typeof value === 'string'
        ? value
        : '',
    );
    if (!decimal.isFinite() || decimal.lte(0) || decimal.gt(24)) {
      return siteInvalid(
        field,
        'Must be greater than 0 and no more than 24.',
      );
    }
    return decimal;
  } catch {
    return siteInvalid(
      field,
      'Must be a valid number greater than 0 and no more than 24.',
    );
  }
}
