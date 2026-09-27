import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function budgetInvalid(field: string, message: string) {
  return new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors: [{ field, message }],
  });
}

export function budgetObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw budgetInvalid('body', 'Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export function budgetString(
  body: Record<string, unknown>,
  field: string,
  max: number,
) {
  const value = body[field];
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > max
  ) {
    throw budgetInvalid(
      field,
      'Is required and must be at most ' + max + ' characters.',
    );
  }
  return value.trim();
}

export function budgetNullableString(
  body: Record<string, unknown>,
  field: string,
  max: number,
) {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    throw budgetInvalid(
      field,
      'Must be a string of at most ' + max + ' characters.',
    );
  }
  return value.trim() || null;
}

export function budgetUuid(
  value: unknown,
  field: string,
  optional = false,
): string | null | undefined {
  if (value === undefined && optional) return undefined;
  if (value === null && optional) return null;
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw budgetInvalid(field, 'Must be a valid UUID.');
  }
  return value;
}

export function budgetCode(value: string, field: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(normalized)) {
    throw budgetInvalid(
      field,
      'Use letters, numbers, dot, underscore or hyphen only.',
    );
  }
  return normalized;
}

export function budgetDecimal(
  value: unknown,
  field: string,
  rule: 'POSITIVE' | 'NON_NEGATIVE',
) {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    value === ''
  ) {
    throw budgetInvalid(field, 'Must be a decimal number.');
  }
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw budgetInvalid(field, 'Must be a decimal number.');
  }
  if (!decimal.isFinite()) {
    throw budgetInvalid(field, 'Must be a finite decimal number.');
  }
  if (rule === 'POSITIVE' && decimal.lte(0)) {
    throw budgetInvalid(field, 'Must be greater than zero.');
  }
  if (rule === 'NON_NEGATIVE' && decimal.lt(0)) {
    throw budgetInvalid(field, 'Must be zero or greater.');
  }
  if (decimal.decimalPlaces() > 4) {
    throw budgetInvalid(field, 'Use at most 4 decimal places.');
  }
  return decimal;
}

export function budgetInteger(
  value: unknown,
  field: string,
  minimum = 0,
) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum
  ) {
    throw budgetInvalid(
      field,
      'Must be an integer greater than or equal to ' + minimum + '.',
    );
  }
  return value;
}

export function budgetBoolean(
  body: Record<string, unknown>,
  field: string,
) {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw budgetInvalid(field, 'Must be a boolean.');
  }
  return value;
}

export function budgetNonEmpty(data: Record<string, unknown>) {
  if (!Object.keys(data).length) {
    throw budgetInvalid('body', 'Provide at least one field to update.');
  }
}
