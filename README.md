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

Completed releases: **V0.1 Foundation, V0.2 Project & Scheduling, V0.3 Procurement, V0.4 Inventory, V0.5 Subcontracts, V0.6 Finance and V0.7 Cost Control**. V0.5, V0.6 and V0.7 are accepted.

Current position: **V0.8 Management TECHNICALLY COMPLETE / OWNER ACCEPTED / RELEASE CLOSURE ACTIVE**. V0.8-A through V0.8-E are technically COMPLETE. PR #183 final head `0a0615e604f2adf57eae2ac6193c80108af85232` passed push CI #3353 / PR CI #3354 and clean final DEC-022 review, squash-merged as `076b98e3c95cbbec54963785548c84fb95838c06`, and post-merge exact-main CI #3355 passed including authenticated live acceptance. The Chat-assisted proxy UAT remains PASS with no blocking business defect identified. On 2026-10-05 the Product / Business Owner accepted that evidence as the AC-V08-039 human UAT confirmation and explicitly accepted V0.8 under AC-V08-040. Issue #184 / PR #185 now track the documentation/governance-only release-closure record; V1.0 Production remains AFTER V0.8 until that closure completes.
