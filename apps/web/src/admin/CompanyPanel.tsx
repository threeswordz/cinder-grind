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
  const [baseCurrencyCode, setBaseCurrencyCode] = useState('SGD');

  useEffect(() => {
    if (!query.data) return;
    setCompanyCode(query.data.data.companyCode);
    setCompanyName(query.data.data.companyName);
    setBaseCurrencyCode(query.data.data.baseCurrencyCode);
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () =>
      adminApi.updateCompany({
        companyCode,
        companyName,
        baseCurrencyCode,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'company'] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
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
            onChange={(event) => setBaseCurrencyCode(event.target.value)}
            helperText="Three-letter currency code, e.g. SGD or THB."
            required
          />
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            Save Company Settings
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
