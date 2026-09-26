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

function query(path: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return path + '?' + search.toString();
}

export const reportingApi = {
  projects: () =>
    apiRequest<Data<ReportingProject[]>>('/reporting/projects'),
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
