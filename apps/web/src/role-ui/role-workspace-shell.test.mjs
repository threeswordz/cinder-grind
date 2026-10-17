import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { createServer } from 'vite';

// Component-level server render: production TSX through Vite, no new test dependencies.
// Browser click/focus/touch UAT remains separate and must not be inferred from SSR.
test('responsive V1.1 role shell renders only supplied authorized modules', async (t) => {
  const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { RoleWorkspaceShell } = await vite.ssrLoadModule('/src/role-ui/RoleWorkspaceShell.tsx');
    const user = {
      id: 'user-A', companyId: 'company-A', email: 'a@example.test', displayName: 'Test User',
      roleCodes: ['STORE_STAFF'], permissions: ['procurement.pr.view'],
    };
    const render = (mobile, sections, renderUser = user) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const theme = createTheme({
        components: { MuiUseMediaQuery: { defaultProps: { ssrMatchMedia: () => ({ matches: mobile }) } } },
      });
      return renderToStaticMarkup(
        React.createElement(QueryClientProvider, { client },
          React.createElement(ThemeProvider, { theme },
            React.createElement(RoleWorkspaceShell, {
              user: renderUser, sections, activeKey: sections[0]?.key ?? null,
              onSelect: () => {}, onOpenPr: () => {}, onLogout: () => {}, logoutPending: false,
            }),
          ),
        ),
      );
    };
    const permitted = [{
      key: 'purchase-requests', label: 'Purchase Requests',
      content: React.createElement('span', null, 'Canonical source panel'),
    }];

    await t.test('desktop Home shows source module and assigned role, without role switching', () => {
      const html = render(false, permitted);
      assert.match(html, /Purchase Requests/);
      assert.match(html, /STORE_STAFF/);
      assert.match(html, /My Work/);
      assert.match(html, /<nav[^>]*id="v11-primary-navigation"/);
      assert.match(html, /aria-label="Main navigation"/);
      assert.doesNotMatch(html, /<nav[^>]*lang="en"/);
      assert.doesNotMatch(html, /<header[^>]*lang="en"/);
      assert.match(html, /<span lang="en">Welcome<\/span>/);
      assert.match(html, /<span lang="en">Home<\/span>/);
      assert.match(html, /STORE_STAFF/);
      assert.match(html, /aria-current="page"/);
      assert.doesNotMatch(html, /Close menu/);
      assert.doesNotMatch(html, /Switch Role|Impersonat/);
      assert.doesNotMatch(html, /Approval Matrix/);
    });

    await t.test('mobile has responsive menu trigger and retains authorized shortcut', () => {
      const html = render(true, permitted);
      assert.match(html, /aria-label="Menu"/);
      assert.match(html, /aria-controls="v11-primary-navigation"/);
      assert.match(html, /aria-expanded="false"/);
      assert.match(html, /Purchase Requests/);
    });

    await t.test('very long source-backed identity and labels retain their exact text in responsive shell', () => {
      const longName = 'จ'.repeat(96) + '請'.repeat(96);
      const html = render(true, [{
        key: 'purchase-requests', label: 'Purchase Requests',
        content: React.createElement('span', null, 'Canonical source panel'),
      }], { ...user, displayName: longName });
      assert.match(html, /lang="en"/);
      assert.match(html, /aria-controls="v11-primary-navigation"/);
      // Server rendering covers text preservation, not browser layout/overflow behavior.
      assert.ok(html.includes('จ'.repeat(96)));
      assert.doesNotMatch(html, /Switch Role|Impersonat/);
    });

    await t.test('no module permission means no module card/nav disclosure', () => {
      const html = render(false, []);
      assert.match(html, /No application modules are available/);
      assert.match(html, /role="status"/);
      assert.doesNotMatch(html, /Purchase Requests/);
      assert.match(html, /aria-label="Main navigation"/);
      assert.match(html, /aria-current="page"/);
      assert.doesNotMatch(html, /Approval Matrix|Switch Role|Impersonat/);
    });
  } finally {
    await vite.close();
  }
});
