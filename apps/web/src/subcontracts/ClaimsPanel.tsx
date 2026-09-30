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
  ClaimLineRecord,
  ClaimRecord,
  subcontractsApi,
} from '../api/subcontracts';

function amountToCents(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

function centsToAmount(value: bigint) {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, '0');
  return whole.toString() + '.' + fraction;
}

function claimTotal(claim: ClaimRecord | null) {
  if (!claim) return '0.00';
  return centsToAmount(
    claim.lines.reduce(
      (total, line) => total + amountToCents(line.amount),
      0n,
    ),
  );
}

function actionColor(state: string) {
  if (state === 'ASSESSED') return 'success' as const;
  if (state === 'SUBMITTED') return 'warning' as const;
  if (state === 'REJECTED') return 'error' as const;
  return 'default' as const;
}

export function ClaimsPanel({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canView = permissions.includes('subcontracts.claim.view');
  const canCreate = permissions.includes('subcontracts.claim.create');
  const canEdit = permissions.includes('subcontracts.claim.edit');
  const canSubmit = permissions.includes('subcontracts.claim.submit');
  const canWithdraw = permissions.includes('subcontracts.claim.withdraw');
  const canViewAssessment = permissions.includes(
    'subcontracts.assessment.view',
  );
  const canAssess = permissions.includes('subcontracts.assessment.assess');
  const canRejectAssessment = permissions.includes(
    'subcontracts.assessment.reject',
  );

  const [agreementId, setAgreementId] = useState('');
  const [selectedClaimId, setSelectedClaimId] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedLineId, setSelectedLineId] = useState('');
  const [lineAmount, setLineAmount] = useState('');
  const [lineWorkOrderId, setLineWorkOrderId] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [assessedAmount, setAssessedAmount] = useState('');
  const [assessmentReason, setAssessmentReason] = useState('');
  const [assessmentRejectReason, setAssessmentRejectReason] = useState('');

  const retryActionKeys = useRef(new Map<string, string>());
  const activeActionSignature = useRef<string | null>(null);

  const retryActionKey = (signature: string) => {
    const current = retryActionKeys.current.get(signature);
    if (current) return current;
    const next = crypto.randomUUID();
    retryActionKeys.current.set(signature, next);
    return next;
  };

  const clearRetryActionKey = (signature: string | null) => {
    if (!signature) return;
    retryActionKeys.current.delete(signature);
  };

  const refresh = () =>
    client.invalidateQueries({ queryKey: ['subcontracts'] });

  const agreements = useQuery({
    queryKey: ['subcontracts', 'claim-agreement-options'],
    queryFn: subcontractsApi.claimAgreementOptions,
    enabled: canView,
  });

  const options = useQuery({
    queryKey: ['subcontracts', 'claim-options', agreementId],
    queryFn: () => subcontractsApi.claimOptions(agreementId),
    enabled: canView && Boolean(agreementId),
  });

  const claims = useQuery({
    queryKey: ['subcontracts', 'claims', agreementId],
    queryFn: () => subcontractsApi.claims(agreementId),
    enabled: canView && Boolean(agreementId),
  });

  const selectedClaim = useMemo(
    () =>
      (claims.data?.data ?? []).find((claim) => claim.id === selectedClaimId) ??
      null,
    [claims.data?.data, selectedClaimId],
  );

  const selectedLine = useMemo(
    () =>
      selectedClaim?.lines.find((line) => line.id === selectedLineId) ?? null,
    [selectedClaim, selectedLineId],
  );

  const requiresWorkOrder = (options.data?.data.workOrders.length ?? 0) > 0;

  useEffect(() => {
    setSelectedClaimId('');
    setSelectedLineId('');
    setLineAmount('');
    setLineWorkOrderId('');
  }, [agreementId]);

  useEffect(() => {
    if (!selectedClaim) {
      setPeriodStart('');
      setPeriodEnd('');
      setWithdrawReason('');
      setAssessedAmount('');
      setAssessmentReason('');
      setAssessmentRejectReason('');
      return;
    }
    setPeriodStart(selectedClaim.periodStart.slice(0, 10));
    setPeriodEnd(selectedClaim.periodEnd.slice(0, 10));
    setWithdrawReason('');
    setAssessedAmount(selectedClaim.assessment?.assessedAmount ?? '');
    setAssessmentReason(selectedClaim.assessment?.reason ?? '');
    setAssessmentRejectReason('');
    setSelectedLineId('');
    setLineAmount('');
    setLineWorkOrderId('');
  }, [selectedClaim?.id]);

  useEffect(() => {
    if (!selectedLine) {
      setLineAmount('');
      setLineWorkOrderId('');
      return;
    }
    setLineAmount(selectedLine.amount);
    setLineWorkOrderId(selectedLine.workOrderId ?? '');
  }, [selectedLine]);

  const createClaim = useMutation({
    mutationFn: () =>
      subcontractsApi.createClaim(agreementId, {
        periodStart: newPeriodStart,
        periodEnd: newPeriodEnd,
      }),
    onSuccess: async (result) => {
      setSelectedClaimId(result.data.id);
      setNewPeriodStart('');
      setNewPeriodEnd('');
      await refresh();
    },
  });

  const savePeriod = useMutation({
    mutationFn: () =>
      subcontractsApi.updateClaim(selectedClaimId, {
        periodStart,
        periodEnd,
      }),
    onSuccess: refresh,
  });

  const saveLine = useMutation({
    mutationFn: async () => {
      if (selectedLine) {
        return subcontractsApi.updateClaimLine(selectedLine.id, {
          amount: lineAmount,
          workOrderId: lineWorkOrderId || null,
        });
      }
      return subcontractsApi.addClaimLine(selectedClaimId, {
        amount: lineAmount,
        ...(lineWorkOrderId ? { workOrderId: lineWorkOrderId } : {}),
      });
    },
    onSuccess: async () => {
      setSelectedLineId('');
      setLineAmount('');
      setLineWorkOrderId('');
      await refresh();
    },
  });

  const deleteLine = useMutation({
    mutationFn: (line: ClaimLineRecord) =>
      subcontractsApi.deleteClaimLine(line.id),
    onSuccess: async () => {
      setSelectedLineId('');
      setLineAmount('');
      setLineWorkOrderId('');
      await refresh();
    },
  });

  const claimAction = useMutation({
    mutationFn: async (action: 'submit' | 'withdraw' | 'assess' | 'reject') => {
      if (!selectedClaim) throw new Error('Select a Claim first.');
      const material =
        action === 'withdraw'
          ? withdrawReason
          : action === 'assess'
            ? JSON.stringify([assessedAmount, assessmentReason])
            : action === 'reject'
              ? assessmentRejectReason
              : null;
      const signature = JSON.stringify([
        'claim',
        action,
        selectedClaim.id,
        material,
      ]);
      activeActionSignature.current = signature;
      const actionKey = retryActionKey(signature);
      if (action === 'submit') {
        return subcontractsApi.submitClaim(selectedClaim.id, actionKey);
      }
      if (action === 'withdraw') {
        return subcontractsApi.withdrawClaim(
          selectedClaim.id,
          withdrawReason,
          actionKey,
        );
      }
      if (action === 'assess') {
        return subcontractsApi.assessClaim(selectedClaim.id, {
          assessedAmount,
          reason: assessmentReason,
          actionKey,
        });
      }
      return subcontractsApi.rejectClaimAssessment(
        selectedClaim.id,
        assessmentRejectReason,
        actionKey,
      );
    },
    onSuccess: async () => {
      clearRetryActionKey(activeActionSignature.current);
      activeActionSignature.current = null;
      setWithdrawReason('');
      setAssessmentRejectReason('');
      await refresh();
    },
  });

  const replacement = useMutation({
    mutationFn: () => {
      if (!selectedClaim) throw new Error('Select a Claim first.');
      return subcontractsApi.createClaimReplacement(selectedClaim.id);
    },
    onSuccess: async (result) => {
      setSelectedClaimId(result.data.id);
      await refresh();
    },
  });

  if (!canView) {
    return <Alert severity="warning">No Claim view permission is assigned.</Alert>;
  }

  const requestError =
    createClaim.error ??
    savePeriod.error ??
    saveLine.error ??
    deleteLine.error ??
    claimAction.error ??
    replacement.error;

  const draftEditable =
    selectedClaim?.state === 'DRAFT' && canEdit && !savePeriod.isPending;
  const claimAmount = claimTotal(selectedClaim);

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Claims and Assessments</Typography>
      <Alert severity="info">
        Claims are period increments against an approved Agreement. Submitted
        source values are retained separately from Assessment values. This Stage
        does not certify payment or apply retention.
      </Alert>
      {requestError ? (
        <Alert severity="error">
          {requestError instanceof Error ? requestError.message : 'Request failed.'}
        </Alert>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <TextField
              select
              label="Approved Agreement"
              value={agreementId}
              onChange={(event) => setAgreementId(event.target.value)}
              sx={{ minWidth: 320 }}
            >
              <MenuItem value="">Select an Agreement</MenuItem>
              {(agreements.data?.data ?? []).map((agreement) => (
                <MenuItem key={agreement.id} value={agreement.id}>
                  {agreement.agreementNumber} — {agreement.project.projectCode} —{' '}
                  {agreement.subcontractor.subcontractorName}
                </MenuItem>
              ))}
            </TextField>

            {agreementId && canCreate ? (
              <>
                <Divider />
                <Typography variant="subtitle1">Create Claim Draft</Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    type="date"
                    label="Period start"
                    value={newPeriodStart}
                    onChange={(event) => setNewPeriodStart(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    type="date"
                    label="Period end"
                    value={newPeriodEnd}
                    onChange={(event) => setNewPeriodEnd(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Button
                    variant="contained"
                    onClick={() => createClaim.mutate()}
                    disabled={
                      createClaim.isPending ||
                      !newPeriodStart ||
                      !newPeriodEnd
                    }
                  >
                    Create Draft
                  </Button>
                </Stack>
              </>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {agreementId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Claims</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {(claims.data?.data ?? []).map((claim) => (
                  <Chip
                    key={claim.id}
                    label={
                      claim.claimNumber +
                      ' · ' +
                      claim.periodStart.slice(0, 10) +
                      ' to ' +
                      claim.periodEnd.slice(0, 10) +
                      ' · ' +
                      claim.state
                    }
                    color={claim.id === selectedClaimId ? 'primary' : 'default'}
                    onClick={() => setSelectedClaimId(claim.id)}
                  />
                ))}
              </Stack>
              {claims.isSuccess && claims.data.data.length === 0 ? (
                <Alert severity="info">No Claims exist for this Agreement.</Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {selectedClaim ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
              >
                <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                  {selectedClaim.claimNumber}
                </Typography>
                <Chip
                  label={selectedClaim.state}
                  color={actionColor(selectedClaim.state)}
                />
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  type="date"
                  label="Period start"
                  value={periodStart}
                  disabled={!draftEditable}
                  onChange={(event) => setPeriodStart(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  type="date"
                  label="Period end"
                  value={periodEnd}
                  disabled={!draftEditable}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                {draftEditable ? (
                  <Button
                    variant="outlined"
                    onClick={() => savePeriod.mutate()}
                    disabled={
                      savePeriod.isPending || !periodStart || !periodEnd
                    }
                  >
                    Save Period
                  </Button>
                ) : null}
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Typography>
                  Claimed: {selectedClaim.currencyCode} {claimAmount}
                </Typography>
                <Typography>
                  Assessed:{' '}
                  {selectedClaim.assessment
                    ? selectedClaim.currencyCode +
                      ' ' +
                      selectedClaim.assessment.assessedAmount
                    : 'Not assessed'}
                </Typography>
              </Stack>

              <Divider />
              <Typography variant="subtitle2">Claim lines</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {selectedClaim.lines.map((line) => (
                  <Chip
                    key={line.id}
                    label={
                      'Line ' +
                      line.lineNo +
                      ' · ' +
                      selectedClaim.currencyCode +
                      ' ' +
                      line.amount +
                      (line.workOrder
                        ? ' · ' + line.workOrder.workOrderNumber
                        : ' · Agreement scope')
                    }
                    color={line.id === selectedLineId ? 'primary' : 'default'}
                    onClick={
                      selectedClaim.state === 'DRAFT'
                        ? () => setSelectedLineId(line.id)
                        : undefined
                    }
                  />
                ))}
              </Stack>

              {selectedClaim.state === 'DRAFT' && canEdit ? (
                <>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Positive line amount"
                      value={lineAmount}
                      onChange={(event) => setLineAmount(event.target.value)}
                    />
                    <TextField
                      select
                      label={
                        requiresWorkOrder
                          ? 'Approved Work Order (required)'
                          : 'Approved Work Order'
                      }
                      value={lineWorkOrderId}
                      onChange={(event) =>
                        setLineWorkOrderId(event.target.value)
                      }
                      sx={{ minWidth: 300 }}
                    >
                      {!requiresWorkOrder ? (
                        <MenuItem value="">Agreement scope</MenuItem>
                      ) : null}
                      {(options.data?.data.workOrders ?? []).map((workOrder) => (
                        <MenuItem key={workOrder.id} value={workOrder.id}>
                          {workOrder.workOrderNumber} —{' '}
                          {selectedClaim.currencyCode} {workOrder.amount}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="outlined"
                      onClick={() => saveLine.mutate()}
                      disabled={
                        saveLine.isPending ||
                        !lineAmount ||
                        (requiresWorkOrder && !lineWorkOrderId)
                      }
                    >
                      {selectedLine ? 'Save Line' : 'Add Line'}
                    </Button>
                    {selectedLine ? (
                      <Button
                        color="error"
                        onClick={() => deleteLine.mutate(selectedLine)}
                        disabled={deleteLine.isPending}
                      >
                        Delete Line
                      </Button>
                    ) : null}
                  </Stack>
                  {selectedLine ? (
                    <Button
                      size="small"
                      onClick={() => setSelectedLineId('')}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Add another line
                    </Button>
                  ) : null}
                </>
              ) : (
                <Alert severity="info">
                  Submitted Claim source period and lines are read-only.
                </Alert>
              )}

              <Divider />
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {selectedClaim.state === 'DRAFT' && canSubmit ? (
                  <Button
                    variant="contained"
                    onClick={() => claimAction.mutate('submit')}
                    disabled={
                      claimAction.isPending || selectedClaim.lines.length === 0
                    }
                  >
                    Submit Claim
                  </Button>
                ) : null}
              </Stack>

              {selectedClaim.state === 'SUBMITTED' && canWithdraw ? (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    label="Withdrawal reason"
                    value={withdrawReason}
                    onChange={(event) => setWithdrawReason(event.target.value)}
                    sx={{ flexGrow: 1 }}
                  />
                  <Button
                    color="warning"
                    variant="outlined"
                    onClick={() => claimAction.mutate('withdraw')}
                    disabled={claimAction.isPending || !withdrawReason.trim()}
                  >
                    Withdraw Claim
                  </Button>
                </Stack>
              ) : null}

              {selectedClaim.state === 'SUBMITTED' && canAssess ? (
                <>
                  <Divider />
                  <Typography variant="subtitle2">Assessment</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Assessed amount"
                      value={assessedAmount}
                      onChange={(event) => setAssessedAmount(event.target.value)}
                    />
                    <TextField
                      label="Assessment reason"
                      value={assessmentReason}
                      onChange={(event) =>
                        setAssessmentReason(event.target.value)
                      }
                      sx={{ flexGrow: 1 }}
                    />
                    <Button
                      color="success"
                      variant="contained"
                      onClick={() => claimAction.mutate('assess')}
                      disabled={
                        claimAction.isPending ||
                        !assessedAmount ||
                        !assessmentReason.trim()
                      }
                    >
                      Assess Claim
                    </Button>
                  </Stack>
                </>
              ) : null}

              {selectedClaim.state === 'ASSESSED' && canRejectAssessment ? (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    label="Assessment rejection reason"
                    value={assessmentRejectReason}
                    onChange={(event) =>
                      setAssessmentRejectReason(event.target.value)
                    }
                    sx={{ flexGrow: 1 }}
                  />
                  <Button
                    color="error"
                    variant="outlined"
                    onClick={() => claimAction.mutate('reject')}
                    disabled={
                      claimAction.isPending || !assessmentRejectReason.trim()
                    }
                  >
                    Reject Assessment
                  </Button>
                </Stack>
              ) : null}

              {['WITHDRAWN', 'REJECTED'].includes(selectedClaim.state) &&
              canCreate &&
              !selectedClaim.replacementClaim ? (
                <Button
                  variant="outlined"
                  onClick={() => replacement.mutate()}
                  disabled={replacement.isPending}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Create Linked Replacement Claim
                </Button>
              ) : null}

              <Divider />
              <Typography variant="subtitle2">Retained history</Typography>
              <Stack spacing={0.75}>
                <Typography variant="body2">
                  Created by {selectedClaim.createdBy.displayName}
                </Typography>
                {selectedClaim.submittedAt ? (
                  <Typography variant="body2">
                    Submitted {selectedClaim.submittedAt}
                    {selectedClaim.submittedBy
                      ? ' by ' + selectedClaim.submittedBy.displayName
                      : ''}
                  </Typography>
                ) : null}
                {selectedClaim.withdrawnAt ? (
                  <Typography variant="body2">
                    Withdrawn {selectedClaim.withdrawnAt}
                    {selectedClaim.withdrawnBy
                      ? ' by ' + selectedClaim.withdrawnBy.displayName
                      : ''}
                    {selectedClaim.withdrawalReason
                      ? ' · ' + selectedClaim.withdrawalReason
                      : ''}
                  </Typography>
                ) : null}
                {selectedClaim.replacementFor ? (
                  <Typography variant="body2">
                    Replacement for {selectedClaim.replacementFor.claimNumber} ·{' '}
                    {selectedClaim.replacementFor.state}
                  </Typography>
                ) : null}
                {selectedClaim.replacementClaim ? (
                  <Typography variant="body2">
                    Replaced by {selectedClaim.replacementClaim.claimNumber} ·{' '}
                    {selectedClaim.replacementClaim.state}
                  </Typography>
                ) : null}
                {canViewAssessment && selectedClaim.assessment ? (
                  <>
                    <Typography variant="body2">
                      Assessment {selectedClaim.assessment.state} ·{' '}
                      {selectedClaim.currencyCode}{' '}
                      {selectedClaim.assessment.assessedAmount} ·{' '}
                      {selectedClaim.assessment.assessedBy.displayName} ·{' '}
                      {selectedClaim.assessment.reason}
                    </Typography>
                    {selectedClaim.assessment.rejectedAt ? (
                      <Typography variant="body2">
                        Assessment rejected {selectedClaim.assessment.rejectedAt}
                        {selectedClaim.assessment.rejectedBy
                          ? ' by ' +
                            selectedClaim.assessment.rejectedBy.displayName
                          : ''}
                        {selectedClaim.assessment.rejectionReason
                          ? ' · ' + selectedClaim.assessment.rejectionReason
                          : ''}
                      </Typography>
                    ) : null}
                  </>
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
