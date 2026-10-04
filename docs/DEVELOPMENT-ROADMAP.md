# Construction ERP — Development Roadmap

**Document Status:** Development Roadmap Baseline v0.1  
**Current Phase:** V0.8 Management — ACTIVE / V0.8-A through V0.8-C COMPLETE / V0.8-D PRE-FLIGHT ACTIVE
**Architecture Baseline:** v0.1  
**Requirements Baseline:** v0.1  
**Database Baseline:** v0.1  
**Roles & Permissions Baseline:** v0.1  
**API Architecture Baseline:** v0.1  
**Testing & UAT Baseline:** v0.1

---

# 1. Purpose

This document converts the approved ERP architecture and release roadmap into an executable development sequence.

The roadmap is designed to:

- build dependencies before dependent modules
- keep the prototype secure from the beginning
- avoid starting too many modules at once
- maintain requirement/test traceability
- keep all runtime components free/open-source
- produce usable release increments
- preserve the Project → WBS → Activity and Project + WBS + Cost Code architecture
- avoid premature microservices, paid cloud services or commercial libraries

---

# 2. Delivery Principles

1. Complete one release before actively developing the next release.
2. Within a release, build backend/data foundations before dependent UI workflows.
3. Authentication, authorization, validation and audit are not postponed until the end.
4. Every feature must trace to approved Requirement IDs.
5. Every sensitive business workflow must include tests as it is built.
6. Development occurs against non-production data.
7. Open-source dependency review occurs before adding significant packages.
8. Commercial components require explicit later approval and are not required for the prototype.
9. New business scope discovered during development enters Change Control rather than silently expanding a release.
10. Production deployment is not attempted until the release exit gate passes.

---

# 3. Parallel Work Rule

To reduce integration risk:

- only one release is the primary active release at a time
- no more than two tightly related business modules should be under heavy feature development simultaneously unless dependencies are stable
- cross-cutting Foundation work may continue as needed
- defects and test automation may run in parallel with feature development
- future-release UI prototypes must not create production dependencies before their release is approved

---

# 4. Phase 0 — ERP Definition

Phase 0 is complete only when the following are approved:

1. ERP Master Blueprint
2. Master Requirements Register
3. Database ERD
4. Roles & Permissions Model
5. API Architecture Baseline
6. Testing & UAT Approach
7. Development Roadmap
8. V0.1 Scope
9. V0.1 Acceptance Criteria
10. Dependency License Register

No V0.1 application code should begin before these Phase 0 gates are complete.

---

# 5. Development Toolchain Bootstrap

Before implementing business features:

1. Pin an approved Node.js LTS release.
2. Use pnpm as the proposed package manager unless a reviewed alternative is approved.
3. Create the repository application structure.
4. Configure TypeScript.
5. Configure linting / formatting using reviewed open-source dependencies.
6. Configure environment-variable handling.
7. Establish local PostgreSQL development environment.
8. Establish Prisma migration workflow.
9. Establish React frontend and NestJS backend.
10. Establish automated test commands.
11. Establish secrets handling rules.
12. Confirm the Dependency License Register before installing significant dependencies.

Exact versions are pinned at implementation time and recorded in source control / lockfiles.

---

# 6. Repository Application Structure

Target structure:

```text
construction-erp/
├── apps/
│   ├── web/        React + TypeScript
│   └── api/        NestJS + TypeScript
├── packages/
│   └── shared/     carefully limited shared types/config where appropriate
├── docs/
├── prisma/
├── storage/        local prototype data path, excluded from Git
└── tooling/
```

The exact folder layout may be adjusted during bootstrap without changing business architecture.

Secrets and runtime document files must not be committed to Git.

---

# 7. V0.1 Foundation — Build Sequence

V0.1 establishes the secure core ERP platform.

## Stage V0.1-A — Technical Skeleton

Build:

- Node.js / pnpm workspace
- React application shell
- NestJS application shell
- PostgreSQL development database
- Prisma configuration
- initial migration workflow
- environment configuration
- structured logging
- standard API error format
- health endpoint
- automated test commands

