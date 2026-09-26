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

import {
  ActivityTypeRecord,
  schedulingApi,
} from '../api/scheduling';

export function ActivityTypesPanel({
  canManage,
}: {
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [active, setActive] = useState('all');
  const [selected, setSelected] = useState<ActivityTypeRecord | null>(null);
  const [form, setForm] = useState({
    activityTypeCode: '',
    activityTypeName: '',
  });

  const query = useQuery({
    queryKey: ['schedule', 'activity-types', active],
    queryFn: () => schedulingApi.activityTypes(active),
    enabled: canManage,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['schedule', 'activity-types'] });

  const save = useMutation({
    mutationFn: () =>
      selected
        ? schedulingApi.updateActivityType(selected.id, form)
        : schedulingApi.createActivityType(form),
    onSuccess: async () => {
      setSelected(null);
      setForm({ activityTypeCode: '', activityTypeName: '' });
      await refresh();
    },
  });

  const toggle = useMutation({
    mutationFn: (row: ActivityTypeRecord) =>
      schedulingApi.setActivityTypeActive(row.id, !row.isActive),
    onSuccess: refresh,
  });

  if (!canManage) return null;

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Activity Types</Typography>
      <TextField
        select
        label="Status"
        value={active}
        onChange={(event) => setActive(event.target.value)}
        sx={{ maxWidth: 220 }}
      >
        <MenuItem value="all">All</MenuItem>
        <MenuItem value="true">Active</MenuItem>
        <MenuItem value="false">Inactive</MenuItem>
      </TextField>

      {query.isError ? (
        <Alert severity="error">Unable to load Activity Types.</Alert>
      ) : null}

      {(query.data?.data ?? []).map((row) => (
        <Card key={row.id} variant="outlined">
          <CardContent>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              spacing={2}
            >
              <div>
                <Typography fontWeight={600}>
                  {row.activityTypeCode} · {row.activityTypeName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {row.isActive ? 'Active' : 'Inactive'}
                </Typography>
              </div>
              <Stack direction="row" spacing={1}>
                <Button
                  onClick={() => {
                    setSelected(row);
                    setForm({
                      activityTypeCode: row.activityTypeCode,
                      activityTypeName: row.activityTypeName,
                    });
                  }}
                >
                  Edit
                </Button>
                <Button onClick={() => toggle.mutate(row)}>
                  {row.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Stack
        component="form"
        spacing={2}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Typography>{selected ? 'Edit Activity Type' : 'Add Activity Type'}</Typography>
        <TextField
          label="Activity Type Code"
          value={form.activityTypeCode}
          onChange={(event) =>
            setForm({ ...form, activityTypeCode: event.target.value })
          }
          required
        />
        <TextField
          label="Activity Type Name"
          value={form.activityTypeName}
          onChange={(event) =>
            setForm({ ...form, activityTypeName: event.target.value })
          }
          required
        />
        <Stack direction="row" spacing={1}>
          <Button type="submit" variant="contained" disabled={save.isPending}>
            Save Activity Type
          </Button>
          {selected ? (
            <Button
              onClick={() => {
                setSelected(null);
                setForm({ activityTypeCode: '', activityTypeName: '' });
              }}
            >
              Cancel
            </Button>
          ) : null}
        </Stack>
        {save.isError ? (
          <Alert severity="error">Unable to save Activity Type.</Alert>
        ) : null}
      </Stack>
    </Stack>
  );
}
