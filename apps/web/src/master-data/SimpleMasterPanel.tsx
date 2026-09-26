import { FormEvent, useState } from 'react';
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

import { MasterRecord } from '../api/master-data';

export type MasterField = {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'email' | 'number' | 'multiline';
  helperText?: string;
};

type ListResult = { data: MasterRecord[] };

type Props = {
  title: string;
  singular: string;
  queryKey: string;
  codeField: string;
  nameField: string;
  fields: MasterField[];
  canManage: boolean;
  list: (search: string, active: string) => Promise<ListResult>;
  create: (body: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, body: Record<string, unknown>) => Promise<unknown>;
};

function initialValues(fields: MasterField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, '']));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

export function SimpleMasterPanel({
  title,
  singular,
  queryKey,
  codeField,
  nameField,
  fields,
  canManage,
  list,
  create,
  update,
}: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(
    initialValues(fields),
  );

  const query = useQuery({
    queryKey: ['master-data', queryKey, search, active],
    queryFn: () => list(search, active),
  });

  function resetForm() {
    setEditingId(null);
    setValues(initialValues(fields));
  }

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      for (const field of fields) {
        const raw = values[field.key]?.trim() ?? '';
        if (field.type === 'number') {
          if (raw !== '') body[field.key] = Number(raw);
          continue;
        }

        if (raw !== '') {
          body[field.key] = raw;
        } else if (editingId && !field.required) {
          body[field.key] = null;
        }
      }

      if (editingId) return update(editingId, body);
      return create(body);
    },
    onSuccess: async () => {
      resetForm();
      await queryClient.invalidateQueries({
        queryKey: ['master-data', queryKey],
      });
    },
  });

  const toggle = useMutation({
    mutationFn: (record: MasterRecord) =>
      update(record.id, { isActive: !record.isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['master-data', queryKey],
      });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  function edit(record: MasterRecord) {
    setEditingId(record.id);
    setValues(
      Object.fromEntries(
        fields.map((field) => [
          field.key,
          record[field.key] === null || record[field.key] === undefined
            ? ''
            : String(record[field.key]),
        ]),
      ),
    );
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">{title}</Typography>
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
                {editingId ? 'Edit ' + singular : 'Create ' + singular}
              </Typography>

              {save.isError ? (
                <Alert severity="error">{errorMessage(save.error)}</Alert>
              ) : null}

              {fields.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  type={
                    field.type === 'number'
                      ? 'number'
                      : field.type === 'email'
                        ? 'email'
                        : 'text'
                  }
                  value={values[field.key] ?? ''}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  required={field.required}
                  helperText={field.helperText}
                  multiline={field.type === 'multiline'}
                  minRows={field.type === 'multiline' ? 3 : undefined}
                  fullWidth
                />
              ))}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={save.isPending}
                >
                  {editingId ? 'Save Changes' : 'Create ' + singular}
                </Button>
                {editingId ? (
                  <Button onClick={resetForm}>Cancel</Button>
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          You have view access only. A manage permission is required to change
          {' ' + title + '.'}
        </Alert>
      )}

      {toggle.isError ? (
        <Alert severity="warning">{errorMessage(toggle.error)}</Alert>
      ) : null}

      <Stack spacing={1}>
        {(query.data?.data ?? []).map((record) => (
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
                    {String(record[codeField] ?? '')} —{' '}
                    {String(record[nameField] ?? '')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {record.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                  {fields
                    .filter(
                      (field) =>
                        field.key !== codeField &&
                        field.key !== nameField &&
                        record[field.key] !== null &&
                        record[field.key] !== undefined &&
                        String(record[field.key]).trim() !== '',
                    )
                    .map((field) => (
                      <Typography
                        key={field.key}
                        variant="body2"
                        color="text.secondary"
                      >
                        {field.label}: {String(record[field.key])}
                      </Typography>
                    ))}
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

        {!query.isPending && (query.data?.data.length ?? 0) === 0 ? (
          <Alert severity="info">No matching {title.toLowerCase()} found.</Alert>
        ) : null}
      </Stack>
    </Stack>
  );
}
