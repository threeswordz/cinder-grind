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
- Latest verified Stage E branch commit before this state update: `1c18e154249fc51b7d3dde2473d58fd3780a503f`
- Latest Stage E PR CI: Validate Construction ERP run #323 — SUCCESS
- Current blocker / business decision: Project creation scope policy A/B/C remains unresolved. Do not finalize project-scoped creation behavior until the Product / Business Owner selects a policy.
- Next action: Continue Stage E work that is independent of the creation-policy decision, then implement the selected creation policy, complete UI/security/regression validation, and keep PR #22 draft until all completion gates pass.

## Stage E implemented so far

- Project, Project Member and Project Contact database models and source-controlled migrations
- Customer and configurable Project Status relationships
- Contract value, location/description and planned dates
- Project permission catalogue and existing SYS_ADMIN permission migration
- Database-derived project-scope access foundation
- Project APIs/services for scoped reads, updates, archive/reactivate, team and contacts
- PostgreSQL Project integration tests wired into the API test command

This file is a concise checkpoint only. Re-check live GitHub Issues, branches, PRs, commits and CI before modifying a stage.
