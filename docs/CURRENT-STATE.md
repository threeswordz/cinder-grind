# Construction ERP — Current State

**Last verified:** 2026-09-26
**Source of truth:** Live GitHub repository state

- Current Release: V0.2 Project & Scheduling
- Current Stage: V0.2-D Gantt / Lookahead — IMPLEMENTATION
- Completed Stages: V0.1-A Technical Skeleton; V0.1-B Company / Identity / Security; V0.1-C Administration; V0.1-D Master Data; V0.1-E Projects; V0.1-F WBS & Cost Codes; V0.1-G Basic Documents; V0.1-H Integration / Regression / UAT; V0.2-A Scheduling Data Model; V0.2-B Scheduling Engine; V0.2-C Baselines / Progress
- Active Issue: #45 — V0.2-D Gantt / Lookahead
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
- Next action: implement V0.2-D Gantt / Lookahead under DEC-011 using the Stage B/C backend read models; keep Frappe Gantt visualization-only.

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
