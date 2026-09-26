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

import { adminApi } from '../api/admin';

export function NumberingPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'number-sequences'],
    queryFn: adminApi.numberSequences,
  });
  const [entityType, setEntityType] = useState('PURCHASE_ORDER');
  const [sequenceCode, setSequenceCode] = useState('');
  const [formatTemplate, setFormatTemplate] = useState('POYYMM-###');
  const [resetRule, setResetRule] = useState('MONTHLY');
  const [startingValue, setStartingValue] = useState('1');

  const mutation = useMutation({
    mutationFn: () =>
      adminApi.createNumberSequence({
        entityType,
        sequenceCode,
        formatTemplate,
        resetRule,
        startingValue: Number(startingValue),
      }),
    onSuccess: async () => {
      setSequenceCode('');
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'number-sequences'],
      });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={submit}>
            <Typography variant="h6">Add Number Sequence</Typography>
            {mutation.isError ? (
              <Alert severity="error">Unable to create number sequence.</Alert>
            ) : null}
            <TextField
              label="Entity Type"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              required
            />
            <TextField
              label="Sequence Code"
              value={sequenceCode}
              onChange={(event) => setSequenceCode(event.target.value)}
              helperText="Example: PO_DEFAULT"
              required
            />
            <TextField
              label="Format Template"
              value={formatTemplate}
              onChange={(event) => setFormatTemplate(event.target.value)}
              helperText="Example: POYYMM-### → PO2604-004"
              required
            />
            <TextField
              select
              label="Reset Rule"
              value={resetRule}
              onChange={(event) => setResetRule(event.target.value)}
            >
              <MenuItem value="NONE">Never</MenuItem>
              <MenuItem value="YEARLY">Yearly</MenuItem>
              <MenuItem value="MONTHLY">Monthly</MenuItem>
            </TextField>
            <TextField
              label="Starting Value"
              type="number"
              value={startingValue}
              onChange={(event) => setStartingValue(event.target.value)}
              inputProps={{ min: 1 }}
              required
            />
            <Button type="submit" variant="contained" disabled={mutation.isPending}>
              Add Sequence
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {(query.data?.data ?? []).map((sequence) => (
        <Card key={sequence.id} variant="outlined">
          <CardContent>
            <Typography fontWeight={600}>
              {sequence.sequenceCode} — {sequence.formatTemplate}
            </Typography>
            <Typography color="text.secondary">
              {sequence.entityType} · {sequence.resetRule} · next value {sequence.nextValue}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
