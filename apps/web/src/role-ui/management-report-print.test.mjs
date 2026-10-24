import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// Real ManagementPrintDocument TSX is loaded through Vite. SSR verifies content,
// not the browser's print pagination; owner Mac preview remains an explicit UAT gate.
test('Management Print View uses only the authorized report and print-only layout', async (t) => {
  const vite = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const { ManagementPrintDocument } = await vite.ssrLoadModule(
      '/src/management/ManagementPrintDocument.tsx',
    );
    const rows = Array.from({ length: 10 }, (_, i) => ({
      domain: 'COST',
      metric: 'COST_METRIC_' + i,
      label: i === 0 ? 'Original budget <private>' : 'Metric ' + i,
      status: 'AVAILABLE',
      value: i === 0 ? '1000' : '0',
      unit: 'MONEY',
      currencyCode: 'THB',
      canonicalSource: 'V0.7 Cost Control',
      sourceViewAvailable: false,
      sourceApiPath: '/internal/never-print-this-api-path',
    }));
    const report = {
      contractVersion: 'V0.8-E',
      project: { id: 'project-test', projectCode: 'UAT-E2-J3-THB-001', projectName: 'Budget & Cost Test' },
      asOfDate: '2026-10-25',
      lookaheadDays: 14,
      baseCurrencyCode: 'THB',
      filters: {
        domain: 'COST',
        status: null,
        fromDate: null,
        toDate: null,
        wbs: null,
        costCode: null,
        wbsIncludesDescendants: false,
        dateRangeAppliedDomains: [],
      },
      rowCount: rows.length,
      rows,
    };
    const html = renderToStaticMarkup(
      React.createElement(ManagementPrintDocument, { report }),
    );

    await t.test('provides a print-only A4 landscape document outside the ERP shell', () => {
      assert.match(html, /id="erp-management-print-document"/);
      assert.match(html, /size: A4 landscape/);
      assert.match(html, /body #root \{ display: none !important; \}/);
      assert.match(html, /@media screen/);
      assert.match(html, /display: none !important/);
      assert.match(html, /table-layout: fixed/);
      assert.match(html, /break-inside: avoid/);
      assert.match(html, /display: table-header-group/);
    });

    await t.test('preserves all ten authorized COST rows and all five columns', () => {
      assert.match(html, /UAT-E2-J3-THB-001/);
      assert.match(html, /As of: 2026-10-25/);
      assert.match(html, /Domain: COST/);
      assert.match(html, /Currency: THB/);
      assert.match(html, /Rows: 10/);
      for (const heading of ['Domain', 'Metric', 'Status', 'Value', 'Source']) {
        assert.match(html, new RegExp('>' + heading + '<'));
      }
      assert.equal((html.match(/<tr>/g) ?? []).length, 11);
      assert.match(html, /THB 1000/);
      assert.match(html, /V0\.7 Cost Control/);
    });

    await t.test('escapes text and never prints underlying protected source URLs', () => {
      assert.match(html, /Original budget &lt;private&gt;/);
      assert.match(html, /Budget &amp; Cost Test/);
      assert.doesNotMatch(html, /never-print-this-api-path/);
      assert.doesNotMatch(html, /PRINT VIEW|SIGN OUT|Select Project|CSV export requires/);
    });

    await t.test('empty result and unknown currency keep truthful values', () => {
      const empty = renderToStaticMarkup(
        React.createElement(ManagementPrintDocument, {
          report: { ...report, rows: [], rowCount: 0, baseCurrencyCode: 'THB' },
        }),
      );
      assert.match(empty, /No report rows match the selected filters/);
      const unknown = renderToStaticMarkup(
        React.createElement(ManagementPrintDocument, {
          report: {
            ...report,
            rowCount: 1,
            rows: [{ ...rows[0], value: null, currencyCode: null }],
          },
        }),
      );
      assert.match(unknown, /Unavailable/);
      assert.doesNotMatch(unknown, /THB 1000/);
    });
  } finally {
    await vite.close();
  }
});
