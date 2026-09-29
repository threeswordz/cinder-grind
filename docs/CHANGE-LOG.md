## 2026-09-29 — V0.5-A completed; V0.5-B pre-flight started

- Stage A PR #104 squash-merged as `af1a3f4953af524110dc4305a061099f4fa80388`; final push CI #1696, PR CI #1697, clean exact-head review and post-merge main CI #1698 passed; Issue #103 closed.
- Opened Issue #105 and branch `v0.5-b-agreement-work-orders` from that exact green checkpoint.
- Added `docs/V0.5-B-PREFLIGHT.md` for configured agreement approval, retained non-commercial administrative revisions, agreement cancellation guards and agreement-local Work Orders with maker-checker and atomic allocation ceilings.
- No new dependency or paid service is introduced. Claims, certification/retention, Variations/reporting, Finance/payment, retention release, tax/FX, accounting and cost recognition remain deferred; Committed, Actual and Paid Cost remain separate.

## 2026-09-29 — V0.5-A Subcontractor Register / Agreement Foundation under validation

- Entry-gate PR #102 merged as `5b67832079ef6ded86bc79f997d8115835d0c55e`; post-merge main CI #1611 passed and Issue #98 closed before Stage A began.
- Issue #103, branch `v0.5-a-subcontract-foundation` and PR #104 implement the Company-owned Subcontractor register plus Project-scoped agreement Draft identity/scope/status under AC-V05-001–005 and BR-V05-01–05/19–20.
- Source-controlled schema/migrations, six permissions, audit, `SCYYMM-###` numbering, replay-safe create keys, backend Project access, responsive UI, PostgreSQL integration and live HTTP Stage-A acceptance are included. Agreement approval/Work Orders and all later V0.5 stages remain out of scope.
- Code/test head `83e73f47f10953deed06479ad8b9cae0a9ed139e` passed full CI #1653. Exact-head documentation CI/review/merge and post-merge main CI remain before V0.5-B.

## 2026-09-29 — V0.5 entry-gate baseline approved by Product / Business Owner

- The owner completed review and approved the PR #100 / #101 proposal package as written, with no amendments: Scope; AC-V05-001–030; BR-V05-01–20 / D05-01–11; data/API/test baselines; stages; 19–29 engineering-day estimate and separate 1–2 business-day human UAT window; exclusions and deferrals. DEC-014 records the exact instruction and interpretation.
- Entry-gate approval PR exact-head CI/review/merge, post-merge `main` CI and Issue #98 closure remain required before V0.5-A pre-flight. Human V0.5 UAT and release acceptance remain separate.

## 2026-09-29 — V0.5 entry-gate proposal prepared (approval pending)

- Proposed `docs/V0.5-SCOPE.md`, `docs/V0.5-ACCEPTANCE-CRITERIA.md` and `docs/V0.5-BUSINESS-RULES.md` map SUB-001–010/RPT-007 into reviewable scope, 30 proposed AC, 20 proposed BR, technical baselines, build stages and deferrals under Issue #98.
- All D05-01–11 choices remain unapproved. V0.5-A pre-flight/implementation is blocked until explicit Product / Business Owner approval and entry-gate CI/review/merge/post-merge main validation. DEC-008 remains active.

## 2026-09-29 — V0.4 release closed; V0.5 Subcontracts entry gate drafted

- V0.4 acceptance PR #97 squash-merged to `main` as `c846068c59cf20ab74f3b802cf4eacbd262aaba9`; Issue #96 closed. Exact-head branch CI #1563 and PR CI #1564 passed; post-merge main CI #1565 passed. V0.4 release exit is complete.
- V0.5 entry-gate Issue #98 opened. `docs/V0.5-ENTRY-GATE-DRAFT.md` translates SUB-001–010 and RPT-007 into proposed scope/acceptance areas, technical boundaries and unresolved decisions. It is not approved and authorizes no V0.5 implementation.
- Retention release, tax/FX, accounting and cost recognition remain deferred. DEC-008 applies; Committed, Actual and Paid Cost remain separate.

## 2026-09-29 — V0.4 Inventory Product / Business Owner acceptance

