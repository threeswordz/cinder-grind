# Construction ERP

A full Construction ERP system covering:

- Project Management
- WBS & Cost Codes
- Planning & Scheduling
- BOQ & Budgeting
- Site Execution
- Procurement
- Inventory
- Equipment
- Subcontracts
- Finance
- Cost Control
- Documents
- Reporting
- Management Dashboards

## Technology Stack

Runtime / Toolchain:
- Node.js
- TypeScript
- pnpm

Frontend:
- React
- Vite
- MUI Core
- TanStack Query
- React Hook Form
- Zod

Scheduling:
- Frappe Gantt

Backend:
- NestJS
- REST API

Database:
- PostgreSQL
- Prisma ORM

Background Processing:
- pg-boss — only when required

File Storage:
- Local filesystem during prototype
- Storage abstraction allows later replacement

Containerization:
- Podman

Source Control / Planning:
- Git
- GitHub Repository
- GitHub Projects

## Open-Source First

The prototype must remain fully functional without requiring paid runtime software licenses or mandatory paid cloud services.

Significant dependencies are reviewed in:

`docs/DEPENDENCY-LICENSE-REGISTER.md`

## Project Status

**Phase 0 — ERP Definition: COMPLETE**

Approved baselines:

1. ERP Master Blueprint v0.1
2. Requirements Baseline v0.1
3. Database Baseline v0.1
4. Roles & Permissions Baseline v0.1
5. API Architecture Baseline v0.1
6. Testing & UAT Baseline v0.1
7. Development Roadmap Baseline v0.1
8. V0.1 Scope Baseline v0.1
9. V0.1 Acceptance Criteria Baseline v0.1
10. Dependency License Baseline v0.1

**V0.1 Foundation is complete and accepted.**

Current development status is maintained in `docs/CURRENT-STATE.md`.

Development/session responsibilities are defined in `docs/DEVELOPMENT-OPERATING-MODEL.md`: Chat is the default Builder / Release Coordinator, GitHub is the source of truth, CI/tests provide technical evidence, the Product / Business Owner owns approval/UAT gates, and Work is the periodic independent auditor.

Completed releases: **V0.1 Foundation, V0.2 Project & Scheduling, V0.3 Procurement, V0.4 Inventory, V0.5 Subcontracts, V0.6 Finance, V0.7 Cost Control and V0.8 Management**. V0.5, V0.6, V0.7 and V0.8 are accepted.

Current position: **V0.1–V0.8 and V1.0 COMPLETE + ACCEPTED; V1.1-A/V1.1-B technically COMPLETE; V1.1-C preflight and C1 Procurement→Finance CLOSED; C2 Subcontract→Finance runtime technically COMPLETE with closure reconciliation ACTIVE.** DEC-028 remains the bounded release authority. C2 final exact head `673d7030f356ede71d279bc007a2885308bef7e7` passed push CI #4485 and PR CI #4486; DEC-022 exact-head review completed with no findings and zero unresolved threads. PR #221 squash-merged as `e08d69870ed51ad933980eab84c40e54a1a31e2c`; post-merge exact-main CI #4487 passed. Issue #217 remains OPEN through C3. Branch `v1.1-c2-closure-reconcile` is documentation-only; C3 is not started until this closure reconciliation merges and exact-main CI is green. Human AC-V11-029/030, V1.1 release acceptance and Production deployment are not claimed. No diagnostic API, new business transition, schema/migration, Finance semantics or mandatory paid dependency.
