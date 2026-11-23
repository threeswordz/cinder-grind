import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 countScheduleContract,countScheduleDay,nextScheduledCountDate,
 replayCountSchedules,STOCK_COUNT_SCHEDULE_ENTITY,
 STOCK_COUNT_SCHEDULE_SET,
} from '../../apps/api/src/inventory/stock-count-schedule-contract.ts';

const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const projectId=uuid(101),warehouseId=uuid(102);
const action=(id,version,previousEventId,body={},time='2026-11-22T12:00:00.000Z')=>({
  id:uuid(id),actorUserId:uuid(20),action:STOCK_COUNT_SCHEDULE_SET,
  occurredAt:new Date(time),
  newValues:{warehouseId,projectId,materialCategory:'Cement',
    firstDueDate:'2026-11-29',intervalDays:14,status:'ACTIVE',
    reason:'Nancy approved fortnightly site count cadence',
    version,previousEventId,...body},
});

test('Nancy explicitly supplies site category and positive repeat cadence; never infer a rate',()=>{
 const c=countScheduleContract({materialCategory:'Cement',
  firstDueDate:'2026-11-29',intervalDays:14,status:'ACTIVE',
  reason:'Per-site schedule'});
 assert.equal(c.intervalDays,14);
 assert.equal(c.materialCategory,'Cement');
 assert.throws(()=>countScheduleContract({materialCategory:'Cement',
  firstDueDate:'2026-11-29',status:'ACTIVE',reason:'none'}),RangeError);
 assert.throws(()=>countScheduleContract({...c,intervalDays:0}),RangeError);
 assert.throws(()=>countScheduleContract({...c,intervalDays:3651}),RangeError);
 assert.throws(()=>countScheduleContract({...c,status:['ACTIVE']}),RangeError);
 assert.throws(()=>countScheduleContract({...c,status:{toString:()=> 'ACTIVE'}}),RangeError);
 assert.throws(()=>countScheduleContract({...c,materialCategory:'*'}),RangeError);
 assert.throws(()=>countScheduleContract({...c,override:'approval'}),RangeError);
});
test('Real calendar dates including leap days; elapsed calendar DAYS not elapsed-hour deadlines',()=>{
 assert.equal(countScheduleDay('2024-02-29'),true);
 assert.equal(countScheduleDay('2025-02-29'),false);
 assert.equal(countScheduleDay('2026-13-01'),false);
 assert.equal(nextScheduledCountDate('2026-11-29',14,'2026-11-23'),'2026-11-29');
 assert.equal(nextScheduledCountDate('2026-11-29',14,'2026-11-29'),'2026-11-29');
 assert.equal(nextScheduledCountDate('2026-11-29',14,'2026-11-30'),'2026-12-13');
 assert.equal(nextScheduledCountDate('2024-02-28',1,'2024-02-29'),'2024-02-29');
 assert.equal(nextScheduledCountDate('2026-12-30',7,'2027-01-05'),'2027-01-06');
});
test('Immutable causal schedule replay ignores same-millisecond UUID ordering',()=>{
 const first=action(99,1,null);
 const revision=action(2,2,uuid(99),{intervalDays:7});
 assert.equal(replayCountSchedules([revision,first])[0].intervalDays,7);
 assert.equal(replayCountSchedules([revision,first])[0].lastEventId,uuid(2));
 assert.equal(replayCountSchedules([revision,first])[0].version,2);
});
test('Paused category remains viewable and cannot be mistaken for stock adjustment',()=>{
 const first=action(1,1,null);
 const paused=action(2,2,uuid(1),{status:'PAUSED',reason:'Construction site temporarily inactive'});
 const out=replayCountSchedules([paused,first]);
 assert.equal(out[0].status,'PAUSED');
 assert.equal(STOCK_COUNT_SCHEDULE_ENTITY,'STOCK_COUNT_SCHEDULE');
});
test('Reject duplicate revisions, parent mismatch, version gaps, scope/category changes and forged events',()=>{
 const first=action(1,1,null),next=action(2,2,uuid(1));
 assert.throws(()=>replayCountSchedules([first,first]),RangeError);
 assert.throws(()=>replayCountSchedules([first,next,action(3,2,uuid(1))]),RangeError);
 assert.throws(()=>replayCountSchedules([first,action(3,3,uuid(1))]),RangeError);
 assert.throws(()=>replayCountSchedules([first,action(3,2,uuid(999))]),RangeError);
 assert.throws(()=>replayCountSchedules([first,action(3,2,uuid(1),{projectId:uuid(333)})]),RangeError);
 assert.throws(()=>replayCountSchedules([first,action(3,2,uuid(1),{materialCategory:'Steel'})]),RangeError);
 assert.throws(()=>replayCountSchedules([first,action(3,2,uuid(1),{firstDueDate:'2026-02-30'})]),RangeError);
});
test('Type-checked API source retains live Nancy-only schedule rights and cannot post stock/Finance',()=>{
 const service=readFileSync(new URL('../../apps/api/src/inventory/stock-count-schedule.service.ts',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../../apps/api/src/inventory/stock-count-schedule.controller.ts',import.meta.url),'utf8');
 assert.match(service,/r\.roleCode==='FINANCE_MANAGER'/);
 assert.match(service,/return\s*\{\s*\.\.\.auth,roleCodes:/);
 assert.match(service,/permissions:\[\.\.\.permissions\]\.filter\(p=>auth\.permissions\.includes\(p\)\)/);
 assert.match(service,/TransactionIsolationLevel\.Serializable/);
 assert.match(service,/COUNT_SCHEDULE_STALE_VERSION/);
 assert.match(service,/pg_advisory_xact_lock/);
 assert.match(service,/material\.count\(/);
 assert.doesNotMatch(service,/stockTransaction\.(create|update|delete)/);
 assert.doesNotMatch(service,/payment\.(create|update)|supplierInvoice\.(create|update)/);
 assert.match(controller,/CsrfGuard/);
 assert.match(controller,/expectedPreviousEventId/);
 assert.doesNotMatch(controller,/inventory\.stock_count\.approve/);
});