Gate:

Frontend and backend run locally, API reaches PostgreSQL, tests can run, secrets are excluded from Git.

---

## Stage V0.1-B — Company / Identity / Security

Build:

- Company
- User
- Employee linkage
- authentication
- secure sessions
- logout
- CSRF protection
- Roles
- Permissions
- user-role assignment
- role-permission assignment
- project-scope enforcement framework
- maker-checker framework
- audit framework
- approval workflow framework

Security gate:

- unauthorized APIs are blocked
- inactive users are blocked
- session revocation works
- project-scope tests pass
- System Administrator does not automatically gain business approval authority
- sensitive audit records cannot be edited normally

---

## Stage V0.1-C — Administration

Build:

- Company Settings
- User Management
- Role Configuration
- Permission Configuration
- Approval Matrix Configuration
- Status Configuration
- Number Sequences
- System Configuration
- basic Audit Configuration

Gate:

Administrators can configure the prototype without editing source code for normal configuration values.

---

## Stage V0.1-D — Master Data

Build:

- Customers
- Suppliers
- Employees
- Materials
- Units of Measure

For each master:

- list
- search/filter
- create
- view
- edit
- deactivate
- validation
- permissions
- audit metadata

Gate:

Inactive master data remains historically safe and cannot be incorrectly selected for new transactions where prohibited.

---

## Stage V0.1-E — Projects

Build:

- Project CRUD
- Project code/name
- Customer association
- contract value
- location/description
- project planned dates
- Project Team
- Project Contacts
- Project Status
- assigned-project visibility

Gate:

A Project Manager assigned to Project A can access Project A according to permissions while an unauthorized project-scoped user cannot access Project B.

---

## Stage V0.1-F — WBS & Cost Codes

Build:

- hierarchical WBS
- parent/child validation
- WBS status
- Cost Code register
- Project/WBS validation
- independent WBS and Cost Code dimensions

Gate:

Cost Code has no parent FK to WBS, and WBS nodes cannot cross Projects.

---

## Stage V0.1-G — Basic Documents

Build:

- Document Types
- document metadata
- local storage abstraction
- upload
- download
- Project document links
- file authorization
- basic archive behavior
- file-security controls

Gate:

Physical server paths are never exposed to the browser and unauthorized users cannot download Project documents.

---

## Stage V0.1-H — Integration / Regression / UAT

Complete:

- V0.1 automated tests
- security tests
- database integrity tests
- Project-scope tests
- basic end-to-end flow
- UAT
- defect resolution
- documentation
- release candidate

V0.1 exits only when V0.1 Acceptance Criteria pass.

---

# 8. V0.2 Project & Scheduling — Build Sequence

Dependency:

V0.1 Foundation must be stable.

## V0.2-A — Scheduling Data Model

Build:

- Working Calendars
- weekday rules
- calendar exceptions / holidays
- Activities
- Activity hierarchy
- Activity types
- responsibilities
- dependencies
- dependency lag

---

## V0.2-B — Scheduling Engine

Build and test independently from Gantt UI:

- working-day calculations
- planned dates/duration
- forecast dates
- dependency validation
- circular dependency prevention
- Critical Path
- Total Float
- milestones

---

## V0.2-C — Baselines / Progress

Build:

- Schedule Baseline
- baseline approval
- immutable baseline dates
- Activity Progress history
- actual dates
- forecast comparison
- delay calculation

---

## V0.2-D — Gantt / Lookahead

Build:

- Frappe Gantt integration
- Project Gantt read model
- Day / Week / Month views
- baseline/current visualization
- 2-week lookahead
- 4-week lookahead
- delayed/critical indicators

Frappe Gantt remains replaceable.

---

## V0.2-E — Site Execution

Build:

- Daily Site Reports
- manpower
- weather
- material-use observations
- site issues
- delays
- inspections
- site photographs
- Daily Report → Activity Progress

---

