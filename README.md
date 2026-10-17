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

Current position: **V0.1–V0.8 and V1.0 COMPLETE + ACCEPTED; V1.1-A/V1.1-B technically COMPLETE; V1.1-C preflight, C1 Procurement→Finance and C2 Subcontract→Finance CLOSED; C3 Project→Cost/Management ACTIVE.** DEC-028 remains the bounded release authority. C2 closure PR #222 exact head `f16f4af421fb562adcf52428747361b931ec6d2f` passed push CI #4489 / PR CI #4490 and clean DEC-022 review, squash-merged as `d783bf1e63a1342053a52bc14a53bb6d1b40b762`; exact-main CI #4491 passed. Issue #217 remains OPEN through C3. Branch `v1.1-c3-project-cost-management-links` is the single active implementation writer for source-only Project → WBS/Activity → BOQ original/revisions → Site Execution → Cost Control/Management navigation. Human AC-V11-029/030, V1.1-D/E, release acceptance and Production deployment are not claimed. No diagnostic API, new business transition, schema/migration, budget rewrite or mandatory paid dependency.
