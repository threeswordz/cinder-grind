import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
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
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { ApiError } from '../api/client';
import {
  costControlApi,
  DirectCostDetail,
} from '../api/cost-control';

type Props = {
  permissions: string[];
};

function key() {
  return crypto.randomUUID();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function message(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The request could not be completed.';
}

export function CostControlWorkspace({ permissions }: Props) {
  const queryClient = useQueryClient();

  const canView = permissions.includes('cost.control.view');
  const canCreate = permissions.includes('cost.direct_posting.create');
  const canSubmit = permissions.includes('cost.direct_posting.submit');
  const canApprove = permissions.includes('cost.direct_posting.approve');
  const canViewDirectCostSource = permissions.some((permission) =>
    permission.startsWith('cost.direct_posting.'),
  );

  const [projectId, setProjectId] = useState('');
  const [postingId, setPostingId] = useState('');

  const [createPostingDate, setCreatePostingDate] = useState(today);
  const [createDescription, setCreateDescription] = useState('');
  const [createReference, setCreateReference] = useState('');
  const [createAmount, setCreateAmount] = useState('');
  const [createWbsId, setCreateWbsId] = useState('');
  const [createCostCodeId, setCreateCostCodeId] = useState('');
  const [createKey, setCreateKey] = useState(key);

  const [editPostingDate, setEditPostingDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editWbsId, setEditWbsId] = useState('');
  const [editCostCodeId, setEditCostCodeId] = useState('');

  const [workflowCode, setWorkflowCode] = useState('');
  const [actionComment, setActionComment] = useState('');

  const [reversalDate, setReversalDate] = useState(today);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalReference, setReversalReference] = useState('');
  const [reversalCreateKey, setReversalCreateKey] = useState(key);

  const retryActionKeys = useRef(new Map<string, string>());
  const actionKey = (signature: string) => {
    const existing = retryActionKeys.current.get(signature);
    if (existing) return existing;
    const value = key();
    retryActionKeys.current.set(signature, value);
    return value;
  };
  const clearActionKey = (signature: string) => {
    retryActionKeys.current.delete(signature);
  };

  const projects = useQuery({
    queryKey: ['cost-control-projects'],
    queryFn: costControlApi.projects,
    enabled: canView,
  });

  useEffect(() => {
    const values = projects.data?.data ?? [];
    if (!projectId && values[0]) setProjectId(values[0].id);
    if (projectId && !values.some((project) => project.id === projectId)) {
      setProjectId(values[0]?.id ?? '');
    }
  }, [projectId, projects.data]);

  const selectedProject = (projects.data?.data ?? []).find(
    (project) => project.id === projectId,
  );
  const projectAllowsNewDirectCost = selectedProject?.isActive === true;

  useEffect(() => {
    setPostingId('');
    setCreateWbsId('');
    setCreateCostCodeId('');
  }, [projectId]);

  const options = useQuery({
    queryKey: ['cost-control-options', projectId],
    queryFn: () => costControlApi.options(projectId),
    enabled: canView && Boolean(projectId),
  });

  useEffect(() => {
    const values = options.data?.data.costCodes ?? [];
    if (!createCostCodeId && values[0]) {
      setCreateCostCodeId(values[0].id);
    }
  }, [createCostCodeId, options.data]);

  const readModel = useQuery({
    queryKey: ['cost-control-read-model', projectId],
    queryFn: () => costControlApi.readModel(projectId),
    enabled: canView && Boolean(projectId),
  });

  const postings = useQuery({
    queryKey: ['direct-cost-postings', projectId],
    queryFn: () => costControlApi.list(projectId),
    enabled: canView && canViewDirectCostSource && Boolean(projectId),
  });

  useEffect(() => {
    const values = postings.data?.data ?? [];
    if (!postingId && values[0]) setPostingId(values[0].id);
    if (postingId && !values.some((posting) => posting.id === postingId)) {
      setPostingId(values[0]?.id ?? '');
    }
  }, [postingId, postings.data]);

  const detail = useQuery({
    queryKey: ['direct-cost-posting', postingId],
    queryFn: () => costControlApi.detail(postingId),
    enabled: canView && canViewDirectCostSource && Boolean(postingId),
  });

  const current = detail.data?.data;

  useEffect(() => {
    if (!current) return;
    setEditPostingDate(dateValue(current.postingDate));
    setEditDescription(current.description);
    setEditReference(current.reference ?? '');
    setEditAmount(current.amount);
    setEditWbsId(current.wbsId ?? '');
    setEditCostCodeId(current.costCodeId);
  }, [current?.id, current?.updatedAt]);

  const workflows = useQuery({
    queryKey: ['direct-cost-workflows'],
    queryFn: costControlApi.workflows,
    enabled: canSubmit,
  });

  useEffect(() => {
    const values = workflows.data?.data ?? [];
    if (!workflowCode && values[0]) setWorkflowCode(values[0].workflowCode);
    if (
      workflowCode &&
      !values.some((workflow) => workflow.workflowCode === workflowCode)
    ) {
      setWorkflowCode(values[0]?.workflowCode ?? '');
    }
  }, [workflowCode, workflows.data]);

  const refresh = async (id?: string) => {
    if (id) setPostingId(id);
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['direct-cost-postings', projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['cost-control-read-model', projectId],
      }),
      ...(id
        ? [
            queryClient.invalidateQueries({
              queryKey: ['direct-cost-posting', id],
            }),
          ]
        : []),
    ]);
  };

  const createPosting = useMutation({
    mutationFn: () =>
      costControlApi.create(projectId, {
        postingDate: createPostingDate,
        description: createDescription.trim(),
        reference: createReference.trim() || null,
        amount: createAmount,
        wbsId: createWbsId || null,
        costCodeId: createCostCodeId,
        createKey,
      }),
    onSuccess: async (result) => {
      setCreateDescription('');
      setCreateReference('');
      setCreateAmount('');
      setCreateKey(key());
      await refresh(result.data.id);
    },
  });

  const saveDraft = useMutation({
    mutationFn: () => {
      const editableFields = {
        postingDate: editPostingDate,
        description: editDescription.trim(),
        reference: editReference.trim() || null,
      };
      return costControlApi.update(
        postingId,
        current?.reversesPostingId
          ? editableFields
          : {
              ...editableFields,
              amount: editAmount,
              wbsId: editWbsId || null,
              costCodeId: editCostCodeId,
            },
      );
    },
    onSuccess: async () => refresh(postingId),
  });

  const submitPosting = useMutation({
    mutationFn: () => {
      const signature = 'submit:' + postingId + ':' + workflowCode;
      return costControlApi
        .submit(postingId, {
          workflowCode,
          actionKey: actionKey(signature),
        })
        .then((result) => {
          clearActionKey(signature);
          return result;
        });
    },
    onSuccess: async () => refresh(postingId),
  });

  const approvePosting = useMutation({
    mutationFn: () => {
      const signature = 'approve:' + postingId + ':' + actionComment;
      const comment = actionComment.trim();
      return costControlApi
        .approve(postingId, {
          actionKey: actionKey(signature),
          ...(comment ? { comment } : {}),
        })
        .then((result) => {
          clearActionKey(signature);
          return result;
        });
    },
    onSuccess: async () => {
      setActionComment('');
      await refresh(postingId);
    },
  });

  const rejectPosting = useMutation({
    mutationFn: () => {
      const signature = 'reject:' + postingId + ':' + actionComment;
      const comment = actionComment.trim();
      return costControlApi
        .reject(postingId, {
          actionKey: actionKey(signature),
          ...(comment ? { comment } : {}),
        })
        .then((result) => {
          clearActionKey(signature);
          return result;
        });
    },
    onSuccess: async () => {
      setActionComment('');
      await refresh(postingId);
    },
  });

  const reversePosting = useMutation({
    mutationFn: () =>
      costControlApi.reversal(postingId, {
        postingDate: reversalDate,
        reason: reversalReason.trim(),
        reference: reversalReference.trim() || null,
        createKey: reversalCreateKey,
      }),
    onSuccess: async (result) => {
      setReversalReason('');
      setReversalReference('');
      setReversalCreateKey(key());
      await refresh(result.data.id);
    },
  });

  const busy =
    createPosting.isPending ||
    saveDraft.isPending ||
    submitPosting.isPending ||
    approvePosting.isPending ||
    rejectPosting.isPending ||
    reversePosting.isPending;

  const mutationError =
    createPosting.error ||
    saveDraft.error ||
    submitPosting.error ||
    approvePosting.error ||
    rejectPosting.error ||
    reversePosting.error;

  if (!canView) {
    return (
      <Alert severity="warning">
        Cost Control requires cost.control.view. Direct Cost action permissions
        do not bypass Project-scoped Cost Control visibility.
      </Alert>
    );
  }

  if (projects.isPending) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Cost Control · Direct Cost Posting</Typography>
        <Typography color="text.secondary">
          Integrated Budget / Commitment / Actual / Paid measures plus
          controlled project expenses that are not already represented by AP
          or Subcontracts.
        </Typography>
      </Box>

      {projects.isError ? (
        <Alert severity="error">{message(projects.error)}</Alert>
      ) : null}
      {options.isError ? (
        <Alert severity="error">{message(options.error)}</Alert>
      ) : null}
      {readModel.isError ? (
        <Alert severity="error">{message(readModel.error)}</Alert>
      ) : null}
      {mutationError ? (
        <Alert severity="error">{message(mutationError)}</Alert>
      ) : null}

      <TextField
        select
        label="Project"
        value={projectId}
        onChange={(event) => setProjectId(event.target.value)}
        fullWidth
      >
        {(projects.data?.data ?? []).map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} · {project.projectName}
            {project.isActive ? '' : ' · ARCHIVED'}
          </MenuItem>
        ))}
      </TextField>

      {readModel.data ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Integrated Cost Position</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <Chip
                  label={
                    'Original Budget ' +
                    readModel.data.data.baseCurrencyCode +
                    ' ' +
                    readModel.data.data.totals.originalBudget
                  }
                />
                <Chip
                  label={
                    'Revised Budget ' +
                    readModel.data.data.baseCurrencyCode +
                    ' ' +
                    readModel.data.data.totals.revisedBudget
                  }
                />
                <Chip
                  label={
                    'Committed ' +
                    readModel.data.data.baseCurrencyCode +
                    ' ' +
                    readModel.data.data.totals.committedCost.total
                  }
                />
                <Chip
                  label={
                    'Actual ' +
                    readModel.data.data.baseCurrencyCode +
                    ' ' +
                    readModel.data.data.totals.actualCost.total
                  }
                />
                <Chip
                  label={
                    'Paid ' +
                    readModel.data.data.baseCurrencyCode +
                    ' ' +
                    readModel.data.data.totals.paidCost.total
                  }
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Direct Actual: {readModel.data.data.baseCurrencyCode}{' '}
                {readModel.data.data.totals.actualCost.direct}. Committed,
                Actual and Paid remain separate measures.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canCreate &&
      projectId &&
      selectedProject &&
      !selectedProject.isActive ? (
        <Alert severity="info">
          This Project is archived. Retained Direct Cost history remains
          available for review and linked reversals, but new normal Direct Cost
          drafts are disabled.
        </Alert>
      ) : null}

      {canCreate && projectId && projectAllowsNewDirectCost ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Create Direct Cost Draft</Typography>
              <Alert severity="info">
                Use this only for a project cost not already represented by
                Supplier Invoice or Subcontract Certification. Currency is the
                Company base currency and cannot be converted here.
              </Alert>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  type="date"
                  label="Posting date"
                  value={createPostingDate}
                  onChange={(event) => setCreatePostingDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Amount"
                  value={createAmount}
                  onChange={(event) => setCreateAmount(event.target.value)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Reference (optional)"
                  value={createReference}
                  onChange={(event) => setCreateReference(event.target.value)}
                  sx={{ flex: 2 }}
                />
              </Stack>
              <TextField
                label="Description"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                fullWidth
              />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  select
                  label="Cost Code"
                  value={createCostCodeId}
                  onChange={(event) => setCreateCostCodeId(event.target.value)}
                  sx={{ flex: 1 }}
                >
                  {(options.data?.data.costCodes ?? []).map((cost) => (
                    <MenuItem key={cost.id} value={cost.id}>
                      {cost.costCode} · {cost.costName}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="WBS (optional)"
                  value={createWbsId}
                  onChange={(event) => setCreateWbsId(event.target.value)}
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="">No WBS</MenuItem>
                  {(options.data?.data.wbs ?? []).map((wbs) => (
                    <MenuItem key={wbs.id} value={wbs.id}>
                      {wbs.wbsCode} · {wbs.wbsName}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Button
                variant="contained"
                disabled={
                  busy ||
                  !createPostingDate ||
                  !createDescription.trim() ||
                  !createAmount ||
                  !createCostCodeId
                }
                onClick={() => createPosting.mutate()}
              >
                Create Draft Direct Cost
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {projectId && !canViewDirectCostSource ? (
        <Alert severity="info">
          You have aggregate Cost Control visibility. Direct Cost source
          registers require an explicit cost.direct_posting.* permission.
        </Alert>
      ) : null}

      {projectId && canViewDirectCostSource ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Direct Cost Register</Typography>
              {postings.isPending ? <CircularProgress size={24} /> : null}
              {postings.isError ? (
                <Alert severity="error">{message(postings.error)}</Alert>
              ) : null}
              <TextField
                select
                label="Direct Cost Posting"
                value={postingId}
                onChange={(event) => setPostingId(event.target.value)}
                fullWidth
              >
                {(postings.data?.data ?? []).map((posting) => (
                  <MenuItem key={posting.id} value={posting.id}>
                    {dateValue(posting.postingDate)} · {posting.description} ·{' '}
                    {posting.currencyCode} {posting.amount} · {posting.state}
                    {posting.reversesPostingId ? ' · REVERSAL' : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {detail.isPending && postingId ? (
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 160 }}>
          <CircularProgress />
        </Box>
      ) : null}
      {detail.isError ? (
        <Alert severity="error">{message(detail.error)}</Alert>
      ) : null}

      {current ? (
        <PostingDetail
          current={current}
          canCreate={canCreate}
          canSubmit={canSubmit}
          canApprove={canApprove}
          options={options.data?.data}
          workflows={workflows.data?.data ?? []}
          workflowCode={workflowCode}
          setWorkflowCode={setWorkflowCode}
          edit={{
            postingDate: editPostingDate,
            description: editDescription,
            reference: editReference,
            amount: editAmount,
            wbsId: editWbsId,
            costCodeId: editCostCodeId,
          }}
          setEdit={{
            postingDate: setEditPostingDate,
            description: setEditDescription,
            reference: setEditReference,
            amount: setEditAmount,
            wbsId: setEditWbsId,
            costCodeId: setEditCostCodeId,
          }}
          actionComment={actionComment}
          setActionComment={setActionComment}
          reversalDate={reversalDate}
          setReversalDate={setReversalDate}
          reversalReason={reversalReason}
          setReversalReason={setReversalReason}
          reversalReference={reversalReference}
          setReversalReference={setReversalReference}
          busy={busy}
          save={() => saveDraft.mutate()}
          submit={() => submitPosting.mutate()}
          approve={() => approvePosting.mutate()}
          reject={() => rejectPosting.mutate()}
          reverse={() => reversePosting.mutate()}
        />
      ) : null}
    </Stack>
  );
}

type PostingDetailProps = {
  current: DirectCostDetail;
  canCreate: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  options:
    | {
        baseCurrencyCode: string;
        wbs: Array<{ id: string; wbsCode: string; wbsName: string }>;
        costCodes: Array<{ id: string; costCode: string; costName: string }>;
      }
    | undefined;
  workflows: Array<{
    id: string;
    workflowCode: string;
    workflowName: string;
  }>;
  workflowCode: string;
  setWorkflowCode: (value: string) => void;
  edit: {
    postingDate: string;
    description: string;
    reference: string;
    amount: string;
    wbsId: string;
    costCodeId: string;
  };
  setEdit: {
    postingDate: (value: string) => void;
    description: (value: string) => void;
    reference: (value: string) => void;
    amount: (value: string) => void;
    wbsId: (value: string) => void;
    costCodeId: (value: string) => void;
  };
  actionComment: string;
  setActionComment: (value: string) => void;
  reversalDate: string;
  setReversalDate: (value: string) => void;
  reversalReason: string;
  setReversalReason: (value: string) => void;
  reversalReference: string;
  setReversalReference: (value: string) => void;
  busy: boolean;
  save: () => void;
  submit: () => void;
  approve: () => void;
  reject: () => void;
  reverse: () => void;
};

function PostingDetail(props: PostingDetailProps) {
  const {
    current,
    canCreate,
    canSubmit,
    canApprove,
    options,
    workflows,
    workflowCode,
    setWorkflowCode,
    edit,
    setEdit,
    actionComment,
    setActionComment,
    reversalDate,
    setReversalDate,
    reversalReason,
    setReversalReason,
    reversalReference,
    setReversalReference,
    busy,
    save,
    submit,
    approve,
    reject,
    reverse,
  } = props;
  const draft = current.state === 'DRAFT';
  const submitted = current.state === 'SUBMITTED';
  const approvedOriginal =
    current.state === 'APPROVED' && !current.reversesPostingId;

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              spacing={1}
            >
              <Box>
                <Typography variant="h6">{current.description}</Typography>
                <Typography color="text.secondary">
                  {current.project?.projectCode ?? current.projectId} ·{' '}
                  {current.costCode?.costCode ?? current.costCodeId}
                  {current.wbs ? ' · ' + current.wbs.wbsCode : ''}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Chip label={current.state} />
                <Chip
                  variant="outlined"
                  label={current.currencyCode + ' ' + current.amount}
                />
                {current.reversesPostingId ? (
                  <Chip variant="outlined" label="Linked reversal" />
                ) : null}
              </Stack>
            </Stack>

            {current.reversalReason ? (
              <Alert severity="info">
                Reversal reason: {current.reversalReason}
              </Alert>
            ) : null}

            <Divider />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField
                type="date"
                label="Posting date"
                value={edit.postingDate}
                disabled={!canCreate || !draft}
                onChange={(event) => setEdit.postingDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Amount"
                value={edit.amount}
                disabled={
                  !canCreate || !draft || Boolean(current.reversesPostingId)
                }
                onChange={(event) => setEdit.amount(event.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Reference"
                value={edit.reference}
                disabled={!canCreate || !draft}
                onChange={(event) => setEdit.reference(event.target.value)}
                sx={{ flex: 2 }}
              />
            </Stack>
            <TextField
              label="Description"
              value={edit.description}
              disabled={!canCreate || !draft}
              onChange={(event) => setEdit.description(event.target.value)}
              fullWidth
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField
                select
                label="Cost Code"
                value={edit.costCodeId}
                disabled={
                  !canCreate || !draft || Boolean(current.reversesPostingId)
                }
                onChange={(event) => setEdit.costCodeId(event.target.value)}
                sx={{ flex: 1 }}
              >
                {(options?.costCodes ?? []).map((cost) => (
                  <MenuItem key={cost.id} value={cost.id}>
                    {cost.costCode} · {cost.costName}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="WBS (optional)"
                value={edit.wbsId}
                disabled={
                  !canCreate || !draft || Boolean(current.reversesPostingId)
                }
                onChange={(event) => setEdit.wbsId(event.target.value)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="">No WBS</MenuItem>
                {(options?.wbs ?? []).map((wbs) => (
                  <MenuItem key={wbs.id} value={wbs.id}>
                    {wbs.wbsCode} · {wbs.wbsName}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            {canCreate && draft ? (
              <Button
                variant="outlined"
                disabled={
                  busy ||
                  !edit.postingDate ||
                  !edit.description.trim() ||
                  !edit.amount ||
                  !edit.costCodeId
                }
                onClick={save}
              >
                Save Draft
              </Button>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {canSubmit && draft ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Submit for Approval</Typography>
              <TextField
                select
                label="Approval workflow"
                value={workflowCode}
                onChange={(event) => setWorkflowCode(event.target.value)}
                fullWidth
              >
                {workflows.map((workflow) => (
                  <MenuItem
                    key={workflow.id}
                    value={workflow.workflowCode}
                  >
                    {workflow.workflowName} · {workflow.workflowCode}
                  </MenuItem>
                ))}
              </TextField>
              {workflows.length === 0 ? (
                <Alert severity="warning">
                  No active DIRECT_COST_POSTING approval workflow is
                  configured. Configure one in Approval Matrix before submit.
                </Alert>
              ) : null}
              <Button
                variant="contained"
                disabled={busy || !workflowCode}
                onClick={submit}
              >
                Submit Direct Cost
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canApprove && submitted ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Approval Action</Typography>
              <TextField
                label="Comment (optional)"
                value={actionComment}
                onChange={(event) => setActionComment(event.target.value)}
                multiline
                minRows={2}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  disabled={busy}
                  onClick={approve}
                >
                  Approve
                </Button>
                <Button
                  color="error"
                  variant="outlined"
                  disabled={busy}
                  onClick={reject}
                >
                  Reject
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canCreate && approvedOriginal ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Create Linked Reversal</Typography>
              <Alert severity="warning">
                Approved Direct Cost records are immutable. Correction is a new
                linked reversal with the exact opposite amount and the same
                WBS / Cost Code dimensions.
              </Alert>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  type="date"
                  label="Reversal posting date"
                  value={reversalDate}
                  onChange={(event) => setReversalDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Reference (optional)"
                  value={reversalReference}
                  onChange={(event) =>
                    setReversalReference(event.target.value)
                  }
                  sx={{ flex: 2 }}
                />
              </Stack>
              <TextField
                label="Reversal reason"
                value={reversalReason}
                onChange={(event) => setReversalReason(event.target.value)}
                multiline
                minRows={2}
              />
              <Button
                variant="outlined"
                disabled={busy || !reversalDate || !reversalReason.trim()}
                onClick={reverse}
              >
                Create Reversal Draft
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {current.approvalInstance ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">Approval History</Typography>
              <Typography variant="body2" color="text.secondary">
                {current.approvalInstance.workflow.workflowName} ·{' '}
                {current.approvalInstance.approvalState}
              </Typography>
              {current.approvalInstance.actions.map((action) => (
                <Typography key={action.id} variant="body2">
                  {action.actionAt.slice(0, 19).replace('T', ' ')} ·{' '}
                  {action.action} ·{' '}
                  {action.actionByUser?.displayName ?? 'Unknown actor'}
                  {action.approvalStep
                    ? ' · ' + action.approvalStep.stepName
                    : ''}
                  {action.comment ? ' · ' + action.comment : ''}
                </Typography>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
