## 2026-10-04 — V0.8-C Executive / Cross-Project Management Dashboard validation checkpoint

- Stage-C Executive portfolio implementation is materially present on `v0.8-c-executive-portfolio-dashboard`, including authorized Project aggregation, deterministic health, canonical Schedule/Procurement/Inventory/Cost/Finance composition and the Executive Management workspace.
- Exact-head CI #2822 failed in authenticated runtime acceptance because the leak detector treated the valid numeric aggregate key `totals.schedule.activities` as though it were a protected detail collection.
- Fix commit `5ac822a96dee73f7e8aacafd6dbc91e3be9b9ee4` corrects the detector to distinguish aggregate scalar counters from collection-valued source details while still rejecting `generalRemarks`, `paymentNumber`, `sourceEvidence` and collection-valued `activities` / `lines` / `rows`.
- Integration regression now injects protected-detail sentinels into canonical source mocks and verifies none reach the portfolio contract.
- No permission, source-ownership, business-rule, schema, migration or governance boundary is relaxed. Fresh exact-head CI and DEC-022 stable-candidate review remain mandatory.

## 2026-10-04 — V0.8-C Executive / Cross-Project Management Dashboard started

- V0.8-B closure/status reconciliation PR #171 squash-merged as `5581819419a4602a73ed0249ad8e0377f745d474`; post-merge main CI #2809 passed.
- Issue #172 opened for the approved V0.8-C Executive / Cross-Project Management Dashboard.
- Implementation branch `v0.8-c-executive-portfolio-dashboard` starts from exact green main `5581819419a4602a73ed0249ad8e0377f745d474`.
- Existing V0.8-A `GET /management/portfolio` already enforces `management.portfolio.view` and effective Project scope, but intentionally defers financial portfolio aggregation and cross-Project health scoring to Stage C.
- Stage C will extend that canonical foundation only; V0.8-D domain dashboards and V0.8-E reporting/export remain deferred.

## 2026-10-04 — V0.8-B Project Engineer & Project Manager Dashboards complete

- Final Stage-B implementation head `4230e6ffff3e1c5a3dc7ee3b7669f86061e704ba` passed exact-head push CI #2796 and PR CI #2797.
- DEC-022 review identified one genuine P1 AC-V08-003 gap in the Management Project Engineer execution view.
- The finding was fixed by embedding the existing canonical Project Engineer execution view only for users who already hold `reporting.operational.view`; aggregate Management visibility remains available without protected source-detail privilege broadening.
- Final exact-head Codex re-review reported **no major issues** and the review thread was resolved.
- PR #170 squash-merged as `42444cc91912f323d672f63da050b68b8d777b62`; post-merge main CI #2798 passed.
- Issue #169 closed completed.
- **V0.8-B is COMPLETE. V0.8-C Executive / Cross-Project Management Dashboard is NEXT.**

## 2026-10-04 — V0.8-A Management Read Model / KPI Contracts complete

- Final corrected Stage-A material head `93b116af63723869e9b28c9407e67b034088bf18` passed push CI #2758 and PR CI #2759.
- DEC-022 initial review found one genuine P2: inventory KPI counts could be truncated by the 1,000-row balance-list cap.
- The finding was fixed with an uncapped canonical Stock Balance aggregate while retaining the presentation-list cap; focused regression covers >1,000 balance combinations.
- Final exact-head Codex re-review reported **no major issues**.
- PR #167 squash-merged as `d60c5c051f1eb6aec30399173f33ab05300cc52c`; post-merge main CI #2760 passed.
- Issue #166 closed completed.
- **V0.8-A is COMPLETE. V0.8-B Project Engineer & Project Manager Dashboards is NEXT.**

## 2026-10-04 — V0.8 Management entry baseline approved

- Product / Business Owner explicitly approved the complete V0.8 Management entry package as proposed: Scope, AC-V08-001–040, BR-V08-01–16, D08-01–12, data/API/security/test baseline, V0.8-A–E stages, 18–30 engineering-day planning estimate plus separate UAT/acceptance window, and explicit deferrals.
- DEC-025 records the approval with no amendment.
- `docs/V0.8-ENTRY-GATE.md` is the authoritative approved entry-gate record; `docs/V0.8-ENTRY-GATE-DRAFT.md` is preserved as a superseded historical proposal.
- V0.8 implementation remains NOT STARTED until exact-head CI, PR CI/applicable review, entry-gate PR merge, green post-merge main CI and Issue #160 closure complete.
- DEC-008, DEC-016 and DEC-022 remain mandatory.

## 2026-10-04 — V0.1–V0.7 cross-release integrity audit

- Cross-release technical audit opened under Issue #163 after V0.7 closure and before V0.8 implementation.
- Verified baseline main `f9e77ad61049830446b337447a84c3a0e1781528`: main CI #2681 PASS, 122 migrations applied/schema current, 117/117 API tests PASS with 0 failures, and 64/64 authenticated runtime acceptance checks PASS.
- Open-ticket audit found no V0.1–V0.7 defect/implementation PR or issue; Issue #160 is V0.8 entry approval only.
- Repository text scan found no TODO, FIXME, HACK, known-defect, open-defect or merge-conflict markers.
- Documentation audit found stale present-tense historical wording in older scope/pre-flight/UAT snapshots. The reconciliation preserves the original chronology while marking historical snapshots explicitly and updating authoritative V0.6/V0.7 status wording to the completed/accepted state.
- No runtime code, schema, migration, dependency, approved business-rule substance or governance policy is changed by this reconciliation.

## 2026-10-04 — V0.8 Management entry proposal published

- Proposal PR #161 squash-merged as `82278f1975e046ca9b2e40ca168de570dcb93bfa`.
- Exact-head push CI #2672 and PR CI #2673 passed; post-merge main CI #2674 passed.
- Scope, AC-V08-001–040, BR-V08-01–16 / D08-01–12, technical baseline, V0.8-A–E stages, estimate and deferrals remain **PROPOSED / NOT APPROVED**.
- Issue #160 remains open at the Product / Business Owner approval gate.
- V0.8 implementation remains NOT STARTED and unauthorized.

## 2026-10-04 — V0.8 Management entry-gate proposal prepared

- V0.7 Cost Control is COMPLETE AND ACCEPTED; final closure PR #159 merged as `668a855bd71cebe21e3a38afc40188377163fb69` and post-merge main CI #2663 passed.
- Issue #160 opened for the V0.8 Management release-entry gate.
- Proposed package prepared: `V0.8-SCOPE.md`, AC-V08-001–040, BR-V08-01–16 / D08-01–12, data/API/security/test baseline and V0.8-A–E stage decomposition.
- Core proposed architecture: read-only/derived management dashboards and cross-module reporting over canonical source modules; no second KPI/financial/operational source of truth.
- Proposed deferrals include predictive/ML analytics, data warehouse/OLAP, persistent KPI snapshots, FX, GL/statutory accounting, synthetic allocation, paid BI services and advanced scheduled/report-designer scope.
- **Product / Business Owner approval is pending. V0.8 implementation has not started and is not authorized by this proposal.**

## 2026-10-04 — V0.7 Cost Control release closure complete

