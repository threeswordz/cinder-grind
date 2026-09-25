import { UnprocessableEntityException } from '@nestjs/common';

type RecordBody = Record<string, unknown>;

export function requireObject(body: unknown): RecordBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw invalid('body', 'Request body must be a JSON object.');
  }
  return body as RecordBody;
}

export function optionalTrimmedString(
  body: RecordBody,
  field: string,
  maxLength: number,
): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw invalid(field, 'Must be a string.');
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxLength) {
    throw invalid(
      field,
      'Must be between 1 and ' + maxLength + ' characters.',
    );
  }
  return trimmed;
}

export function requiredTrimmedString(
  body: RecordBody,
  field: string,
  maxLength: number,
): string {
  const value = optionalTrimmedString(body, field, maxLength);
  if (value === undefined) throw invalid(field, 'Is required.');
  return value;
}

export function optionalBoolean(
  body: RecordBody,
  field: string,
): boolean | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw invalid(field, 'Must be a boolean.');
  return value;
}

export function optionalInteger(
  body: RecordBody,
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
    throw invalid(
      field,
      'Must be an integer from ' + minimum + ' to ' + maximum + '.',
    );
  }
  return value;
}

export function validateCode(
  value: string,
  field: string,
  maxLength: number,
): string {
  if (
    value.length > maxLength ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
  ) {
    throw invalid(
      field,
      'Use letters, numbers, dot, underscore or hyphen only.',
    );
  }
  return value;
}

export function validateCurrencyCode(value: string): string {
  const normalized = value.toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw invalid('baseCurrencyCode', 'Use a three-letter currency code.');
  }
  return normalized;
}

export function validateSystemSettingKey(value: string): string {
  if (!/^[a-z][a-z0-9_.-]{0,149}$/.test(value)) {
    throw invalid(
      'settingKey',
      'Use lowercase letters, numbers, dot, underscore or hyphen.',
    );
  }

  if (
    /(password|secret|token|credential|private[_-]?key|api[_-]?key)/i.test(
      value,
    )
  ) {
    throw invalid(
      'settingKey',
      'Secret or credential values must not be stored in system settings.',
    );
  }

  return value;
}

export function validateJsonSettingValue(value: unknown): unknown {
  if (value === undefined) throw invalid('settingValue', 'Is required.');
  const serialized = JSON.stringify(value);
  if (serialized === undefined || serialized.length > 16384) {
    throw invalid(
      'settingValue',
      'Setting value must be valid JSON no larger than 16 KB.',
    );
  }
  return value;
}

export function invalid(
  field: string,
  message: string,
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors: [{ field, message }],
  });
}
