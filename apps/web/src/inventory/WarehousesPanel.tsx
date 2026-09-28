import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { inventoryApi } from '../api/inventory';

export function WarehousesPanel({
  permissions,
}: {
  permissions: string[];
}) {
  const queryClient = useQueryClient();
  const canCreate = permissions.includes('inventory.warehouse.create');
  const canEdit = permissions.includes('inventory.warehouse.edit');
  const canArchive = permissions.includes('inventory.warehouse.archive');
  const canAccessAllProjects = permissions.includes('projects.access_all');

  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [newMode, setNewMode] = useState(false);

  const [warehouseCode, setWarehouseCode] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [location, setLocation] = useState('');
  const [isSiteWarehouse, setIsSiteWarehouse] = useState(false);

  const warehouses = useQuery({
    queryKey: [
      'inventory',
      'warehouses',
      includeInactive,
      projectFilter,
      search,
    ],
    queryFn: () =>
      inventoryApi.warehouses({
        includeInactive,
        ...(projectFilter ? { projectId: projectFilter } : {}),
        ...(search ? { search } : {}),
      }),
  });

  const projects = useQuery({
    queryKey: ['inventory', 'projects'],
    queryFn: inventoryApi.projects,
  });

  const selected = useMemo(
    () =>
      (warehouses.data?.data ?? []).find((row) => row.id === selectedId) ??
      null,
    [warehouses.data?.data, selectedId],
  );

  useEffect(() => {
    if (!selected || newMode) return;
    setWarehouseCode(selected.warehouseCode);
    setWarehouseName(selected.warehouseName);
    setProjectId(selected.projectId ?? '');
    setLocation(selected.location ?? '');
    setIsSiteWarehouse(selected.isSiteWarehouse);
  }, [selected, newMode]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        warehouseCode,
        warehouseName,
        projectId: projectId || null,
        location: location || null,
        isSiteWarehouse,
      };
      return newMode || !selectedId
        ? inventoryApi.createWarehouse(body)
        : inventoryApi.updateWarehouse(selectedId, body);
    },
    onSuccess: async (result) => {
      setSelectedId(result.data.id);
      setNewMode(false);
      await refresh();
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: (row: { id: string; isActive: boolean }) =>
      row.isActive
        ? inventoryApi.archiveWarehouse(row.id)
        : inventoryApi.reactivateWarehouse(row.id),
    onSuccess: refresh,
  });

  const clearForm = () => {
    setSelectedId('');
    setNewMode(true);
    setWarehouseCode('');
    setWarehouseName('');
    setProjectId('');
    setLocation('');
    setIsSiteWarehouse(false);
  };

  const error = saveMutation.error ?? lifecycleMutation.error;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ sm: 'center' }}
      >
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Warehouses
        </Typography>
        {canCreate ? (
          <Button variant="outlined" onClick={clearForm}>
            New Warehouse
          </Button>
        ) : null}
      </Stack>

      <Alert severity="info">
        Stock balances and movements are introduced in later V0.4 stages.
        This register defines approved storage locations and Project/Site
        ownership.
      </Alert>

      {error ? (
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Request failed.'}
        </Alert>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Search and filter</Typography>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ md: 'center' }}
            >
              <TextField
                label="Search code, name or location"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ flexGrow: 1 }}
              />
              <TextField
                select
                label="Project"
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                sx={{ minWidth: 260 }}
              >
                <MenuItem value="">All accessible Warehouses</MenuItem>
                {(projects.data?.data ?? []).map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.projectCode} — {project.projectName}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeInactive}
                    onChange={(event) =>
                      setIncludeInactive(event.target.checked)
                    }
                  />
                }
                label="Include archived"
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Warehouse register</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {(warehouses.data?.data ?? []).map((row) => (
                <Chip
                  key={row.id}
                  label={
                    row.warehouseCode +
                    ' · ' +
                    row.warehouseName +
                    (row.project
                      ? ' · ' + row.project.projectCode
                      : ' · GENERAL') +
                    (row.isSiteWarehouse ? ' · SITE' : '') +
                    (row.isActive ? '' : ' · ARCHIVED')
                  }
                  color={selectedId === row.id ? 'primary' : 'default'}
                  variant={selectedId === row.id ? 'filled' : 'outlined'}
                  onClick={() => {
                    setNewMode(false);
                    setSelectedId(row.id);
                  }}
                />
              ))}
            </Stack>

            {warehouses.isSuccess &&
            (warehouses.data?.data.length ?? 0) === 0 ? (
              <Alert severity="info">
                No Warehouse matches the selected filters.
              </Alert>
            ) : null}

            {(newMode || selected) &&
            (newMode ? canCreate : canEdit) ? (
              <>
                <Divider />
                <Typography variant="subtitle1">
                  {newMode ? 'Create Warehouse' : 'Edit Warehouse'}
                </Typography>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                >
                  <TextField
                    label="Warehouse code"
                    value={warehouseCode}
                    onChange={(event) =>
                      setWarehouseCode(event.target.value)
                    }
                  />
                  <TextField
                    label="Warehouse name"
                    value={warehouseName}
                    onChange={(event) =>
                      setWarehouseName(event.target.value)
                    }
                    sx={{ flexGrow: 1 }}
                  />
                </Stack>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                >
                  <TextField
                    select
                    label="Project ownership"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    disabled={
                      Boolean(selected) && !canAccessAllProjects
                    }
                    sx={{ minWidth: 300, flexGrow: 1 }}
                  >
                    <MenuItem value="">General Company Warehouse</MenuItem>
                    {(projects.data?.data ?? []).map((project) => (
                      <MenuItem key={project.id} value={project.id}>
                        {project.projectCode} — {project.projectName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    sx={{ flexGrow: 1 }}
                  />
                </Stack>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isSiteWarehouse}
                      onChange={(event) =>
                        setIsSiteWarehouse(event.target.checked)
                      }
                    />
                  }
                  label="Site Warehouse"
                />
                {isSiteWarehouse && !projectId ? (
                  <Alert severity="warning">
                    A Site Warehouse must belong to a Project.
                  </Alert>
                ) : null}
                <Button
                  variant="contained"
                  disabled={
                    !warehouseCode.trim() ||
                    !warehouseName.trim() ||
                    (isSiteWarehouse && !projectId) ||
                    saveMutation.isPending
                  }
                  onClick={() => saveMutation.mutate()}
                >
                  {newMode ? 'Create Warehouse' : 'Save Warehouse'}
                </Button>
              </>
            ) : null}

            {selected ? (
              <>
                <Divider />
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                >
                  <Typography sx={{ flexGrow: 1 }}>
                    {selected.project
                      ? selected.project.projectCode +
                        ' — ' +
                        selected.project.projectName
                      : 'General Company Warehouse'}
                    {selected.location
                      ? ' · ' + selected.location
                      : ''}
                  </Typography>
                  {canArchive ? (
                    <Button
                      color={selected.isActive ? 'warning' : 'primary'}
                      onClick={() =>
                        lifecycleMutation.mutate({
                          id: selected.id,
                          isActive: selected.isActive,
                        })
                      }
                      disabled={lifecycleMutation.isPending}
                    >
                      {selected.isActive ? 'Archive' : 'Reactivate'}
                    </Button>
                  ) : null}
                </Stack>
              </>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
