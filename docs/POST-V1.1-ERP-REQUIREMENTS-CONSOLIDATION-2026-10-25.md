# Construction ERP — Post-V1.1 Requirements Consolidation (42 Reference Templates)

**Recorded:** 2026-10-25 (Asia/Singapore)
**Status:** Owner-directed requirements intake and **PROPOSED successor design**, **NOT** implementation approval, a release-entry decision, a permission grant, a payroll policy approval, completed gap verification, UAT acceptance, or Production authorization.
**Repository:** `threeswordz/cinder-grind`
**Scope boundary:** V1.1-E2 remains under Issue [#233](https://github.com/threeswordz/cinder-grind/issues/233), with AC-V11-023–030 open. Do not incorporate new functionality into V1.1 by implication.

## 1. Authority, evidence and non-goals

- Follow [AGENTS.md](../AGENTS.md), [Project Governance](PROJECT-GOVERNANCE.md), [Decision Log](DECISION-LOG.md) (especially DEC-008/016/022/028–032), [approved V1.1 Scope](V1.1-SCOPE.md), [Business Rules](V1.1-BUSINESS-RULES.md) and [V1.1 E2 owner decision packet](V1.1-E2-OWNER-DECISION-PACKET.md).
- Historical owner-confirmed seven-role requirements remain in [ERP-7-Roles-Requirements-2026-10-24-EN.md](ERP-7-Roles-Requirements-2026-10-24-EN.md). This dated addendum **does not rewrite historical confirmations**, change an existing Approval Matrix, override approved transactions or grant rights.
- This document consolidates **42 user-supplied screenshot/reference concepts discussed in chat** (15 + 20 + 7). References are design inputs, **not 42 authorized ERP features or verified implementation screenshots**. Screenshots and any external BOQ spreadsheet are not asserted to be version-controlled fixtures.
- Repository foundations documented as accepted: V0.3 BOQ/Budget/Procurement; V0.4 Inventory; V0.5 Subcontracts; V0.6 Finance; V0.7 Cost Control; V0.8 Management; V1.0 Production Readiness. These descriptions are **scope/acceptance evidence**, not a line-by-line audit of all current controllers, schema and screens.
- Scope here is requirements capture, deduplication, risk controls and *proposed* future sequencing only. **No changes** to runtime, migrations, data, source APIs, roles, user permissions, approval routes, CI, or active UAT evidence.

## 2. Latest owner decisions and their precise status

| Topic | Recorded direction | Status / boundary |
|---|---|---|
| Operational currency | **All NEW ERP financial/monetary operations are THB-only**: BOQ, contracts, purchasing, subcontracts, invoices, payments, cost, salaries, payroll, reports and integrations. No FX/multicurrency operation or alternative new-transaction selection. | Owner confirmed, consistent with DEC-031 and clarified 2026-10-25; **product-wide enforcement is NOT yet delivered**, tracked in [#246](https://github.com/threeswordz/cinder-grind/issues/246). Historical SGD/unknown retained source labels/amounts/audit must **never be relabelled, converted, erased or misaggregated**. |
| Payroll priority | **Labour Attendance / HR / Payroll is P1** for successor planning, not deferred as a low priority. | Owner-confirmed **priority**. Specific HR/payroll responsibilities, calculations, approvals, statutory rules, exports and handoffs are **not yet confirmed**; no implicit V1.1 inclusion. |
| Internal Cost BOQ visibility | Authorized relevant employees may see cost BOQ information; **some roles must see quantities only**, with unit prices and monetary totals hidden. | Owner-confirmed visibility requirement. Exact role-by-role entitlement still **pending**; proposals in §4 are not grants. |
| Customer BOQ confidentiality | Item-level customer selling prices, rates, markup and margins visible to **Ben and Nancy only**. Accounting may need contract totals and installment/payment amounts without customer item prices. | Owner-confirmed design direction; source/API/export enforcement not yet verified or authorized as a runtime change. |
| BOQ costing | Support Detailed, Lump Sum and Hybrid methods, varying by work item/project; linked cost/customer BOQ, with possible different quantity/UOM, markup/gross-margin/manual sales pricing. | Owner-confirmed functional direction; detailed mapping/formula rules and architecture await source audit and successor change control. |
| Low-duplication UX | Consolidate screenshot references and reuse canonical records; avoid unnecessary independent forms, journals and approval engines. | Owner-confirmed design objective; navigation grouping (§3) is a proposal, not replacement module scope. |

### Distinguish established roles from proposed new grants

The **latest recorded seven-role requirements** specify:
- Internal Cost BOQ: **Ben prepares/submits → Khaimook approves** (initial/revised).
- Customer BOQ: **Ben prepares/submits → Nancy approves** (initial/revised).
- Customer Quotation: Ben prepares → Nancy approves before dispatch; changed price/discount requires approved revised quotation.
- Project VO: Ben prepares → Nancy approves (**different** from earlier UAT actor configuration).
- Supplier PO: Jai/Purchasing prepares → Ben approves; Finance approvals and subcontract handoffs stay governed by their canonical source and configured steps.
- These are **business requirements to reconcile**; they do not prove the existing API state machines/Approval Matrix implement the newer actors. Preserve earlier UAT evidence as evidence of its **historical configuration**.

## 3. Recommended consolidated navigation (proposal, not six new modules)

1. **BOQ & Commercial** — internal/customer BOQs, takeoff, estimating, quotation/contract source links.
2. **Project Execution** — Project/WBS/Activity, schedule, DPR, progress, issues, supported site inspections.
3. **Procurement & Inventory** — existing PR/RFQ/PO/GR, stock, issue/return/transfer, reconciliation.
4. **Finance & Cost Control** — existing invoices, payments, budget revisions, commitments/actual/paid/forecasts.
5. **Management & Reporting** — existing derived dashboards, authorized drilldowns and exports.
6. **People & Payroll (P1 candidate)** — employees, attendance, timesheets, OT and payroll (scope pending approval).

Home, My Work, Documents, Subcontracts and Administration remain accessible through appropriate existing source modules and permissions. Navigation must not manufacture a second source of truth, second approval engine, or user-selectable role impersonation.

## 4. BOQ and monetary disclosure — design requirements

### BOQ structure and lifecycle
- Reuse existing Project → WBS → Activity structure and **independent Cost Code** dimension. Link cost/customer views using durable source identifiers, not printed Excel row numbers; support one-to-many/many-to-one mappings without inventing conversions.
- Preserve first-approved Original Budget and approved revision history. No destructive edits, backdating, silent recalculation, source relabeling or construction-start-lock policy by implication.
- Store Detailed vs Lump Sum vs Hybrid cost mode and cost coverage (company-supplied materials versus subcontractor-supplied items, labour and equipment) with versioned assumptions. Cost estimation is **not** automatically Actual Cost.
- Clearly distinguish genuine UOM conversions (e.g. kilograms/tonnes) from assembly/consumption formulas (brickwork area to bricks, steel weight to bars, excavation to truck trips). Formula dimensions, waste/allowances, units, precision, rounding and versioned approval must be specified. Do not naively convert L/S.
- Pricing methods may include markup, target gross margin or manually set customer prices, with approval, traceability and no self-approval. Do not confuse margin with markup.
- Separate customer BOQ/quotation/contract/progress billing/Finance invoice business purposes; link approved source revisions, **do not introduce duplicate independent customer pricing ledgers**. Existing Client Invoice approval/finance controls remain authoritative until changed through approved Change Control.

### Minimum field-security contract
- Access is determined by authenticated identity, effective action permissions, Company, active Project assignment, owning source record and configured maker/checker; **UI visibility is never authorization**.
- Provide **Full Cost**, **Quantity Only** and **No Access** *as conceptual views*, supplemented by source/action-specific permissions. Quantity Only cannot retrieve unit costs, totals, budgets, margins or salary/wage rates in API payloads; control list/detail/search, exports, PDFs, source links, attachments, dashboard aggregates and caches.
- Customer BOQ item-level selling rates/amounts/markup/margins: Ben and Nancy only as user-directed requirement, subject to verified server-side enforcement. Porn may access authorized contract and billing/payment totals without customer BOQ line data.
- **Candidate role mapping for owner review only:** Store Site/Foreman Quantity Only on assigned/relevant projects; Jai may see authorized procurement prices without blanket BOQ financial access; Porn sees accounting source amounts but not blanket cost BOQ; Khaimook must have sufficient authorized Internal Cost BOQ information to perform the specified approval; Koh defaults to no BOQ access. Ben/Nancy costs, other Company/Project coverage and all effective permissions require an explicit reviewed matrix.
- Avoid side-channel leaks via count/aggregation, error messages, exports, document bytes, formula outputs or correlated reports. Do not add SYS_ADMIN business approval authority or a blanket exception to self-approval.

## 5. P1 HR / Attendance / Payroll — priority confirmed, policy not finalized

**Proposed staged design (NOT yet approved HR/payroll business rules):**
1. Employee master and canonical attendance records, site/shift/project association, appropriate privacy and correction audit.
2. Validated timesheets/OT/leave-related inputs **only as separately defined by business policy**; resolve worker vs subcontractor labour identity and signed-off source.
3. THB salary/wage calculation with effective-dated rates/rules, preparer/reviewer/approver separation, locked pay-period versions, reproducible evidence, corrections and payslips.
4. Restricted payment handoff and project labour allocation. Recognize a labour expense **only once** under a defined Finance/Cost Control source contract. DPR manpower is a permitted aggregate/view, **not a second employee-payroll attendance ledger**.

**Pending owner decisions before implementation:** Koh/HR preparer vs Porn/Nancy review/payment roles; employees vs daily labour/contractor coverage; actual shift/OT/leave rules; pay cycle; deductions, Thai tax and social-security treatment; bank/export and external accounting-office handoffs; salary visibility and privacy/retention requirements. Do not infer grants or statutory calculations from templates.

## 6. Permanent THB-only successor policy — closed to new foreign currencies, open historical evidence

- New monetary records use **THB only** across all businesses/modules/Companies and Projects; no FX, conversion workflow, non-THB alternative, administrator override or changeable new-document currency selector.
- Enforce in API validation, persisted-data constraints appropriate to **new records**, UI, imports/exports, Company Settings, integration and report boundaries. Use Decimal-safe calculations and tested THB rounding.
- Preserve immutable historic SGD and unknown/NULL currency provenance, amounts, posted Goods Receipts, approvals and audit. Never fabricate exchange rates or reinterpret NULL as THB. Do not silently sum with THB; fail closed where provenance is unknown/incompatible.
- Check PO/GR-to-Supplier-Invoice lineage, including existing [PR #248](https://github.com/threeswordz/cinder-grind/pull/248) focused currency guard, but do not claim that repair delivered product-wide single-currency enforcement. [PR #249](https://github.com/threeswordz/cinder-grind/pull/249) fixed limited UI defaults only.
- **Open owner policy Issue [#246](https://github.com/threeswordz/cinder-grind/issues/246)** remains the implementation tracker. Future data/schema/API policy changes need separate change approval, forward-only migration and tests.

## 7. Single-source data integrity and scalable implementation principles

| Data or event | Canonical source / safe consumption |
|---|---|
| BOQ/Budget | Existing Budget owner, immutable original/revision snapshots; customer pricing linkage is a separately approved enhancement. |
| Demand and supplier purchasing | Existing Procurement PR/RFQ/PO and approved PO history; no second supplier commitment record. |
| Goods receipt / stock | Existing Inventory GR/ledger issue/return/atomic transfer. Do not double-post on partial/duplicate requests. |
| Subcontract execution | Existing Agreement/WO/Claim/Assessment/Certification/Retention/Variation lifecycle; new work acceptance proposals must be reconciled rather than replace canonical stages. |
| Finance and cost | Existing approved Supplier/Client Invoices, payments, Direct Cost Posting and versions; **Committed, Actual and Paid are different measures**, and inventory valuation/issue-cost recognition is currently excluded. |
| Site progress | Canonical Project/Site report and approved source quantities; revisions retained; progress report is not independent financial recognition. |
| Attendance/payroll | Future single attendance/payroll authority with controlled feeds, not multiple independently editable ledgers. |
| Management | Source-derived read models and scoped exports; no editable second KPI/financial ledger. |

- Preserve PostgreSQL + Prisma modular monolith, open-source-first, versioned source interfaces, forward-only migrations, existing transaction state ownership, concurrency/idempotency controls and appropriate indexes/pagination. Avoid premature microservices/paid BI.
- No new multi-project supplier PO implementation is approved by this document; preserve the deferred design-only [Issue #245](https://github.com/threeswordz/cinder-grind/issues/245) and current separate-PO workaround.
- No automatic new GR approval/partial-posting rules, material urgent-issue bypasses, new self-approval exceptions, VAT/GL/payroll financial behaviors or other unconfirmed workflow policy.

## 8. Template consolidation — all 42 reference labels

These are **reference labels**, not feature-delivery promises. Where a source document or UI exists, prefer reuse; specialized calculators/screens are conditional on business need.

| Batch | Reference templates | Consolidate into / disposition |
|---|---|---|
| First 15 | BOQ Progress Tracking; Construction Cost Control; Material Reconciliation; Daily Progress Report; Bar Bending Schedule; Detailed Daily Progress Report; Concrete Pour Report; Labour Attendance Sheet; Project Cost Control Sheet; Weekly Cement Consumption Tracker; Material Cost Estimation; Materials Received; Equipment Cost; Labour Cost Estimation; Quantity Take-Off | BOQ/Cost Estimate; canonical DPR/Site; Inventory GR/Movements; Cost Control/Management; future HR attendance. BBS calculator and automated equipment valuation deferred. |
| Next 20 | Site Progress Report; BOQ Progress Presentation; BOQ Quantity Tracking; Labour & Equipment Register; Earthwork Quantity Tracker; Road Project Master Tracker; Project Master Tracker; Construction Project Schedule; Construction Schedule & Activities; Detailed Construction Programme; Column Progress; Excavation Progress; Foundation Progress; Piling Progress; RCC Pour Planning; Site Mobilization; Site Constraint & Clearance; Site Setup & Temporary Works; Survey & Setting-Out; Site Readiness Dashboard | Reuse Project/WBS/Activity/Schedule, site reports, cost/management dashboard and authorized task/issue/document views. Specialist engineering views only for projects that need them; no per-work-type standalone dashboard by default. |
| Final 7 | HIRA/JSA Risk Assessment; Construction Waste Cost Calculator; Delay Event Register; Goods Receipt Note Tracker; Testing & Commissioning Tracker; Structural Drawing Tracker; Weekly Cost Summary Dashboard | Consider bounded site safety/inspections, cost allowances/actual waste, schedule delays, existing GR, handover/testing, secure document revisions and existing management views; no duplicate ledger. |

Cautions: Do not total heterogeneous quantities (m2 + m3 + kg + L/S); distinguish physical progress, approved quantity, schedule weighting and Earned Value. Waste allowance is not automatically actual waste. A passed test is not approved handover; a delay event is not automatically an EOT. Import templates' currency symbols/formatting are **not** authoritative; all new ERP monetary operations must be THB.

## 9. Proposed roadmap and gates (planning only)

- **P0 CURRENT:** Finish V1.1-E2 Issue #233 evidence reconciliation, exact-head/post-main CI and separate human AC-V11-029/030 gates. Preserve DEC-032's *strictly local* recovery evidence exception; do not extend it to Production or other snapshots.
- **Read-only design preflight:** Verify actual Prisma entities, controllers/services, effective permissions, UI, canonical cost recognition and sample BOQ mapping. Classify each requirement **verified existing / partial / missing / conflicting / deferred / unnecessary**. A lack of search results is not proof of absence.
- **Successor change control:** Approve precise scope, role matrix, acceptance criteria, dependencies and migration/data policy before any new behavior. Priority and design direction are not implicit implementation approval.
- **P1:** THB-only enforcement (Issue #246), linked Internal/Customer BOQs + costing/UOM/field security, **HR/Labour Attendance/Payroll**, and approved commercial linkage. Sequence by dependencies; P1 does not imply one combined release.
- **P2:** Canonical site/stock-to-cost integration and dashboard refinements **only after** source recognition contracts are proven.
- **P3 / conditional:** Advanced BBS, automated equipment costing, specialist site/quality/safety/handover tools after a supported business case.
- **Production and scale:** security/privacy audit, integrity/retry/concurrency tests, recovery, performance with multi-project load, controlled migration, observability, human acceptance and rollout. No new paid runtime without separate approval.

## 10. Minimum successor acceptance criteria to specify before code changes

1. Negative direct-API tests for Company/Project/action restrictions, price/amount field redaction, search/list/detail/export/document/aggregate paths, and salary/payroll data.
2. Real maker/checker rules and no SYS_ADMIN business approval; existing historical decisions and role/UAT evidence unchanged.
3. BOQ source lineage, versioned cost components, unit/dimensional formulas, precision, nonnegative/valid quantities, cost coverage and approved baseline immutability.
4. No duplicate stock movements, invoices, commitments, cost postings, payroll expenses or payments under retry, concurrency, correction and rejection paths.
5. Correct separation of Committed / Actual / Paid and physical quantity measures; source-recognition rules not silently reinterpreted.
6. New-transaction THB-only constraints across forms/API/imports/DB/reporting; historical non-THB/unknown records preserved, never mixed, converted or relabelled.
7. Forward-only upgrades tested against historical data plus clean database; backups/recovery verified with bounded, accurate provenance.
8. Security and high-risk domain changes receive DEC-022 stable-candidate review, exact-head CI, normal PR/merge/post-main gates, plus **separate Product Owner UAT and acceptance**.

## 11. Explicitly unresolved — do not turn into current policy

- Final Full Cost vs Quantity Only role matrix (especially Jai, Porn, Store Site, Foreman, Koh and any cross-warehouse or all-project access).
- HR/payroll actor responsibilities, statutory/pay calculation logic and approved cost-recognition handoff.
- Customer quotation vs progress application vs FIN Client Invoice boundary; new quotation/billing workflows remain deferred until scoped.
- UOM formula ownership and conversion rule approval; project-specific assumptions and imported Excel mapping.
- Material issue exception thresholds, urgent review, GR inspection/approval changes, transfer receiving acknowledgment and any other differences between desired seven-role workflows and configured UAT baselines.
- Production rollout, new release numbering, date/estimates and financial/statutory accounting scope.

**Update classification:** Documentation-only requirements capture. No application features, release acceptance, production deployment, business permission/approval changes, new schema, dependency, CI or historical-state mutation is approved or claimed here.
