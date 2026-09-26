# Construction ERP — Current State

**Last verified:** 2026-09-26
**Source of truth:** Live GitHub repository state

- Current Release: V0.1 Foundation
- Current Stage: V0.1-E Projects — IN PROGRESS
- Completed Stages: V0.1-A Technical Skeleton; V0.1-B Company / Identity / Security; V0.1-C Administration; V0.1-D Master Data
- Active Issue: #20 — V0.1-E Projects
- Active Branch: `v0.1-e-projects`
- Active PR: #22 — draft
- Latest verified main commit: `1ebc5d6693308b03ef831e01003cf51a86fd3add` — V0.1-D: Master Data (#18)
- Latest verified Stage E branch commit before this state update: `6c1d8790e700b970f4a54224237aeb530455ed25`
- Latest Stage E PR CI: Validate Construction ERP run #349 — SUCCESS
- Project creation scope decision: Option A — APPROVED. A scoped creator must have an active Employee link and is atomically added to the initial Project Team.
- Next action: Final PR readiness/review and merge Stage E; do not start Stage F before Stage E is merged.

## Stage E implemented so far

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
