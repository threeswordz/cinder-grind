import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
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
  PoAward,
  PurchaseOrderLine,
  purchaseOrdersApi,
} from '../api/purchase-orders';

type Props = {
  permissions: string[];
};

type LineDraft = {
  quantity: string;
  unitPrice: string;
  wbsId: string;
  costCodeId: string;
  requiredOnSite: string;
  expectedDelivery: string;
  remarks: string;
};

function message(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The request could not be completed.';
}

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function lineDraft(line: PurchaseOrderLine): LineDraft {
  return {
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    wbsId: line.wbsId ?? '',
    costCodeId: line.costCodeId ?? '',
    requiredOnSite: dateValue(line.requiredOnSite),
    expectedDelivery: dateValue(line.expectedDelivery),
    remarks: line.remarks ?? '',
  };
}

export function PurchaseOrdersPanel({ permissions }: Props) {
  const queryClient = useQueryClient();
  const canView = permissions.includes('procurement.po.view');
  const canCreate = permissions.includes('procurement.po.create');
  const canEdit = permissions.includes('procurement.po.edit');
  const canSubmit = permissions.includes('procurement.po.submit');
  const canApprove = permissions.includes('procurement.po.approve');
  const canReject = permissions.includes('procurement.po.reject');
  const canCancel = permissions.includes('procurement.po.cancel');
  const canRevise = permissions.includes('procurement.po.revise');

  const [projectId, setProjectId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [selectedAwards, setSelectedAwards] = useState<string[]>([]);
  const [createRemarks, setCreateRemarks] = useState('');
  const [headerRemarks, setHeaderRemarks] = useState('');
  const [workflowCode, setWorkflowCode] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});

  const projects = useQuery({
    queryKey: ['po-projects', canView ? 'view' : 'create'],
    queryFn: canView
      ? purchaseOrdersApi.projects
      : purchaseOrdersApi.createProjects,
    enabled: canView || canCreate,
  });

  useEffect(() => {
    const values = projects.data?.data ?? [];
    if (!projectId && values[0]) setProjectId(values[0].id);
    if (projectId && !values.some((project) => project.id === projectId)) {
      setProjectId(values[0]?.id ?? '');
    }
  }, [projectId, projects.data]);

  useEffect(() => {
    setOrderId('');
    setSelectedAwards([]);
  }, [projectId]);

  const options = useQuery({
    queryKey: ['po-options', projectId],
    queryFn: () => purchaseOrdersApi.options(projectId),
    enabled: canEdit && Boolean(projectId),
  });

  const awards = useQuery({
    queryKey: ['po-awards', projectId],
    queryFn: () => purchaseOrdersApi.awards(projectId),
    enabled: canCreate && Boolean(projectId),
  });

  const orders = useQuery({
    queryKey: ['purchase-orders', projectId],
    queryFn: () => purchaseOrdersApi.list(projectId),
    enabled: canView && Boolean(projectId),
  });

  useEffect(() => {
    const values = orders.data?.data ?? [];
    if (!orderId && values[0]) setOrderId(values[0].id);
    if (orderId && !values.some((order) => order.id === orderId)) {
      setOrderId(values[0]?.id ?? '');
    }
  }, [orderId, orders.data]);

  const detail = useQuery({
    queryKey: ['purchase-order', orderId],
    queryFn: () => purchaseOrdersApi.detail(orderId),
    enabled: canView && Boolean(orderId),
  });

  const revisions = useQuery({
    queryKey: ['purchase-order-revisions', orderId],
    queryFn: () => purchaseOrdersApi.revisions(orderId),
    enabled: canView && Boolean(orderId),
  });

  const workflows = useQuery({
    queryKey: ['po-workflows'],
    queryFn: purchaseOrdersApi.workflows,
    enabled: canSubmit,
  });

  useEffect(() => {
    const values = workflows.data?.data ?? [];
    if (!workflowCode && values[0]) setWorkflowCode(values[0].workflowCode);
  }, [workflowCode, workflows.data]);

  useEffect(() => {
    const current = detail.data?.data;
    if (!current) return;
    setHeaderRemarks(current.remarks ?? '');
    setLineDrafts(
      Object.fromEntries(
        current.lines.map((line) => [line.id, lineDraft(line)]),
      ),
    );
  }, [detail.data]);

  const refreshProject = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['purchase-orders', projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['po-awards', projectId],
      }),
    ]);
  };

  const refreshOrder = async (id = orderId) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['purchase-order', id],
      }),
      queryClient.invalidateQueries({
        queryKey: ['purchase-order-revisions', id],
      }),
      queryClient.invalidateQueries({
        queryKey: ['purchase-orders', projectId],
      }),
    ]);
  };

  const createOrder = useMutation({
    mutationFn: () =>
      purchaseOrdersApi.create(projectId, selectedAwards, createRemarks || null),
    onSuccess: async (result) => {
      setSelectedAwards([]);
      setCreateRemarks('');
      setOrderId(result.data.id);
      await refreshProject();
    },
  });

  const saveHeader = useMutation({
    mutationFn: () =>
      purchaseOrdersApi.update(orderId, {
        remarks: headerRemarks || null,
      }),
    onSuccess: () => refreshOrder(),
  });

  const saveLine = useMutation({
    mutationFn: ({
      lineId,
      draft,
    }: {
      lineId: string;
      draft: LineDraft;
    }) =>
      purchaseOrdersApi.updateLine(lineId, {
        quantity: draft.quantity,
        unitPrice: draft.unitPrice,
        wbsId: draft.wbsId || null,
        costCodeId: draft.costCodeId || null,
        requiredOnSite: draft.requiredOnSite || null,
        expectedDelivery: draft.expectedDelivery || null,
        remarks: draft.remarks || null,
      }),
    onSuccess: () => refreshOrder(),
  });

  const deleteLine = useMutation({
    mutationFn: purchaseOrdersApi.deleteLine,
    onSuccess: async () => {
      await refreshOrder();
      await queryClient.invalidateQueries({
        queryKey: ['po-awards', projectId],
      });
    },
  });

  const submitOrder = useMutation({
    mutationFn: () => purchaseOrdersApi.submit(orderId, workflowCode),
    onSuccess: () => refreshOrder(),
  });

  const approveOrder = useMutation({
    mutationFn: () =>
      purchaseOrdersApi.approve(orderId, actionComment || null),
    onSuccess: async () => {
      setActionComment('');
      await refreshOrder();
    },
  });

  const rejectOrder = useMutation({
    mutationFn: () =>
      purchaseOrdersApi.reject(orderId, actionComment || null),
    onSuccess: async () => {
      setActionComment('');
      await refreshOrder();
    },
  });

  const cancelOrder = useMutation({
    mutationFn: () => purchaseOrdersApi.cancel(orderId, cancelReason),
    onSuccess: async () => {
      setCancelReason('');
      await refreshOrder();
    },
  });

  const reviseOrder = useMutation({
    mutationFn: () =>
      purchaseOrdersApi.revise(orderId, revisionReason || null),
    onSuccess: async (result) => {
      setRevisionReason('');
      setOrderId(result.data.id);
      await refreshProject();
    },
  });

  const selectedAwardRows = useMemo(
    () =>
      (awards.data?.data ?? []).filter((award) =>
        selectedAwards.includes(award.id),
      ),
    [awards.data, selectedAwards],
  );
  const selectedSupplierId = selectedAwardRows[0]?.supplierId ?? null;

  const toggleAward = (award: PoAward, checked: boolean) => {
    setSelectedAwards((current) => {
      if (!checked) return current.filter((id) => id !== award.id);
      const currentRows = (awards.data?.data ?? []).filter((item) =>
        current.includes(item.id),
      );
      if (
        currentRows.length > 0 &&
        currentRows.some((item) => item.supplierId !== award.supplierId)
      ) {
        return [award.id];
      }
      return current.includes(award.id) ? current : [...current, award.id];
    });
  };

  const current = detail.data?.data;
  const draft = current?.lifecycleState === 'DRAFT';
  const awaitingApproval = current?.lifecycleState === 'SUBMITTED';
  const approved = current?.lifecycleState === 'APPROVED';
  const busy =
    createOrder.isPending ||
    saveHeader.isPending ||
    saveLine.isPending ||
    deleteLine.isPending ||
    submitOrder.isPending ||
    approveOrder.isPending ||
    rejectOrder.isPending ||
    cancelOrder.isPending ||
    reviseOrder.isPending;

  const mutationError =
    createOrder.error ||
    saveHeader.error ||
    saveLine.error ||
    deleteLine.error ||
    submitOrder.error ||
    approveOrder.error ||
    rejectOrder.error ||
    cancelOrder.error ||
    reviseOrder.error;

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
        <Typography variant="h5">Purchase Orders</Typography>
        <Typography color="text.secondary">
          Award-backed supplier commitments with immutable numbering, approval
          control, revisions and delivery dates.
        </Typography>
      </Box>

      {projects.isError ? (
        <Alert severity="error">{message(projects.error)}</Alert>
      ) : null}
      {mutationError ? (
        <Alert severity="error">{message(mutationError)}</Alert>
      ) : null}
      {options.isError ? (
        <Alert severity="error">{message(options.error)}</Alert>
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
          </MenuItem>
        ))}
      </TextField>

      {canCreate && projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Create from Supplier Awards</Typography>
              <Alert severity="info">
                One PO can contain award lines for one Supplier only. Selecting
                an award from another Supplier starts a new selection.
              </Alert>
              {awards.isPending ? <CircularProgress size={24} /> : null}
              {awards.isError ? (
                <Alert severity="error">{message(awards.error)}</Alert>
              ) : null}
              {(awards.data?.data ?? []).length === 0 && !awards.isPending ? (
                <Typography color="text.secondary">
                  No unused Supplier Award lines are available for this Project.
                </Typography>
              ) : null}
              {(awards.data?.data ?? []).map((award) => (
                <FormControlLabel
                  key={award.id}
                  control={
                    <Checkbox
                      checked={selectedAwards.includes(award.id)}
                      onChange={(_event, checked) =>
                        toggleAward(award, checked)
                      }
                    />
                  }
                  label={
                    award.rfqNumber +
                    ' · ' +
                    award.prNumber +
                    ' · ' +
                    award.supplierCodeSnapshot +
                    ' · ' +
                    (award.material?.materialCode ?? award.description) +
                    ' · Qty ' +
                    award.quantity +
                    ' @ ' +
                    award.unitPrice
                  }
                />
              ))}
              {selectedSupplierId ? (
                <Typography variant="body2" color="text.secondary">
                  Selected Supplier:{' '}
                  {selectedAwardRows[0]?.supplierCodeSnapshot} ·{' '}
                  {selectedAwardRows[0]?.supplierNameSnapshot}
                </Typography>
              ) : null}
              <TextField
                label="PO remarks"
                value={createRemarks}
                onChange={(event) => setCreateRemarks(event.target.value)}
                multiline
                minRows={2}
              />
              <Button
                variant="contained"
                disabled={!selectedAwards.length || createOrder.isPending}
                onClick={() => createOrder.mutate()}
              >
                Create Draft PO
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canView && projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Purchase Order Register</Typography>
              {orders.isPending ? <CircularProgress size={24} /> : null}
              {orders.isError ? (
                <Alert severity="error">{message(orders.error)}</Alert>
              ) : null}
              <TextField
                select
                label="Purchase Order revision"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                fullWidth
              >
                {(orders.data?.data ?? []).map((order) => (
                  <MenuItem key={order.id} value={order.id}>
                    {order.poNumber} · Rev {order.revisionNo} ·{' '}
                    {order.supplier.supplierCode} · {order.lifecycleState}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canView && orderId && detail.isPending ? (
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }}>
          <CircularProgress />
        </Box>
      ) : null}
      {detail.isError ? (
        <Alert severity="error">{message(detail.error)}</Alert>
      ) : null}

      {current ? (
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
                    <Typography variant="h6">
                      {current.poNumber} · Revision {current.revisionNo}
                    </Typography>
                    <Typography color="text.secondary">
                      {current.project.projectCode} ·{' '}
                      {current.supplier.supplierCode} ·{' '}
                      {current.supplier.supplierName}
                    </Typography>
                  </Box>
                  <Chip label={current.lifecycleState} />
                </Stack>

                {current.previousRevision ? (
                  <Typography variant="body2">
                    Previous revision: Rev {current.previousRevision.revisionNo}
                  </Typography>
                ) : null}
                {current.nextRevision ? (
                  <Alert severity="info">
                    A newer revision exists: Rev{' '}
                    {current.nextRevision.revisionNo}.
                  </Alert>
                ) : null}
                {current.cancellationReason ? (
                  <Alert severity="warning">
                    Cancellation: {current.cancellationReason}
                  </Alert>
                ) : null}

                <TextField
                  label="Remarks"
                  value={headerRemarks}
                  disabled={!canEdit || !draft}
                  onChange={(event) => setHeaderRemarks(event.target.value)}
                  multiline
                  minRows={2}
                />
                {canEdit && draft ? (
                  <Button
                    variant="outlined"
                    disabled={saveHeader.isPending}
                    onClick={() => saveHeader.mutate()}
                  >
                    Save PO Header
                  </Button>
                ) : null}

                <Divider />
                <Typography variant="subtitle1">PO Lines</Typography>

                {current.lines.map((line) => {
                  const values = lineDrafts[line.id] ?? lineDraft(line);
                  return (
                    <Stack
                      key={line.id}
                      spacing={1.5}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                      }}
                    >
                      <Typography>
                        Line {line.lineNo} ·{' '}
                        {line.materialCodeSnapshot
                          ? line.materialCodeSnapshot + ' · '
                          : ''}
                        {line.description}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Source: {line.purchaseRequestLine?.purchaseRequest.prNumber ??
                          'PR'}{' '}
                        → {line.rfq?.rfqNumber ?? 'RFQ'} → Supplier Award
                      </Typography>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1}
                      >
                        <TextField
                          label="Quantity"
                          value={values.quantity}
                          disabled={!canEdit || !draft}
                          onChange={(event) =>
                            setLineDrafts((all) => ({
                              ...all,
                              [line.id]: {
                                ...values,
                                quantity: event.target.value,
                              },
                            }))
                          }
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          label="Unit price"
                          value={values.unitPrice}
                          disabled={!canEdit || !draft}
                          onChange={(event) =>
                            setLineDrafts((all) => ({
                              ...all,
                              [line.id]: {
                                ...values,
                                unitPrice: event.target.value,
                              },
                            }))
                          }
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          label="Amount"
                          value={line.amount}
                          disabled
                          sx={{ flex: 1 }}
                        />
                      </Stack>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1}
                      >
                        <TextField
                          label="Required on site"
                          type="date"
                          value={values.requiredOnSite}
                          disabled={!canEdit || !draft}
                          onChange={(event) =>
                            setLineDrafts((all) => ({
                              ...all,
                              [line.id]: {
                                ...values,
                                requiredOnSite: event.target.value,
                              },
                            }))
                          }
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          label="Expected delivery"
                          type="date"
                          value={values.expectedDelivery}
                          disabled={!canEdit || !draft}
                          onChange={(event) =>
                            setLineDrafts((all) => ({
                              ...all,
                              [line.id]: {
                                ...values,
                                expectedDelivery: event.target.value,
                              },
                            }))
                          }
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1 }}
                        />
                      </Stack>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1}
                      >
                        <TextField
                          select
                          label="WBS"
                          value={values.wbsId}
                          disabled={!canEdit || !draft}
                          onChange={(event) =>
                            setLineDrafts((all) => ({
                              ...all,
                              [line.id]: {
                                ...values,
                                wbsId: event.target.value,
                              },
                            }))
                          }
                          sx={{ flex: 1 }}
                        >
                          <MenuItem value="">No WBS</MenuItem>
                          {(options.data?.data.wbs ?? []).map((wbs) => (
                            <MenuItem key={wbs.id} value={wbs.id}>
                              {wbs.wbsCode} · {wbs.wbsName}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          label="Cost Code"
                          value={values.costCodeId}
                          disabled={!canEdit || !draft}
                          onChange={(event) =>
                            setLineDrafts((all) => ({
                              ...all,
                              [line.id]: {
                                ...values,
                                costCodeId: event.target.value,
                              },
                            }))
                          }
                          sx={{ flex: 1 }}
                        >
                          <MenuItem value="">No Cost Code</MenuItem>
                          {(options.data?.data.costCodes ?? []).map((cost) => (
                            <MenuItem key={cost.id} value={cost.id}>
                              {cost.costCode} · {cost.costName}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Stack>
                      <TextField
                        label="Line remarks"
                        value={values.remarks}
                        disabled={!canEdit || !draft}
                        onChange={(event) =>
                          setLineDrafts((all) => ({
                            ...all,
                            [line.id]: {
                              ...values,
                              remarks: event.target.value,
                            },
                          }))
                        }
                      />
                      {canEdit && draft ? (
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="outlined"
                            disabled={busy}
                            onClick={() =>
                              saveLine.mutate({
                                lineId: line.id,
                                draft: values,
                              })
                            }
                          >
                            Save Line
                          </Button>
                          <Button
                            color="error"
                            disabled={busy || current.lines.length <= 1}
                            onClick={() => deleteLine.mutate(line.id)}
                          >
                            Remove Line
                          </Button>
                        </Stack>
                      ) : null}
                    </Stack>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Workflow & Revision Controls</Typography>

                {canSubmit && draft ? (
                  <Stack spacing={1}>
                    <TextField
                      select
                      label="Approval workflow"
                      value={workflowCode}
                      onChange={(event) => setWorkflowCode(event.target.value)}
                    >
                      {(workflows.data?.data ?? []).map((workflow) => (
                        <MenuItem
                          key={workflow.id}
                          value={workflow.workflowCode}
                        >
                          {workflow.workflowName} · {workflow.workflowCode}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="contained"
                      disabled={!workflowCode || busy}
                      onClick={() => submitOrder.mutate()}
                    >
                      Submit for Approval
                    </Button>
                  </Stack>
                ) : null}

                {awaitingApproval && (canApprove || canReject) ? (
                  <Stack spacing={1}>
                    <TextField
                      label="Approval comment"
                      value={actionComment}
                      onChange={(event) => setActionComment(event.target.value)}
                      multiline
                      minRows={2}
                    />
                    <Stack direction="row" spacing={1}>
                      {canApprove ? (
                        <Button
                          variant="contained"
                          disabled={busy}
                          onClick={() => approveOrder.mutate()}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {canReject ? (
                        <Button
                          color="error"
                          variant="outlined"
                          disabled={busy}
                          onClick={() => rejectOrder.mutate()}
                        >
                          Reject
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                ) : null}

                {canCancel &&
                current.lifecycleState !== 'CANCELLED' &&
                current.lifecycleState !== 'REJECTED' &&
                !current.nextRevision ? (
                  <Stack spacing={1}>
                    <TextField
                      label="Cancellation reason"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                    />
                    <Button
                      color="error"
                      variant="outlined"
                      disabled={!cancelReason.trim() || busy}
                      onClick={() => cancelOrder.mutate()}
                    >
                      Cancel Revision
                    </Button>
                  </Stack>
                ) : null}

                {canRevise && approved && !current.nextRevision ? (
                  <Stack spacing={1}>
                    <TextField
                      label="Revision reason"
                      value={revisionReason}
                      onChange={(event) => setRevisionReason(event.target.value)}
                    />
                    <Button
                      variant="outlined"
                      disabled={busy}
                      onClick={() => reviseOrder.mutate()}
                    >
                      Create New Revision
                    </Button>
                  </Stack>
                ) : null}

                {current.approvalInstance?.actions?.length ? (
                  <>
                    <Divider />
                    <Typography variant="subtitle2">
                      Approval action history
                    </Typography>
                    {current.approvalInstance.actions.map((action) => (
                      <Typography key={action.id} variant="body2">
                        {action.approvalStep
                          ? 'Step ' +
                            action.approvalStep.stepNo +
                            ' · ' +
                            action.approvalStep.stepName +
                            ' · '
                          : ''}
                        {action.actionByUser?.displayName ?? 'System'} ·{' '}
                        {new Date(action.actionAt).toLocaleString()}
                        {action.comment ? ' · ' + action.comment : ''}
                      </Typography>
                    ))}
                  </>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6">Revision History</Typography>
                {revisions.isPending ? <CircularProgress size={24} /> : null}
                {revisions.isError ? (
                  <Alert severity="error">{message(revisions.error)}</Alert>
                ) : null}
                {(revisions.data?.data ?? []).map((revision) => (
                  <Stack
                    key={revision.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                  >
                    <Button onClick={() => setOrderId(revision.id)}>
                      Rev {revision.revisionNo}
                    </Button>
                    <Chip size="small" label={revision.lifecycleState} />
                    <Typography variant="body2" color="text.secondary">
                      {revision.revisionReason ?? 'Initial revision'} ·{' '}
                      {revision._count.lines} line(s)
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      ) : null}
    </Stack>
  );
}
