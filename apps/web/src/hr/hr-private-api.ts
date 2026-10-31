import { z } from 'zod';
import { apiRequest } from '../api/client';

/** No private plaintext is stored in React Query; callers may only hold an
 * explicit reveal in the transient, user-visible component state. */
export type HrPrivateCategory = 'identity' | 'bank';
export const hrPrivateFields = {
  identity: ['identityNumber', 'passportNumber', 'address', 'contactPhone', 'contactEmail',
    'emergencyContact', 'dateOfBirth', 'workPermitNumber'],
  bank: ['bankName', 'accountNumber', 'accountHolder'],
} as const;
const receipt = z.object({
  data: z.object({ id: z.string().uuid(), version: z.number().int().positive() }).strict(),
}).strict();
const historyItem = z.object({
  id: z.string().uuid(), version: z.number().int().positive(),
  actorUserId: z.string().uuid(), createdAt: z.string(),
}).strict();

function route(companyId: string, employeeId: string, category: HrPrivateCategory) {
  return '/hr/companies/' + encodeURIComponent(companyId) +
    '/employees/' + encodeURIComponent(employeeId) + '/private/' + category;
}
function safeValues(category: HrPrivateCategory, value: unknown, masked: boolean): Record<string, string> {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Unsafe private HR projection');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !(hrPrivateFields[category] as readonly string[]).includes(key))) {
    throw new Error('Unsafe private HR projection');
  }
  for (const item of Object.values(row)) {
    if (typeof item !== 'string' || (masked && item !== '••••')) throw new Error('Unsafe private HR projection');
  }
  return row as Record<string, string>;
}
function parsePrivate(category: HrPrivateCategory, raw: unknown, masked: boolean) {
  const parsed = z.object({
    data: z.object({ version: z.number().int().nonnegative(), values: z.record(z.string(), z.string()) }).strict(),
  }).strict().parse(raw);
  return { version: parsed.data.version, values: safeValues(category, parsed.data.values, masked) };
}
export async function getMaskedHrPrivate(companyId: string, employeeId: string, category: HrPrivateCategory) {
  const result = await apiRequest<unknown>(route(companyId, employeeId, category));
  return parsePrivate(category, result, true);
}
export async function getHrPrivateHistory(companyId: string, employeeId: string, category: HrPrivateCategory) {
  const result = await apiRequest<unknown>(route(companyId, employeeId, category) + '/history');
  return z.object({ data: z.array(historyItem).max(2000) }).strict().parse(result).data;
}
/** Must be invoked by a deliberate user action. Never cache this response. */
export async function revealHrPrivate(companyId: string, employeeId: string, category: HrPrivateCategory, version: number) {
  const result = await apiRequest<unknown>(route(companyId, employeeId, category) + '/reveal', {
    method: 'POST', body: JSON.stringify({ version }),
  });
  return parsePrivate(category, result, false);
}
export async function updateHrPrivate(companyId: string, employeeId: string, category: HrPrivateCategory,
  body: { requestId: string; expectedVersion: number; values: Record<string, string>; reason: string }) {
  const result = await apiRequest<unknown>(route(companyId, employeeId, category) + '/revisions', {
    method: 'POST', body: JSON.stringify(body),
  });
  return receipt.parse(result).data;
}
