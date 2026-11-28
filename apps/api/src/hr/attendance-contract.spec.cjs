const {test}=require('node:test');
const assert=require('node:assert/strict');
const c=require('./attendance-contract.js');
const row={employeeId:'E1',projectId:'P1',workDate:'2026-11-29',startMinute:480,endMinute:720};
test('half-month calendar incl leap and nonleap February',()=>{
  assert.deepEqual(c.attendancePeriod('2026-11-15'),{start:'2026-11-01',end:'2026-11-15'});
  assert.deepEqual(c.attendancePeriod('2026-11-16'),{start:'2026-11-16',end:'2026-11-30'});
  assert.deepEqual(c.attendancePeriod('2028-02-29'),{start:'2028-02-16',end:'2028-02-29'});
  assert.deepEqual(c.attendancePeriod('2026-02-28'),{start:'2026-02-16',end:'2026-02-28'});
});
test('strict invalid date and time',()=>{
  for(const x of ['2026-02-29','2026-11-31','2026-1-01','0000-01-01']) assert.throws(()=>c.attendanceDay(x));
  for(const x of ['24:01','8:00','09:60','-1:00']) assert.throws(()=>c.clockMinute(x));
  assert.equal(c.clockMinute('08:00'),480);
});
test('strict interval bounds and chronological order',()=>{
  c.validateInterval(row);
  for(const x of [{startMinute:720},{startMinute:-1},{endMinute:1441},{endMinute:720.5},{employeeId:''}]) assert.throws(()=>c.validateInterval({...row,...x}));
});
test('overlap across Projects not silently double counted',()=>{
  assert.equal(c.intervalsOverlap(row,{...row,projectId:'P2',startMinute:719,endMinute:900}),true);
  assert.equal(c.intervalsOverlap(row,{...row,projectId:'P2',startMinute:720,endMinute:900}),false);
  assert.equal(c.intervalsOverlap(row,{...row,employeeId:'E2'}),false);
  assert.equal(c.intervalsOverlap(row,{...row,workDate:'2026-11-30'}),false);
});
test('employment period bounds inclusive',()=>{
  c.assertEmploymentDay('2026-11-29','2026-11-29','2026-11-29');
  c.assertEmploymentDay('2026-11-29','2026-11-01',null);
  assert.throws(()=>c.assertEmploymentDay('2026-11-29','2026-11-30',null));
  assert.throws(()=>c.assertEmploymentDay('2026-11-29','2026-11-01','2026-11-28'));
});
test('site submission locks edits, HR returns, site resubmits',()=>{
  const t=c.attendanceTransition;
  assert.equal(t('DRAFT','EDIT','SITE_RECORDER',1,1),'DRAFT');
  assert.equal(t('DRAFT','SUBMIT','SITE_RECORDER',1,1),'SUBMITTED');
  assert.throws(()=>t('SUBMITTED','EDIT','SITE_RECORDER',2,2));
  assert.throws(()=>t('SUBMITTED','RETURN','SITE_RECORDER',2,2));
  assert.equal(t('SUBMITTED','RETURN','HR_REVIEWER',2,2),'RETURNED');
  assert.equal(t('RETURNED','EDIT','SITE_RECORDER',3,3),'RETURNED');
  assert.equal(t('RETURNED','RESUBMIT','SITE_RECORDER',4,4),'SUBMITTED');
});
test('unknown actor/action and stale versions fail closed',()=>{
  const t=c.attendanceTransition;
  assert.throws(()=>t('DRAFT','SUBMIT','ADMIN',1,1));
  assert.throws(()=>t('DRAFT','SUBMIT','HR_REVIEWER',1,1));
  assert.throws(()=>t('DRAFT','SUBMIT','SITE_RECORDER',1,2));
  assert.throws(()=>t('RETURNED','SUBMIT','SITE_RECORDER',3,3));
  assert.throws(()=>t('DRAFT','APPROVE','SITE_RECORDER',1,1));
});