- Product / Business Owner acceptance under AC-V07-051 and AC-V07-052 was recorded in PR #158.
- Exact-head acceptance-record push CI #2635 and PR CI #2636 passed.
- PR #158 squash-merged as `32ffab318066bec6fad770f5419cfd1942d9556d`; post-merge main CI #2637 passed.
- Issue #157 closed completed.
- Chat-assisted proxy UAT passed all nine V0.7 areas with no blocking business defect identified; 117/117 API tests and 64/64 authenticated current-release runtime checks passed on the supporting evidence path.
- **V0.7 Cost Control is COMPLETE AND ACCEPTED.**
- V0.8 Management is NEXT at its release-entry gate. No V0.8 implementation is authorized until its own scope/acceptance/business-rule/data/API/test/security baseline is approved and merged with green post-merge main CI.
- Historical change-log entries below remain point-in-time evidence and are intentionally not rewritten.

## 2026-10-04 — V0.7 Product / Business Owner acceptance

- Product / Business Owner explicitly stated: “I explicitly accept V0.7 Cost Control under AC-V07-051 and AC-V07-052 and authorize V0.7 release closure.”
- AC-V07-051 is recorded as accepted by the Product / Business Owner based on the prepared and Chat-assisted proxy UAT evidence; this does not invent a claim that the owner manually repeated every UI/API step.
- AC-V07-052 is explicitly accepted.
- Proxy evidence: 117/117 API tests PASS, 64/64 authenticated current-release runtime checks PASS, all nine V0.7 walkthrough areas PASS, no blocking business defect identified.
- Issue #157 tracks the remaining release-closure reconciliation. V0.8 remains blocked until closure completes and post-merge main CI is green.

## 2026-10-04 — V0.7 Chat-assisted proxy UAT evidence

- Chat executed an evidence-based proxy walkthrough against current `main` `fea2c11ff22f787d30149c8487e6bc470a6c6460`.
- Post-merge main CI #2624 passed with 117/117 API tests and 64/64 authenticated current-release runtime acceptance checks.
- All nine V0.7 UAT areas mapped to PASS with no blocking business defect identified from the available exact-main evidence.
- This is supporting evidence only: AC-V07-051 remains a mandatory human Product / Business Owner UAT gate, and AC-V07-052 still requires explicit Product / Business Owner acceptance.

## 2026-10-04 — V0.7 documentation reconciliation closure

- Repository-wide closure reconciliation PR #154 squash-merged to `main` as `9f1f3c36b1f82f6334cf7513a9ef14a8319df779`.
- Post-merge main CI #2618 passed.
- Current-state documentation now consistently places V0.7 at Release Exit — human UAT / explicit Product / Business Owner acceptance pending.
- A remaining stale Stage-D sentence that described Stage E as active was reconciled without changing runtime code, schema, business rules, dependencies or governance.
- Historical dated change-log entries are intentionally preserved as point-in-time evidence and are not rewritten as current-state claims.

## 2026-10-04 — V0.7-E technical completion / human release-exit gate

- V0.7-E material PR #153 squash-merged to `main` as `3db10a025aa996d2721cd5387b752d314a1753dc`.
- Post-merge main CI #2611 passed, including full workspace regression and authenticated live acceptance.
- Final reviewed material candidate `bcb1055461a0fb4649268ccfcd7391a02da819ba` passed push CI #2607 and PR CI #2608; all DEC-022 findings were resolved before merge.
- Evidence-only reconciliation head `4a1d11a177ee0c987a6761e7d49d87a8ee4310ed` passed push CI #2609 and PR CI #2610.
- Issue #151 closed completed on merge. V0.7-A through V0.7-E are technically complete.
- AC-V07-051 human UAT and AC-V07-052 explicit Product / Business Owner acceptance remain pending. V0.8 must not begin before explicit V0.7 release closure.

## 2026-10-04 — V0.7-E final material candidate and review closure evidence

- Final reviewed material candidate `bcb1055461a0fb4649268ccfcd7391a02da819ba` passed exact-head push CI #2607 and PR CI #2608, including full workspace regression and authenticated live acceptance.
- DEC-022 review findings were addressed in-scope: RPT-009 cache invalidation after Direct Cost/Forecast/Project Variation mutations; authorized source-record rendering while sanitized evidence remains omitted; archived Projects retained when canonical Budget/PO/Subcontract/Invoice/Payment/Direct Cost/Forecast/Variation history exists; and archived Projects with nonzero Project-owned contract value remain reachable.
- The latest Codex pass on `bcb1055461` found release-evidence references still pointed to the older candidate. This documentation-only reconciliation updates CURRENT-STATE, Stage-E evidence, UAT evidence and the change log to the true final green material head.
- AC-V07-051 human UAT and AC-V07-052 explicit Product / Business Owner acceptance remain pending and cannot be self-completed.

## 2026-10-04 — V0.7-E stable material PR gate

- Runtime/test candidate `eb6f6cc32bd96eebf22e880047e954fee4ae71ac` passed exact-head push CI #2597, including migration/status, Prisma/schema validation, dependency audit, full workspace regression, CI UAT bootstrap and authenticated live acceptance.
- The two prior Cost Control API failures were test-fixture drift only; correction changed no runtime/schema/business-rule behavior.
- Material PR #153 is open from the green candidate. DEC-022 Codex is now intentionally at the stable merge-candidate gate; later documentation/evidence-only head movement does not invalidate the reviewed runtime candidate.
- AC-V07-051 human UAT and AC-V07-052 explicit Product / Business Owner acceptance remain pending and cannot be self-completed.

## 2026-10-04 — V0.7-E documentation reconciliation prioritized

- V0.7-A through V0.7-D are technically complete. V0.7-E pre-flight PR #152 squash-merged as `b3011a3953f361d81d0f33479ed551d10fd0c008`; post-merge main CI #2580 passed; Issue #151 remains open.
- Active implementation branch `v0.7-e-reporting-hardening-implementation` is based on that green main. Latest material implementation head before this documentation sweep is `5204935b9cc93bb822a32b876ba1e24b98eaf866`.
- Stage E already contains the integrated RPT-009 Cost Report surface, dimensional Project/WBS/Cost Code reporting, parent-WBS descendant handling, explicit Unallocated states, protected source-trace sanitation, report UI, expanded integration/live acceptance and the prepared V0.7 UAT walkthrough.
- Repository documentation is being reconciled before the stable Stage-E PR is packaged. Historical release evidence remains historical; current-status, roadmap, architecture, permissions, testing and V0.7 gate documents are updated to the live branch.
- DEC-008, DEC-016 and DEC-022 remain unchanged. Human AC-V07-051 UAT and AC-V07-052 explicit Product / Business Owner acceptance remain mandatory and are not self-completed.

## 2026-10-03 — V0.6-D technical completion / V0.6-E pre-flight

- V0.6-D PR #129 exact material fix head `a80f4b7c56e14635cd162ee2cd449b4be55ed346` passed push CI #2379 and PR CI #2380 after the first stable-head Codex review identified one genuine P1 involving historical retention reversal after a later Company base-currency change.
- The P1 was fixed with forward-only migration `20261003030000_v0_6_d_historical_retention_reversal`; no already-executed migration was edited. Historical reversal now reuses original immutable withholding amount/currency without FX conversion.
- The P1 thread was resolved with evidence and fresh exact-head Codex re-review on `a80f4b7c56` reported no major issues.
- PR #129 squash-merged to `main` as `25ed713cafee02b6709a933dbee8670c45d4a9f8`; post-merge main CI #2381 passed and Issue #127 closed completed. **V0.6-D is technically complete.**
- Issue #130 now tracks V0.6-E Project Cash Flow / Finance Reporting / Release Evidence. Pre-flight branch `v0.6-e-preflight` starts from exact green main `25ed713cafee02b6709a933dbee8670c45d4a9f8`.
- Stage-E authority is AC-V06-027–036 plus the approved D06-08, D06-11, D06-18 and D06-19 / DEC-020 boundaries. AC-V06-037–038 remain the later human UAT/release-exit gates.
- BR-V06-13 contained stale pre-D06-19 wording that unallocated Payments were not Project-attributed. This pre-flight reconciles it to the already-approved D06-19 / DEC-020 full-Payment Project cash-flow rule; no new owner policy is introduced.
- Under DEC-022, this docs-only pre-flight does not consume Codex because it adds no new product policy or governance. Stage-E implementation will use Chat + CI and reserve Codex for its stable material merge candidate.

