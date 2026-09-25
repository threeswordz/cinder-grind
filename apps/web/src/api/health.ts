import { z } from 'zod';

const healthSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('ok'),
  timestamp: z.string(),
});

export type HealthStatus = z.infer<typeof healthSchema>;

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch(`${apiBaseUrl}/health`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}.`);
  }

  return healthSchema.parse(await response.json());
}
