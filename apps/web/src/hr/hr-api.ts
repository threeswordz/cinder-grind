import { z } from 'zod';
import { apiRequest } from '../api/client';

// Strict public-field projections; unknown backend fields are stripped instead
// of accidentally entering the HR screen or React's data cache.
const employeeSchema = z.object({
  id: z.string().uuid(),
  employeeCode: z.string(),
  employeeName: z.string(),
  jobTitle: z.string().nullable(),
  isActive: z.boolean(),
});
const companySchema = z.object({
  id: z.string().uuid(),
  companyCode: z.string(),
  companyName: z.string(),
  categories: z.array(z.string()),
  permissions: z.array(z.string()),
});
const revisionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  payBasis: z.string(),
  employmentForm: z.string(),
  siteKind: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  projectId: z.string().uuid().nullable(),
  createdAt: z.string(),
});
const historySchema = z.object({
  employee: employeeSchema,
  employment: z.object({
    id: z.string().uuid(),
    currentVersion: z.number().int().nonnegative(),
    revisions: z.array(revisionSchema),
  }).nullable(),
});

export type HrCompany = z.infer<typeof companySchema>;
export type HrEmployee = z.infer<typeof employeeSchema>;
export type HrEmploymentHistory = z.infer<typeof historySchema>;

export async function getHrCompanies(): Promise<HrCompany[]> {
  const result = await apiRequest<unknown>('/hr/companies');
  return z.object({ data: z.array(companySchema) }).parse(result).data;
}

export async function getHrEmployees(companyId: string, after = ''): Promise<{
  items: HrEmployee[];
  nextCursor: string | null;
}> {
  const route = '/hr/companies/' + encodeURIComponent(companyId) + '/employees';
  const result = await apiRequest<unknown>(route + (after ? '?after=' + encodeURIComponent(after) : ''));
  return z.object({ data: z.object({
    items: z.array(employeeSchema).max(100),
    nextCursor: z.string().uuid().nullable(),
  }) }).parse(result).data;
}

export async function getHrEmploymentHistory(companyId: string, employeeId: string): Promise<HrEmploymentHistory> {
  const route = '/hr/companies/' + encodeURIComponent(companyId) +
    '/employees/' + encodeURIComponent(employeeId) + '/employment';
  const result = await apiRequest<unknown>(route);
  return z.object({ data: historySchema }).parse(result).data;
}