## 2026-10-03 — V0.6-D stable-head Codex P1 correction

- Stable PR #129 exact head `dfe3e5f79b7e01598a85f21658ed14817872b935` passed branch CI #2377 and PR CI #2378 before Codex review.
- Codex identified one genuine P1: a Company base-currency change after valid retention withholding could cause a later Certification reversal to skip the compensating retention `REVERSAL`, leaving historical immutable withholding active.
- The correction is forward-only: a new Stage-D migration replaces the retention insert/materialization functions without modifying already-executed migrations. New withholding still requires the current Company base currency; a later reversal of existing historical withholding reuses the original ledger amount/currency and performs no FX conversion.
- The Finance retention read model now treats existing immutable ledger evidence as supported historical evidence even when the Company's current base currency differs.
- Regression changes the Company base currency after withholding, reverses the Certification, requires linked same-currency reversal evidence and zero balance, then restores the test Company currency. Exact-head CI and fresh Codex re-review remain required before merge.

## 2026-10-03 — V0.6-D implementation candidate / documentation reconciliation

- V0.6-D pre-flight PR #128 merged to `main` as `4b074ad7dcb5d7148040fc58f25dc16d45149f07`; post-merge main CI #2371 passed before implementation began.
- Active branch `v0.6-d-subcontract-retention-documents` implements the approved Stage-D boundary. Runtime head `405aa627cb612697139b72f93024210d7a8d139c` is four commits ahead of the pre-flight checkpoint and passed CI #2376; the preceding Stage-D commits passed CI #2373–#2375.
- Delivered immutable payable-retention ledger evidence limited to `WITHHOLDING` and linked `REVERSAL`, sourced from approved/reversed Subcontract Certifications, Company-base-currency constrained, source-linked, duplicate-protected and immutable below the API. No retention release or user adjustment action is introduced.
- Added Project-scoped `finance.retention.view` read surfaces, read-only Subcontract Certification → Finance Payment allocation/reference/status visibility, and D06-16 compensating retention-withholding reversal evidence after active Payment allocations are cleared.
- Extended canonical DOC-009 Documents linking to Supplier Invoice, Client Invoice, Payment, Subcontract Agreement, Work Order, Claim, Certification and Variation with existing document permissions plus target business-record permissions, Company/Project authorization, archive history and no second file store.
- Authenticated live HTTP acceptance proves retention visibility and Project/SYS_ADMIN denial, approved/cancelled Payment reference history, linked retention reversal evidence, all eight approved DOC-009 target families, secure Certification upload/download/archive and retained file-path secrecy.
- Focused Chat review of the runtime candidate found no new blocking implementation defect. Documentation is now reconciled for the stable-candidate PR gate; Codex is intentionally deferred until the stable material PR head under DEC-022.
- V0.6-D is **UNDER VALIDATION**, not complete. Exact documentation-head CI, PR CI, stable-head Codex review, squash merge, post-merge main CI and Issue #127 closure remain. V0.6-E and human V0.6 UAT remain later gates.

## 2026-10-03 — V0.6-C technical completion / V0.6-D pre-flight

- V0.6-C PR #126 final exact head `6a2c4c3e0b5c794609ce194226dfc81ee45fb7f5` passed push CI #2365 and PR CI #2366 after the one genuine Codex P1 was fixed forward-only at runtime head `246246521b8adf9ebab4aa0e43d53195b842f3f4`.
- The original P1 review thread was resolved with implementation/test evidence; fresh exact-head Codex re-review reported no major issues.
- PR #126 squash-merged to `main` as `2ca6e21d1b4c9a5e7a29989518f8bcf7210d4e18`.
- Post-merge main CI #2367 passed the full migration/schema/dependency/workspace/live-HTTP suite, and Issue #124 closed completed. **V0.6-C Payments / Approvals / Allocations is technically complete.**
- Issue #127 now tracks V0.6-D Subcontract Payment Reference / Retention / Documents. The docs-only pre-flight branch `v0.6-d-preflight` starts from exact green main `2ca6e21d1b4c9a5e7a29989518f8bcf7210d4e18`.
- Stage-D scope is limited to already-approved Subcontract Finance payment-reference visibility, payable retention withholding/balance, D06-16 compensating retention correction, and DOC-009 on the eight approved targets. Retention release/adjustment, V0.6-E reporting and later-release scope remain deferred.
- Under DEC-022, this docs-only pre-flight does not consume Codex; implementation will use Chat + CI and reserve Codex for the stable material Stage-D merge candidate.
- No V0.6-D implementation begins until this pre-flight merges and post-merge main CI passes. Human V0.6 UAT/business acceptance remains a later mandatory Release Exit Gate.

## 2026-10-02 — V0.6-C Payments / Approvals / Allocations runtime candidate and draft PR #126

- V0.6-C pre-flight PR #125 merged as `606b6622bd6e22623b8aadf8178dd4b905df5c4b` after its CI/post-merge gates, and implementation proceeded only on `v0.6-c-payments-allocations` under Issue #124.
- Implemented canonical INBOUND/OUTBOUND Payments, one-Project/base-currency/counterparty integrity, configured Approval Matrix maker-checker, explicit Finance permissions, partial/multi-target same-Project allocations, Supplier Invoice settlement, Client Invoice receipt settlement, Subcontract Certification settlement, target/Payment ceilings, replay protection, cancellation and retained audit/history.
- Added forward-only `20261002232000_v0_6_c_payment_history_immutability` after focused review found that direct database writes could otherwise rewrite retained Payment decision metadata. No already-executed migration was modified.
- Extended Subcontract Certification reversal compatibility: an active Finance allocation blocks reversal at the database boundary and now returns a controlled service-level 409 Conflict; cancelling the Payment releases the reversal guard while retaining allocation/cancellation history.
- Added focused regression for cross-Project allocation denial, decision-history immutability, stable allocation replay, technical SYS_ADMIN separation and concurrent Payment create/allocation/approval/cancellation convergence.
- Authenticated live HTTP acceptance now proves Payment create/retry, direction-safe allocation, maker-checker approval, derived AP/AR settlement, controlled cancellation/restoration, Project/SYS_ADMIN denial, Subcontract net-certified ceiling and Certification reversal blocking/release.
- A Chat-side pre-Codex audit then closed the same approval-evidence risk class previously found in V0.6-B: forward-only `20261003002000_v0_6_c_payment_approval_evidence_guard` adds clean-Draft insert integrity, reciprocal Payment ApprovalAction/ApprovalInstance guards, serialized `payment_decision_order`, maker-checker, explicit approve/reject permission and Project-scope checks, retained final actor/time/comment binding, plus persisted create/submit/cancel permission/Project evidence. The Payment service now copies final decision metadata from retained ApprovalAction evidence rather than local wall-clock input. Exact head `ae50b1479c89612af3d7a240586a3179a39ac05e` passed push CI #2355 and PR CI #2356.
- Role-permission administration now requires `finance.payment.view` whenever any `finance.payment.*` action permission is assigned, matching the Client Invoice / PO discoverability rule; PR CI #2358 passed at `f64765daa9179d5b49827ff0996f291f26699587`.
- Payment approval history now displays retained decision timestamps and cancellation actor/time/reason for human audit/UAT evidence. Exact frozen runtime head `a896c7b8caebf3193996d34652d005a5ead70319` passed PR CI #2360: clean migrations/status, Prisma validation, dependency audit, full API/web validation and prior-release regression, UAT bootstrap and live HTTP acceptance.
- PR #126 is at the stable review gate. Under DEC-022, Codex has not been spent on intermediate heads; the required review is reserved for the documentation-reconciled exact head after its CI gate.
- The first exact-head Codex review of `48bbff5d2502d9ac2e9d2676ef3fc9cb1ffd358f` found one genuine P1: once an approved Payment had become CANCELLED, a later direct update could still rewrite the retained approval actor/time/decision metadata because the prior approval-history guard only covered OLD.state = APPROVED.
- Fixed forward-only at `246246521b8adf9ebab4aa0e43d53195b842f3f4` with `20261003005000_v0_6_c_cancelled_payment_approval_history`, adding a terminal-state guard for the retained approval actor/time/decision fields. Regression attempts to rewrite `approved_by_user_id` and `approved_at` after cancellation and requires `PAYMENT_APPROVAL_HISTORY_IMMUTABLE`.
- PR CI #2364 passed the P1 fix head, including clean migrations/status, Prisma validation, dependency audit, full API/web/prior-release regression, UAT bootstrap and authenticated live HTTP acceptance. A fresh exact-head Codex re-review is required because this is a material database-integrity change.
- Human V0.6 UAT/business acceptance remains a later release-exit gate after V0.6-A through V0.6-E. V0.6-D must not begin before V0.6-C merge, post-merge `main` CI and Issue #124 closure.

