import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {
  ss02Decision, ss02Propose, ss02Replay, type Ss02Case,
} from './material-code-request-contract';

const companyId=randomUUID(),projectId=randomUUID(),requestId=randomUUID();
const store=randomUUID(),pm=randomUUID(),creator=randomUUID(),materialId=randomUUID();
const request={
  requestedName:'Galvanized coupling',suggestedCode:'MAT-GAL-1',
  suggestedUomCode:'EA',requestReason:'Needed for site installation',
};
const time=(offset:number)=>new Date(Date.UTC(2026,10,24,1,0,offset));
function event(action:string,version:number,status:string,actorUserId:string,
  previousEventId:string|null, pmUserId:string|null,
  creatorUserId:string|null, linkedMaterialId:string|null){
  const id=randomUUID();
  return {id,entityId:requestId,actorUserId,action,occurredAt:time(version),
    newValues:{requestId,companyId,projectId,...request,requestedByUserId:store,
      pmUserId,creatorUserId,linkedMaterialId,status,version,previousEventId,
      effect:'NO_MATERIAL_WRITE'}};
}
const first=event('REQUEST',1,'PENDING_PM',store,null,null,null,null);
const second=event('PM_APPROVE',2,'PENDING_CREATOR',pm,first.id,pm,null,null);
const third=event('CREATOR_LINK',3,'COMPLETED',creator,second.id,pm,creator,materialId);

test('SS02 approves independent Store→PM→creator chain, preserving canonical material link',()=>{
  const state=ss02Replay([third,first,second],companyId,projectId,requestId);
  assert.equal(state?.status,'COMPLETED');
  assert.equal(state?.version,3);
  assert.equal(state?.requestedByUserId,store);
  assert.equal(state?.pmUserId,pm);
  assert.equal(state?.creatorUserId,creator);
  assert.equal(state?.linkedMaterialId,materialId);
  assert.equal(state?.lastEventId,third.id);
  assert.equal(state?.requestedName,request.requestedName);
});

test('SS02 denies maker self-review and reviewer self-creation',()=>{
  const samePm=event('PM_APPROVE',2,'PENDING_CREATOR',store,first.id,store,null,null);
  assert.throws(()=>ss02Replay([first,samePm],companyId,projectId,requestId),
    /SS02_HISTORY_ILLEGAL_STAGE/);
  const selfCreator=event('CREATOR_LINK',3,'COMPLETED',pm,second.id,pm,pm,materialId);
  assert.throws(()=>ss02Replay([first,second,selfCreator],companyId,projectId,requestId),
    /SS02_HISTORY_ILLEGAL_STAGE/);
});

test('SS02 refuses fork, missing event, tampered project and changed immutable request',()=>{
  const copied=event('PM_RETURN',2,'RETURNED',pm,first.id,pm,null,null);
  assert.throws(()=>ss02Replay([first,second,copied],companyId,projectId,requestId),
    /SS02_HISTORY_INVALID/);
  assert.throws(()=>ss02Replay([second],companyId,projectId,requestId),
    /SS02_HISTORY_VERSION_GAP|SS02_HISTORY_ILLEGAL_STAGE|SS02_HISTORY_TAMPER/);
  const foreign=structuredClone(second);
  foreign.newValues.projectId=randomUUID();
  assert.throws(()=>ss02Replay([first,foreign],companyId,projectId,requestId),
    /SS02_HISTORY_INVALID/);
  const altered=structuredClone(second);
  altered.newValues.requestedName='Different material';
  assert.throws(()=>ss02Replay([first,altered],companyId,projectId,requestId),
    /SS02_HISTORY_TAMPER/);
});

test('SS02 returned requests are terminal; no creator may link afterward',()=>{
  const returned=event('PM_RETURN',2,'RETURNED',pm,first.id,pm,null,null);
  assert.equal(ss02Replay([first,returned],companyId,projectId,requestId)?.status,'RETURNED');
  const illegal=event('CREATOR_LINK',3,'COMPLETED',creator,returned.id,pm,creator,materialId);
  assert.throws(()=>ss02Replay([first,returned,illegal],companyId,projectId,requestId),
    /SS02_HISTORY_ILLEGAL_STAGE/);
});

test('SS02 proposal and decision reject unknown fields, control chars and missing canonical id',()=>{
  assert.deepEqual(ss02Propose(request),request);
  assert.throws(()=>ss02Propose({...request,masterMaterialManage:true}),/SS02_REQUEST_INVALID/);
  assert.throws(()=>ss02Propose({...request,requestedName:' A\nB'}),/SS02_REQUEST_INVALID/);
  assert.throws(()=>ss02Decision({action:'CREATOR_LINK',expectedVersion:2,
    expectedEventId:second.id,note:'Linked created record'}),/SS02_DECISION_INVALID/);
  assert.throws(()=>ss02Decision({action:'PM_APPROVE',expectedVersion:1,
    expectedEventId:first.id,note:'Approved by PM',createdMaterialId:materialId}),
    /SS02_DECISION_INVALID/);
  const accepted=ss02Decision({action:'PM_APPROVE',expectedVersion:1,
    expectedEventId:first.id,note:'Approved by PM'});
  assert.equal(accepted.createdMaterialId,null);
});

test('SS02 no history returns null, never fabricates an approved request',()=>{
  assert.equal(ss02Replay([],companyId,projectId,requestId),null);
});
