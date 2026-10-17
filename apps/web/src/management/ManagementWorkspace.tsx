import { Stack, Tab, Tabs } from '@mui/material';
import { useEffect, useState } from 'react';

import type { SourceLinkTarget } from '../role-ui/source-link-policy';
import { ExecutivePortfolioDashboard } from './ExecutivePortfolioDashboard';
import { ManagementDashboards } from './ManagementDashboards';
import { ManagementReports } from './ManagementReports';

type Mode = 'executive' | 'projects' | 'reports';

export function ManagementWorkspace({
  permissions,
  initialProjectId,
  onOpenSource,
}: {
  permissions: string[];
  initialProjectId?: string | undefined;
  onOpenSource?: ((target: SourceLinkTarget) => void) | undefined;
}) {
  const canPortfolio = permissions.includes('management.portfolio.view');
  const canProjects = permissions.includes('management.dashboard.view');
  const [mode, setMode] = useState<Mode>(
    canPortfolio ? 'executive' : 'projects',
  );

  useEffect(() => {
    if (initialProjectId && canProjects) setMode('projects');
  }, [canProjects, initialProjectId]);

  if (canPortfolio && !canProjects) return <ExecutivePortfolioDashboard />;

  return (
    <Stack spacing={3}>
      <Tabs
        value={mode}
        onChange={(_event, value: Mode) => setMode(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        {canPortfolio ? <Tab value="executive" label="Executive" /> : null}
        {canProjects ? (
          <Tab value="projects" label="Project & Domain Dashboards" />
        ) : null}
        {canProjects ? <Tab value="reports" label="Reports & Export" /> : null}
      </Tabs>
      {mode === 'executive' && canPortfolio ? (
        <ExecutivePortfolioDashboard />
      ) : null}
      {mode === 'projects' && canProjects ? (
        <ManagementDashboards
          permissions={permissions}
          initialProjectId={initialProjectId}
          onOpenSource={onOpenSource}
        />
      ) : null}
      {mode === 'reports' && canProjects ? (
        <ManagementReports permissions={permissions} />
      ) : null}
    </Stack>
  );
}
