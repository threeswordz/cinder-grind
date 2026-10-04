import { apiRequest } from './client';

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
  healthSummary: {
    ON_TRACK: number;
    ATTENTION: number;
    CRITICAL: number;
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
      status: 'ON_TRACK' | 'ATTENTION' | 'CRITICAL';
      drivers: string[];
    };
    domains: ManagementProjectSummary['domains'];
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
    deterministicHealthSignals: boolean;
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
};
