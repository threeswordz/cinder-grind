import { useEffect, useMemo, useState } from 'react';
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
  financeApi,
  SupplierInvoiceItem,
  SupplierInvoiceLineInput,
} from '../api/finance';

type Props = {
  permissions: string[];
};

type LineDraft = {
  description: string;
  amount: string;
  purchaseOrderLineId: string;
  goodsReceiptItemId: string;
  wbsId: string;
  costCodeId: string;
};

const emptyLine = (): LineDraft => ({
  description: '',
  amount: '',
  purchaseOrderLineId: '',
  goodsReceiptItemId: '',
  wbsId: '',
  costCodeId: '',
});

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

function asInput(line: LineDraft): SupplierInvoiceLineInput {
  return {
    description: line.description.trim(),
    amount: line.amount,
    purchaseOrderLineId: line.purchaseOrderLineId || null,
    goodsReceiptItemId: line.goodsReceiptItemId || null,
    wbsId: line.wbsId || null,
    costCodeId: line.costCodeId || null,
  };
}

function editDraft(line: SupplierInvoiceItem): LineDraft {
  return {
    description: line.description,
    amount: line.amount,
    purchaseOrderLineId: line.purchaseOrderLineId ?? '',
    goodsReceiptItemId: line.goodsReceiptItemId ?? '',
    wbsId: line.wbsId ?? '',
    costCodeId: line.costCodeId ?? '',
  };
}

