import { FormEvent, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';

export function StatusesPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'statuses'],
    queryFn: adminApi.statuses,
  });
  const [entityType, setEntityType] = useState('PROJECT');
  const [statusCode, setStatusCode] = useState('');
  const [statusLabel, setStatusLabel] = useState('');

  const create = useMutation({
    mutationFn: () =>
      adminApi.createStatus({
        entityType,
        statusCode,
        statusLabel,
        sortOrder: (query.data?.data.length ?? 0) + 1,
      }),
    onSuccess: async () => {
      setStatusCode('');
      setStatusLabel('');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'statuses'] });
    },
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      adminApi.updateStatus(input.id, { isActive: input.isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'statuses'] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={submit}>
            <Typography variant="h6">Add Status</Typography>
            {create.isError ? (
              <Alert severity="error">Unable to create status.</Alert>
            ) : null}
            <TextField
              label="Entity Type"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              helperText="Example: PROJECT"
              required
            />
            <TextField
              label="Status Code"
              value={statusCode}
              onChange={(event) => setStatusCode(event.target.value)}
              helperText="Example: ACTIVE"
              required
            />
            <TextField
              label="Status Label"
              value={statusLabel}
              onChange={(event) => setStatusLabel(event.target.value)}
              helperText="Example: Active"
              required
            />
            <Button type="submit" variant="contained" disabled={create.isPending}>
              Add Status
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={1}>
        {(query.data?.data ?? []).map((status) => (
          <Card key={status.id} variant="outlined">
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
              >
                <div>
                  <Typography fontWeight={600}>
                    {status.entityType} · {status.statusCode}
                  </Typography>
                  <Typography color="text.secondary">
                    {status.statusLabel} · {status.isActive ? 'Active' : 'Inactive'}
                  </Typography>
                </div>
                <Button
                  size="small"
                  onClick={() =>
                    toggle.mutate({
                      id: status.id,
                      isActive: !status.isActive,
                    })
                  }
                >
                  {status.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
