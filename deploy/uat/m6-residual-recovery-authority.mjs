// Event294 exact recovery anchor; never substitute a different failed attempt.
export const recoveryAnchor=Object.freeze({
 previousApplicationSha:'70013b5139292ef33563447f8937c8f132feabd2',
 correctedApplicationSha:'3e35105edac7151aeca800c1175af736a99f6009',
 failedOperatorSha:'a67eb73e7c1a144e31b6e6735d7ffa8d510f0181',
 attemptSha256:'8734a5bd657b48bd146c3200279f551da37fe2d0c3df2bacb818966379b381e4',
 blockedSha256:'a0245e8978a81fa6f7bf559cc63e34f4669e7502ca7e81cce1516b28fc821774',
 snapshotSha256:'66e82d6c993f98a3d77a78a1acacc84d1f49692af0170a79b5b7c3b3fb44aafc',
 previousSessionRows:134
});
export function hasEvent294Authority(a){
 return a?.applicationSha===recoveryAnchor.correctedApplicationSha&&
 a.recoveryAttemptSha256===recoveryAnchor.attemptSha256&&
 a.recoveryBlockedSha256===recoveryAnchor.blockedSha256&&
 a.recoverySnapshotSha256===recoveryAnchor.snapshotSha256&&
 a.ownerAuthorizedEvent294Continuation===true&&
 a.retainedMutationAuthorized===false&&a.productionAuthorized===false&&
 a.database==='m6_successor_rehearsal';
}
export function matchesSupplierApplication(a){
 return a?.applicationSha===recoveryAnchor.previousApplicationSha||hasEvent294Authority(a);
}
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
export function validateRecoveredDispatch(plan,authority,recovered){
 const spec=plan?.uploads?.find(x=>x.key==='dispatch');
 if(!hasEvent294Authority(authority)||!recovered||!spec||plan.existingDispatchId!==null||plan.existingAckId!==null||plan.expectedNewDispatchEvents!==2||plan.uploads.length!==5||!uuid(recovered.id)||!uuid(recovered.storageKey)||recovered.id===plan.conditionDocumentId||recovered.entityId!==plan.orderId||spec.entityId!==plan.orderId||spec.entityType!=='PURCHASE_ORDER'||spec.actor!=='JAI'||!uuid(spec.actorUserId)||recovered.sha256!==spec.sha256||recovered.size!==spec.size||!(/^[a-f0-9]{64}$/.test(recovered.sha256))||!Number.isSafeInteger(recovered.size)||recovered.size<=0||recovered.size>1048576)throw Object.assign(Error('M6_RECOVERY_DISPATCH_BINDING'),{safeCode:'M6_RECOVERY_DISPATCH_BINDING'});
 return structuredClone(recovered);
}
