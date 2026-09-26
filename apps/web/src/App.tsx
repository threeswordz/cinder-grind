import { Alert, Box, CircularProgress, Container } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { fetchCurrentUser } from './api/auth';
import { ApiError } from './api/client';
import { AdminConsole } from './AdminConsole';
import { LoginScreen } from './LoginScreen';

export default function App() {
  const authQuery = useQuery({
    queryKey: ['current-user'],
    queryFn: fetchCurrentUser,
    retry: false,
  });

  if (authQuery.isPending) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            minHeight: '60vh',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (authQuery.isError) {
    if (
      authQuery.error instanceof ApiError &&
      authQuery.error.status === 401
    ) {
      return <LoginScreen />;
    }

    return (
      <Container maxWidth="sm">
        <Box sx={{ py: 8 }}>
          <Alert severity="error">
            The ERP API could not be reached or returned an unexpected error.
          </Alert>
        </Box>
      </Container>
    );
  }

  return <AdminConsole user={authQuery.data} />;
}
