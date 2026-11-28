import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyM6HrHistory,verifyM6HrDownload} from './m6-hr-private-readback.mjs';
const id = n => '00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const item = n => ({id:id(n),version:n,createdAt:'2026-11-25T00:00:00Z'});
const history = items => ({items,nextCursor:null});
const bytes = Buffer.from('synthetic proof');
const headers = {'cache-control':'private, no-store','x-content-type-options':'nosniff','content-type':'text/plain'};
const response = (body=bytes,patch={}) => new Response(body,{headers:{...headers,...patch}});
test('empty, full and suffix masked history',()=>{
  assert.equal(verifyM6HrHistory(history([]),0),true);
  assert.equal(verifyM6HrHistory(history([item(1),item(2)]),2),true);
  assert.equal(verifyM6HrHistory(history([item(2)]),2,1),true);
});
test('reject incomplete page, missing cursor and unknown history',()=>{
  for(const h of [{items:[item(1)],nextCursor:1},{items:[item(1)]},history([])]) assert.throws(()=>verifyM6HrHistory(h,1),/M6_HR_HISTORY_INCOMPLETE/);
});
test('reject duplicate IDs, gaps, malformed dates and private metadata',()=>{
  for(const second of [{...item(2),id:id(1)},item(3),{...item(2),createdAt:'invalid'},{...item(2),fileName:'private'}]) assert.throws(()=>verifyM6HrHistory(history([item(1),second]),2),/M6_HR_HISTORY_NOT_MASKED_OR_CONTIGUOUS/);
});
test('private streaming download proves exact bytes',async()=>assert.deepEqual(await verifyM6HrDownload(response(),bytes),{privateNoStoreVerified:true,exactBytesVerified:true}));
test('reject cacheable or unsafe response headers',async()=>{
  for(const patch of [{'cache-control':'private'},{'cache-control':'public, private, no-store'},{'x-content-type-options':'none'},{'content-type':'text/html'}]) await assert.rejects(verifyM6HrDownload(response(bytes,patch),bytes),/M6_HR_DOWNLOAD_PRIVACY_HEADERS_INVALID/);
});
test('reject altered, truncated and oversized bodies',async()=>{
  await assert.rejects(verifyM6HrDownload(response(Buffer.from('synthetic proog')),bytes),/M6_HR_AUTHORIZED_BYTES_MISMATCH/);
  for(const b of [bytes.subarray(0,2),Buffer.concat([bytes,Buffer.from('x')])]) await assert.rejects(verifyM6HrDownload(response(b),bytes),/M6_HR_DOWNLOAD_LENGTH_MISMATCH/);
});
test('reject contradictory length and cancel oversized stream',async()=>{
  await assert.rejects(verifyM6HrDownload(response(bytes,{'content-length':'1'}),bytes),/M6_HR_DOWNLOAD_LENGTH_MISMATCH/);
  let cancelled=false;
  const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(bytes.length+1));},cancel(){cancelled=true;}});
  await assert.rejects(verifyM6HrDownload(response(stream),bytes),/M6_HR_DOWNLOAD_LENGTH_MISMATCH/);
  assert.equal(cancelled,true);
});
