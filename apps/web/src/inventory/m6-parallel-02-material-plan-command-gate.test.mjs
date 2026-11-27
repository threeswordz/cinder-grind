import test from 'node:test';
import assert from 'node:assert/strict';
import {createMaterialPlanCommandGate, maySendMaterialPlanCommand} from './material-plan-command-gate.ts';
const scope = { projectId:'P1', authorizedProject:true, planId:'A', permissions:['view','create','revise','submit','approve'].map(x=>'inventory.material_plan.'+x) };
const submit = {kind:'SUBMIT',id:'A',body:{requestKey:'original',expectedVersion:2}};
const create = {kind:'CREATE',body:{projectId:'P1',requestKey:'create'}};
test('same-render double click cannot claim another operation or retry',()=>{
 const g=createMaterialPlanCommandGate(); assert.equal(g.begin(submit,scope),true);
 assert.equal(g.begin({...submit,body:{requestKey:'duplicate'}},scope),false);
 assert.equal(g.retry(scope),null); assert.equal(g.clear(),false);
});
test('uncertain response preserves exact intent and version',()=>{
 const g=createMaterialPlanCommandGate();g.begin(submit,scope);g.settle();
 assert.equal(g.retry(scope),submit);g.settle();assert.equal(g.retry(scope),submit);
});
test('revoked project, switched project or different plan cannot retry',()=>{
 const g=createMaterialPlanCommandGate();g.begin(submit,scope);g.settle();
 for(const change of [{authorizedProject:false},{projectId:'P2'},{planId:'B'},{planId:null}])assert.equal(g.retry({...scope,...change}),null);
 assert.equal(g.retry(scope),submit);
});
test('missing action or view capability blocks dispatch and retry',()=>{
 for(const kind of ['CREATE','REVISE','SUBMIT','DECIDE']){
  const intent=kind==='CREATE'?create:{...submit,kind};const g=createMaterialPlanCommandGate();
  assert.equal(g.begin(intent,{...scope,permissions:['inventory.material_plan.view']}),false);
  assert.equal(g.begin(intent,scope),true);g.settle();
  assert.equal(g.retry({...scope,permissions:[]}),null);
 }
});
test('create cannot switch projects; retry remains pinned',()=>{
 const g=createMaterialPlanCommandGate();assert.equal(maySendMaterialPlanCommand(create,{...scope,projectId:'P2'}),false);
 assert.equal(g.begin(create,scope),true);g.settle();assert.equal(g.retry({...scope,projectId:'P2'}),null);
 assert.equal(g.retry(scope),create);
});
test('success remains locked until mutation settles; explicit clear only after settle',()=>{
 const g=createMaterialPlanCommandGate();g.begin(submit,scope);g.succeed();assert.equal(g.hasPending(),true);
 assert.equal(g.begin(create,scope),false);g.settle();assert.equal(g.hasPending(),false);
 assert.equal(g.begin(create,scope),true);g.settle();assert.equal(g.clear(),true);assert.equal(g.retry(scope),null);
});