## 2026-10-01 — V0.5 Subcontracts Product / Business Owner acceptance

- Fresh current-release automated walkthrough on `f6c99c232475871c247c749e289995bdb0f3eb34` passed Validate Construction ERP #1933 attempt 2 with scenario `MUP0LKS3` and 46 checks, covering V0.5-A through V0.5-E plus the authenticated Subcontractor → Agreement → Work Order → Claim → Assessment → Certification/Retention → Variation → reporting path and authorization negatives.
- The subsequent current-state checkpoint `d251b79aaf49355b194fcb22c80cdbbd11054602` passed main CI #1934, including clean migrations, full workspace regression and live HTTP acceptance.
- On 2026-10-01 (Singapore time), the Product / Business Owner explicitly stated: “I explicitly accept V0.5 Subcontracts under AC-V05-030 and authorize V0.5 release closure.”
- AC-V05-030 is therefore satisfied by a human Product / Business Owner decision. The automated walkthrough remains supporting technical evidence and is not treated as self-approval.
- No blocking business defect or workaround was reported with the acceptance decision. Acceptance PR #114 corrected head `23ae1efb7ecf845ef5422682b81d950710295c5e` passed push CI #1941 and PR CI #1942 after the single Codex P2 stale-status finding was fixed/resolved; final exact-head Codex re-review reported no major issues. PR #114 squash-merged as `6973ba513134e463ab41341313705ffa44486d74`, post-merge `main` CI #1943 passed, and Issue #113 closed. **V0.5 Subcontracts is complete and accepted.** V0.6 has not started; it may now enter its separate Release Entry Gate.

## 2026-10-01 — V0.5-E cancelled-Agreement action Codex follow-up

- Codex review of `cfe404b639906a418e8bd5fdbf0e607b43f0bbb3` identified one additional genuine P2: cancelled Agreements correctly remained discoverable for retained Variation history, but Draft/Approved Variations could still show mutation controls that the backend would reject.
- Fixed at `7d79ade7feefd635626d05f70f0f767448131822` by deriving active-Agreement state in the existing Variation workspace and gating Draft fields/save, decision input, submit, approve/reject and reverse on an approved, non-cancelled Agreement. Cancelled Agreement history remains selectable/readable and now shows an explicit read-only notice; backend guards remain authoritative.
- Exact code-head push CI #1928 and PR CI #1929 passed, including web typecheck/build, clean migrations, full API/web/PostgreSQL V0.1–V0.5 regression and authenticated live HTTP acceptance. The Codex thread has an evidence reply and is resolved.
- Final documentation-head CI and clean exact-head Codex re-review remain before squash merge. Human AC-V05-030 remains **PENDING** and V0.6 remains blocked.

## 2026-10-01 — V0.5-E Variation decision timestamp Codex follow-up

- Codex review of `68e778129ef43c8551548c86ff698d6ce597fb45` identified one additional genuine P2: the Variation workspace Approval trail rendered step/action/actor/comment but omitted the retained ApprovalAction `actionAt` timestamp, preventing human UAT from verifying decision time in the UI.
- Added `actionAt` rendering to every Variation Approval trail entry using the already-returned retained approval record. REVERSED evidence continues to show separate reversal actor/time/reason; no new history source, schema or business rule was introduced.
- Exact code head `87994499477d314f47269dbd926d856d4c957670` passed push CI #1924 and PR CI #1925, including web typecheck/build, clean migrations, full API/web/PostgreSQL V0.1–V0.5 regression and authenticated live HTTP acceptance. The Codex thread has an evidence reply and is resolved.
- Human AC-V05-030 remains **PENDING**; final documentation-head CI and clean exact-head Codex re-review still precede squash merge.

## 2026-10-01 — V0.5-E reporting snapshot-consistency Codex follow-up

- Final Codex re-review of `72a0aa18a6d9d32b75b6606bf3844434057e307b` identified one additional genuine P2: the scoped Agreement read and five batched report aggregates could observe different PostgreSQL snapshots while commercial writes commit concurrently.
- Fixed `reportAgreements()` so Project authorization/scope resolution, Agreement selection and all five batched source aggregates execute inside one Prisma interactive transaction at `RepeatableRead` isolation. Each RPT-007 response now reconciles to one PostgreSQL snapshot while retaining a fixed batched query count and read-only source-derived semantics.
- Exact code head `8b00a42e2beb4e6ffccf6a8c1bd6e0f7e5a99e41` passed push CI #1920 and PR CI #1921, including clean migrations, full API/web/PostgreSQL V0.1–V0.5 regression and authenticated live HTTP acceptance. The Codex thread has an evidence reply and is resolved.
- Human AC-V05-030 remains **PENDING**; final documentation-head CI and clean exact-head Codex re-review still precede squash merge.

## 2026-10-01 — V0.5-E Codex findings resolved before final re-review

- Codex review identified three genuine P2 findings: cancelled Agreements were no longer discoverable for retained Variation history; RPT-007 used an unbounded per-Agreement `1 + 5N` aggregate query pattern; and the workspace did not display retained Variation reversal actor/time/reason.
- Fixed history discovery by returning authorized APPROVED/CANCELLED Agreements while allowing **New Variation** only for active approved Agreements; service-side cancellation guards remain authoritative. Added PostgreSQL regression proving cancelled Agreement history remains discoverable while new Variation creation stays blocked.
- Reworked RPT-007 to one scoped Agreement query plus five batched `groupBy` aggregate queries across all selected Agreement IDs, preserving the existing source-derived values and authorization boundary without an editable reporting store.
- Added reversal evidence rendering from retained `reversedBy`, `reversedAt` and `reversalReason` fields so the human history walkthrough can verify actor/time/reason.
- Exact fix head `7f3f015fa7e26ce9aa3d06b43d270196a01cb7ed` passed push CI #1916 and PR CI #1917. All three Codex threads have evidence replies and are resolved. Final exact-head Codex re-review remains required before squash merge.
- Human AC-V05-030 remains **PENDING** and V0.6 remains blocked.

