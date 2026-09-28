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

export function MaterialReservationsPanel({ permissions }: { permissions: string[] }) {
  const queryClient = useQueryClient();
  const canCreate = permissions.includes('inventory.reservation.create');
  const canActivate = permissions.includes('inventory.reservation.activate');
  const canRelease = permissions.includes('inventory.reservation.release');
  const [projectId, setProjectId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [stockKey, setStockKey] = useState('');
  const [quantity, setQuantity] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reason, setReason] = useState('');
  const [mutationError, setMutationError] = useState<unknown>(null);

  const projects = useQuery({
    queryKey: ['reservation-projects'],
    queryFn: inventoryApi.reservationProjects,
  });
  const warehouses = useQuery({
    queryKey: ['reservation-warehouses', projectId],
    queryFn: () => inventoryApi.reservationWarehouses(projectId),
    enabled: Boolean(projectId),
  });
  const stock = useQuery({
    queryKey: ['reservation-stock', projectId, warehouseId],
    queryFn: () => inventoryApi.reservationStock(projectId, warehouseId || undefined),
    enabled: Boolean(projectId),
  });
  const rows = useQuery({
    queryKey: ['material-reservations', projectId],
    queryFn: () => inventoryApi.materialReservations(projectId),
    enabled: Boolean(projectId),
  });
  const selectedStock = stock.data?.data.find(
    (row) => [row.warehouseId, row.materialId, row.uomId].join(':') === stockKey,
  );
  const detail = useQuery({
    queryKey: ['material-reservation', selectedId],
    queryFn: () => inventoryApi.materialReservation(selectedId),
    enabled: Boolean(selectedId),
  });
  const availability = useQuery({
    queryKey: [
      'reservation-availability',
      projectId,
      selectedStock?.warehouseId,
      selectedStock?.materialId,
      selectedStock?.uomId,
    ],
    queryFn: () =>
      inventoryApi.reservationAvailability({
        projectId,
        warehouseId: selectedStock!.warehouseId,
        materialId: selectedStock!.materialId,
        uomId: selectedStock!.uomId,
      }),
    enabled: Boolean(projectId && selectedStock),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['material-reservations'] }),
      queryClient.invalidateQueries({ queryKey: ['material-reservation'] }),
      queryClient.invalidateQueries({ queryKey: ['reservation-availability'] }),
      queryClient.invalidateQueries({ queryKey: ['reservation-stock'] }),
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
  const validQuantity =
    /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(quantity) &&
    Number(quantity) > 0;
  const current = detail.data?.data;

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Material Reservations</Typography>
      <Alert severity="info">
        Active Reservations reduce available quantity but never change physical on-hand stock.
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
              <Typography variant="subtitle1">Create Reservation Draft</Typography>
              <TextField
                select
                label="Warehouse"
                value={warehouseId}
                onChange={(event) => {
                  setWarehouseId(event.target.value);
                  setStockKey('');
                }}
              >
                <MenuItem value="">All accessible Warehouses</MenuItem>
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
              >
                <MenuItem value="">Select received stock</MenuItem>
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
              {availability.data ? (
                <Alert severity="info">
                  On hand {availability.data.data.onHand} · Active reserved{' '}
                  {availability.data.data.reserved} · Available{' '}
                  {availability.data.data.available}
                </Alert>
              ) : null}
              <TextField
                label="Quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                inputMode="decimal"
              />
              <TextField
                label="Required date (optional)"
                type="date"
                value={requiredDate}
                onChange={(event) => setRequiredDate(event.target.value)}
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
                disabled={!selectedStock || !validQuantity || mutation.isPending}
                onClick={() =>
                  selectedStock &&
                  perform(() =>
                    inventoryApi.createMaterialReservation({
                      projectId,
                      warehouseId: selectedStock.warehouseId,
                      materialId: selectedStock.materialId,
                      uomId: selectedStock.uomId,
                      quantity,
                      requiredDate: requiredDate || null,
                      remarks: remarks || null,
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
              <Typography variant="subtitle1">Reservation register</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(rows.data?.data ?? []).map((row) => (
                  <Chip
                    key={row.id}
                    label={row.reservationNumber + ' · ' + row.status}
                    color={selectedId === row.id ? 'primary' : 'default'}
                    variant={selectedId === row.id ? 'filled' : 'outlined'}
                    onClick={() => setSelectedId(row.id)}
                  />
                ))}
              </Stack>
              {rows.isSuccess && !rows.data.data.length ? (
                <Alert severity="info">No Material Reservations for this Project.</Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {current ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                {current.reservationNumber} · {current.status}
              </Typography>
              <Typography variant="body2">
                {current.material?.materialCode} — {current.material?.materialName} ·{' '}
                {current.quantity} {current.uom?.uomCode} ·{' '}
                {current.warehouse?.warehouseCode}
              </Typography>
              {canActivate && current.status === 'DRAFT' ? (
                <Button
                  variant="contained"
                  disabled={mutation.isPending}
                  onClick={() =>
                    perform(() => inventoryApi.activateMaterialReservation(current.id))
                  }
                >
                  Activate Reservation
                </Button>
              ) : null}
              {canRelease && current.status === 'ACTIVE' ? (
                <Stack spacing={1}>
                  <TextField
                    label="Release / cancellation reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button
                      disabled={!reason.trim() || mutation.isPending}
                      onClick={() =>
                        perform(() =>
                          inventoryApi.releaseMaterialReservation(
                            current.id,
                            reason.trim(),
                          ),
                        )
                      }
                    >
                      Release
                    </Button>
                    <Button
                      disabled={!reason.trim() || mutation.isPending}
                      onClick={() =>
                        perform(() =>
                          inventoryApi.cancelMaterialReservation(
                            current.id,
                            reason.trim(),
                          ),
                        )
                      }
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
