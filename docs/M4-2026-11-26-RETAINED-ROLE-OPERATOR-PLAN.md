# M4 retained-role technical readback — operator handoff

**Preparation only; no deployed target or access authority has been verified.** 26 Nov 2026 SGT. Draft [PR #455](https://github.com/threeswordz/cinder-grind/pull/455), candidate `0bcc355c0149197c13a90b0c652452861496578e`, base `040395bc7b0dedd40207f91f743bc2efc1584622`. Exact focused [PDF evidence](https://github.com/threeswordz/cinder-grind/actions/runs/45755656135) passed; independent [review quota blocked](https://github.com/threeswordz/cinder-grind/pull/455#issuecomment-7182744339). Latest current-source full run45755597615 stopped DRAFT_FOCUSED_ONLY. No change to source or approval. This document is an index, not a new test runner or acceptance register.

## 0. Mandatory operator preflight

- Owner or authorized operator must identify the non-Production target, its **actual** running application identity, approved source and exact integrated tree/receipt; a local checkout SHA or health response alone is not deployed identity.
- Confirm target custody, separate Company/Project scope and operator access authority before login. Retained MKE/TCJ roles are not the isolated PROTO_A/PROTO_B synthetic actors. Never use synthetic proof as actual retained-role proof.
- On the Mac, safe checkout inventory only: `git -C ~/construction-erp rev-parse HEAD`, `git -C ~/construction-erp status --short`, `git -C ~/construction-erp branch --show-current`. These do not establish running app identity, target access or grants. Do not checkout/change an active worktree, start or restart a service, migrate, restore, edit grants, inspect secrets or use Production.
- Existing prototype-target-preflight.mjs is restricted to synthetic target manifests; do not repurpose it to certify retained users. Existing prototype-m6-mac-preflight.mjs checks preserved synthetic M6 source only; do not run it merely to claim M4 readback.
- Stop if the target is unknown, source mismatches, a real role is absent, authorization is missing, a record fixture is absent or a check needs a write. Record BLOCKED with reason, not PASS. Use existing permitted read-only records and normal authorized login sessions; never share passwords, session tokens, HR attachments, financial details or secret file contents in GitHub.

## 1. Complete assignment of bounded IDs

The original [execution register](M4-2026-11-26-RETAINED-UAT-EXECUTION-REGISTER.csv), blob `4e791550d556faba3cd46b8a37e65c1797adef9d`, is the sole row-level record. All112 IDs unique, all formal NO; 70 bounded rows, 42 future preserved. The following **primary row ownership** is disjoint; cooperating actors may participate across lanes. A lane is not an acceptance claim.

| Lane | Primary responsibility | Bounded rows | Requirement IDs |
|---|---|---:|---|
| A | Purchasing | 14 | PUR01, PUR03, PUR04, PUR05, PUR07, PUR08, PUR09, PUR10, PUR12, PUR13, PUR14, PUR15, JAI-ASSET-01, JAI-SCOPE-01 |
| B | Store, materials and suppliers | 31 | PM01, PM02, PM04, PM05, PM06, PM07, PM08, PM09, PM10, PM11, PM12, PM13, PM15, PM16, SS01, SS02, SS03, SS04, SS05, SS06, SS07, SS08, SS09, SS10, SS11, SS12, SS14, SS16, SS17, SS18, SS-PLAN-01 |
| C | Project operations and GM | 15 | BEN01, BEN02, BEN04, BEN-BASE-01, BEN-BASE-02, BEN-BASE-03, BEN-BASE-04, BEN-BASE-05, BEN-BASE-06, BEN-BASE-07, FM01, FM02, FM03, FM04, FM05 |
| D | Finance, HR and protected visibility | 10 | NANCY-01, NANCY-04, NANCY-05, NANCY-07, NANCY-12, PORN-SUB-01, PORN-BOQ-01, PORN-HR-01, KOH-01, KOH-02 |

## 2. Coordinated read-only witnesses (after authorized target confirmation)

| Group | Actual positive witnesses | Actual negative witnesses / stop condition |
|---|---|---|
| A — Jai + Ben | Jai scoped purchasing, existing quote/PO revisions and approved documents, Company-specific K-/T- identity, commercial/delivery fields, existing dispatch and cancellation evidence; Ben existing independent approval eligibility and prior approval history | Unauthorized Company/Project or document access denied using a known existing comparison record; no new PO, cancellation, send or approval |
| B — Store + Khaimook + Jai | Active assigned site/warehouse, PR line decisions and prior correction history, material custody/issue/return/transfer records, supplier claim/replacement or return evidence, stock and approved-plan views | Known unassigned Project/Company denial, no unauthorized amounts, no new GR, stock movement, claim or Finance effect |
| C — Foreman + Khaimook + Ben + Nancy | Current report and linked review history, approved progress evidence, closeout records, separate BOQ disclosure and stock-count schedule eligibility | Foreman purchasing/adjustment denial; known unauthorized Project and restricted BOQ money denial; no new report, project closure or approval |
| D — Nancy + Porn + Koh | Effective Company/Project and HR scope; existing allowed operational totals, certification and HR metadata; separate finance/HR access boundaries | Known foreign or unauthorized resource denied; no payroll, AP, payments, HR record edits, private file export or new grants |

For every actor first establish active role, linked Employee, assigned Company/Project and existing workflow eligibility, then observe positive and negative scope. A missing positive control makes negative evidence inconclusive. Do not execute state-changing business journeys on retained data under readback authority. Existing synthetic test receipts cover only the behaviors demonstrated by those receipts. Comprehensive human UAT remains deferred under DEC-042.

## 3. Evidence recording

Use original row IDs. Record actual deployed SHA, environment classification, redacted Company/Project and actor references, expected and observed result, known positive/negative control provenance, audit/evidence reference and SGT date. Record NOT_RUN or BLOCKED when needed. Do not populate acceptance_signoff_ref or formal_acceptance without the appropriate real acceptance decision. Preserve all 42 future requirements and six approved scope boundaries; mixed rows may have only existing operational readback, not the deferred write/policy.

## 4. Release and countdown

1. Independent DEC-022 review of exact draft candidate once capacity returns. Correct only verified defects and perform focused validation as needed.
2. Fresh specific #384 authorization for final full CI, Ready and guarded integration after clean review. Previous authorization at 9482cd57 is nontransferable. No rerun merely to debug or obtain review.
3. Verify main integration identity, then separately authorize any required non-Production deployment/retained readback. No Production.
4. Reconcile actual results to the canonical 112-row register and #414; close packages only with appropriate evidence and Owner decision. This preparation does not retire any hours. M4 10.5h, combined prototype 238h, ERP 1733h. Formal prototype4/8, GL3/10, M4 packages0/8.
