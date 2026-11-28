// Preparation composition only. No native adapter, CLI, or milestone admission.
const need = (ok, code) => { if (!ok) throw new Error('M7_HARNESS_' + code); };
const safe = e => /^M[67]_[A-Z0-9_]+$/.test(e?.message ?? '') ? e.message : 'M7_HARNESS_UNEXPECTED';
const methods = ['inspectCaptureAndSource','inspectTargetAbsence','provisionFreshTarget','inspectDatabase','restoreDatabase','inspectRestoredContent','isPortFree','launchPinnedApi','inspectApi','stopOwnedApi'];
const sameDb = (a,b) => ['cluster','oid','database','role'].every(k => a?.[k] === b?.[k]);

// The default composition loads the actual lane implementations. Dependency
// injection is for synthetic preparation tests, not evidence or authorization.
export async function createM7PreparationHarness(input, deps) {
  const {manifestArgs,witness,witnessSha256,claimOptions,adapter,verification} = input;
  need(methods.every(k => typeof adapter?.[k] === 'function') && typeof verification?.readPreservation === 'function' && typeof verification?.readSnapshot === 'function' && verification.sourceSnapshot && Array.isArray(verification.expectedAudits), 'ADAPTER');
  const d = deps ?? Object.assign({}, ...await Promise.all([
    import('./m7-capture-contract.mjs'), import('./m7-paired-backup.mjs'),
    import('./m7-isolated-restore.mjs'), import('./m7-restore-sequence.mjs'),
    import('./m7-restored-verification.mjs'), import('./m7-storage-restore.mjs'), import('./m7-authenticated-evidence.mjs')
  ]));
  const sourceWitness = structuredClone(witness), manifest = structuredClone(manifestArgs);
  const binding = await d.bindM7Capture({manifestArgs:manifest,witness:sourceWitness,witnessSha256,verifyManifest:d.verifyM7PairedManifest});
  const capture = binding.capture();
  need(claimOptions?.candidate?.sha === capture.sha && claimOptions.candidate.tree === capture.tree && claimOptions.protectedRoots?.capture === manifest.root, 'CLAIM_BINDING');
  const inputs = structuredClone(claimOptions);
  const fixture = structuredClone(verification.fixture), actors = structuredClone(verification.actors);
  const sourceSnapshot = structuredClone(verification.sourceSnapshot), expectedAudits = structuredClone(verification.expectedAudits);
  let attempted = false;
  return async function runPreparationOnce() {
    need(!attempted, 'ALREADY_ATTEMPTED'); attempted = true;
    let claim, initialDb, launched, launchAttempted = false, primary = null, cleanup = null, preservation = null, result;
    const inspectSource = async () => {
      await binding.reverify();
      const observed = await adapter.inspectCaptureAndSource();
      binding.assertObservation(observed);
      need(['databaseIdentitySha256','storageIdentitySha256','quiescenceReceiptSha256','stateSha256'].every(k => /^[a-f0-9]{64}$/.test(sourceWitness[k] ?? '') && observed[k] === sourceWitness[k]),'SOURCE_WITNESS_DRIFT');
      return observed;
    };
    try {
      await inspectSource();
      claim = await d.claimRestoreTarget(inputs);
      const {plan} = claim;
      const target = binding.verificationTarget(plan,'correct');
      const wrapped = Object.fromEntries(methods.map(k => [k,(...args) => adapter[k](...args)]));
      wrapped.inspectCaptureAndSource = inspectSource;
      const restoreStorageOnce = d.createM7StorageRestore({claim,captureRoot:manifest.root,expectedInventories:manifest.expectedInventories,reverifyCapture:binding.reverify});
      wrapped.restoreStorageNoOverwrite = async (p,expected) => {
        need(p === plan && ['sha','tree','dumpSha','schemaSha','rowsSha','documentsSha','uploadsSha','hrkeysSha'].every(k => expected?.[k] === capture[k]),'STORAGE_BINDING');
        const restored = await restoreStorageOnce();
        need(restored.status === 'M7_STORAGE_RESTORE_BYTES_VERIFIED' && restored.rootsVerified === 3,'STORAGE_INCOMPLETE');
        return restored;
      };
      wrapped.inspectDatabase = async p => {
        const db = await adapter.inspectDatabase(p);
        if (!initialDb) initialDb = structuredClone(db);
        else need(sameDb(initialDb,db),'TARGET_DB_DRIFT');
        return db;
      };
      wrapped.launchPinnedApi = async p => {
        launchAttempted = true;
        launched = structuredClone(await adapter.launchPinnedApi(p));
        return structuredClone(launched);
      };
      const restore = await d.createRestoreSequence(claim,capture,wrapped)();
      need(restore.status === 'M7_RESTORE_SEQUENCE_CHECKS_COMPLETE' && launched && initialDb,'RESTORE_INCOMPLETE');
      const inspectTarget = async () => {
        await claim.verifyPaths();
        await inspectSource();
        const db = await adapter.inspectDatabase(plan);
        need(sameDb(initialDb,db),'TARGET_DB_DRIFT');
        d.verifyRestoreDatabase(capture.sourceDatabase,db,plan,false);
        const observed = await adapter.inspectApi(plan);
        d.verifyRestoredApi(plan,launched,observed,capture.sourceProcess);
        need(observed.keyMode === 'correct' && observed.manifestSha === binding.manifestSha,'API_KEY_OR_MANIFEST_DRIFT');
        return {...target,isolated:true};
      };
      const probe = d.createM7AuthenticatedEvidenceProbe({sourceSnapshot,expectedAudits,actors,readSnapshot:async()=>{await inspectTarget();return verification.readSnapshot(plan,structuredClone(initialDb));},verifyHttp:d.verifyM7Restored});
      result = await probe({target,fixture,actors,inspectTarget,readPreservation:verification.readPreservation,fetchImpl:verification.fetchImpl,mode:'correct'});
      need(result.status === 'M7_AUTHENTICATED_EVIDENCE_PASS' && result.sessionProof?.newRevokedSessions === 4 && result.sessionProof?.activeSessions === 0,'VERIFICATION_INCOMPLETE');
      await inspectTarget();
    } catch (e) { primary = safe(e); }
    finally {
      // Adapter must identify only its owned process; no generic kill, drop or retry.
      if (launchAttempted) {
        try { need(await adapter.stopOwnedApi(claim.plan,launched) === true && await adapter.isPortFree(claim.plan.port) === true,'API_CLEANUP'); }
        catch (e) { cleanup = safe(e); }
      }
      try { await inspectSource(); if (claim) await claim.verifyPaths(); }
      catch (e) { preservation = safe(e); }
    }
    return Object.freeze({status:primary || cleanup || preservation ? 'M7_PREPARATION_COMPOSITION_BLOCKED' : 'M7_PREPARATION_COMPOSITION_PASS',primary,cleanup,preservation,verificationCode:/^M7_VERIFY_[A-Z_]+$/.test(result?.httpCode ?? '') ? result.httpCode : null,persistedCode:/^M7_[A-Z0-9_]+$/.test(result?.code ?? '') ? result.code : null,actualCaptureVerified:false,nativeRecoveryVerified:false,milestone7Accepted:false,productionAuthorized:false});
  };
}
