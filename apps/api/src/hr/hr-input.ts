import { UnprocessableEntityException } from '@nestjs/common';

export const hrCategories = ['employment', 'identity', 'bank', 'documents'] as const;
export type HrCategory = typeof hrCategories[number];
export function invalid(): never {
  throw new UnprocessableEntityException({ code: 'HR_INPUT_INVALID', detail: 'Use the supported HR fields, canonical identities, valid dates and expected version.' });
}
export function object(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !fields.includes(key))) invalid();
  return value as Record<string, unknown>;
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) invalid();
  return value;
}
export function text(value: unknown, maximum = 1000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) invalid();
  return value.trim();
}
export function integer(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > 2147483646) invalid();
  return value;
}
export function choice<T extends string>(value: unknown, options: readonly T[]): T {
  if (typeof value !== 'string' || !options.includes(value as T)) invalid();
  return value as T;
}
export function day(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid();
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < '0001-01-01' || value > '9999-12-31') invalid();
  return date;
}
export type EmploymentFacts = ReturnType<typeof employmentFacts>;
export function employmentFacts(raw: unknown) {
  const value = object(raw, ['payBasis','employmentForm','siteKind','startDate','endDate','projectId','hiringApprovalReference','reason']);
  const startDate = day(value.startDate), endDate = value.endDate == null ? null : day(value.endDate);
  if (endDate && endDate < startDate) invalid();
  return {
    payBasis: choice(value.payBasis, ['MONTHLY','DAILY'] as const),
    employmentForm: choice(value.employmentForm, ['PROBATION','PERMANENT','FIXED_TERM','TEMPORARY'] as const),
    siteKind: choice(value.siteKind, ['OFFICE','SITE'] as const), startDate, endDate,
    projectId: value.projectId == null ? null : uuid(value.projectId),
    hiringApprovalReference: text(value.hiringApprovalReference, 200), reason: text(value.reason),
  };
}
export function predecessor(raw: unknown) {
  const value = object(raw, ['companyId','employeeId','verificationReason']);
  return { companyId: uuid(value.companyId), employeeId: uuid(value.employeeId), verificationReason: text(value.verificationReason) };
}
export const privateFields = {
  identity: ['identityNumber','passportNumber','address','contactPhone','contactEmail','emergencyContact','dateOfBirth','workPermitNumber'],
  bank: ['bankName','accountNumber','accountHolder'],
} as const;
export type PrivateCategory = keyof typeof privateFields;
export function privateValues(category: PrivateCategory, raw: unknown): Record<string, string> {
  const value = object(raw, privateFields[category]);
  if (!Object.keys(value).length) invalid();
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    key === 'dateOfBirth' ? day(item).toISOString().slice(0,10) : text(item, key === 'address' || key === 'emergencyContact' ? 1000 : 320)]));
}
export function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a],[b]) => a.localeCompare(b))
    .map(([key, item]) => JSON.stringify(key) + ':' + stable(item)).join(',') + '}';
  return JSON.stringify(value);
}
