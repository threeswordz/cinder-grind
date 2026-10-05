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

Current position: **V0.8 Management ACTIVE**. The V0.8 entry gate is complete under DEC-025; V0.8-A through V0.8-D are technically COMPLETE. **V0.8-E Cross-Module Reporting / Export / Hardening / Release Evidence is now IMPLEMENTATION ACTIVE.** PR #181 final head `35127fb0fedf027324588b3c0806aade808d7fa8` passed push CI #3109 / PR CI #3110 and clean DEC-022 review, merged as `00d3720205d1bdfeb5b3216ad2e91ad72c80f84e`, and exact-main CI #3111 PASS. Existing branch `v0.8-e-reporting-export` was forward-reconciled without force-push as merge commit `d90c4e1e19ce81d02b05ee363e117d2dd4a9deda`; implementation may proceed under Issue #179. Human AC-V08-039/040 UAT and explicit Product / Business Owner release acceptance remain later V0.8 release-exit gates.
