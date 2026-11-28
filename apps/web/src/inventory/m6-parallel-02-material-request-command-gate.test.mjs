import test from 'node:test';
import assert from 'node:assert/strict';
import {createMaterialRequestCommandGate, maySendMaterialRequestCommand} from './material-request-command-gate.ts';
const permissions=['view','create','edit','link','acknowledge'].map(x=>'inventory.material_request.'+x).concat('inventory.issue.view','documents.document.view');
const base={projectId:'P',requestId:'R',authorized:true,permissions};
const createScope={...base,requestId:null};
const create={suffix:'',body:{projectId:'P',requestKey:'create'}};
const edit={suffix:'/R/revisions',body:{requestKey:'edit',expectedVersion:2}};
test('double clicks and concurrent form actions cannot create a second command',()=>{
 const g=createMaterialRequestCommandGate();assert.equal(g.begin(create,createScope),true);
 assert.equal(g.begin({...create,body:{projectId:'P',requestKey:'duplicate'}},createScope),false);
 assert.equal(g.begin(edit,base),false);assert.equal(g.retry(createScope),null);assert.equal(g.clear(createScope),false);
});
test('uncertain result retains exact command identity across a stale version',()=>{
 const g=createMaterialRequestCommandGate();g.begin(edit,base);g.settle();assert.equal(g.retry(base),edit);
 g.settle();assert.equal(g.retry(base),edit);
});
test('other request, Project, form and lost access cannot replay the command',()=>{
 const g=createMaterialRequestCommandGate();g.begin(edit,base);g.settle();
 for(const scope of [{...base,requestId:'OTHER'},{...base,projectId:'OTHER'},createScope,{...base,authorized:false}])assert.equal(g.retry(scope),null);
 assert.equal(g.clear(createScope),false);assert.equal(g.clear({...base,requestId:'OTHER'}),false);
 assert.equal(g.retry(base),edit);
});
test('all command routes require the original target and exact capability',()=>{
 for(const [suffix,right] of [['/R/revisions','inventory.material_request.edit'],['/R/issue-links','inventory.issue.view'],['/R/receipts','documents.document.view'],['/R/receipts','inventory.material_request.acknowledge']]){
  const intent={suffix,body:{}};assert.equal(maySendMaterialRequestCommand(intent,base),true);
  assert.equal(maySendMaterialRequestCommand(intent,{...base,permissions:permissions.filter(p=>p!==right)}),false);
 }
 for(const suffix of ['/OTHER/revisions','/R/create','/R/revisions/other','/R/../receipts','/R/toString'])assert.equal(maySendMaterialRequestCommand({suffix,body:{}},base),false);
 assert.equal(maySendMaterialRequestCommand(create,{...createScope,projectId:'OTHER'}),false);
});
test('revoked authorization may abandon only its own uncertain command, not resend',()=>{
 const g=createMaterialRequestCommandGate();g.begin(edit,base);g.settle();const revoked={...base,authorized:false,permissions:[]};
 assert.equal(g.retry(revoked),null);assert.equal(g.clear(revoked),true);assert.equal(g.hasPending(),false);
});
test('success locks other forms until settled, without retaining a replayable command',()=>{
 const g=createMaterialRequestCommandGate();g.begin(edit,base);g.succeed();assert.equal(g.hasPending(),true);
 assert.equal(g.begin(create,createScope),false);g.settle();assert.equal(g.hasPending(),false);
 assert.equal(g.retry(base),null);assert.equal(g.begin(create,createScope),true);
});
