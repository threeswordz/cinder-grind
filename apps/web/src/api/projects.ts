import { apiRequest } from './client';

type Data<T> = { data: T };

export type ProjectOption = {
  id: string;
  isActive: boolean;
  [key: string]: unknown;
};

export type ProjectRecord = {
  id: string;
  projectCode: string;
  projectName: string;
  contractValue: string;
  location: string | null;
  description: string | null;
  plannedStartDate: string;
  plannedCompletionDate: string;
  isActive: boolean;
  customer: {
    id: string;
    customerCode: string;
    customerName: string;
    isActive: boolean;
  };
  statusDefinition: {
    id: string;
    statusCode: string;
    statusLabel: string;
    isActive: boolean;
  };
};

export type ProjectMember = {
  id: string;
  projectRole: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  employee: {
    id: string;
    employeeCode: string;
    employeeName: string;
    jobTitle: string | null;
  };
};

export type ProjectContact = {
  id: string;
  contactName: string;
  organizationName: string | null;
  roleOrTitle: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
};

function projectQuery(search: string, active: string) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (active !== 'all') params.set('active', active);
  const value = params.toString();
  return value ? '?' + value : '';
}

export const projectsApi = {
  list: (search = '', active = 'all') =>
    apiRequest<Data<ProjectRecord[]>>('/projects' + projectQuery(search, active)),
  editOptions: () =>
    apiRequest<Data<{ customers: ProjectOption[]; statuses: ProjectOption[] }>>(
      '/projects/edit-options',
    ),
  create: (body: Record<string, unknown>) =>
    apiRequest<Data<ProjectRecord>>('/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<ProjectRecord>>('/projects/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  setActive: (id: string, active: boolean) =>
    apiRequest<Data<ProjectRecord>>(
      '/projects/' + id + (active ? '/reactivate' : '/archive'),
      { method: 'POST' },
    ),
  members: (id: string) =>
    apiRequest<Data<ProjectMember[]>>('/projects/' + id + '/members'),
  memberOptions: (id: string) =>
    apiRequest<Data<ProjectOption[]>>('/projects/' + id + '/member-options'),
  addMember: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<ProjectMember>>('/projects/' + id + '/members', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMember: (projectId: string, memberId: string, body: Record<string, unknown>) =>
    apiRequest<Data<ProjectMember>>('/projects/' + projectId + '/members/' + memberId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  contacts: (id: string) =>
    apiRequest<Data<ProjectContact[]>>('/projects/' + id + '/contacts'),
  addContact: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<ProjectContact>>('/projects/' + id + '/contacts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateContact: (projectId: string, contactId: string, body: Record<string, unknown>) =>
    apiRequest<Data<ProjectContact>>('/projects/' + projectId + '/contacts/' + contactId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
