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
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  InventoryProject,
  StockBalanceRecord,
  inventoryApi,
} from '../api/inventory';

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load Stock Balance.';
}

export function StockBalancePanel() {
  const [projects, setProjects] = useState<InventoryProject[]>([]);
  const [rows, setRows] = useState<StockBalanceRecord[]>([]);
  const [projectId, setProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [includeInactiveWarehouses, setIncludeInactiveWarehouses] = useState(false);
  const [includeZero, setIncludeZero] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const requestGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError('');
    try {
      const response = await inventoryApi.stockBalances({
        ...(projectId ? { projectId } : {}),
        ...(search ? { search } : {}),
        includeInactiveWarehouses,
        includeZero,
      });
      if (generation === requestGeneration.current) {
        setRows(response.data);
      }
    } catch (caught) {
      if (generation === requestGeneration.current) {
        setError(message(caught));
      }
    } finally {
      if (generation === requestGeneration.current) {
        setLoading(false);
      }
    }
  }, [projectId, search, includeInactiveWarehouses, includeZero]);

  useEffect(() => {
    void inventoryApi.stockProjects()
      .then((response) => setProjects(response.data))
      .catch((caught) => setError(message(caught)));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <TextField
          select
          label="Transaction Project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="">All accessible Projects</MenuItem>
          {projects.map((project) => (
            <MenuItem key={project.id} value={project.id}>
              {project.projectCode} — {project.projectName}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Warehouse, material or Project"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          inputProps={{ maxLength: 120 }}
          sx={{ minWidth: 280 }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={includeInactiveWarehouses}
              onChange={(event) => setIncludeInactiveWarehouses(event.target.checked)}
            />
          }
          label="Archived Warehouses"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={includeZero}
              onChange={(event) => setIncludeZero(event.target.checked)}
            />
          }
          label="Zero balances"
        />
        <Button variant="outlined" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Quantities are derived from the immutable Stock Transaction Ledger. Warehouse Project/Site
        ownership and transaction Project attribution are shown separately.
      </Typography>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!loading && rows.length === 0 ? (
        <Alert severity="info">No Stock Balance rows match the accessible filters.</Alert>
      ) : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Warehouse</TableCell>
              <TableCell>Warehouse context</TableCell>
              <TableCell>Transaction Project</TableCell>
              <TableCell>Material</TableCell>
              <TableCell>UOM</TableCell>
              <TableCell align="right">On hand</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={[
                  row.warehouseId,
                  row.materialId,
                  row.projectId ?? 'unallocated',
                  row.uomId,
                ].join(':')}
              >
                <TableCell>
                  {row.warehouseCode} — {row.warehouseName}
                  {!row.warehouseIsActive ? ' (Archived)' : ''}
                </TableCell>
                <TableCell>
                  {row.isSiteWarehouse ? 'Site' : 'General'}
                  {row.warehouseProjectCode
                    ? ` — ${row.warehouseProjectCode} ${row.warehouseProjectName ?? ''}`
                    : ''}
                </TableCell>
                <TableCell>
                  {row.projectCode
                    ? `${row.projectCode} — ${row.projectName ?? ''}`
                    : 'Unallocated'}
                </TableCell>
                <TableCell>{row.materialCode} — {row.materialName}</TableCell>
                <TableCell>{row.uomCode}</TableCell>
                <TableCell align="right">{row.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
