import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyFinalDocumentDelta,verifyJourneyFlags} from '../uat/prototype-uom-finalize.mjs';

const file=(name,byte='a')=>[name,1,byte.repeat(64)];
const docs=()=>['f1','f2','f3'].map((name,i)=>({
 id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
 storage_key:name,file_size_bytes:1,checksum:String.fromCharCode(97+i).repeat(64)
}));
const originals=[['','directory'],file('old','d')];
const additions=[file('f1','a'),file('f2','b'),file('f3','c')];
const good={definitionBrowserVerified:true,threeLocalesVerified:true,mobileVerified:true,
 wrongActorDenialVerified:true,uncertainResponseReplayVerified:true,sessionsRevoked:true,
 historicalStockAndFinancialRowsPreserved:true,legacyMaterialsNotActivated:true,
 convertedReceivingVerified:true,convertedReservationVerified:true,reservationReleasedWithoutStockEffect:true,
 convertedRequestSourceVerified:true,convertedMovementReportVerified:true,
 convertedApprovedSourcePlanAndIssueVerified:true,convertedPlannedReturnVerified:true,
 convertedOverageVerified:true,actualIntegratedOperationalBrowserReadbackVerified:true,
 newConvertedStockJourneyVerified:true,requestAndReportSessionsRevoked:true,
 ownerCostSelfApprovalUnverified:true,documentIds:docs().map(d=>d.id)};

test('matching new UOM documents preserve every old byte and admit exact expected files',()=>{
 assert.deepEqual(verifyFinalDocumentDelta(originals,[...originals,...additions],docs()),
  {newDocumentCount:3,oldEntryCount:2});
 verifyJourneyFlags(good,good);
});

test('refuse extra directory, file, altered preexisting file, missing and corrupted file',()=>{
 for(const after of [
  [...originals,['newdir','directory'],...additions],
  [...originals,...additions,file('rogue','e')],
  [originals[0],file('old','f'),...additions],
  [...originals,...additions.slice(0,2)],
  [...originals,additions[0],file('f2','f'),additions[2]],
  [...originals,...additions,additions[0]],
 ])assert.throws(()=>verifyFinalDocumentDelta(originals,after,docs()));
});
test('refuse missing expected Document, duplicates and erroneous document checksum',()=>{
 assert.throws(()=>verifyFinalDocumentDelta(originals,[...originals,...additions],docs().slice(0,2)));
 assert.throws(()=>verifyFinalDocumentDelta(originals,[...originals,...additions],[...docs().slice(0,2),docs()[0]]));
 assert.throws(()=>verifyFinalDocumentDelta(originals,[...originals,...additions],docs().map((d,i)=>i===2?{...d,checksum:'f'.repeat(64)}:d)));
});
test('refuse incomplete source, rehearsal, revoked-session or BOQ scope proofs',()=>{
 for(const bad of [{...good,convertedOverageVerified:false},{...good,sessionsRevoked:false},
  {...good,ownerCostSelfApprovalUnverified:false},{...good,newConvertedStockJourneyVerified:false},
  {...good,documentIds:good.documentIds.slice(0,2)}]){
  assert.throws(()=>verifyJourneyFlags(bad,good));
  assert.throws(()=>verifyJourneyFlags(good,bad));
 }
});
