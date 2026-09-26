import { apiDownload, apiRequest } from './client';

type Data<T> = { data: T };

export type SiteProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type SiteOptions = {
  activities: Array<{
    id: string;
    activityCode: string;
    activityName: string;
    wbsId: string;
    isSummary: boolean;
    isMilestone: boolean;
  }>;
  wbs: Array<{ id: string; wbsCode: string; wbsName: string }>;
  materials: Array<{
    id: string;
    materialCode: string;
    materialName: string;
    defaultUomId: string;
  }>;
  uoms: Array<{
    id: string;
    uomCode: string;
    uomName: string;
    decimalPlaces: number;
  }>;
  documentTypes: Array<{
    id: string;
    documentTypeCode: string;
    documentTypeName: string;
  }>;
  equipmentIntegration: {
    available: boolean;
    targetStage: string;
    message: string;
  };
};

export type ManpowerLineInput = {
  tradeRole: string;
  headcount: number;
  remarks?: string | null;
};

export type MaterialUsageLineInput = {
  materialId: string;
  uomId: string;
  quantity: string | number;
  activityId?: string | null;
  wbsId?: string | null;
  remarks?: string | null;
};

export type EquipmentUsageLineInput = {
  equipmentId: string;
  operatingHours?: string | number | null;
  activityId?: string | null;
  wbsId?: string | null;
  remarks?: string | null;
};

export type ProgressLineInput = {
  activityId: string;
  percentComplete: string | number;
  note?: string | null;
};

export type IssueLineInput = {
  activityId?: string | null;
  issueText: string;
  remarks?: string | null;
};

export type DelayLineInput = {
  activityId?: string | null;
  delayReason: string;
  remarks?: string | null;
};

export type InspectionLineInput = {
  activityId?: string | null;
  inspectionReference?: string | null;
  remarks?: string | null;
};

export type DailySiteReportPayload = {
  projectId?: string;
  reportDate?: string;
  weatherObservation?: string | null;
  generalRemarks?: string | null;
  manpower?: ManpowerLineInput[];
  materialUsage?: MaterialUsageLineInput[];
  equipmentUsage?: EquipmentUsageLineInput[];
  progress?: ProgressLineInput[];
  issues?: IssueLineInput[];
  delays?: DelayLineInput[];
  inspections?: InspectionLineInput[];
};

export type DailySiteReportSummary = {
  id: string;
  companyId: string;
  projectId: string;
  reportDate: string;
  status: 'DRAFT' | 'SUBMITTED';
  weatherObservation: string | null;
  generalRemarks: string | null;
  createdAt: string;
  submittedAt: string | null;
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  totalManpower: number;
  _count: {
    materialUsage: number;
    equipmentUsage: number;
    progressLines: number;
    issues: number;
    delays: number;
    inspections: number;
    corrections: number;
  };
};

type ActivityRef = {
  id: string;
  activityCode: string;
  activityName: string;
};

export type DailySiteReportDetail = {
  id: string;
  companyId: string;
  projectId: string;
  reportDate: string;
  status: 'DRAFT' | 'SUBMITTED';
  weatherObservation: string | null;
  generalRemarks: string | null;
  submittedAt: string | null;
  project: SiteProject;
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  totalManpower: number;
  manpowerLines: Array<{
    id: string;
    tradeRole: string;
    headcount: number;
    remarks: string | null;
  }>;
  materialUsage: Array<{
    id: string;
    materialId: string;
    uomId: string;
    quantity: string;
    activityId: string | null;
    wbsId: string | null;
    remarks: string | null;
    material: { id: string; materialCode: string; materialName: string };
    uom: { id: string; uomCode: string; uomName: string };
    activity: ActivityRef | null;
    wbs: { id: string; wbsCode: string; wbsName: string } | null;
  }>;
  equipmentUsage: Array<{
    id: string;
    equipmentId: string;
    operatingHours: string | null;
    activityId: string | null;
    wbsId: string | null;
    remarks: string | null;
    equipmentUsageId: string | null;
    equipment: {
      id: string;
      equipmentCode: string;
      equipmentName: string;
      operationalStatus: 'AVAILABLE' | 'UNAVAILABLE';
      isActive: boolean;
    };
    activity: ActivityRef | null;
    wbs: { id: string; wbsCode: string; wbsName: string } | null;
    equipmentUsage: {
      id: string;
      usageDate: string;
      operatingHours: string | null;
      sourceType: string;
      sourceEntityId: string | null;
      createdAt: string;
    } | null;
  }>;
  progressLines: Array<{
    id: string;
    activityId: string;
    percentComplete: string;
    note: string | null;
    activityProgressId: string | null;
    activity: ActivityRef;
    activityProgress: {
      id: string;
      progressDate: string;
      percentComplete: string;
      createdAt: string;
    } | null;
  }>;
  issues: Array<{
    id: string;
    activityId: string | null;
    issueText: string;
    remarks: string | null;
    activity: ActivityRef | null;
  }>;
  delays: Array<{
    id: string;
    activityId: string | null;
    delayReason: string;
    remarks: string | null;
    activity: ActivityRef | null;
  }>;
  inspections: Array<{
    id: string;
    activityId: string | null;
    inspectionReference: string | null;
    remarks: string | null;
    activity: ActivityRef | null;
  }>;
  corrections: Array<{
    id: string;
    correctionNote: string;
    createdAt: string;
    createdBy: { id: string; displayName: string };
    equipmentCorrections: Array<{
      id: string;
      equipmentId: string;
      usageDate: string;
      operatingHours: string | null;
      activityId: string | null;
      wbsId: string | null;
      remarks: string | null;
      sourceType: string;
      sourceEntityId: string | null;
      equipment: {
        id: string;
        equipmentCode: string;
        equipmentName: string;
      };
      activity: ActivityRef | null;
      wbs: { id: string; wbsCode: string; wbsName: string } | null;
    }>;
    progressCorrections: Array<{
      id: string;
      activityId: string;
      progressDate: string;
      percentComplete: string;
      note: string | null;
      sourceType: string | null;
      sourceEntityId: string | null;
      activity: ActivityRef;
    }>;
  }>;
};

