import assert from 'node:assert/strict';
import test from 'node:test';
import {materialCapabilityDelta} from './prototype-material-configuration.mjs';

test('DEC-054 legacy synthetic Cost source adds full-cost read to Ben alone and only when preparing source',()=>{
  const observed={
    BEN:['budget.boq.view','budget.boq.manage','budget.revision.view','budget.revision.submit',
      'inventory.material_plan.view','budget.quantity.view','inventory.issue.view',
      'inventory.material_plan.overage.approve','inventory.material_plan.prototype.enable'],
    KHAIMOOK:['budget.revision.view','budget.revision.approve'],
    STORE_SITE:[],
  };
  const original=JSON.stringify(observed);
  const preparing=materialCapabilityDelta(observed,true);
  assert.deepEqual(preparing.BEN.conditionalSourceMissing,['budget.cost.full_view']);
  assert.deepEqual(preparing.KHAIMOOK.conditionalSourceMissing,[]);
  assert.deepEqual(preparing.STORE_SITE.conditionalSourceMissing,[]);
  assert.equal(preparing.KHAIMOOK.journeyMissing.includes('budget.cost.full_view'),false);
  assert.equal(preparing.STORE_SITE.journeyMissing.includes('budget.cost.full_view'),false);
  assert.deepEqual(materialCapabilityDelta(observed,false).BEN.conditionalSourceMissing,[]);
  assert.equal(JSON.stringify(observed),original,'inspection cannot alter existing role grants');
});

test('already explicit Ben full-cost grant is not replayed as a new source delta',()=>{
  const observed={
    BEN:['budget.cost.full_view'],
    KHAIMOOK:[],
    STORE_SITE:[],
  };
  const result=materialCapabilityDelta(observed,true);
  assert.equal(result.BEN.conditionalSourceMissing.includes('budget.cost.full_view'),false);
  assert.equal(result.KHAIMOOK.conditionalSourceMissing.includes('budget.cost.full_view'),false);
});
