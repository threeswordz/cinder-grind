# Construction ERP — Current State

**Last verified:** 2026-09-28
**Source of truth:** Live GitHub repository state

- Current Release: V0.4 Inventory
- Current Stage: V0.4-C Derived Stock Balance / Project-Site Stock Views — IMPLEMENTATION / VALIDATION
- Completed Stages: V0.1-A through V0.1-H; V0.2-A through V0.2-G; V0.3-A BOQ & Budget; V0.3-B Purchase Request; V0.3-C RFQ / Quotations; V0.3-D Purchase Order; V0.3-E Schedule Risk / Procurement Reporting / Traceability
- Active Issue: #87 — V0.4-C Derived Stock Balance / Project-Site Stock Views
- Completed Issue: #85 — V0.4-B Goods Receipt / PO Receipt Controls / Stock Transaction Ledger
- Completed Issue: #83 — V0.4-A Warehouse / Inventory Foundation
- Active Branch: `v0.4-c-stock-balance-views`
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
- Governance: `AGENTS.md`, `docs/PROJECT-GOVERNANCE.md`, PR governance checklist and DEC-008 are active; material decisions must pass the repository pre-flight and open-source/zero-cost-first constraint.
- Next action: complete V0.4-C PR #88 review and merge gates under Issue #87, then require post-merge main CI. V0.4-D must wait for the Stage C merge and post-merge main CI.

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
- Implementation/test head `385388c395d570c6141dc6c1e31dbd65690c5ca1` passed CI #1403. Final branch head `91ce2f3c749a4d5c70adcc2b5056f154d4416240` passed branch CI #1409 and PR CI #1410 in PR #88; review/merge and post-merge main CI remain pending. V0.4-D has not begun; human V0.4 release UAT remains a separate exit gate.
