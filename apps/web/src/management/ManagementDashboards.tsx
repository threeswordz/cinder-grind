import {
  Alert,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  ManagementProjectSummary,
  managementApi,
} from '../api/management';
import { GanttLookaheadPanel } from '../scheduling/GanttLookaheadPanel';

type DashboardMode = 'engineer' | 'manager';

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '—';
}

function money(currency: string, value: string | null) {
  return value === null ? 'Unavailable' : currency + ' ' + value;
}

function MetricCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ flex: '1 1 280px' }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1">{title}</Typography>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

function SourceBoundary({
  summary,
}: {
  summary: ManagementProjectSummary;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1">Source ownership & drilldown</Typography>
          <Typography variant="body2" color="text.secondary">
            These dashboards are read-only compositions of canonical ERP
            sources. Protected detail remains available only through the owning
            module permissions.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {Object.entries(summary.sourceTraceability).map(([key, source]) => (
              <Chip
                key={key}
                size="small"
                variant="outlined"
                label={
                  source.canonicalSource +
                  (source.sourceViewAvailable
                    ? ' · detail permitted'
                    : ' · aggregate only')
                }
              />
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ScheduleCard({
  summary,
}: {
  summary: ManagementProjectSummary;
}) {
  const schedule = summary.domains.schedule;
  const baseline =
    schedule.currentBaseline.status === 'AVAILABLE'
      ? 'Baseline v' + String(schedule.currentBaseline.versionNo ?? '')
      : 'No approved baseline';

  return (
    <MetricCard title="Schedule & progress">
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip label={'Activities ' + schedule.summary.total} variant="outlined" />
        <Chip label={'Completed ' + schedule.summary.completed} variant="outlined" />
        <Chip label={'Delayed ' + schedule.summary.delayed} variant="outlined" />
        <Chip label={'Critical ' + schedule.summary.critical} variant="outlined" />
        <Chip
          label={'Lookahead ' + schedule.lookaheadActivityCount}
          variant="outlined"
        />
        <Chip label={baseline} variant="outlined" />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Planned {dateValue(summary.project.plannedStartDate)} →{' '}
        {dateValue(summary.project.plannedCompletionDate)} · Actual{' '}
        {dateValue(summary.project.actualStartDate)} →{' '}
        {dateValue(summary.project.actualCompletionDate)}
      </Typography>
    </MetricCard>
  );
}

function SiteCard({
  summary,
}: {
  summary: ManagementProjectSummary;
}) {
  const site = summary.domains.siteExecution;
  return (
    <MetricCard title="Site execution">
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip label={'Recent reports ' + site.recentReportCount} variant="outlined" />
        <Chip label={'Issues ' + site.issueCount} variant="outlined" />
        <Chip label={'Delays ' + site.delayCount} variant="outlined" />
        <Chip label={'Inspections ' + site.inspectionCount} variant="outlined" />
        <Chip
          label={'Assigned equipment ' + site.assignedEquipmentCount}
          variant="outlined"
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Latest Daily Site Report: {dateValue(site.latestReportDate)}
      </Typography>
    </MetricCard>
  );
}

function ProcurementCard({
  summary,
}: {
  summary: ManagementProjectSummary;
}) {
  const procurement = summary.domains.procurement.summary;
  return (
    <MetricCard title="Procurement risk">
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip label={'Demand lines ' + procurement.total} variant="outlined" />
        <Chip label={'At risk ' + procurement.AT_RISK} variant="outlined" />
        <Chip label={'On time ' + procurement.ON_TIME} variant="outlined" />
        <Chip label={'Unavailable ' + procurement.UNAVAILABLE} variant="outlined" />
        <Chip label={'RFQ ' + procurement.rfq} variant="outlined" />
        <Chip label={'Awarded ' + procurement.awarded} variant="outlined" />
        <Chip
          label={'Purchase Order ' + procurement.purchaseOrder}
          variant="outlined"
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Risk reuses canonical Required-on-Site versus Expected Delivery
        semantics.
      </Typography>
    </MetricCard>
  );
}

function CostCard({
  summary,
}: {
  summary: ManagementProjectSummary;
}) {
  const cost = summary.domains.cost;
  return (
    <MetricCard title="Cost Control position">
      <Stack spacing={0.5}>
        <Typography variant="body2">
          Revised budget: {money(summary.baseCurrencyCode, cost.revisedBudget)}
        </Typography>
        <Typography variant="body2">
          Committed: {money(summary.baseCurrencyCode, cost.committedCost)}
        </Typography>
        <Typography variant="body2">
          Actual: {money(summary.baseCurrencyCode, cost.actualCost)}
        </Typography>
        <Typography variant="body2">
          Paid: {money(summary.baseCurrencyCode, cost.paidCost)}
        </Typography>
        <Typography variant="body2">
          Forecast cost: {money(summary.baseCurrencyCode, cost.forecastCost)}
        </Typography>
        <Typography variant="body2">
          Variance: {money(summary.baseCurrencyCode, cost.variance)}
        </Typography>
      </Stack>
    </MetricCard>
  );
}

function CommercialCard({
  summary,
}: {
  summary: ManagementProjectSummary;
}) {
  const commercial = summary.domains.cost.commercial;
  return (
    <MetricCard title="Commercial & cash">
      <Stack spacing={0.5}>
        <Typography variant="body2">
          Revised contract:{' '}
          {money(summary.baseCurrencyCode, commercial.revisedContractValue)}
        </Typography>
        <Typography variant="body2">
          Actual revenue:{' '}
          {money(summary.baseCurrencyCode, commercial.actualRevenue)}
        </Typography>
        <Typography variant="body2">
          Forecast revenue:{' '}
          {money(summary.baseCurrencyCode, commercial.forecastRevenue)}
        </Typography>
        <Typography variant="body2">
          Actual profit:{' '}
          {money(summary.baseCurrencyCode, commercial.actualProfit)}
        </Typography>
        <Typography variant="body2">
          Forecast profit:{' '}
          {money(summary.baseCurrencyCode, commercial.forecastProfit)}
        </Typography>
        <Divider />
        <Typography variant="body2">
          Net cash flow:{' '}
          {money(
            summary.baseCurrencyCode,
            summary.domains.finance.netCashFlow,
          )}
        </Typography>
      </Stack>
    </MetricCard>
  );
}

export function ManagementDashboards({
  permissions,
}: {
  permissions: string[];
}) {
  const [mode, setMode] = useState<DashboardMode>('engineer');
  const [projectId, setProjectId] = useState('');
  const [asOf, setAsOf] = useState(localDateValue());
  const [days, setDays] = useState<14 | 28>(14);

  const projects = useQuery({
    queryKey: ['management', 'projects'],
    queryFn: managementApi.projects,
  });
  const summaryQuery = useQuery({
    queryKey: ['management', 'project-summary', projectId, asOf, days],
    queryFn: () => managementApi.projectSummary(projectId, asOf, days),
    enabled: Boolean(projectId && asOf),
  });

  const summary = summaryQuery.data?.data;
  const canViewGantt = permissions.includes('schedule.programme.view');

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h6">Management Dashboards</Typography>
        <Typography variant="body2" color="text.secondary">
          V0.8-B read-only Project dashboards over canonical ERP sources.
        </Typography>
      </Stack>

      <Tabs
        value={mode}
        onChange={(_event, value: DashboardMode) => setMode(value)}
      >
        <Tab value="engineer" label="Project Engineer" />
        <Tab value="manager" label="Project Manager" />
      </Tabs>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <TextField
          select
          label="Project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          sx={{ flexGrow: 1 }}
        >
          <MenuItem value="">Select Project</MenuItem>
          {(projects.data?.data ?? []).map((project) => (
            <MenuItem key={project.id} value={project.id}>
              {project.projectCode} · {project.projectName}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="As of"
          type="date"
          value={asOf}
          onChange={(event) => setAsOf(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          select
          label="Lookahead"
          value={days}
          onChange={(event) => setDays(Number(event.target.value) as 14 | 28)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value={14}>2 weeks</MenuItem>
          <MenuItem value={28}>4 weeks</MenuItem>
        </TextField>
      </Stack>

      {projects.isError ? (
        <Alert severity="error">Unable to load authorized Projects.</Alert>
      ) : null}
      {summaryQuery.isError ? (
        <Alert severity="error">Unable to load the Management dashboard.</Alert>
      ) : null}
      {!projectId ? (
        <Alert severity="info">
          Select an authorized Project to view the dashboard.
        </Alert>
      ) : null}

      {summary ? (
        <>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="subtitle1">
                  {summary.project.projectCode} · {summary.project.projectName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  As of {summary.asOfDate} · {summary.lookaheadDays}-day lookahead
                  · base currency {summary.baseCurrencyCode}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          {mode === 'engineer' ? (
            <>
              <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                <ScheduleCard summary={summary} />
                <SiteCard summary={summary} />
                <ProcurementCard summary={summary} />
              </Stack>
              <Alert severity="info">
                Current-work and source-record detail remains in the owning
                Scheduling, Site Execution and Procurement modules. This
                dashboard preserves aggregate visibility without widening
                source permissions.
              </Alert>
            </>
          ) : (
            <>
              <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                <ScheduleCard summary={summary} />
                <ProcurementCard summary={summary} />
                <SiteCard summary={summary} />
                <CostCard summary={summary} />
                <CommercialCard summary={summary} />
              </Stack>

              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="subtitle1">
                      Gantt, progress & lookahead
                    </Typography>
                    {canViewGantt ? (
                      <GanttLookaheadPanel
                        fixedProjectId={projectId}
                        hideTitle
                      />
                    ) : (
                      <Alert severity="info">
                        The Management dashboard can show schedule aggregates,
                        but detailed Gantt/activity drilldown requires the
                        owning Scheduling permission
                        <strong> schedule.programme.view</strong>.
                      </Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}

          <SourceBoundary summary={summary} />
        </>
      ) : null}
    </Stack>
  );
}