## V0.2-F — Equipment

Build:

- Equipment Register
- status
- Project assignment
- availability
- usage
- usage history

Maintenance remains Future unless scope is formally changed.

---

## V0.2-G — UAT Reference Programme

Validate the Ground Floor Slab example:

20 working days with:

- Setting Out
- Excavation
- Compaction
- Blinding
- Formwork
- Reinforcement
- Inspection
- Concrete Pour

V0.2 exits only after schedule calculations and Gantt presentation agree with independently tested backend results.

---

# 9. V0.3 Procurement — Build Sequence

Dependencies:

V0.1 Project/WBS/Cost Code  
V0.2 schedule dates for procurement-risk integration

## V0.3-A — BOQ & Budget

Build:

- BOQ
- sections
- items
- quantity / UOM / rate / amount
- Original Budget
- Revised Budget
- revision history
- approval
- Project/WBS/Cost Code reporting

---

## V0.3-B — Purchase Request

Build:

- PR header
- PR lines
- Project/WBS/Cost Code
- Material
- Required-on-Site date
- submit / approve / reject / cancel

---

## V0.3-C — RFQ / Quotations

Build:

- RFQ
- invited suppliers
- quotation capture
- quotation line pricing
- comparison view
- supplier award

---

## V0.3-D — Purchase Order

Build:

- PO
- lines
- source traceability
- Project/WBS/Cost Code allocations
- pricing
- approval
- revisions
- Expected Delivery date
- Required-on-Site date
- Committed Cost feed

---

## V0.3-E — Schedule Risk

Build:

Required-on-Site date versus Expected Delivery date.

Flag material/procurement risks against scheduled work.

---

# 10. V0.4 Inventory — Build Sequence

Dependencies:

V0.3 approved PO lines.

Build in order:

1. Warehouse
2. Goods Receipt
3. Stock Transaction Ledger
4. derived Stock Balance
5. Project/Site Stock
6. Material Reservation
7. Material Issue
8. Material Return
9. Stock Transfer
10. Inventory Reporting

Posting is atomic.

Physical stock is changed only by posted Inventory transactions.

Over-receipt tolerance is not implemented until the business rule is approved.

---

# 11. V0.5 Subcontracts — Build Sequence

Dependencies:

Project/WBS/Cost Code and approval framework.

Build:

1. Subcontractor Register
2. Subcontract Agreement
3. Scope of Work
4. Work Order
5. Progress Claim
6. Claim Assessment
7. Certification
8. Retention withholding
9. Subcontract Variations
10. reporting / Finance reference preparation

Retention release rules remain deferred until approved.

---

# 12. V0.6 Finance — Build Sequence

Dependencies:

Procurement, Inventory and Subcontract traceability.

Build:

1. Supplier Invoice
2. PO / Goods Receipt references
3. Supplier Invoice approval
4. Client Invoice
5. Client Invoice approval
6. AP / AR derived views
7. Payments
8. Payment approval / maker-checker
9. Payment Allocations
10. Subcontract certified-claim payment allocation
11. Retention ledger
12. Project Cash Flow

Before relying on Actual Cost, approve the detailed cost-recognition/accounting rule.

Tax/VAT, multi-currency, matching tolerances and detailed progress-billing rules remain Change-Control decisions until approved.

---

# 13. V0.7 Cost Control — Build Sequence

Dependencies:

Budget, Procurement, Subcontracts and Finance.

**Entry baseline:** APPROVED and CLOSED under DEC-024. PR #138 merged; post-merge main CI #2417 passed; Issue #137 closed. V0.7-A through V0.7-E are complete. Product / Business Owner accepted AC-V07-051/052 on 2026-10-04; acceptance-record PR #158 merged as `32ffab318066bec6fad770f5419cfd1942d9556d`; post-merge main CI #2637 passed; Issue #157 closed completed. **V0.7 Cost Control is COMPLETE AND ACCEPTED.**

Approved capabilities:

