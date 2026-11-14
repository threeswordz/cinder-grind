import test from 'node:test';
import assert from 'node:assert/strict';
import {applyMaterialConfiguration} from '../uat/prototype-material-configure.mjs';
import {executeMaterialRun} from '../uat/prototype-material-run.mjs';
import {SOURCE} from '../uat/prototype-actors.mjs';
test('synthetic configuration refuses absent expected state before any transaction or mutation',async()=>{
  let used=false;const db={$transaction:async()=>{used=true;}};
  for(const state of [undefined,'','pending','f'.repeat(40)])
    await assert.rejects(applyMaterialConfiguration(db,{sourceSha:SOURCE},state),e=>e.safeCode==='MATERIAL_CONFIGURATION_EXPECTED_STATE_REQUIRED');
  assert.equal(used,false);
});
test('a plan or wrong-Project configuration cannot authorize API execution',async()=>{
  for(const configuration of [{status:'MATERIAL_CONFIGURATION_DELTA_PLANNED'},
    {status:'MATERIAL_SYNTHETIC_CONFIGURATION_APPLIED',sourceSha:SOURCE,projectId:'other',productionAuthorized:false}])
    await assert.rejects(executeMaterialRun({}, {fixture:{projectId:'expected'}},configuration,{},()=>{}),
      e=>e.safeCode==='MATERIAL_RUN_CONFIGURATION_REQUIRED');
});