- Product / Business Owner explicitly accepted the V0.4 UAT walkthrough and directed the next gated step; exact instruction is recorded in `docs/V0.4-UAT.md` and Issue #96.
- Accepted technical checkpoint `1511939701cb6c8c0c855cbd378125db6f12b461` passed post-merge main CI #1558, including the 40-check live HTTP acceptance. No open issues or PRs at acceptance; no blocking business defect or workaround reported with the acceptance.
- AC-V04-031 owner decision is recorded; acceptance-document PR/CI/merge/post-merge validation remains to close the repository release record.
- Next position: V0.5 Subcontracts Release Entry Gate. V0.5 implementation requires separate approved scope, acceptance criteria, business rules and technical baselines; DEC-008 and Committed/Actual/Paid Cost separation remain in force.

## 2026-09-28 — V0.4-D completed; V0.4-E pre-flight started

- V0.4-D PR #91 squash-merged as `941e2e9c2966bac66ea1d01b34cb39fb5ce75bdd`; Issue #89 auto-closed.
- Exact-head Stage-D push CI #1490 and PR CI #1491 passed before merge; all review threads were resolved.
- Post-merge main CI #1492 passed, including migration, full workspace/PostgreSQL regression and live HTTP acceptance.
- Stage-D hardening preserved the single immutable ledger, corrected Reservation→Issue retained-history cardinality, standardized Return/Issue reversal lock ordering and serialized Warehouse archive races across Receipt/Return/Issue-reversal positive-stock paths.
- V0.4-E Issue #92 and branch `v0.4-e-transfer-docs-reporting` start only from that exact green main checkpoint.
- Stage-E authority is limited to INV-011/012, DOC-008, RPT-006 and supporting approved Inventory behavior: Stock Transfer, Inventory Documents, balance/movement reporting, full regression and release/UAT evidence preparation.
- No new paid/runtime dependency or scope expansion is introduced. Human AC-V04-031 Product / Business Owner walkthrough/acceptance remains pending after Stage-E technical completion.

## 2026-09-28 — V0.4-E Stock Transfer / Inventory Documents / Reporting pre-flight

- `docs/V0.4-E-PREFLIGHT.md` records PASS against the approved V0.4 baseline and green Stage-D predecessor checkpoint.
- Transfer will use `STYYMM-###`, Approval Matrix maker-checker, deterministic two-Warehouse locking, matched immutable OUT/IN ledger effects, exact reversal pairs, idempotency and Active Reservation availability protection.
- DOC-008 extends the existing secure Documents target architecture to Goods Receipt, Reservation, Issue, Return and Transfer without a second file store.
- RPT-006 remains read-only and ledger-derived; balance/movement reporting introduces no valuation, editable reporting ledger or Finance posting.
- Stage E cannot close until exact-head CI/review/merge/post-merge main validation passes. V0.4 itself cannot close until explicit human Product / Business Owner acceptance under AC-V04-031.

## 2026-09-28 — V0.4-D Material Reservation / Issue / Return pre-flight

## 2026-09-28 — V0.4-D Material Reservation / Issue / Return under validation

- Stage D starts only from V0.4-C green merge checkpoint `096ee639f7e0597dd6c4068d9d1d0c323f66f15d`; Issue #89 and `docs/V0.4-D-PREFLIGHT.md` define the approved contract.
- Added Reservation, Material Issue and Material Return persistence, one source-family-aware immutable Stock Transaction Ledger, database integrity/immutability guards, explicit business permissions, scoped APIs and permission-gated Inventory UI tabs.
- Reservation availability is derived from on-hand less Active Reservations; Issue/Return posting uses serializable transactions, deterministic locks, maker-checker, idempotency, negative-stock/other-reservation protection, exact source traceability and append-only reversal effects.
- PostgreSQL regression covers competing Reservation activation, linked fulfillment, Issue/Return posting, return ceilings and reversal ordering. Live HTTP acceptance covers the complete receive → reserve → issue → return → reverse path plus unauthorized Project denial.
- Hardened implementation/test head `18e44cc07adcc7cadc9fc057f8d1c77ea0c35e97` passed branch CI #1456 after resolving two Codex P1 stock-reversal findings. Return reversal now aggregates same-dimension quantity before availability validation; Goods Receipt reversal now takes the shared stock-dimension lock and validates aggregate reversal quantity against derived availability so downstream Issue consumption or Active Reservations cannot be driven negative. Additional hardening preserves Return allocation lineage, serializes Issue reversal against Return posting and protects posted Issue/Return identity at the database layer. Both P1 review threads are resolved with reproducing PostgreSQL regressions. Final documentation-head branch CI, exact-head PR CI, merge, Issue closure and post-merge main CI remain pending; V0.4-E remains blocked.
- No new mandatory paid/runtime dependency was introduced; DEC-008 remains active. Human V0.4 business UAT remains a separate Release Exit Gate.