1. Original Budget consumption
2. Revised Budget consumption
3. Committed Cost
4. Actual Cost
5. Paid Cost
6. Direct Cost Posting
7. Cost Forecast / Uncommitted ETC
8. Cost to Complete
9. Variance
10. Client Project Variations
11. Contract / Revenue measures
12. Forecast Profit
13. Actual Profit
14. Project / WBS / Cost Code rollups
15. Cost reports

Approved implementation stages:

1. **V0.7-A — Integrated Cost Source Read Model**
2. **V0.7-B — Direct Cost Posting**
3. **V0.7-C — Forecast / ETC / Variance**
4. **V0.7-D — Project Variations / Revenue / Profit**
5. **V0.7-E — Cost Reporting / Hardening / Release Evidence**

Critical rules:

- Committed Cost, Actual Cost and Paid Cost remain separate measures.
- Source modules retain ownership; no second editable cost ledger.
- Goods Receipt/Inventory does not independently create Actual Cost.
- Human V0.7 UAT/business acceptance was mandatory at release exit and is now satisfied under AC-V07-051/052; DEC-023 was not reused.

Planning estimate: **24–37 engineering days**, plus a separate Product / Business Owner UAT/acceptance window.

Explicitly deferred unless Change Control approves otherwise: tax/VAT, GL/journals, FX/multi-currency, inventory valuation, retention release, detailed client progress billing, synthetic dimensional proration, automated Equipment Cost Allocation and V0.8 management analytics.

---
# 14. V0.8 Management — Build Sequence

Dependencies:

Stable source modules.

Build:

1. Project Engineer Dashboard refinement
2. Project Manager Dashboard
3. Executive Dashboard
4. Schedule Dashboard
5. Procurement Dashboard
6. Inventory Dashboard
7. Cost Dashboard
8. Finance Dashboard
9. cross-module reports
10. analytics
11. approved exports

Dashboards consume source-module data.

They must not create a second source of truth.

---

# 15. Cross-Release Dependency Map

```text
V0.1 FOUNDATION
   |
   +--> V0.2 PROJECT & SCHEDULING
   |
   +--> V0.3 BOQ & PROCUREMENT
           |
           +--> V0.4 INVENTORY
           |
           +--> V0.6 FINANCE
   |
   +--> V0.5 SUBCONTRACTS
           |
           +--> V0.6 FINANCE

V0.3 + V0.4 + V0.5 + V0.6
           |
           v
      V0.7 COST CONTROL
           |
           v
      V0.8 MANAGEMENT
```

V0.2 also feeds Required-on-Site scheduling context into V0.3 Procurement.

---

# 16. Release Entry Gate

A release enters active development only when:

- preceding required release is stable
- release scope is approved
- requirements are approved
- acceptance criteria exist
- dependency changes are license-reviewed
- required database/API baseline changes are approved
- test approach for the release is defined
- blocking open architecture decisions are resolved or explicitly deferred

---

# 17. Release Exit Gate

A release exits when:

- Must Have requirements are implemented
- database migrations reviewed
- backend/API complete
- applicable frontend complete
- permissions and audit implemented
- automated critical tests pass
- regression suite passes
- security/authorization tests pass
- UAT exit criteria pass
- Severity 1 defects = 0
- unresolved Severity 2 defects have formal accepted workaround or are resolved
- documentation updated
- Staging validation passes
- deployment/rollback procedure is ready

---

# 18. Prototype Boundary

The working prototype intentionally excludes unless later approved:

- microservices
- Kubernetes
- Redis as a mandatory dependency
- paid Gantt libraries
- MUI X Pro/Premium
- paid authentication providers
- mandatory paid cloud database
- mandatory paid object storage
- offline synchronization
- external customer portal
- supplier portal
- SSO / SCIM
- multi-company user membership
- field-level security
- amount-based approval thresholds
- multi-currency accounting
- detailed tax/VAT rules
- advanced accounting ledger / general ledger
- payroll
- BIM/CAD document processing

Exclusion does not mean these capabilities can never be added.

