import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';

import {
  RfqComparison,
  SupplierQuotation,
  sourcingApi,
} from '../api/sourcing';

function dateValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

type OfferDraft = {
  quantity: string;
  unitPrice: string;
  remarks: string;
};

export function SourcingPanel({
  permissions,
}: {
  permissions: string[];
}) {
  const queryClient = useQueryClient();
  const canViewRfq = permissions.includes('procurement.rfq.view');
  const canManageRfq = permissions.includes('procurement.rfq.manage');
  const canViewQuotation = permissions.includes('procurement.quotation.view');
  const canManageQuotation = permissions.includes('procurement.quotation.manage');
  const canAward = permissions.includes('procurement.award.select');
  const canView = canViewRfq || canViewQuotation;

  const [projectId, setProjectId] = useState('');
  const [rfqId, setRfqId] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [rfqRemarks, setRfqRemarks] = useState('');
  const [selectedDemand, setSelectedDemand] = useState<Record<string, string>>(
    {},
  );

  const [supplierId, setSupplierId] = useState('');
  const [quotationSupplierId, setQuotationSupplierId] = useState('');
  const [quotationId, setQuotationId] = useState('');
  const [supplierReference, setSupplierReference] = useState('');
  const [quotationDate, setQuotationDate] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [quotationRemarks, setQuotationRemarks] = useState('');
  const [offerDrafts, setOfferDrafts] = useState<
    Record<string, OfferDraft>
  >({});
  const [awardReasons, setAwardReasons] = useState<Record<string, string>>({});

  const projects = useQuery({
    queryKey: ['sourcing', 'projects'],
    queryFn: sourcingApi.projects,
    enabled: canView,
  });
  const demand = useQuery({
    queryKey: ['sourcing', 'demand', projectId],
    queryFn: () => sourcingApi.approvedDemand(projectId),
    enabled: Boolean(canViewRfq && projectId),
  });
  const suppliers = useQuery({
    queryKey: ['sourcing', 'suppliers', projectId],
    queryFn: () => sourcingApi.suppliers(projectId),
    enabled: Boolean(canViewRfq && projectId),
  });
  const rfqs = useQuery({
    queryKey: ['sourcing', 'rfqs', projectId],
    queryFn: () => sourcingApi.rfqs(projectId),
    enabled: Boolean(canViewRfq && projectId),
  });
  const detail = useQuery({
    queryKey: ['sourcing', 'rfq', rfqId],
    queryFn: () => sourcingApi.rfq(rfqId),
    enabled: Boolean(canView && rfqId),
  });
  const comparison = useQuery({
    queryKey: ['sourcing', 'comparison', rfqId],
    queryFn: () => sourcingApi.comparison(rfqId),
    enabled: Boolean(canViewQuotation && rfqId),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['sourcing'] });
  };

  const createRfq = useMutation({
    mutationFn: () =>
      sourcingApi.createRfq(projectId, {
        closingDate: closingDate || null,
        remarks: rfqRemarks.trim() || null,
        lines: Object.entries(selectedDemand)
          .filter(([, quantity]) => Number(quantity) > 0)
          .map(([purchaseRequestLineId, quantity]) => ({
            purchaseRequestLineId,
            quantity,
          })),
      }),
    onSuccess: async (result) => {
      setRfqId(result.data.id);
      setSelectedDemand({});
      setClosingDate('');
      setRfqRemarks('');
      await refresh();
    },
  });

  const inviteSupplier = useMutation({
    mutationFn: () => sourcingApi.inviteSupplier(rfqId, supplierId),
    onSuccess: async () => {
      setSupplierId('');
      await refresh();
    },
  });

  const createQuotation = useMutation({
    mutationFn: () =>
      sourcingApi.createQuotation(rfqId, {
        supplierId: quotationSupplierId,
        supplierReference: supplierReference.trim() || null,
        quotationDate,
        validityDate: validityDate || null,
        remarks: quotationRemarks.trim() || null,
      }),
    onSuccess: async (result) => {
      setQuotationId(result.data.id);
      await refresh();
    },
  });

  const updateQuotation = useMutation({
    mutationFn: () =>
      sourcingApi.updateQuotation(quotationId, {
        supplierReference: supplierReference.trim() || null,
        quotationDate,
        validityDate: validityDate || null,
        remarks: quotationRemarks.trim() || null,
      }),
    onSuccess: refresh,
  });

  const saveOffer = useMutation({
    mutationFn: ({
      rfqLineId,
      draft,
    }: {
      rfqLineId: string;
      draft: OfferDraft;
    }) =>
      sourcingApi.upsertQuotationLine(quotationId, rfqLineId, {
        quantity: draft.quantity,
        unitPrice: draft.unitPrice,
        remarks: draft.remarks.trim() || null,
      }),
    onSuccess: refresh,
  });

  const selectAward = useMutation({
    mutationFn: ({
      rfqLineId,
      quotationLineId,
    }: {
      rfqLineId: string;
      quotationLineId: string;
    }) =>
      sourcingApi.selectAward(
        rfqLineId,
        quotationLineId,
        awardReasons[rfqLineId]?.trim() || null,
      ),
    onSuccess: refresh,
  });

  const current = detail.data?.data ?? null;
  const selectedQuotation = useMemo(
    () =>
      (current?.quotations ?? []).find(
        (quotation) => quotation.id === quotationId,
      ) ?? null,
    [current?.quotations, quotationId],
  );

  useEffect(() => {
    if (!current) return;
    if (
      quotationId &&
      !(current.quotations ?? []).some(
        (quotation) => quotation.id === quotationId,
      )
    ) {
      setQuotationId('');
    }
  }, [current, quotationId]);

  useEffect(() => {
    if (!selectedQuotation) {
      if (!quotationId) {
        setSupplierReference('');
        setQuotationDate('');
        setValidityDate('');
        setQuotationRemarks('');
        setOfferDrafts({});
      }
      return;
    }
    setQuotationSupplierId(selectedQuotation.supplierId);
    setSupplierReference(selectedQuotation.supplierReference ?? '');
    setQuotationDate(dateValue(selectedQuotation.quotationDate));
    setValidityDate(dateValue(selectedQuotation.validityDate));
    setQuotationRemarks(selectedQuotation.remarks ?? '');
    const drafts: Record<string, OfferDraft> = {};
    for (const line of selectedQuotation.lines) {
      drafts[line.rfqLineId] = {
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        remarks: line.remarks ?? '',
      };
    }
    setOfferDrafts(drafts);
  }, [selectedQuotation?.id]);

  const invitedSupplierIds = useMemo(
    () => new Set((current?.suppliers ?? []).map((item) => item.supplierId)),
    [current?.suppliers],
  );
  const quotedSupplierIds = useMemo(
    () => new Set((current?.quotations ?? []).map((item) => item.supplierId)),
    [current?.quotations],
  );

  function startNewQuotation() {
    setQuotationId('');
    setQuotationSupplierId('');
    setSupplierReference('');
    setQuotationDate('');
    setValidityDate('');
    setQuotationRemarks('');
    setOfferDrafts({});
  }

  function offerDraftFor(
    quotation: SupplierQuotation | null,
    rfqLineId: string,
    defaultQuantity: string,
  ): OfferDraft {
    return (
      offerDrafts[rfqLineId] ?? {
        quantity:
          quotation?.lines.find((line) => line.rfqLineId === rfqLineId)
            ?.quantity ?? defaultQuantity,
        unitPrice: '',
        remarks: '',
      }
    );
  }

  const mutationError =
    createRfq.error ??
    inviteSupplier.error ??
    createQuotation.error ??
    updateQuotation.error ??
    saveOffer.error ??
    selectAward.error;

  if (!canView) {
    return (
      <Alert severity="warning">
        RFQ or quotation view permission is required to use this workspace.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6">RFQ & Supplier Quotations</Typography>

      <TextField
        select
        label="Project"
        value={projectId}
        onChange={(event) => {
          setProjectId(event.target.value);
          setRfqId('');
          setSelectedDemand({});
          startNewQuotation();
        }}
      >
        <MenuItem value="">Select Project</MenuItem>
        {(projects.data?.data ?? []).map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} · {project.projectName}
          </MenuItem>
        ))}
      </TextField>

      {mutationError ? (
        <Alert severity="error">
          {mutationError instanceof Error
            ? mutationError.message
            : 'Sourcing action failed.'}
        </Alert>
      ) : null}

      {!projectId ? (
        <Alert severity="info">
          Select a Project to review approved demand and sourcing activity.
        </Alert>
      ) : null}

      {projectId && canManageRfq ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                Create RFQ from approved demand
              </Typography>
              {(demand.data?.data ?? []).length === 0 ? (
                <Typography color="text.secondary">
                  No active approved Purchase Request demand is available.
                </Typography>
              ) : null}
              {(demand.data?.data ?? []).map((line) => {
                const checked = selectedDemand[line.id] !== undefined;
                return (
                  <Stack
                    key={line.id}
                    spacing={1}
                    sx={{
                      border: 1,
                      borderColor: checked ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={checked}
                          onChange={(event) => {
                            setSelectedDemand((currentValues) => {
                              const next = { ...currentValues };
                              if (event.target.checked) {
                                next[line.id] = line.quantity;
                              } else {
                                delete next[line.id];
                              }
                              return next;
                            });
                          }}
                        />
                      }
                      label={
                        line.purchaseRequest.prNumber +
                        ' · Line ' +
                        line.lineNo +
                        ' · ' +
                        (line.materialCodeSnapshot
                          ? line.materialCodeSnapshot + ' · '
                          : '') +
                        line.description
                      }
                    />
                    <Typography variant="body2" color="text.secondary">
                      Approved: {line.quantity} {line.uom.uomCode} · Already
                      awarded: {line.awardedQuantity} · Remaining award demand:{' '}
                      {line.remainingAwardQuantity}
                    </Typography>
                    {checked ? (
                      <TextField
                        label="RFQ quantity"
                        value={selectedDemand[line.id] ?? ''}
                        onChange={(event) =>
                          setSelectedDemand((values) => ({
                            ...values,
                            [line.id]: event.target.value,
                          }))
                        }
                      />
                    ) : null}
                  </Stack>
                );
              })}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  type="date"
                  label="Closing date"
                  value={closingDate}
                  onChange={(event) => setClosingDate(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="RFQ remarks"
                  value={rfqRemarks}
                  onChange={(event) => setRfqRemarks(event.target.value)}
                  sx={{ flex: 2 }}
                />
              </Stack>
              <Button
                variant="contained"
                disabled={
                  createRfq.isPending ||
                  Object.values(selectedDemand).filter(
                    (quantity) => Number(quantity) > 0,
                  ).length === 0
                }
                onClick={() => createRfq.mutate()}
              >
                Create RFQ
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {projectId && canViewRfq ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">RFQ history</Typography>
              {(rfqs.data?.data ?? []).length === 0 ? (
                <Typography color="text.secondary">
                  No RFQs have been created for this Project.
                </Typography>
              ) : null}
              {(rfqs.data?.data ?? []).map((rfq) => (
                <Stack
                  key={rfq.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                  sx={{
                    border: 1,
                    borderColor: rfq.id === rfqId ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    p: 1.5,
                  }}
                >
                  <Typography sx={{ flexGrow: 1 }}>
                    {rfq.rfqNumber} · {rfq._count.lines} line
                    {rfq._count.lines === 1 ? '' : 's'}
                  </Typography>
                  <Chip
                    size="small"
                    label={rfq._count.suppliers + ' supplier(s)'}
                  />
                  <Chip
                    size="small"
                    label={rfq._count.quotations + ' quote(s)'}
                  />
                  <Chip
                    size="small"
                    label={rfq._count.awards + ' award(s)'}
                  />
                  <Button
                    size="small"
                    onClick={() => {
                      setRfqId(rfq.id);
                      startNewQuotation();
                    }}
                  >
                    Open
                  </Button>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {current ? (
        <>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">
                  {current.rfqNumber} · {current.project.projectCode}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  RFQ date: {dateValue(current.rfqDate)} · Closing:{' '}
                  {dateValue(current.closingDate) || '—'}
                </Typography>
                {current.remarks ? (
                  <Typography variant="body2">{current.remarks}</Typography>
                ) : null}
                <Divider />
                <Typography variant="subtitle2">
                  Immutable source demand
                </Typography>
                {current.lines.map((line) => (
                  <Stack
                    key={line.id}
                    spacing={0.5}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ sm: 'center' }}
                    >
                      <Typography sx={{ flexGrow: 1 }}>
                        {line.lineNo}.{' '}
                        {line.materialCodeSnapshot
                          ? line.materialCodeSnapshot + ' · '
                          : ''}
                        {line.description}
                      </Typography>
                      <Chip size="small" label={line.lineType} />
                      {line.award ? (
                        <Chip
                          size="small"
                          label={
                            'Awarded · ' +
                            line.award.supplierCodeSnapshot
                          }
                        />
                      ) : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Source {line.purchaseRequestLine.purchaseRequest.prNumber} ·{' '}
                      {line.quantity} {line.uomCodeSnapshot} · Required on Site:{' '}
                      {dateValue(line.requiredOnSite) || '—'}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {canManageRfq ? (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">
                    Supplier invitations
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      select
                      label="Supplier"
                      value={supplierId}
                      onChange={(event) => setSupplierId(event.target.value)}
                      sx={{ flex: 1 }}
                    >
                      <MenuItem value="">Select Supplier</MenuItem>
                      {(suppliers.data?.data ?? [])
                        .filter((option) => !invitedSupplierIds.has(option.id))
                        .map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.supplierCode} · {option.supplierName}
                          </MenuItem>
                        ))}
                    </TextField>
                    <Button
                      variant="contained"
                      disabled={!supplierId || inviteSupplier.isPending}
                      onClick={() => inviteSupplier.mutate()}
                    >
                      Invite Supplier
                    </Button>
                  </Stack>
                  {current.suppliers.map((invitation) => (
                    <Typography key={invitation.id} variant="body2">
                      {invitation.supplierCodeSnapshot} ·{' '}
                      {invitation.supplierNameSnapshot}
                    </Typography>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          {canViewQuotation ? (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                  >
                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                      Supplier quotation capture
                    </Typography>
                    {canManageQuotation ? (
                      <Button onClick={startNewQuotation}>
                        New quotation
                      </Button>
                    ) : null}
                  </Stack>

                  <TextField
                    select
                    label="Existing quotation"
                    value={quotationId}
                    onChange={(event) => setQuotationId(event.target.value)}
                  >
                    <MenuItem value="">New / select quotation</MenuItem>
                    {(current.quotations ?? []).map((quotation) => {
                      const supplier = current.suppliers.find(
                        (item) => item.supplierId === quotation.supplierId,
                      );
                      return (
                        <MenuItem key={quotation.id} value={quotation.id}>
                          {supplier?.supplierCodeSnapshot ??
                            quotation.supplierId}{' '}
                          · {quotation.supplierReference || 'No reference'}
                        </MenuItem>
                      );
                    })}
                  </TextField>

                  {canManageQuotation ? (
                    <>
                      {!quotationId ? (
                        <TextField
                          select
                          label="Invited Supplier"
                          value={quotationSupplierId}
                          onChange={(event) =>
                            setQuotationSupplierId(event.target.value)
                          }
                        >
                          <MenuItem value="">Select invited Supplier</MenuItem>
                          {current.suppliers
                            .filter(
                              (invitation) =>
                                !quotedSupplierIds.has(invitation.supplierId),
                            )
                            .map((invitation) => (
                              <MenuItem
                                key={invitation.id}
                                value={invitation.supplierId}
                              >
                                {invitation.supplierCodeSnapshot} ·{' '}
                                {invitation.supplierNameSnapshot}
                              </MenuItem>
                            ))}
                        </TextField>
                      ) : null}

                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                      >
                        <TextField
                          label="Supplier reference"
                          value={supplierReference}
                          onChange={(event) =>
                            setSupplierReference(event.target.value)
                          }
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          type="date"
                          label="Quotation date"
                          value={quotationDate}
                          onChange={(event) =>
                            setQuotationDate(event.target.value)
                          }
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          type="date"
                          label="Validity date"
                          value={validityDate}
                          onChange={(event) =>
                            setValidityDate(event.target.value)
                          }
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1 }}
                        />
                      </Stack>
                      <TextField
                        label="Quotation remarks"
                        value={quotationRemarks}
                        onChange={(event) =>
                          setQuotationRemarks(event.target.value)
                        }
                      />
                      <Button
                        variant="contained"
                        disabled={
                          !quotationDate ||
                          (!quotationId && !quotationSupplierId) ||
                          createQuotation.isPending ||
                          updateQuotation.isPending
                        }
                        onClick={() =>
                          quotationId
                            ? updateQuotation.mutate()
                            : createQuotation.mutate()
                        }
                      >
                        {quotationId
                          ? 'Save quotation correction'
                          : 'Create quotation'}
                      </Button>
                    </>
                  ) : null}

                  {quotationId && selectedQuotation ? (
                    <>
                      <Divider />
                      <Typography variant="subtitle2">
                        Quotation lines
                      </Typography>
                      {current.lines.map((rfqLine) => {
                        const existing = selectedQuotation.lines.find(
                          (line) => line.rfqLineId === rfqLine.id,
                        );
                        const draft = offerDraftFor(
                          selectedQuotation,
                          rfqLine.id,
                          rfqLine.quantity,
                        );
                        const frozen = Boolean(existing?.award);
                        return (
                          <Stack
                            key={rfqLine.id}
                            spacing={1}
                            sx={{
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 1.5,
                            }}
                          >
                            <Typography>
                              Line {rfqLine.lineNo} · {rfqLine.description}
                            </Typography>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={1}
                            >
                              <TextField
                                label="Quoted quantity"
                                value={draft.quantity}
                                disabled={!canManageQuotation || frozen}
                                onChange={(event) =>
                                  setOfferDrafts((values) => ({
                                    ...values,
                                    [rfqLine.id]: {
                                      ...draft,
                                      quantity: event.target.value,
                                    },
                                  }))
                                }
                                sx={{ flex: 1 }}
                              />
                              <TextField
                                label="Unit price"
                                value={draft.unitPrice}
                                disabled={!canManageQuotation || frozen}
                                onChange={(event) =>
                                  setOfferDrafts((values) => ({
                                    ...values,
                                    [rfqLine.id]: {
                                      ...draft,
                                      unitPrice: event.target.value,
                                    },
                                  }))
                                }
                                sx={{ flex: 1 }}
                              />
                              <TextField
                                label="Remarks"
                                value={draft.remarks}
                                disabled={!canManageQuotation || frozen}
                                onChange={(event) =>
                                  setOfferDrafts((values) => ({
                                    ...values,
                                    [rfqLine.id]: {
                                      ...draft,
                                      remarks: event.target.value,
                                    },
                                  }))
                                }
                                sx={{ flex: 2 }}
                              />
                            </Stack>
                            {frozen ? (
                              <Alert severity="info">
                                This quotation line is frozen because it is the
                                source of an award.
                              </Alert>
                            ) : canManageQuotation ? (
                              <Button
                                disabled={
                                  !draft.quantity ||
                                  draft.unitPrice === '' ||
                                  saveOffer.isPending
                                }
                                onClick={() =>
                                  saveOffer.mutate({
                                    rfqLineId: rfqLine.id,
                                    draft,
                                  })
                                }
                              >
                                {existing ? 'Save correction' : 'Save offer'}
                              </Button>
                            ) : null}
                          </Stack>
                        );
                      })}
                    </>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          {canViewQuotation && comparison.data?.data ? (
            <ComparisonPanel
              data={comparison.data.data}
              canAward={canAward}
              awardReasons={awardReasons}
              setAwardReasons={setAwardReasons}
              pending={selectAward.isPending}
              onAward={(rfqLineId, quotationLineId) =>
                selectAward.mutate({ rfqLineId, quotationLineId })
              }
            />
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}

function ComparisonPanel({
  data,
  canAward,
  awardReasons,
  setAwardReasons,
  pending,
  onAward,
}: {
  data: RfqComparison;
  canAward: boolean;
  awardReasons: Record<string, string>;
  setAwardReasons: Dispatch<
    SetStateAction<Record<string, string>>
  >;
  pending: boolean;
  onAward: (rfqLineId: string, quotationLineId: string) => void;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            Derived quotation comparison
          </Typography>
          <Alert severity="info">
            Comparison is generated from canonical quotation lines. It is not a
            separately editable commercial ledger.
          </Alert>
          {data.lines.map((line) => (
            <Stack
              key={line.id}
              spacing={1}
              sx={{
                border: 1,
                borderColor: line.award ? 'success.main' : 'divider',
                borderRadius: 1,
                p: 1.5,
              }}
            >
              <Typography>
                Line {line.lineNo} · {line.sourcePrNumber} ·{' '}
                {line.materialCodeSnapshot
                  ? line.materialCodeSnapshot + ' · '
                  : ''}
                {line.description}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Requested {line.quantity} {line.uomCodeSnapshot}
              </Typography>
              {line.award ? (
                <Alert severity="success">
                  Awarded to {line.award.supplierCodeSnapshot} ·{' '}
                  {line.award.supplierNameSnapshot} at{' '}
                  {line.award.unitPrice} / {line.award.uomCodeSnapshot}
                </Alert>
              ) : null}

              {line.offers.map((offer) => (
                <Stack
                  key={offer.supplierId}
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  alignItems={{ md: 'center' }}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1,
                  }}
                >
                  <Typography sx={{ flex: 2 }}>
                    {offer.supplierCodeSnapshot} ·{' '}
                    {offer.supplierNameSnapshot}
                  </Typography>
                  <Typography sx={{ flex: 1 }}>
                    Qty: {offer.quotedQuantity ?? '—'}
                  </Typography>
                  <Typography sx={{ flex: 1 }}>
                    Unit: {offer.unitPrice ?? '—'}
                  </Typography>
                  <Typography sx={{ flex: 1 }}>
                    Amount: {offer.amount ?? '—'}
                  </Typography>
                  {canAward && !line.award && offer.quotationLineId ? (
                    <Button
                      variant="contained"
                      disabled={pending}
                      onClick={() =>
                        onAward(line.id, offer.quotationLineId!)
                      }
                    >
                      Award
                    </Button>
                  ) : null}
                </Stack>
              ))}
              {canAward && !line.award ? (
                <TextField
                  label="Award decision reason"
                  value={awardReasons[line.id] ?? ''}
                  onChange={(event) =>
                    setAwardReasons((values) => ({
                      ...values,
                      [line.id]: event.target.value,
                    }))
                  }
                />
              ) : null}
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
