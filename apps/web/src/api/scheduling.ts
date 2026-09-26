import { apiRequest } from './client';

type Data<T> = { data: T };

export type ScheduleProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type ActivityTypeRecord = {
  id: string;
  companyId: string;
  activityTypeCode: string;
  activityTypeName: string;
  isActive: boolean;
};

export type CalendarWeekday = {
  id: string;
  workingCalendarId: string;
  weekdayNo: number;
  isWorking: boolean;
  startTime: string | null;
  endTime: string | null;
};

export type CalendarException = {
  id: string;
  workingCalendarId: string;
  exceptionDate: string;
  isWorkingOverride: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
};

export type WorkingCalendarRecord = {
  id: string;
  companyId: string;
  projectId: string | null;
  calendarName: string;
  description: string | null;
  timezoneName: string;
  isDefault: boolean;
  isActive: boolean;
  project?: ScheduleProject | null;
  weekdays?: CalendarWeekday[];
  exceptions?: CalendarException[];
};

export type ActivityRecord = {
  id: string;
  companyId: string;
  projectId: string;
  wbsId: string;
  parentActivityId: string | null;
  activityTypeId: string | null;
  workingCalendarId: string;
  statusDefinitionId: string | null;
  activityCode: string;
  activityName: string;
  description: string | null;
  isSummary: boolean;
  isMilestone: boolean;
  plannedDurationWorkDays: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  actualStartDate: string | null;
  actualFinishDate: string | null;
  forecastStartDate: string | null;
  forecastFinishDate: string | null;
  responsibleEmployeeId: string | null;
  ownerUserId: string | null;
  isActive: boolean;
  wbs?: { id: string; wbsCode: string; wbsName: string };
  activityType?: ActivityTypeRecord | null;
  workingCalendar?: {
    id: string;
    calendarName: string;
    timezoneName: string;
    isActive: boolean;
  };
  statusDefinition?: {
    id: string;
    statusCode: string;
    statusLabel: string;
  } | null;
  responsibleEmployee?: {
    id: string;
    employeeCode: string;
    employeeName: string;
  } | null;
  owner?: { id: string; displayName: string; email: string } | null;
};

export type ActivityDependencyRecord = {
  id: string;
  projectId: string;
  predecessorActivityId: string;
  successorActivityId: string;
  dependencyType: 'FS' | 'SS' | 'FF' | 'SF';
  lagWorkDays: string;
  isActive: boolean;
  predecessor?: {
    id: string;
    activityCode: string;
    activityName: string;
    isActive: boolean;
  };
  successor?: {
    id: string;
    activityCode: string;
    activityName: string;
    isActive: boolean;
  };
};

export type ActivityOptions = {
  wbs: Array<{
    id: string;
    parentId: string | null;
    wbsCode: string;
    wbsName: string;
  }>;
  activityTypes: Array<{
    id: string;
    activityTypeCode: string;
    activityTypeName: string;
  }>;
  calendars: Array<{
    id: string;
    projectId: string | null;
    calendarName: string;
    timezoneName: string;
    isDefault: boolean;
  }>;
  statuses: Array<{
    id: string;
    statusCode: string;
    statusLabel: string;
  }>;
  employees: Array<{
    id: string;
    employeeCode: string;
    employeeName: string;
    jobTitle: string | null;
  }>;
  users: Array<{
    id: string;
    displayName: string;
    email: string;
  }>;
  parents: Array<{
    id: string;
    parentActivityId: string | null;
    wbsId: string;
    activityCode: string;
    activityName: string;
    isSummary: boolean;
  }>;
};

export type BaselineWorkflowOption = {
  id: string;
  workflowCode: string;
  workflowName: string;
};

export type ScheduleBaselineRecord = {
  id: string;
  companyId: string;
  projectId: string;
  versionNo: number;
  approvalInstanceId: string | null;
  submittedByUserId: string;
  submittedAt: string;
  isCurrent: boolean;
  approvalInstance: {
    id: string;
    approvalState: string;
    currentStepNo: number;
    startedAt: string;
    completedAt: string | null;
  } | null;
  submittedBy: {
    id: string;
    displayName: string;
    email: string;
  };
  _count?: { activities: number };
};

