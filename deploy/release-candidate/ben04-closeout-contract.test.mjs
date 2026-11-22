import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLOSEOUT_CATEGORIES,CLOSEOUT_ENTITY,PREPARE_CLOSEOUT,
  BEN_CLOSEOUT_SIGN,NANCY_CLOSEOUT_SIGN,
  validateCloseoutPreparation,closeoutFingerprint,parseCloseoutEvents,
} from '../../apps/api/src/projects/project-closeout-contract.ts';

const projectId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const khaimook='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ben='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const nancy='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const a='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const b='ffffffff-ffff-4fff-8fff-ffffffffffff';
const c='12121212-1212-4121-8121-121212121212';
const d='34343434-3434-4343-8343-343434343434';
const date=new Date('2026-11-23T01:00:00.000Z');
const basic=()=>({
  checklist:CLOSEOUT_CATEGORIES.map(category=>({
    category,state:'CLEAR',
    evidenceNote:'Source documents and outstanding exceptions inspected',
    evidenceReference:'SRC-'+category,
  })),
  outstandingItems:[],overallNote:'Khaimook checked all six categories and source references.',
});
const warning=()=>{
  const v=basic();v.checklist=v.checklist.map(x=>
    x.category==='AP_AR_PAYMENTS'?{...x,state:'WARNING'}:x);
  v.outstandingItems=[{
    category:'AP_AR_PAYMENTS',description:'Supplier invoice still outstanding',
    reason:'Payment follows contractual settlement',
    ownerUserId:nancy,dueDate:'2026-12-05',remainingAmount:'25000.00',
    remainingQuantity:null,quantityUom:null,notQuantifiableReason:null,
  }];
  return v;
};
const normalize=(obj,revision=false)=>validateCloseoutPreparation(obj,revision);
function prepare({id=a,preparedBy=khaimook,version=1,previousEventId=null,body=basic()}={}){
 const preparation=normalize(body,version>1);
 const fingerprint=closeoutFingerprint({projectId,version,preparedBy,preparation});
 return {id,action:PREPARE_CLOSEOUT,actorUserId:preparedBy,occurredAt:date,
  newValues:{projectId,version,preparedBy,preparation,previousEventId,fingerprint}};
}
function sign(prepareRow,role,actor,id){
 return {id,action:role==='BEN'?BEN_CLOSEOUT_SIGN:NANCY_CLOSEOUT_SIGN,
  actorUserId:actor,occurredAt:new Date(date.getTime()+1000),
  newValues:{projectId,preparedBy:prepareRow.actorUserId,
    preparationEventId:prepareRow.id,fingerprint:prepareRow.newValues.fingerprint,
    note:'Reviewed all remaining items and accepted follow-up'}};
}
test('six exact categories with distinct source references are required',()=>{
 assert.equal(normalize(basic()).checklist.length,6);
 for(const modify of [
   v=>v.checklist.pop(),
   v=>{v.checklist[1].category=v.checklist[0].category;},
   v=>{v.checklist[0].category='OTHER';},
   v=>{v.checklist[0].state='UNKNOWN';},
   v=>{v.checklist[0].evidenceNote='short';},
   v=>{v.checklist[0].evidenceReference='';},
   v=>{v.overallNote='';},
 ]){const copy=basic();modify(copy);assert.throws(()=>normalize(copy),RangeError);}
});
test('warning may be signed only if the unpaid amount and follow-up owner/due date remain visible',()=>{
 const approved=normalize(warning());
 assert.equal(approved.outstandingItems.length,1);
 assert.equal(approved.outstandingItems[0].remainingAmount,'25000.00');
 assert.equal(approved.outstandingItems[0].ownerUserId,nancy);
 assert.equal(approved.outstandingItems[0].dueDate,'2026-12-05');
 assert.equal(approved.checklist.filter(x=>x.state==='WARNING').length,1);
});
test('warning with no tracked item and CLEAR with unresolved item fail closed',()=>{
 const w=warning();w.outstandingItems=[];assert.throws(()=>normalize(w),RangeError);
 const c=warning();c.checklist=c.checklist.map(x=>({...x,state:'CLEAR'}));
 assert.throws(()=>normalize(c),RangeError);
});
test('follow-up preserves nonquantifiable document work and rejects fabricated missing quantities',()=>{
 const w=warning();w.outstandingItems[0]={
   ...w.outstandingItems[0],remainingAmount:null,remainingQuantity:null,
   notQuantifiableReason:'Document handover has no monetary amount or physical quantity',
 };
 assert.equal(normalize(w).outstandingItems[0].notQuantifiableReason,
   'Document handover has no monetary amount or physical quantity');
 w.outstandingItems[0].notQuantifiableReason='';
 assert.throws(()=>normalize(w),RangeError);
});
test('reject fake amounts, inappropriate units, unknown company owners and invalid dates at contract level',()=>{
 const bad=[
   x=>{x.remainingAmount='-1';},
   x=>{x.remainingAmount='10.000';},
   x=>{x.remainingAmount='1e5';},
   x=>{x.remainingAmount='NaN';},
   x=>{x.ownerUserId='wrong';},
   x=>{x.dueDate='2026-02-31';},
   x=>{x.dueDate='not-a-date';},
   x=>{x.remainingAmount=null;x.remainingQuantity='5.00';x.quantityUom=null;},
   x=>{x.remainingQuantity=null;x.quantityUom='kg';},
   x=>{x.description='short';},
   x=>{x.reason='';},
 ];
 for(const mutate of bad){const v=warning();mutate(v.outstandingItems[0]);assert.throws(()=>normalize(v),RangeError);}
});
test('historical revisions require explicit reason and preserve old closeout source',()=>{
 const original=prepare({body:warning()});
 const revision=warning();revision.revisionReason='Unpaid invoice amount updated after vendor confirmation';
 const missingReason={...warning(),revisionReason:''};
 assert.throws(()=>normalize(missingReason,true),RangeError);
 assert.equal(normalize(revision,true).revisionReason,revision.revisionReason);
 const later=prepare({id:b,version:2,previousEventId:a,body:revision});
 const state=parseCloseoutEvents([original,later],projectId);
 assert.equal(state.status,'PREPARED');
 assert.equal(state.current.version,2);
 assert.equal(original.newValues.preparation.outstandingItems[0].remainingAmount,'25000.00');
});
test('prepared source and independent two signatures produce a joint result, not archive',()=>{
 const p=prepare({body:warning()});
 const benSig=sign(p,'BEN',ben,b),nancySig=sign(p,'NANCY',nancy,c);
 const before=parseCloseoutEvents([p],projectId);
 assert.equal(before.status,'PREPARED');
 assert.equal(parseCloseoutEvents([p,benSig],projectId).status,'BEN_SIGNED');
 assert.equal(parseCloseoutEvents([p,nancySig],projectId).status,'NANCY_SIGNED');
 const done=parseCloseoutEvents([p,benSig,nancySig],projectId);
 assert.equal(done.status,'JOINTLY_APPROVED');
 assert.equal(done.current.preparation.outstandingItems[0].remainingAmount,'25000.00');
 assert.equal(CLOSEOUT_ENTITY,'PROJECT_OPERATIONAL_CLOSEOUT');
 assert.equal(done.current.signatures.BEN.userId,ben);
 assert.equal(done.current.signatures.NANCY.userId,nancy);
});
test('preparer/self and shared actor may never supply both approvals',()=>{
 const p=prepare();
 assert.throws(()=>parseCloseoutEvents([p,sign(p,'BEN',khaimook,b)],projectId),RangeError);
 assert.throws(()=>parseCloseoutEvents([p,sign(p,'BEN',ben,b),sign(p,'NANCY',ben,c)],projectId),RangeError);
 assert.throws(()=>parseCloseoutEvents([p,sign(p,'BEN',ben,b),sign(p,'BEN',nancy,c)],projectId),RangeError);
});
test('forged source, stale signature or unknown events fail rather than declare joint closure',()=>{
 const p=prepare();
 const cases=[
  [{...p,newValues:{...p.newValues,fingerprint:'a'.repeat(64)}}],
  [{...p,newValues:{...p.newValues,preparedBy:ben}}],
  [p,{...sign(p,'BEN',ben,b),newValues:{...sign(p,'BEN',ben,b).newValues,fingerprint:'b'.repeat(64)}}],
  [p,{...sign(p,'BEN',ben,b),newValues:{...sign(p,'BEN',ben,b).newValues,preparationEventId:d}}],
  [p,{...sign(p,'BEN',ben,b),action:'ARCHIVE_PROJECT'}],
 ];
 for(const rows of cases)assert.throws(()=>parseCloseoutEvents(rows,projectId),RangeError);
});
test('new preparation supersedes both old signatures without erasing their historical record',()=>{
 const p=prepare(),b1=sign(p,'BEN',ben,b),n1=sign(p,'NANCY',nancy,c);
 const revision={...basic(),revisionReason:'Outstanding documents found after joint closure'};
 const p2=prepare({id:d,version:2,previousEventId:p.id,body:revision});
 const state=parseCloseoutEvents([p,b1,n1,p2],projectId);
 assert.equal(state.status,'PREPARED');
 assert.equal(state.current.version,2);
 assert.equal(parseCloseoutEvents([p,b1,n1],projectId).status,'JOINTLY_APPROVED');
});
test('same-timestamp random UUID order cannot invert preparation and Ben/Nancy signatures',()=>{
 const prepared=prepare({id:a}),benSig=sign(prepared,'BEN',ben,b),nancySig=sign(prepared,'NANCY',nancy,c);
 benSig.occurredAt=date;nancySig.occurredAt=date;
 for(const order of [
   [nancySig,prepared,benSig],
   [benSig,nancySig,prepared],
   [prepared,nancySig,benSig],
 ]) {
   const state=parseCloseoutEvents(order,projectId);
   assert.equal(state.status,'JOINTLY_APPROVED');
   assert.equal(state.current.signatures.BEN.userId,ben);
   assert.equal(state.current.signatures.NANCY.userId,nancy);
 }
});
test('same-timestamp successive preparations use explicit version/previous event links',()=>{
 const first=prepare({id:a,body:warning()});
 const priorSign=sign(first,'BEN',ben,b);priorSign.occurredAt=date;
 const newer=prepare({id:d,version:2,previousEventId:a,
   body:{...basic(),revisionReason:'New handover evidence requires another review'}});
 const history=[newer,priorSign,first];
 const state=parseCloseoutEvents(history,projectId);
 assert.equal(state.status,'PREPARED');
 assert.equal(state.current.version,2);
 assert.equal(state.current.signatures.BEN,undefined);
 assert.equal(parseCloseoutEvents([priorSign,first],projectId).status,'BEN_SIGNED');
});
test('duplicate, orphan, forged and impossible causal audit events fail closed',()=>{
 const prepared=prepare({id:a}),sign1=sign(prepared,'BEN',ben,b);
 const cases=[
   [prepared,prepared],
   [sign1],
   [prepared,{...sign1,occurredAt:new Date(date.getTime()-1000)}],
   [prepared,prepare({id:d,version:1})],
   [prepared,prepare({id:d,version:2,previousEventId:a,
     body:{...basic(),revisionReason:'Properly marked revision for testing'}}),
     {...sign1,occurredAt:new Date(date.getTime()+1000)}],
   [prepared,{...sign1,id:prepared.id}],
 ];
 for(const events of cases)
   assert.throws(()=>parseCloseoutEvents(events,projectId),RangeError);
});
test('Ben and Nancy read-only source view displays nonquantified rationale',async()=>{
 const {readFileSync}=await import('node:fs');
 const ui=readFileSync(new URL('../../apps/web/src/projects/ProjectCloseoutPanel.tsx',import.meta.url),'utf8');
 assert.match(ui,/item\.notQuantifiableReason\s*\?/);
 assert.match(ui,/\{t\.nonquant\}: \{item\.notQuantifiableReason\}/);
});

test('preparation fingerprint canonicalizes order of six source rows and followup register',()=>{
 const a=normalize(warning()),b=warning();b.checklist.reverse();
 assert.equal(closeoutFingerprint({projectId,version:1,preparedBy:khaimook,preparation:a}),
  closeoutFingerprint({projectId,version:1,preparedBy:khaimook,preparation:normalize(b)}));
});
