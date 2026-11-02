# Offline pre-production prototype freeze evidence preflight

**Status:** preparatory, non-production, evidence **consistency only**. **Authority:** Issue #305 GL07–GL10 pre-production preparation and DEC-042. This checker is intentionally separate from live settings/role grants and from Material Plan A/B/C's guarded code integration (Issue #318 / PR #320). No recurring human UAT during development.

## Purpose and hard limits

\`deploy/uat/prototype-freeze-preflight.mjs\` checks whether a *privately prepared* integrated prototype evidence packet is structurally complete and consistent with a caller-supplied **exact verified main SHA**. It does **not** contact GitHub, connect to a DB, inspect a running environment, access HR records, verify the contents/authenticity of evidence IDs, approve a review, provision a prototype, close GL04/07/08/09/10 or authorize Production. The only possible positive status is \`EVIDENCE_PACKET_STRUCTURALLY_REVIEWABLE\`, never “UAT passed” or “prototype frozen.” Negative results enumerate stable gap codes only.

Do not put real role identities, secrets, HR details, retained MKE/TCJ data or a private packet in a GitHub issue/PR. The evidence references are **opaque private evidence IDs**, not credentials, URLs or proof by themselves. The unit test uses \`SYNTHETIC-ONLY-*\` references which must never be accepted as actual release proof.

## When to use

Only **after** Material Plan A/B/C have been independently reviewed, governed-integrated with exact-main CI, and the remaining launch-critical operational requirements have been integrated. Then the Release Coordinator can prepare the private packet from independently inspected technical receipts for the intended isolated prototype:

\`\`\`sh
node deploy/uat/prototype-freeze-preflight.mjs /private/release/prototype-freeze.json EXACT_MAIN_40_HEX_SHA
\`\`\`

- Exit 0: structurally reviewable **only**; independently inspect underlying evidence and reconcile with live GitHub, deployed API/web/database identities and required scope before deciding freeze.
- Exit 1: one or more named gaps; **do not freeze**.
- Exit 2: invalid argument/input; **do not freeze**.
- CLI never echoes the packet or source file path. It does not rewrite the packet or create any resource.
- CI registers \`node --check\` and \`node --test\` only; it does **not** supply a fake packet or run any real UAT.

## Private packet contract (schemaVersion 1)

Top-level keys: \`schemaVersion\`, \`repository\`, \`release\`, \`scope\`, \`environment\`, \`checks\`, \`recovery\`, \`uat\`, \`production\`. The test file contains a complete **synthetic shape reference**, not a real evidence packet.

| Section | Required evidence shape | Verification owed outside checker |
|---|---|---|
| release | Exact main/runtime SHA, exact-main successful push CI URL/SHA, clean independent A/B/C review receipts on their actual *PR head SHAs*, explicit tree equivalence proof after squash integration, pinned Node 24.21.0/pnpm 12.6.0/PostgreSQL 17.11, migration inventory, known limitations | Fetch actual run, PR reviews/threads/commit trees and code; checker cannot establish review authenticity |
| scope | All 112 preserved role requirement IDs with frozen source digest, explicit Material Plan A/B/C + request/count/weekly/HR1-A/BOQ/procurement scope and separately controlled Accounting/later HR/#245 exclusions | Audit true launch-critical source coverage, safe handoffs and Owner decisions |
| environment | Inspected isolated synthetic Company PROTO_A and negative PROTO_B, two or more Projects, eight business functions (including Porn), separate DB/Documents/key storage, no retained or Production connectivity, no admin self-approval, deployed API/web/schema matching exact SHA | Actually inspect runtime, data/config boundaries and authenticated permissions |
| checks | Exact-main PASS evidence for procurement-stock, material plan issue, return/count, Foreman daily/weekly, BOQ privacy, HR private documents, deny/revoke matrix, trilingual UI, authenticated Chromium and fresh migration/upgrade | Reproduce/independently verify artifacts; transport must be authenticated for browser and negative authorization |
| recovery | Exact release restore; paired DB+Documents, external HR keys, restored authenticated API, byte-equal ordinary/signed/HR documents, preserved history/scope, observed duration and source/target separation | Inspect actual populated isolated restore with checksums, keys, recordings and timestamps |
| uat/production | \`DEFERRED_UNTIL_FROZEN_PROTOTYPE\`, \`authorized:false\`, \`realGlGateClaims:false\` | Full human UAT only **after** prototype freeze; real GL/Production readiness remains separately gated |

A successful unit test validates the evaluator, not the actual ERP. The preflight deliberately fails closed on a missing source role ID, stale/mismatched release, missing mandatory independent review proof, fake generated/partial browser coverage, incomplete restored files or prematurely claimed UAT/Production.

## Predecessors, owners and follow-up

1. **Current blocker:** PR #320 Material Plan A needs mandatory independent Codex review, governed merge, exact-main CI. Stage B and C must follow their own existing gates; this preparation branch does not unblock or modify them.
2. **After A/B/C:** use the existing synthetic/loopback testing and paired DB/Documents/HR-key recovery scripts, and scope/source census in #304. Populate only the private evidence packet from real observed artifacts. Independent reviewer checks evidence authenticity and any role-fit blocker.
3. **Freeze decision:** a separately verified integrated release and isolated runtime may be frozen for **one full consolidated human UAT** under DEC-042. Do not equate this with GL07 actual repository enforcement, hosted backup/restore, MKE/TCJ real onboarding or Production approval. GL01–03 remain the only 3/10 independently verified Production categories until actual new gate receipts exist.

This script is reusable tooling for future evidence reconciliation, not a new module, Company setup or business-rule implementation. It adds no runtime dependency and makes no application schema or ledger changes.
