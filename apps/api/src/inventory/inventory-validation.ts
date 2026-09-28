import { UnprocessableEntityException } from '@nestjs/common';

export function inventoryInvalid(field: string, message: string): never {
  throw new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more Inventory fields are invalid.',
    errors: [{ field, message }],
  });
}

export function inventoryObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return inventoryInvalid('body', 'Must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function inventoryString(
  input: Record<string, unknown>,
  field: string,
  max: number,
  required = true,
): string | null | undefined {
  const value = input[field];
  if (value === undefined) {
    if (required) return inventoryInvalid(field, 'Is required.');
    return undefined;
  }
  if (value === null || value === '') {
    if (required) return inventoryInvalid(field, 'Is required.');
    return null;
  }
  if (typeof value !== 'string') {
    return inventoryInvalid(field, 'Must be a string.');
  }
  const trimmed = value.trim();
  if (!trimmed && required) return inventoryInvalid(field, 'Is required.');
  if (trimmed.length > max) {
    return inventoryInvalid(field, `Must be at most ${max} characters.`);
  }
  return trimmed || null;
}

export function requiredInventoryString(
  input: Record<string, unknown>,
  field: string,
  max: number,
): string {
  return inventoryString(input, field, max, true) as string;
}

export function nullableInventoryString(
  input: Record<string, unknown>,
  field: string,
  max: number,
): string | null | undefined {
  return inventoryString(input, field, max, false);
}

export function inventoryBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    return inventoryInvalid(field, 'Must be boolean.');
  }
  return value;
}

export function inventoryUuid(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return inventoryInvalid(field, 'Must be a valid UUID.');
  }
  return value;
}

export function optionalInventoryUuid(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return inventoryUuid(value, field);
}
