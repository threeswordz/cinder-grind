import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NO_WORK_ACTION, NO_WORK_CORRECTION_ACTION, noWorkEvidence,
  calendarFingerprint, weeklyReviewFingerprint, mayAcknowledgeWeekly, mayDeclareNoWork,
  validWeeklyHash,
} from '../../apps/api/src/site-execution/site-weekly-operational.ts';

const p='a'.repeat(36), foreman='b'.repeat(36), ben='c'.repeat(36);
const at=s=>new Date(s);
const planned = {
  calendarId:'calendar-1',calendarName:'Current Site Calendar',
  timezoneName:'Asia/Bangkok',reportDate:'2026-10-26',
  plannedDayKind:'PLANNED_WORKDAY',dueLocalDate:'2026-10-27',
  dueLocalStartTime:'08:00',calendarFingerprint:'a'.repeat(64),
  historicTimeliness:'NOT_ASSESSED',
};
const declare=(id='event1',reason='Heavy rain prevented all planned works')=>({
  id,actorUserId:foreman,action:NO_WORK_ACTION,
  occurredAt:at('2026-10-26T09:00:00.000Z'),
  newValues:{reason,projectId:p,reportDate:'2026-10-26',plannedDayEvidence:planned},
});
const correct=(oldReason,newReason)=>({
  id:'event2',actorUserId:foreman,action:NO_WORK_CORRECTION_ACTION,
  occurredAt:at('2026-10-27T09:00:00.000Z'),
  newValues:{oldReason,reason:newReason},
});
const source=()=>({
  projectId:p,from:'2026-10-26',to:'2026-11-01',
  days:[{date:'2026-10-26',status:'SUBMITTED',report:{
    id:'report-1',createdBy:{id:foreman},submittedAt:'2026-10-26T10:00:00Z',
    updatedAt:'2026-10-26T10:00:00Z',totalManpower:0,
    counts:{materialUsage:0,equipmentUsage:0,progressLines:0,issues:0,delays:1,inspections:0,corrections:0},
    progressObservations:[],
  }},
  ...['27','28','29','30','31'].map(d=>({date:'2026-10-'+d,status:'MISSING',report:null})),
  {date:'2026-11-01',status:'MISSING',report:null}],
});
const management=()=>({
  userId:ben,roleCodes:['MANAGEMENT'],permissions:['site.daily_report.view'],
});
test('FM01 no-work is immutable event evidence with reason and calendar identity',()=>{
  const data=noWorkEvidence([declare()]);
  assert.equal(data.reason,'Heavy rain prevented all planned works');
  assert.equal(data.declarationId,'event1');
  assert.equal(data.plannedDayEvidence.reportDate,'2026-10-26');
  assert.equal(data.plannedDayEvidence.historicTimeliness,'NOT_ASSESSED');
  assert.equal(data.correctionCount,0);
});
test('reasoned corrections append without overwriting original actor/calendar/snapshot',()=>{
  const first=declare();
  const c=correct(first.newValues.reason,'Severe rain and flooded access prevented work');
  const out=noWorkEvidence([c,first]);
  assert.equal(out.reason,c.newValues.reason);
  assert.equal(out.declarationId,'event1');
  assert.equal(out.correctionCount,1);
  assert.equal(out.correctedByUserId,foreman);
  assert.equal(out.plannedDayEvidence.calendarFingerprint,'a'.repeat(64));
  assert.equal(first.newValues.reason,'Heavy rain prevented all planned works');
});
test('missing, duplicate and tampered no-work audit sources fail closed',()=>{
  assert.equal(noWorkEvidence([]),null);
  assert.throws(()=>noWorkEvidence([declare(),declare('event3')]),RangeError);
  assert.throws(()=>noWorkEvidence([declare('event1','  ')]),RangeError);
  assert.throws(()=>noWorkEvidence([{...declare(),newValues:{
    ...declare().newValues,plannedDayEvidence:{...planned,plannedDayKind:'PLANNED_OFF_DAY'},
  }}]),RangeError);
  assert.throws(()=>noWorkEvidence([declare(),correct('not actual','Mismatch')]),RangeError);
  assert.throws(()=>noWorkEvidence([declare(),{
    ...correct('Heavy rain prevented all planned works','Rain'),id:'event4',
    occurredAt:at('2026-10-25T08:00:00Z'),
  }]),RangeError);
});
test('weekly source fingerprint binds report version and correction source',()=>{
  const w=source();
  const map=new Map([['report-1',noWorkEvidence([declare()])]]);
  const hash=weeklyReviewFingerprint(w,map);
  assert.equal(hash.length,64);
  assert.equal(hash,weeklyReviewFingerprint(source(),map));
  assert.notEqual(hash,weeklyReviewFingerprint({...w,
    days:w.days.map((day,i)=>i?day:{...day,report:{...day.report,updatedAt:'2026-10-27T10:00:00Z'}}),
  },map));
  assert.notEqual(hash,weeklyReviewFingerprint(w,new Map([
    ['report-1',noWorkEvidence([declare(),correct('Heavy rain prevented all planned works','Rain stopped planned works')])],
  ])));
  assert.notEqual(hash,weeklyReviewFingerprint({...w,to:'2026-11-02'},map));
  assert.notEqual(hash,weeklyReviewFingerprint(w,new Map()));
  const calendar={status:'CONFIGURED',calendarId:'a',days:[{date:'2026-10-26',working:true}]};
  const previewHash=weeklyReviewFingerprint(w,map,calendar,['document-2','document-1']);
  assert.equal(previewHash,weeklyReviewFingerprint(w,map,calendar,['document-1','document-2']));
  assert.notEqual(previewHash,weeklyReviewFingerprint(w,map,
    {...calendar,days:[{date:'2026-10-26',working:false}]},
    ['document-2','document-1']));
  assert.notEqual(previewHash,weeklyReviewFingerprint(w,map,calendar,['document-1']));
  assert.notEqual(previewHash,weeklyReviewFingerprint(w,map,calendar,['document-3','document-1']));

});
test('weekly Management source reviewer cannot approve own report or corrections',()=>{
  const w=source(), auth=management();
  assert.equal(mayAcknowledgeWeekly(auth,w,[]),true);
  const foremanRole={userId:foreman,roleCodes:['PROJECT_ENGINEER'],
    permissions:['site.daily_report.edit','site.daily_report.submit']};
  assert.equal(mayDeclareNoWork(foremanRole),true);
  assert.equal(mayDeclareNoWork({...foremanRole,roleCodes:['MANAGEMENT']}),false);
  assert.equal(mayDeclareNoWork({...foremanRole,permissions:['site.daily_report.edit']}),false);
  assert.equal(mayDeclareNoWork({...foremanRole,permissions:['site.daily_report.submit']}),false);
  assert.equal(mayAcknowledgeWeekly({...auth,roleCodes:['SYS_ADMIN']},w,[]),false);
  assert.equal(mayAcknowledgeWeekly({...auth,permissions:[]},w,[]),false);
  assert.equal(mayAcknowledgeWeekly({...auth,userId:foreman},w,[]),false);
  assert.equal(mayAcknowledgeWeekly(auth,w,[ben]),false);
  assert.equal(mayAcknowledgeWeekly(auth,{...w,days:w.days.map(d=>({...d,status:'MISSING'}))},[]),false);
});
test('calendar digest is order-independent but fails to reuse changed exceptions',()=>{
  const weekdays=Array.from({length:7},(_,i)=>({
    weekdayNo:i+1,isWorking:i<5,startTime:at('1970-01-01T08:00:00.000Z'),
  }));
  const c={id:'one',projectId:p,isActive:true,isDefault:true,timezoneName:'Asia/Bangkok',
    weekdays,exceptions:[
      {exceptionDate:at('2026-10-27T00:00:00Z'),isWorkingOverride:false,startTime:null,reason:'Holiday'},
      {exceptionDate:at('2026-10-31T00:00:00Z'),isWorkingOverride:true,startTime:null,reason:'Emergency'}]};
  const value=calendarFingerprint(c);
  assert.equal(value,calendarFingerprint({...c,weekdays:[...weekdays].reverse(),exceptions:[...c.exceptions].reverse()}));
  assert.notEqual(value,calendarFingerprint({...c,exceptions:c.exceptions.slice(1)}));
  assert.notEqual(value,calendarFingerprint({...c,projectId:'other'}));
});
test('review fingerprint input must be canonical SHA256 lowercase hex',()=>{
  assert.equal(validWeeklyHash('a'.repeat(64)),true);
  for(const bad of [null,undefined,123,'a'.repeat(63),'A'.repeat(64),'g'.repeat(64),{}])
    assert.equal(validWeeklyHash(bad),false);
});
