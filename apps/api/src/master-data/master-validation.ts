import { UnprocessableEntityException } from '@nestjs/common';

export function masterInvalid(field: string, message: string) {
  return new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors: [{ field, message }],
  });
}

export function requireMasterObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw masterInvalid('body', 'Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export function requiredMasterString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string {
  const value = optionalMasterString(body, field, maxLength);
  if (value === undefined) throw masterInvalid(field, 'Is required.');
  return value;
}

export function optionalMasterString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw masterInvalid(field, 'Must be a string.');
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxLength) {
    throw masterInvalid(
      field,
      'Must be between 1 and ' + maxLength + ' characters.',
    );
  }
  return trimmed;
}

export function nullableMasterString(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string | null | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null) return null;
  return optionalMasterString(body, field, maxLength);
}

export function optionalMasterBoolean(
  body: Record<string, unknown>,
  field: string,
): boolean | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw masterInvalid(field, 'Must be a boolean.');
  }
  return value;
}

export function optionalMasterInteger(
  body: Record<string, unknown>,
  field: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw masterInvalid(
      field,
      'Must be an integer from ' + minimum + ' to ' + maximum + '.',
    );
  }
  return value;
}

export function normalizeMasterCode(
  value: string,
  field: string,
  maxLength: number,
): string {
  const normalized = value.toUpperCase();
  if (
    normalized.length > maxLength ||
    !/^[A-Z0-9][A-Z0-9._-]*$/.test(normalized)
  ) {
    throw masterInvalid(
      field,
      'Use letters, numbers, dot, underscore or hyphen only.',
    );
  }
  return normalized;
}

export function validateOptionalEmail(
  value: string | null | undefined,
  field = 'email',
): string | null | undefined {
  if (value === undefined || value === null) return value;
  const normalized = value.toLowerCase();
  if (
    normalized.length > 320 ||
    !/^[^\s@]+@[^\s@]+$/.test(normalized)
  ) {
    throw masterInvalid(field, 'Enter a valid email address.');
  }
  return normalized;
}

export function validateMasterUuid(value: string, field: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw masterInvalid(field, 'Must be a valid UUID.');
  }
  return value;
}

export function parseActiveFilter(
  value: string | undefined,
): boolean | undefined {
  if (value === undefined || value === '' || value === 'all') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw masterInvalid('active', 'Use true, false or all.');
}

export function parseSearch(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 200) {
    throw masterInvalid('search', 'Search is too long.');
  }
  return trimmed;
}
