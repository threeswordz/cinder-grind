import { useEffect, useState } from 'react';
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

import { retentionApi } from '../api/finance';

export function RetentionFinanceWorkspace({
  permissions,
}: {
  permissions: string[];
}) {
  const canView = permissions.includes('finance.retention.view');
  const [projectId, setProjectId] = useState('');

  const projects = useQuery({
    queryKey: ['finance-retention-projects'],
    queryFn: retentionApi.projects,
    enabled: canView,
  });

  useEffect(() => {
    const rows = projects.data?.data ?? [];
    if (!projectId && rows[0]) setProjectId(rows[0].id);
    if (projectId && !rows.some((project) => project.id === projectId)) {
      setProjectId(rows[0]?.id ?? '');
    }
  }, [projectId, projects.data]);

  const retention = useQuery({
    queryKey: ['finance-retention', projectId],
    queryFn: () => retentionApi.list(projectId),
    enabled: canView && Boolean(projectId),
  });

  if (!canView) {
    return (
      <Alert severity="info">
        Retention visibility requires finance.retention.view.
      </Alert>
    );
  }
  if (projects.isLoading) return <CircularProgress />;

  return (
    <Stack spacing={2}>
      <Stack>
        <Typography variant="h5">Payable Retention</Typography>
        <Typography variant="body2" color="text.secondary">
          Read-only retention withholding and reversal evidence derived from
          approved Subcontract Certifications. Retention release and manual
          adjustment are intentionally outside V0.6-D.
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

      {retention.isError ? (
        <Alert severity="error">Unable to load payable retention evidence.</Alert>
      ) : null}
      {!retention.isFetching && (retention.data?.data ?? []).length === 0 ? (
        <Alert severity="info">
          No retained Subcontract Certification amount exists for this Project.
        </Alert>
      ) : null}

      {(retention.data?.data ?? []).map((row) => (
        <Card key={row.id} variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ md: 'center' }}
              >
                <Typography fontWeight={600} sx={{ flexGrow: 1 }}>
                  {row.certificationNumber} · {row.agreement.agreementNumber}
                </Typography>
                <Chip
                  label={row.financeState.replaceAll('_', ' ')}
                  color={
                    row.financeState === 'ACTIVE'
                      ? 'warning'
                      : row.financeState === 'REVERSED'
                        ? 'default'
                        : 'error'
                  }
                  size="small"
                />
              </Stack>
              <Typography variant="body2">
                {row.agreement.subcontractor.subcontractorCode} ·{' '}
                {row.agreement.subcontractor.subcontractorName}
              </Typography>
              {row.financeState === 'UNSUPPORTED_CURRENCY' ? (
                <Alert severity="warning">
                  {row.currencyCode} Certification is outside the Company base
                  currency {row.baseCurrencyCode}. Finance retention handoff is
                  deferred; no conversion is performed.
                </Alert>
              ) : (
                <Typography variant="body2">
                  Withheld {row.currencyCode} {row.retainedAmount} · Balance{' '}
                  {row.currencyCode} {row.retentionBalance ?? '—'}
                </Typography>
              )}
              {row.retentionLedgerEntries.map((entry) => (
                <Typography
                  key={entry.id}
                  variant="caption"
                  color="text.secondary"
                >
                  {entry.entryType} · {entry.currencyCode} {entry.amount} ·{' '}
                  {entry.recordedAt} · {entry.recordedBy.displayName}
                </Typography>
              ))}
              {row.reversalReason ? (
                <Typography variant="body2" color="text.secondary">
                  Reversal: {row.reversalReason}
                </Typography>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
