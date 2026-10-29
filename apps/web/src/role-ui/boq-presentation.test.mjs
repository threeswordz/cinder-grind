import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {effectiveUiQueryScope} from './role-workspace-policy.ts';

test('approval role changes invalidate the full authenticated data scope even with identical permission unions',()=>{
  const p=['budget.boq.view','budget.revision.view','budget.customer.view'];
  assert.notEqual(effectiveUiQueryScope('u','c',p,['MAKER']),effectiveUiQueryScope('u','c',p,['CHECKER']));
  assert.equal(effectiveUiQueryScope('u','c',p,['A','B']),effectiveUiQueryScope('u','c',[...p].reverse(),['B','A','A']));
});

test('Customer print uses the exact stored commercial edit, escapes descriptions and excludes source-cost snapshots in all locales',async()=>{
  const vite=await createServer({root:process.cwd(),server:{middlewareMode:true,hmr:false},appType:'custom'});
  try{
    const {CustomerPrint}=await vite.ssrLoadModule('/src/budget/CustomerBoqPanel.tsx');
    const {MonetaryLocaleContext}=await vite.ssrLoadModule('/src/role-ui/monetary-presentation.tsx');
    const {boqText}=await vite.ssrLoadModule('/src/budget/boq-i18n.ts');
    const data={version:{versionNo:2,currentEditNo:2,sourceRevisionId:'approved-source',currencyCode:'THB',approvalInstance:{approvalState:'APPROVED'},edits:[
      {editNo:1,totalAmount:'9999.00',lines:[]},
      {editNo:2,totalAmount:'0.99',lines:[{id:'l',description:'<private> Work',quantity:'300',uomSnapshot:{code:'EA'},rate:'0.0033',amount:'0.99',pricingSnapshot:{costBasis:'SECRET_COST',targetAmount:'1.00',rateRoundingDifference:'-0.01'}}]},
    ]}};
    for(const locale of ['en','th','zh-TW']){
      const html=renderToStaticMarkup(React.createElement(MonetaryLocaleContext.Provider,{value:locale},React.createElement(CustomerPrint,{data})));
      assert.ok(html.includes(boqText('customer',locale)));assert.match(html,/0\.0033/);assert.match(html,/0\.99/);assert.match(html,/&lt;private&gt;/);
      assert.doesNotMatch(html,/9999|SECRET_COST|costBasis|pricingSnapshot|<private>/);
      for(const key of ['quantityInfo','rules','rounding','target','difference','zeroReason','unsaved'])assert.ok(boqText(key,locale).length>3);
    }
    assert.match(boqText('rounding','en'),/Rate-first/);assert.match(boqText('rounding','th'),/ส่วนต่าง/);assert.match(boqText('rounding','zh-TW'),/差額/);
  }finally{await vite.close();}
});
