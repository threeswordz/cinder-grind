import { apiRequest } from './client';

type Data<T> = { data: T };

export type SubcontractorRecord = {
  id: string;
  companyId: string;
  supplierId: string | null;
  subcontractorCode: string;
  subcontractorName: string;
  registrationNumber: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  supplier: {
    id: string;
    supplierCode: string;
    supplierName: string;
    isActive: boolean;
  } | null;
};

export type SubcontractProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type AgreementStatus = {
  id: string;
  statusCode: string;
  statusLabel: string;
  sortOrder: number;
};

export type AgreementDraft = {
  id: string;
  projectId: string;
  subcontractorId: string;
  agreementNumber: string;
  originalValue: string;
  scopeOfWork: string;
  currencyCode: string;
  approvalState: string;
  operationalStatusId: string | null;
  project: SubcontractProject;
  subcontractor: {
    id: string;
    subcontractorCode: string;
    subcontractorName: string;
    isActive: boolean;
  };
  operationalStatus: AgreementStatus | null;
  createdBy: { id: string; displayName: string };
};

function query(path: string, values: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  return path + (params.toString() ? '?' + params.toString() : '');
}

export const subcontractsApi = {
  subcontractors: (
    filters: { includeInactive?: boolean; search?: string } = {},
  ) =>
    apiRequest<Data<SubcontractorRecord[]>>(
      query('/subcontracts/subcontractors', {
        includeInactive: filters.includeInactive ? 'true' : undefined,
        search: filters.search,
      }),
    ),
  suppliers: () =>
    apiRequest<
      Data<Array<{ id: string; supplierCode: string; supplierName: string }>>
    >('/subcontracts/suppliers'),
  createSubcontractor: (
    body: Omit<SubcontractorRecord, 'id' | 'companyId' | 'isActive' | 'supplier'>,
  ) =>
    apiRequest<Data<SubcontractorRecord>>('/subcontracts/subcontractors', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSubcontractor: (
    id: string,
    body: Partial<
      Omit<SubcontractorRecord, 'id' | 'companyId' | 'isActive' | 'supplier'>
    >,
  ) =>
    apiRequest<Data<SubcontractorRecord>>(
      '/subcontracts/subcontractors/' + id,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  setSubcontractorActive: (id: string, active: boolean) =>
    apiRequest<Data<SubcontractorRecord>>(
      '/subcontracts/subcontractors/' +
        id +
        (active ? '/reactivate' : '/archive'),
      { method: 'POST' },
    ),
  projects: () =>
    apiRequest<Data<SubcontractProject[]>>('/subcontracts/projects'),
  statuses: () =>
    apiRequest<Data<AgreementStatus[]>>('/subcontracts/agreement-statuses'),
  agreements: (
    filters: { projectId?: string; subcontractorId?: string; search?: string } = {},
  ) =>
    apiRequest<Data<AgreementDraft[]>>(
      query('/subcontracts/agreements', filters),
    ),
  createAgreement: (body: {
    projectId: string;
    subcontractorId: string;
    originalValue: string;
    scopeOfWork: string;
    currencyCode: string;
    operationalStatusId?: string | null;
    createKey?: string;
  }) =>
    apiRequest<Data<AgreementDraft>>('/subcontracts/agreements', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAgreement: (
    id: string,
    body: Partial<{
      originalValue: string;
      scopeOfWork: string;
      currencyCode: string;
      operationalStatusId: string | null;
    }>,
  ) =>
    apiRequest<Data<AgreementDraft>>('/subcontracts/agreements/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
