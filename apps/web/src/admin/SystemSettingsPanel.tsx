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

export function SystemSettingsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'system-settings'],
    queryFn: adminApi.systemSettings,
  });
  const [key, setKey] = useState('');
  const [jsonValue, setJsonValue] = useState('true');
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { key: string; value: unknown }) =>
      adminApi.setSystemSetting(input.key, input.value),
    onSuccess: async () => {
      setKey('');
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'system-settings'],
      });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setLocalError(null);
      mutation.mutate({ key, value: JSON.parse(jsonValue) as unknown });
    } catch {
      setLocalError('Setting Value must be valid JSON.');
    }
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={submit}>
            <Typography variant="h6">System Setting</Typography>
            <Alert severity="info">
              Secrets, passwords, API keys and tokens are intentionally blocked
              from this configuration store.
            </Alert>
            {localError ? <Alert severity="error">{localError}</Alert> : null}
            {mutation.isError ? (
              <Alert severity="error">Unable to save setting.</Alert>
            ) : null}
            <TextField
              label="Setting Key"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              helperText="Example: ui.default_page_size"
              required
            />
            <TextField
              label="Setting Value (JSON)"
              value={jsonValue}
              onChange={(event) => setJsonValue(event.target.value)}
              multiline
              minRows={3}
              required
            />
            <Button type="submit" variant="contained" disabled={mutation.isPending}>
              Save Setting
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {(query.data?.data ?? []).map((setting) => (
        <Card key={setting.id} variant="outlined">
          <CardContent>
            <Typography fontWeight={600}>{setting.settingKey}</Typography>
            <Typography
              component="pre"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {JSON.stringify(setting.settingValue, null, 2)}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
