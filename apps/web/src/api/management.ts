import { apiDownload, apiRequest } from './client';

type Data<T> = { data: T };

export type ManagementProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

type Availability =
  | { status: 'AVAILABLE'; [key: string]: unknown }
  | { status: 'UNAVAILABLE'; reason: string };

export type ManagementProjectSummary = {
  contractVersion: string;
  project: ManagementProject & {
    plannedStartDate: string | null;
    plannedCompletionDate: string | null;
    actualStartDate: string | null;
    actualCompletionDate: string | null;
  };
  asOfDate: string;
  lookaheadDays: 14 | 28;
  baseCurrencyCode: string;
  domains: {
    schedule: {
      status: 'AVAILABLE';
      currentBaseline: Availability;
      summary: {
        total: number;
        critical: number;
        delayed: number;
        completed: number;
      };
      lookaheadActivityCount: number;
    };
    siteExecution: {
      status: 'AVAILABLE';
      recentReportCount: number;
      latestReportDate: string | null;
      issueCount: number;
      delayCount: number;
      inspectionCount: number;
      assignedEquipmentCount: number;
    };
    procurement: {
      status: 'AVAILABLE';
      summary: {
        total: number;
        AT_RISK: number;
        ON_TIME: number;
        UNAVAILABLE: number;
        rfq: number;
        awarded: number;
        purchaseOrder: number;
      };
    };
    inventory: {
      status: 'AVAILABLE';
      balanceRowCount: number;
      warehouseCount: number;
      materialCount: number;
      uomCount: number;
      positiveBalanceRowCount: number;
      negativeBalanceRowCount: number;
      zeroBalanceRowCount: number;
      movementRowCount: number;
      latestMovementAt: string | null;
      movementSources: {
        goodsReceipt: number;
        materialIssue: number;
        materialReturn: number;
        stockTransfer: number;
      };
      quantityAggregation: string;
    };
    cost: {
      status: 'AVAILABLE';
      originalBudget: string;
      revisedBudget: string;
      committedCost: string;
      actualCost: string;
      paidCost: string;
      remainingCommitment: string;
      uncommittedEtc: string;
      costToComplete: string;
      forecastCost: string;
      variance: string;
      commercial: {
        originalContractValue: string;
        approvedVariationValue: string;
        revisedContractValue: string;
        actualRevenue: string;
        cashReceived: string;
        forecastRevenue: string;
        actualProfit: string | null;
        forecastProfit: string | null;
      };
    };
    finance: {
      status: 'AVAILABLE';
      accountsPayable: {
        approvedInvoiceCount: number;
        outstandingInvoiceCount: number;
        outstandingAmount: string;
      };
      accountsReceivable: {
        approvedInvoiceCount: number;
        outstandingInvoiceCount: number;
        outstandingAmount: string;
      };
      inflowAmount: string;
      outflowAmount: string;
      netCashFlow: string;
    };
  };
  sourceTraceability: Record<
    'scheduleSite' | 'procurement' | 'inventory' | 'cost' | 'finance',
    {
      canonicalSource: string;
      sourceViewPermissionCodes: string[];
      sourceViewAvailable: boolean;
      protectedDetailPolicy: 'OWNING_MODULE_PERMISSION_REQUIRED';
    }
  >;
  boundaries: {
    readOnlyComposition: boolean;
    sourceModulesRemainCanonical: boolean;
    syntheticDimensionalAllocation: boolean;
    financialAuthority: string;
    baseCurrencyOnly: boolean;
    protectedDetailRequiresSourcePermission: boolean;
  };
};

type PortfolioOptionalMoney =
  | { status: 'AVAILABLE'; value: string; reason: null }
  | {
      status: 'UNAVAILABLE';
      value: null;
      reason: 'ONE_OR_MORE_PROJECT_VALUES_UNAVAILABLE';
    };