## 2026-10-01 — V0.5-E PR #112 final review checkpoint

- PR #112 opened for V0.5-E at exact evidence head `6ad9dad5543386f70472deb2ff9be0477de0d401`; branch CI #1910 and PR CI #1911 both passed clean migrations, full workspace/PostgreSQL regression and authenticated live HTTP acceptance.
- Durable current-state now reflects the live PR/review position rather than the earlier pre-PR checkpoint. Required Codex exact-head review remains pending; any head change requires fresh CI/re-review. Human AC-V05-030 acceptance remains separate and pending.

## 2026-10-01 — V0.5-E implementation and human-UAT evidence ready for final PR gates

- Implemented SUB-009 Variation Orders with Company/month `SVOYYMM-###` identity, immutable Agreement linkage/currency, signed scope/value change, configured Approval Matrix maker-checker, explicit permissions, Project authorization, stable retry keys, retained audit/history and explicit reversal. Original Agreement value/scope remain unchanged; only approved non-reversed Variation deltas derive the current ceiling.
- Current-ceiling integration now governs Work Order approval, Claim submission and Certification approval. Reducing Variation approval and reversal of positive Variations protect approved Work Order allocation, active submitted/assessed claimed value and non-reversed certified value under deterministic Agreement locking.
- Added read-only Project-scoped RPT-007 reporting for original value, approved Variation delta, current ceiling, approved Work Order allocation, active claimed, assessed, certified gross, withheld retention and net certification. It creates no second ledger, Finance posting, Actual Cost or Paid Cost semantics.
- Added permission-aware Variation/reporting UI, focused PostgreSQL lifecycle/integrity/idempotency/concurrency/authorization/reporting regression and authenticated live HTTP Agreement → Work Order → Claim → Assessment → Certification/retention → Variation → reporting acceptance with unauthorized Project denial.
- Focused Stage-E regression exposed an ambiguous PL/pgSQL `approval_state` reference in the already-executed Variation consistency migration. Historical migration remained unchanged; forward-only `20261001032000_v0_5_e_variation_consistency_fix` qualifies source columns and renames the local ApprovalInstance state variable.
- Pre-evidence implementation head `2a2909675d015caed8e1e0a3b317cbd321723795` passed CI #1909: clean migration deployment/status, Prisma validation, production dependency/license audit, full API/web validation, PostgreSQL/full V0.1–V0.5 regression and authenticated live HTTP acceptance.
- Prepared `docs/V0.5-UAT-EVIDENCE.md` for the separate human walkthrough. **AC-V05-030 remains pending and is not auto-accepted.** Required final exact-head CI, PR CI/Codex review, squash merge, post-merge main CI and Issue #111 closure still precede human V0.5 Release Exit acceptance.

## 2026-10-01 — V0.5-D completed; V0.5-E pre-flight started

- PR #110 squash-merged to `main` as `aceeb82ad13a2f6c773d307541ddd02fafc69a92` after exact-head push CI #1898 and PR CI #1899 passed on `0cf62c630153a6ac2326f352c0064243b3a2f45f`; final Codex review reported no major issues and all review threads were resolved.
- Post-merge main CI #1900 passed, including clean migrations, production dependency/schema checks, full workspace/PostgreSQL regression and authenticated live HTTP acceptance. Issue #109 closed as completed.
- Opened Issue #111 and branch `v0.5-e-variations-reporting` from that exact green checkpoint for approved V0.5-E only: SUB-009 Variation Orders, RPT-007 source-derived reporting, full V0.1–V0.5 regression and V0.5 human-UAT evidence preparation.
- Stage E keeps original Agreement value/scope immutable; only approved non-reversed signed Variation deltas affect current ceiling. Reducing approvals and positive-Variation reversals must protect approved Work Order allocation, active submitted/assessed Claims and non-reversed certified value.
- Reporting remains Project-scoped, read-only and source-derived; no second ledger, Finance posting, Actual Cost or Paid Cost is introduced. DEC-008 remains mandatory.
- Human AC-V05-030 Product / Business Owner UAT/business acceptance is not part of automated Stage-E completion and remains the separate V0.5 Release Exit Gate. V0.6 remains blocked until explicit human acceptance.

## 2026-10-01 — V0.5-D Certification / Retention implementation ready for PR review

- Issue #109 branch `v0.5-d-certification-retention` reached green pre-PR implementation head `782da07ff103e728351680718132fd2c33758875`, 13 commits ahead / 0 behind V0.5-C main. Exact-head CI #1885 passed clean migration deployment/status, Prisma validation, production dependency audit, full API/web validation and authenticated live HTTP acceptance.
- Delivered approved Payment Certification lifecycle and retention withholding only: Agreement retention rate/cap and immutable version snapshots; `SCTYYMM-###` identity; Draft/edit/submit/approve/reject/reverse; Approval Matrix maker-checker; explicit Certification permissions and Project authorization; stable action replay; retained audit/decision history; certified gross bound by the retained Assessment and Agreement ceiling; half-up two-decimal withholding, cumulative cap, retained-before and net-certified snapshots.
- Added forward-only database integrity for source Company/Project/Agreement/Claim/Assessment consistency, lifecycle/decision evidence, ApprovalInstance reciprocity, immutable approved/reversed history, cancellation protection, direct-write ceiling/retention arithmetic and Agreement-scoped serialization. Focused regression exposed PL/pgSQL name shadowing in the already-executed integrity function; forward-only migration `20261001002500_v0_5_d_certification_integrity_name_resolution` corrected it without editing historical migrations.
- Added Stage-D PostgreSQL/integration/security/concurrency coverage for permissions, maker-checker/Approval Matrix role, Project denial, gross bounds, retry safety, zero/uncapped/capped retention, partially remaining/exhausted cap, half-up rounding, immutability, reversal/correction history and serializable competing approvals. The live HTTP scenario additionally proves technical SYS_ADMIN has no implicit Certification authority.
- Extended the existing Subcontracts web workspace rather than creating a parallel application. Agreement Drafts present retention rate/cap; Claims now present Claimed, Assessed, Certified gross, Withheld retention and Net certified distinctly, with permission-gated Certification workflow controls and retained reversal/approval history.
- No retention release, Finance invoice/payment/allocation, cash settlement, tax/VAT, FX, accounting journal, cost recognition, Variation or later derived-reporting scope was introduced. Required PR CI/Codex exact-head review, squash merge, post-merge `main` CI and Issue #109 closure remain before V0.5-E. Human V0.5 Product / Business Owner UAT remains a separate later release-exit gate.

## 2026-09-30 — V0.5-C Assessment-state lifecycle integrity review follow-up

