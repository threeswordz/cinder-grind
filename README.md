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

Current position: **V0.8 Management COMPLETE + ACCEPTED**. **V1.0 Production / production-readiness is ACTIVE** under DEC-026. **V1.0-A Production Environment / Deployment Baseline, V1.0-B Backup / Restore / Recovery and V1.0-C Security Hardening are COMPLETE.** V1.0-D Operations / Observability / Performance Readiness is at FINAL DEC-022 DOCUMENTATION RECONCILIATION under Issue #200 / PR #203. Across six Codex review rounds, 12 genuine findings total (3 P1 / 9 P2) were identified. The 10 code/runtime/test findings are remediated on final material head `3a2a823bdaa72269fd3d43ade3e427accd957f7b`, which passed exact-head push CI #4053 and PR CI #4054 end-to-end, including full workspace regression, parser-failure correlation/logging coverage, real document-storage readiness probing plus rollback-safe cleanup, authenticated live acceptance, body-inclusive representative Project read/idempotent-update benchmark, and paired recovery/restore drill. The tenth and eleventh documentation/status P2s are remediated; the sixth review identified a twelfth P2 in the Production document read path, remediated on `3a2a823bdaa72269fd3d43ade3e427accd957f7b` so existing downloads do not depend on write-capacity readiness. Its resulting exact-head CI and one final DEC-022 exact-head review remain required before merge. No schema migration or new runtime dependency is introduced. V1.0-E Release Candidate / Deployment Rehearsal / Go-No-Go remains later, including AC-V10-039/040 Product / Business Owner acceptance/go-no-go.