- V0.4-C PR #88 merged as `096ee639f7e0597dd6c4068d9d1d0c323f66f15d`; Issue #87 closed and post-merge main CI #1419 passed.
- Opened Issue #89 and branch `v0.4-d-reservation-issue-return` from that exact green checkpoint.
- Added the Stage D pre-flight contract for Reservation availability, Issue/Return workflow, immutable shared-ledger extension, negative-stock/concurrency guards, explicit permissions and automated/live acceptance.
- V0.4-E Transfer/Documents/reporting and human V0.4 release UAT remain deferred; no scope or governance change.

## 2026-09-28 — V0.4-B Goods Receipt / Stock Ledger under validation

## 2026-09-28 — V0.4-C derived Stock Balance under validation

- V0.4-B PR #86 merged as `1f39a0d9e9c8d0d9dc32112e6eec4ec36321ac4d`; post-merge main CI #1390 passed and Issue #85 closed.
- Issue #87 and the Stage C pre-flight authorize only read-only ledger-derived Stock Balance and Project/Site views under approved INV-005/006/007 and AC-V04-012–015.
- Added explicit stock-view permission, secured aggregate API, Stock Balance UI, PostgreSQL scope/reversal evidence and live HTTP acceptance without an editable/materialized balance table or new dependency.
- Implementation/test head `385388c395d570c6141dc6c1e31dbd65690c5ca1` passed CI #1403. PR #88 records exact-head branch/PR CI and review-resolution evidence; merge and post-merge main CI remain pending. V0.4-D has not begun.


- Stage A PR #84 merged as `4ab736203c9870f4b6782ad85c108f3b0b66accd`; post-merge main CI #1337 passed. Stage B issue #85/branch started only after this gate.
- Stage B adds approved Goods Receipt workflow, PO material-source/quantity guards, immutable signed Stock Transaction Ledger, atomic approval/posting and full reversal, Project-scoped API/UI and explicit permissions.
- PostgreSQL and live HTTP coverage exercises partial/multiple receipts, maker-checker, retry, zero over-receipt tolerance, concurrency, PO cancellation/revision protection, Warehouse history and reversal.
- implementation-head branch CI #1382 passed; final documentation-head CI, review and merge remain pending. V0.4-C has not begun; human V0.4 release UAT remains a separate exit gate.

## 2026-09-28 — V0.4-A Warehouse / Inventory Foundation under validation

- Issue #83 implements Company/Project-scoped Warehouse register, database integrity, lifecycle, server-side permissions, audit, UI and automated tests within approved INV-003/Stage A scope.
- warehouse permissions are provisioned for technical SYS_ADMIN bootstrap without stock posting or business approval authority.
- live HTTP and PostgreSQL acceptance coverage added; code head `94516ba1d5baf9cb7cc75199c708ca26dc2eb6a6` passed branch CI #1331 and PR CI #1332. Codex review finding on test wiring fixed and thread resolved; documentation-head CI and merge remain pending.
- V0.4-B remains blocked until Stage A exact-head gates pass, PR merges and post-merge main validation is green.

## 2026-09-27 — V0.4 Inventory Release Entry Gate approved

