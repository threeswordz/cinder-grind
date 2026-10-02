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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '../api/client';
import {
  ClientInvoiceItem,
  ClientInvoiceLineInput,
  clientFinanceApi,
} from '../api/finance';

type Props = { permissions: string[] };
type LineDraft = { description: string; amount: string };

const emptyLine = (): LineDraft => ({ description: '', amount: '' });
const actionKey = () => crypto.randomUUID();

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The Finance request could not be completed.';
}

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function lineInput(line: LineDraft): ClientInvoiceLineInput {
  return { description: line.description.trim(), amount: line.amount };
}

export function ClientFinanceWorkspace({ permissions }: Props) {
  const queryClient = useQueryClient();
  const canView = permissions.includes('finance.client_invoice.view');
  const canCreate = permissions.includes('finance.client_invoice.create');
  const canEdit = permissions.includes('finance.client_invoice.edit');
  const canSubmit = permissions.includes('finance.client_invoice.submit');
  const canApprove = permissions.includes('finance.client_invoice.approve');
  const canReject = permissions.includes('finance.client_invoice.reject');
  const canAp = permissions.includes('finance.ap.view');
  const canAr = permissions.includes('finance.ar.view');
  const hasAccess = canView || canAp || canAr;

  const [projectId, setProjectId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState('');
  const [createKey, setCreateKey] = useState(actionKey);
  const [createLines, setCreateLines] = useState<LineDraft[]>([emptyLine()]);
  const [headerInvoiceDate, setHeaderInvoiceDate] = useState('');
  const [headerDueDate, setHeaderDueDate] = useState('');
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});
  const [newLine, setNewLine] = useState<LineDraft>(emptyLine);
  const [workflowCode, setWorkflowCode] = useState('');
  const [comment, setComment] = useState('');

  const retryActionKeys = useRef(new Map<string, string>());
  const workflowActionSignature = useRef<string | null>(null);

  const retryActionKey = (signature: string) => {
    const existing = retryActionKeys.current.get(signature);
    if (existing) return existing;
    const key = actionKey();
    retryActionKeys.current.set(signature, key);
    return key;
  };

  const clearWorkflowRetryKey = () => {
    if (!workflowActionSignature.current) return;
    retryActionKeys.current.delete(workflowActionSignature.current);
    workflowActionSignature.current = null;
  };

  const projects = useQuery({
    queryKey: ['v06b-finance-projects', canView, canAr, canAp],
    queryFn: () =>
      canView
        ? clientFinanceApi.projects()
        : canAr
          ? clientFinanceApi.accountsReceivableProjects()
          : clientFinanceApi.accountsPayableProjects(),
    enabled: hasAccess,
  });

  useEffect(() => {
    const values = projects.data?.data ?? [];
    if (!projectId && values[0]) setProjectId(values[0].id);
    if (projectId && !values.some((project) => project.id === projectId)) {
      setProjectId(values[0]?.id ?? '');
    }
  }, [projectId, projects.data]);

  useEffect(() => {
    setInvoiceId('');
    setCustomerId('');
  }, [projectId]);

  const options = useQuery({
    queryKey: ['v06b-client-options', projectId],
    queryFn: () => clientFinanceApi.options(projectId),
    enabled: canView && Boolean(projectId),
  });

  useEffect(() => {
    const customers = options.data?.data.customers ?? [];
    if (!customerId && customers[0]) setCustomerId(customers[0].id);
    if (customerId && !customers.some((customer) => customer.id === customerId)) {
      setCustomerId(customers[0]?.id ?? '');
    }
  }, [customerId, options.data]);

  const invoices = useQuery({
    queryKey: ['v06b-client-invoices', projectId],
    queryFn: () => clientFinanceApi.list(projectId),
    enabled: canView && Boolean(projectId),
  });

  useEffect(() => {
    if (invoices.isFetching) return;
    const values = invoices.data?.data ?? [];
    if (!invoiceId && values[0]) setInvoiceId(values[0].id);
    if (invoiceId && !values.some((invoice) => invoice.id === invoiceId)) {
      setInvoiceId(values[0]?.id ?? '');
    }
  }, [invoiceId, invoices.data, invoices.isFetching]);

  const detail = useQuery({
    queryKey: ['v06b-client-invoice', invoiceId],
    queryFn: () => clientFinanceApi.detail(invoiceId),
    enabled: canView && Boolean(invoiceId),
  });

  useEffect(() => {
    const current = detail.data?.data;
    if (!current) return;
    setHeaderInvoiceDate(dateValue(current.invoiceDate));
    setHeaderDueDate(dateValue(current.dueDate));
    setLineDrafts(
      Object.fromEntries(
        current.items.map((line: ClientInvoiceItem) => [
          line.id,
          { description: line.description, amount: line.amount },
        ]),
      ),
    );
  }, [detail.data]);

  const workflows = useQuery({
    queryKey: ['v06b-client-workflows'],
    queryFn: clientFinanceApi.workflows,
    enabled: canSubmit,
  });

  useEffect(() => {
    const values = workflows.data?.data ?? [];
    if (!workflowCode && values[0]) setWorkflowCode(values[0].workflowCode);
  }, [workflowCode, workflows.data]);

  const ap = useQuery({
    queryKey: ['v06b-accounts-payable', projectId],
    queryFn: () => clientFinanceApi.accountsPayable(projectId),
    enabled: canAp && Boolean(projectId),
  });

  const ar = useQuery({
    queryKey: ['v06b-accounts-receivable', projectId],
    queryFn: () => clientFinanceApi.accountsReceivable(projectId),
    enabled: canAr && Boolean(projectId),
  });

  const refresh = async (id = invoiceId) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['v06b-client-invoices', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['v06b-client-invoice', id] }),
      queryClient.invalidateQueries({ queryKey: ['v06b-client-options', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['v06b-accounts-payable', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['v06b-accounts-receivable', projectId] }),
    ]);
  };

  const createInvoice = useMutation({
    mutationFn: () =>
      clientFinanceApi.create(projectId, {
        customerId,
        invoiceDate,
        dueDate: dueDate || null,
        createKey,
        lines: createLines.map(lineInput),
      }),
    onSuccess: async (result) => {
      setInvoiceId(result.data.id);
      setCreateKey(actionKey());
      setDueDate('');
      setCreateLines([emptyLine()]);
      await refresh(result.data.id);
    },
  });

  const saveHeader = useMutation({
    mutationFn: () =>
      clientFinanceApi.update(invoiceId, {
        invoiceDate: headerInvoiceDate,
        dueDate: headerDueDate || null,
      }),
    onSuccess: () => refresh(),
  });

  const saveLine = useMutation({
    mutationFn: ({ id, line }: { id: string; line: LineDraft }) =>
      clientFinanceApi.updateLine(id, lineInput(line)),
    onSuccess: () => refresh(),
  });

  const addLine = useMutation({
    mutationFn: () => clientFinanceApi.addLine(invoiceId, lineInput(newLine)),
    onSuccess: async () => {
      setNewLine(emptyLine());
      await refresh();
    },
  });

  const deleteLine = useMutation({
    mutationFn: clientFinanceApi.deleteLine,
    onSuccess: () => refresh(),
  });

  const submit = useMutation({
    mutationFn: () => {
      const signature = JSON.stringify([
        'client-invoice',
        'submit',
        invoiceId,
        workflowCode,
      ]);
      workflowActionSignature.current = signature;
      return clientFinanceApi.submit(
        invoiceId,
        workflowCode,
        retryActionKey(signature),
      );
    },
    onSuccess: async () => {
      clearWorkflowRetryKey();
      await refresh();
    },
  });

  const approve = useMutation({
    mutationFn: () => {
      const signature = JSON.stringify([
        'client-invoice',
        'approve',
        invoiceId,
        comment || null,
      ]);
      workflowActionSignature.current = signature;
      return clientFinanceApi.approve(
        invoiceId,
        retryActionKey(signature),
        comment || null,
      );
    },
    onSuccess: async () => {
      clearWorkflowRetryKey();
      setComment('');
      await refresh();
    },
  });

  const reject = useMutation({
    mutationFn: () => {
      const signature = JSON.stringify([
        'client-invoice',
        'reject',
        invoiceId,
        comment || null,
      ]);
      workflowActionSignature.current = signature;
      return clientFinanceApi.reject(
        invoiceId,
        retryActionKey(signature),
        comment || null,
      );
    },
    onSuccess: async () => {
      clearWorkflowRetryKey();
      setComment('');
      await refresh();
    },
  });

  if (!hasAccess) {
    return (
      <Alert severity="warning">
        Client Finance requires Client Invoice, AP or AR Finance permission.
      </Alert>
    );
  }

  if (projects.isPending) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 220 }}>
        <CircularProgress />
      </Box>
    );
  }

  const current = detail.data?.data;
  const isDraft = current?.state === 'DRAFT';
  const isSubmitted = current?.state === 'SUBMITTED';
  const busy =
    createInvoice.isPending ||
    saveHeader.isPending ||
    saveLine.isPending ||
    addLine.isPending ||
    deleteLine.isPending ||
    submit.isPending ||
    approve.isPending ||
    reject.isPending;
  const mutationError =
    createInvoice.error ||
    saveHeader.error ||
    saveLine.error ||
    addLine.error ||
    deleteLine.error ||
    submit.error ||
    approve.error ||
    reject.error;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Finance · Client Invoices & AP/AR</Typography>
        <Typography color="text.secondary">
          Project-scoped client billing and derived receivable/payable balances.
          Payment allocation remains in V0.6-C.
        </Typography>
      </Box>

      {projects.isError ? <Alert severity="error">{errorMessage(projects.error)}</Alert> : null}
      {options.isError ? <Alert severity="error">{errorMessage(options.error)}</Alert> : null}
      {mutationError ? <Alert severity="error">{errorMessage(mutationError)}</Alert> : null}

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

      {canView && options.data ? (
        <Alert severity="info">
          Finance currency: {options.data.data.baseCurrencyCode}. Client Invoice
          lines are generic descriptions and amounts; no FX, tax/VAT or detailed
          progress-billing method is introduced in V0.6-B.
        </Alert>
      ) : null}

      {canCreate && projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Create Draft Client Invoice</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  select
                  label="Customer"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  sx={{ flex: 2 }}
                >
                  {(options.data?.data.customers ?? []).map((customer) => (
                    <MenuItem key={customer.id} value={customer.id}>
                      {customer.customerCode} · {customer.customerName}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  type="date"
                  label="Invoice date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  type="date"
                  label="Due date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
              </Stack>
              {createLines.map((line, index) => (
                <Stack key={index} direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField
                    label={'Line ' + (index + 1) + ' description'}
                    value={line.description}
                    onChange={(event) =>
                      setCreateLines((rows) =>
                        rows.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, description: event.target.value }
                            : row,
                        ),
                      )
                    }
                    sx={{ flex: 3 }}
                  />
                  <TextField
                    label="Amount"
                    value={line.amount}
                    onChange={(event) =>
                      setCreateLines((rows) =>
                        rows.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, amount: event.target.value }
                            : row,
                        ),
                      )
                    }
                    sx={{ flex: 1 }}
                  />
                  {createLines.length > 1 ? (
                    <Button
                      color="error"
                      onClick={() =>
                        setCreateLines((rows) =>
                          rows.filter((_row, rowIndex) => rowIndex !== index),
                        )
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </Stack>
              ))}
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  onClick={() => setCreateLines((rows) => [...rows, emptyLine()])}
                >
                  Add line
                </Button>
                <Button
                  variant="contained"
                  disabled={
                    busy ||
                    !customerId ||
                    !invoiceDate ||
                    createLines.some((line) => !line.description.trim() || !line.amount)
                  }
                  onClick={() => createInvoice.mutate()}
                >
                  Create Draft
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canView && projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Client Invoice Register</Typography>
              {invoices.isPending ? <CircularProgress size={24} /> : null}
              {invoices.isError ? <Alert severity="error">{errorMessage(invoices.error)}</Alert> : null}
              <TextField
                select
                label="Client Invoice"
                value={invoiceId}
                onChange={(event) => setInvoiceId(event.target.value)}
                fullWidth
              >
                {(invoices.data?.data ?? []).map((invoice) => (
                  <MenuItem key={invoice.id} value={invoice.id}>
                    {invoice.clientInvoiceNumber} · {invoice.customer.customerCode} ·{' '}
                    {invoice.state} · {invoice.currencyCode} {invoice.totalAmount}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {current ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between">
                <Box>
                  <Typography variant="h6">{current.clientInvoiceNumber}</Typography>
                  <Typography color="text.secondary">
                    {current.project.projectCode} · {current.customer.customerCode} ·{' '}
                    {current.customer.customerName}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip label={current.state} />
                  <Chip variant="outlined" label={current.currencyCode + ' ' + current.totalAmount} />
                </Stack>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  type="date"
                  label="Invoice date"
                  value={headerInvoiceDate}
                  disabled={!canEdit || !isDraft}
                  onChange={(event) => setHeaderInvoiceDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  type="date"
                  label="Due date"
                  value={headerDueDate}
                  disabled={!canEdit || !isDraft}
                  onChange={(event) => setHeaderDueDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                {canEdit && isDraft ? (
                  <Button disabled={busy} onClick={() => saveHeader.mutate()}>
                    Save header
                  </Button>
                ) : null}
              </Stack>

              <Divider />
              <Typography variant="subtitle1">Retained invoice lines</Typography>
              {current.items.map((line) => {
                const draft = lineDrafts[line.id] ?? {
                  description: line.description,
                  amount: line.amount,
                };
                return (
                  <Stack key={line.id} direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      label={'Line ' + line.lineNo + ' description'}
                      value={draft.description}
                      disabled={!canEdit || !isDraft}
                      onChange={(event) =>
                        setLineDrafts((all) => ({
                          ...all,
                          [line.id]: { ...draft, description: event.target.value },
                        }))
                      }
                      sx={{ flex: 3 }}
                    />
                    <TextField
                      label="Amount"
                      value={draft.amount}
                      disabled={!canEdit || !isDraft}
                      onChange={(event) =>
                        setLineDrafts((all) => ({
                          ...all,
                          [line.id]: { ...draft, amount: event.target.value },
                        }))
                      }
                      sx={{ flex: 1 }}
                    />
                    {canEdit && isDraft ? (
                      <>
                        <Button
                          disabled={busy}
                          onClick={() => saveLine.mutate({ id: line.id, line: draft })}
                        >
                          Save
                        </Button>
                        <Button
                          color="error"
                          disabled={busy}
                          onClick={() => deleteLine.mutate(line.id)}
                        >
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </Stack>
                );
              })}

              {canEdit && isDraft ? (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField
                    label="New line description"
                    value={newLine.description}
                    onChange={(event) =>
                      setNewLine((line) => ({ ...line, description: event.target.value }))
                    }
                    sx={{ flex: 3 }}
                  />
                  <TextField
                    label="Amount"
                    value={newLine.amount}
                    onChange={(event) =>
                      setNewLine((line) => ({ ...line, amount: event.target.value }))
                    }
                    sx={{ flex: 1 }}
                  />
                  <Button
                    disabled={busy || !newLine.description.trim() || !newLine.amount}
                    onClick={() => addLine.mutate()}
                  >
                    Add line
                  </Button>
                </Stack>
              ) : null}

              <Divider />
              {isDraft && canSubmit ? (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField
                    select
                    label="Approval workflow"
                    value={workflowCode}
                    onChange={(event) => setWorkflowCode(event.target.value)}
                    sx={{ flex: 1 }}
                  >
                    {(workflows.data?.data ?? []).map((workflow) => (
                      <MenuItem key={workflow.id} value={workflow.workflowCode}>
                        {workflow.workflowName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    disabled={busy || !workflowCode}
                    onClick={() => submit.mutate()}
                  >
                    Submit
                  </Button>
                </Stack>
              ) : null}

              {isSubmitted && (canApprove || canReject) ? (
                <Stack spacing={1}>
                  <TextField
                    label="Approval comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    multiline
                    minRows={2}
                  />
                  <Stack direction="row" spacing={1}>
                    {canApprove ? (
                      <Button
                        variant="contained"
                        disabled={busy}
                        onClick={() => approve.mutate()}
                      >
                        Approve
                      </Button>
                    ) : null}
                    {canReject ? (
                      <Button
                        color="error"
                        disabled={busy}
                        onClick={() => reject.mutate()}
                      >
                        Reject
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              ) : null}

              {current.rejectionReason ? (
                <Alert severity="warning">Rejection: {current.rejectionReason}</Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canAr && projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">Accounts Receivable</Typography>
              <Typography variant="body2" color="text.secondary">
                Derived from approved Client Invoices. Allocations remain zero until V0.6-C.
              </Typography>
              {ar.isPending ? <CircularProgress size={24} /> : null}
              {ar.isError ? <Alert severity="error">{errorMessage(ar.error)}</Alert> : null}
              {(ar.data?.data ?? []).map((row) => (
                <Box key={row.id} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography>
                    {row.clientInvoiceNumber} · {row.customer.customerCode} ·{' '}
                    {row.currencyCode} {row.outstandingAmount} outstanding
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total {row.totalAmount} · allocated {row.allocatedAmount} · due {dateValue(row.dueDate) || '—'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {canAp && projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">Accounts Payable</Typography>
              <Typography variant="body2" color="text.secondary">
                Derived from approved Supplier Invoices. Allocations remain zero until V0.6-C.
              </Typography>
              {ap.isPending ? <CircularProgress size={24} /> : null}
              {ap.isError ? <Alert severity="error">{errorMessage(ap.error)}</Alert> : null}
              {(ap.data?.data ?? []).map((row) => (
                <Box key={row.id} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography>
                    {row.supplierInvoiceNumber} · {row.supplier.supplierCode} ·{' '}
                    {row.currencyCode} {row.outstandingAmount} outstanding
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {row.supplierReference} · total {row.totalAmount} · allocated {row.allocatedAmount}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
