import { apiRequest } from './client';

export type CompanySettings = {
  id: string;
  companyCode: string;
  companyName: string;
  baseCurrencyCode: string;
  isActive: boolean;
};

export type AdminRole = {
  id: string;
  roleCode: string;
  roleName: string;
  description: string | null;
  isActive: boolean;
  rolePermissions?: Array<{
    permission: AdminPermission;
  }>;
};

export type AdminPermission = {
  id: string;
  permissionCode: string;
  moduleCode: string;
  description: string | null;
};

export type AdminUser = {
  id: string;
  employeeId: string | null;
  email: string;
  displayName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  userRoles: Array<{ role: AdminRole }>;
};

export type StatusDefinition = {
  id: string;
  entityType: string;
  statusCode: string;
  statusLabel: string;
  sortOrder: number;
  isActive: boolean;
};

export type NumberSequence = {
  id: string;
  entityType: string;
  sequenceCode: string;
  formatTemplate: string;
  resetRule: string;
  lastPeriodKey: string | null;
  nextValue: number;
};

export type SystemSetting = {
  id: string;
  settingKey: string;
  settingValue: unknown;
};

export type ApprovalWorkflow = {
  id: string;
  workflowCode: string;
  entityType: string;
  workflowName: string;
  isActive: boolean;
  steps: Array<{
    id: string;
    stepNo: number;
    stepName: string;
    requiredApprovals: number;
    stepRoles: Array<{ role: AdminRole }>;
  }>;
};

type Data<T> = { data: T };

export const adminApi = {
  company: () => apiRequest<Data<CompanySettings>>('/admin/company'),
  updateCompany: (body: Partial<CompanySettings>) =>
    apiRequest<Data<CompanySettings>>('/admin/company', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  users: () => apiRequest<Data<AdminUser[]>>('/admin/users'),
  createUser: (body: {
    email: string;
    displayName: string;
    password: string;
    roleIds: string[];
  }) =>
    apiRequest<Data<AdminUser>>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateUser: (id: string, body: Partial<AdminUser>) =>
    apiRequest<Data<AdminUser>>('/admin/users/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  replaceUserRoles: (id: string, roleIds: string[]) =>
    apiRequest<Data<AdminUser>>('/admin/users/' + id + '/roles', {
      method: 'PUT',
      body: JSON.stringify({ roleIds }),
    }),

  roles: () => apiRequest<Data<AdminRole[]>>('/admin/roles'),
  createRole: (body: {
    roleCode: string;
    roleName: string;
    description?: string;
  }) =>
    apiRequest<Data<AdminRole>>('/admin/roles', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateRole: (
    id: string,
    body: {
      roleName?: string;
      description?: string | null;
      isActive?: boolean;
    },
  ) =>
    apiRequest<Data<AdminRole>>('/admin/roles/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  permissions: () =>
    apiRequest<Data<AdminPermission[]>>('/admin/permissions'),
  replaceRolePermissions: (id: string, permissionCodes: string[]) =>
    apiRequest<Data<AdminRole>>('/admin/roles/' + id + '/permissions', {
      method: 'PUT',
      body: JSON.stringify({ permissionCodes }),
    }),

  statuses: () =>
    apiRequest<Data<StatusDefinition[]>>('/admin/statuses'),
  createStatus: (body: {
    entityType: string;
    statusCode: string;
    statusLabel: string;
    sortOrder: number;
  }) =>
    apiRequest<Data<StatusDefinition>>('/admin/statuses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateStatus: (
    id: string,
    body: { statusLabel?: string; sortOrder?: number; isActive?: boolean },
  ) =>
    apiRequest<Data<StatusDefinition>>('/admin/statuses/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  numberSequences: () =>
    apiRequest<Data<NumberSequence[]>>('/admin/number-sequences'),
  createNumberSequence: (body: {
    entityType: string;
    sequenceCode: string;
    formatTemplate: string;
    resetRule: string;
    startingValue: number;
  }) =>
    apiRequest<Data<NumberSequence>>('/admin/number-sequences', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  systemSettings: () =>
    apiRequest<Data<SystemSetting[]>>('/admin/system-settings'),
  setSystemSetting: (key: string, settingValue: unknown) =>
    apiRequest<Data<SystemSetting>>(
      '/admin/system-settings/' + encodeURIComponent(key),
      {
        method: 'PUT',
        body: JSON.stringify({ settingValue }),
      },
    ),

  approvalWorkflows: () =>
    apiRequest<Data<ApprovalWorkflow[]>>('/admin/approval-workflows'),
  createApprovalWorkflow: (body: {
    workflowCode: string;
    entityType: string;
    workflowName: string;
    steps: Array<{
      stepNo: number;
      stepName: string;
      requiredApprovals: number;
      roleIds: string[];
    }>;
  }) =>
    apiRequest<Data<ApprovalWorkflow>>('/admin/approval-workflows', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
