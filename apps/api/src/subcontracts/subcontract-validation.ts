import { UnprocessableEntityException } from '@nestjs/common';

export function subcontractInvalid(field: string, message: string): never {
  throw new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors: [{ field, message }],
  });
}

export function subcontractObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return subcontractInvalid('body', 'A JSON object is required.');
  }
  return value as Record<string, unknown>;
}

export function requiredSubcontractString(
  input: Record<string, unknown>,
  field: string,
  max: number,
): string {
  const value = input[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return subcontractInvalid(field, 'A non-empty string is required.');
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    return subcontractInvalid(field, 'Must not exceed ' + max + ' characters.');
  }
  return trimmed;
}

export function optionalSubcontractString(
  input: Record<string, unknown>,
  field: string,
  max: number,
): string | null | undefined {
  const value = input[field];
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    return subcontractInvalid(field, 'Must be a string or null.');
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    return subcontractInvalid(field, 'Must not exceed ' + max + ' characters.');
  }
  return trimmed || null;
}

export function requiredSubcontractUuid(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    return subcontractInvalid(field, 'A valid UUID is required.');
  }
  return value;
}

export function optionalSubcontractUuid(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return requiredSubcontractUuid(value, field);
}

export function subcontractCode(value: string, field: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(normalized)) {
    return subcontractInvalid(
      field,
      'Use letters, numbers, dot, underscore, slash or hyphen.',
    );
  }
  return normalized;
}

export function subcontractCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    return subcontractInvalid('currencyCode', 'Use a three-letter currency code.');
  }
  return normalized;
}

export function subcontractAmount(value: unknown): string {
  const text =
    typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : '';
  if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(text)) {
    return subcontractInvalid(
      'originalValue',
      'Use a nonnegative DECIMAL(18,2) amount with at most 16 integer digits.',
    );
  }
  return text;
}

export function subcontractPositiveAmount(
  value: unknown,
  field: string,
): string {
  const text =
    typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : '';
  if (
    !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(text) ||
    /^0(?:\.0{1,2})?$/.test(text)
  ) {
    return subcontractInvalid(
      field,
      'Use a positive DECIMAL(18,2) amount with at most 16 integer digits.',
    );
  }
  return text;
}

export function optionalSubcontractBoolean(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    return subcontractInvalid(field, 'Must be true or false.');
  }
  return value;
}

export function subcontractSearch(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 200) {
    return subcontractInvalid('search', 'Must not exceed 200 characters.');
  }
  return trimmed;
}

export function subcontractFlag(value: string | undefined, field: string): boolean {
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return subcontractInvalid(field, 'Use true or false.');
}
