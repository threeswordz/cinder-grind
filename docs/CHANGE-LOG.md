## 2026-09-28 — V0.4-B Goods Receipt / Stock Ledger under validation

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


