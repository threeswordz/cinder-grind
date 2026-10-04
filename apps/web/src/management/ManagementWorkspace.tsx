import { Stack, Tab, Tabs } from '@mui/material';
import { useState } from 'react';

import { ExecutivePortfolioDashboard } from './ExecutivePortfolioDashboard';
import { ManagementDashboards } from './ManagementDashboards';

type Mode = 'executive' | 'projects';

export function ManagementWorkspace({
  permissions,
}: {
  permissions: string[];
}) {
  const canPortfolio = permissions.includes('management.portfolio.view');
  const canProjects = permissions.includes('management.dashboard.view');
  const [mode, setMode] = useState<Mode>(
    canPortfolio ? 'executive' : 'projects',
  );

  if (canPortfolio && !canProjects) return <ExecutivePortfolioDashboard />;
  if (!canPortfolio && canProjects) {
    return <ManagementDashboards permissions={permissions} />;
  }

  return (
    <Stack spacing={3}>
      <Tabs
        value={mode}
        onChange={(_event, value: Mode) => setMode(value)}
      >
        <Tab value="executive" label="Executive" />
        <Tab value="projects" label="Project Dashboards" />
      </Tabs>
      {mode === 'executive' ? (
        <ExecutivePortfolioDashboard />
      ) : (
        <ManagementDashboards permissions={permissions} />
      )}
    </Stack>
  );
}
