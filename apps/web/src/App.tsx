import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { fetchHealth } from './api/health';

export default function App() {
  const healthQuery = useQuery({
    queryKey: ['api-health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  const connected = healthQuery.data?.status === 'ok';

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 6 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h3" component="h1" gutterBottom>
              Construction ERP
            </Typography>
            <Typography color="text.secondary">
              V0.1 Foundation — Technical Skeleton
            </Typography>
          </Box>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">System status</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography>API / PostgreSQL</Typography>
                  <Chip
                    size="small"
                    label={
                      healthQuery.isPending
                        ? 'Checking'
                        : connected
                          ? 'Connected'
                          : 'Unavailable'
                    }
                    color={connected ? 'success' : 'default'}
                  />
                </Stack>

                {healthQuery.isError ? (
                  <Alert severity="warning">
                    The frontend is running, but it cannot reach the API and
                    PostgreSQL yet. Start the local database and API, then refresh.
                  </Alert>
                ) : null}

                {healthQuery.data ? (
                  <Typography variant="body2" color="text.secondary">
                    Last API health timestamp: {healthQuery.data.timestamp}
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Alert severity="info">
            Business modules are intentionally not implemented in this stage.
            Authentication, roles, projects, WBS and master data are built after
            the technical skeleton passes validation.
          </Alert>
        </Stack>
      </Box>
    </Container>
  );
}