export type ManagementPortfolio = {
  contractVersion: 'V0.8-C';
  asOfDate: string;
  lookaheadDays: 14 | 28;
  baseCurrencyCode: string;
  projectCount: number;
  healthPolicy: {
    overallSeverity: 'NOT_APPROVED';
    presentation: 'SOURCE_SIGNALS_ONLY';
  };
  totals: {
    schedule: {
      activities: number;
      completed: number;
      delayed: number;
      critical: number;
      lookahead: number;
    };
    procurement: {
      demandLines: number;
      atRisk: number;
      onTime: number;
      unavailable: number;
    };
    siteExecution: {
      recentReports: number;
      issues: number;
      delays: number;
    };
    inventory: {
      balanceRows: number;
      projectsWithStock: number;
    };
    cost: {
      originalBudget: string;
      revisedBudget: string;
      committedCost: string;
      actualCost: string;
      paidCost: string;
      forecastCost: string;
      variance: string;
    };
    finance: {
      inflowAmount: string;
      outflowAmount: string;
      netCashFlow: string;
    };
    commercial: {
      revisedContractValue: string;
      actualRevenue: string;
      cashReceived: string;
      forecastRevenue: string;
      actualProfit: PortfolioOptionalMoney;
      forecastProfit: PortfolioOptionalMoney;
    };
  };
  projects: Array<{
    project: ManagementProjectSummary['project'];
    health: {
      overallSeverity: {
        status: 'UNAVAILABLE';
        reason: 'NO_APPROVED_OVERALL_HEALTH_SEVERITY_POLICY';
      };
      sourceSignals: {
        progress: {
          completedActivities: number;
          totalActivities: number;
          delayedActivities: number;
          criticalActivities: number;
          lookaheadActivities: number;
        };
        procurement: {
          atRiskLines: number;
          unavailableLines: number;
        };
        site: {
          issueCount: number;
          delayCount: number;
        };
        cost: {
          variance: string;
        };
        commercial: {
          forecastProfit: string;
        };
      };
    };
    domains: {
      schedule: {
        status: 'AVAILABLE';
        summary: {
          total: number;
          completed: number;
          delayed: number;
          critical: number;
          lookahead: number;
        };
      };
      siteExecution: {
        status: 'AVAILABLE';
        recentReportCount: number;
        issueCount: number;
        delayCount: number;
      };
      procurement: {
        status: 'AVAILABLE';
        summary: {
          total: number;
          AT_RISK: number;
          ON_TIME: number;
          UNAVAILABLE: number;
        };
      };
      inventory: {
        status: 'AVAILABLE';
        balanceRowCount: number;
        warehouseCount: number;
        materialCount: number;
        uomCount: number;
        quantityAggregation: string;
      };
      cost: ManagementProjectSummary['domains']['cost'];
      finance: ManagementProjectSummary['domains']['finance'];
    };
    sourceTraceability: ManagementProjectSummary['sourceTraceability'];
  }>;
  scope: {
    companyIsolated: boolean;
    inaccessibleProjectsExcludedBeforeAggregation: boolean;
    projectAccessAllIsSeparateFromManagementPermission: boolean;
    portfolioPermissionRequired: boolean;
  };
  boundaries: {
    readOnlyComposition: boolean;
    sourceModulesRemainCanonical: boolean;
    boundedPortfolioSourceReads: boolean;
    perProjectAuthorizationFanOut: boolean;
    deterministicHealthSignals: boolean;
    overallHealthSeverityPolicyApproved: boolean;
    manualHealthOverride: boolean;
    financialAuthority: string;
    baseCurrencyOnly: boolean;
    protectedDetailRequiresSourcePermission: boolean;
  };
  deferredToLaterStages: {
    domainDashboards: boolean;
    reportingExport: boolean;
  };
};

export type ManagementReportDomain =
  | 'ALL'
  | 'SCHEDULE'
  | 'PROCUREMENT'
  | 'INVENTORY'
  | 'COST'
  | 'COMMERCIAL'
  | 'FINANCE';

