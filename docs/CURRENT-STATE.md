# Construction ERP — Current State

**Last verified:** 2026-09-26
**Source of truth:** Live GitHub repository state

- Current Release: V0.1 Foundation
- Current Stage: V0.1-G Basic Documents — NEXT
- Completed Stages: V0.1-A Technical Skeleton; V0.1-B Company / Identity / Security; V0.1-C Administration; V0.1-D Master Data; V0.1-E Projects; V0.1-F WBS & Cost Codes
- Completed Issue: #23 — V0.1-F WBS & Cost Codes
- Merged PR: #24 — V0.1-F WBS & Cost Codes
- Previous completed Issue: #20 — V0.1-E Projects
- Previous merged PR: #22 — V0.1-E Projects
- Latest verified main commit: `7bce190c412cd71222816428f04420be2a9278c9` — V0.1-F: WBS & Cost Codes (#24)
- Final Stage E PR CI: Validate Construction ERP run #351 — SUCCESS
- Project creation scope decision: Option A — APPROVED. A scoped creator must have an active Employee link and is atomically added to the initial Project Team.
- Final Stage F PR CI: Validate Construction ERP run #403 — SUCCESS on `ce649c16b139f2ebb81d0fa71fce7420fbde4b79`.
- Stage F final review: no unresolved review threads, no scope creep into Activities/Scheduling, BOQ/Budget, Procurement or transaction allocations.
- Next action: Open and implement V0.1-G Basic Documents from approved DOC-001 through DOC-005 and the V0.1 document acceptance criteria.

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