- Product / Business Owner approved the V0.4 Scope Baseline, AC-V04-001 through AC-V04-031, BR-V04-01 through BR-V04-20, database/API/test baselines, build stages and explicit deferrals.
- approved requirements remain INV-001 through INV-012, DOC-008 and RPT-006.
- approved core controls include partial/multiple receipt, zero over-receipt tolerance, no negative stock, immutable derived ledger/balance, atomic idempotent posting and maker-checker.
- no new runtime dependency is introduced; DEC-008 open-source / zero-cost-first remains active.
- approval authorizes V0.4-A Warehouse / Inventory Foundation pre-flight after PR #82 passes exact-head validation and merges.
- scope expansion remains subject to Change Control.
## 2026-09-27 — V0.3 Procurement accepted

- Product / Business Owner explicitly accepted V0.3 Procurement and confirmed there are no blocking V0.3 business defects.
- accepted checkpoint: `35808f301a7ddcb1945bd249b8c8097baec6d2d6`.
- V0.3-A through V0.3-E are complete; PR #77 and completion PR #78 are merged.
- final automated CI/live HTTP acceptance is green.
- automated UAT business walkthrough scenario `MUJXJSHF` passed 34 checks across BOQ/Budget, Purchase Request, RFQ/quotations/award, Purchase Order revisions and dates, procurement documents, schedule risk, traceability and unauthorized Project access.
- V0.3 Release Exit Gate is complete.
- repository position advances to the V0.4 Inventory Release Entry Gate.
- V0.4 implementation remains gated until its scope, requirements, acceptance criteria, required business rules, dependency/API/database baseline and test approach are explicitly approved.
## 2026-09-27 — V0.3-E Schedule Risk / Procurement Reporting technically completed

- PROC-018 / PROC-019, RPT-005, SYS-007 and DOC-007 delivered with source-derived procurement schedule/risk, transaction traceability and secure procurement document targets.
- PR #77 merged as `e0263cd55706179059d4e970ef80fd4ce5c7e1f4`.
- exact-head branch CI #1264 and PR CI #1265 passed on `4603a584d97890841708ab7188b6572977a1151f`.
- post-merge main CI #1266 passed.
- all three Codex review findings were resolved before merge.
- automated V0.3 regression, authorization and live HTTP acceptance evidence is green.
- human UAT/business acceptance remains explicitly pending under repository governance; V0.3 is not yet marked Product / Business Owner accepted.
- after explicit V0.3 acceptance, the next step is the V0.4 Inventory Release Entry Gate.

## 2026-09-27 — V0.3-D Purchase Order completed

- PROC-009 through PROC-017 delivered with award-backed Purchase Orders, approval, retained revisions, cancellation and line-level Required-on-Site / Expected Delivery.
- PR #74 merged as `600143b1e463a6536c5f588a6c30def373fa6a6e`.
- exact-head branch CI #1210 and PR CI #1211 passed on `ec83b8d3c60c4945dbb8bb268baa9d58b0e7fd50`.
- post-merge main CI #1212 passed.
- review hardening covered rejected-PO corrective retry, active source-demand protection, inactive Supplier validation, action-history clarity, PO permission dependency and database-level source/quantity serialization.
- Inventory, Finance, Actual Cost, V0.7 Committed Cost ledger and Stage-E schedule-risk behavior remain outside Stage D.
- next stage is V0.3-E Schedule Risk pre-flight under PROC-018 / PROC-019, RPT-005 and SYS-007.

## 2026-09-27 — V0.3-C RFQ / Quotations completed

- PROC-004 through PROC-008 delivered with RFQ, Supplier invitations, Supplier Quotations, comparison and line-level Supplier Awards.
- PR #70 merged as `3ba9164b0edab46d0eecc305540d4f3e9840627e`.
- branch CI #1147 and exact-head PR CI #1148 passed on `9f667b17bfe9c1e8dfc957fa35620f7f5a2b9b70`.
- post-merge main CI #1150 passed.
- review hardening covered authorization/redaction, award referential integrity, quotation-only access, date validation and concurrency-safe commercial snapshots.
- Purchase Order, schedule-risk, committed-cost ledger, Inventory and Finance scope was not pulled forward.
- next stage is V0.3-D Purchase Order pre-flight under PROC-009 through PROC-017 and BR-V03-11 through BR-V03-14.

