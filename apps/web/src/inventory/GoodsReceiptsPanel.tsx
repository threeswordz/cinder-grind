import {
  Alert, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { inventoryApi } from '../api/inventory';

export function GoodsReceiptsPanel({ permissions }: { permissions: string[] }) {
  const queryClient = useQueryClient();
  const canCreate = permissions.includes('inventory.receipt.create');
  const canSubmit = permissions.includes('inventory.receipt.submit');
  const canEdit = permissions.includes('inventory.receipt.edit');
  const canApprove = permissions.includes('inventory.receipt.approve');
  const canReverse = permissions.includes('inventory.receipt.reverse');
  const [projectId, setProjectId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [lineQuantities, setLineQuantities] = useState<Record<string, string>>({});
  const [warehouseId, setWarehouseId] = useState('');

  const [workflowCode, setWorkflowCode] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [draftRemarks, setDraftRemarks] = useState('');
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [postKeys] = useState(() => new Map<string, string>());
  const [reversalKeys] = useState(() => new Map<string, string>());

  const projects = useQuery({
    queryKey: ['receipt-projects'],
    queryFn: inventoryApi.receiptProjects,
  });
  const orders = useQuery({
    queryKey: ['receipt-pos', projectId],
    queryFn: () => inventoryApi.eligibleReceiptPos(projectId),
    enabled: Boolean(projectId),
  });
  const warehouses = useQuery({
    queryKey: ['receipt-warehouses', projectId],
    queryFn: () => inventoryApi.receiptWarehouses(projectId),
    enabled: Boolean(projectId),
  });
  const receipts = useQuery({
    queryKey: ['goods-receipts', projectId],
    queryFn: () => inventoryApi.goodsReceipts(projectId),
    enabled: Boolean(projectId),
  });
  const detail = useQuery({
    queryKey: ['goods-receipt', selectedId],
    queryFn: () => inventoryApi.goodsReceipt(selectedId),
    enabled: Boolean(selectedId),
  });
  const workflows = useQuery({
    queryKey: ['receipt-workflows'],
    queryFn: inventoryApi.receiptWorkflows,
    enabled: canSubmit,
  });
  const selectedOrder = orders.data?.data.find((order) => order.id === purchaseOrderId);
  const chosenLines = (selectedOrder?.lines ?? []).filter((line) => Boolean(lineQuantities[line.id]?.trim()));
  const validQuantity = (value: string) => /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(value) && Number(value) > 0;
  const current = detail.data?.data;
  useEffect(() => {
    if (!current) return;
    setDraftQuantities(Object.fromEntries((current.items ?? []).map((item) => [item.id, item.quantity])));
    setDraftRemarks(current.remarks ?? '');
  }, [current?.id, current?.items, current?.remarks]);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
    await queryClient.invalidateQueries({ queryKey: ['goods-receipt'] });
    await queryClient.invalidateQueries({ queryKey: ['receipt-pos'] });
  };
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<{ data: { id: string } }>) => action(),
    onSuccess: async (result) => {
      setMutationError(null);
      setSelectedId(result.data.id);
      await refresh();
    },
    onError: setMutationError,
  });
  const perform = (action: () => Promise<{ data: { id: string } }>) => mutation.mutate(action);
  const switchProject = (id: string) => {
    setProjectId(id);
    setPurchaseOrderId('');
    setLineQuantities({});
    setWarehouseId('');
    setSelectedId('');
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Goods Receipts</Typography>
      <Alert severity="info">
        Receipt approval posts stock once. Reversals retain the original movement and add an opposite movement.
      </Alert>
      {mutationError ? (
        <Alert severity="error">
          {mutationError instanceof Error ? mutationError.message : 'Request failed.'}
        </Alert>
      ) : null}
      <TextField
        select label="Project" value={projectId}
        onChange={(event) => switchProject(event.target.value)}
        sx={{ maxWidth: 480 }}
      >
        <MenuItem value="">Select Project</MenuItem>
        {(projects.data?.data ?? []).map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.projectCode} — {project.projectName}
          </MenuItem>
        ))}
      </TextField>
      {projectId && canCreate ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Create Goods Receipt Draft</Typography>
              <TextField
                select label="Approved Purchase Order" value={purchaseOrderId}
                onChange={(event) => { setPurchaseOrderId(event.target.value); setLineQuantities({}); }}
              >
                <MenuItem value="">Select Purchase Order</MenuItem>
                {(orders.data?.data ?? []).filter((order) => order.lines.length > 0).map((order) => (
                  <MenuItem key={order.id} value={order.id}>
                    {order.poNumber} · Revision {order.revisionNo}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select label="Receiving Warehouse" value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
              >
                <MenuItem value="">Select Warehouse</MenuItem>
                {(warehouses.data?.data ?? []).map((warehouse) => (
                  <MenuItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.warehouseCode} · {warehouse.warehouseName}
                  </MenuItem>
                ))}
              </TextField>
              {(selectedOrder?.lines ?? []).map((line) => (
                <TextField key={line.id}
                  label={line.materialCodeSnapshot + ' · ' + line.description + ' · PO ' +
                    line.quantity + ' ' + line.uomCodeSnapshot}
                  value={lineQuantities[line.id] ?? ''}
                  onChange={(event) => setLineQuantities((prior) => ({
                    ...prior, [line.id]: event.target.value,
                  }))}
                  placeholder="Leave blank if not received"
                  inputMode="decimal"
                />
              ))}
              <Button
                variant="contained"
                disabled={!purchaseOrderId || !warehouseId || !chosenLines.length ||
                  chosenLines.some((line) => !validQuantity(lineQuantities[line.id]!)) ||
                  mutation.isPending}
                onClick={() => perform(() => inventoryApi.createGoodsReceipt({
                  projectId, purchaseOrderId, warehouseId,
                  lines: chosenLines.map((line) => ({
                    purchaseOrderLineId: line.id,
                    quantity: lineQuantities[line.id]!,
                  })),
                }))}
              >
                Create Draft
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
      {projectId ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Receipt register</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(receipts.data?.data ?? []).map((row) => (
                  <Chip
                    key={row.id}
                    label={row.receiptNumber + ' · ' +
                      (row.reversedAt ? 'REVERSED' : row.postedAt ? 'POSTED' :
                        row.approvalInstance?.approvalState ?? 'DRAFT')}
                    onClick={() => setSelectedId(row.id)}
                    color={selectedId === row.id ? 'primary' : 'default'}
                    variant={selectedId === row.id ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
              {receipts.isSuccess && !receipts.data.data.length ? (
                <Alert severity="info">No Goods Receipts for this Project.</Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
      {current ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">{current.receiptNumber}</Typography>
              <Typography variant="body2">
                {current.items?.map((item) =>
                  item.description + ': ' + item.quantity + ' ' + item.uomCodeSnapshot,
                ).join(' · ')}
              </Typography>
              <Typography variant="body2">
                Stock movements: {current.stockTransactions?.map((row) =>
                  row.movementType + ' ' + row.quantity,
                ).join(' · ') || 'none'}
              </Typography>
              {canEdit && !current.submittedAt && current.items?.[0] ? (
                <Stack spacing={1}>
                  {(current.items ?? []).map((item) => (
                    <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField label={item.description + ' (' + item.uomCodeSnapshot + ')'}
                        value={draftQuantities[item.id] ?? ''}
                        onChange={(event) => setDraftQuantities((prior) => ({
                          ...prior, [item.id]: event.target.value,
                        }))}
                        inputMode="decimal" sx={{ flexGrow: 1 }} />
                      <Button disabled={!validQuantity(draftQuantities[item.id] ?? '') || mutation.isPending}
                        onClick={() => perform(async () => {
                          await inventoryApi.updateGoodsReceiptItem(item.id, draftQuantities[item.id]!);
                          return { data: { id: current.id } };
                        })}>
                        Save quantity
                      </Button>
                    </Stack>
                  ))}
                  <TextField label="Draft remarks" value={draftRemarks}
                    onChange={(event) => setDraftRemarks(event.target.value)} multiline minRows={2} />
                  <Button disabled={mutation.isPending}
                    onClick={() => perform(() => inventoryApi.updateGoodsReceipt(current.id, draftRemarks || null))}>
                    Save Draft remarks
                  </Button>
                </Stack>
              ) : null}
              {canSubmit && !current.submittedAt ? (
                <Stack spacing={1}>
                  <TextField select label="Approval workflow" value={workflowCode}
                    onChange={(event) => setWorkflowCode(event.target.value)}>
                    <MenuItem value="">Select workflow</MenuItem>
                    {(workflows.data?.data ?? []).map((workflow) => (
                      <MenuItem key={workflow.workflowCode} value={workflow.workflowCode}>
                        {workflow.workflowName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button disabled={!workflowCode || mutation.isPending}
                    onClick={() => perform(() => inventoryApi.submitGoodsReceipt(current.id, workflowCode))}>
                    Submit for approval
                  </Button>
                </Stack>
              ) : null}
              {canApprove && current.approvalInstance?.approvalState === 'SUBMITTED' ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="contained" disabled={mutation.isPending}
                    onClick={() => {
                      let key = postKeys.get(current.id);
                      if (!key) { key = crypto.randomUUID(); postKeys.set(current.id, key); }
                      perform(() => inventoryApi.approveGoodsReceipt(current.id, key));
                    }}>
                    Approve and post
                  </Button>
                  <Button disabled={mutation.isPending}
                    onClick={() => perform(() => inventoryApi.rejectGoodsReceipt(current.id, 'Rejected by approver'))}>
                    Reject
                  </Button>
                </Stack>
              ) : null}
              {canReverse && current.postedAt && !current.reversedAt ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField label="Reversal reason" value={reason}
                    onChange={(event) => setReason(event.target.value)} sx={{ flexGrow: 1 }} />
                  <Button disabled={!reason.trim() || mutation.isPending}
                    onClick={() => {
                      let key = reversalKeys.get(current.id);
                      if (!key) { key = crypto.randomUUID(); reversalKeys.set(current.id, key); }
                      perform(() => inventoryApi.reverseGoodsReceipt(current.id, key, reason.trim()));
                    }}>
                    Reverse receipt
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