- Codex's exact-head review of `2f99b1e730e7ab110fa6f09eed824e74851f3221` identified a P2 direct-SQL Claim-state transition gap: a Claim could become ASSESSED without matching Assessment evidence or REJECTED while its Assessment was active.
- Added forward-only `20260930133000_v0_5_c_assessment_state_guards` (`dd97b854d7eea58de34965c1fa4be72531274b19`). The Claim transition guard requires matching retained Assessment evidence; Assessment writes serialize with the parent Claim and a deferred consistency guard rejects contradictory standalone Assessment mutations at commit. No executed migration was modified.
- Added PostgreSQL regression `496df38bbd8e28afc1e006d1eeb73d77a2e072c8` for direct Claim transitions and standalone Assessment rejection while preserving valid authorized assessment/rejection flow. Exact implementation-head PR CI #1814 SUCCESS, including migrations, workspace/PostgreSQL tests and authenticated live HTTP acceptance. Codex finding replied to/resolved; final exact documentation-head CI and Codex re-review are pending. V0.5 human UAT remains a separate Product/Business Owner release-exit gate.

## 2026-09-30 — V0.5-C final Codex finding fixes and release review checkpoint

- PR #108 / Issue #107: Codex's final review identified three real P2 gaps after earlier Claim-line parent-lock and shared NumberSequence backward-period concurrency fixes. All are now addressed within approved Stage-C scope and previous migrations remain byte-for-byte unchanged.
- Claim Draft creation/edit/submission now prevent generic exact-period re-entry when rejected/withdrawn/replaced history exists; linked replacements preserve their predecessor period (service commit `81a0eaba606c2c7003e6437148c5016acfdb8ff5`). The same commit records Draft period audit `oldValues` from post-lock `current` rather than stale pre-lock reads.
- New forward-only migration `20260930130000_v0_5_c_withdrawal_evidence_guard` (commit `0e69e32baba09b0ab188d1b4fe48d444271a1aa1`) requires actor, timestamp and nonblank reason for every WITHDRAWN Claim while allowing rejected Claims to become REPLACED without fabricated withdrawal evidence.
- PostgreSQL lifecycle regressions cover direct-SQL missing withdrawal evidence, generic correction bypass through create/period edit and replacement-period immutability (`67bd604bd67359991873494bf430ca705889a553`). A two-reader concurrency barrier verifies the second Draft-update audit records the first committed post-lock period (`c2d7c4cd045a142c0ab6cdd37ab6720123d7e8c5`).
- Exact implementation-head PR CI #1806 passed on `c2d7c4cd045a142c0ab6cdd37ab6720123d7e8c5`, including clean migrations, full workspace/PostgreSQL regression and authenticated live HTTP acceptance. All known Codex review threads have replies/evidence and are resolved. Final documentation-head exact CI and Codex review are still required before squash merge, post-merge main CI, Issue #107 closure and V0.5-D pre-flight; human V0.5 owner acceptance remains separate.

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
- GitHub-hosted runner allocation recovered after the repository rename. Rerun #1730 executed and revealed two older V0.3 PostgreSQL integration suites colliding under parallel Node test-file execution; V0.5-B itself passed.
- The API test command now uses `node --test --test-concurrency=1` so shared-database integration suites execute deterministically without cross-file serializable transaction deadlocks. No production isolation or runtime behavior was weakened.
- Exact-head branch CI #1732 and PR CI #1733 passed on `faafa48c5b50a037de37185e011b0da5b7e9c46f`, including migrations/status, Prisma validation, dependency audit, full workspace validation, UAT bootstrap and live HTTP acceptance. PR #106 is mergeable/clean with no unresolved review threads.
- The Codex review bot could not execute because the account's code-review quota was exhausted. The Product / Business Owner explicitly approved a one-time waiver for PR #106 only; DEC-015 records the change-control exception. Future review expectations, exact-head/PR/post-merge CI, issue closure, human UAT and all other governance remain unchanged.
- DEC-008 and all approved V0.5 deferrals remain unchanged.


## 2026-09-30 — V0.5-B completed / V0.5-C pre-flight

- PR #106 squash-merged as `d5cf7bb1a3009d37c6cf875c54d74954e778aa57`; post-merge main CI #1736 passed and Issue #105 closed.
- DEC-015 is a one-time Product / Business Owner waiver of Codex review for PR #106 only; future stage review and human UAT gates remain unchanged.
- Issue #107 and branch `v0.5-c-claims-assessments` start from the exact green merge checkpoint.
- Stage C pre-flight authorizes only Progress Claims and Assessments under SUB-005/SUB-006, AC-V05-011–016 and BR-V05-09–12. Certification/retention, Variations/reporting and Finance remain deferred.
- Assessment is implemented as an explicitly permitted auditable decision, not a new Approval Matrix workflow: SUB-006 does not depend on FND-005, while SUB-007 Certification explicitly does.
- DEC-008 and all approved V0.5 deferrals remain unchanged.


## 2026-09-30 — V0.5-C Claims / Assessments technically implemented

- Implemented SUB-005/SUB-006 within the approved V0.5-C boundary: Claim identity/period/lines, submission ceilings and immutability, withdrawal/replacement history, Assessment decision/rejection history, claimed-versus-assessed separation, Project authorization, explicit permissions, audit and retry/idempotency protections.
- Added the permission-aware Claims / Assessments web workspace with approved Agreement and Work Order selectors, Draft editing, read-only submitted source values, lifecycle actions, retained history and stable action keys across failed/manual retries.
- Extended authenticated live HTTP acceptance with valid Claim submission, duplicate and cumulative-overclaim rejection, source immutability, lower Assessment, claimed/assessed separation, Assessment rejection/replacement, unauthorized Project denial and active-Claim Agreement cancellation protection.
- Added explicit concurrency evidence for active same-period contention, competing Agreement-ceiling submissions, competing per-Work-Order submissions, cancellation versus Claim submission, and cancellation versus Assessment finalization.
- Concurrency CI found a stale-snapshot cancellation defect when a waiting `SERIALIZABLE` cancellation transaction could miss the winning Claim submission. Cancellation now uses the existing deterministic Agreement lock with `READ COMMITTED`, rechecking committed state after the lock; exact-head CI #1754 validated the correction.
- Final security review found and fixed an Assessment read-boundary gap: Claim list/detail no longer disclose nested Assessment history without `subcontracts.assessment.view`; detail/list regressions were added.
- Exact implementation head `02c8281a6e79e3d5c7b7a67efe9fea3f31ad1d58` passed CI #1756 including clean migrations/status, Prisma validation, dependency audit, full workspace validation, PostgreSQL regression/concurrency tests, bootstrap and live HTTP acceptance.
- Payment Certification/retention, Variations/reporting, Finance/payment/accounting, tax/VAT, FX, cost recognition, retention release, SUB-011/DOC-009 and V0.7 aggregation remain deferred. DEC-008 remains unchanged.
- Stage C is not yet merged at this record. Required PR CI/review, squash merge, post-merge main CI and Issue #107 closure remain gates. Human V0.5 Product / Business Owner UAT remains separate and pending.

