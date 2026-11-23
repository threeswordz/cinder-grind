import { Alert, Button, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material';
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
 * PUR10 — explicitly nonposting proposal and review. Actual order cancellation
 * and any supplier/Finance handling are blocked until a separate reviewed gate.
 */
export function PurchaseOrderCancellationPanel({ orderId, permissions, roleCodes }: Props) {
  const client = useQueryClient();
  const [note, setNote] = useState('');
  useEffect(() => setNote(''), [orderId]);

  const canView = permissions.includes('procurement.po.view') &&
    roleCodes.some(role => ['PROCUREMENT_OFFICER', 'PROJECT_MANAGER', 'MANAGEMENT'].includes(role));
  const isJaiCandidate = roleCodes.includes('PROCUREMENT_OFFICER') &&
    permissions.includes('procurement.po.create');
  const isPmCandidate = roleCodes.includes('PROJECT_MANAGER');
  const isBenCandidate = roleCodes.includes('MANAGEMENT') &&
    permissions.includes('procurement.po.cancel');
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
            </Alert>
          ) : null}
          {query.isSuccess ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={state?.status ?? 'NO PROPOSAL'} />
              <Typography variant="caption">
                Review version {state?.version ?? 0}; historical PO remains unchanged
              </Typography>
            </Stack>
          ) : null}
          {state?.status === 'BEN_APPROVED' ? (
            <Alert severity="warning">
              Ben has approved this review. Final cancellation is not yet enabled:
              supplier agreement and any receipt/Finance exceptions require their
              separately authorized handling.
            </Alert>
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
                    disabled={change.isPending || note.trim().length < 3}
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
