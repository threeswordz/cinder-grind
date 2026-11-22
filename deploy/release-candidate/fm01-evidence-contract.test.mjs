import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DECLARE_NO_WORK,CORRECT_NO_WORK,ACKNOWLEDGE_WEEK,
  checkedNoWorkReason,currentNoWork,weeklyReviewFingerprint,weeklyReviewStatus,
} from '../../apps/api/src/site-execution/site-weekly-evidence.ts';

const reportId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const projectId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actor='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const calendarId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const day='2026-10-08';
const event=(id,action,previous,reason='Heavy rain prevented works',extra={})=>({
  id,action,actorUserId:actor,occurredAt:new Date('2026-10-10T10:00:00.000Z'),
  newValues:{reportId,projectId,reportDate:day,reason,previousEventId:previous,
    calendarId,timezoneName:'Asia/Bangkok',sourceSubmittedAt:'2026-10-09T00:00:00.000Z',
    correctionCountWhenDeclared:0,...extra},
});
const a='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const b='ffffffff-ffff-4fff-8fff-ffffffffffff';
const history=[event(a,DECLARE_NO_WORK,null),event(b,CORRECT_NO_WORK,a,'Site closed following rain and unsafe ground')];
const days=Array.from({length:7},(_,i)=>({
  date:'2026-10-'+String(5+i).padStart(2,'0'),
  status:i===3?'SUBMITTED':'MISSING',
  report:i===3?{id:reportId,submittedAt:'2026-10-09T00:00:00Z',counts:{corrections:0}}:null,
}));
const fp=(opts={})=>weeklyReviewFingerprint({projectId,from:'2026-10-05',to:'2026-10-11',
  days,calendar:{status:'CONFIGURED',id:calendarId,workingDays:[1,2,3,4,5]},
  noWork:[{reportId,eventId:b,reason:history[1].newValues.reason,
    createdAt:history[1].occurredAt.toISOString(),historyCount:2}],
  documentLinkIds:['doc-b','doc-a'],...opts});