export type ActivityProgressRecord = {
  id: string;
  companyId: string;
  projectId: string;
  activityId: string;
  progressDate: string;
  percentComplete: string;
  note: string | null;
  sourceType: string;
  sourceEntityId: string | null;
  recordedByUserId: string;
  createdAt: string;
  recordedBy?: {
    id: string;
    displayName: string;
    email: string;
  };
};

export type ScheduleComparisonRecord = {
  projectId: string;
  currentBaseline: {
    id: string;
    versionNo: number;
    approvedAt: string | null;
  } | null;
  activities: Array<{
    activityId: string;
    activityCode: string;
    activityName: string;
    wbs: { id: string; wbsCode: string; wbsName: string };
    isSummary: boolean;
    isMilestone: boolean;
    currentPercentComplete: number | null;
    actualStartDate: string | null;
    actualFinishDate: string | null;
    baselineStartDate: string | null;
    baselineFinishDate: string | null;
    forecastStartDate: string | null;
    forecastFinishDate: string | null;
    startVarianceWorkDays: number | null;
    finishVarianceWorkDays: number | null;
    delayWorkDays: number | null;
    delayStatus: 'DELAYED' | 'ON_TIME' | 'AHEAD' | 'UNAVAILABLE';
  }>;
};

export type SchedulePresentationRecord = {
  projectId: string;
  currentBaseline: {
    id: string;
    versionNo: number;
    approvedAt: string | null;
  } | null;
  window?: {
    asOfDate: string;
    endDate: string;
    days: 14 | 28;
  };
  activities: Array<{
    activityId: string;
    activityCode: string;
    activityName: string;
    wbs: { id: string; wbsCode: string; wbsName: string };
    isSummary: boolean;
    isMilestone: boolean;
    currentPercentComplete: number | null;
    actualStartDate: string | null;
    actualFinishDate: string | null;
    baselineStartDate: string | null;
    baselineFinishDate: string | null;
    forecastStartDate: string | null;
    forecastFinishDate: string | null;
    startVarianceWorkDays: number | null;
    finishVarianceWorkDays: number | null;
    delayWorkDays: number | null;
    delayStatus: 'DELAYED' | 'ON_TIME' | 'AHEAD' | 'UNAVAILABLE';
    totalFloatWorkDays: number | null;
    isCritical: boolean;
    predecessorActivityIds: string[];
  }>;
};

function query(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  return path + (search.toString() ? '?' + search.toString() : '');
}

