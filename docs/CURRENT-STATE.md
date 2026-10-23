# Construction ERP — Current State

**Last verified:** 2026-10-22 (live GitHub state; local UAT outcomes owner-reported)
**Source of truth:** Live GitHub repository state

**Interpretation rule:** The top `Current Release`, `Current Stage`, completed-stage and active Issue/PR bullets are the live status. Lower sections preserve chronological point-in-time checkpoints for auditability; historical words such as `open`, `pending`, `blocked`, `active` or `next` describe that checkpoint and do not override the live status above.

- **2026-10-23 E2 owner evidence / mobile keyboard remediation:** Issue #233 now records J2 rejection/rework and separate THB J3 Budget/Site-correction/Variation-to-Cost/Management API segment passes, plus matching J3 browser displays and Thai/Traditional Chinese shell screenshots. These are bounded owner-supplied results, not full journey/persona/accessibility or release acceptance. The owner reports mobile-menu Escape-to-close FAIL and the other requested keyboard checks PASS. This branch makes Escape dismissal explicit within the open mobile navigation, preserving the MUI focus trap/restoration and desktop behavior; focused key-handler tests pass, but exact pinned full web/workspace CI and a real browser/Mac retest are pending. The host dependency download was cancelled, so no independent full browser reproduction is claimed. Schedule Baseline, remaining eight-persona/source-link/locales/a11y/recovery evidence and AC-V11-029/030 remain OPEN. Main remains `95a5dfe1227a141e54e657c6d30753cd2c3af290`; unrelated THB-default PR #249 is separate. Older blocked fixture checkpoints below are historical, superseded by Issue #233's newer evidence.

