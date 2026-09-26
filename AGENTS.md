# Construction ERP — Repository Operating Rules

This file is the mandatory entry point for humans and AI agents working in this repository.

## 1. Read before changing the repository

Before any material architecture, infrastructure, dependency, scope, security, business-rule or release decision, read and reconcile:

1. `AGENTS.md`
2. `docs/PROJECT-GOVERNANCE.md`
3. `docs/DECISION-LOG.md`
4. `docs/REQUIREMENTS.md`
5. the active release scope and acceptance criteria
6. `docs/DEVELOPMENT-ROADMAP.md`
7. the active GitHub Issue
8. `docs/CURRENT-STATE.md`
9. the active PR, code and CI

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
