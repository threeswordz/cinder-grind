/** Explicit private HR allowlists; not public Employee, Project or Document DTOs. */
export type HrPrivateCategory = 'identity' | 'bank';
export const hrPrivateFields = {
  identity: ['identityNumber', 'passportNumber', 'address', 'contactPhone', 'contactEmail',
    'emergencyContact', 'dateOfBirth', 'workPermitNumber'],
  bank: ['bankName', 'accountNumber', 'accountHolder'],
} as const;

/** Fail closed: a new backend private field must not be silently cached or
 * projected in the UI. A masked endpoint must never emit plaintext. */
export function safeHrPrivateValues(category: HrPrivateCategory, value: unknown, masked: boolean): Record<string, string> {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Unsafe private HR projection');
  const row = value as Record<string, unknown>;
  const allowed = hrPrivateFields[category] as readonly string[];
  if (Object.keys(row).some(key => !allowed.includes(key))) throw new Error('Unsafe private HR projection');
  for (const field of Object.values(row)) {
    if (typeof field !== 'string' || (masked && field !== '••••')) throw new Error('Unsafe private HR projection');
  }
  return row as Record<string, string>;
}
