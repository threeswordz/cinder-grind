import { useEffect, useState } from 'react';
import {
  Alert,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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

import { ApiError } from '../api/client';
import { costControlApi } from '../api/cost-control';

function message(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The report could not be loaded.';
}

export function CostControlReportPanel({
  projectId,
  canView,
}: {
  projectId: string;
  canView: boolean;
}) {
  const [wbsId, setWbsId] = useState('');
  const [costCodeId, setCostCodeId] = useState('');

  useEffect(() => {
    setWbsId('');
    setCostCodeId('');
  }, [projectId]);

  const report = useQuery({
    queryKey: ['cost-control-rpt009', projectId, wbsId, costCodeId],
    queryFn: () =>
      costControlApi.readModel(projectId, {
        ...(wbsId ? { wbsId } : {}),
        ...(costCodeId ? { costCodeId } : {}),
      }),
    enabled: canView && Boolean(projectId),
  });

  if (!projectId || !canView) return null;

  if (report.isPending) {
    return (
      <Card variant="outlined">
        <CardContent>
          <CircularProgress size={24} />
        </CardContent>
      </Card>
    );
  }

  if (report.isError) {
    return <Alert severity="error">{message(report.error)}</Alert>;
  }

  const data = report.data.data;
  const currency = data.baseCurrencyCode;
  const evidenceRows = Object.entries(data.sourceEvidence);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h6">Cost Report · RPT-009</Typography>
            <Typography variant="body2" color="text.secondary">
              Server-derived Project / WBS / Cost Code reporting. Parent WBS
              filters include descendants. Missing dimensions remain explicit
              as Unallocated; no proportional allocation is performed.
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              select
              label="WBS report filter"
              value={wbsId}
              onChange={(event) => setWbsId(event.target.value)}
              sx={{ flex: 1 }}
            >
              <MenuItem value="">All WBS / include Unallocated</MenuItem>
              {data.reportDimensions.wbs.map((wbs) => (
                <MenuItem key={wbs.id} value={wbs.id}>
                  {wbs.wbsCode} · {wbs.wbsName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Cost Code report filter"
              value={costCodeId}
              onChange={(event) => setCostCodeId(event.target.value)}
              sx={{ flex: 1 }}
            >
              <MenuItem value="">All Cost Codes / include Unallocated</MenuItem>
              {data.reportDimensions.costCodes.map((costCode) => (
                <MenuItem key={costCode.id} value={costCode.id}>
                  {costCode.costCode} · {costCode.costName}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {data.filters.wbsIncludesDescendants ? (
            <Alert severity="info">
              Selected parent WBS totals include eligible descendant WBS
              values without double counting.
            </Alert>
          ) : null}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap">
            <Chip label={'Budget ' + currency + ' ' + data.totals.revisedBudget} />
            <Chip label={'Committed ' + currency + ' ' + data.totals.committedCost.total} />
            <Chip label={'Actual ' + currency + ' ' + data.totals.actualCost.total} />
            <Chip label={'Paid ' + currency + ' ' + data.totals.paidCost.total} />
            <Chip label={'Forecast ' + currency + ' ' + data.totals.forecastCost} />
            <Chip label={'Cost to Complete ' + currency + ' ' + data.totals.costToComplete} />
            <Chip label={'Variance ' + currency + ' ' + data.totals.variance} />
          </Stack>

          <TableContainer>
            <Table size="small" aria-label="Cost Control dimensional report">
              <TableHead>
                <TableRow>
                  <TableCell>WBS</TableCell>
                  <TableCell>Cost Code</TableCell>
                  <TableCell>Allocation</TableCell>
                  <TableCell align="right">Budget</TableCell>
                  <TableCell align="right">Committed</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Forecast</TableCell>
                  <TableCell align="right">CTC</TableCell>
                  <TableCell align="right">Variance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.dimensionBreakdown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      No cost values exist for the selected report dimensions.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.dimensionBreakdown.map((row, index) => (
                    <TableRow
                      key={
                        (row.wbs?.id ?? 'UNALLOCATED') +
                        '|' +
                        (row.costCode?.id ?? 'UNALLOCATED') +
                        '|' +
                        index
                      }
                    >
                      <TableCell>
                        {row.wbs
                          ? row.wbs.wbsCode + ' · ' + row.wbs.wbsName
                          : 'Unallocated WBS'}
                      </TableCell>
                      <TableCell>
                        {row.costCode
                          ? row.costCode.costCode + ' · ' + row.costCode.costName
                          : 'Unallocated Cost Code'}
                      </TableCell>
                      <TableCell>{row.allocationState}</TableCell>
                      <TableCell align="right">{row.revisedBudget}</TableCell>
                      <TableCell align="right">{row.committedCost.total}</TableCell>
                      <TableCell align="right">{row.actualCost.total}</TableCell>
                      <TableCell align="right">{row.paidCost.total}</TableCell>
                      <TableCell align="right">{row.forecastCost}</TableCell>
                      <TableCell align="right">{row.costToComplete}</TableCell>
                      <TableCell align="right">{row.variance}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack spacing={1}>
            <Typography variant="subtitle1">Source traceability</Typography>
            <Typography variant="body2" color="text.secondary">
              Aggregate amounts stay visible under cost.control.view. Source
              record details are exposed only when the matching source-module
              permission is present.
            </Typography>
            <TableContainer>
              <Table size="small" aria-label="Cost Control source traceability">
                <TableHead>
                  <TableRow>
                    <TableCell>Measure</TableCell>
                    <TableCell>Canonical owner</TableCell>
                    <TableCell align="right">Records</TableCell>
                    <TableCell>Source details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {evidenceRows.map(([measure, evidence]) => (
                    <TableRow key={measure}>
                      <TableCell>{measure}</TableCell>
                      <TableCell>{evidence.canonicalOwner}</TableCell>
                      <TableCell align="right">{evidence.recordCount}</TableCell>
                      <TableCell>
                        {evidence.recordsVisible ? 'Authorized' : 'Sanitized'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
