# Construction ERP — Repository Operating Rules

This file is the mandatory entry point for humans and AI agents working in this repository.

## 1. Read before changing the repository

Before any material architecture, infrastructure, dependency, scope, security, business-rule or release decision, read and reconcile:

1. `AGENTS.md`
2. `docs/PROJECT-GOVERNANCE.md`
3. `docs/DECISION-LOG.md`
4. `docs/DEVELOPMENT-OPERATING-MODEL.md`
5. `docs/REQUIREMENTS.md`
6. the active release scope and acceptance criteria
7. `docs/DEVELOPMENT-ROADMAP.md`
8. the active GitHub Issue
9. `docs/CURRENT-STATE.md`
10. the active PR, code and CI
11. `docs/LIVE-POSITION-REPORTING-STANDARD.md` when reporting project/live position

Live GitHub state is authoritative for implementation status. Approved governance/decision documents are authoritative for constraints and policy.

## 2. Non-negotiable project constraints

- Open-source-first.
- Prefer zero-cost infrastructure and software.
- Do not introduce a mandatory paid runtime, cloud service, hosted identity provider, database, storage service, commercial library or recurring subscription without explicit Product / Business Owner approval and a recorded decision.
- Reuse existing hardware/resources before proposing paid infrastructure when technically practical.
- Modular monolith unless an approved change decision says otherwise.
- PostgreSQL + Prisma remain the canonical relational database / ORM-migration foundation.
- Canonical hierarchy is Project → WBS → Activity.
- `Activity` is the canonical technical/API/database term; `Task` may be only a UI/business synonym.
- WBS and Cost Code are independent dimensions. Cost Code must not become a child of WBS.
- Project scope is database-derived through User → active Employee → active Project Member → Project, with `projects.access_all` only bypassing assignment filtering.
- System Administrator is a technical role and never gains business approval authority implicitly.
- Do not silently expand release scope.
- Do not invent missing business rules.
- Technical defects may be fixed autonomously within approved scope.
- Business-policy, scope, cost, architecture or governance changes require explicit Product / Business Owner approval and must be recorded before implementation.
- A casual request must not silently override an approved hard constraint. Surface the conflict and request explicit change approval.

## 3. Mandatory pre-flight

Before a material change, verify:

- current release/stage
- applicable Requirement IDs and acceptance criteria
- explicit out-of-scope items
- architecture compatibility
- dependency/license impact
- recurring/mandatory cost impact
- security/project-scope impact
- whether a new business rule is being introduced
- Decision Log conflicts
- whether the change is technical implementation or a business decision

If a technical implementation conflicts with approved rules, correct the implementation.
If the desired outcome requires changing an approved rule, stop and obtain explicit approval.

## 4. Release discipline

- Do not begin the next stage before the current stage's completion gates are satisfied.
- Human UAT/business acceptance must not be self-approved by development or automation.
- Every release/stage PR must complete the governance checklist in the pull-request template.
- Update documentation and CI evidence before merge.


## 5. Chat / Work operating discipline

- Chat is the default day-to-day Builder / Release Coordinator.
- GitHub is the source of truth for implementation status and durable project state.
- CI/tests are technical evidence; they do not self-approve human business/UAT gates.
- The Product / Business Owner remains the authority for explicit approval-gated decisions and human UAT/business acceptance.
- Work is audit-first and is primarily used for periodic repository-wide architecture, security, technical-debt, documentation and production-readiness reviews.
- Only one active writer should normally modify an active stage branch at a time.
- New implementation sessions must first re-read live GitHub state and applicable governance/decision/scope documents.
- Findings from Work normally become durable repository Issues or Change Control items, then return to Chat for implementation under the normal CI/PR/merge process.
- When the Product / Business Owner asks for `live position`, `current position`, `where are we`, or equivalent project-status wording, follow `docs/LIVE-POSITION-REPORTING-STANDARD.md` after re-fetching live GitHub state.
- See `docs/DEVELOPMENT-OPERATING-MODEL.md` and DEC-016.

## Codex review economy policy — DEC-022

- Chat + CI are the continuous development/review loop while a branch is changing.
- Do not request Codex after every commit or every individual fix.
- Request Codex when a PR/stage reaches a stable merge candidate with applicable CI green and known Chat findings resolved.
- Batch genuine Codex findings, fix them together where practical, rerun CI, then use a single batched final re-review when the fixes materially affect reviewed behavior or a high-risk surface.
- A clean Codex review is not invalidated by later documentation/evidence-only edits that do not change runtime behavior, schema, security boundaries or business rules.
- Authorization, permissions, Finance/payment/accounting, migrations, audit/history immutability, concurrency and data-integrity changes still require Codex at the stable merge candidate unless an explicit PR-specific Product / Business Owner waiver is recorded.
- Low-risk documentation-only changes normally use Chat + CI unless an approved gate explicitly requires Codex.
- Work remains the periodic broad auditor; required human UAT/business acceptance remains human.

See `docs/DEVELOPMENT-OPERATING-MODEL.md` and DEC-022.


## 6. Engineering-quality execution (PStack-inspired, no new platform)

These execution practices complement, but do **not** amend or supersede, Sections 1–5, `docs/PROJECT-GOVERNANCE.md`, approved decisions, release scope, or acceptance gates. PStack is an inspiration for engineering discipline, **not** an installed dependency, an additional implementing authority, a new business requirement, or permission to run autonomous merges.

- **Establish evidence before editing.** Identify the expected and observed behavior, governing requirement/acceptance criteria, active branch and CI baseline. Reproduce defects where practical; do not infer a root cause from a symptom.
- **Prefer the smallest coherent correction.** Fix the root cause. Remove needless code before adding abstractions or compatibility layers; avoid speculative scope, redundant validations and second sources of truth.
- **Model the actual domain and check the blast radius.** Before a material change, identify affected callers, Company/Project authorization boundaries, persisted states, API contracts, dependent modules, and Finance/Inventory/approval consequences where relevant. Keep invalid states and unauthorized paths impossible where practical.
- **Make a checkable change.** For a defect, add a failing regression test first when feasible. Test observable business outcomes and denial paths rather than internal implementation details. Exercise retries, duplicate requests, concurrency and idempotency when the affected workflow warrants it.
- **Prove results with the existing gates.** Split larger work into individually verifiable units; inspect the actual diff and run appropriate local/runtime checks plus required exact-head, PR and post-merge CI. A successful build, unit test or SSR rendering is not a substitute for real-browser evidence or Product Owner human UAT. Follow `docs/TESTING-UAT.md` for the authoritative testing and acceptance process.
- **Convert repeated mistakes into enforceable safeguards.** Prefer a targeted test, type constraint, lint/check or existing CI assertion over duplicating the same instruction across Markdown files. Keep detailed rules in their existing authoritative owner documents and reference them here rather than duplicating their requirements.

Parallel **read-only** analysis may assist the designated writer. No PStack-style subagent may independently write to the active stage branch, bypass required Codex reviews, self-approve human gates, introduce unapproved costs or scope, or deploy/merge outside existing governance. Codex remains governed by DEC-022. Read-only documentation audits remain permitted under `docs/DEVELOPMENT-OPERATING-MODEL.md` and do not add new owner approval gates.