const ack=(fingerprint)=>({
  id:a,action:ACKNOWLEDGE_WEEK,actorUserId:actor,
  occurredAt:new Date('2026-10-12T00:00:00.000Z'),
  newValues:{from:'2026-10-05',to:'2026-10-11',fingerprint,note:'Reviewed; missing reports flagged'},
});
test('planned no-work needs nontrivial reason and preserves original input against editing',()=>{
  assert.equal(checkedNoWorkReason('  Heavy rain  '),'Heavy rain');
  for(const invalid of [null,undefined,{},4,'','    ','short','x'.repeat(1001)])
    assert.throws(()=>checkedNoWorkReason(invalid),RangeError);
});
test('original declaration plus append-only correction yields latest reason and original chronology',()=>{
  const original=currentNoWork(history.slice(0,1),reportId,projectId,day);
  const corrected=currentNoWork(history,reportId,projectId,day);
  assert.equal(original.reason,'Heavy rain prevented works');
  assert.equal(original.eventId,a);
  assert.equal(corrected.reason,'Site closed following rain and unsafe ground');
  assert.equal(corrected.historyCount,2);
  assert.equal(corrected.eventId,b);
  assert.equal(history[0].newValues.reason,'Heavy rain prevented works');
});
test('without persisted event no-work declaration is not inferred from missing reports',()=>{
  assert.equal(currentNoWork([],reportId,projectId,day),null);
});
test('forged source/actor/broken append-only event chain fails closed',()=>{
  const mutations=[
    [event(a,DECLARE_NO_WORK,'wrong')],
    [event(a,CORRECT_NO_WORK,null)],
    [event(a,DECLARE_NO_WORK,null,{}) , event(b,CORRECT_NO_WORK,'wrong')],
    [event(a,DECLARE_NO_WORK,null,'Heavy rain prevented works',{projectId:'wrong'})],
    [event(a,DECLARE_NO_WORK,null,'Heavy rain prevented works',{reportId:'wrong'})],
    [event(a,DECLARE_NO_WORK,null,'Heavy rain prevented works',{reportDate:'2026-10-09'})],
    [event(a,DECLARE_NO_WORK,null,'Heavy rain prevented works',{calendarId:null})],
    [event(a,DECLARE_NO_WORK,null,'Heavy rain prevented works',{timezoneName:null})],
    [event(a,DECLARE_NO_WORK,null,'Heavy rain prevented works',{correctionCountWhenDeclared:-1})],
    [{...event(a,DECLARE_NO_WORK,null),actorUserId:''}],
    [{...event(a,DECLARE_NO_WORK,null),occurredAt:new Date('invalid')}],
    [{...event(a,DECLARE_NO_WORK,null),newValues:null}],
    [{...event(a,DECLARE_NO_WORK,null),action:'FORGED_ACTION'}],
  ];
  for(const mutated of mutations)assert.throws(()=>currentNoWork(mutated,reportId,projectId,day),RangeError);
});
test('weekly snapshot fingerprint is deterministic despite source array ordering of doc links',()=>{
  assert.match(fp(),/^[a-f0-9]{64}$/);
  assert.equal(fp(),fp({documentLinkIds:['doc-a','doc-b']}));
});
test('all reviewed source and calendar mutations invalidate the previous weekly fingerprint',()=>{
  const source=fp();
  const changed=[
    {projectId:'other'},
    {from:'2026-10-06'},
    {to:'2026-10-12'},
    {days:days.map((x,i)=>i===0?{...x,status:'DRAFT'}:x)},
    {days:days.map((x,i)=>i===3?{...x,report:{...x.report,counts:{corrections:1}}}:x)},
    {calendar:{status:'CONFIGURED',id:calendarId,workingDays:[1,2,3,4,5,6]}},
    {noWork:[{reportId,eventId:a,reason:'Heavy rain prevented works',
      createdAt:history[0].occurredAt.toISOString(),historyCount:1}]},
    {documentLinkIds:['doc-a','doc-b','doc-c']},
  ];
  for(const value of changed)assert.notEqual(fp(value),source,JSON.stringify(value));
});
test('old acknowledgment stays recorded but is stale after source change, never an approval',()=>{
  const evidence=[ack(fp())];
  const yes=weeklyReviewStatus(evidence,'2026-10-05','2026-10-11',fp());
  assert.equal(yes.status,'ACKNOWLEDGED');
  assert.equal(yes.review.note,'Reviewed; missing reports flagged');
  assert.equal(weeklyReviewStatus(evidence,'2026-10-05','2026-10-11',fp({documentLinkIds:['doc-c']})).status,'STALE');
  assert.equal(weeklyReviewStatus(evidence,'2026-10-12','2026-10-18',fp()).status,'UNREVIEWED');
});
test('new acknowledgment replaces latest view not old historical review evidence',()=>{
  const next=ack(fp({documentLinkIds:['doc-c']}));next.id=b;
  const all=[ack(fp()),next];
  assert.equal(weeklyReviewStatus(all,'2026-10-05','2026-10-11',fp()).status,'STALE');
  assert.equal(weeklyReviewStatus(all,'2026-10-05','2026-10-11',fp({documentLinkIds:['doc-c']})).status,'ACKNOWLEDGED');
  assert.equal(all[0].newValues.fingerprint,fp());
});
test('missing or malformed source evidence must fail closed, never be reported as approved',()=>{
  assert.throws(()=>weeklyReviewFingerprint({projectId,from:'2026-10-05',to:'2026-10-11',days:[],calendar:null,noWork:[],documentLinkIds:[]}),RangeError);
  assert.throws(()=>weeklyReviewStatus([{...ack(fp()),newValues:null}],'2026-10-05','2026-10-11',fp()),RangeError);
  assert.throws(()=>weeklyReviewStatus([{...ack(fp()),action:'APPROVE'}],'2026-10-05','2026-10-11',fp()),RangeError);
});