- Active successor: **V1.1-E2 AUTHENTICATED LOCAL UAT IN PROGRESS — J1 API positive path PASS (limited); J2/J3 read-only preflight BLOCKED (Issue #233).** E0/E1, E2 readiness tooling and V1.1 A–D technically complete; no Production deployment or release acceptance. Source candidate `6495470d7fccb2da9fd67cc85a92e98f990901ff`, exact-main CI #4758 SUCCESS. Documentation checkpoint is proposal-only until its PR passes review/CI/merge and post-merge main CI.

- Current Release: **V1.1 Business Workflow & Role UI (DEC-028) — A/B/C/D/E1 COMPLETE; E2 ongoing, AC-V11-023–030 OPEN.** V0.1–V0.8 and V1.0 COMPLETE + ACCEPTED. V1.1 NOT accepted.
- Current Stage: **V1.1-E2 LOCAL BUSINESS UAT — PARTIAL API EVIDENCE, J2/J3 BLOCKED_PRECONDITIONS.** Existing eight distinct business personas and Project readiness were owner-evidenced; authenticated THB J1 PR→payment API positive path passed, but rejection/rework, full browser, locales/a11y, Company/Project isolation and human UAT remain open. Resolve only authorized missing J2/J3 permissions/step eligibility; no inferred grants.
- Latest local UAT evidence (owner-reported; detailed local JSON not independently inspected): J1 `API_POSITIVE_PATH_PASS` on clean candidate `6495470d7fcc`; retained SGD approved PO/GR preserved; independent THB PR/RFQ/PO/GR/Invoice/Payment source and maker/checker denials checked. J2 `BLOCKED_PRECONDITIONS`: 0 active subcontractors, no Project Agreements/WO/Claims/Assessments/Certifications; missing nominated persona create/submit/assess permissions. J3 `BLOCKED_PRECONDITIONS`: existing 2 WBS, 2 active cost codes, 1 BOQ, 2 activities, 1 site report, 3 budget revisions; missing Budget Revision submit and Project Variation create/submit eligibility. Approval-step readout composite `BLOCKED_APPROVAL_STEP_OR_MAKER_CHECKER` is **not proof** workflows are absent.
- Currency integrity: existing Project contains 4 unlabeled POs, 1 explicit SGD PO, 1 THB PO and 3 unlabeled Budget Revisions; no cross-currency totaling/relabeling, immutability-trigger bypass, migration rewrite or historical-record modification authorized. THB-only future app default policy remains separately tracked in Issue #246; Multi-Project PO Allocation remains Issue #245.
- Next evidence: read-only, non-secret approval-step/actor diagnostics; owner-approved minimal UAT-only role/workflow configuration (no SYS_ADMIN business approval), THB-proven test fixtures where necessary, authenticated J2/J3 positive and denial paths, EN/TH/zh-TW browser/keyboard/screen-reader and recovery evidence, then explicit owner AC-V11-029/030. Local evidence: `~/.construction-erp-uat/evidence/v1.1-e2-thb-automated-api-uat.json` and `v1.1-e2-j2j3-readonly-preflight.json` (paths only, not uploaded; do not commit secrets). GitHub durable updates: Issue #233 comments `#6321373215`, `#6322269599`, `#6322364220`.
- Completed Stages: V1.1-E2 readiness tooling (PR #238 exact-head CI #4704/#4705 SUCCESS, three Codex P2 findings fixed, final clean review, exact-main CI #4706 SUCCESS); V1.1-E1 documentation reconciliation (PR #236 head CI #4690/#4691 PASS, Codex clean, exact-main CI #4692 PASS, Issue #233 updated); V1.1-E1 automated/non-browser technical assurance (PR #235, #4686/#4687/#4688 SUCCESS, final clean Codex review; browser gate OPEN); V1.1-D full technical closure (PR #232, exact-main CI #4651 SUCCESS; Issue #225 CLOSED / COMPLETED); V1.1-D3 runtime implementation (PR #231, exact-main CI #4643 SUCCESS); V1.1-D2 runtime + docs technical closure (PRs #229/#230, exact-main CI #4627/#4631; Issue #225 checked); V1.1-D1 runtime + documentation technical closure (PRs #227/#228, exact-main CI #4597/#4605); V1.1-D0 documentation preflight + clean review/CI/merge/post-main; V1.1-A; V1.1-B; V1.1-C1 technical implementation + closure reconciliation; V1.1-C2 technical implementation + closure reconciliation; V1.1-C3 technical implementation + closure reconciliation; V1.1-C full-stage technical exit, Issue #217 closed; V0.1-A through V0.1-H; V0.2-A through V0.2-G; V0.3-A through V0.3-E; V0.4-A through V0.4-E; V0.5 entry gate; V0.5-A; V0.5-B; V0.5-C; V0.5-D; V0.5-E; V0.6 entry gate; V0.6-A; V0.6-B; V0.6-C; V0.6-D; V0.6-E; V0.6 release exit; V0.7 entry gate; V0.7-A; V0.7-B; V0.7-C; V0.7-D; V0.7-E; V0.7 release exit; V0.8 entry gate; V0.8-A; V0.8-B; V0.8-C; V0.8-D; V0.8-E; AC-V08-039 human UAT confirmation; AC-V08-040 Product / Business Owner acceptance; V0.8 release exit; V1.0 entry gate; V1.0-A; V1.0-B; **V1.0-C; V1.0-D; V1.0-E pre-flight; V1.0-E technical AC-V10-035–038; AC-V10-039 owner readiness/UAT evidence acceptance; AC-V10-040 owner V1.0 acceptance / Production go-no-go authorization; V1.0 release exit**.
- Release Exit Issue: **Issue #205 — CLOSED / COMPLETED.** Product / Business Owner acceptance under AC-V10-039/040 is durably recorded; acceptance-record PR #209 and exact-main CI #4233 completed the repository closure sequence. There is no active V1.0 implementation or release-exit PR.
- V1.0 owner release-exit acceptance checkpoint: on 2026-10-13 the Product / Business Owner explicitly accepted AC-V10-039/040 and authorized V1.0 release closure / Production go-no-go. PR #209 squash-merged as `8f5d4f56b38a373ef6d7233b46bcdb218345bf62`; exact-head push CI #4231 / PR CI #4232 PASS; exact-main CI #4233 PASS; Issue #205 CLOSED / COMPLETED. **V1.0 Production Readiness is COMPLETE + ACCEPTED.** No Production deployment is claimed by this closure record.
- V1.0-B closure checkpoint: nine DEC-022 review rounds identified 20 genuine findings total (8 P1 / 12 P2), all remediated with all threads resolved. Final exact-head `ce085b910aa65d00a2786be97f9ca0947e65fe80` passed push CI #3836 / PR CI #3837 and Codex reported no major issues. PR #194 squash-merged as `3d7e6e05cafe6ed0407ce8ec2c5aca89ea196c7e`; exact-main CI #3838 PASS; Issue #193 CLOSED / COMPLETED. **V1.0-B is technically COMPLETE.**
- V0.8-E pre-flight review checkpoint: PR #180 exact head `bd9c3eb351de410821353806837bad0ffddcfb81` passed push CI #3036 / PR CI #3037 and merged as `2f84928c130f328fb1e02d616c41cacb21dc65e1`; exact-main CI #3038 PASS. Successive DEC-022 reviews identified stale live-position/baseline/branch-handoff documentation P2s, all corrected in PR #181. PR #181 final head `35127fb0fedf027324588b3c0806aade808d7fa8` passed push CI #3109 / PR CI #3110 and clean final DEC-02…20475 tokens truncated…al-approval replay/change-payload coverage, concurrent agreement-local Work Order numbering, concurrent administrative revision creation, cancellation-versus-Work-Order submission/final-approval coverage, retained decision-evidence checks and explicit controller permission-metadata regression.
- Additional Stage-B regression now proves Stage-A `create_key` / `create_payload_hash` remain unchanged through submission/approval, Agreement Versions and Work Orders reject hard delete, WBS/Cost Code references reject cross-Project/cross-Company values at service and database boundaries, rejected Work Orders retain decision history, and a replay key cannot disclose an entity outside effective Project access.
- Static concurrency review found that sequence allocation under `SERIALIZABLE` could retain a stale snapshot after the agreement row lock. Administrative revision creation and Work Order creation now use explicit PostgreSQL `READ COMMITTED` with the existing deterministic agreement row lock so waiting transactions see the committed version/sequence before allocating; final approval and cancellation transaction behavior is unchanged.
- The Stage-B web workspace retains the exact client action key across failed/manual workflow retries and clears it only after a confirmed successful response. This preserves backend idempotency if an HTTP response is lost while still allowing later configured approval steps to receive a fresh action key after success.
- After the repository rename, GitHub-hosted runner allocation recovered. Rerun #1730 on `a282611a...` executed for the first time and exposed two historical V0.3 integration suites colliding under parallel Node test-file execution with PostgreSQL serialization/deadlock errors. V0.5-B itself passed in that run.
- Commit `e4e7c28187c75a7a58db0a8bbb822ffbe6c1a807` makes the API test harness deterministic with `node --test --test-concurrency=1`; production transaction isolation and business behavior are unchanged. Exact-head CI #1731 then passed clean migrations, migration status, Prisma validation, dependency audit, the full workspace validation suite, UAT bootstrap and live HTTP acceptance.
- PR #106 is open, mergeable/clean, and PR CI #1733 passed on the same exact head as branch CI #1732. The Codex review bot could not execute because its code-review usage quota was exhausted. The Product / Business Owner explicitly approved a one-time waiver for PR #106 only; DEC-015 records that exception without changing future review expectations or the human UAT gate.
- V0.5-B remains **under validation**, not complete. The branch/PR CI gates are satisfied; this waiver-record documentation must pass exact-head CI/PR CI, then PR #106 may squash-merge. Post-merge `main` CI and Issue #105 closure remain required before V0.5-C. Human V0.5 UAT remains a separate Release Exit Gate.
- Claims/assessments, certification/retention withholding, Variations/reporting, Finance/payment, tax/FX, accounting, cost recognition and retention release remain outside Stage B. DEC-008 open-source / zero-cost-first remains unchanged.


## V0.5-B completed / V0.5-C pre-flight

- PR #106 squash-merged to `main` as `d5cf7bb1a3009d37c6cf875c54d74954e778aa57`; post-merge main CI #1736 passed and Issue #105 closed.
- DEC-015 records the Product / Business Owner's one-time Codex review waiver for PR #106 only. It does not waive V0.5-C review requirements or human V0.5 UAT.
- Issue #107 and branch `v0.5-c-claims-assessments` start from that exact green checkpoint.
- `docs/V0.5-C-PREFLIGHT.md` binds Stage C to SUB-005/SUB-006, AC-V05-011–016 and BR-V05-09–12 with approved numbering/project/security/test rules.
- Payment Certification/retention withholding, Variations/reporting, Finance/payment, tax/FX, cost recognition and human V0.5 release UAT remain deferred.
- V0.5-C implementation may begin only after this pre-flight exact-head CI passes; V0.5-D has not begun.

## Development operating model approved

- DEC-016 approves `docs/DEVELOPMENT-OPERATING-MODEL.md`.
- Chat is the normal Builder / Release Coordinator; GitHub remains the durable source of truth; CI/tests remain technical evidence; the Product / Business Owner retains approval/UAT authority; Work is the periodic independent auditor.
- One active implementation writer should normally modify the active stage branch at a time, and every new implementation session must bootstrap itself from live GitHub before material writes.
- This operating-model approval does not change V0.5-C scope, Issue #107, release sequencing, review/CI gates, human V0.5 UAT, DEC-008 or any approved deferral.



## V0.5-C Claims / Assessments technically implemented — PR gate

- V0.5-C remains limited to SUB-005/SUB-006, AC-V05-011–016 plus applicable AC-V05-027–029, and BR-V05-09–12. Payment Certification/retention, Variations/reporting, Finance/payment/accounting, tax/VAT, FX, cost recognition, retention release, SUB-011/DOC-009 and V0.7 aggregation remain deferred.
- Persistence/API delivers immutable `SCLYYMM-###` Claim identity, Draft period/line editing, submitted source immutability, Agreement and approved-Work-Order cumulative ceilings, withdrawal, linked replacement, retained Assessment history, claimed-versus-assessed separation, Assessment rejection/correction history, Project authorization, explicit permissions, audit and stable retry/action-key behavior.
- The Subcontracts web workspace exposes the approved Stage-C Claim/Assessment lifecycle only. Submitted Claim source values are read-only; claimed and assessed values remain distinct; actions are permission-gated while backend authorization remains the security boundary.
- Authenticated runtime acceptance now exercises Draft creation, lines, valid submission, duplicate/over-claim denial, submitted-source immutability, lower Assessment, claimed/assessed separation, Assessment rejection, linked replacement, unauthorized Project denial and the active-Claim Agreement cancellation guard while preserving previous-release regression.
- PostgreSQL concurrency coverage now proves same-period active-Claim contention, Agreement-ceiling competing submissions, per-Work-Order ceiling competing submissions, Agreement cancellation versus Claim submission, and cancellation versus Assessment finalization.
- Concurrency testing exposed and fixed a real stale-snapshot cancellation race: Agreement cancellation now uses the deterministic Agreement row lock with `READ COMMITTED`, so a waiter rechecks the winner's committed Claim/state before deciding.
- Final security review also hardened the approved separate Assessment read boundary: Claim list/detail responses redact nested Assessment history unless the caller has `subcontracts.assessment.view`; regression covers both detail and list behavior.
- Exact implementation head `02c8281a6e79e3d5c7b7a67efe9fea3f31ad1d58` passed CI #1756. This documentation record changes the branch head, so a new exact-head CI is required before the Stage-C PR is opened.
- Human V0.5 UAT/business acceptance is not complete and is not self-approved. V0.5-D remains blocked until V0.5-C PR/review/merge/post-merge gates pass and Issue #107 closes.
- Exact arithmetic in the Claims UI now uses integer cents instead of JavaScript floating-point `Number`, preserving valid DECIMAL(18,2) display precision across the approved numeric range.
- Codex review on `90ffe38ae6` produced two findings; fixes are in `6ab22059b2474fbe69200fc7ea5129bcdd625a0b` and `ce32dbd25af26a7052f47c562a3694c89accff19`, with regression coverage in `07c83c65188684e63905df156396b7191033d8dc`. Both review threads are resolved; final re-review of the latest head is pending.
- Final exact-head Codex review of `620222b0dc05f97aa702b8b7024a38498dc656f4` identified two genuine P2 concurrency gaps. Direct Claim-line mutations now take a parent Claim row lock before evaluating Draft immutability through new forward-only migration `20260930123000_v0_5_c_claim_line_parent_lock`; the already-executed Stage-C migrations remain unchanged.
- NumberSequence allocation under `READ COMMITTED` now rejects an earlier reset period after a later period has committed, preventing a delayed older-period allocation from moving `lastPeriodKey` backward and duplicating a reset value. Targeted PostgreSQL regressions cover the Claim-line/submission race and reset-period regression. Exact-head CI and Codex re-review remain pending; DEC-015 does not apply.


## V0.6-A Supplier Invoice technically implemented — PR gate

- Scope remains limited to the approved V0.6-A Supplier Invoice foundation: one Project per invoice, Company base currency, optional PO/GR source traceability, optional same-Project WBS and same-Company Cost Code, Draft editing, configured Approval Matrix, maker-checker, retained submitted/approved/rejected history, explicit Finance permissions, audit/replay protection and authenticated web/API flows.
- Persistence adds `supplier_invoices`, `supplier_invoice_items` and `finance_action_replays` through a forward-only migration. Database guards enforce immutable business numbering/history, Draft-only line mutation, retained line/header totals, valid lifecycle transitions, one-Project invoice scope, same-Company/Supplier/Project source scope, current approved PO source, posted/non-reversed GR source and PO/GR line lineage.
- Internal identity remains UUID-based while Supplier Invoice numbering uses the reserved existing Number Sequence policy `SIYYMM-###` with monthly reset. `supplier_reference` remains separate and unique per Company + Supplier.
- The Finance service/API/UI provides scoped Project selection, Supplier Invoice register/detail, Draft header/line maintenance, PO/GR source selectors, WBS/Cost Code allocation, submit/approve/reject actions, retained decision history and source-to-invoice forward trace from PO lines and GR items.
- Automated evidence covers duplicate supplier reference, idempotent create/action replay, base-currency use, one-Project and source-scope rejection, maker-checker, technical `SYS_ADMIN` business-authority separation, rejection history, approved/rejected immutability, direct database history guards, concurrent approval serialization, unauthorized Project denial and prior-release regression.
- Authenticated live HTTP acceptance extends the existing construction scenario through a real approved PO and posted GR into Supplier Invoice Draft → submit → checker approval → retained history → PO/GR forward trace → unauthorized Project denial.
- Exact-head implementation/test CI #2089 passed on `e5926031c3b1ddff558e159cfa0165cc6c0a309b`. The stage is not merged or complete: documentation/PR CI, focused Chat review and the required Codex exact-head review gate remain. Human V0.6 Product / Business Owner UAT remains the later Release Exit Gate after V0.6-A through V0.6-E and is not self-approved here.
- Client Invoice/AR, Payments/allocations, subcontract Finance payment handoff, retention accounting, cash flow/reporting, tax/VAT, FX, GL/journals, accruals, chart of accounts, matching tolerances/automation, credit/debit notes, approved-invoice cancellation, V0.7 and V0.8 remain deferred.

## Codex review economy policy approved — DEC-022

- Product / Business Owner approved the permanent stable-merge-candidate Codex policy on 2026-10-02 after a live GitHub check.
- Chat + CI remain continuous during active implementation; Codex is reserved for stable merge candidates and material/high-risk re-review rather than every intermediate head.
- V0.6-B PR #122 already has a clean final Codex review on exact head `10e0b7257bf803d7e368bb10311c1e070cde92a5`, CI #2326 passed and all 29 review threads are resolved. No further Codex review is required unless that PR receives a material code/schema/security/business-behavior change before merge.
- Required human V0.6 UAT/business acceptance is unchanged and has not been completed.

## V0.6-B completed / V0.6-C implemented under PR #126

- PR #122 squash-merged to `main` as `0e4d8314f23471e82165e27c745dbd0057a5d42e` after final PR-head CI #2331 passed and all 29 review threads were resolved.
- Final Codex runtime review of `10e0b7257b` reported no major issues. Later PR-head movement was documentation/governance reconciliation only under DEC-022.
- Post-merge `main` CI #2332 passed and Issue #121 closed completed. V0.6-B is technically complete.
- V0.6-C pre-flight PR #125 merged as `606b6622bd6e22623b8aadf8178dd4b905df5c4b`; pre-flight CI #2336 and post-merge `main` CI #2337 passed before implementation began.
- Issue #124 / PR #126 contain the implemented Payment / approvals / allocations stage. First stable-head Codex review on `48bbff5d2502d9ac2e9d2676ef3fc9cb1ffd358f` identified one genuine P1: CANCELLED Payment rows could still alter retained approval actor/time/decision metadata.
- Forward-only `20261003005000_v0_6_c_cancelled_payment_approval_history` fixes the P1 without editing executed migrations. Exact fix runtime head `246246521b8adf9ebab4aa0e43d53195b842f3f4` passed PR CI #2364 with migrations, full workspace/prior-release regression and authenticated live HTTP acceptance.
- Stage-C hardening now includes immutable retained approval evidence through cancellation, reciprocal ApprovalAction/ApprovalInstance evidence guards, serialized decision ordering, retained actor/time/comment binding, clean-Draft insert enforcement, same-Project allocation enforcement, stable retry protection, concurrency-safe create/allocation/approval/cancellation, controlled cancellation restoring derived AP/AR and a Subcontract Certification reversal guard while active Finance allocation exists.
- Payment action permissions now require Payment view permission at role configuration, and the workspace renders retained approval/cancellation timestamps for human evidence review.
- DEC-022 is being applied as intended: Codex was not spent on intermediate Stage-C fixes. Because the first stable review produced one genuine material P1 and the fix changes database integrity behavior, one fresh exact-head Codex re-review is now required after documentation-head CI; no per-fix review loop is introduced.
- V0.6-D, V0.6-E and human V0.6 release UAT remain later gates. V0.6-D must not begin before PR #126 merge, post-merge main CI and Issue #124 closure.


## V0.6-E implementation / validation checkpoint

- Pre-flight PR #131 merged as `d05f6d57966329767182f8befe6f3a0b2d891ee3`; post-merge `main` CI #2385 passed.
- Stage-E implementation branch: `v0.6-e-cash-flow-reporting`.
- Derived Project Cash Flow uses canonical final approved, non-cancelled Payment records only; it creates no editable financial ledger.
- D06-19 / DEC-020 behavior is implemented: full Payment amount exactly once on Payment date, INBOUND as inflow, OUTBOUND as outflow, independent of allocation completeness.
- Settlement allocation amount/status and trace remain visible without changing the Payment-level cash-flow amount.
- Inclusive Payment-date filtering is available without changing source ownership.
- Permission-aware Finance Reports present existing source-derived AP, AR, Payment, payable-retention and Project cash-flow views without inventing a report-owned balance.
- Backend authorization requires existing Finance permissions plus effective Project access; technical SYS_ADMIN alone does not receive Payment/cash-flow authority.
- Focused unit coverage proves approved/cancelled source-state behavior, full/partial/unallocated allocation independence and direction-aware totals.
- Authenticated live HTTP acceptance proves cancelled-payment exclusion, fully allocated inbound cash flow, wholly unallocated outbound cash flow, date filtering, Project denial and SYS_ADMIN denial.
- Initial stable candidate `92cf87c48367697a8d35b44f223cdd348cc0e0f7` passed push CI #2393 and PR CI #2394. Its first DEC-022 Codex review identified two genuine findings: a P1 mixed/historical-currency aggregation risk after Company base-currency changes and a P2 test-registration omission.
- Both findings were fixed together at `898f809d45540c766bc54d92b9ebfeb607524d50`: Project Cash Flow now rejects any included approved/non-cancelled Payment whose stored currency differs from the current Company base currency instead of inventing FX or mislabelling totals, and `cash-flow.spec.ts` is registered in the API test command.
- Fix head `898f809d45540c766bc54d92b9ebfeb607524d50` passed push CI #2395 and PR CI #2396, including clean migrations/status, Prisma validation, dependency audit, the now-executed focused cash-flow tests, full prior-release regression and authenticated live HTTP proof that a base-currency mismatch fails safely and valid reporting resumes after restoration.
- No schema migration or mandatory paid dependency was introduced by Stage E.
- V0.7 Actual/Committed/Paid Cost ledgers, Direct Cost Posting, tax/VAT, FX, GL/journals/accruals and other approved deferrals remain excluded.
- Because the P1 changed financial reporting behavior, DEC-022 requires one fresh exact-head Codex re-review after this evidence-only documentation reconciliation. No per-fix Codex loop is introduced.
- Remaining technical gate: final documentation-head push/PR CI, fresh exact-head Codex re-review, squash merge, post-merge `main` CI and Issue #130 closure.
- After technical completion, STOP at AC-V06-037–038. Product / Business Owner human UAT and explicit release acceptance remain pending.


## V0.6 release-exit gate

- V0.6-E PR #132 final reviewed material head `d44c934c2935964d146ec5b9aa1cc34e6d794f68` passed push CI #2397 and PR CI #2398 after the material currency/test-registration fixes.
- Fresh exact-head Codex re-review found no remaining code/schema/security/business-behavior issue and one docs-only stale-summary P2.
- Final docs-only PR head `d59678768eb83f73c7f567e3f70c4b3c8b34725c` passed push CI #2399 and PR CI #2400; all review threads resolved.
- PR #132 squash-merged as `b8b24a1c1ab424a7e662a99b537004461df359e4`.
- Post-merge `main` CI #2401 passed.
- Issue #130 closed completed.
- Issue #133 now tracks AC-V06-037 human Finance UAT and AC-V06-038 explicit Product / Business Owner release acceptance.
- `docs/V0.6-UAT-EVIDENCE.md` is the prepared walkthrough/evidence pack.
- Automated acceptance remains technical evidence only. It does not self-approve the human gate.
- V0.7 is blocked until explicit V0.6 release acceptance and release closure.


## V0.6 DEC-023 release-exit exception

- Product / Business Owner explicitly instructed: **“make exception , review on my behalf and let me know the result”**.
- DEC-023 is a one-time V0.6 AC-V06-037 execution waiver only; it does not claim personal human UAT and does not create a standing precedent.
- Chat performed the authorized proxy evidence review against the complete prepared V0.6 UAT scope using merged-main evidence.
- Review result: **PASS**.
- Blocking business defects: **NONE**.
- Supplier Invoice/PO-GR, Client Invoice/AP-AR, Payment/allocation/cancellation, Subcontract retention/reference, Finance Reports/Project Cash Flow, security boundaries and V0.7 scope boundary all passed the available authenticated evidence.
- Merged-main CI #2401 passed 55 authenticated current-release checks; release-exit checkpoint main CI #2405 passed.
- AC-V06-038 explicit Product / Business Owner acceptance is recorded.
- DEC-023/evidence branch CI #2407 and PR CI #2408 passed.
- PR #135 squash-merged as `6ebb18c8813c208caa26d6c55ad5dda1f2d79e24`.
- Post-merge main CI #2409 passed.
- Issue #133 closed completed.
- V0.6 Finance is complete and accepted.
- V0.7 Cost Control is the next release; entry-gate work is permitted, but no V0.7 implementation has begun.


## V0.7 Cost Control release entry gate

- Product / Business Owner approved the complete V0.7 entry baseline on 2026-10-03 with “go ahead i trust u”.
- Decision: DEC-024.
- Completed entry-gate Issue: #137.
- Historical entry-gate branch: `v0.7-entry-gate`.
- Approved AC baseline: AC-V07-001–052.
- Approved business rules: BR-V07-01–16.
- Approved owner decisions: D07-01–11.
- Approved implementation decomposition: V0.7-A Integrated Cost Source Read Model; V0.7-B Direct Cost Posting; V0.7-C Forecast/ETC/Variance; V0.7-D Project Variations/Revenue/Profit; V0.7-E Cost Reporting/Hardening/Release Evidence.
- Critical semantic rule: Committed Cost, Actual Cost and Paid Cost remain separate.
- No second editable Cost Control ledger is authorized.
- V0.7 entry gate is COMPLETE: PR #138 merged, post-merge main CI #2417 passed and Issue #137 closed completed. V0.7-A subsequently began under Issue #139 / PR #140.


## V0.7-A implementation checkpoint

- Entry gate: COMPLETE — PR #138 merged, main CI #2417 PASS, Issue #137 closed.
- Active Issue: #139.
- Active branch: `v0.7-a-cost-read-model`.
- Initial Stage-A implementation head `c861dcd5470c04cd454f14c4836144d4064ce6f1` passed CI #2419.
- Stable pre-fix PR head `469b2e573528cd4048de4ec10f6981d443b679e6` passed push CI #2427 and PR CI #2428, including authenticated Stage-A live HTTP acceptance.
- Codex reviewed `469b2e573528cd4048de4ec10f6981d443b679e6` and returned three genuine findings: P1 durable current-state evidence, P2 full-precision aggregation, and P3 Markdown newline formatting. All three are addressed in material fix head `c3884bae2a7ab3cbe67c0132262b2cc55026857a`; exact push CI #2429 and PR CI #2430 PASS. Fresh DEC-022 Codex review is required because P2 materially changed financial aggregation behavior.
- Stage-A scope: read-only Original/Revised Budget, Procurement/Subcontract Committed Cost, Supplier/Subcontract Actual Cost, Paid Cost, dimensional rollups and source evidence.
- New permission: `cost.control.view` via a forward-only migration; no implicit SYS_ADMIN grant.
- No Direct Cost, Forecast, client Project Variation, revenue/profit or Cost Control mutation is part of Stage A.
- DEC-022: first stable-head review completed with P1/P2/P3 findings; the material fix head is green and requires one fresh review before merge.

## V0.7-A historical currency fix validation

- Fresh Codex review of `fd7382dd2b` identified the historical Budget/PO currency P1.
- Fix `95cd15073424bf39454d230352873ba40909095e` retains database-controlled immutable source currency and revision provenance through a new forward-only migration.
- Legacy currency remains unverified/NULL rather than being guessed; Cost Control fails closed with an explicit error. Known source currency must match current Company base currency.
- Exact fix push CI #2433 and PR CI #2434 PASS: clean migration/status, schema, audit, full regression, isolated Budget/PO cases, source-currency guards and 57 authenticated runtime checks.
- All four genuine review threads resolved; fresh stable-candidate Codex review CLEAN on `5c9c79fa73c58223e733105ce1ed04fa847ccef3`; final documentation-head CI, merge, post-merge main CI and Issue #139 closure remain required.
- V0.7-B has not begun. V0.7 human release UAT and explicit owner acceptance remain separate pending gates.

## V0.7-A final independent review checkpoint

- Codex final re-review: no major issues on `5c9c79fa73c58223e733105ce1ed04fa847ccef3` (PR #140 comment 5967264059).
- Reviewed-head push CI #2435 and PR CI #2436 PASS; all four genuine findings fixed and threads resolved.
- This reconciliation changes documentation only. DEC-022 retains the clean material review; no further Codex request is required unless runtime/schema/security/business behavior changes.
- Remaining technical gates: final documentation-head CI, squash merge, post-merge main CI and Issue #139 closure. V0.7-B remains blocked until those predecessor gates pass.

## V0.7-A completed / V0.7-B pre-flight

- PR #140 squash-merged as `d2d1aa75715aa9260b27d89a7029dcab1e9c4941`; final packaging head `5f62dd3c908bbf76b9802eea16685ebb58730901` passed push/PR CI #2437/#2438.
- Codex reviewed `5c9c79fa73c58223e733105ce1ed04fa847ccef3` and found no major issues. Later head movement changed evidence documents only under DEC-022.
- Post-merge main CI #2439 PASS with 57 runtime checks; all four genuine findings fixed and review threads resolved. Issue #139 closed completed. V0.7-A is technically COMPLETE.
- Issue #141 now tracks V0.7-B Direct Cost Posting under approved D07-07–10 / DEC-024. `docs/V0.7-B-PREFLIGHT.md` records its inherited boundary.
- Pre-flight is documentation only. V0.7-B application/schema implementation remains NOT STARTED until this PR merges and post-merge main CI passes; it must then use a fresh implementation branch from that exact green main.
- Forecast/ETC/Variance, Project Variations/revenue/profit, V0.8 and required human V0.7 release acceptance remain later gates.


## V0.7-B merge-candidate checkpoint

- Issue #141 tracks Direct Cost Posting under DEC-024 / D07-07–10 and the approved V0.7 Stage-B boundary.
- Pre-flight PR #142 merged as `8fed1288254154fbba111386c4b1ab94f4de43d4`; post-merge main CI #2443 PASS. Implementation branch `v0.7-b-direct-cost-posting` started from that exact green main.
- Implemented forward-only `direct_cost_postings` / replay persistence, explicit Cost Control permissions, Project + required Cost Code + optional WBS scope, retained base currency, approval binding, immutable approved history and linked exact reversal integrity.
- Backend/API and authorized web workspace support Draft create/edit, submission, maker-checker approval/rejection and linked reversal. Approved signed Direct Cost contributes Actual Cost on posting date and remains separate from Paid Cost / Project Cash Flow.
- Aggregate-only `cost.control.view` retains aggregate measures without leaking Direct Cost source records; detailed Direct Cost evidence requires a Direct Cost business permission. SYS_ADMIN receives no implicit Direct Cost business authority.
- Implementation checkpoints: backend `141259b0ea055cf573d5953035e23887d1af4637`; source-redaction fix `2d8ecb958d062f7c5d83c56cc1620f7b9be4d36a`; web workflow `0104b0aaf74b50e7d726482a8c8c0d57b0a7ce13`; web typing fix `c088fdcdad59a194bf45565be34aa0ba92990e5d`; live runtime evidence `d7811139985c88d6a068cee933c475f347d5ce80`.
- CI #2449 reached live HTTP and exposed `erp_direct_cost_scope_guard()` ambiguity between a PL/pgSQL variable and `approval_instances.approval_state`. No prior migration was edited; forward-only correction migration `20261003104000_v0_7_b_direct_cost_scope_guard_fix` was added in `e32b89f9a37e53e80cbc6f6ae3bcb3a141a17fab`.
- Exact corrected implementation head `e32b89f9a37e53e80cbc6f6ae3bcb3a141a17fab`: push CI #2450 PASS; 99 API regression tests PASS; authenticated runtime scenario `MUS9B907` PASS with 59 checks covering Direct Cost create/retry/edit/submit/maker-checker/approval/immutability/reversal/rejection, authorization and Actual-versus-Paid separation.
- Draft PR #143 is open only to attach final durable evidence without prematurely consuming the DEC-022 review. After this documentation-only packaging head passes push and PR CI, mark it ready and run the stable-candidate Codex review.
- No Codex waiver applies. Squash merge, post-merge main CI and Issue #141 closure remain mandatory before V0.7-C may begin.
- Human V0.7 UAT and explicit Product / Business Owner release acceptance remain later release-exit gates and are not satisfied by Stage-B automated evidence.


## V1.0-C final independent review checkpoint

- Final reviewed material head `0c0f7755386d160e706e5e65b218f66a7b77e63f` passed exact-head push CI #3930 and PR CI #3931, including workspace regression, Production startup/restart, authenticated live acceptance and the paired recovery drill. Across DEC-022 review rounds, four genuine findings were remediated and resolved (three P1, one P2): downstream staged-file cleanup on validation failure, disk-backed Site Execution photo uploads, bounded expired login-bucket purge, and partial temp-file cleanup when staging aborts. Final DEC-022 re-review on `0c0f7755386d160e706e5e65b218f66a7b77e63f` reported no major issues.
- All four genuine review threads are resolved.
- This packaging reconciliation changes documentation/status only. No additional Codex review is required under DEC-022 unless runtime/schema/security/business behavior changes.
- Remaining gates: final docs-only exact-head push + PR CI, squash merge PR #198, post-merge exact-main CI, close Issue #196 and hand off V1.0-D.
- V1.0-C is not yet technically COMPLETE until those merge/post-merge closure gates pass.


## V1.0-C completed / V1.0-D handoff

- V1.0-C Security Hardening is technically COMPLETE: PR #198 squash-merged as `feb98b9e58e471a4190ac4bac531d6289d5fa4f4`; exact-main CI #3944 PASS. Final material head `0c0f7755386d160e706e5e65b218f66a7b77e63f` passed push CI #3930 / PR CI #3931; all four genuine DEC-022 findings (3 P1 / 1 P2) were remediated and resolved, and final material re-review reported no major issues. Final docs-only packaging head `206cd6d3e4994bc303ec446725bee0dd8a1c409f` passed push CI #3942 / PR CI #3943. Issue #196 is CLOSED / COMPLETED.
- V1.0-C AC-V10-017–026 is technically COMPLETE.
- This reconciliation changes documentation/status only; no runtime, schema, permission, dependency or business-rule behavior changes.
- V1.0-D Operations / Observability / Performance Readiness is NEXT. Its approved boundary remains AC-V10-027–034 plus applicable BR-V10 and D10 decisions.
- V1.0-D application/schema implementation is NOT STARTED. Begin only with a fresh documentation-only pre-flight after this handoff merges and the resulting exact-main CI passes.
- V1.0-E and AC-V10-039/040 Product / Business Owner release-exit authority remain later gates.