export type ManagementReportStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'COMPLETED'
  | 'DELAYED'
  | 'CRITICAL'
  | 'LOOKAHEAD'
  | 'AT_RISK'
  | 'ON_TIME';

export type ManagementReportFilters = {
  projectId: string;
  asOf: string;
  days: 14 | 28;
  domain: ManagementReportDomain;
  status?: ManagementReportStatus;
  fromDate?: string;
  toDate?: string;
  wbsId?: string;
  costCodeId?: string;
};

export type ManagementReport = {
  contractVersion: 'V0.8-E';
  project: ManagementProjectSummary['project'];
  asOfDate: string;
  lookaheadDays: 14 | 28;
  baseCurrencyCode: string;
  filters: {
    domain: ManagementReportDomain;
    status: ManagementReportStatus | null;
    fromDate: string | null;
    toDate: string | null;
    wbs: { id: string; wbsCode: string; wbsName: string } | null;
    costCode: { id: string; costCode: string; costName: string } | null;
    wbsIncludesDescendants: boolean;
    dateRangeAppliedDomains: readonly 'FINANCE'[];
  };
  rowCount: number;
  rows: Array<{
    domain: Exclude<ManagementReportDomain, 'ALL'>;
    metric: string;
    label: string;
    status: ManagementReportStatus;
    value: string | number | null;
    unit: 'COUNT' | 'MONEY';
    currencyCode: string | null;
    canonicalSource: string;
    sourceViewAvailable: boolean;
    sourceApiPath: string | null;
  }>;
  scope: {
    companyIsolated: boolean;
    effectiveProjectAccessRequired: boolean;
    inaccessibleProjectsExcluded: boolean;
    managementDashboardPermissionRequired: boolean;
  };
  boundaries: {
    readOnlyComposition: boolean;
    sourceModulesRemainCanonical: boolean;
    exportUsesSameAuthorizedResult: boolean;
    protectedDetailRequiresSourcePermission: boolean;
    financialAuthority: string;
    baseCurrencyOnly: boolean;
    syntheticDimensionalAllocation: boolean;
    predictiveAnalytics: boolean;
    persistedReportTruth: boolean;
  };
};

function managementReportPath(
  basePath: string,
  filters: ManagementReportFilters,
) {
  const params = new URLSearchParams({
    projectId: filters.projectId,
    asOf: filters.asOf,
    days: String(filters.days),
    domain: filters.domain,
  });
  if (filters.status) params.set('status', filters.status);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  if (filters.wbsId) params.set('wbsId', filters.wbsId);
  if (filters.costCodeId) params.set('costCodeId', filters.costCodeId);
  return basePath + '?' + params.toString();
}

function projectSummaryPath(projectId: string, asOf: string, days: 14 | 28) {
  const params = new URLSearchParams({
    asOf,
    days: String(days),
  });
  return '/management/projects/' + projectId + '/summary?' + params.toString();
}

export const managementApi = {
  projects: () =>
    apiRequest<Data<ManagementProject[]>>('/management/projects'),
  projectSummary: (projectId: string, asOf: string, days: 14 | 28) =>
    apiRequest<Data<ManagementProjectSummary>>(
      projectSummaryPath(projectId, asOf, days),
    ),
  portfolio: (asOf: string, days: 14 | 28) => {
    const params = new URLSearchParams({
      asOf,
      days: String(days),
    });
    return apiRequest<Data<ManagementPortfolio>>(
      '/management/portfolio?' + params.toString(),
    );
  },
  report: (filters: ManagementReportFilters) =>
    apiRequest<Data<ManagementReport>>(
      managementReportPath('/management/reports', filters),
    ),
  exportReport: (filters: ManagementReportFilters) =>
    apiDownload(
      managementReportPath('/management/reports/export.csv', filters),
    ),
};