They enter through Change Control.

---

# 19. Security Work Is Continuous

Security is not a later release.

Every release must maintain:

- authentication
- backend authorization
- project scope
- validation
- maker-checker where applicable
- audit trail
- file authorization
- secret management
- dependency review
- security tests

Any newly discovered high-risk vulnerability blocks Production until resolved or formally risk-accepted by authorized ownership.

---

# 20. Database Hosting Sequence

Phase 0:

No physical database required.

V0.1 development:

Start with ordinary PostgreSQL locally / in Podman.

Optional later development/UAT:

Use a free hosted PostgreSQL provider such as Neon if remote shared access materially helps.

Rules:

- PostgreSQL remains the database technology
- provider-specific business logic is prohibited
- DATABASE_URL is configuration
- migration process remains portable
- production hosting is a later operational decision

---

# 21. GitHub Work Item Sequence

For implementation:

Epic / Feature  
→ Requirement IDs  
→ GitHub Issue  
→ Branch / Pull Request  
→ Tests  
→ UAT  
→ Release

Do not create all future implementation Issues at once.

Create detailed issues shortly before the relevant release/module enters development so they reflect the approved baseline without excessive stale backlog.

---

# 22. Current Next Step

Completed release: **V0.7 Cost Control — COMPLETE AND ACCEPTED**.

Next release: **V0.8 Management**.

Current stage: **V0.8-D Domain Dashboards — PRE-FLIGHT ACTIVE / IMPLEMENTATION NOT STARTED**.

Immediate sequence:

1. V0.7 Cost Control — COMPLETE AND ACCEPTED.
2. V0.8 entry gate — COMPLETE under DEC-025.
3. V0.8-A Management Read Model / KPI Contracts — **COMPLETE**.
4. V0.8-B Project Engineer & Project Manager Dashboards — **COMPLETE**.
5. Final Stage-B head `4230e6ffff3e1c5a3dc7ee3b7669f86061e704ba` — push CI #2796 PASS / PR CI #2797 PASS.
6. DEC-022 final exact-head re-review — **NO MAJOR ISSUES** after the AC-V08-003 P1 execution-view gap was fixed and regression-covered.
7. PR #170 — MERGED as `42444cc91912f323d672f63da050b68b8d777b62`.
8. Post-merge main CI #2798 — PASS; Issue #169 — CLOSED / COMPLETED.
9. Stage-B closure/status reconciliation PR #171 — MERGED as `5581819419a4602a73ed0249ad8e0377f745d474`; post-merge main CI #2809 PASS.
10. V0.8-C final PR #173 head `cbc916e5a325555d1971b0ceec6ae63445cfcaff` passed push CI #2886 and PR CI #2887, including authenticated live acceptance.
11. All eight genuine DEC-022 findings from the two Stage-C review rounds were fixed and resolved; final exact-head review reported **no major issues**.
12. PR #173 squash-merged as `a73d11024adc8b7b1373b4c962f924a34e354e20`; post-merge main CI #2888 PASS; Issue #172 CLOSED / COMPLETED.
13. V0.8-C Executive / Cross-Project Management Dashboard is technically COMPLETE.
14. Stage-C closure/status PR #174 squash-merged as `9a07a50d377aceec65304aa5881f3610d4cd1205`; post-merge exact-main CI #2901 PASS.
15. Issue #175 now tracks V0.8-D Domain Dashboards. Pre-flight branch `v0.8-d-preflight` is active; application implementation remains NOT STARTED until the pre-flight merge and post-merge main CI pass.


# 23. Baseline Decision

The approved build order is:

```text
Phase 0 Definition
       ↓
V0.1 Foundation
       ↓
V0.2 Project & Scheduling
       ↓
V0.3 BOQ & Procurement
       ↓
V0.4 Inventory
       ↓
V0.5 Subcontracts
       ↓
V0.6 Finance
       ↓
V0.7 Cost Control
       ↓
V0.8 Management
```

**Status: Development Roadmap Baseline v0.1**
