import { UnprocessableEntityException } from '@nestjs/common';

export function documentInvalid(field: string, message: string) {
  return new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors: [{ field, message }],
  });
}
export function documentObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw documentInvalid('body', 'Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}
export function documentString(body: Record<string, unknown>, field: string, max: number) {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw documentInvalid(field, 'Is required and must be at most ' + max + ' characters.');
  }
  return value.trim();
}
export function documentBoolean(body: Record<string, unknown>, field: string) {
  const value = body[field];
  if (typeof value !== 'boolean') throw documentInvalid(field, 'Must be a boolean.');
  return value;
}
export function documentCode(value: string) {
  const normalized = value.toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(normalized)) {
    throw documentInvalid('documentTypeCode', 'Use letters, numbers, dot, underscore or hyphen only.');
  }
  return normalized;
}
export function documentUuid(value: string, field: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw documentInvalid(field, 'Must be a valid UUID.');
  }
  return value;
}
export function nonemptyDocumentUpdate(data: Record<string, unknown>) {
  if (Object.keys(data).length === 0) throw documentInvalid('body', 'Provide at least one field to update.');
}