export function FinanceWorkspace({ permissions }: Props) {
  const queryClient = useQueryClient();

  const canView = permissions.includes('finance.supplier_invoice.view');
  const canCreate = permissions.includes('finance.supplier_invoice.create');
  const canEdit = permissions.includes('finance.supplier_invoice.edit');
  const canSubmit = permissions.includes('finance.supplier_invoice.submit');
  const canApprove = permissions.includes('finance.supplier_invoice.approve');
  const canReject = permissions.includes('finance.supplier_invoice.reject');

  const [projectId, setProjectId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');

  const [createSupplierId, setCreateSupplierId] = useState('');
  const [createSupplierReference, setCreateSupplierReference] = useState('');
  const [createInvoiceDate, setCreateInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [createDueDate, setCreateDueDate] = useState('');
  const [createKey, setCreateKey] = useState(key);
  const [createLines, setCreateLines] = useState<LineDraft[]>([emptyLine()]);

  const [headerReference, setHeaderReference] = useState('');
  const [headerInvoiceDate, setHeaderInvoiceDate] = useState('');
  const [headerDueDate, setHeaderDueDate] = useState('');
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});
  const [newLine, setNewLine] = useState<LineDraft>(emptyLine);

  const [workflowCode, setWorkflowCode] = useState('');
  const [actionComment, setActionComment] = useState('');

  const projects = useQuery({
    queryKey: ['finance-projects'],
    queryFn: financeApi.projects,
    enabled: canView,
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
    setCreateSupplierId('');
  }, [projectId]);

  const options = useQuery({
    queryKey: ['finance-supplier-invoice-options', projectId],
    queryFn: () => financeApi.options(projectId),
    enabled: canView && Boolean(projectId),
  });

  const invoices = useQuery({
    queryKey: ['finance-supplier-invoices', projectId],
    queryFn: () => financeApi.list(projectId),
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
    queryKey: ['finance-supplier-invoice', invoiceId],
    queryFn: () => financeApi.detail(invoiceId),
    enabled: canView && Boolean(invoiceId),
  });

  const workflows = useQuery({
    queryKey: ['finance-supplier-invoice-workflows'],
    queryFn: financeApi.workflows,
    enabled: canSubmit,
  });

  useEffect(() => {
    const values = workflows.data?.data ?? [];
    if (!workflowCode && values[0]) setWorkflowCode(values[0].workflowCode);
  }, [workflowCode, workflows.data]);

  useEffect(() => {
    const current = detail.data?.data;
    if (!current) return;
    setHeaderReference(current.supplierReference);
    setHeaderInvoiceDate(dateValue(current.invoiceDate));
    setHeaderDueDate(dateValue(current.dueDate));
    setLineDrafts(
      Object.fromEntries(
        current.items.map((line) => [line.id, editDraft(line)]),
      ),
    );
  }, [detail.data]);

  const refreshProject = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['finance-supplier-invoices', projectId],
    });
  };

  const refreshInvoice = async (id = invoiceId) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['finance-supplier-invoice', id],
      }),
      queryClient.invalidateQueries({
        queryKey: ['finance-supplier-invoices', projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['finance-supplier-invoice-options', projectId],
      }),
    ]);
  };

  const createInvoice = useMutation({
    mutationFn: () =>
      financeApi.create(projectId, {
        supplierId: createSupplierId,
        supplierReference: createSupplierReference,
        invoiceDate: createInvoiceDate,
        dueDate: createDueDate || null,
        createKey,
        lines: createLines.map(asInput),
      }),
    onSuccess: async (result) => {
      await refreshProject();
      setInvoiceId(result.data.id);
      setCreateSupplierReference('');
      setCreateDueDate('');
      setCreateLines([emptyLine()]);
      setCreateKey(key());
    },
  });

  const saveHeader = useMutation({
    mutationFn: () =>
      financeApi.update(invoiceId, {
        supplierReference: headerReference,
        invoiceDate: headerInvoiceDate,
        dueDate: headerDueDate || null,
      }),
    onSuccess: () => refreshInvoice(),
  });

  const saveLine = useMutation({
    mutationFn: ({
      itemId,
      draft,
    }: {
      itemId: string;
      draft: LineDraft;
    }) => financeApi.updateLine(itemId, asInput(draft)),
    onSuccess: () => refreshInvoice(),
  });

  const addLine = useMutation({
    mutationFn: () => financeApi.addLine(invoiceId, asInput(newLine)),
    onSuccess: async () => {
      setNewLine(emptyLine());
      await refreshInvoice();
    },
  });

  const deleteLine = useMutation({
    mutationFn: financeApi.deleteLine,
    onSuccess: () => refreshInvoice(),
  });

  const submitInvoice = useMutation({
    mutationFn: () => financeApi.submit(invoiceId, workflowCode, key()),
    onSuccess: () => refreshInvoice(),
  });

  const approveInvoice = useMutation({
    mutationFn: () =>
      financeApi.approve(invoiceId, key(), actionComment || null),
    onSuccess: async () => {
      setActionComment('');
      await refreshInvoice();
    },
  });

  const rejectInvoice = useMutation({
    mutationFn: () =>
      financeApi.reject(invoiceId, key(), actionComment || null),
    onSuccess: async () => {
      setActionComment('');
      await refreshInvoice();
    },
  });

  const selectedSupplier =
    createSupplierId ||
    detail.data?.data.supplierId ||
    '';

  const poOptions = useMemo(
    () =>
      (options.data?.data.purchaseOrderLines ?? []).filter(
        (line) =>
          !selectedSupplier ||
          line.purchaseOrder.supplierId === selectedSupplier,
      ),
    [options.data, selectedSupplier],
  );

  const grOptions = useMemo(
    () =>
      (options.data?.data.goodsReceiptItems ?? []).filter(
        (line) =>
          !selectedSupplier ||
          line.goodsReceipt.supplierId === selectedSupplier,
      ),
    [options.data, selectedSupplier],
  );

  const updateCreateLine = (
    index: number,
    patch: Partial<LineDraft>,
  ) => {
    setCreateLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  };

  const linkCreateReceipt = (index: number, receiptId: string) => {
    const receipt = grOptions.find((item) => item.id === receiptId);
    updateCreateLine(index, {
      goodsReceiptItemId: receiptId,
      ...(receipt?.purchaseOrderLineId
        ? { purchaseOrderLineId: receipt.purchaseOrderLineId }
        : {}),
    });
  };

  const linkEditReceipt = (
    current: LineDraft,
    receiptId: string,
  ): LineDraft => {
    const receipt = grOptions.find((item) => item.id === receiptId);
    return {
      ...current,
      goodsReceiptItemId: receiptId,
      ...(receipt?.purchaseOrderLineId
        ? { purchaseOrderLineId: receipt.purchaseOrderLineId }
        : {}),
    };
  };

  const current = detail.data?.data;
  const draft = current?.state === 'DRAFT';
  const submitted = current?.state === 'SUBMITTED';

  const busy =
    createInvoice.isPending ||
    saveHeader.isPending ||
    saveLine.isPending ||
    addLine.isPending ||
    deleteLine.isPending ||
    submitInvoice.isPending ||
    approveInvoice.isPending ||
    rejectInvoice.isPending;

  const mutationError =
    createInvoice.error ||
    saveHeader.error ||
    saveLine.error ||
    addLine.error ||
    deleteLine.error ||
    submitInvoice.error ||
    approveInvoice.error ||
    rejectInvoice.error;

  if (!canView) {
    return (
      <Alert severity="warning">
        Finance Supplier Invoice workspace requires
        finance.supplier_invoice.view in addition to any action-specific
        permission.
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
        <Typography variant="h5">Finance · Supplier Invoices</Typography>
        <Typography color="text.secondary">
          Project-scoped Supplier Invoice control with PO/GR lineage,
          base-currency values, approval history and immutable approved records.
        </Typography>
      </Box>

      {projects.isError ? (
        <Alert severity="error">{message(projects.error)}</Alert>
      ) : null}
      {options.isError ? (
        <Alert severity="error">{message(options.error)}</Alert>
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
          </MenuItem>
        ))}
      </TextField>

      {options.data ? (
        <Alert severity="info">
          Finance currency: {options.data.data.baseCurrencyCode}. V0.6-A does
          not perform FX, tax/VAT calculation or automatic PO/GR matching.
        </Alert>
      ) : null}

      {canCreate && projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Create Draft Supplier Invoice</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  select
                  label="Supplier"
                  value={createSupplierId}
                  onChange={(event) => {
                    setCreateSupplierId(event.target.value);
                    setCreateLines((lines) =>
                      lines.map((line) => ({
                        ...line,
                        purchaseOrderLineId: '',
                        goodsReceiptItemId: '',
                      })),
                    );
                  }}
                  sx={{ flex: 2 }}
                >
                  {(options.data?.data.suppliers ?? []).map((supplier) => (
                    <MenuItem key={supplier.id} value={supplier.id}>
                      {supplier.supplierCode} · {supplier.supplierName}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Supplier reference"
                  value={createSupplierReference}
                  onChange={(event) =>
                    setCreateSupplierReference(event.target.value)
                  }
                  sx={{ flex: 2 }}
                />
                <TextField
                  type="date"
                  label="Invoice date"
                  value={createInvoiceDate}
                  onChange={(event) => setCreateInvoiceDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  type="date"
                  label="Due date"
                  value={createDueDate}
                  onChange={(event) => setCreateDueDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
              </Stack>

              <Divider />
              <Typography variant="subtitle1">Invoice lines</Typography>
              {createLines.map((line, index) => (
                <Stack
                  key={index}
                  spacing={1}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      label="Description"
                      value={line.description}
                      onChange={(event) =>
                        updateCreateLine(index, {
                          description: event.target.value,
                        })
                      }
                      sx={{ flex: 3 }}
                    />
                    <TextField
                      label="Amount"
                      value={line.amount}
                      onChange={(event) =>
                        updateCreateLine(index, { amount: event.target.value })
                      }
                      sx={{ flex: 1 }}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      select
                      label="PO line (optional)"
                      value={line.purchaseOrderLineId}
                      onChange={(event) =>
                        updateCreateLine(index, {
                          purchaseOrderLineId: event.target.value,
                          goodsReceiptItemId: '',
                        })
                      }
                      sx={{ flex: 1 }}
                    >
                      <MenuItem value="">No PO source</MenuItem>
                      {poOptions.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.purchaseOrder.poNumber} · L{item.lineNo} ·{' '}
                          {item.description}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Goods Receipt item (optional)"
                      value={line.goodsReceiptItemId}
                      onChange={(event) =>
                        linkCreateReceipt(index, event.target.value)
                      }
                      sx={{ flex: 1 }}
                    >
                      <MenuItem value="">No GR source</MenuItem>
                      {grOptions.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.goodsReceipt.receiptNumber} · L{item.lineNo} ·{' '}
                          {item.description}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      select
                      label="WBS (optional)"
                      value={line.wbsId}
                      onChange={(event) =>
                        updateCreateLine(index, { wbsId: event.target.value })
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
                      label="Cost Code (optional)"
                      value={line.costCodeId}
                      onChange={(event) =>
                        updateCreateLine(index, {
                          costCodeId: event.target.value,
                        })
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
                  {createLines.length > 1 ? (
                    <Button
                      color="error"
                      onClick={() =>
                        setCreateLines((currentLines) =>
                          currentLines.filter(
                            (_row, rowIndex) => rowIndex !== index,
                          ),
                        )
                      }
                    >
                      Remove draft line
                    </Button>
                  ) : null}
                </Stack>
              ))}
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  onClick={() =>
                    setCreateLines((lines) => [...lines, emptyLine()])
                  }
                >
                  Add line
                </Button>
                <Button
                  variant="contained"
                  disabled={
                    busy ||
                    !createSupplierId ||
                    !createSupplierReference.trim() ||
                    !createInvoiceDate ||
                    createLines.some(
                      (line) => !line.description.trim() || !line.amount,
                    )
                  }
                  onClick={() => createInvoice.mutate()}
                >
                  Create Draft Supplier Invoice
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Supplier Invoice Register</Typography>
              {invoices.isPending ? <CircularProgress size={24} /> : null}
              {invoices.isError ? (
                <Alert severity="error">{message(invoices.error)}</Alert>
              ) : null}
              <TextField
                select
                label="Supplier Invoice"
                value={invoiceId}
                onChange={(event) => setInvoiceId(event.target.value)}
                fullWidth
              >
                {(invoices.data?.data ?? []).map((invoice) => (
                  <MenuItem key={invoice.id} value={invoice.id}>
                    {invoice.supplierInvoiceNumber} ·{' '}
                    {invoice.supplier.supplierCode} ·{' '}
                    {invoice.supplierReference} · {invoice.state} ·{' '}
                    {invoice.currencyCode} {invoice.totalAmount}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {invoiceId && detail.isPending ? (
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
                      {current.supplierInvoiceNumber}
                    </Typography>
                    <Typography color="text.secondary">
                      {current.project.projectCode} ·{' '}
                      {current.supplier.supplierCode} ·{' '}
                      {current.supplier.supplierName}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Chip label={current.state} />
                    <Chip
                      variant="outlined"
                      label={
                        current.currencyCode + ' ' + current.totalAmount
                      }
                    />
                  </Stack>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField
                    label="Supplier reference"
                    value={headerReference}
                    disabled={!canEdit || !draft}
                    onChange={(event) =>
                      setHeaderReference(event.target.value)
                    }
                    sx={{ flex: 2 }}
                  />
                  <TextField
                    type="date"
                    label="Invoice date"
                    value={headerInvoiceDate}
                    disabled={!canEdit || !draft}
                    onChange={(event) =>
                      setHeaderInvoiceDate(event.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    type="date"
                    label="Due date"
                    value={headerDueDate}
                    disabled={!canEdit || !draft}
                    onChange={(event) => setHeaderDueDate(event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                </Stack>
                {canEdit && draft ? (
                  <Button
                    variant="outlined"
                    disabled={busy}
                    onClick={() => saveHeader.mutate()}
                  >
                    Save Invoice Header
                  </Button>
                ) : null}

                <Divider />
                <Typography variant="subtitle1">Retained invoice lines</Typography>

                {current.items.map((line) => {
                  const values = lineDrafts[line.id] ?? editDraft(line);
                  return (
                    <Stack
                      key={line.id}
                      spacing={1}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Line {line.lineNo}
                        {line.purchaseOrderLine
                          ? ' · PO ' +
                            line.purchaseOrderLine.purchaseOrder.poNumber +
                            ' / L' +
                            line.purchaseOrderLine.lineNo
                          : ''}
                        {line.goodsReceiptItem
                          ? ' · GR ' +
                            line.goodsReceiptItem.goodsReceipt.receiptNumber +
                            ' / L' +
                            line.goodsReceiptItem.lineNo
                          : ''}
                      </Typography>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1}
                      >
                        <TextField
                          label="Description"
                          value={values.description}
                          disabled={!canEdit || !draft}
                          onChange={(event) =>
                            setLineDrafts((all) => ({
                              ...all,
                              [line.id]: {
                                ...values,
                                description: event.target.value,
                              },
                            }))
                          }
                          sx={{ flex: 3 }}
                        />
                        <TextField
                          label="Amount"
                          value={values.amount}
                          disabled={!canEdit || !draft}
                          onChange={(event) =>
                            setLineDrafts((all) => ({
                              ...all,
                              [line.id]: {
                                ...values,
                                amount: event.target.value,
                              },
                            }))
                          }
                          sx={{ flex: 1 }}
                        />
                      </Stack>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1}
                      >
                        <TextField
                          select
                          label="PO line"
                          value={values.purchaseOrderLineId}
                          disabled={!canEdit || !draft}
                          onChange={(event) =>
                            setLineDrafts((all) => ({
                              ...all,
                              [line.id]: {
                                ...values,
                                purchaseOrderLineId: event.target.value,
                                goodsReceiptItemId: '',
                              },
                            }))
                          }
                          sx={{ flex: 1 }}
                        >
                          <MenuItem value="">No PO source</MenuItem>
                          {poOptions.map((item) => (
                            <MenuItem key={item.id} value={item.id}>
                              {item.purchaseOrder.poNumber} · L{item.lineNo} ·{' '}
                              {item.description}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          label="Goods Receipt item"
                          value={values.goodsReceiptItemId}
                          disabled={!canEdit || !draft}
                          onChange={(event) =>
                            setLineDrafts((all) => ({
                              ...all,
                              [line.id]: linkEditReceipt(
                                values,
                                event.target.value,
                              ),
                            }))
                          }
                          sx={{ flex: 1 }}
                        >
                          <MenuItem value="">No GR source</MenuItem>
                          {grOptions.map((item) => (
                            <MenuItem key={item.id} value={item.id}>
                              {item.goodsReceipt.receiptNumber} · L{item.lineNo}{' '}
                              · {item.description}
                            </MenuItem>
                          ))}
                        </TextField>
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
                      {canEdit && draft ? (
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="outlined"
                            disabled={busy}
                            onClick={() =>
                              saveLine.mutate({
                                itemId: line.id,
                                draft: values,
                              })
                            }
                          >
                            Save line
                          </Button>
                          <Button
                            color="error"
                            disabled={busy}
                            onClick={() => deleteLine.mutate(line.id)}
                          >
                            Remove line
                          </Button>
                        </Stack>
                      ) : null}
                    </Stack>
                  );
                })}

                {canEdit && draft ? (
                  <>
                    <Divider />
                    <Typography variant="subtitle2">Add another line</Typography>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                    >
                      <TextField
                        label="Description"
                        value={newLine.description}
                        onChange={(event) =>
                          setNewLine((line) => ({
                            ...line,
                            description: event.target.value,
                          }))
                        }
                        sx={{ flex: 3 }}
                      />
                      <TextField
                        label="Amount"
                        value={newLine.amount}
                        onChange={(event) =>
                          setNewLine((line) => ({
                            ...line,
                            amount: event.target.value,
                          }))
                        }
                        sx={{ flex: 1 }}
                      />
                    </Stack>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                    >
                      <TextField
                        select
                        label="PO line"
                        value={newLine.purchaseOrderLineId}
                        onChange={(event) =>
                          setNewLine((line) => ({
                            ...line,
                            purchaseOrderLineId: event.target.value,
                            goodsReceiptItemId: '',
                          }))
                        }
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="">No PO source</MenuItem>
                        {poOptions.map((item) => (
                          <MenuItem key={item.id} value={item.id}>
                            {item.purchaseOrder.poNumber} · L{item.lineNo} ·{' '}
                            {item.description}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label="Goods Receipt item"
                        value={newLine.goodsReceiptItemId}
                        onChange={(event) =>
                          setNewLine((line) =>
                            linkEditReceipt(line, event.target.value),
                          )
                        }
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="">No GR source</MenuItem>
                        {grOptions.map((item) => (
                          <MenuItem key={item.id} value={item.id}>
                            {item.goodsReceipt.receiptNumber} · L{item.lineNo} ·{' '}
                            {item.description}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                    >
                      <TextField
                        select
                        label="WBS"
                        value={newLine.wbsId}
                        onChange={(event) =>
                          setNewLine((line) => ({
                            ...line,
                            wbsId: event.target.value,
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
                        value={newLine.costCodeId}
                        onChange={(event) =>
                          setNewLine((line) => ({
                            ...line,
                            costCodeId: event.target.value,
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
                    <Button
                      variant="outlined"
                      disabled={
                        busy ||
                        !newLine.description.trim() ||
                        !newLine.amount
                      }
                      onClick={() => addLine.mutate()}
                    >
                      Add line to Draft
                    </Button>
                  </>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Approval & retained history</Typography>

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
                      disabled={busy || !workflowCode}
                      onClick={() => submitInvoice.mutate()}
                    >
                      Submit for Approval
                    </Button>
                  </Stack>
                ) : null}

                {submitted && (canApprove || canReject) ? (
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
                          onClick={() => approveInvoice.mutate()}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {canReject ? (
                        <Button
                          color="error"
                          variant="outlined"
                          disabled={busy}
                          onClick={() => rejectInvoice.mutate()}
                        >
                          Reject
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                ) : null}

                {current.submittedAt ? (
                  <Typography variant="body2">
                    Submitted: {new Date(current.submittedAt).toLocaleString()}
                    {current.submittedBy
                      ? ' · ' + current.submittedBy.displayName
                      : ''}
                  </Typography>
                ) : null}
                {current.approvedAt ? (
                  <Typography variant="body2">
                    Approved: {new Date(current.approvedAt).toLocaleString()}
                    {current.approvedBy
                      ? ' · ' + current.approvedBy.displayName
                      : ''}
                  </Typography>
                ) : null}
                {current.rejectedAt ? (
                  <Typography variant="body2">
                    Rejected: {new Date(current.rejectedAt).toLocaleString()}
                    {current.rejectedBy
                      ? ' · ' + current.rejectedBy.displayName
                      : ''}
                    {current.rejectionReason
                      ? ' · ' + current.rejectionReason
                      : ''}
                  </Typography>
                ) : null}

                {current.approvalInstance?.actions.length ? (
                  <>
                    <Divider />
                    {current.approvalInstance.actions.map((action) => (
                      <Typography key={action.id} variant="body2">
                        {action.approvalStep
                          ? 'Step ' +
                            action.approvalStep.stepNo +
                            ' · ' +
                            action.approvalStep.stepName +
                            ' · '
                          : ''}
                        {action.action} ·{' '}
                        {action.actionByUser?.displayName ?? 'System'} ·{' '}
                        {new Date(action.actionAt).toLocaleString()}
                        {action.comment ? ' · ' + action.comment : ''}
                      </Typography>
                    ))}
                  </>
                ) : null}

                {current.state === 'APPROVED' ? (
                  <Alert severity="success">
                    Approved Supplier Invoices and their retained lines are
                    immutable in V0.6-A.
                  </Alert>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      ) : null}
    </Stack>
  );
}