- Independent pre-merge review also hardened valid DECIMAL(18,2) UI display precision by replacing JavaScript floating-point Claim total summation with exact integer-cents arithmetic.
- Codex review of PR #108 identified two genuine issues: submit replay could disclose a later Assessment to a Claim-only reader, and the ASSESS audit event used the Claim UUID instead of the Assessment UUID. Fixes landed in `6ab22059b2474fbe69200fc7ea5129bcdd625a0b` and `ce32dbd25af26a7052f47c562a3694c89accff19`, with targeted regression coverage in `07c83c65188684e63905df156396b7191033d8dc`.
- PR CI #1769 passed on exact head `07c83c65188684e63905df156396b7191033d8dc`; both Codex review threads are resolved. A final exact-head CI/re-review is required after this documentation reconciliation before merge.
- Codex re-review of `e936aea8d9fa1f29f16cddb9b0f251654c7a300e` reported no major issues.
- A later CI rerun exposed a real shared number-allocation race: concurrent same-period Claim creation could surface a Prisma serializable-transaction failure instead of the required business conflict because NumberSequenceService held a `FOR UPDATE` row lock inside a stale `SERIALIZABLE` snapshot. The allocator now retains the deterministic row lock under `READ COMMITTED`, allowing waiters to observe the prior allocation's committed `next_value`.
- Added a direct concurrent number-sequence regression in addition to the Stage-C Claim concurrency suite. Exact-head PR CI #1777 passed on `98be784cb83e72a02d3986bf7c9a6e5114c54112`, including workspace validation, PostgreSQL concurrency coverage, bootstrap and live HTTP acceptance.
- Documentation was then reconciled to the final pre-merge checkpoint; final exact-head Codex review remains the last PR gate before squash merge.
- Final Codex review of `d19ebbd206936a9519a8cb40ebe9ef4efa3c2790` found one additional genuine P2: cancelled Agreements disappeared from the Claims selector, making retained Claim/Assessment history undiscoverable. The selector now includes APPROVED and CANCELLED Agreements with cancellation state, and ClaimsPanel presents cancelled Agreements as history-only without active Claim options or mutation controls.
- Backend Draft period/line mutation paths now lock and recheck the Agreement before editing, so a surviving Draft cannot be changed after Agreement cancellation. PostgreSQL regression covers successful cancellation with retained WITHDRAWN plus DRAFT Claims, continued history visibility, and rejection of create/update/line/replacement mutations.
- An intermittent same-period concurrency failure was also removed by explicitly checking the active Agreement/period invariant under the existing Agreement row lock before create/replacement/period update, producing a deterministic business conflict instead of relying on ORM translation of the partial unique-index violation.
- Push CI #1790 and PR CI #1791 passed on exact code head `04a13bc9475dae32e5fa0e40fd62373636aee93f`, including full workspace/PostgreSQL concurrency validation, bootstrap and live HTTP acceptance. The final P2 review thread is resolved; this documentation reconciliation intentionally requires one final exact-head CI and Codex re-review before merge.
- Exact-head Codex review of `620222b0dc05f97aa702b8b7024a38498dc656f4` found two further genuine P2 concurrency defects: Claim-line trigger checks did not lock the parent Claim against submission, and an older-period NumberSequence waiter could move `lastPeriodKey` backward after a newer-period commit.
- Fix `8252828f58b4a3952ee0bf72c54eb6489070e2c0` adds forward-only migration `20260930123000_v0_5_c_claim_line_parent_lock` and rejects backward reset-period allocation without weakening the shared sequence row lock. Regression commit `221f0f0b7d6094563cc4268ce8a4d8a31e282f66` covers both paths. Exact-head CI, review-thread resolution and final Codex re-review remain pending; DEC-015 does not apply to PR #108.
- Subsequent exact-head Codex review of `2f99b1e730...` found direct Claim/Assessment lifecycle-state integrity was still incomplete. Forward-only migration `20260930133000_v0_5_c_assessment_state_guards` (`dd97b854d7eea58de34965c1fa4be72531274b19`) and targeted regressions through `496df38bbd8e28afc1e006d1eeb73d77a2e072c8` require matching Assessment evidence for Claim assessment/rejection transitions and serialize Assessment writes through the parent Claim. Exact-head PR CI #1814 passed; that thread was resolved.
- Final Codex review of `4aa384624eefcc4ae749404b2b8f97344d468b5a` then found two genuine P2 database-integrity gaps: direct inserted `ASSESSED` / `REJECTED` Claims could omit reciprocal Assessment evidence, and direct/future Prisma replacement lineage could create a phantom `REPLACED` predecessor or a submitted successor while its predecessor remained `WITHDRAWN` / `REJECTED`.
- New forward-only migration `20260930140000_v0_5_c_claim_commit_consistency` in commit `8cbee12a8b9a579e83d6eca25dd0ddb0412d1309` adds deferred Claim/Assessment commit consistency plus reciprocal predecessor/successor replacement-lineage consistency without modifying already-executed migrations. Regression head `74cc595009cae9e3b9231aedb241a537659b29c9` proves inserted terminal Claims without matching Assessment evidence are rejected, phantom `REPLACED` state is rejected, linked replacement submission cannot commit before the predecessor transition, and the authorized atomic replacement service flow remains valid.
- Exact implementation-head PR CI #1822 passed on `74cc595009cae9e3b9231aedb241a537659b29c9`, including migrations, workspace/PostgreSQL tests and authenticated live HTTP acceptance. Both latest Codex threads received exact evidence replies and were resolved; all 12 known review threads were resolved at that implementation head. Documentation reconciliation now creates a docs-only head that must pass exact-head CI and final Codex re-review before squash merge. DEC-015 does not apply.
- Final Codex exact-head review of documentation head `d40e1e58ae34bf716e0c466fb68b0d3205b42a8a` found one additional genuine P2: a `REJECTED` Claim with retained rejected Assessment evidence could be changed to `REPLACED` while direct SQL/future Prisma simultaneously populated withdrawal actor/time/reason, creating contradictory rejection and withdrawal histories.
- Forward-only migration `20260930143000_v0_5_c_rejected_replacement_evidence` in commit `52f52af984371a755fe300275538728b276e3112` replaces the deferred Claim/Assessment consistency function so rejected replacements must retain null withdrawal evidence; the withdrawal correction path with no Assessment remains valid. No already-executed migration was modified.
- Targeted regression at `6a8415eee431b8a01650d1b1353a30210e9979fb` performs the contradictory predecessor/successor transition atomically, proves the transaction rolls back with the source still `REJECTED` and replacement still `DRAFT`, then preserves the normal authorized rejected-replacement service flow. Exact-head PR CI #1830 passed, including migration application/status, full workspace/PostgreSQL tests and authenticated live HTTP acceptance. The thirteenth Codex thread received exact evidence and is resolved; final docs-head CI and Codex exact-head re-review remain before squash merge.
- Codex exact-head review of documentation head `fe58a5fbd07945506ebefce77a52027d44677e0a` found a fourteenth genuine P2: direct INSERT/future Prisma could commit a `REPLACED` predecessor plus submitted linked successor with neither withdrawal evidence nor any Assessment row, leaving no retained evidence of either approved correction path.
- Forward-only migration `20260930150000_v0_5_c_replacement_correction_evidence` in commit `9368f8393cdd7435ac251439e6e9b2fe51aea82a` replaces the deferred Claim/Assessment consistency function so every `REPLACED` Claim must retain exactly one path: complete withdrawal evidence with no Assessment, or a rejected Assessment with no withdrawal evidence. No already-executed migration was modified.
- Targeted direct-INSERT regression at `da5c4d503d2dbb36bd6f42163a2a34449fef1175` proves an evidence-free predecessor/successor lineage is rejected and completely rolled back, while the authorized withdrawn- and rejected-replacement service flows remain valid. Exact-head PR CI #1838 passed, including migration application/status, full workspace/PostgreSQL tests and authenticated live HTTP acceptance. The fourteenth Codex thread received exact evidence and is resolved; final docs-head CI and Codex exact-head re-review remain before squash merge.