export const schedulingApi = {
  projects: () => apiRequest<Data<ScheduleProject[]>>('/schedule/projects'),

  calendarProjects: () =>
    apiRequest<Data<ScheduleProject[]>>('/working-calendars/project-options'),
  calendars: (projectId?: string, active = 'all') =>
    apiRequest<Data<WorkingCalendarRecord[]>>(
      query('/working-calendars', {
        projectId,
        active: active === 'all' ? undefined : active,
      }),
    ),
  createCalendar: (body: Record<string, unknown>) =>
    apiRequest<Data<WorkingCalendarRecord>>('/working-calendars', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCalendar: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<WorkingCalendarRecord>>('/working-calendars/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  setCalendarActive: (id: string, active: boolean) =>
    apiRequest<Data<WorkingCalendarRecord>>(
      '/working-calendars/' + id + (active ? '/reactivate' : '/archive'),
      { method: 'POST' },
    ),
  replaceWeekdays: (id: string, weekdays: Array<Record<string, unknown>>) =>
    apiRequest<Data<CalendarWeekday[]>>('/working-calendars/' + id + '/weekdays', {
      method: 'PUT',
      body: JSON.stringify({ weekdays }),
    }),
  replaceExceptions: (
    id: string,
    exceptions: Array<Record<string, unknown>>,
  ) =>
    apiRequest<Data<CalendarException[]>>(
      '/working-calendars/' + id + '/exceptions',
      {
        method: 'PUT',
        body: JSON.stringify({ exceptions }),
      },
    ),

  activityTypes: (active = 'all') =>
    apiRequest<Data<ActivityTypeRecord[]>>(
      query('/activity-types', {
        active: active === 'all' ? undefined : active,
      }),
    ),
  createActivityType: (body: Record<string, unknown>) =>
    apiRequest<Data<ActivityTypeRecord>>('/activity-types', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateActivityType: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<ActivityTypeRecord>>('/activity-types/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  setActivityTypeActive: (id: string, active: boolean) =>
    apiRequest<Data<ActivityTypeRecord>>(
      '/activity-types/' + id + (active ? '/reactivate' : '/archive'),
      { method: 'POST' },
    ),

  activityOptions: (projectId: string) =>
    apiRequest<Data<ActivityOptions>>(
      query('/activities/options', { projectId }),
    ),
  activities: (projectId: string, active = 'all') =>
    apiRequest<Data<ActivityRecord[]>>(
      query('/activities', {
        projectId,
        active: active === 'all' ? undefined : active,
      }),
    ),
  createActivity: (body: Record<string, unknown>) =>
    apiRequest<Data<ActivityRecord>>('/activities', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateActivity: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<ActivityRecord>>('/activities/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  setActivityActive: (id: string, active: boolean) =>
    apiRequest<Data<ActivityRecord>>(
      '/activities/' + id + (active ? '/reactivate' : '/archive'),
      { method: 'POST' },
    ),

  baselineWorkflows: () =>
    apiRequest<Data<BaselineWorkflowOption[]>>('/schedule-baselines/workflow-options'),
  baselines: (projectId: string) =>
    apiRequest<Data<ScheduleBaselineRecord[]>>(
      query('/schedule-baselines', { projectId }),
    ),
  submitBaseline: (projectId: string, workflowCode: string) =>
    apiRequest<Data<ScheduleBaselineRecord>>('/schedule-baselines/submit', {
      method: 'POST',
      body: JSON.stringify({ projectId, workflowCode }),
    }),
  approveBaseline: (id: string, comment?: string) =>
    apiRequest<Data<ScheduleBaselineRecord>>('/schedule-baselines/' + id + '/approve', {
      method: 'POST',
      body: JSON.stringify({ comment: comment || null }),
    }),
  rejectBaseline: (id: string, comment?: string) =>
    apiRequest<Data<ScheduleBaselineRecord>>('/schedule-baselines/' + id + '/reject', {
      method: 'POST',
      body: JSON.stringify({ comment: comment || null }),
    }),
  comparison: (projectId: string) =>
    apiRequest<Data<ScheduleComparisonRecord>>(
      '/schedule/projects/' + projectId + '/comparison',
    ),
  gantt: (projectId: string) =>
    apiRequest<Data<SchedulePresentationRecord>>(
      '/schedule/projects/' + projectId + '/gantt',
    ),
  lookahead: (projectId: string, asOf: string, days: 14 | 28) =>
    apiRequest<Data<SchedulePresentationRecord>>(
      query('/schedule/projects/' + projectId + '/lookahead', {
        asOf,
        days: String(days),
      }),
    ),
  progressHistory: (activityId: string) =>
    apiRequest<Data<ActivityProgressRecord[]>>('/activity-progress/' + activityId),
  recordProgress: (
    activityId: string,
    body: { progressDate: string; percentComplete: string; note?: string | null },
  ) =>
    apiRequest<Data<ActivityProgressRecord>>('/activity-progress/' + activityId, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  dependencies: (projectId: string, active = 'all') =>
    apiRequest<Data<ActivityDependencyRecord[]>>(
      query('/activity-dependencies', {
        projectId,
        active: active === 'all' ? undefined : active,
      }),
    ),
  createDependency: (body: Record<string, unknown>) =>
    apiRequest<Data<ActivityDependencyRecord>>('/activity-dependencies', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateDependency: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<ActivityDependencyRecord>>(
      '/activity-dependencies/' + id,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  setDependencyActive: (id: string, active: boolean) =>
    apiRequest<Data<ActivityDependencyRecord>>(
      '/activity-dependencies/' +
        id +
        (active ? '/reactivate' : '/archive'),
      { method: 'POST' },
    ),
};
