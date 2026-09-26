# Construction ERP — Current State

**Last verified:** 2026-09-26
**Source of truth:** Live GitHub repository state

- Current Release: V0.2 Project & Scheduling
- Current Stage: V0.2-B Scheduling Engine — ACTIVE
- Completed Stages: V0.1-A Technical Skeleton; V0.1-B Company / Identity / Security; V0.1-C Administration; V0.1-D Master Data; V0.1-E Projects; V0.1-F WBS & Cost Codes; V0.1-G Basic Documents; V0.1-H Integration / Regression / UAT; V0.2-A Scheduling Data Model
- Active Issue: #36 — V0.2-B Scheduling Engine
- Active Branch: `v0.2-b-scheduling-engine`
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
- Next action: implement V0.2-B Scheduling Engine under DEC-009, then validate deterministic working-calendar, dependency, CPM and Total Float behavior.

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
