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
  CertificationRecord,
  ClaimRecord,
  subcontractsApi,
} from '../api/subcontracts';

function certificationColor(state: string) {
  if (state === 'APPROVED') return 'success' as const;
  if (state === 'SUBMITTED') return 'warning' as const;
  if (state === 'REJECTED') return 'error' as const;
  return 'default' as const;
}

export function CertificationSection({
  claim,
  claimedAmount,
  agreementActive,
  permissions,
  onReplacementCreated,
}: {
  claim: ClaimRecord;
  claimedAmount: string;
  agreementActive: boolean;
  permissions: string[];
  onReplacementCreated: (claimId: string) => void;
}) {
  const client = useQueryClient();
  const canView = permissions.includes('subcontracts.certification.view');
  const canCreate = permissions.includes('subcontracts.certification.create');
  const canEdit = permissions.includes('subcontracts.certification.edit');
  const canSubmit = permissions.includes('subcontracts.certification.submit');
  const canApprove = permissions.includes('subcontracts.certification.approve');
  const canReject = permissions.includes('subcontracts.certification.reject');
  const canReverse = permissions.includes('subcontracts.certification.reverse');
  const canCreateClaim = permissions.includes('subcontracts.claim.create');
  const canViewPaymentReference = permissions.includes('finance.payment.view');

  const [selectedId, setSelectedId] = useState('');
  const [certifiedGross, setCertifiedGross] = useState('');
  const [workflowCode, setWorkflowCode] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [reason, setReason] = useState('');
  const retryActionKeys = useRef(new Map<string, string>());
  const actionSignature = useRef<string | null>(null);

  const retryActionKey = (signature: string) => {
    const current = retryActionKeys.current.get(signature);
    if (current) return current;
    const next = crypto.randomUUID();
    retryActionKeys.current.set(signature, next);
    return next;
  };

  const refresh = () =>
    client.invalidateQueries({ queryKey: ['subcontracts'] });

  const certifications = useQuery({
    queryKey: ['subcontracts', 'certifications', claim.agreementId],
    queryFn: () => subcontractsApi.certifications(claim.agreementId),
    enabled: canView,
  });

  const workflows = useQuery({
    queryKey: ['subcontracts', 'certification-workflows'],
    queryFn: subcontractsApi.certificationWorkflowOptions,
    enabled: canView && canSubmit,
  });

  const financeReference = useQuery({
    queryKey: ['subcontracts', 'certification-finance-reference', selectedId],
    queryFn: () => subcontractsApi.certificationFinanceReference(selectedId),
    enabled: canView && canViewPaymentReference && Boolean(selectedId),
  });

  const claimCertifications = useMemo(
    () =>
      (certifications.data?.data ?? []).filter(
        (certification) => certification.claimId === claim.id,
      ),
    [certifications.data?.data, claim.id],
  );

  const activeCertification = useMemo(
    () =>
      claimCertifications.find((certification) =>
        ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(certification.state),
      ) ?? null,
    [claimCertifications],
  );
  const hasReversed = claimCertifications.some(
    (certification) => certification.state === 'REVERSED',
  );

  const selected = useMemo(
    () =>
      claimCertifications.find(
        (certification) => certification.id === selectedId,
      ) ?? null,
    [claimCertifications, selectedId],
  );

  useEffect(() => {
    if (!canView) return;
    if (claimCertifications.length === 0) {
      setSelectedId('');
      return;
    }
    if (!claimCertifications.some((row) => row.id === selectedId)) {
      const nextCertification =
        activeCertification ?? claimCertifications[0];
      if (nextCertification) setSelectedId(nextCertification.id);
    }
  }, [
    activeCertification,
    canView,
    claimCertifications,
    selectedId,
  ]);

  useEffect(() => {
    setCertifiedGross(
      selected?.certifiedGross ?? claim.assessment?.assessedAmount ?? '',
    );
    setApprovalComment('');
    setReason('');
  }, [claim.id, selected?.id]);

  const certificationMutation = useMutation({
    mutationFn: async (
      action: 'create' | 'save' | 'submit' | 'approve' | 'reject' | 'reverse',
    ) => {
      if (action === 'create') {
        return subcontractsApi.createCertification(claim.id, {
          certifiedGross,
        });
      }
      if (!selected) throw new Error('Select a Certification first.');
      if (action === 'save') {
        return subcontractsApi.updateCertification(selected.id, {
          certifiedGross,
        });
      }

      const material =
        action === 'submit'
          ? workflowCode
          : action === 'approve'
            ? approvalComment || null
            : reason;
      const signature = JSON.stringify([
        'certification',
        action,
        selected.id,
        material,
      ]);
      actionSignature.current = signature;
      const actionKey = retryActionKey(signature);

      if (action === 'submit') {
        return subcontractsApi.submitCertification(
          selected.id,
          workflowCode,
          actionKey,
        );
      }
      if (action === 'approve') {
        return subcontractsApi.approveCertification(
          selected.id,
          actionKey,
          approvalComment || undefined,
        );
      }
      if (action === 'reject') {
        return subcontractsApi.rejectCertification(
          selected.id,
          reason,
          actionKey,
        );
      }
      return subcontractsApi.reverseCertification(
        selected.id,
        reason,
        actionKey,
      );
    },
    onSuccess: async (result) => {
      if (actionSignature.current) {
        retryActionKeys.current.delete(actionSignature.current);
        actionSignature.current = null;
      }
      setSelectedId(result.data.id);
      setReason('');
      await refresh();
    },
  });

  const replacement = useMutation({
    mutationFn: () => subcontractsApi.createClaimReplacement(claim.id),
    onSuccess: async (result) => {
      onReplacementCreated(result.data.id);
      await refresh();
    },
  });

  if (!canView) return null;

  const requestError = certificationMutation.error ?? replacement.error;
  const canCreateForClaim =
    agreementActive &&
    claim.state === 'ASSESSED' &&
    canCreate &&
    !activeCertification &&
    !hasReversed;
  const finalSnapshot =
    selected?.state === 'APPROVED' || selected?.state === 'REVERSED';

  return (
    <>
      <Divider />
      <Stack spacing={2}>
        <Typography variant="subtitle2">
          Payment Certification & retention withholding
        </Typography>
        {requestError ? (
          <Alert severity="error">
            {requestError instanceof Error ? requestError.message : 'Request failed.'}
          </Alert>
        ) : null}

        {claimCertifications.length > 0 ? (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {claimCertifications.map((certification) => (
              <Chip
                key={certification.id}
                label={
                  certification.certificationNumber +
                  ' · ' +
                  certification.state
                }
                color={
                  certification.id === selectedId
                    ? 'primary'
                    : certificationColor(certification.state)
                }
                onClick={() => setSelectedId(certification.id)}
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No Certification history exists for this Claim.
          </Typography>
        )}

        {canCreateForClaim ? (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Certified gross"
              value={certifiedGross}
              onChange={(event) => setCertifiedGross(event.target.value)}
              helperText="Tax-exclusive; cannot exceed the retained Assessment"
            />
            <Button
              variant="outlined"
              onClick={() => certificationMutation.mutate('create')}
              disabled={certificationMutation.isPending || !certifiedGross}
            >
              Create Certification Draft
            </Button>
          </Stack>
        ) : null}

        {hasReversed && claim.state === 'ASSESSED' ? (
          <Alert severity="info">
            Approved Certification history was reversed. Correction continues
            through a linked replacement Claim; the reversed Certification
            remains retained history.
          </Alert>
        ) : null}
        {hasReversed &&
        claim.state === 'ASSESSED' &&
        canCreateClaim &&
        agreementActive &&
        !claim.replacementClaim ? (
          <Button
            variant="outlined"
            onClick={() => replacement.mutate()}
            disabled={replacement.isPending}
            sx={{ alignSelf: 'flex-start' }}
          >
            Create Linked Replacement Claim
          </Button>
        ) : null}

        {selected ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                >
                  <Typography sx={{ flexGrow: 1 }}>
                    {selected.certificationNumber}
                  </Typography>
                  <Chip
                    label={selected.state}
                    color={certificationColor(selected.state)}
                  />
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  Agreement retention: {selected.agreement.retentionRate}% · Cap{' '}
                  {selected.agreement.retentionCap
                    ? selected.currencyCode + ' ' + selected.agreement.retentionCap
                    : 'none'}
                </Typography>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Typography>
                    Claimed: {claim.currencyCode} {claimedAmount}
                  </Typography>
                  <Typography>
                    Assessed: {selected.currencyCode}{' '}
                    {selected.assessment.assessedAmount}
                  </Typography>
                  <Typography>
                    Certified gross: {selected.currencyCode}{' '}
                    {selected.certifiedGross}
                  </Typography>
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <Typography>
                    Withheld retention:{' '}
                    {selected.retainedAmount === null
                      ? 'Pending final approval'
                      : selected.currencyCode + ' ' + selected.retainedAmount}
                  </Typography>
                  <Typography>
                    Net certified:{' '}
                    {selected.netCertifiedAmount === null
                      ? 'Pending final approval'
                      : selected.currencyCode + ' ' + selected.netCertifiedAmount}
                  </Typography>
                </Stack>

                {selected.state === 'DRAFT' && canEdit ? (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Certified gross"
                      value={certifiedGross}
                      onChange={(event) => setCertifiedGross(event.target.value)}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => certificationMutation.mutate('save')}
                      disabled={certificationMutation.isPending || !certifiedGross}
                    >
                      Save Certification Draft
                    </Button>
                  </Stack>
                ) : null}

                {selected.state === 'DRAFT' && canSubmit ? (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      select
                      label="Certification approval workflow"
                      value={workflowCode}
                      onChange={(event) => setWorkflowCode(event.target.value)}
                      sx={{ minWidth: 300 }}
                    >
                      {(workflows.data?.data ?? []).map((workflow) => (
                        <MenuItem key={workflow.id} value={workflow.workflowCode}>
                          {workflow.workflowName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="contained"
                      onClick={() => certificationMutation.mutate('submit')}
                      disabled={certificationMutation.isPending || !workflowCode}
                    >
                      Submit Certification
                    </Button>
                  </Stack>
                ) : null}

                {selected.state === 'SUBMITTED' && (canApprove || canReject) ? (
                  <>
                    {canApprove ? (
                      <TextField
                        label="Approval comment (optional)"
                        value={approvalComment}
                        onChange={(event) =>
                          setApprovalComment(event.target.value)
                        }
                      />
                    ) : null}
                    {canReject ? (
                      <TextField
                        label="Rejection reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    ) : null}
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {canApprove ? (
                        <Button
                          color="success"
                          variant="contained"
                          onClick={() => certificationMutation.mutate('approve')}
                          disabled={certificationMutation.isPending}
                        >
                          Approve Certification
                        </Button>
                      ) : null}
                      {canReject ? (
                        <Button
                          color="error"
                          variant="outlined"
                          onClick={() => certificationMutation.mutate('reject')}
                          disabled={
                            certificationMutation.isPending || !reason.trim()
                          }
                        >
                          Reject Certification
                        </Button>
                      ) : null}
                    </Stack>
                  </>
                ) : null}

                {selected.state === 'APPROVED' && canReverse ? (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Reversal reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      sx={{ flexGrow: 1 }}
                    />
                    <Button
                      color="warning"
                      variant="outlined"
                      onClick={() => certificationMutation.mutate('reverse')}
                      disabled={certificationMutation.isPending || !reason.trim()}
                    >
                      Reverse Certification
                    </Button>
                  </Stack>
                ) : null}

                {finalSnapshot ? (
                  <Alert severity="info">
                    Final snapshot: assessed {selected.assessedAmountSnapshot},{' '}
                    retention rate {selected.retentionRateSnapshot}%,
                    retained-before {selected.retainedBeforeSnapshot}, withheld{' '}
                    {selected.retainedAmount}, net {selected.netCertifiedAmount}.
                    This is certification/withholding evidence only and is not a
                    payment or Finance posting.
                  </Alert>
                ) : null}

                {canViewPaymentReference ? (
                  <>
                    <Divider />
                    <Typography variant="subtitle2">
                      Finance Payment references
                    </Typography>
                    {financeReference.isError ? (
                      <Alert severity="error">
                        Unable to load authorized Finance Payment references.
                      </Alert>
                    ) : null}
                    {!financeReference.isFetching &&
                    (financeReference.data?.data.allocations ?? []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No Finance Payment allocation is linked to this
                        Certification.
                      </Typography>
                    ) : null}
                    {(financeReference.data?.data.allocations ?? []).map(
                      (allocation) => (
                        <Card key={allocation.id} variant="outlined">
                          <CardContent>
                            <Stack spacing={0.5}>
                              <Typography fontWeight={600}>
                                {allocation.payment.paymentNumber} ·{' '}
                                {allocation.payment.state}
                              </Typography>
                              <Typography variant="body2">
                                Allocated {allocation.payment.currencyCode}{' '}
                                {allocation.allocatedAmount} · Payment date{' '}
                                {allocation.payment.paymentDate.slice(0, 10)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {allocation.payment.reference ?? 'No reference'}
                                {allocation.payment.cancelledAt
                                  ? ' · Cancelled ' +
                                    allocation.payment.cancelledAt +
                                    (allocation.payment.cancellationReason
                                      ? ' · ' +
                                        allocation.payment.cancellationReason
                                      : '')
                                  : ''}
                              </Typography>
                            </Stack>
                          </CardContent>
                        </Card>
                      ),
                    )}
                  </>
                ) : null}

                <Divider />
                <Typography variant="subtitle2">
                  Certification decision history
                </Typography>
                <Typography variant="body2">
                  Created {selected.createdAt} by {selected.createdBy.displayName}
                </Typography>
                {selected.submittedAt ? (
                  <Typography variant="body2">
                    Submitted {selected.submittedAt}
                    {selected.submittedBy
                      ? ' by ' + selected.submittedBy.displayName
                      : ''}
                  </Typography>
                ) : null}
                {selected.approvedAt ? (
                  <Typography variant="body2">
                    Approved {selected.approvedAt}
                    {selected.approvedBy
                      ? ' by ' + selected.approvedBy.displayName
                      : ''}
                  </Typography>
                ) : null}
                {selected.rejectedAt ? (
                  <Typography variant="body2">
                    Rejected {selected.rejectedAt}
                    {selected.rejectedBy
                      ? ' by ' + selected.rejectedBy.displayName
                      : ''}
                    {selected.rejectionReason
                      ? ' · ' + selected.rejectionReason
                      : ''}
                  </Typography>
                ) : null}
                {selected.reversedAt ? (
                  <Typography variant="body2">
                    Reversed {selected.reversedAt}
                    {selected.reversedBy
                      ? ' by ' + selected.reversedBy.displayName
                      : ''}
                    {selected.reversalReason
                      ? ' · ' + selected.reversalReason
                      : ''}
                  </Typography>
                ) : null}
                {selected.approvalInstance?.actions.map((action) => (
                  <Typography
                    key={action.id}
                    variant="caption"
                    color="text.secondary"
                  >
                    Step {action.approvalStep.stepNo} · {action.action} ·{' '}
                    {action.actionByUser.displayName}
                    {action.comment ? ' · ' + action.comment : ''}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Stack>
    </>
  );
}
