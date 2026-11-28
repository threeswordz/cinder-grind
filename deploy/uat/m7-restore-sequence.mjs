// M7-02 preparation contract. No native transport or executable entry point.
import { verifyRestoreDatabase, verifyRestoredApi, restoreArguments } from './m7-isolated-restore.mjs';
const need = (ok, code) => { if (!ok) throw new Error('M7_SEQUENCE_' + code); };
const digest = /^[a-f0-9]{64}$/;
const fields = ['schemaSha', 'rowsSha', 'documentsSha', 'uploadsSha', 'hrkeysSha'];
const sameContent = (a, b) => fields.every(k => digest.test(a?.[k] ?? '') && a[k] === b?.[k]);
const sameDatabase = (a, b) => a?.cluster === b?.cluster && a?.oid === b?.oid && a?.database === b?.database && a?.role === b?.role;
// Adapter observations must eventually be backed by live catalog, immutable capture,
// checkout, byte inventory and OS process probes; mock results are not native proof.
export function createRestoreSequence(claim, capture, adapter) {
  const { plan, verifyPaths } = claim;
  need(capture?.sha === plan.sha && capture.tree === plan.tree && digest.test(capture.dumpSha ?? '') && sameContent(capture, capture) && capture.sourceDatabase && capture.sourceProcess, 'CAPTURE');
  const expected = structuredClone(capture);
  let attempted = false;
  const verifySource = async () => {
    const s = await adapter.inspectCaptureAndSource();
    need(s?.sha === expected.sha && s.tree === expected.tree && s.dumpSha === expected.dumpSha && sameContent(expected, s) && sameDatabase(expected.sourceDatabase, s.sourceDatabase), 'SOURCE_DRIFT');
    await verifyPaths();
  };
  return async function restoreOnce() {
    need(!attempted, 'ALREADY_ATTEMPTED'); attempted = true;
    await verifySource();
    const absent = await adapter.inspectTargetAbsence(plan);
    need(absent?.databaseAbsent === true && absent.roleAbsent === true && absent.portFree === true && absent.storageEmpty === true, 'PRIOR_TARGET');
    // Native implementation must use create-only provisioning (no IF NOT EXISTS,
    // no role reuse, no cleanup/retry) and reject a concurrent existing target.
    await adapter.provisionFreshTarget(plan);
    const initial = await adapter.inspectDatabase(plan);
    verifyRestoreDatabase(expected.sourceDatabase, initial, plan, true);
    await verifySource();
    const checkDb = async (empty) => {
      const current = await adapter.inspectDatabase(plan);
      need(sameDatabase(initial, current), 'TARGET_DRIFT');
      verifyRestoreDatabase(expected.sourceDatabase, current, plan, empty);
    };
    await checkDb(true);
    // Fixed restore flags; adapter must stream the verified dump and may not
    // substitute a database URL, run migrations, reset, drop or overwrite.
    await adapter.restoreDatabase(plan, restoreArguments(plan), expected.dumpSha);
    await checkDb(false);
    await verifySource();
    // Adapter uses exclusive file creation and complete inventory checks.
    await adapter.restoreStorageNoOverwrite(plan, expected);
    await verifySource();
    await checkDb(false);
    need(sameContent(expected, await adapter.inspectRestoredContent(plan)), 'RESTORED_CONTENT');
    need(await adapter.isPortFree(plan.port) === true, 'PORT_OCCUPIED');
    const process = await adapter.launchPinnedApi(plan);
    verifyRestoredApi(plan, process, await adapter.inspectApi(plan), expected.sourceProcess);
    await verifySource();
    // The next lane still owns authenticated access, denial and history proof.
    return Object.freeze({ status: 'M7_RESTORE_SEQUENCE_CHECKS_COMPLETE', authenticatedVerification: false, milestoneAccepted: false, productionAuthorized: false });
  };
}
