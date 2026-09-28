import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { inventoryApi } from '../api/inventory';

export function MaterialIssuesPanel({ permissions }: { permissions: string[] }) {
  const queryClient = useQueryClient();
  const canCreate = permissions.includes('inventory.issue.create');
  const canSubmit = permissions.includes('inventory.issue.submit');
  const canApprove = permissions.includes('inventory.issue.approve');
  const canReverse = permissions.includes('inventory.issue.reverse');
  const [projectId, setProjectId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [stockKey, setStockKey] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [workflowCode, setWorkflowCode] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [postKeys] = useState(() => new Map<string, string>());
  const [reversalKeys] = useState(() => new Map<string, string>());

  const projects = useQuery({
    queryKey: ['issue-projects'],
    queryFn: inventoryApi.issueProjects,
  });
  const warehouses = useQuery({
    queryKey: ['issue-warehouses', projectId],
    queryFn: () => inventoryApi.issueWarehouses(projectId),
    enabled: Boolean(projectId),
  });
  const stock = useQuery({
    queryKey: ['issue-stock', projectId, warehouseId],
    queryFn: () => inventoryApi.issueStock(projectId, warehouseId || undefined),
    enabled: Boolean(projectId),
  });
  const reservations = useQuery({
    queryKey: ['issue-reservations', projectId],
    queryFn: () => inventoryApi.issueReservations(projectId),
    enabled: Boolean(projectId),
  });
  const issues = useQuery({
    queryKey: ['material-issues', projectId],
    queryFn: () => inventoryApi.materialIssues(projectId),
    enabled: Boolean(projectId),
  });
  const workflows = useQuery({
    queryKey: ['issue-workflows'],
    queryFn: inventoryApi.issueWorkflows,
    enabled: canSubmit,
  });
  const detail = useQuery({
    queryKey: ['material-issue', selectedId],
    queryFn: () => inventoryApi.materialIssue(selectedId),
    enabled: Boolean(selectedId),
  });
  const selectedStock = stock.data?.data.find(
    (row) => [row.warehouseId, row.materialId, row.uomId].join(':') === stockKey,
  );
  const current = detail.data?.data;
  const validQuantity =
    /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(quantity) &&
    Number(quantity) > 0;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['material-issues'] }),
      queryClient.invalidateQueries({ queryKey: ['material-issue'] }),
      queryClient.invalidateQueries({ queryKey: ['issue-stock'] }),
      queryClient.invalidateQueries({ queryKey: ['issue-reservations'] }),
      queryClient.invalidateQueries({ queryKey: ['material-reservations'] }),
      queryClient.invalidateQueries({ queryKey: ['stock-balances'] }),
    ]);
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
  const perform = (action: () => Promise<{ data: { id: string } }>) =>
    mutation.mutate(action);

  const chooseReservation = (id: string) => {
    setReservationId(id);
    if (!id) return;
    const reservation = reservations.data?.data.find((row) => row.id === id);
    if (!reservation) return;
    setWarehouseId(reservation.warehouseId);
    setStockKey(
      [reservation.warehouseId, reservation.materialId, reservation.uomId].join(':'),
    );
    setQuantity(reservation.quantity);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Material Issues</Typography>
      <Alert severity="info">
        Final approval atomically posts negative stock. Linked Reservations are fully
        fulfilled in the same transaction; stock reserved by another active Reservation
        cannot be consumed.
      </Alert>
      {mutationError ? (
        <Alert severity="error">
          {mutationError instanceof Error ? mutationError.message : 'Request failed.'}
        </Alert>
      ) : null}
      <TextField
        select
        label="Project"
        value={projectId}
        onChange={(event) => {
          setProjectId(event.target.value);
          setWarehouseId('');
          setStockKey('');
          setReservationId('');
          setSelectedId('');
        }}
        sx={{ maxWidth: 520 }}
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
              <Typography variant="subtitle1">Create Material Issue Draft</Typography>
              <TextField
                select
                label="Linked Active Reservation (optional)"
                value={reservationId}
                onChange={(event) => chooseReservation(event.target.value)}
              >
                <MenuItem value="">No linked Reservation</MenuItem>
                {(reservations.data?.data ?? []).map((reservation) => (
                  <MenuItem key={reservation.id} value={reservation.id}>
                    {reservation.reservationNumber} · {reservation.quantity}{' '}
                    {reservation.uom?.uomCode ?? ''}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Issue Warehouse"
                value={warehouseId}
                onChange={(event) => {
                  setWarehouseId(event.target.value);
                  setStockKey('');
                  setReservationId('');
                }}
                disabled={Boolean(reservationId)}
              >
                <MenuItem value="">Select Warehouse</MenuItem>
                {(warehouses.data?.data ?? []).map((warehouse) => (
                  <MenuItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.warehouseCode} — {warehouse.warehouseName}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Material / UOM"
                value={stockKey}
                onChange={(event) => setStockKey(event.target.value)}
                disabled={Boolean(reservationId)}
              >
                <MenuItem value="">Select stock</MenuItem>
                {(stock.data?.data ?? []).map((row) => {
                  const key = [row.warehouseId, row.materialId, row.uomId].join(':');
                  return (
                    <MenuItem key={key} value={key}>
                      {row.warehouseCode} · {row.materialCode} — {row.materialName} ·
                      {' '}{row.onHand} {row.uomCode}
                    </MenuItem>
                  );
                })}
              </TextField>
              <TextField
                label="Quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                inputMode="decimal"
                disabled={Boolean(reservationId)}
              />
              <TextField
                label="Issue date"
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                multiline
                minRows={2}
              />
              <Button
                variant="contained"
                disabled={!selectedStock || !validQuantity || !issueDate || mutation.isPending}
                onClick={() =>
                  selectedStock &&
                  perform(() =>
                    inventoryApi.createMaterialIssue({
                      projectId,
                      warehouseId: selectedStock.warehouseId,
                      issueDate,
                      remarks: remarks || null,
                      lines: [
                        {
                          materialId: selectedStock.materialId,
                          quantity,
                          uomId: selectedStock.uomId,
                          reservationId: reservationId || null,
                        },
                      ],
                    }),
                  )
                }
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
              <Typography variant="subtitle1">Issue register</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(issues.data?.data ?? []).map((row) => (
                  <Chip
                    key={row.id}
                    label={
                      row.issueNumber +
                      ' · ' +
                      (row.reversedAt
                        ? 'REVERSED'
                        : row.postedAt
                          ? 'POSTED'
                          : row.approvalInstance?.approvalState ?? 'DRAFT')
                    }
                    color={selectedId === row.id ? 'primary' : 'default'}
                    variant={selectedId === row.id ? 'filled' : 'outlined'}
                    onClick={() => setSelectedId(row.id)}
                  />
                ))}
              </Stack>
              {issues.isSuccess && !issues.data.data.length ? (
                <Alert severity="info">No Material Issues for this Project.</Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {current ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">{current.issueNumber}</Typography>
              <Typography variant="body2">
                {(current.items ?? [])
                  .map(
                    (item) =>
                      (item.material?.materialCode ?? item.materialId) +
                      ': ' +
                      item.quantity +
                      ' ' +
                      (item.uom?.uomCode ?? ''),
                  )
                  .join(' · ')}
              </Typography>
              <Typography variant="body2">
                Stock movements:{' '}
                {current.stockTransactions
                  ?.map((row) => row.movementType + ' ' + row.quantity)
                  .join(' · ') || 'none'}
              </Typography>
              {canSubmit && !current.submittedAt ? (
                <Stack spacing={1}>
                  <TextField
                    select
                    label="Approval workflow"
                    value={workflowCode}
                    onChange={(event) => setWorkflowCode(event.target.value)}
                  >
                    <MenuItem value="">Select workflow</MenuItem>
                    {(workflows.data?.data ?? []).map((workflow) => (
                      <MenuItem key={workflow.workflowCode} value={workflow.workflowCode}>
                        {workflow.workflowName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    disabled={!workflowCode || mutation.isPending}
                    onClick={() =>
                      perform(() =>
                        inventoryApi.submitMaterialIssue(current.id, workflowCode),
                      )
                    }
                  >
                    Submit for approval
                  </Button>
                </Stack>
              ) : null}
              {canApprove &&
              current.approvalInstance?.approvalState === 'SUBMITTED' ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="contained"
                    disabled={mutation.isPending}
                    onClick={() => {
                      let key = postKeys.get(current.id);
                      if (!key) {
                        key = crypto.randomUUID();
                        postKeys.set(current.id, key);
                      }
                      perform(() =>
                        inventoryApi.approveMaterialIssue(current.id, key!),
                      );
                    }}
                  >
                    Approve and post
                  </Button>
                  <Button
                    disabled={mutation.isPending}
                    onClick={() =>
                      perform(() =>
                        inventoryApi.rejectMaterialIssue(
                          current.id,
                          'Rejected by approver',
                        ),
                      )
                    }
                  >
                    Reject
                  </Button>
                </Stack>
              ) : null}
              {canReverse && current.postedAt && !current.reversedAt ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    label="Reversal reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    sx={{ flexGrow: 1 }}
                  />
                  <Button
                    disabled={!reason.trim() || mutation.isPending}
                    onClick={() => {
                      let key = reversalKeys.get(current.id);
                      if (!key) {
                        key = crypto.randomUUID();
                        reversalKeys.set(current.id, key);
                      }
                      perform(() =>
                        inventoryApi.reverseMaterialIssue(
                          current.id,
                          key!,
                          reason.trim(),
                        ),
                      );
                    }}
                  >
                    Reverse Issue
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