- Codex exact-head review of documentation head `e0c1f6b7163dd501f9ad5ce826e6edbb6b45d5ca` found a fifteenth genuine P2: a direct SQL/future Prisma transaction could create a linked submitted replacement with a different period from its predecessor because reciprocal lineage checks enforced state but not both period boundaries.
- New forward-only migration `20260930153000_v0_5_c_replacement_period_lineage` in commit `4cadd06e732289178b5ca21cf1aacecc864436ba` replaces the deferred replacement-lineage function so every linked replacement must retain the predecessor's exact `period_start` and `period_end`. No already-executed migration was modified.
- Targeted direct-transaction regression at `412d9d3a682795c2d8bc21d1bf9103be0b5113d7` supplies otherwise-valid withdrawal correction evidence, attempts a `REPLACED` predecessor plus `SUBMITTED` linked successor with a mismatched end date, and proves the transaction rolls back completely while authorized same-period replacement flows remain valid.
- Exact-head push CI #1845 and PR CI #1846 both passed on `412d9d3a682795c2d8bc21d1bf9103be0b5113d7`. The fifteenth Codex thread received exact evidence and is resolved; this documentation reconciliation creates a docs-only final review head that must pass exact-head CI and Codex re-review before squash merge.

- Codex exact-head review of documentation head `c6c7093fd71d26081240dbc9f67de90806d51eb5` found a sixteenth genuine P2: the exact-period replacement function existed, but the deferred replacement-lineage trigger did not fire when a linked Draft's `period_start`, `period_end` or replacement link changed without a state transition.
- New forward-only migration `20260930160000_v0_5_c_replacement_lineage_trigger_coverage` in commit `c7d98f97c4e75f5f48c2d6c9acd14e3720ffc3f7` recreates the constraint trigger for INSERT and updates of `state`, `period_start`, `period_end` and `replacement_for_claim_id`, reusing the existing deferred lineage consistency function. No already-executed migration was modified.
- Targeted regression at `7bc07fd763c78ee09e8bbc0edcf92ceb413d9c21` directly edits only a linked Draft replacement period and proves PostgreSQL rejects the mismatch and retains the predecessor period.
- PR CI #1854 then exposed a separate nondeterministic first-use Claim-number sequence bootstrap race: concurrent `createClaim()` calls could both observe the reserved sequence as absent and one Prisma upsert could surface raw P2002 before the Agreement lock/business-conflict path. Commit `cb13aaa99b9af5997186f24ea8481609289d7c7b` makes reserved Claim-sequence initialization idempotent with `createMany({ skipDuplicates: true })`; `NumberSequenceService.next()` still locks and validates the reserved policy before allocation.
- Exact-head push CI #1855 and PR CI #1856 both passed on `cb13aaa99b9af5997186f24ea8481609289d7c7b`, including PostgreSQL/concurrency validation and authenticated live HTTP acceptance. The sixteenth Codex thread received exact evidence and is resolved; all 16 known threads are resolved. This documentation reconciliation creates a docs-only final-review head that must pass exact-head CI and Codex re-review before squash merge.

- Final Codex exact-head review of `8fa823ca3c30b232a555f9b4e412bffb5702c3e8` found two genuine P2 database-integrity gaps: direct Prisma/SQL could create an unlinked active Claim on the exact period of retained WITHDRAWN/REJECTED/REPLACED history, and a direct Assessment could exceed the retained Claim-line total while reciprocal state checks still passed.
- Commit `ee8d3f2ab8e93b1c05136d16dcc5165b1997df05` adds forward-only migration `20260930163000_v0_5_c_unlinked_correction_assessment_amount_guards`. The existing deferred replacement-lineage function now rejects final unlinked DRAFT/SUBMITTED/ASSESSED Claims when terminal history exists for the same company/project/agreement/exact period. Database-level regressions prove an unlinked direct correction transaction is rejected and fully rolled back, equal/lower direct Assessments remain valid, and greater-than-total direct Assessment persistence is rejected.
- Same-boundary inspection identified one additional direct-transaction bypass: insert an Assessment while its parent Claim is still Draft, reduce Draft lines, then advance the Claim to ASSESSED. Follow-up commit `55ea55cc62a85ef45a51bfa444a7d65b5f36a6b4` adds forward-only migration `20260930164500_v0_5_c_assessment_commit_amount_consistency`, revalidating `assessed_amount <=` the final retained Claim-line total inside the existing deferred reciprocal Assessment/Claim consistency function. Targeted regression proves the entire transaction rolls back, including Claim state, line amount and Assessment evidence.
- Exact-head push CI #1863 and PR CI #1864 both passed on `55ea55cc62a85ef45a51bfa444a7d65b5f36a6b4`, including clean migration application/status, Prisma validation, workspace/PostgreSQL regression, concurrency coverage and authenticated live HTTP acceptance. Both final Codex threads received exact evidence and are resolved; all 18 review threads are resolved. This documentation reconciliation creates a docs-only exact head that must pass exact-head CI and final Codex re-review before squash merge. DEC-015 does not apply.

- Final Codex exact-head review of docs head `cf1db7c9f45adbb42e9098e3f8c606c9e1a625bf` found a nineteenth genuine P2: direct/future persistence could insert terminal WITHDRAWN/REJECTED/REPLACED history beside an existing unrelated active DRAFT/SUBMITTED/ASSESSED Claim for the same exact period, and concurrent opposite-side inserts were not serialized.
- Commit `990ddd088783de4a7c5cb2fcc8d18fa092f554c4` adds forward-only migration `20260930170000_v0_5_c_claim_period_pair_serialization`. The deferred replacement-lineage function now validates the active/terminal exact-period invariant in both directions and obtains a transaction-scoped advisory lock keyed to company/agreement before reading peer history, so concurrent direct/future persistence serializes and the waiter rechecks the winner's committed row. Linked replacement lineage remains allowed by the explicit successor/predecessor relationship checks.
- PostgreSQL concurrency regressions prove a direct terminal insert beside an existing Draft is rejected and rolled back, while simultaneous direct active/terminal inserts for one agreement/period yield exactly one committed Claim. Exact-head push CI #1867 and PR CI #1868 both passed on `990ddd088783de4a7c5cb2fcc8d18fa092f554c4`. The nineteenth Codex thread received exact evidence and is resolved; all 19 review threads are resolved. This documentation reconciliation creates a docs-only exact head that must pass exact-head CI and final Codex re-review before squash merge. DEC-015 does not apply.

## V0.5-C completed / V0.5-D pre-flight

- PR #108 squash-merged to `main` as `3f00de1f984c82c1737c4b47c226d99197b19e54`; post-merge main CI #1871 passed and Issue #107 closed. Final exact-head branch validation was push CI #1869 / PR CI #1870 on `0833cd893f208003215cf39cee9c07b6c9a817ad`, and final Codex review reported no major issues after all 19 prior threads were resolved.
- Issue #109 opens approved V0.5-D Certification and Retention Withholding from that exact green main checkpoint. Branch `v0.5-d-certification-retention` contains source-controlled pre-flight only at entry.
- Stage-D authority is SUB-007/SUB-008, AC-V05-017–022 and BR-V05-13–15 with applicable shared numbering/security/atomicity rules. Retention release, Finance/payment/accounting, tax/FX, Variations/reporting, SUB-011/DOC-009 and V0.7 aggregation remain deferred.
- Pre-Stage-D Agreements are compatibility-backfilled to 0.00% retention/no cap so migration preserves the historical no-withholding effect. New Agreement Drafts expose retention rate/cap and first approval freezes them as commercial terms; changing approved retention terms requires Change Control.
- Stage D will preserve claimed/assessed/certified separation, use configured Approval Matrix maker-checker, snapshot retention calculation inputs/results, keep reversed history, and require the approved linked replacement Claim path after certification reversal. Human V0.5 UAT remains a later separate Release Exit Gate.
