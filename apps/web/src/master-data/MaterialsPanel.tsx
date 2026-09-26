import { FormEvent, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  MaterialRecord,
  masterDataApi,
} from '../api/master-data';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

export function MaterialsPanel({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [materialCode, setMaterialCode] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [description, setDescription] = useState('');
  const [materialCategory, setMaterialCategory] = useState('');
  const [defaultUomId, setDefaultUomId] = useState('');

  const materialsQuery = useQuery({
    queryKey: ['master-data', 'materials', search, active],
    queryFn: () => masterDataApi.materials(search, active),
  });

  const uomsQuery = useQuery({
    queryKey: ['master-data', 'material-uom-options'],
    queryFn: masterDataApi.materialUomOptions,
    enabled: canManage,
  });

  useEffect(() => {
    if (
      canManage &&
      defaultUomId === '' &&
      (uomsQuery.data?.data.length ?? 0) > 0
    ) {
      setDefaultUomId(uomsQuery.data?.data[0]?.id ?? '');
    }
  }, [canManage, defaultUomId, uomsQuery.data]);

  function reset() {
    setEditingId(null);
    setMaterialCode('');
    setMaterialName('');
    setDescription('');
    setMaterialCategory('');
    setDefaultUomId(uomsQuery.data?.data[0]?.id ?? '');
  }

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        materialCode,
        materialName,
        defaultUomId,
      };

      if (description.trim()) body.description = description.trim();
      else if (editingId) body.description = null;

      if (materialCategory.trim()) {
        body.materialCategory = materialCategory.trim();
      } else if (editingId) {
        body.materialCategory = null;
      }

      return editingId
        ? masterDataApi.updateMaterial(editingId, body)
        : masterDataApi.createMaterial(body);
    },
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({
        queryKey: ['master-data', 'materials'],
      });
    },
  });

  const toggle = useMutation({
    mutationFn: (record: MaterialRecord) =>
      masterDataApi.updateMaterial(record.id, {
        isActive: !record.isActive,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['master-data', 'materials'],
      });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  function edit(record: MaterialRecord) {
    setEditingId(record.id);
    setMaterialCode(record.materialCode);
    setMaterialName(record.materialName);
    setDescription(record.description ?? '');
    setMaterialCategory(record.materialCategory ?? '');
    setDefaultUomId(record.defaultUomId);
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Materials</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                fullWidth
              />
              <TextField
                select
                label="Status"
                value={active}
                onChange={(event) => setActive(event.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="true">Active</MenuItem>
                <MenuItem value="false">Inactive</MenuItem>
              </TextField>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {canManage ? (
        <Card variant="outlined">
          <CardContent>
            <Stack component="form" spacing={2} onSubmit={submit}>
              <Typography variant="h6">
                {editingId ? 'Edit Material' : 'Create Material'}
              </Typography>

              {save.isError ? (
                <Alert severity="error">{message(save.error)}</Alert>
              ) : null}

              {(uomsQuery.data?.data.length ?? 0) === 0 ? (
                <Alert severity="warning">
                  Create an active Unit of Measure before creating Materials.
                </Alert>
              ) : null}

              <TextField
                label="Material Code"
                value={materialCode}
                onChange={(event) => setMaterialCode(event.target.value)}
                required
              />
              <TextField
                label="Material Name"
                value={materialName}
                onChange={(event) => setMaterialName(event.target.value)}
                required
              />
              <TextField
                label="Category"
                value={materialCategory}
                onChange={(event) => setMaterialCategory(event.target.value)}
              />
              <TextField
                select
                label="Default UOM"
                value={defaultUomId}
                onChange={(event) => setDefaultUomId(event.target.value)}
                required
              >
                {(uomsQuery.data?.data ?? []).map((uom) => (
                  <MenuItem key={uom.id} value={uom.id}>
                    {uom.uomCode} — {uom.uomName}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                multiline
                minRows={3}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={
                    save.isPending ||
                    !defaultUomId ||
                    (uomsQuery.data?.data.length ?? 0) === 0
                  }
                >
                  {editingId ? 'Save Changes' : 'Create Material'}
                </Button>
                {editingId ? <Button onClick={reset}>Cancel</Button> : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          You have view access only. Material management permission is required
          to change records.
        </Alert>
      )}

      {toggle.isError ? (
        <Alert severity="warning">{message(toggle.error)}</Alert>
      ) : null}

      <Stack spacing={1}>
        {(materialsQuery.data?.data ?? []).map((record) => (
          <Card key={record.id} variant="outlined">
            <CardContent>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ md: 'center' }}
              >
                <Stack spacing={0.5}>
                  <Typography fontWeight={600}>
                    {record.materialCode} — {record.materialName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {record.isActive ? 'Active' : 'Inactive'} · Default UOM:{' '}
                    {record.defaultUom.uomCode}
                  </Typography>
                  {record.materialCategory ? (
                    <Typography variant="body2" color="text.secondary">
                      Category: {record.materialCategory}
                    </Typography>
                  ) : null}
                  {record.description ? (
                    <Typography variant="body2" color="text.secondary">
                      {record.description}
                    </Typography>
                  ) : null}
                </Stack>

                {canManage ? (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => edit(record)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color={record.isActive ? 'warning' : 'success'}
                      onClick={() => toggle.mutate(record)}
                      disabled={toggle.isPending}
                    >
                      {record.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </Stack>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ))}

        {!materialsQuery.isPending &&
        (materialsQuery.data?.data.length ?? 0) === 0 ? (
          <Alert severity="info">No matching materials found.</Alert>
        ) : null}
      </Stack>
    </Stack>
  );
}
