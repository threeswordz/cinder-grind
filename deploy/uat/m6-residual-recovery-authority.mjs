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
