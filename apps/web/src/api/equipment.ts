import { apiRequest } from './client';

type Data<T> = { data: T };

export type EquipmentTypeRecord = {
  id: string;
  companyId: string;
  equipmentTypeCode: string;
  equipmentTypeName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EquipmentRecord = {
  id: string;
  companyId: string;
  equipmentTypeId: string;
  equipmentCode: string;
  equipmentName: string;
  description: string | null;
  operationalStatus: 'AVAILABLE' | 'UNAVAILABLE';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  equipmentType: EquipmentTypeRecord;
  availability: 'AVAILABLE' | 'ASSIGNED' | 'UNAVAILABLE';
  currentAssignment: {
    id: string;
    assignedFrom: string;
    assignedTo: string | null;
    project: {
      id: string;
      projectCode: string;
      projectName: string;
    } | null;
    restrictedProject: boolean;
  } | null;
};

export type EquipmentProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type EquipmentAssignment = {
  id: string;
  companyId: string;
  equipmentId: string;
  projectId: string;
  assignedFrom: string;
  assignedTo: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  project: EquipmentProject;
};

export type ProjectEquipmentOption = {
  assignmentId: string;
  assignedFrom: string;
  assignedTo: string | null;
  equipment: {
    id: string;
    companyId: string;
    equipmentTypeId: string;
    equipmentCode: string;
    equipmentName: string;
    description: string | null;
    operationalStatus: 'AVAILABLE' | 'UNAVAILABLE';
    isActive: boolean;
    equipmentType: EquipmentTypeRecord;
  };
};

export type EquipmentUsage = {
  id: string;
  companyId: string;
  equipmentId: string;
  projectId: string;
  usageDate: string;
  operatingHours: string | null;
  activityId: string | null;
  wbsId: string | null;
  remarks: string | null;
  sourceType:
    | 'MANUAL'
    | 'DAILY_SITE_REPORT'
    | 'DAILY_SITE_REPORT_CORRECTION';
  sourceEntityId: string | null;
  createdAt: string;
  updatedAt: string;
  equipment: {
    id: string;
    equipmentCode: string;
    equipmentName: string;
  };
  project: EquipmentProject;
  activity: {
    id: string;
    activityCode: string;
    activityName: string;
  } | null;
  wbs: { id: string; wbsCode: string; wbsName: string } | null;
  recordedBy: { id: string; displayName: string };
};

function query(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  return path + (search.toString() ? '?' + search.toString() : '');
}

export const equipmentApi = {
  projects: () =>
    apiRequest<Data<EquipmentProject[]>>('/equipment/projects'),
  types: (activeOnly = false) =>
    apiRequest<Data<EquipmentTypeRecord[]>>(
      query('/equipment/types', {
        activeOnly: activeOnly ? 'true' : undefined,
      }),
    ),
  createType: (body: {
    equipmentTypeCode: string;
    equipmentTypeName: string;
    description?: string | null;
    isActive?: boolean;
  }) =>
    apiRequest<Data<EquipmentTypeRecord>>('/equipment/types', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateType: (
    id: string,
    body: Partial<{
      equipmentTypeCode: string;
      equipmentTypeName: string;
      description: string | null;
      isActive: boolean;
    }>,
  ) =>
    apiRequest<Data<EquipmentTypeRecord>>('/equipment/types/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  register: (asOf: string) =>
    apiRequest<Data<EquipmentRecord[]>>(
      query('/equipment/register', { asOf }),
    ),
  createEquipment: (body: {
    equipmentTypeId: string;
    equipmentCode: string;
    equipmentName: string;
    description?: string | null;
    operationalStatus: 'AVAILABLE' | 'UNAVAILABLE';
    isActive?: boolean;
  }) =>
    apiRequest<Data<EquipmentRecord>>('/equipment/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateEquipment: (
    id: string,
    body: Partial<{
      equipmentTypeId: string;
      equipmentCode: string;
      equipmentName: string;
      description: string | null;
      operationalStatus: 'AVAILABLE' | 'UNAVAILABLE';
      isActive: boolean;
    }>,
  ) =>
    apiRequest<Data<EquipmentRecord>>('/equipment/register/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  projectEquipment: (projectId: string, asOf: string) =>
    apiRequest<Data<ProjectEquipmentOption[]>>(
      query('/equipment/projects/' + projectId + '/available', { asOf }),
    ),
  assignments: (equipmentId: string) =>
    apiRequest<Data<EquipmentAssignment[]>>(
      '/equipment/register/' + equipmentId + '/assignments',
    ),
  assign: (
    equipmentId: string,
    body: { projectId: string; assignedFrom: string; remarks?: string | null },
  ) =>
    apiRequest<Data<EquipmentAssignment>>(
      '/equipment/register/' + equipmentId + '/assignments',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  release: (assignmentId: string, assignedTo: string) =>
    apiRequest<Data<EquipmentAssignment>>(
      '/equipment/assignments/' + assignmentId + '/release',
      { method: 'POST', body: JSON.stringify({ assignedTo }) },
    ),
  usage: (filters: {
    projectId?: string;
    equipmentId?: string;
    from?: string;
    to?: string;
  }) =>
    apiRequest<Data<EquipmentUsage[]>>(
      query('/equipment/usage', filters),
    ),
  createUsage: (body: {
    equipmentId: string;
    projectId: string;
    usageDate: string;
    operatingHours?: string | number | null;
    activityId?: string | null;
    wbsId?: string | null;
    remarks?: string | null;
  }) =>
    apiRequest<Data<EquipmentUsage | null>>('/equipment/usage', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateUsage: (
    id: string,
    body: Partial<{
      equipmentId: string;
      projectId: string;
      usageDate: string;
      operatingHours: string | number | null;
      activityId: string | null;
      wbsId: string | null;
      remarks: string | null;
    }>,
  ) =>
    apiRequest<Data<EquipmentUsage | null>>('/equipment/usage/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
