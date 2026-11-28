const {test}=require('node:test');
const assert=require('node:assert/strict');
const c=require('./request-contract.js');
test('confirmed leave routes and site/office overtime, unresolved maker fails closed',()=>{
  assert.deepEqual(c.requestRoute('LEAVE','SITE_WORKER'),{maker:'STORE',checkers:['FOREMAN','HR']});
  assert.deepEqual(c.requestRoute('LEAVE','FOREMAN'),{maker:'SELF',checkers:['PM','HR','BEN']});
  assert.deepEqual(c.requestRoute('LEAVE','OFFICE'),{maker:'SELF',checkers:['HR','BEN']});
  assert.deepEqual(c.requestRoute('OVERTIME','SITE_WORKER'),{maker:'PM',checkers:['HR','BEN']});
  assert.deepEqual(c.requestRoute('OVERTIME','OFFICE'),{maker:'SELF',checkers:['HR','BEN']});
  assert.throws(()=>c.requestRoute('LEAVE','SITE_LEADER'));
});
test('ordered distinct checkers, stale and unauthorized action denied',()=>{
  const steps=[{actorId:'f',role:'FOREMAN'},{actorId:'h',role:'HR'}];
  const start={status:'PENDING',next:0,version:1};
  assert.throws(()=>c.reviewRequest(start,steps,'s',steps[1],'APPROVE',1));
  assert.throws(()=>c.reviewRequest(start,steps,'f',steps[0],'APPROVE',1));
  const first=c.reviewRequest(start,steps,'s',steps[0],'APPROVE',1);
  assert.deepEqual(first,{status:'PENDING',next:1,version:2});
  assert.throws(()=>c.reviewRequest(first,steps,'s',steps[1],'APPROVE',1));
  assert.deepEqual(c.reviewRequest(first,steps,'s',steps[1],'APPROVE',2),{status:'APPROVED',next:2,version:3});
  assert.equal(c.reviewRequest(first,steps,'s',steps[1],'RETURN',2).status,'RETURNED');
  assert.equal(c.reviewRequest(first,steps,'s',steps[1],'REJECT',2).status,'REJECTED');
});
test('actual overtime evidence independent of request and excess requires reason',()=>{
  assert.deepEqual(c.assertActualOvertime(60,90,'Reviewed clock record'),{requestedMinutes:60,actualMinutes:90,excessMinutes:30});
  assert.throws(()=>c.assertActualOvertime(60,90,null));
  assert.throws(()=>c.assertActualOvertime(60,-1,null));
  assert.equal(c.assertActualOvertime(60,0,null).actualMinutes,0);
});
