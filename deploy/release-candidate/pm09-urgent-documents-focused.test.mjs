import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
 URGENT_DOC_ENTITY, URGENT_DOC_REGISTER,URGENT_DOC_SUBMIT,URGENT_DOC_RETURN,URGENT_DOC_CLOSE,
 URGENT_DOC_WINDOW_MS,urgentDueAt,urgentIssueEvidence,urgentSnapshotDigest,
} from '../../apps/api/src/inventory/urgent-material-issue-contract.ts';

const mk=id=>('00000000-0000-4000-8000-'+String(id).padStart(12,'0'));
const at=t=>new Date(t);
const posted=at('2026-11-20T08:00:00.000Z');
const due='2026-11-22T08:00:00.000Z';
const source=[
{id:mk(1),action:URGENT_DOC_REGISTER,actorUserId:mk(11),occurredAt:at('2026-11-20T08:01:00.000Z'),
 newValues:{sourcePostedAt:posted.toISOString(),dueAt:due,reason:'Prevent damage from flooding',
 authority:'DOCUMENT_TRACKING_ONLY_NO_STOCK_POSTING'}},
];
const doc=(id=21)=>({id:mk(id),checksum:'a'.repeat(64),uploadedAt:'2026-11-21T00:00:00.000Z',fileSizeBytes:120,linkIds:[mk(31),mk(32)]});
const digest=urgentSnapshotDigest([doc()]);
const submit=(prev=mk(1),time='2026-11-21T12:00:00.000Z')=>({
 id:mk(2),action:URGENT_DOC_SUBMIT,actorUserId:mk(11),occurredAt:at(time),
 newValues:{previousEventId:prev,completionNote:'All documents linked for check',
 documentIds:[mk(21)],evidenceFingerprint:digest,docsUploadedByDeadline:true},
});
const close=(action=URGENT_DOC_CLOSE,time='2026-11-21T12:10:00.000Z')=>({
 id:mk(3),action,actorUserId:mk(12),occurredAt:at(time),
 newValues:{previousEventId:mk(2),reviewedSubmissionEventId:mk(2),note:'Independently checked source documents',evidenceFingerprint:digest},
});
test('PM09 uses exactly 48 elapsed hours including weekends and holidays',()=>{
 assert.equal(urgentDueAt(posted),due);
 assert.equal(urgentDueAt(at('2026-12-25T23:59:59.000Z')),'2026-12-27T23:59:59.000Z');
 assert.equal(URGENT_DOC_WINDOW_MS,172800000);
 assert.equal(URGENT_DOC_ENTITY,'MATERIAL_ISSUE_URGENT_DOCS');
});
test('PM09 canonical source snapshot is sorted and byte identity changing invalidates',()=>{
 assert.equal(urgentSnapshotDigest([doc(21),doc(22)]),urgentSnapshotDigest([doc(22),doc(21)]));
 assert.notEqual(urgentSnapshotDigest([doc()]),urgentSnapshotDigest([{...doc(),checksum:'b'.repeat(64)}]));
 assert.notEqual(urgentSnapshotDigest([doc()]),urgentSnapshotDigest([{...doc(),linkIds:[mk(31),mk(33)]}]));
 assert.throws(()=>urgentSnapshotDigest([]),RangeError);
 assert.throws(()=>urgentSnapshotDigest([doc(),doc()]),RangeError);
});
test('PM09 register, submit, Ben cannot automatically close; independent Khaimook decision',()=>{
 assert.equal(urgentIssueEvidence(posted,[]),null);
 let registered=urgentIssueEvidence(posted,source);
 assert.equal(registered.status,'OPEN');
 assert.equal(registered.sourcePostedAt,posted.toISOString());
 assert.equal(registered.dueAt,due);
 let submitted=urgentIssueEvidence(posted,[submit(),...source]);
 assert.equal(submitted.status,'SUBMITTED');
 let completed=urgentIssueEvidence(posted,[close(),submit(),...source]);
 assert.equal(completed.status,'CLOSED');
 assert.equal(completed.onTime,true);
 assert.equal(completed.lastEventId,mk(3));
 assert.throws(()=>urgentIssueEvidence(posted,[{...close(),actorUserId:mk(11)},submit(),...source]),RangeError);
});
test('PM09 late papers can close with permanent late evidence; no automatic time waiver',()=>{
 const actual=urgentIssueEvidence(posted,[close(URGENT_DOC_CLOSE,'2026-11-23T12:10:00.000Z'),
 submit(mk(1),'2026-11-23T12:00:00.000Z'),...source]);
 assert.equal(actual.status,'CLOSED');assert.equal(actual.onTime,false);
 const filesLate=urgentIssueEvidence(posted,[close(),{
 ...submit(),newValues:{...submit().newValues,docsUploadedByDeadline:false}},...source]);
 assert.equal(filesLate.onTime,false);
});
test('PM09 rejects fork, orphan, replay, wrong source clock and changed document fingerprint',()=>{
 assert.throws(()=>urgentIssueEvidence(posted,[...source,...source]),RangeError);
 assert.throws(()=>urgentIssueEvidence(posted,[{...submit(),newValues:{...submit().newValues,previousEventId:mk(44)}},...source]),RangeError);
 assert.throws(()=>urgentIssueEvidence(posted,[submit(),submit(),...source]),RangeError);
 assert.throws(()=>urgentIssueEvidence(posted,[{...source[0],newValues:{...source[0].newValues,dueAt:'2026-11-23T08:00:00.000Z'}}]),RangeError);
 assert.throws(()=>urgentIssueEvidence(posted,[{...close(),newValues:{...close().newValues,evidenceFingerprint:'f'.repeat(64)}},submit(),...source]),RangeError);
 assert.throws(()=>urgentIssueEvidence(posted,[close(),...source]),RangeError);
});
test('PM09 returned proof can be resubmitted; no silent deletion of earlier audit events',()=>{
 const returned=close(URGENT_DOC_RETURN);
 const resubmitted={...submit(mk(3),'2026-11-21T13:00:00.000Z'),id:mk(4)};
 const closed={...close(URGENT_DOC_CLOSE,'2026-11-21T14:00:00.000Z'),id:mk(5),
 newValues:{...close().newValues,previousEventId:mk(4),reviewedSubmissionEventId:mk(4)}};
 const out=urgentIssueEvidence(posted,[closed,resubmitted,returned,...source,submit()]);
 assert.equal(out.status,'CLOSED');assert.equal(out.lastEventId,mk(5));assert.equal(out.onTime,true);
});

