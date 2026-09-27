import { apiRequest } from './client';

type Data<T> = { data: T };

export type ReportingProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type ProjectEngineerDashboard = {
  project: ReportingProject & {
    plannedStartDate: string;
    plannedCompletionDate: string;
    actualStartDate: string | null;
    actualCompletionDate: string | null;
  };
  asOfDate: string;
  schedule: {
    currentBaseline: {
      id: string;
      versionNo: number;
      approvedAt: string | null;
    } | null;
    summary: {
      total: number;
      critical: number;
      delayed: number;
      completed: number;
    };
    activities: Array<{
      activityId: string;
      activityCode: string;
      activityName: string;
      currentPercentComplete: number | null;
      delayWorkDays: number | null;
      delayStatus: 'DELAYED' | 'ON_TIME' | 'AHEAD' | 'UNAVAILABLE';
      totalFloatWorkDays: number | null;
      isCritical: boolean;
      forecastStartDate: string | null;
      forecastFinishDate: string | null;
    }>;
    lookahead: {
      window: {
        asOfDate: string;
        endDate: string;
        days: 14 | 28;
      };
      activities: Array<{
        activityId: string;
        activityCode: string;
        activityName: string;
        currentPercentComplete: number | null;
        delayStatus: string;
        isCritical: boolean;
        forecastStartDate: string | null;
        forecastFinishDate: string | null;
      }>;
    };
  };
  siteExecution: {
    latestReports: Array<{
      id: string;
      reportDate: string;
      status: 'DRAFT' | 'SUBMITTED';
      weatherObservation: string | null;
      generalRemarks: string | null;
      createdBy: { id: string; displayName: string };
      totalManpower: number;
      counts: {
        materialUsage: number;
        equipmentUsage: number;
        progress: number;
        issues: number;
        delays: number;
        inspections: number;
      };
    }>;
  };
  equipment: {
    assignedCount: number;
    assignments: Array<{
      assignmentId: string;
      assignedFrom: string;
      assignedTo: string | null;
      equipment: {
        id: string;
        equipmentCode: string;
        equipmentName: string;
        operationalStatus: string;
        equipmentType: {
          id: string;
          equipmentTypeCode: string;
          equipmentTypeName: string;
        };
      };
    }>;
  };
};

export type ProcurementReport = {
  project: ReportingProject;
  summary: {
    total: number;
    AT_RISK: number;
    ON_TIME: number;
    UNAVAILABLE: number;
    rfq: number;
    awarded: number;
    purchaseOrder: number;
  };
  lines: Array<{
    id: string;
    pr: {
      id: string;
      prNumber: string;
      lineNo: number;
      lifecycleState: string;
    };
    lineType: string;
    materialCode: string | null;
    description: string;
    quantity: string;
    uom: { id: string; uomCode: string; uomName: string };
    requiredOnSite: string | null;
    expectedDelivery: string | null;
    scheduleRisk: 'AT_RISK' | 'ON_TIME' | 'UNAVAILABLE';
    context: {
      wbs: { id: string; wbsCode: string; wbsName: string } | null;
      costCode: { id: string; costCode: string; costName: string } | null;
      activity: { id: string; activityCode: string; activityName: string } | null;
    };
    rfqs: Array<{
      rfqLineId: string;
      rfqId: string;
      rfqNumber: string;
      rfqDate: string;
      closingDate: string | null;
      invitedSupplierCount: number;
      quotationCount: number;
      quotations: Array<{
        id: string;
        supplierQuotationLineId: string;
        supplierReference: string | null;
        quotationDate: string;
        validityDate: string | null;
        supplier: {
          id: string;
          supplierCode: string;
          supplierName: string;
        };
      }>;
      award: {
        id: string;
        supplierId: string;
        supplierCodeSnapshot: string;
        supplierNameSnapshot: string;
        supplierQuotationId: string;
        supplierQuotationLineId: string;
        supplierReferenceSnapshot: string | null;
        quotationDateSnapshot: string;
        selectedAt: string;
      } | null;
    }>;
    purchaseOrders: Array<{
      id: string;
      purchaseOrderId: string;
      poNumber: string;
      revisionNo: number;
      lifecycleState: string;
      supplier: {
        id: string;
        supplierCode: string;
        supplierName: string;
      };
      requiredOnSite: string | null;
      expectedDelivery: string | null;
      scheduleRisk: 'AT_RISK' | 'ON_TIME' | 'UNAVAILABLE';
      quotationAwardId: string;
      supplierQuotationId: string;
      supplierQuotationLineId: string;
      rfqId: string;
      rfqLineId: string;
    }>;
  }>;
};

function query(path: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return path + '?' + search.toString();
}

export const reportingApi = {
  projects: () =>
    apiRequest<Data<ReportingProject[]>>('/reporting/projects'),
  procurement: (projectId: string) =>
    apiRequest<Data<ProcurementReport>>(
      '/reporting/projects/' + projectId + '/procurement',
    ),
  projectEngineer: (
    projectId: string,
    asOf: string,
    days: 14 | 28,
  ) =>
    apiRequest<Data<ProjectEngineerDashboard>>(
      query('/reporting/projects/' + projectId + '/project-engineer', {
        asOf,
        days: String(days),
      }),
    ),
};
