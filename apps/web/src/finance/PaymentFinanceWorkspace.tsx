import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  PaymentAllocationTarget,
  PaymentDirection,
  paymentApi,
} from '../api/finance';

type Props = {
  permissions: string[];
};

function key() {
  return crypto.randomUUID();
}

function message(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The request could not be completed.';
}

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

export function PaymentFinanceWorkspace({ permissions }: Props) {
  const queryClient = useQueryClient();
  const canView = permissions.includes('finance.payment.view');
  const canCreate = permissions.includes('finance.payment.create');
  const canEdit = permissions.includes('finance.payment.edit');
  const canSubmit = permissions.includes('finance.payment.submit');
  const canApprove = permissions.includes('finance.payment.approve');
  const canReject = permissions.includes('finance.payment.reject');
  const canCancel = permissions.includes('finance.payment.cancel');

  const [projectId, setProjectId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [direction, setDirection] = useState<PaymentDirection>('OUTBOUND');
  const [counterparty, setCounterparty] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reference, setReference] = useState('');
  const [createKey, setCreateKey] = useState(key);

  const [headerDate, setHeaderDate] = useState('');
  const [headerAmount, setHeaderAmount] = useState('');
  const [headerMethod, setHeaderMethod] = useState('');
  const [headerReference, setHeaderReference] = useState('');

  const [allocationTarget, setAllocationTarget] = useState('');
  const [allocationAmount, setAllocationAmount] = useState('');
  const [workflowCode, setWorkflowCode] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  const retryKeys = useRef(new Map<string, string>());
  const actionKey = (signature: string) => {
    const existing = retryKeys.current.get(signature);
    if (existing) return existing;
    const value = key();
    retryKeys.current.set(signature, value);
    return value;
  };
  const clearActionKey = (signature: string) => {
    retryKeys.current.delete(signature);
  };

  const projects = useQuery({
    queryKey: ['finance-payment-projects'],
    queryFn: paymentApi.projects,
    enabled: canView,
  });

  useEffect(() => {
    const rows = projects.data?.data ?? [];
    if (!projectId && rows[0]) setProjectId(rows[0].id);
    if (projectId && !rows.some((project) => project.id === projectId)) {
      setProjectId(rows[0]?.id ?? '');
    }
  }, [projectId, projects.data]);

  useEffect(() => {
    setPaymentId('');
    setCounterparty('');
    setAllocationTarget('');
  }, [projectId]);

  const options = useQuery({
    queryKey: ['finance-payment-options', projectId],
    queryFn: () => paymentApi.options(projectId),
    enabled: canView && Boolean(projectId),
  });

  const payments = useQuery({
    queryKey: ['finance-payments', projectId],
    queryFn: () => paymentApi.list(projectId),
    enabled: canView && Boolean(projectId),
  });

  useEffect(() => {
    if (payments.isFetching) return;
    const rows = payments.data?.data ?? [];
    if (!paymentId && rows[0]) setPaymentId(rows[0].id);
    if (paymentId && !rows.some((payment) => payment.id === paymentId)) {
      setPaymentId(rows[0]?.id ?? '');
    }
  }, [paymentId, payments.data, payments.isFetching]);

  const detail = useQuery({
    queryKey: ['finance-payment', paymentId],
    queryFn: () => paymentApi.detail(paymentId),
    enabled: canView && Boolean(paymentId),
  });

  const workflows = useQuery({
    queryKey: ['finance-payment-workflows'],
    queryFn: paymentApi.workflows,
    enabled: canSubmit,
  });

  useEffect(() => {
    const rows = workflows.data?.data ?? [];
    if (!workflowCode && rows[0]) setWorkflowCode(rows[0].workflowCode);
  }, [workflowCode, workflows.data]);

  useEffect(() => {
    const current = detail.data?.data;
    if (!current) return;
    setHeaderDate(dateValue(current.paymentDate));
    setHeaderAmount(current.amount);
    setHeaderMethod(current.paymentMethod ?? '');
    setHeaderReference(current.reference ?? '');
  }, [detail.data]);

  useEffect(() => {
    setCounterparty('');
    setAllocationTarget('');
  }, [direction]);

  const counterpartyOptions = useMemo(() => {
    const data = options.data?.data;
    if (!data) return [];
    if (direction === 'INBOUND') {
      return data.customers.map((customer) => ({
        value: 'CUSTOMER:' + customer.id,
        label: customer.customerCode + ' · ' + customer.customerName,
      }));
    }
    return [
      ...data.suppliers.map((supplier) => ({
        value: 'SUPPLIER:' + supplier.id,
        label: 'Supplier · ' + supplier.supplierCode + ' · ' + supplier.supplierName,
      })),
      ...data.subcontractors.map((subcontractor) => ({
        value: 'SUBCONTRACTOR:' + subcontractor.id,
        label:
          'Subcontractor · ' +
          subcontractor.subcontractorCode +
          ' · ' +
          subcontractor.subcontractorName,
      })),
    ];
  }, [direction, options.data]);

  const allocationChoices = useMemo(() => {
    const data = options.data?.data;
    const current = detail.data?.data;
    if (!data || !current) return [];

    if (current.paymentDirection === 'INBOUND' && current.customerId) {
      return data.clientInvoices
        .filter((invoice) => invoice.customerId === current.customerId)
        .map((invoice) => ({
          value: 'CLIENT_INVOICE:' + invoice.id,
          label:
            invoice.clientInvoiceNumber +
            ' · ' +
            invoice.currencyCode +
            ' ' +
            invoice.totalAmount,
        }));
    }
    if (current.supplierId) {
      return data.supplierInvoices
        .filter((invoice) => invoice.supplierId === current.supplierId)
        .map((invoice) => ({
          value: 'SUPPLIER_INVOICE:' + invoice.id,
          label:
            invoice.supplierInvoiceNumber +
            ' · ' +
            invoice.supplierReference +
            ' · ' +
            invoice.currencyCode +
            ' ' +
            invoice.totalAmount,
        }));
    }
    if (current.subcontractorId) {
      return data.certifications
        .filter(
          (certification) =>
            certification.agreement.subcontractorId === current.subcontractorId,
        )
        .map((certification) => ({
          value: 'SUBCONTRACT_CERTIFICATION:' + certification.id,
          label:
            certification.certificationNumber +
            ' · payable ' +
            certification.currencyCode +
            ' ' +
            (certification.netCertifiedAmount ?? '0'),
        }));
    }
    return [];
  }, [detail.data, options.data]);

  const refreshProject = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['finance-payments', projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['finance-payment-options', projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['client-finance-ap', projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['client-finance-ar', projectId],
      }),
    ]);
  };

  const refreshPayment = async (id = paymentId) => {
    await Promise.all([
      refreshProject(),
      queryClient.invalidateQueries({
        queryKey: ['finance-payment', id],
      }),
    ]);
  };

  const createPayment = useMutation({
    mutationFn: () => {
      const [kind, id] = counterparty.split(':', 2);
      return paymentApi.create(projectId, {
        direction,
        paymentDate,
        amount,
        paymentMethod: paymentMethod.trim() || null,
        reference: reference.trim() || null,
        createKey,
        supplierId: kind === 'SUPPLIER' ? id : null,
        customerId: kind === 'CUSTOMER' ? id : null,
        subcontractorId: kind === 'SUBCONTRACTOR' ? id : null,
      });
    },
    onSuccess: async (result) => {
      await refreshProject();
      setPaymentId(result.data.id);
      setAmount('');
      setReference('');
      setPaymentMethod('');
      setCreateKey(key());
    },
  });

  const saveHeader = useMutation({
    mutationFn: () =>
      paymentApi.update(paymentId, {
        paymentDate: headerDate,
        amount: headerAmount,
        paymentMethod: headerMethod.trim() || null,
        reference: headerReference.trim() || null,
      }),
    onSuccess: () => refreshPayment(),
  });

  const addAllocation = useMutation({
    mutationFn: () => {
      const [targetType, targetId] = allocationTarget.split(':', 2) as [
        PaymentAllocationTarget,
        string,
      ];
      const signature =
        'allocate:' + paymentId + ':' + targetType + ':' + targetId + ':' + allocationAmount;
      return paymentApi
        .addAllocation(paymentId, {
          targetType,
          targetId,
          amount: allocationAmount,
          actionKey: actionKey(signature),
        })
        .then((result) => {
          clearActionKey(signature);
          return result;
        });
    },
    onSuccess: async () => {
      setAllocationAmount('');
      setAllocationTarget('');
      await refreshPayment();
    },
  });

  const removeAllocation = useMutation({
    mutationFn: ({
      allocationId,
      targetType,
    }: {
      allocationId: string;
      targetType: PaymentAllocationTarget;
    }) => {
      const signature =
        'remove:' + paymentId + ':' + targetType + ':' + allocationId;
      return paymentApi
        .removeAllocation(
          paymentId,
          allocationId,
          targetType,
          actionKey(signature),
        )
        .then((result) => {
          clearActionKey(signature);
          return result;
        });
    },
    onSuccess: () => refreshPayment(),
  });

  const workflowAction = useMutation({
    mutationFn: async (action: 'submit' | 'approve' | 'reject') => {
      const signature =
        action +
        ':' +
        paymentId +
        ':' +
        (action === 'submit' ? workflowCode : actionComment);
      const retry = actionKey(signature);
      let result;
      if (action === 'submit') {
        result = await paymentApi.submit(paymentId, workflowCode, retry);
      } else if (action === 'approve') {
        result = await paymentApi.approve(paymentId, retry, actionComment);
      } else {
        result = await paymentApi.reject(paymentId, retry, actionComment);
      }
      clearActionKey(signature);
      return result;
    },
    onSuccess: async () => {
      setActionComment('');
      await refreshPayment();
    },
  });

  const cancelPayment = useMutation({
    mutationFn: async () => {
      const signature = 'cancel:' + paymentId + ':' + cancellationReason;
      const result = await paymentApi.cancel(
        paymentId,
        actionKey(signature),
        cancellationReason,
      );
      clearActionKey(signature);
      return result;
    },
    onSuccess: async () => {
      setCancellationReason('');
      await refreshPayment();
    },
  });

  if (!canView) {
    return (
      <Alert severity="info">
        Payment access requires finance.payment.view.
      </Alert>
    );
  }

  if (projects.isLoading) return <CircularProgress />;

  const current = detail.data?.data;
  const currentProject = (projects.data?.data ?? []).find(
    (project) => project.id === projectId,
  );
  const draft = current?.state === 'DRAFT';

  const allAllocations = current
    ? [
        ...current.supplierAllocations.map((allocation) => ({
          id: allocation.id,
          targetType: 'SUPPLIER_INVOICE' as PaymentAllocationTarget,
          label:
            allocation.supplierInvoice.supplierInvoiceNumber +
            ' · ' +
            allocation.supplierInvoice.supplierReference,
          amount: allocation.allocatedAmount,
        })),
        ...current.clientAllocations.map((allocation) => ({
          id: allocation.id,
          targetType: 'CLIENT_INVOICE' as PaymentAllocationTarget,
          label: allocation.clientInvoice.clientInvoiceNumber,
          amount: allocation.allocatedAmount,
        })),
        ...current.subcontractAllocations.map((allocation) => ({
          id: allocation.id,
          targetType: 'SUBCONTRACT_CERTIFICATION' as PaymentAllocationTarget,
          label: allocation.subcontractCertification.certificationNumber,
          amount: allocation.allocatedAmount,
        })),
      ]
    : [];

  return (
    <Stack spacing={2}>
      <Stack>
        <Typography variant="h5">Payments & Allocations</Typography>
        <Typography variant="body2" color="text.secondary">
          Finance-owned inbound/outbound Payments with one-Project settlement,
          approval history and retained cancellation evidence.
        </Typography>
      </Stack>

      {(createPayment.error ||
        saveHeader.error ||
        addAllocation.error ||
        removeAllocation.error ||
        workflowAction.error ||
        cancelPayment.error) && (
        <Alert severity="error">
          {message(
            createPayment.error ??
              saveHeader.error ??
              addAllocation.error ??
              removeAllocation.error ??
              workflowAction.error ??
              cancelPayment.error,
          )}
        </Alert>
      )}

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

      {canCreate && currentProject?.isActive && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">New Payment</Typography>
              <TextField
                select
                label="Direction"
                value={direction}
                onChange={(event) =>
                  setDirection(event.target.value as PaymentDirection)
                }
              >
                <MenuItem value="OUTBOUND">Outbound</MenuItem>
                <MenuItem value="INBOUND">Inbound</MenuItem>
              </TextField>
              <TextField
                select
                label="Counterparty"
                value={counterparty}
                onChange={(event) => setCounterparty(event.target.value)}
              >
                {counterpartyOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Payment date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label={'Amount' + (options.data?.data.baseCurrencyCode ? ' · ' + options.data.data.baseCurrencyCode : '')}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <TextField
                label="Payment method"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              />
              <TextField
                label="Reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
              <Button
                variant="contained"
                disabled={
                  createPayment.isPending ||
                  !projectId ||
                  !counterparty ||
                  !paymentDate ||
                  !amount
                }
                onClick={() => createPayment.mutate()}
              >
                Create Draft Payment
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <TextField
        select
        label="Payment"
        value={paymentId}
        onChange={(event) => setPaymentId(event.target.value)}
        disabled={!projectId || payments.isLoading}
      >
        {(payments.data?.data ?? []).map((payment) => (
          <MenuItem key={payment.id} value={payment.id}>
            {payment.paymentNumber} · {payment.paymentDirection} ·{' '}
            {payment.currencyCode} {payment.amount} · {payment.state}
          </MenuItem>
        ))}
      </TextField>

      {detail.isLoading && paymentId ? <CircularProgress /> : null}

      {current ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h6">{current.paymentNumber}</Typography>
                <Chip label={current.state} size="small" />
                <Chip label={current.paymentDirection} size="small" variant="outlined" />
                <Typography>
                  {current.currencyCode} {current.amount}
                </Typography>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                {current.supplier
                  ? 'Supplier · ' + current.supplier.supplierName
                  : current.customer
                    ? 'Customer · ' + current.customer.customerName
                    : current.subcontractor
                      ? 'Subcontractor · ' + current.subcontractor.subcontractorName
                      : 'No counterparty'}
              </Typography>

              {draft && canEdit ? (
                <Stack spacing={2}>
                  <Divider />
                  <Typography variant="subtitle1">Draft header</Typography>
                  <TextField
                    type="date"
                    label="Payment date"
                    value={headerDate}
                    onChange={(event) => setHeaderDate(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="Amount"
                    value={headerAmount}
                    onChange={(event) => setHeaderAmount(event.target.value)}
                  />
                  <TextField
                    label="Payment method"
                    value={headerMethod}
                    onChange={(event) => setHeaderMethod(event.target.value)}
                  />
                  <TextField
                    label="Reference"
                    value={headerReference}
                    onChange={(event) => setHeaderReference(event.target.value)}
                  />
                  <Button
                    variant="outlined"
                    disabled={saveHeader.isPending}
                    onClick={() => saveHeader.mutate()}
                  >
                    Save Draft Header
                  </Button>
                </Stack>
              ) : null}

              <Divider />
              <Typography variant="subtitle1">Allocations</Typography>
              {allAllocations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No allocations. A Payment may remain partially or wholly
                  unallocated.
                </Typography>
              ) : (
                allAllocations.map((allocation) => (
                  <Stack
                    key={allocation.targetType + ':' + allocation.id}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="body2">
                      {allocation.label} · {current.currencyCode}{' '}
                      {allocation.amount}
                    </Typography>
                    {draft && canEdit ? (
                      <Button
                        size="small"
                        color="error"
                        disabled={removeAllocation.isPending}
                        onClick={() =>
                          removeAllocation.mutate({
                            allocationId: allocation.id,
                            targetType: allocation.targetType,
                          })
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </Stack>
                ))
              )}

              {draft && canEdit ? (
                <Stack spacing={2}>
                  <TextField
                    select
                    label="Allocation target"
                    value={allocationTarget}
                    onChange={(event) =>
                      setAllocationTarget(event.target.value)
                    }
                  >
                    {allocationChoices.map((choice) => (
                      <MenuItem key={choice.value} value={choice.value}>
                        {choice.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Allocation amount"
                    value={allocationAmount}
                    onChange={(event) =>
                      setAllocationAmount(event.target.value)
                    }
                  />
                  <Button
                    variant="outlined"
                    disabled={
                      addAllocation.isPending ||
                      !allocationTarget ||
                      !allocationAmount
                    }
                    onClick={() => addAllocation.mutate()}
                  >
                    Add Allocation
                  </Button>
                </Stack>
              ) : null}

              {current.state === 'DRAFT' && canSubmit ? (
                <Stack spacing={2}>
                  <Divider />
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
                        {workflow.workflowName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    disabled={workflowAction.isPending || !workflowCode}
                    onClick={() => workflowAction.mutate('submit')}
                  >
                    Submit Payment
                  </Button>
                </Stack>
              ) : null}

              {current.state === 'SUBMITTED' && (canApprove || canReject) ? (
                <Stack spacing={2}>
                  <Divider />
                  <TextField
                    label="Decision comment"
                    multiline
                    minRows={2}
                    value={actionComment}
                    onChange={(event) => setActionComment(event.target.value)}
                  />
                  <Stack direction="row" spacing={1}>
                    {canApprove ? (
                      <Button
                        variant="contained"
                        disabled={workflowAction.isPending}
                        onClick={() => workflowAction.mutate('approve')}
                      >
                        Approve
                      </Button>
                    ) : null}
                    {canReject ? (
                      <Button
                        color="error"
                        variant="outlined"
                        disabled={workflowAction.isPending}
                        onClick={() => workflowAction.mutate('reject')}
                      >
                        Reject
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              ) : null}

              {current.state === 'APPROVED' && canCancel ? (
                <Stack spacing={2}>
                  <Divider />
                  <TextField
                    label="Cancellation reason"
                    multiline
                    minRows={2}
                    value={cancellationReason}
                    onChange={(event) =>
                      setCancellationReason(event.target.value)
                    }
                  />
                  <Button
                    color="error"
                    variant="outlined"
                    disabled={
                      cancelPayment.isPending || !cancellationReason.trim()
                    }
                    onClick={() => cancelPayment.mutate()}
                  >
                    Cancel Approved Payment
                  </Button>
                </Stack>
              ) : null}

              {current.approvalInstance ? (
                <Stack spacing={1}>
                  <Divider />
                  <Typography variant="subtitle1">Approval history</Typography>
                  {current.approvalInstance.actions.map((action) => (
                    <Typography key={action.id} variant="body2">
                      Step {action.approvalStep?.stepNo ?? '—'} ·{' '}
                      {action.action} · {action.actionByUser?.displayName ?? '—'}
                      {action.comment ? ' · ' + action.comment : ''}
                    </Typography>
                  ))}
                </Stack>
              ) : null}

              {current.state === 'CANCELLED' ? (
                <Alert severity="info">
                  Cancelled by {current.cancelledBy?.displayName ?? '—'} ·{' '}
                  {current.cancellationReason ?? 'No reason retained.'}
                </Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
