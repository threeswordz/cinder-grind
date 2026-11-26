// Prototype M6: single-use execution sequencing, not a Mac operator or CLI.
// All real I/O is delegated to an independently custody-attested Mac adapter.
// Never starts a server, retries completed stages, or runs CI.
const deny = code => { throw Object.assign(new Error(code), {safeCode: code}); };
const requireCheck = (ok, code) => {if (!ok) deny(code);};
const SHA = /^[a-f0-9]{40}$/;

export const M6_ORDER = Object.freeze([
  'upgrade', 'configure', 'finance', 'hr', 'boq', 'preserve', 'seal',
]);

export function verifyM6ExecutionAuthority(input) {
  requireCheck(input && typeof input === 'object' &&
    SHA.test(input.sourceSha ?? '') && SHA.test(input.releaseSha ?? '') &&
    input.sourceSha !== input.releaseSha &&
    input.isolatedSynthetic === true && input.productionConnected === false &&
    input.exactMainReleased === true && input.independentlyReviewed === true &&
    input.requiredReleaseProofSatisfied === true &&
    input.priorUomReceiptVerified === true &&
    input.originalMacCustodyVerified === true &&
    input.noActiveSessions === true &&
    input.authorizedForOneShot === true &&
    input.noPriorM6Attempt === true,
  'M6_RELEASE_OR_CUSTODY_GATE_UNSATISFIED');
  return {sourceSha: input.sourceSha, releaseSha: input.releaseSha,
    isolatedSynthetic: true, productionAuthorized: false};
}

// Cannot replay after failure. 'claim' MUST be durable, filesystem-exclusive
// create-once, recording the release identity before any mutating action.
export async function executeOneShotM6({inputs, adapter} = {}) {
  const authority = verifyM6ExecutionAuthority(inputs);
  requireCheck(adapter && M6_ORDER.every(k => typeof adapter[k] === 'function') &&
    typeof adapter.readOnlyPreflight === 'function' &&
    typeof adapter.claim === 'function' &&
    typeof adapter.recordPhase === 'function',
  'M6_OPERATOR_ADAPTER_INCOMPLETE');
  const preflight = await adapter.readOnlyPreflight(authority);
  requireCheck(preflight?.sourceSha === authority.sourceSha &&
    preflight?.releaseSha === authority.releaseSha &&
    preflight?.historicalReceiptsPreserved === true &&
    preflight?.snapshotDigestMatched === true &&
    preflight?.runtimeOwned === true,
  'M6_READ_ONLY_PREFLIGHT_UNSATISFIED');
  const claim = await adapter.claim(authority);
  requireCheck(claim?.claimed === true && claim?.releaseSha === authority.releaseSha &&
    claim?.newlyCreated === true, 'M6_CREATE_ONCE_CLAIM_NOT_PROVEN');
  const results = {};
  try {
    for (const name of M6_ORDER) {
      // Seal only AFTER preserved source and protected bytes are verified.
      const result = await adapter[name]({authority, results});
      requireCheck(result?.ok === true && result?.releaseSha === authority.releaseSha,
        'M6_' + name.toUpperCase() + '_UNVERIFIED');
      if (name === 'hr') requireCheck(result.proof?.encryptedAtRestVerified === true &&
        result.proof?.privateNoStoreDownloadVerified === true && result.proof?.maskedHistoryVerified === true &&
        result.proof?.sessionsRevoked === true, 'M6_HR_PRIVACY_PROOF_REQUIRED');
      if (name === 'preserve') requireCheck(result.historicalSubcontractRowsPreserved === true &&
        result.protectedSubcontractEvidencePreserved === true && result.historicalSiteMaterialRowsPreserved === true &&
        result.materialRequestEvidencePreserved === true && result.historicalProcurementStockPreserved === true &&
        result.receivingTransferEvidencePreserved === true && result.originalPopulatedDumpPreserved === true &&
        result.previousHrKeysAndUploadsIntact === true && result.protectedHrEncryptedFileVerified === true &&
        result.oldHistoricalSnapshotPreserved === true && result.historicalHrRowsPreserved === true &&
        result.oneNewHrAttachmentVerified === true, 'M6_FINAL_PRESERVATION_PROOF_REQUIRED');
      results[name] = result;
      if (name !== 'seal') await adapter.recordPhase(name, result);
    }
    return {status: 'M6_ONE_SHOT_DEPLOYMENT_TECHNICAL_EVIDENCE_SEALED',
      releaseSha: authority.releaseSha, stageResultsVerified: M6_ORDER.length,
      humanUatCompleted: false, milestone6Accepted: false,
      productionAuthorized: false, automaticRetryAllowed: false};
  } catch (error) {
    // Never delete the claim, recover from the middle, or silently retry.
    throw Object.assign(new Error('M6_STOP_PRESERVE_STAGE_NO_AUTOMATIC_RETRY'),
      {safeCode: 'M6_STOP_PRESERVE_STAGE_NO_AUTOMATIC_RETRY', cause: error});
  }
}
