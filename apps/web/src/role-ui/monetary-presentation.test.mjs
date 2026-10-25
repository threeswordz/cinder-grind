import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('THB policy and unverified historical currency remain truthful in EN/TH/Traditional Chinese', async () => {
  const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { MonetaryLocaleContext, CurrencyLabel, MonetaryPolicyNotice } = await vite.ssrLoadModule('/src/role-ui/monetary-presentation.tsx');
    for (const [locale, unknown] of [['en','Currency unverified'],['th','ยังไม่ยืนยันสกุลเงิน'],['zh-TW','幣別未確認']]) {
      const render = (child) => renderToStaticMarkup(React.createElement(MonetaryLocaleContext.Provider, { value: locale }, child));
      assert.match(render(React.createElement(CurrencyLabel, { code: null })), new RegExp(unknown));
      assert.match(render(React.createElement(CurrencyLabel, { code: 'SGD' })), />SGD</);
      assert.match(render(React.createElement(CurrencyLabel, { code: 'THB' })), />THB</);
      assert.match(render(React.createElement(MonetaryPolicyNotice)), /THB/);
    }
  } finally { await vite.close(); }
});
