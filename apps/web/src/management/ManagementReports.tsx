import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  ManagementReportDomain,
  ManagementReportFilters,
  ManagementReportStatus,
  managementApi,
} from '../api/management';

function localDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

const domains: ManagementReportDomain[] = [
  'ALL',
  'SCHEDULE',
  'PROCUREMENT',
  'INVENTORY',
  'COST',
  'COMMERCIAL',
  'FINANCE',
];

const statuses: Array<ManagementReportStatus | ''> = [
  '',
  'AVAILABLE',
  'UNAVAILABLE',
  'COMPLETED',
  'DELAYED',
  'CRITICAL',
  'LOOKAHEAD',
  'AT_RISK',
  'ON_TIME',
];

export function ManagementReports({
  permissions,
}: {
  permissions: string[];
}) {
  const [projectId, setProjectId] = useState('');
  const [asOf, setAsOf] = useState(localDateValue());
  const [days, setDays] = useState<14 | 28>(14);
  const [domain, setDomain] = useState<ManagementReportDomain>('ALL');
  const [status, setStatus] = useState<ManagementReportStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exportError, setExportError] = useState(false);

  const canExport = permissions.includes('management.report.export');
  const dateRangeSupported = domain === 'ALL' || domain === 'FINANCE';

  const filters: ManagementReportFilters = {
    projectId,
    asOf,
    days,
    domain,
    ...(status ? { status } : {}),
    ...(dateRangeSupported && fromDate ? { fromDate } : {}),
    ...(dateRangeSupported && toDate ? { toDate } : {}),
  };

  const projects = useQuery({
    queryKey: ['management', 'projects'],
    queryFn: managementApi.projects,
  });

  const report = useQuery({
    queryKey: [
      'management',
      'report',
      projectId,
      asOf,
      days,
      domain,
      status,
      dateRangeSupported ? fromDate : '',
      dateRangeSupported ? toDate : '',
    ],
    queryFn: () => managementApi.report(filters),
    enabled: Boolean(projectId && asOf),
  });

  async function exportCsv() {
    setExportError(false);
    try {
      const result = await managementApi.exportReport(filters);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName ?? 'management-report.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    }
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h6">Management Reports</Typography>
        <Typography variant="body2" color="text.secondary">
          V0.8-E read-only cross-module reporting over canonical ERP sources.
          CSV export uses the same server-authorized filters and result rows.
        </Typography>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
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
                onChange={(event) =>
                  setDays(Number(event.target.value) as 14 | 28)
                }
                sx={{ minWidth: 140 }}
              >
                <MenuItem value={14}>2 weeks</MenuItem>
                <MenuItem value={28}>4 weeks</MenuItem>
              </TextField>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField
                select
                label="Domain"
                value={domain}
                onChange={(event) =>
                  setDomain(event.target.value as ManagementReportDomain)
                }
                sx={{ minWidth: 180 }}
              >
                {domains.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ManagementReportStatus | '')
                }
                sx={{ minWidth: 180 }}
              >
                {statuses.map((value) => (
                  <MenuItem key={value || 'ANY'} value={value}>
                    {value || 'Any status'}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Cash flow from"
                type="date"
                disabled={!dateRangeSupported}
                value={dateRangeSupported ? fromDate : ''}
                onChange={(event) => setFromDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Cash flow to"
                type="date"
                disabled={!dateRangeSupported}
                value={dateRangeSupported ? toDate : ''}
                onChange={(event) => setToDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Button
                variant="outlined"
                onClick={() => window.print()}
                disabled={!report.data?.data}
              >
                Print view
              </Button>
              {canExport ? (
                <Button
                  variant="contained"
                  onClick={() => void exportCsv()}
                  disabled={!projectId || report.isFetching}
                >
                  Export CSV
                </Button>
              ) : (
                <Alert severity="info">
                  CSV export requires management.report.export.
                </Alert>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {projects.isError ? (
        <Alert severity="error">Unable to load authorized Projects.</Alert>
      ) : null}
      {report.isError ? (
        <Alert severity="error">
          Unable to load the Management report for these filters.
        </Alert>
      ) : null}
      {exportError ? (
        <Alert severity="error">Unable to export the Management report.</Alert>
      ) : null}
      {!projectId ? (
        <Alert severity="info">
          Select an authorized Project to run the report.
        </Alert>
      ) : null}

      {report.data?.data ? (
        <>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="subtitle1">
                  {report.data.data.project.projectCode} ·{' '}
                  {report.data.data.project.projectName}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    size="small"
                    label={'Rows ' + report.data.data.rowCount}
                  />
                  <Chip
                    size="small"
                    label={'Domain ' + report.data.data.filters.domain}
                  />
                  <Chip
                    size="small"
                    label={
                      'Status ' +
                      (report.data.data.filters.status ?? 'ANY')
                    }
                  />
                  <Chip
                    size="small"
                    label={'Base currency ' + report.data.data.baseCurrencyCode}
                  />
                </Stack>
                {report.data.data.filters.fromDate ||
                report.data.data.filters.toDate ? (
                  <Typography variant="body2" color="text.secondary">
                    Finance cash-flow period:{' '}
                    {report.data.data.filters.fromDate ?? 'start'} →{' '}
                    {report.data.data.filters.toDate ?? 'end'}
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <TableContainer component={Card} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Domain</TableCell>
                  <TableCell>Metric</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell>Source</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.data.data.rows.map((row) => (
                  <TableRow key={row.domain + ':' + row.metric}>
                    <TableCell>{row.domain}</TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2">{row.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.metric}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={row.status} />
                    </TableCell>
                    <TableCell align="right">
                      {row.value === null
                        ? 'Unavailable'
                        : row.unit === 'MONEY'
                          ? (row.currencyCode ?? '') + ' ' + String(row.value)
                          : String(row.value)}
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2">
                          {row.canonicalSource}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.sourceViewAvailable
                            ? 'Protected drilldown permitted'
                            : 'Aggregate only'}
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {report.data.data.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      No report rows match the selected status/domain filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>

          <Alert severity="info">
            Management reporting is read-only composition. Source modules remain
            canonical; protected detail still requires the owning-module
            permission. WBS/Cost Code filters are available through the API only
            for Cost/Commercial where canonical dimensional attribution exists.
          </Alert>
        </>
      ) : null}
    </Stack>
  );
}
