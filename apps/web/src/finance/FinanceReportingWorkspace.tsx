import { useEffect, useState } from 'react';
import {
  Alert,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import {
  cashFlowApi,
  clientFinanceApi,
  paymentApi,
  retentionApi,
} from '../api/finance';

function money(currency: string, value: string | null | undefined) {
  return currency + ' ' + (value ?? '0.00');
}

export function FinanceReportingWorkspace({
  permissions,
}: {
  permissions: string[];
}) {
  const canAp = permissions.includes('finance.ap.view');
  const canAr = permissions.includes('finance.ar.view');
  const canPayment = permissions.includes('finance.payment.view');
  const canRetention = permissions.includes('finance.retention.view');
  const hasAccess = canAp || canAr || canPayment || canRetention;
  const [projectId, setProjectId] = useState('');
  const [cashFromDate, setCashFromDate] = useState('');
  const [cashToDate, setCashToDate] = useState('');

  const projects = useQuery({
    queryKey: [
      'v06e-finance-report-projects',
      canAp,
      canAr,
      canPayment,
      canRetention,
    ],
    queryFn: () =>
      canPayment
        ? cashFlowApi.projects()
        : canRetention
          ? retentionApi.projects()
          : canAr
            ? clientFinanceApi.accountsReceivableProjects()
            : clientFinanceApi.accountsPayableProjects(),
    enabled: hasAccess,
  });

  useEffect(() => {
    const rows = projects.data?.data ?? [];
    if (!projectId && rows[0]) setProjectId(rows[0].id);
    if (projectId && !rows.some((project) => project.id === projectId)) {
      setProjectId(rows[0]?.id ?? '');
    }
  }, [projectId, projects.data]);

  const ap = useQuery({
    queryKey: ['v06e-report-ap', projectId],
    queryFn: () => clientFinanceApi.accountsPayable(projectId),
    enabled: canAp && Boolean(projectId),
  });
  const ar = useQuery({
    queryKey: ['v06e-report-ar', projectId],
    queryFn: () => clientFinanceApi.accountsReceivable(projectId),
    enabled: canAr && Boolean(projectId),
  });
  const payments = useQuery({
    queryKey: ['v06e-report-payments', projectId],
    queryFn: () => paymentApi.list(projectId),
    enabled: canPayment && Boolean(projectId),
  });
  const retention = useQuery({
    queryKey: ['v06e-report-retention', projectId],
    queryFn: () => retentionApi.list(projectId),
    enabled: canRetention && Boolean(projectId),
  });
  const cashFlow = useQuery({
    queryKey: [
      'v06e-report-cash-flow',
      projectId,
      cashFromDate,
      cashToDate,
    ],
    queryFn: () =>
      cashFlowApi.report(projectId, {
        ...(cashFromDate ? { fromDate: cashFromDate } : {}),
        ...(cashToDate ? { toDate: cashToDate } : {}),
      }),
    enabled: canPayment && Boolean(projectId),
  });

  if (!hasAccess) {
    return (
      <Alert severity="info">
        Finance reporting requires an existing AP, AR, Payment or Retention view
        permission.
      </Alert>
    );
  }
  if (projects.isLoading) return <CircularProgress />;

  const reportErrors = [ap, ar, payments, retention, cashFlow].some(
    (query) => query.isError,
  );
  const cash = cashFlow.data?.data;

  return (
    <Stack spacing={2}>
      <Stack>
        <Typography variant="h5">Finance Reports</Typography>
        <Typography variant="body2" color="text.secondary">
          Read-only Project Finance reporting from canonical AP, AR, Payment and
          retention sources. Project Cash Flow counts each final approved,
          non-cancelled Payment once on its Payment date; allocations remain
          settlement traceability only.
        </Typography>
      </Stack>

      <TextField
        select
        label="Project"
        value={projectId}
        onChange={(event) => setProjectId(event.target.value)}
      >
        {(projects.data?.data ?? []).map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} · {project.projectName}
            {!project.isActive ? ' · archived' : ''}
          </MenuItem>
        ))}
      </TextField>

      {canPayment ? (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Cash flow from"
            type="date"
            value={cashFromDate}
            onChange={(event) => setCashFromDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Cash flow to"
            type="date"
            value={cashToDate}
            onChange={(event) => setCashToDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Stack>
      ) : null}

      {reportErrors ? (
        <Alert severity="error">
          One or more Finance reports could not be loaded.
        </Alert>
      ) : null}

      {canPayment && cash ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="h6">Project Cash Flow</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Typography>
                  Inflow:{' '}
                  <strong>
                    {money(cash.baseCurrencyCode, cash.totals.inflowAmount)}
                  </strong>
                </Typography>
                <Typography>
                  Outflow:{' '}
                  <strong>
                    {money(cash.baseCurrencyCode, cash.totals.outflowAmount)}
                  </strong>
                </Typography>
                <Typography>
                  Net:{' '}
                  <strong>
                    {money(cash.baseCurrencyCode, cash.totals.netCashFlow)}
                  </strong>
                </Typography>
              </Stack>
              <Divider />
              {cash.rows.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No final approved, non-cancelled Payments contribute to this
                  Project yet.
                </Typography>
              ) : (
                cash.rows.map((row) => (
                  <Stack
                    key={row.id}
                    spacing={0.5}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                      alignItems={{ md: 'center' }}
                    >
                      <Typography fontWeight={600} sx={{ flexGrow: 1 }}>
                        {row.paymentNumber} · {row.paymentDate.slice(0, 10)}
                      </Typography>
                      <Chip
                        size="small"
                        label={row.paymentDirection}
                        color={
                          row.paymentDirection === 'INBOUND'
                            ? 'success'
                            : 'default'
                        }
                      />
                      <Chip size="small" label={row.settlementStatus} />
                    </Stack>
                    <Typography variant="body2">
                      {row.counterparty
                        ? row.counterparty.code + ' · ' + row.counterparty.name
                        : 'No counterparty'}{' '}
                      · {money(row.currencyCode, row.amount)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Settlement allocation:{' '}
                      {money(row.currencyCode, row.allocatedAmount)} ·
                      unallocated {money(row.currencyCode, row.unallocatedAmount)}
                      {row.reference ? ' · ref ' + row.reference : ''}
                    </Typography>
                    {row.allocations.map((allocation) => (
                      <Typography
                        key={allocation.targetType + ':' + allocation.targetId}
                        variant="caption"
                        color="text.secondary"
                      >
                        {allocation.targetType} · {allocation.targetNumber} ·{' '}
                        {money(row.currencyCode, allocation.allocatedAmount)}
                      </Typography>
                    ))}
                  </Stack>
                ))
              )}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canAp ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">Accounts Payable</Typography>
              {(ap.data?.data ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No approved Supplier Invoice payable rows.
                </Typography>
              ) : (
                (ap.data?.data ?? []).map((row) => (
                  <Typography key={row.id} variant="body2">
                    {row.supplierInvoiceNumber} · {row.supplier.supplierName} ·{' '}
                    {money(row.currencyCode, row.outstandingAmount)} outstanding
                    {row.dueDate ? ' · due ' + row.dueDate.slice(0, 10) : ''}
                  </Typography>
                ))
              )}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canAr ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">Accounts Receivable</Typography>
              {(ar.data?.data ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No approved Client Invoice receivable rows.
                </Typography>
              ) : (
                (ar.data?.data ?? []).map((row) => (
                  <Typography key={row.id} variant="body2">
                    {row.clientInvoiceNumber} · {row.customer.customerName} ·{' '}
                    {money(row.currencyCode, row.outstandingAmount)} outstanding
                    {row.dueDate ? ' · due ' + row.dueDate.slice(0, 10) : ''}
                  </Typography>
                ))
              )}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canPayment ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">Payment Register</Typography>
              {(payments.data?.data ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No Payments exist for this Project.
                </Typography>
              ) : (
                (payments.data?.data ?? []).map((row) => (
                  <Stack
                    key={row.id}
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    alignItems={{ md: 'center' }}
                  >
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      {row.paymentNumber} · {row.paymentDate.slice(0, 10)} ·{' '}
                      {row.paymentDirection} · {money(row.currencyCode, row.amount)}
                    </Typography>
                    <Chip size="small" label={row.state} />
                    {row.cancelledAt ? (
                      <Chip size="small" color="warning" label="CANCELLED" />
                    ) : null}
                  </Stack>
                ))
              )}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canRetention ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">Payable Retention</Typography>
              {(retention.data?.data ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No payable retention rows.
                </Typography>
              ) : (
                (retention.data?.data ?? []).map((row) => (
                  <Typography key={row.id} variant="body2">
                    {row.certificationNumber} · {row.agreement.agreementNumber} ·{' '}
                    {row.financeState} ·{' '}
                    {row.retentionBalance === null
                      ? 'balance unavailable'
                      : money(row.currencyCode, row.retentionBalance)}
                  </Typography>
                ))
              )}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Alert severity="info">
        Committed Cost, Actual Cost and Paid Cost remain separate V0.7 Cost
        Control measures. This report does not create or edit an accounting
        ledger.
      </Alert>
    </Stack>
  );
}
