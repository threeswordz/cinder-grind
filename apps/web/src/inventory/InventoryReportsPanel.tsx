import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
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
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { inventoryApi } from '../api/inventory';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load Inventory report.';
}

export function InventoryReportsPanel() {
  const [projectId, setProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [includeInactiveWarehouses, setIncludeInactiveWarehouses] = useState(false);
  const [includeZero, setIncludeZero] = useState(false);
  const [movementType, setMovementType] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [postedFrom, setPostedFrom] = useState('');
  const [postedTo, setPostedTo] = useState('');

  const projects = useQuery({
    queryKey: ['inventory-report', 'projects'],
    queryFn: inventoryApi.inventoryReportProjects,
  });
  const balances = useQuery({
    queryKey: ['inventory-report', 'balances', projectId, search, includeInactiveWarehouses, includeZero],
    queryFn: () => inventoryApi.inventoryReportBalances({
      ...(projectId ? { projectId } : {}),
      ...(search ? { search } : {}),
      includeInactiveWarehouses,
      includeZero,
    }),
  });
  const movements = useQuery({
    queryKey: ['inventory-report', 'movements', projectId, movementType, sourceType, postedFrom, postedTo],
    queryFn: () => inventoryApi.inventoryReportMovements({
      ...(projectId ? { projectId } : {}),
      ...(movementType ? { movementType } : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(postedFrom ? { postedFrom } : {}),
      ...(postedTo ? { postedTo } : {}),
    }),
  });
  const movementTypes = [...new Set((movements.data?.data ?? []).map((row) => row.movementType))].sort();
  const refresh = () => {
    void Promise.all([balances.refetch(), movements.refetch()]);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Inventory Reports</Typography>
      <Typography variant="body2" color="text.secondary">
        Balances and movement history are derived from the immutable Stock Transaction Ledger.
        Quantities are shown in each Material's recorded UOM.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField select label="Project" value={projectId}
          onChange={(event) => setProjectId(event.target.value)} sx={{ minWidth: 250 }}>
          <MenuItem value="">All accessible Projects</MenuItem>
          {(projects.data?.data ?? []).map((project) => (
            <MenuItem key={project.id} value={project.id}>
              {project.projectCode} — {project.projectName}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" onClick={refresh}>Refresh reports</Button>
      </Stack>
      {projects.error ? <Alert severity="error">{errorMessage(projects.error)}</Alert> : null}

      <Stack spacing={2}>
        <Typography variant="subtitle1">Stock balances</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField label="Warehouse, Material or Project" value={search}
            onChange={(event) => setSearch(event.target.value)}
            inputProps={{ maxLength: 120 }} />
          <FormControlLabel label="Archived Warehouses" control={
            <Checkbox checked={includeInactiveWarehouses}
              onChange={(event) => setIncludeInactiveWarehouses(event.target.checked)} />
          } />
          <FormControlLabel label="Zero balances" control={
            <Checkbox checked={includeZero}
              onChange={(event) => setIncludeZero(event.target.checked)} />
          } />
        </Stack>
        {balances.error ? <Alert severity="error">{errorMessage(balances.error)}</Alert> : null}
        {balances.isLoading ? <Typography>Loading balances…</Typography> : null}
        {!balances.isLoading && !balances.error && !balances.data?.data.length
          ? <Alert severity="info">No balances match these filters.</Alert> : null}
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Warehouse</TableCell><TableCell>Project</TableCell>
              <TableCell>Material</TableCell><TableCell>UOM</TableCell>
              <TableCell align="right">On hand</TableCell>
            </TableRow></TableHead>
            <TableBody>{(balances.data?.data ?? []).map((row) => (
              <TableRow key={[row.warehouseId, row.materialId, row.projectId, row.uomId].join(':')}>
                <TableCell>{row.warehouseCode} — {row.warehouseName}
                  {!row.warehouseIsActive ? ' (Archived)' : ''}</TableCell>
                <TableCell>{row.projectCode ?? 'Unallocated'}</TableCell>
                <TableCell>{row.materialCode} — {row.materialName}</TableCell>
                <TableCell>{row.uomCode}</TableCell>
                <TableCell align="right">{row.quantity}</TableCell>
              </TableRow>))}</TableBody>
          </Table>
        </TableContainer>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="subtitle1">Stock movements</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField select label="Source" value={sourceType}
            onChange={(event) => setSourceType(event.target.value)}>
            <MenuItem value="">All sources</MenuItem>
            {['GOODS_RECEIPT', 'MATERIAL_ISSUE', 'MATERIAL_RETURN', 'STOCK_TRANSFER'].map((type) => (
              <MenuItem key={type} value={type}>{type.replaceAll('_', ' ')}</MenuItem>
            ))}
          </TextField>
          <TextField label="Movement type" value={movementType}
            onChange={(event) => setMovementType(event.target.value)}
            inputProps={{ maxLength: 40 }} helperText="For example, GOODS_RECEIPT" />
          <TextField label="From" type="date" value={postedFrom}
            onChange={(event) => setPostedFrom(event.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" value={postedTo}
            onChange={(event) => setPostedTo(event.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>
        {movementTypes.length ? (
          <Typography variant="caption" color="text.secondary">
            Types in current results: {movementTypes.join(', ')}
          </Typography>
        ) : null}
        {movements.error ? <Alert severity="error">{errorMessage(movements.error)}</Alert> : null}
        {movements.isLoading ? <Typography>Loading movements…</Typography> : null}
        {!movements.isLoading && !movements.error && !movements.data?.data.length
          ? <Alert severity="info">No movements match these filters.</Alert> : null}
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Posted (UTC)</TableCell><TableCell>Type</TableCell>
              <TableCell>Source</TableCell><TableCell>Warehouse</TableCell>
              <TableCell>Project</TableCell><TableCell>Material</TableCell>
              <TableCell align="right">Quantity</TableCell><TableCell>UOM</TableCell>
            </TableRow></TableHead>
            <TableBody>{(movements.data?.data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>{new Date(row.postedAt).toLocaleString()}</TableCell>
                <TableCell>{row.movementType}</TableCell>
                <TableCell>{row.sourceType} {row.sourceNumber ?? row.sourceId ?? ''}</TableCell>
                <TableCell>{row.warehouseCode}</TableCell>
                <TableCell>{row.projectCode ?? 'Unallocated'}</TableCell>
                <TableCell>{row.materialCode} — {row.materialName}</TableCell>
                <TableCell align="right">{row.quantity}</TableCell>
                <TableCell>{row.uomCode}</TableCell>
              </TableRow>))}</TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Stack>
  );
}
