import { z } from 'zod';
import { apiDownload, apiRequest } from '../api/client';

const item = z.object({
  id: z.string().uuid(), version: z.number().int().positive(),
  createdAt: z.string(),
}).strict();
const response = z.object({ data: z.object({
  items: z.array(item).max(100),
  nextCursor: z.number().int().positive().nullable(),
}).strict() }).strict();
export type HrDocumentHistory = z.infer<typeof response>['data'];

export function hrDocumentsPath(companyId: string, employeeId: string) {
  return '/hr/companies/' + encodeURIComponent(companyId) +
    '/employees/' + encodeURIComponent(employeeId) + '/documents';
}
export async function getHrDocumentHistory(companyId: string, employeeId: string, after = 0): Promise<HrDocumentHistory> {
  const path = hrDocumentsPath(companyId, employeeId) + (after > 0 ? '?after=' + String(after) : '');
  return response.parse(await apiRequest<unknown>(path)).data;
}
/** Called only on explicit user action. Decrypted bytes never enter React Query. */
export function downloadHrDocument(companyId: string, employeeId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new Error('Invalid HR attachment ID');
  return apiDownload(hrDocumentsPath(companyId, employeeId) + '/' + encodeURIComponent(id) + '/download');
}
export function safeHrFileName(name: string | null, version: number) {
  if (name && name.length <= 255 && name !== '.' && name !== '..' && !/[/\\\x00-\x1f\x7f]/.test(name)) {
    return name;
  }
  return 'hr-protected-v' + String(version) + '.bin';
}
