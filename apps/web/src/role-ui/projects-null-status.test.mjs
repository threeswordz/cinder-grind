import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createServer } from 'vite';

test('Projects list renders populated synthetic projects without status definitions', async () => {
  const vite = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const { ProjectsPanel } = await vite.ssrLoadModule('/src/projects/ProjectsPanel.tsx');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const baseProject = {
      id: 'site-a',
      projectCode: 'SITE_A',
      projectName: 'Synthetic SITE_A',
      customer: { id: 'customer-a', customerCode: 'CUST_A', customerName: 'Synthetic customer', isActive: true },
      statusDefinition: null,
      contractCurrencyCode: 'THB',
      contractValue: '0.00',
      location: null,
      description: null,
      plannedStartDate: '2026-01-01T00:00:00.000Z',
      plannedCompletionDate: '2027-12-31T00:00:00.000Z',
      actualStartDate: null,
      actualCompletionDate: null,
      isActive: true,
    };
    queryClient.setQueryData(['projects', '', 'all'], {
      data: [
        baseProject,
        { ...baseProject, id: 'site-b', projectCode: 'SITE_B', projectName: 'Synthetic SITE_B' },
        { ...baseProject, id: 'site-c', projectCode: 'SITE_C', projectName: 'With status',
          statusDefinition: { id: 'status-a', statusCode: 'ACTIVE', statusLabel: 'In Progress', isActive: true } },
      ],
    });
    const output = renderToStaticMarkup(
      React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(ProjectsPanel, { permissions: ['projects.project.view'] })),
    );
    assert.match(output, /SITE_A/);
    assert.match(output, /SITE_B/);
    assert.match(output, /Status not assigned/);
    assert.match(output, /In Progress/);
    assert.match(output, /Synthetic customer/);
  } finally {
    await vite.close();
  }
});
