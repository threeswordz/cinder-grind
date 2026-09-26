import { FormEvent, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { login } from './api/auth';

export function LoginScreen() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: async () => {
      setPassword('');
      await queryClient.invalidateQueries({ queryKey: ['current-user'] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Card variant="outlined">
          <CardContent>
            <Stack component="form" spacing={3} onSubmit={submit}>
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  Construction ERP
                </Typography>
                <Typography color="text.secondary">
                  Sign in to the V0.1 Administration console.
                </Typography>
              </Box>

              {mutation.isError ? (
                <Alert severity="error">
                  Sign-in failed. Check your email/password and try again.
                </Alert>
              ) : null}

              <TextField
                label="Email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                fullWidth
              />

              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                fullWidth
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
