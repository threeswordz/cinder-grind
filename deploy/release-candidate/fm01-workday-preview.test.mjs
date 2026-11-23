import assert from 'node:assert/strict';
import test from 'node:test';
import {previewWeeklyWorkdays} from '../../apps/api/src/site-execution/site-weekly-workday.ts';

const day=(date,status='MISSING')=>({date,status});
const dates=['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01'];
const seven=(status='MISSING')=>dates.map(date=>day(date,status));
const at=time=>time===null?null:new Date('1970-01-01T'+time+':00.000Z');
const date=d=>new Date(d+'T00:00:00.000Z');
function calendar(changes={}){
  return {
    id:'project-calendar',projectId:'p',isActive:true,isDefault:true,
    calendarName:'Site Project Calendar',timezoneName:'Asia/Bangkok',
    weekdays:Array.from({length:7},(_,n)=>({weekdayNo:n+1,isWorking:n<5,startTime:at(n<5?'08:00':null)})),
    exceptions:[],...changes,
  };
}
test('FM01 known working days, nonwork weekends and before-next-workday local shift cutoff preview',()=>{
  const result=previewWeeklyWorkdays('p',seven(),[calendar()]);
  assert.equal(result.status,'CONFIGURED');
  assert.equal(result.calendarId,'project-calendar');
  assert.equal(result.timezoneName,'Asia/Bangkok');
  assert.deepEqual(result.days.map(x=>x.plannedDayKind),[
    'PLANNED_WORKDAY','PLANNED_WORKDAY','PLANNED_WORKDAY','PLANNED_WORKDAY','PLANNED_WORKDAY',
    'PLANNED_OFF_DAY','PLANNED_OFF_DAY']);
  assert.deepEqual(result.totals,{plannedWorkdays:5,plannedOffDays:2,missingPlannedWorkdayReports:5});
  assert.deepEqual([result.days[0].dueLocalDate,result.days[0].dueLocalStartTime],['2026-10-27','08:00']);
  assert.deepEqual([result.days[4].dueLocalDate,result.days[4].dueLocalStartTime],['2026-11-02','08:00']);
  assert.equal(result.days[5].reportingExpectation,'NO_REPORT_REQUIRED');
  assert.ok(result.days.every(x=>x.timeliness==='NOT_ASSESSED'));
  assert.equal(result.basis,'CURRENT_CONFIGURATION_PREVIEW_NOT_HISTORICAL_COMPLIANCE');
});
test('explicit holiday exception and emergency working-day override supersede weekday patterns',()=>{
  const result=previewWeeklyWorkdays('p',seven(),[calendar({exceptions:[
    {exceptionDate:date('2026-10-27'),isWorkingOverride:false,startTime:null,reason:'Approved holiday'},
    {exceptionDate:date('2026-10-31'),isWorkingOverride:true,startTime:at('07:30'),reason:'Approved Saturday work'},
  ]})]);
  assert.equal(result.days[1].plannedDayKind,'PLANNED_OFF_DAY');
  assert.equal(result.days[1].exceptionReason,'Approved holiday');
  assert.equal(result.days[0].dueLocalDate,'2026-10-28');
  assert.equal(result.days[4].dueLocalDate,'2026-10-31');
  assert.equal(result.days[4].dueLocalStartTime,'07:30');
  assert.equal(result.days[5].reportingExpectation,'PLANNED_DAY_REPORT_MISSING');
});
test('Project default wins over company default; unrelated project and inactive config cannot authorize expectations',()=>{
  const candidates=[calendar({id:'unrelated',projectId:'other'}),calendar({id:'company',projectId:null}),
    calendar({id:'inactive',isActive:false}),calendar({id:'target'})];
  assert.equal(previewWeeklyWorkdays('p',seven(),candidates).calendarId,'target');
  assert.equal(previewWeeklyWorkdays('other',seven(),[calendar({id:'unrelated',projectId:'other',isActive:false})]).status,'NOT_CONFIGURED');
  assert.equal(previewWeeklyWorkdays('p',seven(),[calendar({id:'company',projectId:null})]).calendarId,'company');
});
test('unknown, ambiguous and malformed calendars fail closed without assigning missed days or deadlines',()=>{
  const no=previewWeeklyWorkdays('p',seven(),[]);
  assert.equal(no.status,'NOT_CONFIGURED');
  assert.ok(no.days.every(x=>x.reportingExpectation==='UNDETERMINED'&&x.dueLocalDate===null));
  assert.equal(no.totals,null);
  const two=previewWeeklyWorkdays('p',seven(),[calendar(),calendar({id:'two'})]);
  assert.equal(two.status,'AMBIGUOUS');
  assert.equal(two.totals,null);
  for(const invalid of [
    calendar({timezoneName:'Not/A/TimeZone'}),
    calendar({weekdays:calendar().weekdays.slice(1)}),
    calendar({weekdays:[...calendar().weekdays.slice(0,6),calendar().weekdays[0]]}),
    calendar({exceptions:[
      {exceptionDate:date('2026-10-26'),isWorkingOverride:false,startTime:null,reason:null},
      {exceptionDate:date('2026-10-26'),isWorkingOverride:true,startTime:null,reason:null},
    ]}),
  ])assert.equal(previewWeeklyWorkdays('p',seven(),[invalid]).status,'INVALID_CONFIGURATION');
});
test('all-off schedule does not invent next working-day cutoff',()=>{
  const off=calendar({weekdays:calendar().weekdays.map(w=>({...w,isWorking:false}))});
  const out=previewWeeklyWorkdays('p',seven(),[off]);
  assert.equal(out.totals.plannedWorkdays,0);
  assert.ok(out.days.every(d=>d.dueLocalDate===null&&d.reportingExpectation==='NO_REPORT_REQUIRED'));
});
test('draft and submitted records do not become late judgments from mutable current calendars',()=>{
  const rows=seven();rows[0]=day('2026-10-26','DRAFT');rows[1]=day('2026-10-27','SUBMITTED');
  const out=previewWeeklyWorkdays('p',rows,[calendar()]);
  assert.equal(out.days[0].reportingExpectation,'PLANNED_DAY_DRAFT');
  assert.equal(out.days[1].reportingExpectation,'PLANNED_DAY_SUBMITTED');
  assert.ok(out.days.every(d=>d.timeliness==='NOT_ASSESSED'));
});
test('noncanonical, repeated and partial weekly days are rejected rather than guessed',()=>{
  for(const rows of [seven().slice(0,6),[...seven().slice(0,6),day('2026-10-26')],[...seven().slice(0,6),day('2026-02-31')]]) {
    assert.throws(()=>previewWeeklyWorkdays('p',rows,[calendar()]),RangeError);
  }
});
