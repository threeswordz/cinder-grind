# Construction ERP — Current State

**Last verified:** 2026-10-03
**Source of truth:** Live GitHub repository state

- Current Release: V0.6 Finance — **IN PROGRESS**. V0.6-A through V0.6-D are technically complete. V0.6-E Project Cash Flow / Finance Reporting / Release Evidence is implemented and at its final merge gate.
- Current Stage: V0.6-E — **FINAL MERGE-GATE VALIDATION**. Pre-flight PR #131 merged as `d05f6d57966329767182f8befe6f3a0b2d891ee3` with post-merge main CI #2385 PASS. Implementation PR #132 is open from `v0.6-e-cash-flow-reporting`. The first stable review found genuine P1/P2 issues; batched fix head `898f809d45540c766bc54d92b9ebfeb607524d50` passed push CI #2395 and PR CI #2396. Documentation-reconciled head `d44c934c2935964d146ec5b9aa1cc34e6d794f68` passed push CI #2397 and PR CI #2398; its fresh exact-head Codex re-review found no remaining code/schema/security/business-behavior issue and only one P2 stale-summary documentation finding, corrected by the current docs-only commit.
- Completed Stages: V0.1-A through V0.1-H; V0.2-A through V0.2-G; V0.3-A through V0.3-E; V0.4-A through V0.4-E; V0.5 entry gate; V0.5-A; V0.5-B; V0.5-C; V0.5-D; V0.5-E; V0.6 entry gate; V0.6-A; V0.6-B; V0.6-C; V0.6-D
- Active Issue / PR: Issue #130 / PR #132 — V0.6-E Project Cash Flow / Finance Reporting / Release Evidence. Remaining technical sequence is docs-only exact-head push/PR CI → resolve the stale-summary thread → squash merge PR #132 → post-merge `main` CI → close Issue #130. Under DEC-022 no additional Codex review is required for this docs-only correction. After technical closure, **STOP at AC-V06-037–038** for Product / Business Owner human UAT and explicit V0.6 release acceptance.
- V0.5-C green main checkpoint: PR #108 squash-merged as `3f00de1f984c82c1737c4b47c226d99197b19e54`; final exact-head push CI #1869 and PR CI #1870 passed on `0833cd893f208003215cf39cee9c07b6c9a817ad`; final Codex exact-head review reported no major issues; post-merge main CI #1871 passed; Issue #107 closed.
- V0.5-D green main checkpoint: PR #110 squash-merged as `aceeb82ad13a2f6c773d307541ddd02fafc69a92`; final exact-head push CI #1898 and PR CI #1899 passed on `0cf62c630153a6ac2326f352c0064243b3a2f45f`; final Codex exact-head review reported no major issues; post-merge main CI #1900 passed; Issue #109 closed.
- V0.5-E green main checkpoint: PR #112 squash-merged as `c054b9253e1ad2623a3fc233ba125003b2894c37`; final exact-head push CI #1930 and PR CI #1931 passed on `9ba8d862dcf66e7b00d7006d9398b19d83026e41`; final Codex exact-head review reported no major issues; post-merge main CI #1932 passed; Issue #111 closed. AC-V05-030 was explicitly accepted by the Product / Business Owner on 2026-10-01.
- V0.5 Release Exit checkpoint: fresh automated walkthrough #1933 attempt 2 passed 46 checks (`MUP0LKS3`); acceptance PR #114 corrected head `23ae1efb7ecf845ef5422682b81d950710295c5e` passed push CI #1941 and PR CI #1942 with clean final Codex re-review; PR #114 squash-merged as `6973ba513134e463ab41341313705ffa44486d74`; post-merge main CI #1943 passed; Issue #113 closed; V0.5 is complete and accepted.
- V0.5-B green main checkpoint: PR #106 squash-merged as `d5cf7bb1a3009d37c6cf875c54d74954e778aa57`; post-merge main CI #1736 passed; Issue #105 closed
- V0.5 entry gate: PR #102 squash-merged as `5b67832079ef6ded86bc79f997d8115835d0c55e`; post-merge main CI #1611 passed; Issue #98 closed
- Completed Issue: #92 — V0.4-E Stock Transfer / Inventory Documents / Reporting / Release Evidence
- Completed Issue: #89 — V0.4-D Material Reservation / Issue / Return
- Completed Issue: #87 — V0.4-C Derived Stock Balance / Project-Site Stock Views
- Completed Issue: #85 — V0.4-B Goods Receipt / PO Receipt Controls / Stock Transaction Ledger
- Completed Issue: #83 — V0.4-A Warehouse / Inventory Foundation
- Merged completion-evidence PR: #94 (`26b4e6ceba114f57f225a96fd6e8de4fe0b489fe`); exact-head branch CI #1550 and PR CI #1551 passed at `bbfa8865d8d2a45713b88e4e3d073e73a7a291b5`; post-merge main CI #1552 passed
- Merged PR: #93 — V0.4-E Stock Transfer / Inventory Documents / Reporting (`6a04d95410589b5e9cb8c7a55d19aa095b9ee67c`); post-merge main CI #1543 passed
- Merged PR: #91 — V0.4-D Material Reservation / Issue / Return (`941e2e9c2966bac66ea1d01b34cb39fb5ce75bdd`); post-merge main CI #1492 SUCCESS
- Merged PR: #88 — V0.4-C Derived Stock Balance / Project-Site Stock Views (`096ee639f7e0597dd6c4068d9d1d0c323f66f15d`)
- Merged PR: #86 — V0.4-B Goods Receipt / Stock Transaction Ledger (`1f39a0d9e9c8d0d9dc32112e6eec4ec36321ac4d`)
- Merged PR: #84 — V0.4-A Warehouse / Inventory Foundation (`4ab736203c9870f4b6782ad85c108f3b0b66accd`)
- Completed Issue: #81 — V0.4 Inventory Release Entry Gate — Scope, Acceptance & Business Rules
- Merged PR: #82 — docs: approve V0.4 Inventory entry gate
- Completed Issue: #79 — V0.3 Procurement Product / Business Owner acceptance record
- Merged PR: #80 — docs: accept V0.3 Procurement
- Completed Issue: #76 — V0.3-E Schedule Risk / Procurement Reporting / Traceability
- Completed Branch: `v0.3-e-schedule-risk`
- Merged PR: #77 — V0.3-E: Schedule Risk / Procurement Reporting
- Completed Issue: #72 — V0.3-D Purchase Order
- Completed Branch: `v0.3-d-purchase-order`
- Merged PR: #74 — V0.3-D: Purchase Order
- Completed Issue: #67 — V0.3-C RFQ / Quotations
- Completed Branch: `v0.3-c-rfq-quotations`
- Merged PR: #70 — V0.3-C: RFQ / Quotations
- Completed Issue: #64 — V0.3-B Purchase Request
- Completed Branch: `v0.3-b-purchase-request`
- Merged PR: #65 — V0.3-B: Purchase Request
- Completed Issue: #59 — V0.3-A BOQ & Budget
- Completed Branch: `v0.3-a-boq-budget`
- Merged PR: #60 — V0.3-A: BOQ & Budget
- Completed Issue: #57 — V0.3 Release Entry Gate — Scope & Acceptance Baselines
- Completed Branch: `v0.3-entry-gate`
- Merged PR: #58 — V0.3 entry gate: approve Procurement baselines and business rules
- Completed Issue: #53 — V0.2-G UAT Reference Programme
- Completed Branch: `v0.2-g-uat-reference`
- Merged PR: #54 — V0.2-G UAT Reference Programme and Release Closure
- Completed Issue: #51 — V0.2-F Equipment
- Completed Issue: #50 — V0.2-F Equipment — Business Rules
- Completed Issue: #48 — V0.2-E Site Execution
- Completed Branch: `v0.2-e-site-execution`
- Merged PR: #49 — V0.2-E Site Execution
- Completed Issue: #47 — V0.2-E Site Execution — Business Rules
- Completed Issue: #45 — V0.2-D Gantt / Lookahead
- Completed Branch: `v0.2-d-gantt-lookahead`
- Merged PR: #46 — V0.2-D Gantt / Lookahead
- Completed Issue: #40 — V0.2-C Baselines / Progress
- Completed Branch: `v0.2-c-baselines-progress`
- Completed Issue: #38 — V0.2-C Baselines / Progress — Business Rules
- Completed Issue: #36 — V0.2-B Scheduling Engine
- Completed Branch: `v0.2-b-scheduling-engine`
- Completed Issue: #35 — V0.2-B Scheduling Engine — Calculation Rules
- Completed Issue: #29 — V0.2 Release Entry Gate — Scope & Acceptance Baselines
- Completed Branch: `v0.2-entry-gate`
- Completed Issue: #27 — V0.1-H Integration / Regression / UAT
- Completed Branch: `v0.1-h-integration-uat`
- Merged PR: #28 — V0.1-H Integration / Regression / UAT
- Previous completed Issue: #25 — V0.1-G Basic Documents
- Previous merged PR: #26 — V0.1-G Basic Documents
- Previous completed Issue: #23 — V0.1-F WBS & Cost Codes
- Previous merged PR: #24 — V0.1-F WBS & Cost Codes
- Previous completed Issue: #20 — V0.1-E Projects
- Previous merged PR: #22 — V0.1-E Projects
- Latest verified V0.1 merge commit: `9ff4ab48d9321c2345c04343be2bde301e933065` — V0.1-H: Integration / Regression / UAT (#28)
- Final Stage E PR CI: Validate Construction ERP run #351 — SUCCESS
- Project creation scope decision: Option A — APPROVED. A scoped creator must have an active Employee link and is atomically added to the initial Project Team.
- Final Stage F PR CI: Validate Construction ERP run #403 — SUCCESS on `ce649c16b139f2ebb81d0fa71fce7420fbde4b79`.
- Stage F final review: no unresolved review threads, no scope creep into Activities/Scheduling, BOQ/Budget, Procurement or transaction allocations.
- Final Stage G PR CI: Validate Construction ERP run #443 — SUCCESS on `298890cbd72965067d59995f81283ca7b4f5410b`.
- Stage G final review: no unresolved review threads; no WBS/Activity or later-module document scope added.
- Final Stage H exact-head CI: Validate Construction ERP run #528 — SUCCESS, including live HTTP acceptance.
- Governance checkpoint validation before this state update: Validate Construction ERP run #473 — SUCCESS on `f94292a1ad11dc1d8eb28c2e65ba9d1e8a127e22`.
- V0.1 cross-module release acceptance scenario: PASS in the Stage H release-candidate regression suite.
- Open defect check at V0.1 acceptance: no Severity 1 or Severity 2 release-blocking defect recorded.
- Governance: `AGENTS.md`, `docs/PROJECT-GOVERNANCE.md`, PR governance checklist, DEC-008, DEC-016 and DEC-022 are active. DEC-022 makes Codex a stable-merge-candidate/high-risk independent gate rather than a continuous per-fix reviewer; human UAT and CI/release sequencing are unchanged.
- Next action: validate and merge the docs-only V0.6-E pre-flight, verify post-merge `main` CI, then create the Stage-E implementation branch from that exact green checkpoint. Stage E implements only derived Project Cash Flow, basic Finance reporting, policy/traceability hardening and release evidence under the approved V0.6 baseline. After V0.6-E technical completion, STOP at required human V0.6 UAT/business acceptance under AC-V06-037–038.

## Stage E completed

- Project, Project Member and Project Contact database models and source-controlled migrations
- Customer and configurable Project Status relationships
- Contract value, location/description and planned dates
- Project permission catalogue and existing SYS_ADMIN permission migration
- Database-derived project-scope access foundation
- Project APIs/services for scoped reads, updates, archive/reactivate, team and contacts
- PostgreSQL Project integration tests wired into the API test command
- Project UI: permission-aware navigation, scoped list/search/filter, create/edit, Customer/status selection, planned dates/contract value, archive/reactivate, Team and Contacts
- Security regression coverage: assigned-project visibility, access_all, cross-company references, unauthorized direct service/API-scope paths, and Project Team scope
- Option A Project creation API: scoped creators require an active Employee link and receive an automatic active `Project Creator` membership

This file is a concise checkpoint only. Re-check live GitHub Issues, branches, PRs, commits and CI before modifying a stage.


## Stage F completed

- Hierarchical Project WBS with code, name, description and active/inactive lifecycle
- Database trigger preventing cross-Project WBS parent relationships and hierarchy cycles
- Company Cost Code register structurally independent of WBS
- WBS and Cost Code permission catalogue and SYS_ADMIN technical provisioning
- Project-scoped WBS APIs and company-scoped Cost Code APIs with audit logging
- Permission-aware WBS & Cost Codes UI
- PostgreSQL integration coverage for Project scope, access_all, hierarchy integrity, company isolation and WBS/Cost Code dimensional independence


## Stage G completed

- Configurable Document Types and PostgreSQL document/link metadata
- File bytes stored outside PostgreSQL through a replaceable DocumentStorage abstraction
- Local filesystem provider with opaque server-generated UUID storage keys and configured storage root
- Configurable file size and MIME allow-list policy with safe filename validation
- Project-scoped document list/upload/download/archive APIs with audit logging
- Permission-aware Documents UI with scoped Project selection, upload/download/archive and Document Type administration
- Security/integration coverage for Project scope, projects.access_all, company isolation, path traversal, unsafe filenames/storage keys, size/MIME policy, physical-path non-disclosure and byte round-trip


## Stage H technical gates completed so far

- Cross-module V0.1 release acceptance integration scenario added to the normal regression suite
- Full existing authentication/session/CSRF/authorization/master-data/Project/WBS/Documents regression suite remains green
- Clean PostgreSQL migration-from-zero and production dependency audit pass in CI
- V0.1 acceptance traceability and approved-scope limitations documented
- Deployment, rollback/recovery and safe Staging/UAT smoke procedure documented
- Manual V0.1 UAT scenario, test data, expected results and sign-off record prepared
- Local self-hosted API/web smoke and authenticated application load passed
- CI #524 live HTTP V0.1 acceptance passed on `16c76a172bd314a9c5c2431ad112a9090a9d7a15`
- Product / Business Owner accepted V0.1 Foundation on 2026-09-26


## V0.1 Foundation completed

- Stage H PR #28 squash-merged to `main` as `9ff4ab48d9321c2345c04343be2bde301e933065`
- Issue #27 closed automatically by the merged PR
- local self-hosted API/web smoke and authenticated application load passed
- CI #528 passed the exact accepted head, including repeatable live HTTP acceptance
- Product / Business Owner accepted V0.1 Foundation on 2026-09-26
- open-source / zero-cost-first runtime constraint remains active


## V0.2 release entry gate

- V0.2 Scope Baseline v0.1 approved by Product / Business Owner on 2026-09-26
- V0.2 Acceptance Criteria Baseline v0.1 approved by Product / Business Owner on 2026-09-26
- V0.2 contains 47 approved requirements: 37 Must Have and 10 Should Have
- canonical Project → WBS → Activity architecture remains mandatory
- scheduling logic remains independent of Frappe Gantt
- DEC-008 open-source / zero-cost-first runtime constraint remains active
- no V0.3+ scope is introduced by the V0.2 baselines


## V0.2 release entry gate completed

- PR #30 squash-merged to `main` as `f12625424aa605876b66c5ceb86896c4626b1e28`
- Issue #29 closed automatically
- CI #543 passed on the approved exact head
- V0.2 Scope Baseline v0.1 and V0.2 Acceptance Criteria Baseline v0.1 are approved
- V0.2-A Scheduling Data Model is the next active stage


## V0.2-A completed

- Working Calendar, weekday rule and exception/holiday persistence
- company-level and Project-specific calendar scope with timezone/default/active metadata
- Activity Type company register and administration permission
- canonical Activity persistence under Project → WBS → Activity
- Activity hierarchy with same-Project validation and database/service cycle prevention
- Activity identification, type, calendar, operational status, planned/actual/forecast fields, responsibility and owner references
- Activity dependency persistence for FS / SS / FF / SF and signed lag work days
- dependency self-reference and cross-Project integrity prevention; full dependency-graph scheduling/cycle engine remains V0.2-B
- Stage A scheduling permission catalogue and System Administrator technical provisioning
- secured REST APIs with Project-scope authorization and audit logging
- permission-aware Scheduling UI for Activities, dependencies, Working Calendars and Activity Types
- PostgreSQL integration coverage wired into the normal API regression suite
- no new runtime dependency and no paid component introduced


- Stage A PR #32 squash-merged to `main` as `35ec6198fc66994f7f2f8c0181178a02466824e6`
- Issue #31 closed automatically
- exact-head CI #594 passed, including PostgreSQL scheduling integration and live HTTP acceptance
- final review found no unresolved review threads and no Stage B/C/D, Site Execution, Equipment or V0.3+ scope creep


## V0.2-B active

- Product / Business Owner approved all six Scheduling Engine calculation rules on 2026-09-26.
- DEC-009 records work-day duration, successor-calendar lag, signed lag/lead, milestone, CPM/Total Float and calendar-precedence conventions.
- Issue #36 is the active implementation work item.
- Branch: `v0.2-b-scheduling-engine`.
- Stage B remains backend/domain-owned and independent of Frappe Gantt.
- No paid scheduling engine or mandatory paid dependency is permitted.


## V0.2-B implementation progress

- pure backend/domain Scheduling Engine added with no new runtime dependency
- DEC-009 work-day, lag, milestone, CPM and calendar-precedence rules implemented
- working-calendar-aware planned/forecast schedule analysis
- FS / SS / FF / SF dependency semantics
- signed lag / lead evaluated on the successor Activity calendar
- fractional work-day positions retained in the schedule read model while existing DATE fields remain the persisted projection
- dependency graph topological evaluation and cycle rejection
- database trigger prevents circular active dependency graphs even outside normal service paths
- database/service milestone integrity requires zero duration and matching planned start/finish
- CPM forward/backward pass, Total Float and critical-Activity derivation
- Project-scoped `GET /api/v1/schedule/projects/:projectId/analysis?mode=planned|forecast`
- deterministic engine tests cover holidays, negative lag, mixed calendars, fractional durations, FS/SS/FF/SF, forecast roots, float and cycles
- PostgreSQL integration covers milestone/cycle constraints and schedule analysis
- live HTTP acceptance covers calculated dates, Critical Path evidence, cycle rejection and unassigned-Project denial
- final exact-head CI #647 passed on `012ff6479da005044fce5a83bdfb26630eac6d23`, including migration-from-zero, full regression, interval/timezone-aware Scheduling Engine tests and live HTTP acceptance


## V0.2-B completed

- Stage B PR #37 squash-merged to `main` as `bc942de7937fe105a6367f57a5f88a559daf81e8`
- Issue #36 closed automatically
- DEC-009 Scheduling calculation rules implemented
- working-calendar calculations honor configured working intervals and IANA time zones
- FS / SS / FF / SF relationships and signed successor-calendar lag/lead implemented
- dependency graph cycle prevention is enforced in service logic and PostgreSQL with Project-scoped concurrency serialization
- upgrade-safe milestone integrity is enforced for new/updated rows without silently rewriting legacy schedule data
- planned/forecast backend schedule analysis, CPM, Total Float and critical-Activity derivation implemented
- all four automated review findings addressed and review threads resolved
- final exact-head CI #647 passed, including PostgreSQL migrations, full regression, API startup and live HTTP acceptance
- no new runtime dependency, paid scheduling engine, Stage C/D/E/F, or V0.3+ scope introduced


## V0.2-C pre-flight

- Stage B is complete and merged.
- Issue #38 records the unresolved Product / Business Owner rules for baseline approval/versioning, baseline snapshot content, progress-history corrections, explicit actual dates and delay calculation.
- Existing configurable Approval Matrix can support baseline approval without hard-coding approver Roles.
- Stage C implementation is paused until Issue #38 rules are approved or replaced.


## V0.2-C active

- Product / Business Owner approved all six Baselines / Progress rules on 2026-09-26.
- DEC-010 is authoritative for approval, versioning, snapshot, progress, actual-date and delay semantics.
- Issue #40 is the active implementation work item.
- Branch: `v0.2-c-baselines-progress`.
- superseded Issue #39 is closed and must not be used as a business-rule source.
- Stage C reuses the existing Approval Matrix and introduces no paid dependency.


## V0.2-C implementation progress

- DEC-010 Baselines / Progress rules implemented
- immutable versioned Schedule Baseline and Activity snapshot persistence
- existing configurable Approval Matrix reused with `SCHEDULE_BASELINE` entity type and maker-checker enforcement
- current baseline derived from the latest approved version; prior approved versions remain immutable history
- append-only Activity Progress history with 0–100 validation and correction entries
- explicit Project actual start/completion dates added; Activity actual/forecast dates remain independent
- signed working-calendar baseline/forecast variance and DELAYED / ON_TIME / AHEAD / UNAVAILABLE classification
- secured Project-scoped baseline, progress and comparison REST APIs
- permission-aware Baselines & Progress Scheduling UI
- PostgreSQL integrity triggers enforce baseline immutability, progress append-only history and same-company/Project scope
- deterministic working-day variance tests and PostgreSQL Stage C integration coverage
- live HTTP acceptance covers configured Approval Matrix, maker-checker denial, approval, progress correction, Project actual dates and delay comparison
- CI #697 passed on `b5b7104a1b7176cbadad253dd1e6be10c7cda200` before final documentation commits; exact-head CI will be revalidated after documentation completion
- no new runtime dependency or paid service introduced


## V0.2-C completed

- PR #41 squash-merged to `main` as `3742ec78a7ba54242834523468a09643654e9764`
- Issue #40 closed automatically
- DEC-010 Baselines / Progress rules implemented
- immutable versioned Schedule Baselines and immutable Activity snapshot rows
- configurable `SCHEDULE_BASELINE` Approval Matrix with maker-checker enforcement
- current comparison baseline derived from the highest approved version; historical approved versions remain unchanged
- append-only Activity Progress history; the latest appended entry is current even when it is a backdated correction
- explicit Activity and Project actual dates remain independent of planned/baseline/forecast values
- signed working-calendar baseline/forecast variance and delay classification implemented
- Project-scope authorization, permissions, audit and database integrity controls are active
- exact-head CI #708 passed on `2e9cfefcf56ef16d75a1f8eb19153425eb00f707`, including migrations, full regression, Stage C PostgreSQL integration and live HTTP acceptance
- no new runtime dependency or paid service introduced


## V0.2-D pre-flight

- V0.2-C is complete and merged.
- Issue #42 records the remaining Product / Business Owner presentation rules for read-only Gantt interaction, current forecast/baseline display, 14/28-calendar-day lookahead windows, overlap inclusion and backend-derived delayed/critical indicators.
- Frappe Gantt remains the approved MIT/open-source visualization component only.
- No paid Gantt dependency is proposed.
- Stage D implementation is paused until Issue #42 rules are approved or replaced.

## V0.2-D active

- Product / Business Owner approved all six Gantt / Lookahead presentation rules on 2026-09-26.
- DEC-011 records read-only Gantt mutation behavior, backend current-forecast precedence, current-approved-baseline presentation, 14/28-calendar-day lookahead windows, overlap inclusion and backend-derived critical/delay indicators.
- Issue #45 is the active implementation work item.
- Branch: `v0.2-d-gantt-lookahead`.
- Frappe Gantt remains visualization-only; all schedule calculations remain backend/domain-owned.
- V0.2-E Site Execution, V0.2-F Equipment and V0.3+ remain out of scope.

## V0.2-D completed

- PR #46 squash-merged to `main` as `dbe2c6d43d785781f1fe3aea23782f95f47eacbe`.
- Issue #45 closed automatically.
- DEC-011 Gantt / Lookahead presentation rules implemented.
- backend-owned Project schedule presentation combines current forecast, current approved baseline, progress, dependencies, Activity status, Critical Path, Total Float and delay classification.
- Project-scoped Gantt and inclusive 14/28-calendar-day lookahead endpoints implemented.
- lookahead uses current-forecast overlap and retains completed Activities when they overlap the selected window.
- permission-aware Gantt / Lookahead UI provides Master Gantt, 2-week and 4-week views plus Day / Week / Month modes and Activity detail/reference presentation.
- Frappe Gantt 1.2.2 is pinned as an MIT/open-source visualization dependency only; official stylesheet is retained locally with its MIT notice to avoid CDN/package-layout coupling.
- schedule calculations, baseline comparison, delay and critical-path logic remain backend/domain-owned.
- exact-head branch CI #762 and PR CI #763 both passed on `2ee4224adb74f6bee0c5001f37d4153dcf5ef5f5`, including migrations, full regression, production dependency audit, web build and live HTTP V0.2-D acceptance.
- no Site Execution, Equipment or V0.3+ implementation was introduced by Stage D.

## V0.2-E pre-flight

- Stage D is complete and merged.
- Issue #47 records the remaining Product / Business Owner rules for Daily Site Report identity/lifecycle, Activity Progress integration, manpower aggregation, material-use observation boundaries, Equipment dependency, weather/issues/delays/inspections and site photographs.
- Stage E implementation is paused until Issue #47 rules are approved or replaced.
- Stage E must not duplicate the Equipment Register before V0.2-F, post Inventory stock movements, introduce a full QA/QC workflow, or require an external weather service.

## V0.2-E active

- Product / Business Owner approved all eight Site Execution business rules on 2026-09-26.
- DEC-012 is authoritative for Daily Report identity/lifecycle, Activity Progress integration, manpower, material-use boundaries, Equipment dependency, weather/issues/delays/inspections and site photographs.
- Issue #48 is the active implementation work item.
- Branch: `v0.2-e-site-execution`.
- Daily Report progress reuses the existing immutable Activity Progress history; no parallel progress ledger is permitted.
- Material usage remains observational and must not post Inventory.
- Equipment master/usage selection remains a V0.2-F dependency; Stage E must not create free-text or duplicate Equipment.
- no payroll/timesheet, full QA/QC, external weather dependency or V0.3+ scope is introduced.

## V0.2-E implementation progress

- DEC-012 Site Execution rules implemented for one canonical Daily Site Report per Project/reporting date and `DRAFT → SUBMITTED` lifecycle.
- aggregated manpower, observational Material usage, local weather, site issues, delay reasons and lightweight inspection references implemented.
- Daily Report progress appends to the existing immutable Scheduling Activity Progress history on submission; Schedule Baselines remain untouched.
- submitted-report progress corrections append later immutable Activity Progress rows with `DAILY_SITE_REPORT_CORRECTION` source traceability rather than overwriting earlier progress.
- submitted Daily Site Report header/content, report-specific document links and correction records are protected by PostgreSQL integrity guards.
- site photographs/files reuse the existing Documents storage abstraction and Project document linkage; no storage key/physical path is exposed.
- Equipment remains an explicit V0.2-F integration boundary; Stage E introduces no free-text or duplicate Equipment master.
- material observations do not post Inventory or modify Stock Balance; no Inventory transaction dependency is introduced.
- Project-scope permissions, audit logging and same-Project/company reference validation are active.
- responsive Site Execution UI supports draft creation/editing, submission, observations, progress, photos/documents and append-only corrections.
- Stage E integration coverage includes Project/date uniqueness, cross-Project denial, submission/progress traceability, database immutability and document-link guards.
- live HTTP acceptance covers the V0.2-E field workflow and unassigned-Project denial.
- Stage E testing exposed and fixed a pre-existing direct Project-access edge case where an empty Project scope could be overwritten by the requested Project id; a regression test now protects that shared authorization helper.
- CI #790 and CI #792 passed during implementation, including migrations, full regression, production dependency audit, web build and live HTTP acceptance; final exact-head CI is revalidated after the final hardening/documentation commits.
- no payroll/timesheet, full QA/QC, external weather service, Inventory posting, Equipment duplication or V0.3+ scope was introduced.

## V0.2-E completed

- PR #49 squash-merged to `main` as `20b9661f2e456a4a05639626b18869de92ee7579`.
- Issue #48 closed by the merged PR.
- DEC-012 Daily Site Report rules implemented.
- one canonical Daily Site Report per Project/reporting date with DRAFT → SUBMITTED lifecycle.
- aggregated manpower, material-use observations, local weather, site issues, delay reasons and lightweight inspections implemented.
- Daily Report progress appends into the existing immutable Activity Progress history; submitted-report progress corrections append later history rather than rewriting prior entries.
- site photographs/files reuse the existing Documents storage abstraction; physical storage keys remain server-side.
- submitted report content and Daily Site Report document links are protected from silent mutation.
- Project/date uniqueness, Company/Project reference integrity, Project-scope authorization and audit controls are active.
- direct Project access empty-scope composition was hardened and regression-tested.
- Stage E retained the V0.2-F Equipment boundary: no free-text/duplicate Equipment master was introduced.
- exact-head branch CI #812 and PR CI #813 passed on `da3432635a358a6a5e7dbe2047dec271bb38609c`.
- post-merge `main` CI #814 passed on `20b9661f2e456a4a05639626b18869de92ee7579`, including migration-from-zero, full regression, builds and live HTTP acceptance.
- no Inventory posting, payroll/timesheets, full QA/QC, external weather dependency, Equipment cost allocation, paid dependency or V0.3+ scope was introduced.

## V0.2-F pre-flight

- Stage E is complete and merged.
- Issue #50 records the unresolved Product / Business Owner rules for Equipment identity/type, operational status, derived availability, Project assignment history, usage, Daily Site Report integration and usage corrections/history.
- EQP-001 through EQP-007 and SITE-005 are the V0.2 Stage F requirements.
- EQP-008 Maintenance Records remains Future.
- EQP-009 Equipment Cost Allocation remains V0.7 Cost Control.
- Stage F implementation is paused until Issue #50 rules are approved or replaced.

## V0.2-F active

- Product / Business Owner approved all Equipment business rules on 2026-09-26.
- DEC-013 is authoritative for Equipment identity/type, operational status, derived availability, Project assignment, usage, Daily Site Report integration and usage-history correction semantics.
- Issue #51 is the active implementation work item.
- Branch: `v0.2-f-equipment`.
- SITE-005 will be completed by referencing the canonical Equipment Register; free-text Equipment remains prohibited.
- Equipment Maintenance remains Future and Equipment Cost Allocation remains V0.7.
- no fuel/meter/depreciation/asset accounting, Inventory posting, paid dependency or V0.3+ scope is introduced.

## V0.2-F implementation progress

- DEC-013 Equipment rules implemented for Company-owned Equipment Types and Equipment register.
- operational status is `AVAILABLE` / `UNAVAILABLE`; user-facing `AVAILABLE` / `ASSIGNED` / `UNAVAILABLE` availability is derived from active state, operational status and effective assignment.
- dated Project assignment history is retained with at most one open assignment per Equipment; reassignment closes rather than deletes prior history.
- canonical Equipment Usage supports optional 0–24-hour operating duration plus optional Activity/WBS/remarks context and requires an effective same-Project assignment on the usage date.
- manual usage is audit-correctable but not ordinarily deletable; Daily Site Report-origin usage is immutable.
- SITE-005 is integrated with the canonical Equipment Register: draft report lines select only eligible Project-assigned Equipment, submission materializes canonical Equipment Usage, and submitted-report corrections append later usage history.
- PostgreSQL guards enforce Company/Project scope, assignment/date eligibility, usage-hour bounds, retained assignment/usage history and Daily Site Report materialization before submission.
- permission-aware responsive Equipment workspace covers Equipment Type, register, derived availability, assignment/release and usage history/manual corrections.
- Site Execution UI now includes canonical Equipment usage and correction lines; free-text Equipment remains prohibited.
- Stage F integration tests cover derived availability, assignment/reassignment history, manual usage, report-origin usage/corrections, operational unavailability and database no-delete/immutability controls.
- live HTTP acceptance covers Equipment register → Project assignment → derived availability → manual usage → Daily Site Report usage/correction → scoped denial.
- functional branch CI #843 passed on `84377e82dc3b0dc73989ebc122d87fbff13cb3e9`; exact-head CI will be revalidated after documentation completion.
- EQP-008 Maintenance remains Future; EQP-009 Equipment Cost Allocation remains V0.7; no Inventory posting, asset accounting, fuel/meter tracking, paid dependency or V0.3+ scope is introduced.

## V0.2-F completed

- PR #52 squash-merged to `main` as `d16b411becd7223d8548ee43bc9608387ac98548`.
- Issue #51 closed by the merged PR.
- DEC-013 Equipment rules implemented for Equipment Types, Equipment register, operational status, derived availability, Project assignment history and canonical usage history.
- SITE-005 now references the canonical Equipment Register; Daily Site Report submission materializes canonical Equipment Usage and submitted-report corrections append later usage history.
- assignment and usage history are protected from ordinary physical deletion; Daily Site Report-origin Equipment Usage is immutable.
- exact-head branch CI #847 and PR CI #848 passed on `1d9f0929bbf16d99710a32c8cd5f510d3ab3fef6`.
- post-merge `main` CI #849 passed on `d16b411becd7223d8548ee43bc9608387ac98548`.
- EQP-008 Maintenance remains Future; EQP-009 Equipment Cost Allocation remains V0.7; no Inventory posting, asset accounting, fuel/meter tracking, paid dependency or V0.3+ scope was introduced.

## V0.2-G active

- Issue #53 is the active V0.2 release-exit validation work item.
- Branch: `v0.2-g-uat-reference`.
- SCH-019 and Testing/UAT §23 already define the approved Ground Floor Slab reference scenario; no additional Product / Business Owner rule gate is required.
- reference WBS: Groundworks → Ground Floor Slab.
- reference detailed programme: Setting Out, Excavation, Compaction, Blinding Concrete, Formwork, Reinforcement, Inspection and Concrete Pour.
- detailed durations sum to 20 working days on the reference Monday–Friday calendar.
- Stage G is validation/release-exit work only; production features are changed only if a V0.2 acceptance defect is found.
- V0.3 Procurement and all later-release scope remain excluded.

## V0.2-G implementation progress

- the approved SCH-019 Ground Floor Slab reference programme is encoded as a reusable fixed dataset and automated integration scenario.
- eight detailed Activities total exactly 20 working days on the Monday–Friday reference calendar, with literal planned dates from 2026-10-01 through 2026-10-28.
- a controlled one-working-day forecast shift moves the reference finish to 2026-10-29 while the approved baseline remains unchanged.
- backend Scheduling Engine planned/forecast dates, Critical Path and Total Float are asserted independently before comparing the Gantt/read model.
- 2-week and 4-week lookahead membership is asserted against fixed expected Activity sets.
- Stage G release-exit review identified two previously missed V0.2 Must-Have gaps: DOC-006 WBS/Activity Documents and RPT-002 Project Engineer Dashboard / RPT-001 operational reporting.
- DOC-006 is now closed by reusing the existing secure Documents owner/storage architecture with validated Project + WBS/Activity links and PostgreSQL target-scope integrity.
- RPT-001/RPT-002 are now closed by a Project-scoped Project Engineer dashboard derived from Scheduling, Site Execution and Equipment source modules; no reporting transaction ledger is introduced.
- the V0.2 Should-Have review records Activity Types as delivered while Project Type configuration remains the documented deferred remainder of ADM-008.
- V0.2 release traceability, UAT record, release checklist and deployment/rollback procedure are now source-controlled.
- full functional validation CI #884 passed on `7b09fb92317d4e9990be48fa0175fd1078d8bd1f`, including migrations, all regression/integration tests, builds and the expanded live HTTP V0.2 acceptance scenario.
- final exact-head branch CI, PR CI, merge/post-merge CI and Product / Business Owner V0.2 acceptance remain release gates.

## V0.2-G completed

- Issue #53 closed after PR #54.
- PR #54 squash-merged to `main` as `50d58931ae8275edbc95b3e7cb1f05de730262ef`.
- exact-head branch CI #887 passed on `85e70e2808c899b53eafb8394f1d9a670d4cca92`.
- PR CI #888 passed on the same exact head.
- post-merge `main` CI #889 passed on `50d58931ae8275edbc95b3e7cb1f05de730262ef`.
- SCH-019 Ground Floor Slab reference programme passes with eight detailed Activities totaling 20 working days from 2026-10-01 through 2026-10-28.
- controlled one-working-day forecast delay moves finish to 2026-10-29 while the approved baseline remains unchanged.
- backend schedule calculations, Critical Path and Total Float agree with the Gantt/read model.
- 2-week and 4-week lookahead acceptance passes.
- release-exit review found and closed DOC-006 WBS/Activity Documents and RPT-001/RPT-002 operational reporting / Project Engineer Dashboard gaps.
- no open Severity 1 or Severity 2 release-blocking defect was recorded at the Stage G release review.
- no V0.3+ scope or mandatory paid runtime/service dependency was introduced.

## V0.2 technical release checkpoint

- all seven V0.2 build/validation stages are merged.
- all 37 Must-Have requirements have implementation/evidence paths.
- all 10 Should-Have requirements have delivered/deferred status documented; the Project Type portion of ADM-008 remains the documented deferred remainder while Activity Types are delivered.
- migration-from-zero, migration status, production dependency audit, API/web typecheck, regression/integration suites, live HTTP acceptance and production builds are green on post-merge `main` CI #889.
- deployment/rollback procedure, traceability, release checklist and UAT record are source-controlled.
- V0.2 is technically release-ready but is **not Product-accepted yet**.
- Product / Business Owner sign-off remains the release decision gate before V0.2 is marked complete and V0.3 Procurement begins.

## V0.2 Project & Scheduling completed

- Product / Business Owner explicitly accepted **V0.2 Project & Scheduling** on **2026-09-27**.
- final accepted repository checkpoint before sign-off: `0cdebbf95eb155a4cde126673685b2b145c57af3`.
- final post-merge validation CI #895 passed on that checkpoint.
- V0.2-A through V0.2-G are complete.
- all approved V0.2 Must-Have requirements have implementation/evidence paths.
- V0.2 release boundaries and Should-Have deferrals were reviewed and accepted with the release decision.
- V0.2 is formally closed.
- V0.3 Procurement may now enter its release-entry governance gate; implementation remains blocked until V0.3 scope and acceptance baselines are approved.

## V0.3 release entry gate active

- Issue #57 is the active V0.3 governance work item.
- Branch: `v0.3-entry-gate`.
- V0.3 master-requirement inventory contains 32 approved requirements: 31 Must Have and 1 Should Have.
- target requirements are BUD-001–BUD-010, PROC-001–PROC-019, DOC-007, RPT-005 and SYS-007.
- PROC-020 remains V0.6 Finance; PROC-021 remains V0.7 Cost Control.
- V0.3 Scope Baseline v0.1 and V0.3 Acceptance Criteria Baseline v0.1 were explicitly approved on 2026-09-27.
- BR-V03-01 through BR-V03-18 were explicitly approved as proposed on 2026-09-27 and are authoritative unless changed through Change Control.
- V0.3 entry gate is complete: PR #58 merged as `924e0ccad00d399246aa3ced95ec5013b8d18f0d`; post-merge main CI #916 passed.
- V0.3-A implementation is authorized under Issue #59 and branch `v0.3-a-boq-budget`.

## V0.3 entry gate completed

- Product / Business Owner approved V0.3 Scope Baseline v0.1, V0.3 Acceptance Criteria Baseline v0.1 and BR-V03-01 through BR-V03-18 on 2026-09-27.
- PR #58 merged to `main` as `924e0ccad00d399246aa3ced95ec5013b8d18f0d`.
- exact-head PR CI #915 passed on `352a194e1f947f49957edb7c3b24ff43cc4d5421`.
- post-merge `main` CI #916 passed on `924e0ccad00d399246aa3ced95ec5013b8d18f0d`.
- Issue #57 is closed.
- V0.3-A BOQ & Budget is the active implementation stage under Issue #59 / branch `v0.3-a-boq-budget`.
- V0.4 Inventory, V0.6 Finance and V0.7 Cost Control ownership boundaries remain unchanged.

## V0.3-A implementation progress

- BUD-001–BUD-010 are implemented on branch `v0.3-a-boq-budget` under Issue #59.
- one canonical working BOQ per Project with stable Section/Item identities and soft archive/reactivation.
- BOQ Item quantity/UOM/rate/amount are server/database validated; amount is derived as quantity × rate.
- Project context is inherited; optional WBS and Cost Code remain independent validated dimensions.
- Budget Revision creation captures an immutable Draft snapshot of active BOQ data and assigns a Company-unique immutable number through configured Number Sequence `BUDGET_REVISION`.
- exact human-readable Budget/PR/RFQ/PO number formats remain intentionally configuration-owned/deferred under approved BR-V03-17; Stage A does not hardcode a production format.
- submission is a separate Draft → Submitted transition using the existing configurable `BUDGET_REVISION` Approval Matrix and backend maker-checker.
- first approved revision is derived as Original Budget; latest approved revision is Current Revised Budget; rejected revisions remain history.
- Project, WBS and Cost Code approved-budget summaries are source-derived from immutable revision lines, including unallocated categories.
- latest approved revision is exposed as a downstream read model for later Procurement without duplicating BOQ/Budget ownership.
- PostgreSQL guards enforce Company/Project dimensional integrity, arithmetic, snapshot immutability and retained commercial history.
- responsive BOQ & Budget workspace supports BOQ maintenance, Draft creation/submission/approval and Original/Revised budget summaries.
- integration tests cover canonical BOQ, dimensional validation, immutable Draft/approved snapshots, maker-checker, Original/Revised semantics, rejected history and downstream approved-budget reads.
- live HTTP acceptance covers BOQ → Draft Budget → submit → maker-checker approval → Revised Budget while preserving Original Budget, plus Project-scope denial.
- full implementation branch CI #939 passed on `06f743755a16a3642d5f33b8d075e41204a34215` before documentation completion.
- PR review identified three acceptance defects; all were fixed before merge: Original Budget now follows earliest approval completion event, revision-only approvers can select assigned Projects, and Draft creation respects archived Sections.
- final exact-head branch CI #959 and PR CI #960 passed on `f8349b2e4751512f88abdeebf2381d114e09f586`.
- PR #60 squash-merged to `main` as `ec90e5a736de61333343f542ce7deef79d78b8ff`.
- post-merge `main` CI #961 passed on `ec90e5a736de61333343f542ce7deef79d78b8ff`.
- no PR/RFQ/quotation/PO, Inventory, Finance, Actual Cost, tax/VAT, FX or V0.7 Cost Control behavior is introduced.

## V0.3-A PR #60 review fixes

- Original Budget identity is now derived from the earliest approval completion event, so approving a lower revision number later cannot retroactively replace the Original Budget.
- the Current Revised Budget remains the highest/latest approved revision number.
- revision-only Budget approvers can load assigned Projects through a dedicated Project selector endpoint without requiring BOQ-view permission.
- the BOQ/Budget UI no longer enables Draft Budget creation when all active Items belong to archived Sections.
- integration/live acceptance coverage was extended for approval-order semantics and revision-only approver Project selection.

## V0.3-A completed

- Issue #59 — V0.3-A BOQ & Budget is complete.
- PR #60 — V0.3-A: BOQ & Budget merged to `main` as `ec90e5a736de61333343f542ce7deef79d78b8ff`.
- exact-head branch CI #959 passed on `f8349b2e4751512f88abdeebf2381d114e09f586`.
- exact-head PR CI #960 passed on the same head.
- post-merge `main` CI #961 passed on `ec90e5a736de61333343f542ce7deef79d78b8ff`.
- BUD-001 through BUD-010 are delivered.
- Original Budget is permanently tied to the earliest actual approval completion event; a lower revision number approved later cannot replace it.
- the highest/latest approved revision number is the Current Revised Budget.
- no V0.3-B+ procurement transaction behavior was pulled forward.
- V0.3-B remains gated by the deferred BR-V03-17 human-readable numbering-format decision.

## V0.3-B pre-flight

- Issue #62 is the active pre-flight item.
- Branch: `v0.3-b-purchase-request-preflight`.
- V0.3-A completion checkpoint PR #61 merged as `b61f69edc2f9280d793b40e30796bb83678ec4f0`.
- completion-checkpoint branch CI #964 and PR CI #965 passed.
- post-merge main CI #966 passed.
- proposed BR-V03-17 numbering baseline:
  - Budget Revision: `BRYY-###` / YEARLY
  - Purchase Request: `PRYYMM-###` / MONTHLY
  - RFQ: `RFQYYMM-###` / MONTHLY
  - Purchase Order: `POYYMM-###` / MONTHLY
- Product / Business Owner explicitly approved this numbering baseline on 2026-09-27; V0.3-B Purchase Request implementation is authorized after the pre-flight PR is merged.

## V0.3-B active

- Product / Business Owner approved the V0.3-B Procurement Numbering Baseline on 2026-09-27.
- approved formats: Budget Revision `BRYY-###` / YEARLY; Purchase Request `PRYYMM-###` / MONTHLY; RFQ `RFQYYMM-###` / MONTHLY; Purchase Order `POYYMM-###` / MONTHLY.
- numbering pre-flight PR #63 merged to `main` as `51e6f5a87f30db4baa5dd3cd49cc62f6c9c5af13`.
- exact-head PR CI #973 and post-merge main CI #974 passed.
- Issue #62 is closed; Issue #64 is the active implementation work item.
- Branch: `v0.3-b-purchase-request`.
- Stage B implements PROC-001 through PROC-003 plus Required-on-Site demand context required by AC-V03-011.
- RFQ, quotation, supplier award, PO, Inventory, Finance and Actual Cost remain excluded.


## V0.3-B completed

- Issue #64 — V0.3-B Purchase Request is complete.
- PR #65 — V0.3-B: Purchase Request squash-merged to `main` as `e392b468a22c701fbb1a60b1e87b7ef08d4794d1`.
- final exact-head PR CI #1027 passed on `88cac51a05a26d782f7cec252d8689dc223e7952`.
- post-merge `main` CI #1028 passed on `e392b468a22c701fbb1a60b1e87b7ef08d4794d1`.
- PROC-001 through PROC-003 plus Stage-B Required-on-Site demand context are delivered under AC-V03-008 through AC-V03-011 and cross-cutting V0.3 controls.
- approved Purchase Request numbering is `PRYYMM-###` with MONTHLY reset, Company scope, assignment at creation, immutability and no reuse.
- MATERIAL / SERVICE demand, Project/WBS/Cost Code/Activity context, Required-on-Site, maker-checker Approval Matrix, rejection-copy history, cancellation and Project scope are implemented.
- review hardening fixed multi-approver cancellation after a prior approval action, exposed approval actor/comment history, made Material code/description history immutable, and rejects quantity values beyond `DECIMAL(18,4)` before persistence.
- all four Codex review threads were resolved with regression coverage before merge.
- no RFQ, quotation, supplier award, PO, Inventory, Finance, Actual Cost or schedule-date mutation behavior was pulled forward.
- next stage is V0.3-C RFQ / Quotations pre-flight under PROC-004 through PROC-008 and BR-V03-08 through BR-V03-10.

## V0.3-C active

- Issue #67 records the Stage C pre-flight and implementation contract.
- Branch: `v0.3-c-rfq-quotations` from green `main` checkpoint `dd9f293274fc1974de7e27df9fe060074a18d94b`.
- Entry CI: post-completion `main` CI #1033 passed.
- Stage C implements PROC-004 through PROC-008 under AC-V03-012 through AC-V03-016 and BR-V03-08 through BR-V03-10.
- RFQ numbering uses the approved `RFQYYMM-###` / MONTHLY Company sequence.
- Stage C does not invent an RFQ approval workflow, award approval workflow, Supplier Quotation number format, award reversal policy, PO behavior, Expected Delivery/schedule-risk behavior, committed cost, Inventory or Finance behavior.

## V0.3-C completed

- Issue #67 — V0.3-C RFQ / Quotations is complete.
- PR #70 — V0.3-C: RFQ / Quotations squash-merged to `main` as `3ba9164b0edab46d0eecc305540d4f3e9840627e`.
- final branch CI #1147 and exact-head PR CI #1148 passed on `9f667b17bfe9c1e8dfc957fa35620f7f5a2b9b70`.
- post-merge `main` CI #1150 passed on `3ba9164b0edab46d0eecc305540d4f3e9840627e`.
- PROC-004 through PROC-008 are delivered under AC-V03-012 through AC-V03-016 and BR-V03-08 through BR-V03-10.
- RFQ numbering is `RFQYYMM-###` with MONTHLY reset and Company-scoped immutable allocation.
- approved PR demand can flow into RFQs, multiple Supplier invitations, canonical Supplier Quotations, derived comparison and line-level Supplier Awards with source traceability.
- aggregate awarded quantities are guarded against approved PR demand; awarded commercial source data is protected from later correction.
- review hardening covers commercial-data authorization/redaction, exact quotation-line award integrity, quotation-only workspace access, date validation and concurrency-safe correction/award snapshots.
- no Purchase Order, Expected Delivery/schedule-risk, committed-cost ledger, Inventory or Finance behavior was pulled forward.
- next stage is V0.3-D Purchase Order pre-flight under PROC-009 through PROC-017, AC-V03-017 through AC-V03-022 and BR-V03-11 through BR-V03-14.

## V0.3-D active

- Issue #72 records the Stage D pre-flight and implementation contract.
- Branch: `v0.3-d-purchase-order` from green post-completion `main` checkpoint `357926f3af4b046b974c40dbd09efe68aa7419c2`.
- Entry CI: post-completion `main` CI #1155 passed.
- Stage D implements PROC-009 through PROC-017 under AC-V03-017 through AC-V03-022 and BR-V03-11 through BR-V03-14.
- Purchase Order numbering uses the approved `POYYMM-###` / MONTHLY Company sequence.
- POs belong to one Company, one Supplier and one Project and originate from awarded quotation lines in the default V0.3 flow.
- approved PO revisions preserve immutable earlier commercial values; the latest approved revision is current.
- Required-on-Site and Expected Delivery are retained as line-level procurement dates without mutating schedule-owned Activity dates.
- Stage D does not introduce Goods Receipt, Inventory posting, Finance, Actual Cost, the V0.7 Committed Cost ledger, tax/VAT, FX, or Stage E schedule-risk reporting.

## V0.3-D implementation progress

- canonical Purchase Order persistence is implemented with stable Company-scoped `POYYMM-###` identity and immutable revision numbers.
- initial POs are created only from unused line-level Supplier Awards; one PO belongs to one Company, one Project and one Supplier.
- every PO line retains direct PR → RFQ → Supplier Quotation → Supplier Award identifiers plus controlled material/UOM/commercial snapshots.
- Draft quantity, pricing, WBS, Cost Code, Required-on-Site, Expected Delivery and remarks are controlled through backend validation; amount is server-derived and PO quantity cannot exceed the selected Supplier Award quantity.
- PostgreSQL guards independently enforce Company/Project/Supplier scope, source-chain integrity, award-quantity limits, derived arithmetic, Draft-only mutation, revision-chain integrity and retained commercial history.
- configurable `PURCHASE_ORDER` Approval Matrix and maker-checker controls drive SUBMITTED → APPROVED / REJECTED lifecycle; cancellation retains actor/time/reason.
- approved commercial changes create a new linked Draft revision under the same PO number; earlier approved revisions remain immutable.
- retained REJECTED PO revisions can be copied into a corrective next Draft under the same PO identity; rejected history never overwrites the latest approved commitment.
- active PO dependencies prevent cancellation of their source Purchase Request demand, and final PO approval revalidates active approved source demand plus active Supplier status.
- PO action permissions require `procurement.po.view`, preventing action-only Roles with no scoped workspace discovery/read path.
- eight PO permissions are explicit business authorities and are not implicitly granted to technical `SYS_ADMIN`.
- responsive Purchase Order workspace supports Project discovery, unused-award selection, Draft creation/editing, WBS/Cost Code selection, workflow actions, cancellation and revision history.
- PostgreSQL integration coverage proves award-backed creation, duplicate-award prevention, Project scope, approval, immutable approved history, revisions, cancellation and audit evidence.
- live HTTP acceptance proves numbering, source traceability, allocation, maker-checker approval, immutable revisions, delivery dates and Project-scope denial.
- full functional branch CI #1177 passed on `c696e8fe66fb5c29f7c742974645dc9d6220edaf`, including migrations, typecheck, all regression/integration tests, production builds and live HTTP acceptance.
- API, ERD and permission documentation is aligned to the Stage D implementation.
- Goods Receipt / Inventory, Finance, Actual Cost, V0.7 Committed Cost ledger, tax/VAT, FX and Stage E schedule-risk classification remain excluded.

## V0.3-E active

- Issue #76 records the Stage E implementation contract and V0.3 release-exit checklist.
- branch `v0.3-e-schedule-risk` starts from completed Stage D main checkpoint `df4a2b71a3f003941abff1a0e6d5825c172c95db`.
- Stage E implements PROC-018 / PROC-019, RPT-005, SYS-007 and DOC-007 under AC-V03-023 through AC-V03-027 plus cross-cutting AC-V03-028 through AC-V03-032.
- risk classification is backend-derived exactly as approved by BR-V03-13; no Scheduling-owned Activity date is mutated.
- procurement reporting is Project-scoped, source-derived and intentionally excludes commercial pricing from the operational-reporting permission boundary.
- DOC-007 reuses the existing secure Documents abstraction with validated Procurement transaction targets and no second file store.
- current implementation includes the procurement read model/API, responsive filterable report, forward/backward references, procurement document targets, integration coverage and live HTTP acceptance additions.

## V0.3-E completed

- Issue #76 — V0.3-E Schedule Risk / Procurement Reporting / Traceability is technically complete.
- PR #77 — V0.3-E: Schedule Risk / Procurement Reporting squash-merged to `main` as `e0263cd55706179059d4e970ef80fd4ce5c7e1f4`.
- exact-head branch CI #1264 and PR CI #1265 passed on `4603a584d97890841708ab7188b6572977a1151f`.
- post-merge `main` CI #1266 passed on `e0263cd55706179059d4e970ef80fd4ce5c7e1f4`.
- PROC-018 / PROC-019, RPT-005, SYS-007 and DOC-007 are delivered under the approved V0.3 acceptance/business-rule baseline.
- procurement schedule/risk remains source-derived and read-only; Required-on-Site versus Expected Delivery yields `AT_RISK`, `ON_TIME` or `UNAVAILABLE` without mutating Scheduling-owned dates.
- operational procurement reporting preserves Project scope, stable PR → RFQ → quotation → award → PO traceability and commercial-data redaction.
- procurement document targets reuse the existing Project-owned secure Documents architecture with database target validation; no second file store or duplicate risk ledger was introduced.
- all three Stage E Codex review findings were resolved before merge; automated regression, authorization and live HTTP acceptance are green.
- V0.3 is now at the human release-acceptance gate. Repository governance requires Product / Business Owner UAT/business acceptance to be explicit; development/CI has not self-approved that human gate.

## V0.3-D completed

- Issue #72 — V0.3-D Purchase Order is complete.
- PR #74 — V0.3-D: Purchase Order squash-merged to `main` as `600143b1e463a6536c5f588a6c30def373fa6a6e`.
- exact-head branch CI #1210 and PR CI #1211 passed on `ec83b8d3c60c4945dbb8bb268baa9d58b0e7fd50`.
- post-merge `main` CI #1212 passed on `600143b1e463a6536c5f588a6c30def373fa6a6e`.
- PROC-009 through PROC-017 are delivered under AC-V03-017 through AC-V03-022 and BR-V03-11 through BR-V03-14.
- Purchase Order identity uses immutable Company-scoped `POYYMM-###` numbering with retained revision history.
- PO lines preserve PR → RFQ → Supplier Quotation → Supplier Award → PO traceability, Supplier/Project scope, WBS/Cost Code context, Required-on-Site and Expected Delivery dates.
- approval uses the configured `PURCHASE_ORDER` Approval Matrix with maker-checker, rejection history, corrective retry revisions and cancellation actor/time/reason evidence.
- review hardening covers inactive Supplier validation, active source-demand protection, award quantity ceilings, database serialization, rejected-revision recovery, PO permission dependency and explicit approval-action history.
- responsive Purchase Order workspace plus integration and live HTTP acceptance are green.
- no Goods Receipt/Inventory posting, Supplier Invoice/Finance, Actual Cost, V0.7 Committed Cost ledger, tax/VAT, FX or Stage-E schedule-risk classification was pulled forward.
- next stage is V0.3-E Schedule Risk pre-flight under PROC-018 / PROC-019, AC-V03-023 through AC-V03-027, RPT-005 and SYS-007.


## V0.3 Procurement accepted and closed

- Product / Business Owner explicitly accepted V0.3 Procurement on 2026-09-27.
- accepted checkpoint: `35808f301a7ddcb1945bd249b8c8097baec6d2d6`.
- V0.3-A through V0.3-E are complete; PR #77 and completion PR #78 are merged.
- exact-head branch CI #1264 and PR CI #1265 passed on `4603a584d97890841708ab7188b6572977a1151f`; post-merge main CI #1266 passed.
- automated business walkthrough scenario `MUJXJSHF` passed all 34 checks, including Original/Revised Budget behavior, PR → RFQ → quotations → award → PO traceability, PO revision/delivery-risk/document evidence and unauthorized Project-user denial.
- Product / Business Owner confirmed there are no blocking V0.3 business defects.
- Issue #79 and `docs/V0.3-UAT.md` / `docs/V0.3-RELEASE-CHECKLIST.md` preserve the formal exit evidence.
- repository position advances to the V0.4 Inventory Release Entry Gate.
- V0.4 implementation remains prohibited until the entry-gate baselines and required business rules are explicitly approved.

## V0.4 Inventory release entry gate — proposed

- Issue #81 is the active governance work item; branch `v0.4-entry-gate` starts from accepted V0.3 checkpoint `b3425914ddf43499b27bf876a55496899659b306`.
- proposed scope covers INV-001 through INV-012, DOC-008 and RPT-006.
- proposed build order is Warehouse → Goods Receipt → immutable Stock Transaction Ledger → derived Balance / Project-Site Stock → Reservation / Issue / Return → Transfer / Documents / Reporting / UAT.
- proposed rules allow partial and multiple receipts, set over-receipt tolerance to zero, prohibit negative stock and require atomic idempotent posting with maker-checker.
- proposed implementation estimate is 15–23 engineering days after entry-gate approval, plus 1–2 business days for human UAT.
- no new runtime dependency is proposed; DEC-008 open-source / zero-cost-first remains active.
- Product / Business Owner approved `docs/V0.4-SCOPE.md`, `docs/V0.4-ACCEPTANCE-CRITERIA.md`, `docs/V0.4-BUSINESS-RULES.md` and the database/API/test/build-stage/deferral baselines on 2026-09-27.
- V0.4-A pre-flight is authorized after approved PR #82 passes exact-head validation and merges; implementation remains bound by the approved baselines and Change Control.

## V0.4-A Warehouse / Inventory Foundation pre-flight complete

- Issue #83 is active; branch `v0.4-a-warehouse-foundation` starts from green approved-entry checkpoint `464c7acf9d23c3b176223ee38adb173045074708`.
- approved authority: INV-003 with foundation support for INV-006 / INV-007; AC-V04-001 through AC-V04-004; BR-V04-01 through BR-V04-03, BR-V04-10 and BR-V04-17.
- governance, Decision Log, dependency/license, architecture, Company/Project scope, permissions, audit, security and test impacts were reconciled.
- no new runtime dependency or mandatory paid component is required.
- no blocking business or architecture decision remains.
- `docs/V0.4-A-PREFLIGHT.md` is the source-controlled Stage A implementation contract.
- Stage A technical implementation may proceed within the approved baseline; scope expansion requires Change Control.

## V0.4-A implementation under validation

- Warehouse persistence, Company/Project database integrity, site flag and active/archive lifecycle added with source-controlled migrations.
- Warehouse permissions and SYS_ADMIN technical provisioning added, including fresh bootstrap consistency; no stock-posting or business approval authority granted.
- Project-scoped Warehouse APIs, audit logging, responsive permission-aware register, unit/integration coverage and live HTTP acceptance scenario added.
- Inventory document numbering rules remain in the approved V0.4 baseline for later stages; no Inventory document or stock ledger is created in Stage A.
- Stage A code head `94516ba1d5baf9cb7cc75199c708ca26dc2eb6a6`: branch CI #1331 and PR CI #1332 passed, including clean migrations, API/web validation, PostgreSQL Warehouse tests, prior-release regression and live HTTP acceptance.
- Codex review finding on test-suite wiring fixed and thread resolved. Final documentation-head CI, merge and post-merge `main` CI remain pending; Stage B remains blocked until those gates pass.

## V0.4-A completed / V0.4-B started

- PR #84 merged to `main` as `4ab736203c9870f4b6782ad85c108f3b0b66accd`; Issue #83 closed.
- Stage A exact-head branch CI #1335 and PR CI #1336 passed, including Warehouse PostgreSQL and live HTTP acceptance. Post-merge main CI #1337 passed.
- Stage B issue #85 and branch `v0.4-b-goods-receipt-ledger` start from that green merge checkpoint.
- Stage B pre-flight contract is `docs/V0.4-B-PREFLIGHT.md`; implementation, CI/review and merge gates remain pending. Human V0.4 release UAT remains unapproved.

## V0.4-B implementation under validation

- Goods Receipt, item and append-only signed Stock Transaction source-controlled models/migrations; same-Company/Project/PO material integrity, immutable history, effect uniqueness and Warehouse/PO received-stock guards.
- Explicit receipt view/create/edit/submit/approve/reverse permissions; technical SYS_ADMIN does not inherit business posting authority.
- Approval Matrix maker-checker final action posts the complete receipt atomically in a serializable transaction; full reversal appends opposite rows with retained reason.
- Server-side Project-scoped APIs and UI for eligible PO material lines, general/Project Warehouse selection, multi-line Draft creation/edit, submit, approve/post, reject, reversal and retained history.
- PO cancellation and revision edit/delete/final-approval guard against outstanding received quantity; deterministic source locking and idempotent retry controls.
- PostgreSQL integration and live HTTP acceptance cover partial/multiple receipt, over-receipt, concurrency, Project denial, PO revision/cancellation, ledger immutability and full reversal.
- Branch CI #1382 passed on implementation head `f76cc4587dd21544a4abcbdb820c178194ba9d7d`. Documentation-head CI, PR review/merge and post-merge main CI remain pending. V0.4-C has not begun.


## V0.4-B completed / V0.4-C implementation under validation

- PR #86 merged to `main` as `1f39a0d9e9c8d0d9dc32112e6eec4ec36321ac4d`; Issue #85 closed. Stage B branch CI #1388, PR CI #1389 and post-merge main CI #1390 passed.
- Stage C Issue #87 and branch `v0.4-c-stock-balance-views` started only from that green checkpoint. Pre-flight commit `4cd363e2b69d8ba5f5251e1881632648530ea159` passed CI #1392.
- Stage C adds explicit `inventory.stock.view`, secured read-only Project choices and ledger-derived balances grouped by Warehouse, Material, Project attribution and UOM, with exact decimal strings, archived/zero filters and no editable balance store.
- The Inventory workspace has a permission-gated Stock Balance tab. PostgreSQL and live HTTP evidence cover posted quantity, Project/Site dimensions, unauthorized Project denial and exact reversal-to-zero.
- Implementation/test head `385388c395d570c6141dc6c1e31dbd65690c5ca1` passed CI #1403. PR #88 records the exact-head branch/PR CI evidence and review resolution required before merge; post-merge main CI remains pending. V0.4-D has not begun; human V0.4 release UAT remains a separate exit gate.


## V0.4-C completed / V0.4-D pre-flight

- PR #88 merged to `main` as `096ee639f7e0597dd6c4068d9d1d0c323f66f15d`; Issue #87 closed. Final branch CI #1417, PR CI #1418 and post-merge main CI #1419 passed, including live HTTP acceptance.
- The Stage C P2 stale-response review finding was fixed, exact-head validated and resolved before merge.
- Stage D Issue #89 and branch `v0.4-d-reservation-issue-return` start only from that green checkpoint.
- `docs/V0.4-D-PREFLIGHT.md` binds Stage D to approved INV-008/009/010, AC-V04-016–021 and supporting security/ledger criteria, and BR-V04-07–15 with existing Company/Project governance.
- Stock Transfer, Inventory Documents, full Inventory reporting and human V0.4 release UAT remain deferred. V0.4-D implementation may begin only after the pre-flight exact-head CI passes; V0.4-E has not begun.


## V0.4-D implementation under validation

- Issue #89 remains active on branch `v0.4-d-reservation-issue-return`; Stage C green merge `096ee639f7e0597dd6c4068d9d1d0c323f66f15d` remains the branch base.
- Stage D adds Material Reservation, Material Issue and Material Return models/services/API/UI under the approved INV-008/009/010 scope. The existing signed `stock_transactions` table remains the one immutable physical movement ledger.
- Reservation activation derives availability from on-hand minus Active Reservations with deterministic stock-dimension locking; it creates no stock ledger row. Release/cancel retain history.
- Material Issue final approval uses the configured Approval Matrix, maker-checker, idempotent post keys, negative-stock/other-reservation protection, optional exact linked-Reservation fulfillment, WBS/Cost Code/Activity attribution and one negative ledger row per line.
- Material Return final approval references a posted Issue line, enforces cumulative non-reversed quantity ceilings and appends positive ledger effects. Reversal ordering requires Return reversal before source Issue reversal, and both append exact opposite movements.
- Explicit reservation/issue/return permissions are not granted implicitly to technical `SYS_ADMIN`. Company/Project scope remains backend-enforced.
- PostgreSQL integration plus live HTTP acceptance cover concurrency, availability, maker-checker, ledger effects, return ceilings, reversal ordering, Project denial and exact balance restoration. Hardened implementation/test head `18e44cc07adcc7cadc9fc057f8d1c77ea0c35e97` passed branch CI #1456. Two Codex P1 stock-reversal findings were fixed and resolved: Return reversal aggregates same-dimension quantity before availability validation, and Goods Receipt reversal now uses the shared stock lock plus derived-availability guard against downstream Issue/Active-Reservation consumption. Additional hardening enforces Return allocation lineage, shared Return/Issue-reversal source locking and posted Issue/Return identity immutability.
- Final documentation-head exact branch CI, exact-head PR CI, squash merge, Issue #89 closure and post-merge main CI remain pending. V0.4-E Stock Transfer / Inventory Documents / reporting has not begun. Human V0.4 business UAT remains a separate Release Exit Gate.

## V0.4-D completed / V0.4-E under validation

- PR #91 squash-merged to `main` as `941e2e9c2966bac66ea1d01b34cb39fb5ce75bdd`; Issue #89 closed; post-merge main CI #1492 passed.
- Issue #92 and `docs/V0.4-E-PREFLIGHT.md` authorize the approved Stage E scope. The pre-flight found no new business-policy or architecture decision needed.
- Branch `v0.4-e-transfer-docs-reporting` and draft PR #93 include Stock Transfer schema/API/UI, authorized Inventory document targets, ledger-derived balance/movement reports, and Stage E integration/live HTTP acceptance work.
- Stage E code + release-evidence checkpoint `fc4855bf019c41c32e7482b0a20b11b961e26f35` passed branch CI #1532 and PR CI #1533, including migration-from-zero, dependency audit, API/web validation, PostgreSQL regression and live HTTP acceptance (scenario `MUL9VGJX`, 40 checks). Final documentation-head CI, review resolution, merge and post-merge main CI remain pending. `docs/V0.4-UAT.md` and `docs/V0.4-RELEASE-CHECKLIST.md` keep the human Release Exit Gate explicitly pending.
- V0.5 must not begin before V0.4 technical completion and explicit Product / Business Owner acceptance under AC-V04-031.

## V0.4 technical completion / human release exit pending (prior checkpoint)

- PR #93 squash-merged to `main` as `6a04d95410589b5e9cb8c7a55d19aa095b9ee67c`; Issue #92 closed; post-merge `main` CI #1543 passed. V0.4-A through V0.4-E are technically implemented.
- The V0.4 live HTTP Inventory scenario `MUL9VGJX` passed all 40 checks in the Stage E CI evidence.
- Follow-up branch `v0.4-e-completion-evidence` added two PostgreSQL regressions: opposite-direction concurrent Transfers make progress without a Warehouse-lock deadlock; Transfer reversal is denied when destination stock has been consumed. CI #1546/#1547 passed, with #1547 at `8f352c351cdef2b719ef77922f603b4745682427`. Completion-evidence PR #94 merged as `26b4e6ceba114f57f225a96fd6e8de4fe0b489fe` after exact-head branch CI #1550 and PR CI #1551 passed at `bbfa8865d8d2a45713b88e4e3d073e73a7a291b5`; post-merge main CI #1552 passed.
- `docs/V0.4-UAT.md` and `docs/V0.4-RELEASE-CHECKLIST.md` record technical evidence and the remaining Product / Business Owner walkthrough. No human UAT or business acceptance has been recorded. AC-V04-031 and the V0.4 Release Exit Gate remain open; V0.5 cannot start.

## V0.4 Inventory Product / Business Owner accepted — V0.5 entry gate next (prior checkpoint)

- The Product / Business Owner explicitly accepted the V0.4 UAT walkthrough and instructed the next gated step on 2026-09-29 (Singapore time). Exact wording is preserved in `docs/V0.4-UAT.md` and Issue #96. No blocking business defect or workaround was reported with the acceptance; no issue or PR was open at the accepted checkpoint.
- Accepted technical `main` checkpoint: `1511939701cb6c8c0c855cbd378125db6f12b461`. Post-merge CI #1558 passed, including the live HTTP current-release acceptance (40 checks). V0.4-A through V0.4-E are technically complete; AC-V04-031 is satisfied by the explicit owner decision.
- Acceptance-record Issue #96 and its documentation PR must complete exact-head CI/review, merge and post-merge `main` CI before the release record is closed.
- The next position is the V0.5 Subcontracts Release Entry Gate. V0.5 scope, acceptance criteria, required business rules, database/API/test approach and license/cost review need their own approval before implementation. Retention release, tax/FX, accounting and cost recognition are not authorized by V0.4 acceptance. Committed Cost, Actual Cost and Paid Cost remain separate.

## V0.4 release exit complete / V0.5 entry gate draft

- V0.4 Product / Business Owner acceptance Issue #96 closed through PR #97, squash-merged to `main` as `c846068c59cf20ab74f3b802cf4eacbd262aaba9`. Exact-head branch CI #1563 and PR CI #1564 passed; post-merge main CI #1565 passed at the merge. V0.4 Inventory is formally closed.
- V0.5 Subcontracts Release Entry Gate Issue #98 is open. `docs/V0.5-ENTRY-GATE-DRAFT.md` is explicitly DRAFT/NOT APPROVED and maps SUB-001–010 and RPT-007 to proposed acceptance areas, technical boundaries and unresolved business decisions.
- No V0.5 schema, API, UI or implementation stage has begun. Product / Business Owner approval of the entry-gate baselines and blocking business rules remains required. DEC-008 and separation of Committed, Actual and Paid Cost remain active.

## V0.5 entry-gate baseline proposal and owner approval

- PR #100 merged the proposed V0.5 scope, AC and business-rule documents as `818f48c373416dbae27f59b6b76af6a363f10649`. Exact-head PR CI #1588 and post-merge `main` CI #1589 passed; both automated review findings were addressed. This merge did not approve the proposals or close Issue #98.
- Proposed `docs/V0.5-SCOPE.md`, `docs/V0.5-ACCEPTANCE-CRITERIA.md` (AC-V05-001–030) and `docs/V0.5-BUSINESS-RULES.md` (BR-V05-01–20) provide a concrete owner-review package for Issue #98. They are not approved and authorize no implementation.
- The proposal preserves the Subcontracts-owned Company register and Project-scoped downstream records, distinct claim/assessment/certification values, no WO double counting and separate Committed/Actual/Paid Cost. Tax/FX, Finance, retention release and DOC-009 remain deferred.
- Product / Business Owner instruction on 2026-09-29 completed review and approved the proposed V0.5 Scope, AC-V05-001–030, BR-V05-01–20 / D05-01–11, data/API/test baselines, stages, estimates and deferrals without amendments. DEC-014 records this decision. Approval-record CI/review/merge and post-merge `main` CI, then Issue #98 closure, remain before V0.5-A pre-flight.

## V0.5-A implementation under validation

- Issue #103 and PR #104 started from green entry-gate merge `5b67832079ef6ded86bc79f997d8115835d0c55e` only after Issue #98 closed.
- Stage A adds a Company-owned Subcontractor register with optional same-Company Supplier link and archive/reactivate lifecycle, plus Project-scoped agreement Drafts with required Scope of Work, original tax-exclusive DECIMAL(18,2) value, one currency, configured operational status and immutable `SCYYMM-###` identity.
- Six explicit permissions, CSRF, backend Company/Project access, composite database references, hard-delete/identity guards, audit, stable creation keys and fresh-bootstrap technical provisioning are implemented. No business approval permission or later-stage transaction is introduced.
- The responsive Subcontracts workspace supports register search/edit/lifecycle and accessible-Project agreement Draft creation/editing. PostgreSQL integration and live HTTP acceptance cover Company/Project authorization, Supplier linkage, numbering/retry, archive guards and retained history.
- Code/test head `83e73f47f10953deed06479ad8b9cae0a9ed139e` passed CI #1653. Documentation-head CI, review, merge, post-merge main CI and Issue #103 closure remain pending. V0.5-B has not begun.


## V0.5-A completed / V0.5-B pre-flight

- PR #104 squash-merged to `main` as `af1a3f4953af524110dc4305a061099f4fa80388`; Issue #103 closed. Final Stage A head `a0cb667c658ff1f9ca1de0328a0210b196b92afe` passed push CI #1696 and PR CI #1697, exact-head Codex review found no major issues, and post-merge main CI #1698 passed.
- Stage A delivers the Company-owned Subcontractor register and Project-scoped agreement Draft foundation with composite database integrity, initiating-user-scoped replay keys, explicit permission dependencies, read-only historical detail and retained inactive reference identity.
- Issue #105 and branch `v0.5-b-agreement-work-orders` start only from the green Stage A merge checkpoint. `docs/V0.5-B-PREFLIGHT.md` binds implementation to agreement approval/administrative revision history and Work Orders under the approved V0.5 baseline.
- Claims/assessments, certification/retention withholding, Variations/reporting and human V0.5 release UAT remain later gates. SUB-011/DOC-009, retention release, Finance/payment, tax/FX, accounting and cost recognition remain excluded; Committed, Actual and Paid Cost remain separate.


## V0.5-B Agreements / Work Orders implementation under validation

- Issue #105 remains open on branch `v0.5-b-agreement-work-orders`, which started from the green V0.5-A merge `af1a3f4953af524110dc4305a061099f4fa80388`. Stage B pre-flight commit `2da316612bba1fbaee449e72a068a6781c56bee7` passed CI #1700 before implementation began.
- Stage B now includes retained agreement versions, configured agreement approval/rejection, maker-checker enforcement, administrative operational-status revisions, guarded agreement cancellation, agreement-local `WO-###` Work Orders, WBS/Cost Code dimensions, allocation-ceiling concurrency protection, durable actor/action replay evidence, explicit permission dependencies, Project access enforcement and retained audit/approval history.
- The original Stage B migration remains immutable after its first branch execution; durable retry evidence is carried by a later forward-only migration. No schema-history rewrite or force-push is used.
- API/web integration includes permission-gated lifecycle actions, read-only decided commercial fields, retained approval history, Work Order Draft editing and workflow actions. `deploy/uat/runtime-acceptance.mjs` includes Stage B configured-workflow, maker-checker, allocation-ceiling, administrative-revision, cancellation-guard and unauthorized-Project checks.
- The first implementation CI (#1701) reached the test suite and exposed one stale V0.5-A assertion that counted all `subcontracts.*` permissions. The regression was corrected to verify the six Stage A permission codes explicitly so additive Stage B permissions do not create a false failure.
- Validation hardening through implementation/test head `887621f1755260ba095c20f97483934c45c5f68d` includes configured two-step Agreement approval, final-approval replay/change-payload coverage, concurrent agreement-local Work Order numbering, concurrent administrative revision creation, cancellation-versus-Work-Order submission/final-approval coverage, retained decision-evidence checks and explicit controller permission-metadata regression.
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
