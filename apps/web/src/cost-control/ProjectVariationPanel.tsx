import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '../api/client';
import { costControlApi } from '../api/cost-control';

function requestKey() {
  return crypto.randomUUID();
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The request could not be completed.';
}

export function ProjectVariationPanel({
  permissions,
  projectId,
  projectIsActive,
}: {
  permissions: string[];
  projectId: string;
  projectIsActive: boolean;
}) {
  const queryClient = useQueryClient();
  const canView = permissions.includes('cost.variation.view');
  const canCreate = permissions.includes('cost.variation.create');
  const canSubmit = permissions.includes('cost.variation.submit');
  const canApprove = permissions.includes('cost.variation.approve');

  const [variationId, setVariationId] = useState('');
  const [createNumber, setCreateNumber] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createReason, setCreateReason] = useState('');
  const [createValueDelta, setCreateValueDelta] = useState('');
  const [createKey, setCreateKey] = useState(requestKey);

  const [editDescription, setEditDescription] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editValueDelta, setEditValueDelta] = useState('');

  const [workflowCode, setWorkflowCode] = useState('');
  const [comment, setComment] = useState('');

  const [reversalNumber, setReversalNumber] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [reversalKey, setReversalKey] = useState(requestKey);

  const retryActionKeys = useRef(new Map<string, string>());
  const actionKey = (signature: string) => {
    const existing = retryActionKeys.current.get(signature);
    if (existing) return existing;
    const value = requestKey();
    retryActionKeys.current.set(signature, value);
    return value;
  };
  const clearActionKey = (signature: string) => {
    retryActionKeys.current.delete(signature);
  };

  const variations = useQuery({
    queryKey: ['project-variations', projectId],
    queryFn: () => costControlApi.variationList(projectId),
    enabled: canView && Boolean(projectId),
  });

  useEffect(() => {
    const rows = variations.data?.data ?? [];
    if (!variationId && rows[0]) setVariationId(rows[0].id);
    if (variationId && !rows.some((row) => row.id === variationId)) {
      setVariationId(rows[0]?.id ?? '');
    }
  }, [variationId, variations.data]);

  useEffect(() => {
    setVariationId('');
    setCreateNumber('');
    setCreateDescription('');
    setCreateReason('');
    setCreateValueDelta('');
    setCreateKey(requestKey());
  }, [projectId]);

  const detail = useQuery({
    queryKey: ['project-variation', variationId],
    queryFn: () => costControlApi.variationDetail(variationId),
    enabled: canView && Boolean(variationId),
  });
  const current = detail.data?.data;

  useEffect(() => {
    if (!current) return;
    setEditDescription(current.description);
    setEditReason(current.reason ?? '');
    setEditValueDelta(current.valueDelta);
  }, [current?.id, current?.updatedAt]);

  const workflows = useQuery({
    queryKey: ['project-variation-workflows'],
    queryFn: costControlApi.variationWorkflows,
    enabled: canSubmit,
  });

  useEffect(() => {
    const rows = workflows.data?.data ?? [];
    if (!workflowCode && rows[0]) setWorkflowCode(rows[0].workflowCode);
    if (
      workflowCode &&
      !rows.some((workflow) => workflow.workflowCode === workflowCode)
    ) {
      setWorkflowCode(rows[0]?.workflowCode ?? '');
    }
  }, [workflowCode, workflows.data]);

  const refresh = async (id?: string) => {
    if (id) setVariationId(id);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-variations', projectId] }),
      queryClient.invalidateQueries({
        queryKey: ['cost-control-read-model', projectId],
      }),
      ...(id
        ? [
            queryClient.invalidateQueries({
              queryKey: ['project-variation', id],
            }),
          ]
        : []),
    ]);
  };

  const createVariation = useMutation({
    mutationFn: () =>
      costControlApi.variationCreate(projectId, {
        variationNumber: createNumber.trim(),
        description: createDescription.trim(),
        reason: createReason.trim() || null,
        valueDelta: createValueDelta,
        createKey,
      }),
    onSuccess: async (result) => {
      setCreateNumber('');
      setCreateDescription('');
      setCreateReason('');
      setCreateValueDelta('');
      setCreateKey(requestKey());
      await refresh(result.data.id);
    },
  });

  const saveVariation = useMutation({
    mutationFn: () =>
      costControlApi.variationUpdate(variationId, {
        description: editDescription.trim(),
        reason: editReason.trim() || null,
        valueDelta: editValueDelta,
      }),
    onSuccess: async () => refresh(variationId),
  });

  const submitVariation = useMutation({
    mutationFn: () => {
      const signature = 'variation-submit:' + variationId + ':' + workflowCode;
      return costControlApi
        .variationSubmit(variationId, {
          workflowCode,
          actionKey: actionKey(signature),
        })
        .then((result) => {
          clearActionKey(signature);
          return result;
        });
    },
    onSuccess: async () => refresh(variationId),
  });

  const approveVariation = useMutation({
    mutationFn: () => {
      const signature = 'variation-approve:' + variationId + ':' + comment;
      return costControlApi
        .variationApprove(variationId, {
          actionKey: actionKey(signature),
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        })
        .then((result) => {
          clearActionKey(signature);
          return result;
        });
    },
    onSuccess: async () => {
      setComment('');
      await refresh(variationId);
    },
  });

  const rejectVariation = useMutation({
    mutationFn: () => {
      const signature = 'variation-reject:' + variationId + ':' + comment;
      return costControlApi
        .variationReject(variationId, {
          actionKey: actionKey(signature),
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        })
        .then((result) => {
          clearActionKey(signature);
          return result;
        });
    },
    onSuccess: async () => {
      setComment('');
      await refresh(variationId);
    },
  });

  const reverseVariation = useMutation({
    mutationFn: () =>
      costControlApi.variationReversal(variationId, {
        variationNumber: reversalNumber.trim(),
        reason: reversalReason.trim(),
        createKey: reversalKey,
      }),
    onSuccess: async (result) => {
      setReversalNumber('');
      setReversalReason('');
      setReversalKey(requestKey());
      await refresh(result.data.id);
    },
  });

  if (!projectId) return null;
  if (!canView) {
    return (
      <Alert severity="info">
        Project Variation source records require cost.variation.view. Authorized
        aggregate contract and revenue measures remain available through Cost
        Control reporting.
      </Alert>
    );
  }

  const busy =
    createVariation.isPending ||
    saveVariation.isPending ||
    submitVariation.isPending ||
    approveVariation.isPending ||
    rejectVariation.isPending ||
    reverseVariation.isPending;
  const mutationError =
    createVariation.error ||
    saveVariation.error ||
    submitVariation.error ||
    approveVariation.error ||
    rejectVariation.error ||
    reverseVariation.error;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Project Variations</Typography>
          <Typography variant="body2" color="text.secondary">
            Client/project commercial Variations are separate from subcontract
            Variations. Approved values are immutable; corrections use a linked
            compensating reversal. Contract, revenue and profit totals are
            server-derived.
          </Typography>

          {mutationError ? (
            <Alert severity="error">{errorMessage(mutationError)}</Alert>
          ) : null}
          {variations.isError ? (
            <Alert severity="error">{errorMessage(variations.error)}</Alert>
          ) : null}

          {canCreate && projectIsActive ? (
            <Stack spacing={1}>
              <Typography variant="subtitle1">Create Variation Draft</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  label="Variation number"
                  value={createNumber}
                  onChange={(event) => setCreateNumber(event.target.value)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Signed value delta"
                  value={createValueDelta}
                  onChange={(event) => setCreateValueDelta(event.target.value)}
                  helperText="Use a positive or negative base-currency amount."
                  sx={{ flex: 1 }}
                />
              </Stack>
              <TextField
                label="Description"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                fullWidth
              />
              <TextField
                label="Reason (optional)"
                value={createReason}
                onChange={(event) => setCreateReason(event.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              <Button
                variant="contained"
                disabled={
                  busy ||
                  !createNumber.trim() ||
                  !createDescription.trim() ||
                  !createValueDelta
                }
                onClick={() => createVariation.mutate()}
              >
                Create Project Variation Draft
              </Button>
            </Stack>
          ) : null}

          {canCreate && !projectIsActive ? (
            <Alert severity="info">
              This Project is archived. Retained Project Variation history remains
              available, but new normal Variation drafts are disabled.
            </Alert>
          ) : null}

          <Divider />

          {variations.isPending ? <CircularProgress size={24} /> : null}
          <TextField
            select
            label="Project Variation"
            value={variationId}
            onChange={(event) => setVariationId(event.target.value)}
            fullWidth
          >
            {(variations.data?.data ?? []).map((variation) => (
              <MenuItem key={variation.id} value={variation.id}>
                {variation.variationNumber} · {variation.currencyCode}{' '}
                {variation.valueDelta} · {variation.state}
                {variation.reversesVariationId ? ' · REVERSAL' : ''}
              </MenuItem>
            ))}
          </TextField>

          {detail.isPending && variationId ? <CircularProgress size={24} /> : null}
          {detail.isError ? (
            <Alert severity="error">{errorMessage(detail.error)}</Alert>
          ) : null}

          {current ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <Chip label={current.variationNumber} />
                <Chip label={current.state} />
                <Chip
                  variant="outlined"
                  label={current.currencyCode + ' ' + current.valueDelta}
                />
                {current.reversesVariationId ? (
                  <Chip variant="outlined" label="COMPENSATING REVERSAL" />
                ) : null}
              </Stack>

              <TextField
                label="Description"
                value={editDescription}
                disabled={!canCreate || current.state !== 'DRAFT'}
                onChange={(event) => setEditDescription(event.target.value)}
                fullWidth
              />
              <TextField
                label="Reason"
                value={editReason}
                disabled={
                  !canCreate ||
                  current.state !== 'DRAFT' ||
                  Boolean(current.reversesVariationId)
                }
                onChange={(event) => setEditReason(event.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              <TextField
                label="Signed value delta"
                value={editValueDelta}
                disabled={
                  !canCreate ||
                  current.state !== 'DRAFT' ||
                  Boolean(current.reversesVariationId)
                }
                onChange={(event) => setEditValueDelta(event.target.value)}
                fullWidth
              />

              {canCreate && current.state === 'DRAFT' ? (
                <Button
                  variant="outlined"
                  disabled={
                    busy ||
                    !editDescription.trim() ||
                    !editValueDelta
                  }
                  onClick={() => saveVariation.mutate()}
                >
                  Save Variation Draft
                </Button>
              ) : null}

              {canSubmit && current.state === 'DRAFT' ? (
                <Stack spacing={1}>
                  <TextField
                    select
                    label="Approval workflow"
                    value={workflowCode}
                    onChange={(event) => setWorkflowCode(event.target.value)}
                  >
                    {(workflows.data?.data ?? []).map((workflow) => (
                      <MenuItem key={workflow.id} value={workflow.workflowCode}>
                        {workflow.workflowName} · {workflow.workflowCode}
                      </MenuItem>
                    ))}
                  </TextField>
                  {(workflows.data?.data ?? []).length === 0 ? (
                    <Alert severity="warning">
                      No active PROJECT_VARIATION approval workflow is configured.
                    </Alert>
                  ) : null}
                  <Button
                    variant="contained"
                    disabled={busy || !workflowCode}
                    onClick={() => submitVariation.mutate()}
                  >
                    Submit Variation
                  </Button>
                </Stack>
              ) : null}

              {canApprove && current.state === 'SUBMITTED' ? (
                <Stack spacing={1}>
                  <TextField
                    label="Approval comment (optional)"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    multiline
                    minRows={2}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      disabled={busy}
                      onClick={() => approveVariation.mutate()}
                    >
                      Approve Variation
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={busy}
                      onClick={() => rejectVariation.mutate()}
                    >
                      Reject Variation
                    </Button>
                  </Stack>
                </Stack>
              ) : null}

              {canCreate &&
              current.state === 'APPROVED' &&
              !current.reversesVariationId ? (
                <Stack spacing={1}>
                  <Divider />
                  <Typography variant="subtitle1">
                    Linked Compensating Reversal
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    The server fixes the reversal value to the exact opposite of
                    the approved original. Enter a new immutable Variation number
                    and a correction reason.
                  </Typography>
                  <TextField
                    label="Reversal variation number"
                    value={reversalNumber}
                    onChange={(event) => setReversalNumber(event.target.value)}
                  />
                  <TextField
                    label="Reversal reason"
                    value={reversalReason}
                    onChange={(event) => setReversalReason(event.target.value)}
                    multiline
                    minRows={2}
                  />
                  <Button
                    variant="outlined"
                    disabled={
                      busy ||
                      !reversalNumber.trim() ||
                      !reversalReason.trim()
                    }
                    onClick={() => reverseVariation.mutate()}
                  >
                    Create Reversal Draft
                  </Button>
                </Stack>
              ) : null}

              <Typography variant="body2" color="text.secondary">
                Created by {current.createdBy?.displayName ?? 'Unknown'}.
                {current.submittedBy
                  ? ' Submitted by ' + current.submittedBy.displayName + '.'
                  : ''}
                {current.approvedBy
                  ? ' Approved by ' + current.approvedBy.displayName + '.'
                  : ''}
                {current.rejectedBy
                  ? ' Rejected by ' + current.rejectedBy.displayName + '.'
                  : ''}
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
