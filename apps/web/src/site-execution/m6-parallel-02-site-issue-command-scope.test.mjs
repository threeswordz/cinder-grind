import test from 'node:test';
import assert from 'node:assert/strict';
import {pinSiteIssueOperation,mayRetrySiteIssueOperation,maySendSiteIssueOperation} from './site-issue-command-scope.ts';
const scope={identity:'company/user/rights',projectId:'P',currentIssueId:'I',authorized:true,permissions:['view','report','routing.manage','follow_up','verify','close'].map(x=>'site.issue.'+x)};
const follow={path:'/I/follow-up',body:{requestKey:'unchanged',expectedVersion:4,note:'original'}};
test('create, routing and three issue actions require their exact scoped permission',()=>{
 for(const [operation,right] of [[{path:'',body:{projectId:'P'}},'report'],[{path:'/projects/P/routing',body:{}},'routing.manage'],[follow,'follow_up'],[{path:'/I/verify',body:{}},'verify'],[{path:'/I/close',body:{}},'close']]){
  assert.equal(maySendSiteIssueOperation(operation,scope),true);
  assert.equal(maySendSiteIssueOperation(operation,{...scope,permissions:scope.permissions.filter(p=>p!=='site.issue.'+right)}),false);
 }
 assert.equal(maySendSiteIssueOperation({path:'/projects/P/routing',body:{}},{...scope,permissions:['site.issue.routing.manage']}),true);
});
test('wrong project, route and issue id fail closed',()=>{
 for(const operation of [{path:'',body:{projectId:'OTHER'}},{path:'/projects/OTHER/routing',body:{}},{path:'/OTHER/follow-up',body:{}},{path:'/I/../verify',body:{}},{path:'/I/verify/other',body:{}}])assert.equal(pinSiteIssueOperation(operation,scope),null);
 assert.equal(pinSiteIssueOperation(follow,{...scope,currentIssueId:null}),null);
});
test('uncertain action is pinned to actor, project, target and original body',()=>{
 const pinned=pinSiteIssueOperation(follow,scope);assert.equal(pinned.operation,follow);
 for(const change of [{identity:'another'},{projectId:'OTHER'},{currentIssueId:'OTHER'},{authorized:false},{permissions:['site.issue.view']}])assert.equal(mayRetrySiteIssueOperation(pinned,{...scope,...change}),false);
 assert.equal(mayRetrySiteIssueOperation(pinned,scope),true);
 assert.equal(pinned.operation.body.requestKey,'unchanged');assert.equal(pinned.operation.body.expectedVersion,4);
});
test('routing and create retry do not depend on unrelated selected issue',()=>{
 for(const operation of [{path:'',body:{projectId:'P'}},{path:'/projects/P/routing',body:{}}]){
  const pinned=pinSiteIssueOperation(operation,scope);
  assert.equal(mayRetrySiteIssueOperation(pinned,{...scope,currentIssueId:'OTHER'}),true);
  assert.equal(mayRetrySiteIssueOperation(pinned,{...scope,authorized:false}),false);
 }
});
