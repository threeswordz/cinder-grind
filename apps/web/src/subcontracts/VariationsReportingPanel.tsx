import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  VariationRecord,
  subcontractsApi,
} from '../api/subcontracts';

export function VariationsReportingPanel({
  permissions,
}: {
  permissions: string[];
}) {
  const client = useQueryClient();
  const canView = permissions.includes('subcontracts.variation.view');
  const canCreate = permissions.includes('subcontracts.variation.create');
  const canEdit = permissions.includes('subcontracts.variation.edit');
  const canSubmit = permissions.includes('subcontracts.variation.submit');
  const canApprove = permissions.includes('subcontracts.variation.approve');
  const canReject = permissions.includes('subcontracts.variation.reject');
  const canReverse = permissions.includes('subcontracts.variation.reverse');
  const canReport = permissions.includes('subcontracts.report.view');

  const [agreementId, setAgreementId] = useState('');
  const [selectedVariationId, setSelectedVariationId] = useState('');
  const [newMode, setNewMode] = useState(false);
  const [valueDelta, setValueDelta] = useState('');
  const [scopeChange, setScopeChange] = useState('');
  const [reason, setReason] = useState('');
  const [workflowCode, setWorkflowCode] = useState('');
  const [decisionText, setDecisionText] = useState('');
  const [createKey, setCreateKey] = useState(() => crypto.randomUUID());
  const retryKeys = useRef(new Map<string, string>());

  const agreements = useQuery({
    queryKey: ['subcontracts', 'variation-agreement-options'],
    queryFn: subcontractsApi.variationAgreementOptions,
    enabled: canView,
  });
  const variations = useQuery({
    queryKey: ['subcontracts', 'variations', agreementId],
    queryFn: () => subcontractsApi.variations(agreementId),
    enabled: canView && Boolean(agreementId),
  });
  const workflows = useQuery({
    queryKey: ['subcontracts', 'variation-workflows'],
    queryFn: subcontractsApi.variationWorkflowOptions,
    enabled: canView && canSubmit,
  });
  const reports = useQuery({
    queryKey: ['subcontracts', 'reports'],
    queryFn: () => subcontractsApi.subcontractReports(),
    enabled: canReport,
  });

  const selectedAgreement = useMemo(
    () =>
      (agreements.data?.data ?? []).find((row) => row.id === agreementId) ??
      null,
    [agreements.data?.data, agreementId],
  );
  const selected = useMemo(
    () =>
      (variations.data?.data ?? []).find(
        (row) => row.id === selectedVariationId,
      ) ?? null,
    [variations.data?.data, selectedVariationId],
  );

  useEffect(() => {
    if (!selected || newMode) return;
    setValueDelta(selected.valueDelta);
    setScopeChange(selected.scopeChange);
    setReason(selected.reason);
    setDecisionText('');
  }, [selected, newMode]);

  const refresh = () =>
    client.invalidateQueries({ queryKey: ['subcontracts'] });

  const save = useMutation({
    mutationFn: () => {
      if (newMode || !selected) {
        return subcontractsApi.createVariation(agreementId, {
          valueDelta,
          scopeChange,
          reason,
          createKey,
        });
      }
      return subcontractsApi.updateVariation(selected.id, {
        valueDelta,
        scopeChange,
        reason,
      });
    },
    onSuccess: async (result) => {
      setSelectedVariationId(result.data.id);
      setNewMode(false);
      setCreateKey(crypto.randomUUID());
      await refresh();
    },
  });

  const retryKey = (signature: string) => {
    const prior = retryKeys.current.get(signature);
    if (prior) return prior;
    const key = crypto.randomUUID();
    retryKeys.current.set(signature, key);
    return key;
  };

  const action = useMutation({
    mutationFn: async ({
      row,
      name,
    }: {
      row: VariationRecord;
      name: 'submit' | 'approve' | 'reject' | 'reverse';
    }) => {
      const material =
        name === 'submit' ? workflowCode : decisionText || null;
      const signature = JSON.stringify(['variation', name, row.id, material]);
      const key = retryKey(signature);
      if (name === 'submit') {
        return subcontractsApi.submitVariation(row.id, workflowCode, key);
      }
      if (name === 'approve') {
        return subcontractsApi.approveVariation(
          row.id,
          key,
          decisionText || undefined,
        );
      }
      if (name === 'reject') {
        return subcontractsApi.rejectVariation(row.id, decisionText, key);
      }
      return subcontractsApi.reverseVariation(row.id, decisionText, key);
    },
    onSuccess: async () => {
      retryKeys.current.clear();
      setDecisionText('');
      await refresh();
    },
  });

  const requestError = save.error ?? action.error;

  const beginNew = () => {
    setSelectedVariationId('');
    setNewMode(true);
    setValueDelta('');
    setScopeChange('');
    setReason('');
    setDecisionText('');
    setCreateKey(crypto.randomUUID());
  };

  return (
    <Stack spacing={3}>
      {requestError ? (
        <Alert severity="error">
          {requestError instanceof Error ? requestError.message : 'Request failed.'}
        </Alert>
      ) : null}

      {canView ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Variation Orders
                </Typography>
                {canCreate &&
                selectedAgreement?.approvalState === 'APPROVED' &&
                !selectedAgreement.cancelledAt ? (
                  <Button variant="outlined" onClick={beginNew}>
                    New Variation
                  </Button>
                ) : null}
              </Stack>
              <Alert severity="info">
                Approved non-reversed Variations are the only post-approval
                change to the Agreement commercial ceiling. They do not post
                Finance, Actual Cost or Paid Cost.
              </Alert>
              <TextField
                select
                label="Agreement"
                value={agreementId}
                onChange={(event) => {
                  setAgreementId(event.target.value);
                  setSelectedVariationId('');
                  setNewMode(false);
                }}
              >
                <MenuItem value="">Select Agreement</MenuItem>
                {(agreements.data?.data ?? []).map((row) => (
                  <MenuItem key={row.id} value={row.id}>
                    {row.project.projectCode} · {row.agreementNumber} ·{' '}
                    {row.subcontractor.subcontractorName}
                    {row.cancelledAt ? ' · CANCELLED' : ''}
                  </MenuItem>
                ))}
              </TextField>

              {agreementId ? (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {(variations.data?.data ?? []).map((row) => (
                    <Chip
                      key={row.id}
                      label={
                        row.variationNumber +
                        ' · ' +
                        row.state +
                        ' · ' +
                        row.valueDelta
                      }
                      color={
                        row.id === selectedVariationId ? 'primary' : 'default'
                      }
                      onClick={() => {
                        setNewMode(false);
                        setSelectedVariationId(row.id);
                      }}
                    />
                  ))}
                </Stack>
              ) : null}

              {(newMode && canCreate) || selected ? (
                <>
                  <Divider />
                  <Typography variant="subtitle1">
                    {newMode ? 'Create Variation' : selected?.variationNumber}
                  </Typography>
                  <TextField
                    label="Signed value delta"
                    value={valueDelta}
                    disabled={!newMode && (!canEdit || selected?.state !== 'DRAFT')}
                    onChange={(event) => setValueDelta(event.target.value)}
                    helperText="Positive increases, negative reduces, zero is scope-only."
                  />
                  <TextField
                    label="Scope change"
                    value={scopeChange}
                    multiline
                    minRows={2}
                    disabled={!newMode && (!canEdit || selected?.state !== 'DRAFT')}
                    onChange={(event) => setScopeChange(event.target.value)}
                  />
                  <TextField
                    label="Business reason"
                    value={reason}
                    multiline
                    minRows={2}
                    disabled={!newMode && (!canEdit || selected?.state !== 'DRAFT')}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  {(newMode ? canCreate : canEdit && selected?.state === 'DRAFT') ? (
                    <Button
                      variant="contained"
                      onClick={() => save.mutate()}
                      disabled={
                        save.isPending ||
                        !valueDelta.trim() ||
                        !scopeChange.trim() ||
                        !reason.trim()
                      }
                    >
                      Save Draft
                    </Button>
                  ) : null}

                  {selected?.state === 'SUBMITTED' || selected?.state === 'APPROVED' ? (
                    <TextField
                      label={
                        selected.state === 'APPROVED'
                          ? 'Reversal reason'
                          : 'Approval / rejection comment'
                      }
                      value={decisionText}
                      multiline
                      minRows={2}
                      onChange={(event) => setDecisionText(event.target.value)}
                    />
                  ) : null}
                  {selected?.state === 'DRAFT' && canSubmit ? (
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <TextField
                        select
                        label="Approval workflow"
                        value={workflowCode}
                        onChange={(event) => setWorkflowCode(event.target.value)}
                        sx={{ minWidth: 280 }}
                      >
                        <MenuItem value="">Select workflow</MenuItem>
                        {(workflows.data?.data ?? []).map((row) => (
                          <MenuItem key={row.id} value={row.workflowCode}>
                            {row.workflowName}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button
                        onClick={() =>
                          action.mutate({ row: selected, name: 'submit' })
                        }
                        disabled={!workflowCode || action.isPending}
                      >
                        Submit
                      </Button>
                    </Stack>
                  ) : null}
                  {selected?.state === 'SUBMITTED' ? (
                    <Stack direction="row" spacing={2}>
                      {canApprove ? (
                        <Button
                          variant="contained"
                          onClick={() =>
                            action.mutate({ row: selected, name: 'approve' })
                          }
                          disabled={action.isPending}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {canReject ? (
                        <Button
                          color="warning"
                          onClick={() =>
                            action.mutate({ row: selected, name: 'reject' })
                          }
                          disabled={!decisionText.trim() || action.isPending}
                        >
                          Reject
                        </Button>
                      ) : null}
                    </Stack>
                  ) : null}
                  {selected?.state === 'APPROVED' && canReverse ? (
                    <Button
                      color="warning"
                      onClick={() =>
                        action.mutate({ row: selected, name: 'reverse' })
                      }
                      disabled={!decisionText.trim() || action.isPending}
                    >
                      Reverse Variation
                    </Button>
                  ) : null}
                  {selected?.approvalInstance ? (
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">Approval trail</Typography>
                      {selected.approvalInstance.actions.map((entry) => (
                        <Typography
                          key={entry.id}
                          variant="caption"
                          color="text.secondary"
                        >
                          Step {entry.approvalStep.stepNo} · {entry.action} ·{' '}
                          {entry.actionByUser.displayName}
                          {entry.comment ? ' · ' + entry.comment : ''}
                        </Typography>
                      ))}
                    </Stack>
                  ) : null}
                </>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canReport ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Subcontracts Derived Report</Typography>
              <Alert severity="info">
                Read-only values are derived from source records. Commercial
                commitment is not Actual Cost or Paid Cost.
              </Alert>
              {(reports.data?.data ?? []).map((row) => (
                <Card key={row.id} variant="outlined">
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="subtitle1">
                        {row.project.projectCode} · {row.agreementNumber} ·{' '}
                        {row.subcontractor.subcontractorName}
                      </Typography>
                      <Typography variant="body2">
                        Original {row.currencyCode} {row.originalValue} ·
                        Variations {row.approvedVariationDelta} · Current ceiling{' '}
                        {row.currentCeiling}
                      </Typography>
                      <Typography variant="body2">
                        Work Orders {row.approvedWorkOrderAllocation} · Claimed{' '}
                        {row.activeClaimedValue} · Assessed {row.assessedValue}
                      </Typography>
                      <Typography variant="body2">
                        Certified gross {row.certifiedGross} · Withheld retention{' '}
                        {row.withheldRetention} · Net certified{' '}
                        {row.netCertification}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {reports.isSuccess && reports.data.data.length === 0 ? (
                <Alert severity="info">
                  No authorized approved Subcontract Agreements to report.
                </Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
