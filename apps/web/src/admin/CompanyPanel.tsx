import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/admin';

export function CompanyPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'company'],
    queryFn: adminApi.company,
  });
  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [baseCurrencyCode, setBaseCurrencyCode] = useState('THB');

  useEffect(() => {
    if (!query.data) return;
    setCompanyCode(query.data.data.companyCode);
    setCompanyName(query.data.data.companyName);
    setBaseCurrencyCode(query.data.data.baseCurrencyCode);
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (setThb: boolean) =>
      adminApi.updateCompany({
        companyCode,
        companyName,
        ...(setThb ? { baseCurrencyCode: 'THB' } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'company'] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(false);
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack component="form" spacing={2} onSubmit={submit}>
          <Typography variant="h6">Company Settings</Typography>
          {mutation.isSuccess ? (
            <Alert severity="success">Company settings saved.</Alert>
          ) : null}
          {mutation.isError ? (
            <Alert severity="error">Unable to save company settings.</Alert>
          ) : null}
          <TextField
            label="Company Code"
            value={companyCode}
            onChange={(event) => setCompanyCode(event.target.value)}
            required
          />
          <TextField
            label="Company Name"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            required
          />
          <TextField
            label="Base Currency"
            value={baseCurrencyCode}
            slotProps={{ input: { readOnly: true } }}
            helperText="Thai baht (THB) is the operating currency. Existing records retain their source currency."
            required
          />
          {baseCurrencyCode !== 'THB' && <Alert severity="warning">
            New monetary activity is blocked until this Company deliberately uses THB. Historical records will keep their original currency.
            <Button disabled={mutation.isPending || !query.data} onClick={() => mutation.mutate(true)}>Set operating currency to THB</Button>
          </Alert>}
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            Save Company Settings
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