test('PM09 rejects a stale CLOSE from an earlier submission even with identical document digest',()=>{
 const returned=close(URGENT_DOC_RETURN);
 const next={...submit(mk(3),'2026-11-21T13:00:00.000Z'),id:mk(4)};
 const stale={...close(URGENT_DOC_CLOSE,'2026-11-21T14:00:00.000Z'),id:mk(5),
   newValues:{...close().newValues,previousEventId:mk(4),reviewedSubmissionEventId:mk(2)}};
 assert.throws(()=>urgentIssueEvidence(posted,[stale,next,returned,submit(),...source]),RangeError);
});

test('PM09 protected document read fails closed when a linked source permission is revoked',()=>{
 const service=readFileSync(new URL('../../apps/api/src/inventory/urgent-material-issue-documents.service.ts',import.meta.url),'utf8');
 const read=service.slice(service.indexOf('  async read('),service.indexOf('  async register('));
 assert.ok(read.length>300);
 assert.match(read,/await this\.snapshot\(currentAuth,issue\.projectId,id,state\.documentIds,issue\.postedAt!,this\.prisma\)/);
 assert.doesNotMatch(read,/catch\s*\{/,'a denied source must not be converted into stale packet metadata');
 assert.ok(read.indexOf('await this.snapshot(')<read.indexOf('...state,sourceCurrent'));
 assert.ok(service.includes("PM09_EVIDENCE_SOURCE_NOT_AUTHORIZED"));
 assert.ok(service.includes("this.documents.filterSourceDocuments(auth,projectId,rows"));
});