export type SiteReportDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  isActive: boolean;
  documentType: {
    id: string;
    documentTypeCode: string;
    documentTypeName: string;
  };
  uploadedBy: { id: string; displayName: string };
};

function query(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  return path + (search.toString() ? '?' + search.toString() : '');
}

export const siteExecutionApi = {
  projects: () =>
    apiRequest<Data<SiteProject[]>>('/site-execution/projects'),
  options: (projectId: string) =>
    apiRequest<Data<SiteOptions>>(
      '/site-execution/projects/' + projectId + '/options',
    ),
  reports: (projectId: string, from?: string, to?: string) =>
    apiRequest<Data<DailySiteReportSummary[]>>(
      query('/site-execution/reports', { projectId, from, to }),
    ),
  report: (id: string) =>
    apiRequest<Data<DailySiteReportDetail>>(
      '/site-execution/reports/' + id,
    ),
  create: (body: DailySiteReportPayload & { projectId: string; reportDate: string }) =>
    apiRequest<Data<DailySiteReportDetail>>('/site-execution/reports', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: DailySiteReportPayload) =>
    apiRequest<Data<DailySiteReportDetail>>(
      '/site-execution/reports/' + id,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  submit: (id: string) =>
    apiRequest<Data<DailySiteReportDetail>>(
      '/site-execution/reports/' + id + '/submit',
      { method: 'POST' },
    ),
  addCorrection: (
    id: string,
    correctionNote: string,
    progress: ProgressLineInput[] = [],
    equipmentUsage: EquipmentUsageLineInput[] = [],
  ) =>
    apiRequest<
      Data<{
        id: string;
        correctionNote: string;
        createdAt: string;
        createdBy: { id: string; displayName: string };
        equipmentCorrections: Array<{
          id: string;
          equipmentId: string;
          usageDate: string;
          operatingHours: string | null;
          activityId: string | null;
          wbsId: string | null;
          remarks: string | null;
          sourceType: string;
          sourceEntityId: string | null;
          equipment: {
            id: string;
            equipmentCode: string;
            equipmentName: string;
          };
          activity: ActivityRef | null;
          wbs: { id: string; wbsCode: string; wbsName: string } | null;
        }>;
        progressCorrections: Array<{
          id: string;
          activityId: string;
          progressDate: string;
          percentComplete: string;
          note: string | null;
          sourceType: string | null;
          sourceEntityId: string | null;
          activity: ActivityRef;
        }>;
      }>
    >('/site-execution/reports/' + id + '/corrections', {
      method: 'POST',
      body: JSON.stringify({ correctionNote, progress, equipmentUsage }),
    }),
  documents: (id: string) =>
    apiRequest<Data<SiteReportDocument[]>>(
      '/site-execution/reports/' + id + '/documents',
    ),
  uploadPhoto: (id: string, documentTypeId: string, file: File) => {
    const form = new FormData();
    form.append('documentTypeId', documentTypeId);
    form.append('file', file);
    return apiRequest<Data<SiteReportDocument>>(
      '/site-execution/reports/' + id + '/photos',
      { method: 'POST', body: form },
    );
  },
  downloadDocument: (id: string, documentId: string) =>
    apiDownload(
      '/site-execution/reports/' +
        id +
        '/documents/' +
        documentId +
        '/download',
    ),
};
