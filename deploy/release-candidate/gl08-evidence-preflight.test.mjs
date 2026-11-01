import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateRecoveryEvidence,exampleShape} from '../recovery/gl08-evidence-preflight.mjs';

const NOW=Date.parse('2026-10-31T12:00:00Z');
const sha='a'.repeat(40),db='b'.repeat(64),docs='c'.repeat(64);
function receipts(){
 return {
  observedAt:'2026-10-31T11:59:00Z',
  manifest:{version:1,recoverySetId:'20261031T010000Z-aaaaaaaaaaaa',
   createdAt:'2026-10-31T01:00:00Z',releaseCommit:sha,storageDeploymentId:'deployment-a',
   documentFileCount:3,
   artifacts:{database:{file:'database.dump',bytes:1000,sha256:db},
    documents:{file:'documents.tar.gz',bytes:1000,sha256:docs}}},
  checks:{manifestVerified:true,documentArchivePathsVerified:true,readyMarkerMatches:true,databaseDumpReadable:true},
  offHost:{verifiedAt:'2026-10-31T02:00:00Z',independentFailureDomain:true,encryptedAtRest:true,
   artifactHashes:{database:db,documents:docs}},
  restore:{recoverySetId:'20261031T010000Z-aaaaaaaaaaaa',startedAt:'2026-10-31T03:00:00Z',
   completedAt:'2026-10-31T05:00:00Z',releaseCommit:sha,sourceStorageDeploymentId:'deployment-a',
   isolatedDestination:true,databaseRestored:true,documentBytesEqual:true,
   applicationReadinessVerified:true,sourceNotMutated:true},
 };
}
const audit=x=>evaluateRecoveryEvidence(x,{now:NOW});
test('complete synthetic receipts never constitute production proof',()=>{
 const r=audit(receipts());
 assert.deepEqual(r.gaps,[]);
 assert.equal(r.status,'RECEIPT_FIELDS_CONSISTENT_INDEPENDENT_VERIFICATION_PENDING');
 assert.equal(r.gatesClosed,0);assert.equal(r.verifiedByIndependentOperator,false);
 assert.equal(r.backupStarted,false);assert.equal(r.restoreStarted,false);
 assert.equal(r.networkRequests,0);assert.equal(r.productionAuthorized,false);
 assert.equal(r.observedRestoreMinutes,120);
});
test('empty store is never substituted for populated Production restore',()=>{
 const x=receipts();x.manifest.documentFileCount=0;
 assert.ok(audit(x).gaps.includes('POPULATED_DOCUMENT_SET_NOT_PROVEN'));
});
test('older than 24h backup or stale local evidence fails closed',()=>{
 const x=receipts();x.manifest.createdAt='2026-10-29T09:00:00Z';
 assert.ok(audit(x).gaps.includes('RECOVERY_POINT_RPO_UNVERIFIED'));
 const y=receipts();y.observedAt='2026-10-30T12:00:00Z';
 assert.ok(audit(y).gaps.includes('SNAPSHOT_TIME_MISSING_OR_STALE'));
 const z=receipts();z.observedAt='2026-10-31T12:10:00Z';
 assert.ok(audit(z).gaps.includes('SNAPSHOT_TIME_MISSING_OR_STALE'));
});
test('RPO age uses the evaluation clock rather than an earlier fresh observation',()=>{
 const x=receipts();
 x.observedAt='2026-10-31T11:01:00Z';
 x.manifest.createdAt='2026-10-30T11:30:00Z';
 const result=audit(x);
 assert.ok(result.gaps.includes('RECOVERY_POINT_RPO_UNVERIFIED'));
 assert.equal(result.evaluatedBackupAgeMinutes,1470);
 const boundary=receipts();boundary.manifest.createdAt='2026-10-30T12:00:00Z';
 assert.deepEqual(audit(boundary).gaps,[]);
 assert.equal(audit(boundary).evaluatedBackupAgeMinutes,1440);
});
test('storage identity follows the canonical recovery manifest identifier constraint',()=>{
 for(const id of ['.deployment','_deployment','-deployment']){
  const x=receipts();x.manifest.storageDeploymentId=id;x.restore.sourceStorageDeploymentId=id;
  assert.ok(audit(x).gaps.includes('MANIFEST_IDENTITY_INVALID'));
 }
});
test('off-host copies must preserve both artifact digests and independent location claim',()=>{
 const x=receipts();x.offHost.artifactHashes.documents='d'.repeat(64);
 assert.ok(audit(x).gaps.includes('OFFHOST_HASH_PAIR_UNVERIFIED'));
 const y=receipts();y.offHost.independentFailureDomain=false;
 assert.ok(audit(y).gaps.includes('OFFHOST_RECOVERY_COPY_UNVERIFIED'));
 const z=receipts();z.offHost.encryptedAtRest=false;
 assert.ok(audit(z).gaps.includes('OFFHOST_RECOVERY_COPY_UNVERIFIED'));
});
test('restore duration, provenance and non-mutation are required',()=>{
 const x=receipts();x.restore.completedAt='2026-10-31T11:30:00Z';
 assert.ok(audit(x).gaps.includes('RESTORE_RTO_TARGET_NOT_MET'));
 const y=receipts();y.restore.sourceStorageDeploymentId='wrong';
 assert.ok(audit(y).gaps.includes('POPULATED_ISOLATED_RESTORE_UNVERIFIED'));
 const z=receipts();z.restore.sourceNotMutated=false;
 assert.ok(audit(z).gaps.includes('POPULATED_ISOLATED_RESTORE_UNVERIFIED'));
});
test('wrong hashes, timestamps and declaration booleans never silently pass',()=>{
 const x=receipts();x.manifest.artifacts.database.sha256='bad';
 assert.ok(audit(x).gaps.includes('PAIRED_ARTIFACT_METADATA_INVALID'));
 const y=receipts();y.checks.manifestVerified='yes';
 assert.ok(audit(y).gaps.includes('BACKUP_VERIFICATION_INCOMPLETE'));
 const z=receipts();z.manifest.createdAt='2026-02-30T01:00:00Z';
 assert.ok(audit(z).gaps.includes('RECOVERY_POINT_RPO_UNVERIFIED'));
 assert.ok(exampleShape().manifest.documentFileCount===null);
});
