import {
  Alert,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { managementApi } from '../api/management';

function localDateValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function money(currency: string, value: string | null) {
  return value === null ? 'Unavailable' : currency + ' ' + value;
}

function healthLabel(value: 'ON_TRACK' | 'ATTENTION' | 'CRITICAL') {
  return value === 'ON_TRACK'
    ? 'On track'
    : value === 'ATTENTION'
      ? 'Attention'
      : 'Critical';
}

export function ExecutivePortfolioDashboard() {
  const [asOf, setAsOf] = useState(localDateValue());
  const [days, setDays] = useState<14 | 28>(14);
  const query = useQuery({
    queryKey: ['management', 'portfolio', asOf, days],
    queryFn: () => managementApi.portfolio(asOf, days),
  });
  const portfolio = query.data?.data;

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h6">Executive / Cross-Project Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          Authorized read-only portfolio view over canonical ERP sources.
        </Typography>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
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

      {query.isPending ? <CircularProgress size={24} /> : null}
      {query.isError ? (
        <Alert severity="error">Unable to load the Executive portfolio.</Alert>
      ) : null}

      {portfolio ? (
        <>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={'Projects ' + portfolio.projectCount} variant="outlined" />
            <Chip
              label={'On track ' + portfolio.healthSummary.ON_TRACK}
              variant="outlined"
            />
            <Chip
              label={'Attention ' + portfolio.healthSummary.ATTENTION}
              variant="outlined"
            />
            <Chip
              label={'Critical ' + portfolio.healthSummary.CRITICAL}
              variant="outlined"
            />
            <Chip
              label={'Delayed activities ' + portfolio.totals.schedule.delayed}
              variant="outlined"
            />
            <Chip
              label={'Procurement at risk ' + portfolio.totals.procurement.atRisk}
              variant="outlined"
            />
            <Chip
              label={'Site issues ' + portfolio.totals.siteExecution.issues}
              variant="outlined"
            />
          </Stack>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={0.5}>
                <Typography variant="subtitle1">Portfolio commercial position</Typography>
                <Typography variant="body2">
                  Revised budget: {money(portfolio.baseCurrencyCode, portfolio.totals.cost.revisedBudget)}
                </Typography>
                <Typography variant="body2">
                  Forecast cost: {money(portfolio.baseCurrencyCode, portfolio.totals.cost.forecastCost)}
                </Typography>
                <Typography variant="body2">
                  Variance: {money(portfolio.baseCurrencyCode, portfolio.totals.cost.variance)}
                </Typography>
                <Typography variant="body2">
                  Forecast revenue: {money(portfolio.baseCurrencyCode, portfolio.totals.commercial.forecastRevenue)}
                </Typography>
                <Typography variant="body2">
                  Forecast profit:{' '}
                  {portfolio.totals.commercial.forecastProfit.status === 'AVAILABLE'
                    ? money(portfolio.baseCurrencyCode, portfolio.totals.commercial.forecastProfit.value)
                    : 'Unavailable across portfolio'}
                </Typography>
                <Typography variant="body2">
                  Net cash flow: {money(portfolio.baseCurrencyCode, portfolio.totals.finance.netCashFlow)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          {portfolio.projects.length === 0 ? (
            <Alert severity="info">
              No active Projects are available within your effective Project scope.
            </Alert>
          ) : null}

          {portfolio.projects.map((row) => (
            <Card key={row.project.id} variant="outlined">
              <CardContent>
                <Stack spacing={1}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                  >
                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                      {row.project.projectCode} · {row.project.projectName}
                    </Typography>
                    <Chip label={healthLabel(row.health.status)} variant="outlined" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {row.health.drivers.length
                      ? 'Risk signals: ' + row.health.drivers.join(' · ')
                      : 'No current derived risk signal requires attention.'}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip label={'Delayed ' + row.domains.schedule.summary.delayed} variant="outlined" />
                    <Chip label={'Procurement risk ' + row.domains.procurement.summary.AT_RISK} variant="outlined" />
                    <Chip label={'Site issues ' + row.domains.siteExecution.issueCount} variant="outlined" />
                    <Chip label={'Forecast cost ' + money(portfolio.baseCurrencyCode, row.domains.cost.forecastCost)} variant="outlined" />
                    <Chip label={'Forecast profit ' + money(portfolio.baseCurrencyCode, row.domains.cost.commercial.forecastProfit)} variant="outlined" />
                    <Chip label={'Net cash ' + money(portfolio.baseCurrencyCode, row.domains.finance.netCashFlow)} variant="outlined" />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}

          <Alert severity="info">
            Health is derived deterministically from approved source signals.
            Management cannot override source records, and protected drilldown
            still requires the owning module permission.
          </Alert>
        </>
      ) : null}
    </Stack>
  );
}
