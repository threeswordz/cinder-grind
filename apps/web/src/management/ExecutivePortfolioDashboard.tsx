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
              label={
                'Progress ' +
                portfolio.totals.schedule.completed +
                '/' +
                portfolio.totals.schedule.activities
              }
              variant="outlined"
            />
            <Chip
              label={'Delayed activities ' + portfolio.totals.schedule.delayed}
              variant="outlined"
            />
            <Chip
              label={'Critical activities ' + portfolio.totals.schedule.critical}
              variant="outlined"
            />
            <Chip
              label={
                'Lookahead (' +
                portfolio.lookaheadDays +
                'd) ' +
                portfolio.totals.schedule.lookahead
              }
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
            <Chip
              label={'Inventory balance rows ' + portfolio.totals.inventory.balanceRows}
              variant="outlined"
            />
            <Chip
              label={'Projects with stock ' + portfolio.totals.inventory.projectsWithStock}
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
                    <Chip label="Source signals only" variant="outlined" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Overall health severity is not classified because no approved
                    severity policy exists. Canonical source signals are shown below.
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      label={
                        'Progress ' +
                        row.domains.schedule.summary.completed +
                        '/' +
                        row.domains.schedule.summary.total
                      }
                      variant="outlined"
                    />
                    <Chip
                      label={'Delayed ' + row.domains.schedule.summary.delayed}
                      variant="outlined"
                    />
                    <Chip
                      label={'Critical ' + row.domains.schedule.summary.critical}
                      variant="outlined"
                    />
                    <Chip
                      label={
                        'Lookahead (' +
                        portfolio.lookaheadDays +
                        'd) ' +
                        row.domains.schedule.summary.lookahead
                      }
                      variant="outlined"
                    />
                    <Chip label={'Procurement risk ' + row.domains.procurement.summary.AT_RISK} variant="outlined" />
                    <Chip label={'Site issues ' + row.domains.siteExecution.issueCount} variant="outlined" />
                    <Chip label={'Inventory rows ' + row.domains.inventory.balanceRowCount} variant="outlined" />
                    <Chip label={'Forecast cost ' + money(portfolio.baseCurrencyCode, row.domains.cost.forecastCost)} variant="outlined" />
                    <Chip label={'Forecast profit ' + money(portfolio.baseCurrencyCode, row.domains.cost.commercial.forecastProfit)} variant="outlined" />
                    <Chip label={'Net cash ' + money(portfolio.baseCurrencyCode, row.domains.finance.netCashFlow)} variant="outlined" />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}

          <Alert severity="info">
            Management shows deterministic approved source signals only. No
            overall health-severity mapping is authoritative until a separate
            Product / Business Owner policy is approved. Management cannot
            override source records, and protected drilldown still requires the
            owning module permission.
          </Alert>
        </>
      ) : null}
    </Stack>
  );
}
