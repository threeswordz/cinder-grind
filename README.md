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

Current position: **V0.8 Management COMPLETE + ACCEPTED**. **V1.0 Production / production-readiness is ACTIVE** under DEC-026. **V1.0-A Production Environment / Deployment Baseline, V1.0-B Backup / Restore / Recovery and V1.0-C Security Hardening are COMPLETE.** V1.0-D Operations / Observability / Performance Readiness is technically COMPLETE for AC-V10-027–034. Final exact head `611132a6a488c06f710e9d7fbd067f51f9fa8a6c` passed push CI #4055 and PR CI #4056; the final DEC-022 exact-head re-review reported no major issues with zero unresolved review threads. PR #203 squash-merged as `853ccdb73f5a8cb7cc2ec16edf49eeb50005692f`; exact-main CI #4057 PASS, including full workspace regression, Production startup/restart and unsafe-config fail-closed checks, authenticated live acceptance, and paired recovery/isolated restore. Across six Codex review rounds, 12 genuine findings total (3 P1 / 9 P2) were remediated. No schema migration or new runtime dependency was introduced. Closure reconciliation PR #204 squash-merged as `00410468ce4ba52398ef7413c0282f84bf24dab4`; exact-main CI #4107 PASS; Issue #200 CLOSED / COMPLETED. V1.0-E Release Candidate / Deployment Rehearsal / Go-No-Go is IMPLEMENTATION ACTIVE under Issue #205 / PR #207. Last material implementation candidate `29e864f32998d854b2605b1e4f0fe134a5de2862` passed exact-head push CI #4157 and PR CI #4158; the current PR head contains only subsequent status reconciliation and still requires exact-head CI plus final DEC-022 review before merge. AC-V10-039/040 Product / Business Owner acceptance/go-no-go remain later release-exit gates.
