import { Alert, Button, Card, CardContent, Checkbox, Chip, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  poCancellationApi, type PoCancelAction,
} from '../api/po-cancellation';

type Props = {
  orderId: string;
  permissions: string[];
  roleCodes: string[];
};
const errorText = (error: unknown) => error instanceof ApiError
  ? error.message + (error.code ? ' (' + error.code + ')' : '')
  : error instanceof Error ? error.message : 'Unable to load cancellation review.';

/**
 * PUR10 — nonposting proposal/review followed by an explicit, verified
 * Ben-only final cancellation. No stock or Finance transaction is posted.
 */
export function PurchaseOrderCancellationPanel({ orderId, permissions, roleCodes }: Props) {
  const client = useQueryClient();
  const [note, setNote] = useState('');
  const [supplierEvidence, setSupplierEvidence] = useState('');
  const [supplierAgreed, setSupplierAgreed] = useState(false);
  const [noDepositPenalty, setNoDepositPenalty] = useState(false);
  const [noDeliveryInvoice, setNoDeliveryInvoice] = useState(false);
  useEffect(() => {
    setNote(''); setSupplierEvidence('');
    setSupplierAgreed(false); setNoDepositPenalty(false); setNoDeliveryInvoice(false);
  }, [orderId]);

  const canView = permissions.includes('procurement.po.view') &&
    roleCodes.some(role => ['PROCUREMENT_OFFICER', 'PROJECT_MANAGER', 'MANAGEMENT'].includes(role));
  const isJaiCandidate = roleCodes.includes('PROCUREMENT_OFFICER') &&
    permissions.includes('procurement.po.create');
  const isPmCandidate = roleCodes.includes('PROJECT_MANAGER');
  const isBenCandidate = roleCodes.includes('MANAGEMENT') &&
    permissions.includes('procurement.po.approve');
  const canFinalize = isBenCandidate && permissions.includes('procurement.po.cancel');
  const query = useQuery({
    queryKey: ['pur10-cancellation-review', orderId],
    queryFn: () => poCancellationApi.read(orderId),
    enabled: Boolean(orderId && canView),
    retry: false,
  });
  const state = query.data?.data.case ?? null;
  const previous = query.data?.data.expectedPreviousEventId ?? null;
  const actions: Array<{ action: PoCancelAction; label: string; color?: 'error' }> =
    query.isSuccess && !state && isJaiCandidate
      ? [{ action: 'PROPOSE', label: 'Propose cancellation to Khaimook' }]
      : query.isSuccess && state?.status === 'PM_PENDING' && isPmCandidate
        ? [
          { action: 'PM_FORWARD', label: 'Forward to Ben' },
          { action: 'PM_RETURN', label: 'Return request', color: 'error' },
        ]
        : query.isSuccess && state?.status === 'BEN_PENDING' && isBenCandidate
          ? [
            { action: 'BEN_APPROVE', label: 'Approve cancellation review' },
            { action: 'BEN_REJECT', label: 'Reject cancellation review', color: 'error' },
          ]
          : [];

  const change = useMutation({
    mutationFn: (action: PoCancelAction) => poCancellationApi.decide(orderId, {
      action, expectedVersion: state?.version ?? 0,
      expectedPreviousEventId: previous, note,
    }),
    onSuccess: async () => {
      setNote('');
      await client.invalidateQueries({ queryKey: ['pur10-cancellation-review', orderId] });
    },
  });

  const finalize = useMutation({
    mutationFn: () => {
      if (!previous) throw new Error('PUR10 finalization requires a current Ben approval event.');
      return poCancellationApi.finalize(orderId, {
        expectedVersion: state?.version ?? 0,
        expectedPreviousEventId: previous,
        supplierAgreementEvidence: supplierEvidence.trim(),
        supplierAgreed: true, noDepositOrPenalty: true, noDeliveryOrInvoice: true,
      });
    },
    onSuccess: async () => {
      setSupplierAgreed(false); setNoDepositPenalty(false); setNoDeliveryInvoice(false);
      setSupplierEvidence('');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['pur10-cancellation-review', orderId] }),
        client.invalidateQueries({ queryKey: ['purchase-order', orderId] }),
        client.invalidateQueries({ queryKey: ['purchase-orders'] }),
      ]);
    },
  });
  if (!canView || !orderId) return null;
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">PUR10 · Purchase Order cancellation review</Typography>
          <Alert severity="info">
            Every step is a recorded, independent decision. Even Ben approval does
            not cancel this PO, reverse Goods Receipts or post Finance transactions.
          </Alert>
          {query.isPending ? <Typography variant="body2">Loading scoped review…</Typography> : null}
          {query.isError ? (
            <Alert severity="warning">
              {errorText(query.error)}. Cancellation review cannot proceed until
              named Jai, Khaimook and Ben accounts are configured and authorized.
              <Button size="small" onClick={() => void query.refetch()}>
                Refresh protected review
              </Button>
            </Alert>
          ) : null}
          {query.isSuccess ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={state?.status ?? 'NO PROPOSAL'} />
              <Typography variant="caption">
                Review version {state?.version ?? 0}; {state?.status === 'FINALIZED'
                  ? 'PO cancellation finalized; audit history retained'
                  : 'PO cancellation not yet finalized'}
              </Typography>
            </Stack>
          ) : null}
          {state?.status === 'BEN_APPROVED' ? (
            <Alert severity="warning">
              Ben has approved the independent review. Cancellation is a separate,
              explicit Ben action and requires documented supplier agreement,
              confirmation that there are no deposits or penalties, and no
              delivery or invoice. The server rechecks current receipt and Finance
              records and refuses all exception cases.
            </Alert>
          ) : null}
          {state?.status === 'FINALIZED' ? (
            <Alert severity="success">
              The reviewed Purchase Order cancellation was recorded atomically.
              No stock or Finance posting was performed.
            </Alert>
          ) : null}
          {query.isSuccess && state?.status === 'BEN_APPROVED' && canFinalize ? (
            <Stack spacing={1}>
              <TextField
                label="Supplier's cancellation agreement evidence reference"
                value={supplierEvidence}
                onChange={e => setSupplierEvidence(e.target.value)}
                inputProps={{ maxLength: 1200 }}
                helperText="Record an actual supplier confirmation reference. This form does not contact suppliers."
                multiline minRows={2} fullWidth
              />
              <FormControlLabel
                control={<Checkbox checked={supplierAgreed}
                  onChange={(_e, v) => setSupplierAgreed(v)} />}
                label="I confirm the supplier agreed to the cancellation."
              />
              <FormControlLabel
                control={<Checkbox checked={noDepositPenalty}
                  onChange={(_e, v) => setNoDepositPenalty(v)} />}
                label="I confirm there is no deposit, penalty or expense to resolve."
              />
              <FormControlLabel
                control={<Checkbox checked={noDeliveryInvoice}
                  onChange={(_e, v) => setNoDeliveryInvoice(v)} />}
                label="I confirm no goods were received and no supplier invoice exists."
              />
              <Button variant="outlined" color="error"
                disabled={finalize.isPending || supplierEvidence.trim().length < 10 ||
                  !supplierAgreed || !noDepositPenalty || !noDeliveryInvoice}
                onClick={() => finalize.mutate()}
              >
                Finalize reviewed PO cancellation
              </Button>
              {finalize.isError ? (
                <Alert severity="error">{errorText(finalize.error)}</Alert>
              ) : null}
            </Stack>
          ) : null}
          {state?.status === 'RETURNED' || state?.status === 'REJECTED' ? (
            <Alert severity="info">
              This request is closed without cancellation; historical decisions remain retained.
            </Alert>
          ) : null}
          {actions.length ? (
            <Stack spacing={1}>
              <TextField
                label="Decision reason / evidence reference"
                value={note}
                onChange={event => setNote(event.target.value)}
                inputProps={{ maxLength: 2000 }}
                multiline minRows={2} fullWidth
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                {actions.map(item => (
                  <Button
                    key={item.action} variant="outlined" color={item.color ?? 'primary'}
                    disabled={change.isPending || note.trim().length < 3 ||
                      note.trim() !== note}
                    onClick={() => change.mutate(item.action)}
                  >
                    {item.label}
                  </Button>
                ))}
              </Stack>
              {change.isError ? (
                <Alert severity="error">{errorText(change.error)}</Alert>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
