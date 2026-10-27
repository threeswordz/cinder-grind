import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('Budget presentation distinguishes absent, approved zero and partial baselines in all supported locales', async () => {
  const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { BudgetValue, BudgetBaselineNotice, BudgetBaselineMessage } = await vite.ssrLoadModule('/src/role-ui/budget-presentation.tsx');
    const { MonetaryLocaleContext } = await vite.ssrLoadModule('/src/role-ui/monetary-presentation.tsx');
    for (const [locale, missing, currentMessage] of [
      ['en', 'No approved Budget', 'Budget comparison and variance are unavailable'],
      ['th', 'ยังไม่มีงบประมาณที่อนุมัติ', 'เปรียบเทียบงบประมาณหรือแสดงผลต่างไม่ได้'],
      ['zh-TW', '尚無已核准預算', '無法比較預算或顯示差異'],
    ]) {
      const render = (component, props) => renderToStaticMarkup(React.createElement(MonetaryLocaleContext.Provider, { value: locale }, React.createElement(component, props)));
      const absent = render(BudgetValue, { available: false, value: '0', currency: 'THB' });
      assert.ok(absent.includes(missing));
      assert.ok(!absent.includes('THB 0'));
      const variance = render(BudgetValue, { available: false, value: '-1205', currency: 'THB' });
      assert.ok(!variance.includes('-1205'));
      assert.ok(render(BudgetValue, { available: true, value: '0', currency: 'THB' }).includes('THB 0'));
      assert.ok(render(BudgetValue, { available: true, value: '0.0000' }).includes('0.0000'));
      const notice = render(BudgetBaselineNotice, { baseline: { original: false, current: false } });
      assert.ok(notice.includes(currentMessage));
      assert.ok(notice.includes('role="alert"'));
      assert.equal(render(BudgetBaselineNotice, { baseline: { original: true, current: true } }), '');
      assert.notEqual(render(BudgetBaselineMessage, { baseline: { original: false, current: true } }), '');
      assert.notEqual(render(BudgetBaselineMessage, { baseline: { original: true, current: false }, portfolio: true }), '');
    }
  } finally { await vite.close(); }
});
