# Milestone 6 — Guarded populated Mac deployment

Status: source staged for review; **not deployed**, not an accepted milestone, not Production approved.

## Code ownership and sequence

- `deploy/uat/prototype-m6-mac-operator.mjs`: exact-main-only CLI and owner release ticket; no GitHub workflow dispatch, reruns or merges.
- `deploy/uat/prototype-m6-mac-runtime.mjs`: original-Mac identity, UOM receipt, current populated DB and process checks; creates a new M6-only preservation stage; source and document/HR-key backup; custom PostgreSQL dump; exact release checkout/build; separate populated restore + forward-only migration; only then stop the **exact previously owned** API/Web PIDs, migrate source and start release PIDs. Its post-journey inspection checks prior documents, original UOM source snapshot, HR keyring/upload bytes, ciphertext checksum and the preserved dump.
- `deploy/uat/prototype-m6-business-stages.mjs`: guarded scoped Porn/Nancy Finance, Koh private HR attachment and Ben/Nancy Cost/Client BOQ, with sessions revoked. Prior Procurement, Receiving, Subcontract and UOM business journeys are **never replayed**.
- `deploy/uat/prototype-m6-private-stage.mjs` and `prototype-m6-deployment-sequence.mjs`: create-once claim, strict stage ordering, protected private proofs. **Failure means preserve-and-stop, never automatic retry**.

Seven stages: upgrade → configure → finance → hr → boq → preserve → seal. A sealed technical receipt explicitly does **not** claim completion of owner UAT, go-live or Milestone 6 acceptance.

## Before execution

Complete one focused exact-head validation and DEC-022 independent review of the consolidated candidate. Reconcile PR #391 DEC-054 with existing successful #5955 evidence; **do not rerun it** for development. Merge only under normal protected governance following explicit Owner authorization for any necessary expensive full-CI trigger. PR #393 remains draft unless separately authorized.

Execution is blocked until the **same release SHA is the current actual origin/main** and a local owner-supplied mode-0600 private ticket exists at:

`~/Construction-ERP-Prototype-Runtime/m6-release-authorization-private.json`

Minimum exact JSON keys (all required) are:

```json
{
  "releaseSha": "<40 lowercase hex, exact current origin/main>",
  "previousApplicationSha": "9fa0506e9a50fd556f1c4404e4db2e3d88093b85",
  "exactMainIntegrated": true,
  "independentReviewComplete": true,
  "requiredReleaseProofSatisfied": true,
  "ownerApprovedThisOneShot": true,
  "syntheticOnly": true,
  "productionAuthorized": false,
  "reviewEvidenceUrl": "https://github.com/threeswordz/cinder-grind/pull/<actual review PR>",
  "releaseEvidenceUrl": "https://github.com/threeswordz/cinder-grind/commit/<actual release SHA>"
}
```

Those booleans and URLs are **claims to be checked against genuine review/CI/release evidence by the release coordinator**, not a replacement for independent review or a way to bypass required gates. Never create an authorization ticket from an agent's own assertion.

Use the released checkout on the **original Mac** with Node.js 24.21.0 and the existing private prototype fixture. Read-only preflight:

```sh
node deploy/uat/prototype-m6-mac-operator.mjs --inspect <actual-release-sha>
```

Only after explicit authorization for that exact one-shot release:

```sh
node deploy/uat/prototype-m6-mac-operator.mjs --execute <actual-release-sha>
```

The operator does not run any GitHub Actions CI and does not accept a development-branch SHA, a dirty working tree, a different actual `main`, a prior M6 claim, active sessions, foreign/production data, changed predecessor source, or unverified process listener.

## Completed UOM predecessor custody (independent review P1/P2)

The valid finalized UOM predecessor may be **intentionally stopped**: the continuation finalization creates `uom-upgrade/ready.json` after a specific `FINAL_PRESERVATION / RC_UNEXPECTED_DOCUMENT_FILES` failure, without restarting API/Web. M6 inspection must allow this state **only** when the exact original source-owned PID/birth receipts remain privately sealed, **both** recorded PIDs are absent, **both** ports are free, the completed UOM receipt is verified and its exact finalization failure flags match the known path. A partially running/missing/mismatched pair is rejected. M6 must **not** restart predecessor processes or re-run UOM; stopped cutover skips old-process termination and proceeds only after separate populated restore rehearsal and pre-cutover database preservation check.

M6 must compare the **current** HR-key inventory against both `uom-upgrade/file-inventories-private.json` and the matching `uom-upgrade/preservation-private.json` custody, plus the *original preserved* `uom-upgrade/preserved/hrkeys`. Merely hashing whatever HR keys exist at M6 start is insufficient. Any changed keyring, preserved key copy or receipt fails read-only inspection before the create-once claim.

## After execution / failure

- On success, review `m6-upgrade/ready.json`, all six ordered stage receipts and the actual protected Finance/HR/BOQ evidence. Reconcile against M6's exit checklist; close milestone **only after** acceptance.
- After any failure, **do not delete the M6 stage, retry the CLI, restore over the source, or rerun prior business journeys**. Inspect `m6-upgrade/started.json`, recorded phases, process ownership, source DB and the sealed populated dump; request manual recovery-specific assessment.
- This is an isolated synthetic prototype only. Human UAT and production authorization remain false. Existing go-live gates are unaffected.

## Focused local evidence and limitations

Local companion checks: 8/8 one-shot and private-custody tests; 4/4 preservation/source-selection checks. The repository test `deploy/uat/prototype-m6-mac-operator.test.mjs` is committed but exact-head Node/Prisma plus original-Mac integration remain to be run at the justified release gate. No claim of live Mac verification.
