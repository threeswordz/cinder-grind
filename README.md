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

Current position: **V0.8 Management COMPLETE + ACCEPTED; V1.0 Production Readiness COMPLETE + ACCEPTED; V1.1 Business Workflow & Role UI ENTRY PACKAGE APPROVED (DEC-028) / TECHNICAL CLOSURE ACTIVE.** V1.0-A through V1.0-E technical acceptance AC-V10-001–038 is complete. AC-V10-039 and AC-V10-040 were explicitly accepted by the Product / Business Owner on 2026-10-13, with V1.0 release closure / Production go-no-go authorized. Acceptance-record PR #209 squash-merged as `8f5d4f56b38a373ef6d7233b46bcdb218345bf62`; exact-main CI #4233 PASS; Issue #205 CLOSED / COMPLETED. This status does not claim that a Production deployment has already occurred. **V1.1 entry:** The Product Owner explicitly approved the bounded role-first UI/previously approved workflow integration entry package on 2026-10-17 (DEC-028); canonical baselines are in `docs/V1.1-SCOPE.md`, `docs/V1.1-ACCEPTANCE-CRITERIA.md`, `docs/V1.1-BUSINESS-RULES.md` and `docs/V1.1-DATA-API-SECURITY-TEST-BASELINE.md`. Entry PR #212 squash-merged as `cd5b0c77e576ba140210d284ea1cbad4149bb0fd` after exact-head CI #4319/#4320 PASS and both Codex P2s were resolved; post-merge exact-main CI #4321 PASS. Issue #211 is the entry closure tracker; V1.1-B may begin only after final documentation handoff/Issue closure, with a distinct stage Issue and stage CI gates. Diagnostics implementation and new transaction/business rules remain deferred.
