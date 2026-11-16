import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {receivingCapture,receivingDue,receivingDeadline,receivingQuantity,receivingEvidence,receivingRevise} from './receiving-contract';
test('receiving clock is exactly 48 elapsed hours and never an approval deadline',()=>{
 const original=new Date('2026-10-31T20:30:00.000Z'),due=receivingDue(original);
 assert.equal(due.toISOString(),'2026-11-02T20:30:00.000Z');
 assert.equal(receivingDeadline(due,null,due),'DUE');
 assert.equal(receivingDeadline(due,null,new Date(+due+1)),'OVERDUE');
 assert.equal(receivingDeadline(due,due),'LINKED_ON_TIME');
 assert.equal(receivingDeadline(due,new Date(+due+1)),'LINKED_LATE');
});
test('receiving accepts precise quantities and rejects lossy, unknown or fabricated state',()=>{
 assert.equal(receivingQuantity('99999999999999.9999'),'99999999999999.9999');
 for(const q of [3,0,'0','1e2','01','-1','1.00001','100000000000000'])assert.throws(()=>receivingQuantity(q));
 assert.equal(receivingQuantity('0',true),'0.0000');
 const input={requestKey:randomUUID(),projectId:randomUUID(),warehouseId:randomUUID(),supplierId:randomUUID(),receivedAt:new Date().toISOString(),receiverName:'Store',reason:'Physical count',qualityRequired:false,lines:[{materialId:randomUUID(),uomId:randomUUID(),observedQuantity:'2',goodQuantity:'1',condition:'DAMAGED',note:'One damaged'}]};
 assert.equal(receivingCapture(input).lines[0]!.goodQuantity,'1.0000');
 assert.throws(()=>receivingCapture({...input,status:'CHECKED'}));
 assert.throws(()=>receivingCapture({...input,lines:[{...input.lines[0],goodQuantity:'3'}]}));
 assert.throws(()=>receivingCapture({...input,lines:[{...input.lines[0],condition:'NORMAL'}]}));
 assert.throws(()=>receivingRevise({requestKey:randomUUID(),expectedVersion:1,reason:'Correction',receiverName:'Store',qualityRequired:false,receivedAt:input.receivedAt,lines:[]}));
 assert.throws(()=>receivingEvidence({requestKey:randomUUID(),expectedVersion:1,reason:'Signed receipt',documentId:randomUUID(),purpose:'RECEIVER_SIGNATURE',signedEvidenceConfirmed:false}));
});