## 2026-09-27 — V0.3-B Purchase Request completed

- PROC-001 through PROC-003 delivered, including Stage-B Required-on-Site demand context.
- PR #65 merged as `e392b468a22c701fbb1a60b1e87b7ef08d4794d1`.
- exact-head PR CI #1027 passed on `88cac51a05a26d782f7cec252d8689dc223e7952`.
- post-merge main CI #1028 passed.
- four Codex review findings were fixed before merge: multi-approver cancellation, visible approval action history, immutable Material code/description history, and DECIMAL(18,4) quantity-bound validation.
- RFQ / quotation / supplier award / PO scope was not pulled forward.
- next stage is V0.3-C RFQ / Quotations pre-flight under PROC-004 through PROC-008 and approved BR-V03-08 through BR-V03-10.

## 2026-09-27 — V0.3-A BOQ & Budget completed

- BUD-001 through BUD-010 delivered.
- PR #60 merged as `ec90e5a736de61333343f542ce7deef79d78b8ff`.
- exact-head branch CI #959 and PR CI #960 passed on `f8349b2e4751512f88abdeebf2381d114e09f586`.
- post-merge main CI #961 passed.
- review fixes preserved first-approval Original Budget semantics, revision-only approver usability and archived-Section Draft validation.
- next stage is V0.3-B Purchase Request pre-flight; implementation remains gated by BR-V03-17 numbering-format approval.

## 2026-09-27 — V0.2 Project & Scheduling accepted

- Product / Business Owner explicitly accepted V0.2 Project & Scheduling.
- V0.2-A through V0.2-G are complete.
- final accepted checkpoint: `0cdebbf95eb155a4cde126673685b2b145c57af3`.
- final post-merge validation CI #895 passed.
- V0.2 is formally closed.
- V0.3 Procurement may proceed to its release entry gate; implementation remains gated by approved V0.3 scope and acceptance criteria.




## 2026-09-29 — V0.5-B Agreements / Work Orders under validation

- Started only after V0.5-A merged green at `af1a3f4953af524110dc4305a061099f4fa80388`; Stage B pre-flight `2da316612bba1fbaee449e72a068a6781c56bee7` passed CI #1700.
- Added agreement version persistence, configured approval/rejection, maker-checker, administrative operational-status revisions, guarded cancellation, agreement-local Work Orders, allocation-ceiling serialization, replay evidence, explicit permissions, Project authorization, API/web lifecycle controls and Stage B PostgreSQL/live HTTP acceptance coverage.
- Preserved migration history by moving replay evidence to a later forward-only migration rather than rewriting the already-executed Stage B migration.
- Corrected the V0.5-A permission regression to assert the six Stage A permission codes explicitly instead of assuming no later Subcontracts permissions exist.
- Validation hardening through `887621f1755260ba095c20f97483934c45c5f68d` adds two-step workflow coverage, final-approval replay/change-payload checks, concurrent Work Order numbering, concurrent administrative revision creation, cancellation-versus-Work-Order submission/final-approval scenarios and explicit Stage-B route permission-metadata regression.
- Regression coverage now also proves Stage-A creation fingerprint retention, hard-delete denial for Agreement Versions/Work Orders, cross-Project WBS and cross-Company Cost Code rejection at service/database boundaries, retained rejected Work Order decision history, and replay visibility enforcement.
- A sequence-allocation concurrency defect found during review was corrected: administrative revision and Work Order creation use `READ COMMITTED` after the deterministic agreement row lock, preventing a waiting transaction from allocating against a stale `SERIALIZABLE` snapshot. Final approval/cancellation transaction behavior remains unchanged.
- UI workflow action keys are retained across failed/manual retries and cleared only after confirmed success, preserving the Stage-B retry/idempotency contract across lost responses and multi-step approvals.
- Exact-head CI is still infrastructure-blocked: runs #1702 through #1729 received no GitHub-hosted runner and executed zero steps (`runner_id: 0`). Stage B is not complete, no PR/merge gate is satisfied, Issue #105 remains open and V0.5-C has not begun.
- DEC-008 and all approved V0.5 deferrals remain unchanged.
