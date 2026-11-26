import { CurrencyLabel } from '../role-ui/monetary-presentation';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { printApprovedPurchaseOrderHtml } from './purchase-order-print';
import { PurchaseOrderCancellationPanel } from './PurchaseOrderCancellationPanel';
import { SupplierDeliveryCasePanel } from './SupplierDeliveryCasePanel';
import {
  PoAward,
  PoDispatchDraft,
  PurchaseOrderLine,
  purchaseOrdersApi,
} from '../api/purchase-orders';
import {
  canOpenSourceLink,
  consumeSourceLinkKey,
  resolveLinkedProjectId,
  resolveLinkedRecordId,
  sourceLinkTarget,
  type SourceLinkTarget,
} from '../role-ui/source-link-policy';

type Props = {
  permissions: string[];
  roleCodes?: string[];
  initialProjectId?: string | undefined;
  initialOrderId?: string | undefined;
  onOpenSource?: ((target: SourceLinkTarget) => void) | undefined;
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

type CommercialDraftKey =
  | 'deliveryLocation'
  | 'deliveryContact'
  | 'deliveryTerms'
  | 'paymentTerms'
  | 'creditTerms'
  | 'discountAmount'
  | 'freightAmount'
  | 'additionalChargeAmount'
  | 'vatRatePercent'
  | 'supplierQuoteExceptionReason';

const commercialHeaderFields: Array<{
  key: CommercialDraftKey;
  label: string;
  numeric: boolean;
}> = [
  { key: 'deliveryLocation', label: 'Delivery location', numeric: false },
  { key: 'deliveryContact', label: 'Delivery contact', numeric: false },
  { key: 'deliveryTerms', label: 'Partial delivery / delivery terms', numeric: false },
  { key: 'paymentTerms', label: 'Payment terms', numeric: false },
  { key: 'creditTerms', label: 'Credit terms', numeric: false },
  { key: 'discountAmount', label: 'Discount (THB)', numeric: true },
  { key: 'freightAmount', label: 'Freight (THB)', numeric: true },
  { key: 'additionalChargeAmount', label: 'Additional charges (THB)', numeric: true },
  { key: 'vatRatePercent', label: 'VAT rate (%)', numeric: true },
  { key: 'supplierQuoteExceptionReason', label: 'Special/sole supplier exception reason for Ben', numeric: false },
];

const emptyCommercialDraft = (): Record<CommercialDraftKey, string> => ({
  deliveryLocation: '',
  deliveryContact: '',
  deliveryTerms: '',
  paymentTerms: '',
  creditTerms: '',
  discountAmount: '',
  freightAmount: '',
  additionalChargeAmount: '',
  vatRatePercent: '',
  supplierQuoteExceptionReason: '',
});

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

export function PurchaseOrdersPanel({ permissions, roleCodes = [], initialProjectId, initialOrderId, onOpenSource }: Props) {
  const queryClient = useQueryClient();
  const canView = permissions.includes('procurement.po.view');
  const canCreate = permissions.includes('procurement.po.create');
  const canEdit = permissions.includes('procurement.po.edit');
  const canSubmit = permissions.includes('procurement.po.submit');
  const canApprove = permissions.includes('procurement.po.approve');
  const canReject = permissions.includes('procurement.po.reject');
  const canRevise = permissions.includes('procurement.po.revise');

  const [projectId, setProjectId] = useState('');
  const [orderId, setOrderId] = useState('');
  const appliedProjectSourceLink = useRef('');
  const appliedOrderSourceLink = useRef('');
  const [selectedAwards, setSelectedAwards] = useState<string[]>([]);
  const [createRemarks, setCreateRemarks] = useState('');
  const [headerRemarks, setHeaderRemarks] = useState('');
  const [commercialDraft, setCommercialDraft] = useState(emptyCommercialDraft);
  const [workflowCode, setWorkflowCode] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [dispatchKind, setDispatchKind] = useState<PoDispatchDraft['kind']>('DISPATCH');
  const [dispatchChannel, setDispatchChannel] = useState<PoDispatchDraft['channel']>('EMAIL');
  const [dispatchRecipient, setDispatchRecipient] = useState('');
  const [dispatchReference, setDispatchReference] = useState('');
  const [dispatchDocumentId, setDispatchDocumentId] = useState('');
  const [dispatchAckId, setDispatchAckId] = useState('');
  const [manualPrintError, setManualPrintError] = useState('');
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});

  const projects = useQuery({
    queryKey: ['po-projects', canView ? 'view' : 'create'],
    queryFn: canView
      ? purchaseOrdersApi.projects
      : purchaseOrdersApi.createProjects,
    enabled: canView || canCreate,
  });

  useEffect(() => {
    if (!initialProjectId || !projects.isSuccess || projects.isFetching) return;
    const sourceLinkKey = `${initialProjectId}:${initialOrderId ?? ''}`;
    if (!consumeSourceLinkKey(appliedProjectSourceLink, sourceLinkKey)) return;
    setProjectId(
      resolveLinkedProjectId(initialProjectId, projects.data?.data ?? []),
    );
  }, [
    initialProjectId,
    initialOrderId,
    projects.isSuccess,
    projects.isFetching,
    projects.data,
  ]);

  useEffect(() => {
    if (initialProjectId) return;
    const values = projects.data?.data ?? [];
    if (!projectId && values[0]) setProjectId(values[0].id);
    if (projectId && !values.some((project) => project.id === projectId)) {
      setProjectId(values[0]?.id ?? '');
    }
  }, [initialProjectId, projectId, projects.data]);

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
    if (
      !initialProjectId ||
      projectId !== initialProjectId ||
      !initialOrderId ||
      !orders.isSuccess ||
      orders.isFetching
    ) {
      return;
    }
    const sourceLinkKey = `${initialProjectId}:${initialOrderId}`;
    if (!consumeSourceLinkKey(appliedOrderSourceLink, sourceLinkKey)) return;
    setOrderId(
      resolveLinkedRecordId(
        initialOrderId,
        projectId,
        orders.data?.data ?? [],
      ),
    );
  }, [
    initialProjectId,
    initialOrderId,
    projectId,
    orders.isSuccess,
    orders.isFetching,
    orders.data,
  ]);

  useEffect(() => {
    if (initialOrderId || orders.isFetching) return;
    const values = orders.data?.data ?? [];
    if (!orderId && values[0]) setOrderId(values[0].id);
    if (orderId && !values.some((order) => order.id === orderId)) {
      setOrderId(values[0]?.id ?? '');
    }
  }, [initialOrderId, orderId, orders.data, orders.isFetching]);

  const detail = useQuery({
    queryKey: ['purchase-order', orderId],
    queryFn: () => purchaseOrdersApi.detail(orderId),
    enabled: canView && Boolean(orderId),
  });

  const dispatchEvents = useQuery({
    queryKey: ['po-dispatch-events', orderId],
    queryFn: () => purchaseOrdersApi.dispatchEvents(orderId),
    enabled: canView && Boolean(orderId),
  });

  const pdfDownload = useMutation({
    mutationFn: () => purchaseOrdersApi.approvedPdf(orderId),
    onSuccess: ({blob, fileName}) => {
      const objectUrl = URL.createObjectURL(blob);
      const element = document.createElement('a');
      element.href = objectUrl;
      // The API's Content-Disposition is not necessarily CORS-exposed.
      // Use the already scoped immutable PO display as deterministic fallback.
      const selected = detail.data?.data;
      const stem = selected?.displayNumber ?? selected?.poNumber ?? 'approved-purchase-order';
      const revisionSuffix = selected?.revisionNo
        ? '-rev' + String(selected.revisionNo).padStart(2, '0') : '';
      element.download = fileName ?? stem + revisionSuffix + '.pdf';
      document.body.appendChild(element);
      element.click();
      element.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    },
  });

  const recordExternal = useMutation({
    mutationFn: () => purchaseOrdersApi.recordDispatch(orderId, {
      kind: dispatchKind,
      channel: dispatchChannel,
      recipient: dispatchRecipient,
      evidenceReference: dispatchReference,
      evidenceDocumentId: dispatchDocumentId.trim() || null,
      acknowledgesEventId: dispatchKind === 'ACKNOWLEDGMENT' ? dispatchAckId : null,
    }),
    onSuccess: async () => {
      setDispatchReference('');
      setDispatchDocumentId('');
      setDispatchAckId('');
      await queryClient.invalidateQueries({queryKey: ['po-dispatch-events', orderId]});
    },
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
    setCommercialDraft(Object.fromEntries(
      commercialHeaderFields.map((field) => [
        field.key, current[field.key] ?? '',
      ]),
    ) as Record<CommercialDraftKey, string>);
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
      await refreshProject();
      setOrderId(result.data.id);
    },
  });

  const saveHeader = useMutation({
    mutationFn: () =>
      purchaseOrdersApi.update(orderId, {
        remarks: headerRemarks || null,
        deliveryLocation: commercialDraft.deliveryLocation.trim() || null,
        deliveryContact: commercialDraft.deliveryContact.trim() || null,
        deliveryTerms: commercialDraft.deliveryTerms.trim() || null,
        paymentTerms: commercialDraft.paymentTerms.trim() || null,
        creditTerms: commercialDraft.creditTerms.trim() || null,
        discountAmount: commercialDraft.discountAmount.trim() || null,
        freightAmount: commercialDraft.freightAmount.trim() || null,
        additionalChargeAmount: commercialDraft.additionalChargeAmount.trim() || null,
        vatRatePercent: commercialDraft.vatRatePercent.trim() || null,
        supplierQuoteExceptionReason: commercialDraft.supplierQuoteExceptionReason.trim() || null,
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

  const reviseOrder = useMutation({
    mutationFn: () =>
      purchaseOrdersApi.revise(orderId, revisionReason || null),
    onSuccess: async (result) => {
      setRevisionReason('');
      await refreshProject();
      setOrderId(result.data.id);
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
  const manualPrintApprovedPo = async () => {
    if (!current || !orderId) return;
    setManualPrintError('');
    // Open synchronously on the human click to avoid popup blockers, but
    // NEVER print cached previously-approved PO data. Reauthorize/readback
    // exact source from the backend before rendering any supplier details.
    const windowRef = window.open('', '_blank', 'width=950,height=820');
    if (!windowRef) {
      setManualPrintError('Your browser blocked the print window. Enable this ERP popup and retry.');
      return;
    }
    windowRef.opener = null;
    try {
      const fresh = (await purchaseOrdersApi.detail(orderId)).data;
      if (fresh.id !== orderId) throw new Error('PO_PRINT_REVISION_MISMATCH');
      const { html } = printApprovedPurchaseOrderHtml(fresh);
      if (windowRef.closed) return;
      windowRef.document.open();
      windowRef.document.write(html);
      windowRef.document.close();
      await windowRef.document.fonts.ready;
      windowRef.focus();
      windowRef.print();
    } catch (error) {
      if (!windowRef.closed) windowRef.close();
      setManualPrintError(message(error));
    }
  };
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
    reviseOrder.isPending ||
    pdfDownload.isPending ||
    recordExternal.isPending;

  const mutationError =
    createOrder.error ||
    saveHeader.error ||
    saveLine.error ||
    deleteLine.error ||
    submitOrder.error ||
    approveOrder.error ||
    rejectOrder.error ||
    reviseOrder.error ||
    pdfDownload.error ||
    recordExternal.error;

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
                    {order.displayNumber ?? order.poNumber} · <CurrencyLabel code={order.currencyCode} /> · Rev {order.revisionNo} ·{' '}
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
                      {current.displayNumber ?? current.poNumber} · <CurrencyLabel code={current.currencyCode} /> · Revision {current.revisionNo}
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
                <Typography variant="subtitle2">PUR04 · Delivery and commercial terms</Typography>
                <Alert severity="info">
                  PUR01 compares the net whole-PO THB total after discount,
                  freight and charges (excluding VAT): up to ฿10,000 requires
                  one comparable supplier, up to ฿50,000 requires two, and
                  above ฿50,000 requires three. A shortage needs a specific
                  reason and independent Ben approval.
                  Enter explicit zero values where applicable; blanks mean unknown.
                </Alert>
                <Box sx={{ display: 'grid', gridTemplateColumns: {
                  xs: '1fr', md: 'repeat(2, minmax(0, 1fr))',
                }, gap: 2 }}>
                  {commercialHeaderFields.map((field) => (
                    <TextField
                      key={field.key}
                      label={field.label}
                      type={field.numeric ? 'number' : 'text'}
                      inputProps={field.numeric ? { min: 0, step: '0.01' } : undefined}
                      value={commercialDraft[field.key]}
                      disabled={!canEdit || !draft}
                      onChange={(event) => setCommercialDraft((previous) => ({
                        ...previous, [field.key]: event.target.value,
                      }))}
                      fullWidth
                    />
                  ))}
                </Box>
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
                      {onOpenSource ? (
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {line.purchaseRequestLine?.purchaseRequest &&
                          canOpenSourceLink('purchase-requests', permissions) ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                const target = sourceLinkTarget(
                                  'purchase-requests',
                                  current.projectId,
                                  line.purchaseRequestLine!.purchaseRequest.id,
                                );
                                if (target) onOpenSource(target);
                              }}
                            >
                              Open {line.purchaseRequestLine.purchaseRequest.prNumber}
                            </Button>
                          ) : null}
                          {line.rfq &&
                          canOpenSourceLink('sourcing', permissions) ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                const target = sourceLinkTarget(
                                  'sourcing',
                                  current.projectId,
                                  line.rfqId,
                                );
                                if (target) onOpenSource(target);
                              }}
                            >
                              Open {line.rfq.rfqNumber}
                            </Button>
                          ) : null}
                          {line.supplierQuotation &&
                          permissions.includes('procurement.quotation.view') ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                const target = sourceLinkTarget(
                                  'sourcing',
                                  current.projectId,
                                  line.rfqId,
                                  line.supplierQuotationId,
                                );
                                if (target) onOpenSource(target);
                              }}
                            >
                              Open supplier quotation
                              {line.supplierQuotation.supplierReference
                                ? ' · ' + line.supplierQuotation.supplierReference
                                : ''}
                            </Button>
                          ) : null}
                        </Stack>
                      ) : null}
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

                {approved && !current.nextRevision ? (
                  <PurchaseOrderCancellationPanel orderId={orderId} permissions={permissions} roleCodes={roleCodes}/>
                ) : null}

                {approved && !current.nextRevision ? (
                  <SupplierDeliveryCasePanel orderId={orderId} permissions={permissions} roleCodes={roleCodes}/>
                ) : null}

                {canRevise &&
                (approved || current.lifecycleState === 'REJECTED') &&
                !current.nextRevision ? (
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
                        {action.action} ·{' '}
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
              <Stack spacing={2}>
                <Typography variant="h6">Approved PO PDF & Manual Dispatch (PUR07)</Typography>
                <Alert severity="info">
                  Export is available only for the exact approved, active revision.
                  Jai sends the file outside ERP by email or LINE. Reporting a send or
                  acknowledgment records your evidence; ERP does not transmit or verify
                  third-party delivery. The approved-PDF download supports Thai text
                  only when this ERP host has its local Chromium Unicode renderer
                  and Thai fonts installed and verified. If unavailable, export fails
                  without creating an incomplete PDF. Browser Print - Save as PDF
                  remains a manual fallback. Attach the actual file you sent as evidence;
                  do not record an unsent or incomplete document.
                </Alert>
                {approved && canView ? (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button variant="outlined" disabled={busy}
                      onClick={() => pdfDownload.mutate()}>
                      {pdfDownload.isPending ? 'Preparing PDF...' : 'Download approved PDF (Thai / English)'}
                    </Button>
                    <Button variant="outlined" onClick={manualPrintApprovedPo}
                      disabled={busy}>Print / Save as PDF (Thai supported by browser)</Button>
                  </Stack>
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    Only approved, non-cancelled revisions can be downloaded or newly dispatched.
                  </Typography>
                )}
                {manualPrintError ? (
                  <Alert severity="error">{manualPrintError}</Alert>
                ) : null}
                {pdfDownload.isError ? (
                  <Alert severity="error">
                    {message(pdfDownload.error)} If the local Unicode renderer is
                    unavailable, ask the system operator to verify Chromium and Thai
                    fonts. Alternatively, attach the actual externally prepared PDF
                    using the scoped Project Document workflow. Never report sending
                    a file that has not been created and checked.
                  </Alert>
                ) : null}
                <Divider />
                <Typography variant="subtitle2">Reported external activity for this revision</Typography>
                {dispatchEvents.isPending ? <CircularProgress size={20} /> : null}
                {dispatchEvents.isError ? (
                  <Alert severity="error">{message(dispatchEvents.error)}</Alert>
                ) : null}
                {(dispatchEvents.data?.data ?? []).map((event) => (
                  <Typography key={event.id} variant="body2">
                    {event.kind === 'DISPATCH' ? 'Reported sent' : 'Reported acknowledged'}
                    {' · '}{event.channel}{' · '}{event.recipient}
                    {' · '}{event.actor?.displayName ?? 'Unknown actor'}
                    {' · '}{new Date(event.recordedAt).toLocaleString()}
                    {' · Evidence: '}{event.evidenceReference}
                    {event.evidenceDocumentId ? ' · Document '+ event.evidenceDocumentId : ''}
                  </Typography>
                ))}
                {canEdit && (approved || (dispatchEvents.data?.data.some(
                  (event) => event.kind === 'DISPATCH') ?? false)) ? (
                  <Stack spacing={2}>
                    <Alert severity="warning">
                      Only authorized Purchasing staff may record these actions.
                      Provide a real external message/thread reference or uploaded
                      Project Document; recording is not proof of external delivery.
                    </Alert>
                    <TextField select label="Record external event" value={dispatchKind}
                      onChange={(e) => setDispatchKind(e.target.value as PoDispatchDraft['kind'])}>
                      {approved ? <MenuItem value="DISPATCH">I sent an approved PO externally</MenuItem> : null}
                      <MenuItem value="ACKNOWLEDGMENT">Supplier acknowledged an earlier send</MenuItem>
                    </TextField>
                    {dispatchKind === 'ACKNOWLEDGMENT' ? (
                      <TextField select label="Earlier sent PO record" value={dispatchAckId}
                        onChange={(e) => setDispatchAckId(e.target.value)}>
                        {(dispatchEvents.data?.data ?? []).filter(e => e.kind === 'DISPATCH')
                          .map(e => <MenuItem key={e.id} value={e.id}>
                            {e.channel}{' · '}{e.recipient}{' · '}
                            {new Date(e.recordedAt).toLocaleString()}
                          </MenuItem>)}
                      </TextField>
                    ) : null}
                    <TextField select label="External channel" value={dispatchChannel}
                      onChange={(e) => setDispatchChannel(e.target.value as PoDispatchDraft['channel'])}>
                      <MenuItem value="EMAIL">Email</MenuItem>
                      <MenuItem value="LINE">LINE</MenuItem>
                    </TextField>
                    <TextField label={dispatchKind === 'DISPATCH' ?
                      'Recipient email / LINE contact' : 'Acknowledging supplier contact'}
                      value={dispatchRecipient} onChange={(e) => setDispatchRecipient(e.target.value)}
                      inputProps={{maxLength:320}} />
                    <TextField label="External evidence reference (required)"
                      helperText="Message ID, dated email thread, LINE screenshot reference or other verifiable evidence. No automatic send."
                      value={dispatchReference} onChange={(e) => setDispatchReference(e.target.value)}
                      inputProps={{maxLength:1200}} multiline minRows={2} />
                    <TextField label="Linked Project Document UUID (optional)"
                      helperText="If used, the existing upload must belong to this Company and Project."
                      value={dispatchDocumentId} onChange={(e) => setDispatchDocumentId(e.target.value)} />
                    <Button variant="outlined" disabled={busy ||
                      dispatchRecipient.trim().length < 3 ||
                      dispatchReference.trim().length < 3 ||
                      (dispatchKind === 'ACKNOWLEDGMENT' && !dispatchAckId)}
                      onClick={() => recordExternal.mutate()}>
                      Record reported {dispatchKind === 'DISPATCH' ? 'external send' : 'supplier acknowledgment'}
                    </Button>
                  </Stack>
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
