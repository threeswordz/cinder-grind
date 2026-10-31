import {
  Alert,
  Button,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { inventoryApi, type StockCount } from '../api/inventory';

function localDateTime(value = new Date()) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to update the physical stock count.';
}
function validQuantity(value: string) {
  return /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(value);
}

export function StockCountsPanel({ permissions }: { permissions: string[] }) {
  const queryClient = useQueryClient();
  const canCreate = permissions.includes('inventory.stock_count.create');
  const canEdit = permissions.includes('inventory.stock_count.edit');
  const canSubmit = permissions.includes('inventory.stock_count.submit');
  const canApprove = permissions.includes('inventory.stock_count.approve');

  const [projectId, setProjectId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [choicePages, setChoicePages] = useState<string[]>(['']);
  const [choiceKey, setChoiceKey] = useState('');
  const [countedAt, setCountedAt] = useState(() => localDateTime());
  const [actualQuantity, setActualQuantity] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [editId, setEditId] = useState('');
  const [editCountedAt, setEditCountedAt] = useState('');
  const [editActualQuantity, setEditActualQuantity] = useState('');
  const [editEvidence, setEditEvidence] = useState('');
  const [reviewId, setReviewId] = useState('');
  const [decisionComment, setDecisionComment] = useState('');
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [postKeys] = useState(() => new Map<string, string>());

  const projects = useQuery({
    queryKey: ['stock-count-projects'],
    queryFn: inventoryApi.stockCountProjects,
  });
  const warehouses = useQuery({
    queryKey: ['stock-count-warehouses', projectId],
    queryFn: () => inventoryApi.stockCountWarehouses(projectId),
    enabled: Boolean(projectId),
  });
  const after = choicePages[choicePages.length - 1] ?? '';
  const choices = useQuery({
    queryKey: ['stock-count-choices', projectId, warehouseId, after],
    queryFn: () => inventoryApi.stockCountChoices(projectId, warehouseId, after),
    enabled: Boolean(projectId && warehouseId),
  });
  const counts = useQuery({
    queryKey: ['stock-counts', projectId],
    queryFn: () => inventoryApi.stockCounts(projectId),
    enabled: Boolean(projectId),
  });

  const selectedChoice = choices.data?.data.items.find(
    item => [item.materialId, item.uomId].join(':') === choiceKey,
  );
  const editCount = counts.data?.data.find(row => row.id === editId);
  const reviewCount = counts.data?.data.find(row => row.id === reviewId);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['stock-counts'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-count'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-count-choices'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-report'] }),
    ]);
  };
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<{ data: StockCount }>) => action(),
    onSuccess: async result => {
      setMutationError(null);
      if (result.data.status === 'APPROVED') postKeys.delete(result.data.id);
      if (result.data.status !== 'DRAFT') setEditId('');
      if (result.data.status !== 'SUBMITTED') {
        setReviewId('');
        setDecisionComment('');
      }
      await refresh();
    },
    onError: setMutationError,
  });
  const perform = (action: () => Promise<{ data: StockCount }>) => mutation.mutate(action);

  const createReady = canCreate && Boolean(projectId && warehouseId && selectedChoice) &&
    validQuantity(actualQuantity) && Boolean(countedAt);
  const editReady = Boolean(editCount) && editCount?.status === 'DRAFT' &&
    validQuantity(editActualQuantity) && Boolean(editCountedAt);

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Physical Stock Counts</Typography>
      <Alert severity="info">
        Site Store records the physical quantity. A submitted non-zero variance requires inspection evidence.
        Approval posts quantity only to the Stock Transaction Ledger; it does not create an Accounting or valuation entry.
      </Alert>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField select label="Project" value={projectId} sx={{ minWidth: 260 }}
          onChange={event => {
            setProjectId(event.target.value);
            setWarehouseId('');
            setChoiceKey('');
            setChoicePages(['']);
            setEditId('');
            setReviewId('');
          }}>
          <MenuItem value="">Select Project</MenuItem>
          {(projects.data?.data ?? []).map(project => (
            <MenuItem key={project.id} value={project.id}>
              {project.projectCode} — {project.projectName}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Site Warehouse" value={warehouseId} sx={{ minWidth: 260 }}
          disabled={!projectId}
          onChange={event => {
            setWarehouseId(event.target.value);
            setChoiceKey('');
            setChoicePages(['']);
          }}>
          <MenuItem value="">Select site Warehouse</MenuItem>
          {(warehouses.data?.data ?? []).map(warehouse => (
            <MenuItem key={warehouse.id} value={warehouse.id}>
              {warehouse.warehouseCode} — {warehouse.warehouseName}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" disabled={!projectId}
          onClick={() => void counts.refetch()}>Refresh counts</Button>
      </Stack>
      {projects.error || warehouses.error || choices.error || counts.error ? (
        <Alert severity="error">{errorMessage(projects.error ?? warehouses.error ?? choices.error ?? counts.error)}</Alert>
      ) : null}

      {canCreate && projectId && warehouseId ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Record physical count</Typography>
            <TextField select label="Material / UOM" value={choiceKey}
              onChange={event => setChoiceKey(event.target.value)}>
              <MenuItem value="">Select Material and UOM</MenuItem>
              {(choices.data?.data.items ?? []).map(item => (
                <MenuItem key={[item.materialId, item.uomId].join(':')}
                  value={[item.materialId, item.uomId].join(':')}>
                  {item.materialCode} — {item.materialName} / {item.uomCode}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Counted at" type="datetime-local" value={countedAt}
                onChange={event => setCountedAt(event.target.value)}
                InputLabelProps={{ shrink: true }} />
              <TextField label="Actual physical quantity" value={actualQuantity}
                onChange={event => setActualQuantity(event.target.value)}
                error={Boolean(actualQuantity) && !validQuantity(actualQuantity)}
                helperText="Non-negative, up to 4 decimal places." />
              <TextField label="Inspection evidence reference" value={evidenceReference}
                onChange={event => setEvidenceReference(event.target.value)}
                inputProps={{ maxLength: 2000 }}
                helperText="Required before submitting a non-zero variance." sx={{ flexGrow: 1 }} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button disabled={choicePages.length <= 1 || choices.isFetching}
                onClick={() => {
                  setChoicePages(old => old.slice(0, -1));
                  setChoiceKey('');
                }}>Previous materials</Button>
              <Button disabled={!choices.data?.data.nextCursor || choices.isFetching}
                onClick={() => {
                  setChoicePages(old => [...old, choices.data!.data.nextCursor!]);
                  setChoiceKey('');
                }}>Next materials</Button>
              <Button variant="contained" disabled={!createReady || mutation.isPending}
                onClick={() => perform(() => inventoryApi.createStockCount({
                  projectId,
                  warehouseId,
                  materialId: selectedChoice!.materialId,
                  uomId: selectedChoice!.uomId,
                  countedAt: new Date(countedAt).toISOString(),
                  actualQuantity,
                  evidenceReference: evidenceReference.trim() || null,
                }))}>
                Save draft count
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      {mutationError ? <Alert severity="error">{errorMessage(mutationError)}</Alert> : null}

      {projectId ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Counted</TableCell><TableCell>Warehouse</TableCell><TableCell>Material / UOM</TableCell>
              <TableCell align="right">Ledger snapshot</TableCell><TableCell align="right">Reserved snapshot</TableCell>
              <TableCell align="right">Physical</TableCell><TableCell align="right">Variance</TableCell>
              <TableCell>Status</TableCell><TableCell>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>{(counts.data?.data ?? []).map(row => (
              <TableRow key={row.id}>
                <TableCell>{new Date(row.countedAt).toLocaleString()}</TableCell>
                <TableCell>{row.warehouse.warehouseCode}</TableCell>
                <TableCell>{row.material.materialCode} / {row.uom.uomCode}</TableCell>
                <TableCell align="right">{row.expectedOnHand}</TableCell>
                <TableCell align="right">{row.expectedReserved}</TableCell>
                <TableCell align="right">{row.actualQuantity}</TableCell>
                <TableCell align="right">{row.varianceQuantity}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    {row.status === 'DRAFT' && canEdit ? (
                      <Button size="small" onClick={() => {
                        setEditId(row.id);
                        setEditCountedAt(localDateTime(new Date(row.countedAt)));
                        setEditActualQuantity(row.actualQuantity);
                        setEditEvidence(row.evidenceReference ?? '');
                      }}>Edit</Button>
                    ) : null}
                    {row.status === 'DRAFT' && canSubmit ? (
                      <Button size="small" variant="outlined" disabled={mutation.isPending}
                        onClick={() => perform(() => inventoryApi.submitStockCount(row.id, row.version))}>
                        Submit
                      </Button>
                    ) : null}
                    {row.status === 'SUBMITTED' && canApprove ? (
                      <Button size="small" variant="outlined" onClick={() => {
                        setReviewId(row.id);
                        setDecisionComment('');
                      }}>Review</Button>
                    ) : null}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </TableContainer>
      ) : null}

      {editCount && canEdit ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Edit draft — {editCount.material.materialCode} / {editCount.uom.uomCode}</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Counted at" type="datetime-local" value={editCountedAt}
                onChange={event => setEditCountedAt(event.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField label="Actual physical quantity" value={editActualQuantity}
                onChange={event => setEditActualQuantity(event.target.value)}
                error={Boolean(editActualQuantity) && !validQuantity(editActualQuantity)} />
              <TextField label="Inspection evidence reference" value={editEvidence}
                onChange={event => setEditEvidence(event.target.value)} inputProps={{ maxLength: 2000 }}
                sx={{ flexGrow: 1 }} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setEditId('')}>Cancel</Button>
              <Button variant="contained" disabled={!editReady || mutation.isPending}
                onClick={() => perform(() => inventoryApi.updateStockCount(editCount.id, {
                  expectedVersion: editCount.version,
                  countedAt: new Date(editCountedAt).toISOString(),
                  actualQuantity: editActualQuantity,
                  evidenceReference: editEvidence.trim() || null,
                }))}>
                Save draft changes
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      {reviewCount && reviewCount.status === 'SUBMITTED' && canApprove ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">
              Review submitted count — {reviewCount.material.materialCode} / {reviewCount.uom.uomCode}
            </Typography>
            <Typography variant="body2">
              Ledger {reviewCount.expectedOnHand}; reserved {reviewCount.expectedReserved}; physical {reviewCount.actualQuantity};
              variance {reviewCount.varianceQuantity}. Evidence: {reviewCount.evidenceReference ?? 'None required for zero variance'}.
            </Typography>
            <TextField label="Decision comment" value={decisionComment}
              onChange={event => setDecisionComment(event.target.value)} inputProps={{ maxLength: 1000 }}
              helperText="Required for rejection; optional for approval." />
            <Stack direction="row" spacing={1}>
              <Button onClick={() => { setReviewId(''); setDecisionComment(''); }}>Cancel</Button>
              <Button color="error" variant="outlined"
                disabled={mutation.isPending || !decisionComment.trim()}
                onClick={() => perform(() => inventoryApi.rejectStockCount(
                  reviewCount.id, reviewCount.version, decisionComment.trim(),
                ))}>
                Reject
              </Button>
              <Button variant="contained" disabled={mutation.isPending}
                onClick={() => {
                  let key = postKeys.get(reviewCount.id);
                  if (!key) {
                    key = crypto.randomUUID();
                    postKeys.set(reviewCount.id, key);
                  }
                  perform(() => inventoryApi.approveStockCount(
                    reviewCount.id,
                    reviewCount.version,
                    key!,
                    decisionComment.trim() || undefined,
                  ));
                }}>
                Approve quantity adjustment
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
