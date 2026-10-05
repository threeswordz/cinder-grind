**V0.8-E DEC-022 remediation authorization note — 2026-10-05:** PR #182 is READY and mergeable. Reviewed packaging head `3b0d17cb69548a2007d32ec88f008818b4fd448b` passed CI #3179 including authenticated live acceptance. Stage E reuses explicit `management.report.export` for controlled export and adds no new permission; AC-V08-015 source drilldowns remain aligned with owning endpoint permissions. DEC-022 reviewed that exact head and raised one genuine P2 limited to stale live-state documentation, not authorization behavior. This forward documentation-only remediation precedes exact-head CI, thread resolution and fresh exact-head re-review. Company isolation/effective Project access remain mandatory; `projects.access_all` and SYS_ADMIN do not imply Management/export/source-detail authority.

**V0.8-D closure note — 2026-10-05:** Dedicated Schedule, Procurement, Inventory, Cost and Finance Management dashboard tabs reuse canonical source-module semantics with no new Management permission. Final head `e11a77391ebfb43ff4431820ea363964f525f545` passed CI #2995 and clean DEC-022 review; PR #177 merged as `ff3dc08a4aee9945bb0b195627e31577f766f691` with exact-main CI #2996 PASS. Closure PR #178 merged as `4c47fd7713eb1faa57bf4ad8270b254a8bca96a7` with exact-main CI #3011 PASS; Issue #175 closed completed. V0.8-D authorization behavior is technically COMPLETE.

**V0.8-C closure note — 2026-10-04:** Stage C is COMPLETE. Executive portfolio reads require explicit `management.portfolio.view`; effective Project scope is applied before aggregation, while `projects.access_all` and technical SYS_ADMIN remain insufficient by themselves. Stage C added no new permission and did not widen source-detail authority. Final PR #173 head `cbc916e5a325555d1971b0ceec6ae63445cfcaff` passed CI #2886/#2887; final DEC-022 exact-head review reported no major issues; PR #173 merged as `a73d11024adc8b7b1373b4c962f924a34e354e20`; post-merge main CI #2888 passed and Issue #172 closed completed.

**V0.8-B closure note — 2026-10-04:** Stage B is COMPLETE. `management.dashboard.view` authorizes the scoped Management Project selector and aggregate Project Engineer / Project Manager workspace, while source execution/Gantt detail remains separately gated by the owning source permissions. Final head `4230e6ffff3e1c5a3dc7ee3b7669f86061e704ba` passed push/PR CI #2796/#2797; final DEC-022 exact-head re-review reported no major issues after the AC-V08-003 P1 fix; PR #170 merged; post-merge main CI #2798 passed; Issue #169 closed completed. V0.8-C is complete; V0.8-D is next and must preserve explicit Management permissions, effective Project scope and source-module authority boundaries.

**V0.8-B implementation note — 2026-10-04:** `management.dashboard.view` now authorizes the scoped Management Project selector and aggregate Project Engineer / Project Manager dashboard workspace. Effective Project access is still applied server-side before selection/read. Detailed Gantt/activity drilldown is shown only when the user separately has `schedule.programme.view`; protected source detail remains owned by the source module. `projects.access_all` and SYS_ADMIN still do not imply Management permission.

**V0.8-A implementation note — 2026-10-04:** Management adds explicit `management.dashboard.view`, `management.portfolio.view` and `management.report.export` permissions. Project Management summaries require `management.dashboard.view` plus effective Project access; portfolio reads require `management.portfolio.view` and exclude inaccessible Projects before aggregation. `projects.access_all` does not grant Management permission, and technical `SYS_ADMIN` receives no implicit Management business authority. Management aggregate visibility does not grant protected source detail; source-module permissions remain required for drilldown/detail.

**V0.7-E authorization reconciliation — 2026-10-04:** Cost Control reporting remains protected by explicit Cost Control permissions plus effective Project access. Aggregate reporting must not leak source-module Finance/Subcontract detail. Technical `SYS_ADMIN` remains technical authority only and receives no implicit Cost Control business view/approval authority. V0.7-B/C/D implemented the approved Direct Cost, Forecast and Project Variation permission families; Stage E adds no new permission without Change Control.

**V0.7-A implementation note — 2026-10-03:** `cost.control.view` is now seeded as the explicit read authority for the integrated Cost Control read model. It remains subject to effective Project access and does not grant source-module detail permissions. `projects.access_all` only bypasses Project assignment filtering, and technical `SYS_ADMIN` is not implicitly granted `cost.control.view`.

# Construction ERP — Roles & Permissions Model

**Document Status:** Roles & Permissions Baseline v0.1  
**Current Phase:** V0.8-E Reporting / Export / Hardening — UNDER VALIDATION / DEC-022 GATE  
**Architecture Baseline:** v0.1  
**Requirements Baseline:** v0.1  
**Database Baseline:** v0.1

**V0.6-D implementation note — 2026-10-03:** `finance.retention.view` is the only new Stage-D Finance retention permission and is read-only. Certification Payment-reference presentation additionally requires existing `subcontracts.certification.view` plus `finance.payment.view`. DOC-009 target operations retain `documents.document.view/upload/link/archive` and additionally require the matching Finance/Subcontract target view permission. `projects.access_all` bypasses Project assignment only; it grants no Finance, Subcontract or document mutation authority. Technical `SYS_ADMIN` remains separate from business authority.

---

# 1. Purpose

This document defines the baseline authorization model for the Construction ERP.

The model must:

- protect sensitive ERP data
- enforce Role-Based Access Control
- support project-scoped access
- support company-wide operational roles
- keep approval rights separate from edit rights
- support segregation of duties
- prevent technical administration from automatically becoming business approval authority
- remain configurable without redesigning the database

---

# 2. Authorization Principles

## 2.1 Authentication Is Not Authorization

Authentication answers:

**Who is the user?**

Authorization answers:

**What is the user allowed to do?**

A successfully authenticated user does not automatically gain access to ERP business functions.

---

## 2.2 Permission-Based Enforcement

Backend authorization is based on permissions.

Roles are collections of permissions.

Users receive permissions through assigned roles.

Core relationship:

User  
→ User Role  
→ Role  
→ Role Permission  
→ Permission

Frontend controls may hide unavailable actions, but the NestJS backend must enforce authorization independently.

A user must not be able to bypass authorization by calling the API directly.

---

## 2.3 Roles Are Configurable

The roles in this document are starter role templates for the prototype.

They are not hardcoded business rules.

Administrators may later:

- create additional roles
- change role names
- add or remove permissions from roles
- assign multiple roles to one user

without redesigning the ERP database.

---

## 2.4 Permission Definitions Are System-Controlled

Permission codes correspond to functionality implemented by the application.

Administrators assign existing permissions to Roles.

Administrators should not create arbitrary permission codes that the backend does not understand.

New application permissions are introduced through controlled application releases.

---

# 3. Permission Naming Standard

Permission codes use the pattern:

`<module>.<resource>.<action>`

Examples:

`projects.project.view`

`projects.project.edit`

`schedule.activity.edit`

`procurement.po.approve`

`finance.payment.approve`

`admin.roles.manage`

---

# 4. Standard Permission Actions

Common actions include:

| Action | Meaning |
| --- | --- |
| `view` | Read records |
| `create` | Create new records |
| `edit` | Edit allowed records |
| `submit` | Submit a transaction for approval |
| `approve` | Approve a transaction |
| `reject` | Reject a submitted transaction |
| `cancel` | Cancel an eligible transaction |
| `post` | Post an operational transaction |
| `revise` | Create/manage controlled revisions |
| `export` | Export data/reports |
| `manage` | Administrative configuration |
| `archive` | Deactivate/archive eligible records |

Approval permission is never implied by Edit permission.

---

# 5. Access Scopes

Permissions answer **what** a user may do.

Access scope answers **where** they may do it.

The prototype uses two primary project scopes.

## 5.1 Assigned-Project Scope

Operational project users normally see only Projects to which they are assigned.

Project access is derived through:

User  
→ Employee  
→ Project Member  
→ Project

A project-scoped operational user must therefore be linked to an Employee record.

Examples:

- Project Manager
- Project Engineer / Site Engineer
- Project-based QS

---

## 5.2 All-Projects Scope

Company-wide roles may receive:

`projects.access_all`

This permission broadens the user's project visibility.

It does **not** by itself grant create, edit, approve or financial permissions.

Examples of roles that may require all-project visibility:

- Management / Director
- Procurement
- Finance
- System Administrator
- Auditor

---

## 5.3 Multi-Project Transactions

If a future transaction references more than one Project, the user must have access to every referenced Project unless the user has `projects.access_all`.

This generic future rule does **not** authorize V0.6 Finance transactions to become multi-Project. Under D06-17 / DEC-018, each Supplier Invoice is exactly one Project. Under D06-18 / DEC-019, each Payment is exactly one Project and all of its allocation targets must match that Project. `projects.access_all` may bypass assignment filtering but does not bypass these same-Project transaction-integrity rules or grant Finance action/approval authority.

---

# 6. Starter Role Templates

The initial prototype defines the following starter roles.

| Role Code | Role | Default Scope | Purpose |
| --- | --- | --- | --- |
| SYS_ADMIN | System Administrator | All Projects | Technical administration |
| MANAGEMENT | Management / Director | All Projects | Executive oversight and configured business approvals |
| PROJECT_MANAGER | Project Manager | Assigned Projects | Manage assigned construction projects |
| PROJECT_ENGINEER | Project Engineer / Site Engineer | Assigned Projects | Site execution and schedule updates |
| QS_COST | QS / Cost Controller | Assigned Projects or All Projects | BOQ, budget, subcontract and cost control |
| PROCUREMENT_OFFICER | Procurement Officer | All Projects | Execute procurement workflow |
| PROCUREMENT_MANAGER | Procurement Manager | All Projects | Procurement management and configured approvals |
| STOREKEEPER | Storekeeper / Warehouse | Relevant Projects / Warehouses | Receiving and stock movements |
| EQUIPMENT_COORDINATOR | Equipment Coordinator | All Projects or Assigned Projects | Equipment register and utilization |
| FINANCE_OFFICER | Finance Officer | All Projects | Prepare finance transactions |
| FINANCE_MANAGER | Finance Manager | All Projects | Finance management and configured approvals |
| AUDITOR | Auditor / Read Only | All Projects | Read-only review and audit visibility |

The business may combine or split these roles later.

---

# 7. System Administrator Rule

System Administrator is a technical role.

Default responsibilities include:

- manage users
- manage roles
- assign permissions
- configure system settings
- configure number sequences
- configure statuses
- configure approval matrices
- support troubleshooting
- view audit information where authorized

System Administrator does **not automatically receive**:

- Purchase Order approval
- Budget approval
- Subcontract certification approval
- Supplier Invoice approval
- Client Invoice approval
- Payment approval
- Project Variation approval

If a person also performs a business-approval role, that person must receive a separate business role or explicit approval-role assignment.

This keeps technical access separate from commercial authority.

---

# 8. Starter Module Permission Matrix

Legend:

- **R** = Read
- **O** = Operate / create-edit-submit within scope
- **A** = Approval authority may be assigned
- **M** = Administrative manage
- **—** = No default access

Approval still requires the configured workflow / approval matrix.

| Module | SYS ADMIN | MANAGEMENT | PROJECT MANAGER | PROJECT ENGINEER | QS / COST | PROC OFFICER | PROC MANAGER | STOREKEEPER | EQUIP COORD | FIN OFFICER | FIN MANAGER | AUDITOR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Foundation | M | R | R | R | R | R | R | R | R | R | R | R |
| Master Data | M | R | R | R | R | O | O | R | R | R | R | R |
| Projects | R/M | R | O | R | R | R | R | R | R | R | R | R |
| WBS & Cost Codes | R/M | R | O | R | O | R | R | R | R | R | R | R |
| Planning & Scheduling | R | R | O | O | R | R | R | R | R | R | R | R |
| BOQ & Budget | R | R/A | R | R | O/A | R | R | — | — | R | R | R |
| Site Execution | R | R | O | O | R | R | R | R | R | R | R | R |
| Procurement | R | R/A | R | PR Create | R | O | O/A | R | — | R | R | R |
| Inventory | R | R | R | R | R | R | R | O | — | R | R | R |
| Equipment | R | R | R | R | R | R | R | R | O | R | R | R |
| Subcontracts | R | R/A | R | R | O/A | R | R | — | — | R | R | R |
| Finance | R | R/A | R | — | R | R | R | R | — | O | O/A | R |
| Cost Control | R | R | R | R | O | R | R | — | R | R | R | R |
| Documents | M/R | R | O | O | O | O | O | O | O | O | O | R |
| Reporting | R | R | R | R | R | R | R | R | R | R | R | R |
| Administration | M | R | — | — | — | — | — | — | — | — | — | R-limited |

This matrix defines defaults only.

Detailed action permissions below remain the enforcement source.

---

# 9. Core Permission Catalogue

The following permission catalogue is the initial baseline.

It is not intended to list every possible future permission.

---

## 9.1 Projects

- `projects.access_all`
- `projects.project.view`
- `projects.project.create`
- `projects.project.edit`
- `projects.project.archive`
- `projects.team.view`
- `projects.team.manage`

---

## 9.2 WBS & Cost Codes

- `wbs.structure.view`
- `wbs.structure.manage`
- `wbs.cost_code.view`
- `wbs.cost_code.manage`

---

## 9.3 Planning & Scheduling

- `schedule.programme.view`
- `schedule.activity.create`
- `schedule.activity.edit`
- `schedule.activity.archive`
- `schedule.progress.update`
- `schedule.dependency.manage`
- `schedule.calendar.manage`
- `schedule.baseline.create`
- `schedule.baseline.approve`
- `schedule.lookahead.view`

Baseline approval is separate from baseline creation.

---

## 9.4 BOQ & Budget

- `budget.boq.view`
- `budget.boq.manage`
- `budget.budget.view`
- `budget.budget.create`
- `budget.budget.edit`
- `budget.budget.submit`
- `budget.budget.approve`
- `budget.budget.reject`

---

## 9.5 Site Execution

V0.2-E enforcement uses:

- `site.daily_report.view`
- `site.daily_report.create`
- `site.daily_report.edit`
- `site.daily_report.submit`

`site.daily_report.edit` owns draft manpower/material/Equipment/issues/delays/inspections and append-only submitted-report corrections. `site.daily_report.submit` owns the finalization action that appends report progress into Scheduling's immutable Activity Progress history.

Earlier design placeholders `site.progress.update`, `site.issue.manage` and `site.inspection.manage` are not separate V0.2-E enforcement permissions. Introducing finer-grained Site permissions later requires an explicit permission-baseline change rather than silently weakening the four implemented controls.

---

## 9.6 Master Data

- `master.customer.view`
- `master.customer.manage`
- `master.supplier.view`
- `master.supplier.manage`
- `master.employee.view`
- `master.employee.manage`
- `master.material.view`
- `master.material.manage`
- `master.uom.view`
- `master.uom.manage`

---

## 9.7 BOQ & Procurement

### BOQ & Budget

V0.3-A enforcement uses:

- `budget.boq.view`
- `budget.boq.manage`
- `budget.revision.view`
- `budget.revision.submit`
- `budget.revision.approve`

BOQ and Budget reads/writes are Project-scoped. `budget.boq.manage` maintains the working canonical BOQ only; it does not permit mutation of captured Budget Revision snapshots. `budget.revision.submit` creates/submits immutable revision candidates, while `budget.revision.approve` is subject to the reusable Approval Matrix and maker-checker restriction. Approval permission never bypasses Project scope.

### Purchase Request

V0.3-B enforcement uses:

- `procurement.pr.view`
- `procurement.pr.manage`
- `procurement.pr.submit`
- `procurement.pr.approve`
- `procurement.pr.cancel`

`procurement.pr.manage` creates and edits Draft PR headers/lines. `procurement.pr.approve` authorizes both approve and reject actions at the configured Approval Matrix step; maker-checker is still enforced independently by the backend. All PR reads/actions remain Project-scoped, including approval. `procurement.pr.cancel` is business transaction authority and is **not** implicitly assigned to `SYS_ADMIN`; it must be granted through an explicitly configured business Role.

### RFQ / Quotations

V0.3-C enforcement uses:

- `procurement.rfq.view`
- `procurement.rfq.manage`
- `procurement.quotation.view`
- `procurement.quotation.manage`
- `procurement.award.select`

`procurement.award.approve` remains reserved/unimplemented in V0.3-C because no approved Stage C rule defines a separate award-approval workflow. RFQ creation/invitation, quotation maintenance and award selection are business authorities and are **not** implicitly assigned to the technical `SYS_ADMIN` role. They must be granted explicitly through configured business Roles. All RFQ/quotation/award reads and actions remain Project-scoped.

### Purchase Order

V0.3-D enforcement uses:

- `procurement.po.view`
- `procurement.po.create`
- `procurement.po.edit`
- `procurement.po.submit`
- `procurement.po.approve`
- `procurement.po.reject`
- `procurement.po.cancel`
- `procurement.po.revise`

`procurement.po.create` creates a Draft PO only from eligible line-level Supplier Awards in an accessible Project. `procurement.po.edit` changes Draft commercial/allocation/delivery fields only. `procurement.po.submit` starts the configured `PURCHASE_ORDER` Approval Matrix. `procurement.po.approve` and `procurement.po.reject` are separate business authorities and remain subject to maker-checker and Project scope. `procurement.po.revise` creates a new Draft version from the latest active approved revision; it never rewrites prior approved history. `procurement.po.cancel` retains actor/time/reason evidence.

All PO business permissions require explicit business-Role assignment. Every PO action permission (`create/edit/submit/approve/reject/cancel/revise`) depends on `procurement.po.view`; role-permission replacement rejects action-only PO configurations so workflow actors always have the scoped discovery/read path required to act. The technical `SYS_ADMIN` role is deliberately not granted implicit PO create/edit/submit/approve/reject/cancel/revise authority.

---

## 9.8 Inventory

- `inventory.goods_receipt.view`
- `inventory.goods_receipt.create`
- `inventory.goods_receipt.post`
- `inventory.goods_receipt.cancel`
- `inventory.stock.view`
- `inventory.reservation.manage`
- `inventory.material_issue.create`
- `inventory.material_issue.post`
- `inventory.material_return.create`
- `inventory.material_return.post`
- `inventory.transfer.create`
- `inventory.transfer.post`
- `inventory.warehouse.manage`

Posting permission is separate from editing a draft transaction.

---

## 9.9 Equipment

V0.2-F enforcement uses:

- `equipment.type.view`
- `equipment.type.manage`
- `equipment.equipment.view`
- `equipment.equipment.manage`
- `equipment.assignment.view`
- `equipment.assignment.manage`
- `equipment.usage.view`
- `equipment.usage.create`
- `equipment.usage.edit`

Project assignment and usage permissions remain subject to Project scope. Company-wide register/type permissions do not reveal restricted Project details through assignment views. `equipment.usage.edit` permits audited correction of manual usage only; Daily Site Report-origin usage is corrected through the submitted-report correction path.

Earlier placeholders `equipment.register.*`, `equipment.usage.record` and `equipment.maintenance.manage` are not V0.2-F enforcement permissions. Maintenance remains Future under EQP-008.

---

## 9.10 Subcontracts

- `subcontract.agreement.view`
- `subcontract.agreement.manage`
- `subcontract.work_order.create`
- `subcontract.work_order.submit`
- `subcontract.work_order.approve`
- `subcontract.claim.view`
- `subcontract.claim.assess`
- `subcontract.claim.certify`
- `subcontract.variation.create`
- `subcontract.variation.submit`
- `subcontract.variation.approve`

---

## 9.11 Finance

### Supplier Invoice

- `finance.supplier_invoice.view`
- `finance.supplier_invoice.create`
- `finance.supplier_invoice.edit`
- `finance.supplier_invoice.submit`
- `finance.supplier_invoice.approve`
- `finance.supplier_invoice.reject`

### Client Invoice

- `finance.client_invoice.view`
- `finance.client_invoice.create`
- `finance.client_invoice.edit`
- `finance.client_invoice.submit`
- `finance.client_invoice.approve`
- `finance.client_invoice.reject`

### Payment

- `finance.payment.view`
- `finance.payment.create`
- `finance.payment.edit`
- `finance.payment.submit`
- `finance.payment.approve`
- `finance.payment.reject`
- `finance.payment.cancel`

### Other Finance

- `finance.ap.view`
- `finance.ar.view`
- `finance.cashflow.view`
- `finance.retention.view`

---

## 9.12 Cost Control

- `cost.control.view`
- `cost.direct_posting.create`
- `cost.direct_posting.submit`
- `cost.direct_posting.approve`
- `cost.forecast.view`
- `cost.forecast.manage`
- `cost.forecast.approve`
- `cost.variation.view`
- `cost.variation.create`
- `cost.variation.submit`
- `cost.variation.approve`

---

## 9.13 Documents

- `documents.document.view`
- `documents.document.upload`
- `documents.document.link`
- `documents.document.archive`
- `documents.type.manage`

Approved/historical documents should be archived rather than physically deleted through ordinary user workflows.

---

## 9.14 Reporting

- `reporting.operational.view`
- `reporting.management.view`
- `reporting.report.export`

Report access must also respect underlying project/data scope.

`reporting.operational.view` includes the V0.3 Procurement Schedule / Risk read model. It permits status, key-date, risk and transaction-reference visibility only; it does not independently grant Supplier Quotation or Purchase Order commercial pricing authority. The procurement report therefore excludes unit-price and amount fields.

A report permission does not bypass project-scope restrictions.

---

## 9.15 Administration

- `admin.company.manage`
- `admin.users.manage`
- `admin.roles.manage`
- `admin.permissions.assign`
- `admin.approval_matrix.manage`
- `admin.number_sequences.manage`
- `admin.status.manage`
- `admin.project_types.manage`
- `admin.activity_types.manage`
- `admin.system_settings.manage`
- `admin.audit_config.manage`

---

## 9.16 Audit

- `audit.log.view`

There is intentionally no ordinary permission such as:

`audit.log.edit`

Audit history is immutable to ordinary application users, including System Administrators.

---

# 10. Transaction Responsibility Baseline

The following describes default maker / processor / approver responsibility.

Actual approval-step Roles remain configurable.

| Process | Typical Creator / Operator | Typical Approver |
| --- | --- | --- |
| Project Setup | Project Manager / Admin | Configurable |
| WBS | Project Manager / QS | Configurable if approval introduced |
| Schedule Baseline | Project Manager / Project Engineer | Project Manager / Management as configured |
| BOQ / Budget | QS / Cost Controller | Project Manager / Management |
| Daily Site Report | Project Engineer | Project Manager if approval is enabled |
| Purchase Request | Project Engineer / Project Manager | Project Manager / configured approver |
| RFQ | Procurement Officer | Procurement Manager if approval is enabled |
| Supplier Award | Procurement Officer | Procurement Manager / Management |
| Purchase Order | Procurement Officer | Procurement Manager / Management |
| Goods Receipt | Storekeeper | Posting authority, not necessarily approval workflow |
| Material Issue | Storekeeper | Posting authority |
| Subcontract Work Order | QS / Cost Controller | Project Manager / Management |
| Subcontract Claim Assessment | QS / Cost Controller | Certification authority |
| Supplier Invoice | Finance Officer | Finance Manager |
| Client Invoice | Finance Officer | Finance Manager / Management |
| Payment | Finance Officer | Finance Manager / Management |
| Direct Cost Posting | QS / Finance authorized user | Configured Cost / Finance approver |
| Project Variation | QS / Project Manager | Management |

Approval amount thresholds are not defined in Architecture Baseline v0.1.

If amount-based approval limits are required, they will be added through Change Control.

---

# 11. Segregation of Duties

## 11.1 Maker-Checker Principle

For sensitive commercial and financial transactions, the system should support separation between:

**Maker**

Creates / edits / submits

and:

**Checker / Approver**

Approves / rejects

---

## 11.2 Own-Transaction Approval

Baseline control:

A user must not approve the same Payment that the user created/submitted.

The same maker-checker restriction should be enabled for:

- Purchase Orders
- Supplier Invoices
- Client Invoices
- Budget approvals
- Project Variations

unless a formally approved business rule explicitly allows otherwise.

This validation belongs in the approval service, not only in the frontend.

---

## 11.3 Edit After Approval

Users with edit permission do not automatically gain permission to alter approved transactions.

Approved transactions must normally use:

- revision
- cancellation
- reversal
- new correcting transaction

according to the applicable module.

---

## 11.4 System Administrator Separation

System Administrator may configure approval Roles and workflows.

System Administrator must not use technical privileges to bypass a business approval.

Direct database changes are outside normal application workflow and must not be treated as valid business approvals.

---

# 12. Project-Scoped Authorization

## 12.1 Project Membership

For project-scoped Roles, the backend checks:

1. authenticated User
2. active User
3. required permission
4. User is linked to an Employee
5. Employee is an active Project Member for the Project

If all conditions are met, the action may proceed subject to business-state validation.

---

## 12.2 All-Project Users

Users with:

`projects.access_all`

do not require Project Member assignment for visibility.

However, they still require the relevant action permission.

Example:

A Finance Officer may have:

- `projects.access_all`
- `finance.supplier_invoice.create`

but not:

- `projects.project.edit`

Therefore Finance can allocate invoices across Projects without editing Project master data.

---

## 12.3 Project Scope and Reports

Dashboards and reports must apply the same project-access rules as transaction screens.

A user must not gain unauthorized project visibility merely through Reporting.

---

# 13. Approval Authorization Evaluation

A business approval succeeds only when all applicable conditions are true:

1. User is authenticated.
2. User is active.
3. User has the relevant `*.approve` permission.
4. An Approval Instance exists for the business record where required.
5. User's Role is authorized for the current Approval Step.
6. Record is in the correct submitted state.
7. Maker-checker rules are satisfied.
8. Project/data scope is valid.
9. Business-specific validation succeeds.

Frontend button visibility is not a security control.

The backend performs the final decision.

---

# 14. Audit Access

Audit logs contain sensitive operational history.

Default access:

| Role | Audit Log |
| --- | --- |
| System Administrator | View |
| Management / Director | View |
| Auditor | View |
| Project Manager | Limited through business-record history |
| Other operational users | No direct global audit-log access |

Ordinary users may see change history on records they are authorized to view without receiving global audit-log access.

Audit logs cannot be edited through normal ERP permissions.

---

# 15. Sensitive Actions

The following actions require explicit permissions and must not be included merely because a user can edit the associated record:

- approve Budget
- approve Schedule Baseline
- approve Purchase Request
- approve Supplier Award
- approve Purchase Order
- certify Subcontract Claim
- approve Subcontract Variation
- approve Supplier Invoice
- approve Client Invoice
- approve Payment
- approve Direct Cost Posting
- approve Project Variation
- cancel approved business transactions
- manage Users
- manage Roles
- assign Permissions
- change Approval Matrix
- change Number Sequences

---

# 16. Permission Evaluation Pseudologic

Conceptually:

```text
authorize(user, permission, project?)

1. reject if user is not authenticated
2. reject if user is inactive
3. load permissions from all assigned roles
4. reject if required permission is absent
5. if project is supplied:
     allow scope if user has projects.access_all
     otherwise require user's employee to be an active project member
6. apply business-state rules
7. apply maker-checker / approval rules if applicable
8. allow
```

This logic is implemented in NestJS guards/services.

---

# 17. Role Assignment Rules

- One User may have multiple Roles.
- One Role may be assigned to multiple Users.
- Roles are company-scoped.
- Permission definitions are system-defined.
- A user's effective permissions are the union of permissions from active assigned Roles.
- Explicit deny rules are not part of the prototype baseline.
- If future deny semantics are introduced, they require a deliberate architecture decision.

---

# 18. Initial Role Recommendations

For the first working prototype, create these Roles first:

1. System Administrator
2. Management / Director
3. Project Manager
4. Project Engineer / Site Engineer
5. QS / Cost Controller
6. Procurement Officer
7. Procurement Manager
8. Storekeeper / Warehouse
9. Equipment Coordinator
10. Finance Officer
11. Finance Manager
12. Auditor / Read Only

Do not create dozens of highly specialized Roles before real users require them.

The permission model is designed so new Roles can be composed later from the same permission catalogue.

---

# 19. Database Alignment

The Roles & Permissions model aligns with Database Baseline v0.1:

- `users`
- `employees`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `project_members`
- `approval_workflows`
- `approval_steps`
- `approval_step_roles`
- `approval_instances`
- `approval_actions`
- `audit_logs`

Project scope is derived from:

`users.employee_id`  
→ `employees.id`  
→ `project_members.employee_id`

No new database table is required for the baseline project-access model.

If external/non-employee project users are later required, an explicit project-user access table may be introduced through Change Control.

---

# 20. Requirements Alignment

This model directly supports the approved requirements including:

- FND-001 User Authentication
- FND-003 Authorization Framework
- FND-004 Role-Based Access Control
- FND-005 Approval Workflow Framework
- FND-006 Audit Framework
- ADM-002 User Management
- ADM-003 Role Configuration
- ADM-004 Permission Configuration
- ADM-005 Approval Matrix Configuration
- SYS-004 Approval Lifecycle
- SYS-005 Configurable Approval Authority
- SYS-006 Single Data Owner

It also supports the module-specific submit / approve requirements for:

- Budget
- Purchase Requests
- Purchase Orders
- Subcontracts
- Supplier Invoices
- Client Invoices
- Payments
- Cost Control

---

# 21. Open Items Deferred from Baseline

The following are not required for the prototype baseline:

- field-level permissions
- row-level access beyond Project scope
- temporary delegated approval
- amount-based approval thresholds
- explicit permission-deny rules
- external/customer portal users
- supplier portal users
- single sign-on
- SCIM provisioning
- multi-company user membership

These may be added later through Change Control if required.

---

# 22. Baseline Decision

The Construction ERP authorization model is:

Authentication  
→ User  
→ Roles  
→ Permissions  
→ Project Scope  
→ Business-State Validation  
→ Approval-Step Validation

Technical administration and business approval authority remain separate.

**Status: Roles & Permissions Baseline v0.1**

The next Phase 0 deliverable is:

**API Architecture Baseline — Issue #5**


## V0.4-A Warehouse permissions

- `inventory.warehouse.view` — scoped Warehouse list, detail and Project selector
- `inventory.warehouse.create` — create Company/Project Warehouses
- `inventory.warehouse.edit` — edit Warehouse master data
- `inventory.warehouse.archive` — archive/reactivate Warehouse

Each endpoint enforces Company and effective Project scope in addition to its explicit permission. The technical `SYS_ADMIN` may maintain Warehouse configuration but receives no Inventory posting or business approval authority. Later-stage Inventory transaction permissions are not granted in Stage A.


## V0.4-B Goods Receipt permissions

| Permission | Authority |
| --- | --- |
| `inventory.receipt.view` | Project-scoped eligible PO, Warehouse choice, receipt list/detail and retained movement/action history |
| `inventory.receipt.create` | Create a Draft receipt against the current approved PO material source |
| `inventory.receipt.edit` | Change Draft remarks or item quantity |
| `inventory.receipt.submit` | Submit to configured `GOODS_RECEIPT` Approval Matrix workflow |
| `inventory.receipt.approve` | Act in the configured approver Role; final approval atomically posts; may reject |
| `inventory.receipt.reverse` | Reverse posted receipt with reason, opposite ledger and audit history |

All routes enforce explicit permission, persisted Company/Project assignment and CSRF on mutation. `projects.access_all` bypasses Project assignment only; it does not grant receipt action authority. Approval Matrix Role and maker-checker checks remain mandatory. No Goods Receipt posting/approval/reversal permission is granted to technical `SYS_ADMIN` by the Stage B migration. Business Roles receive them through existing administration.


## V0.4-C Stock Balance permission

| Permission | Authority |
| --- | --- |
| `inventory.stock.view` | View read-only derived Stock Balance and effective Project filters within Company/Project scope |

This permission exposes business Inventory quantities and is not granted implicitly to technical `SYS_ADMIN`. Backend aggregation enforces Company and effective Project scope before grouping. Users without `projects.access_all` cannot see nullable/unallocated Project stock or another Project's balance through Warehouse, Material, search or direct Project filters.


## V0.4-D Material movement permissions

| Permission | Authority |
| --- | --- |
| `inventory.reservation.view` | View scoped Reservations, stock choices and derived availability |
| `inventory.reservation.create` | Create Reservation Drafts |
| `inventory.reservation.edit` | Edit Reservation Drafts |
| `inventory.reservation.activate` | Activate against currently available stock |
| `inventory.reservation.release` | Release or cancel Active Reservations with retained history |
| `inventory.issue.view` | View scoped Material Issues, stock choices and eligible Active Reservations |
| `inventory.issue.create` | Create Material Issue Drafts |
| `inventory.issue.edit` | Edit Material Issue Drafts |
| `inventory.issue.submit` | Submit to configured `MATERIAL_ISSUE` workflow |
| `inventory.issue.approve` | Act as configured approver; final action atomically posts stock |
| `inventory.issue.reverse` | Reverse a posted Issue when downstream Return ordering permits |
| `inventory.return.view` | View scoped Returns and eligible posted Issue lines |
| `inventory.return.create` | Create Material Return Drafts |
| `inventory.return.edit` | Edit Material Return Drafts |
| `inventory.return.submit` | Submit to configured `MATERIAL_RETURN` workflow |
| `inventory.return.approve` | Act as configured approver; final action atomically posts stock |
| `inventory.return.reverse` | Reverse a posted Return subject to available-stock protection |

The Stage-D permission migration intentionally does not grant these business permissions to technical `SYS_ADMIN`. Every backend route still enforces Company and effective Project scope in addition to the explicit permission. Approval Matrix Role checks and maker-checker remain mandatory for Issue/Return final posting. UI tab visibility is convenience only and never substitutes for backend authorization.

## V0.5-A Subcontracts permissions

| Permission | Authority |
| --- | --- |
| `subcontracts.subcontractor.view` | View the Company register without requiring Project membership |
| `subcontracts.subcontractor.manage` | Create and edit Company register entries and optional same-Company Supplier link |
| `subcontracts.subcontractor.archive` | Archive/reactivate selection eligibility while retaining history |
| `subcontracts.agreement.view` | View agreements and selectors within effective Project scope |
| `subcontracts.agreement.create` | Create a Project-scoped agreement Draft |
| `subcontracts.agreement.edit` | Edit a Project-scoped agreement while its system state is Draft |

The Stage-A migration and fresh bootstrap give technical `SYS_ADMIN` these foundation/configuration actions so a clean environment is operable. No agreement approval, Work Order, claim, assessment, certification, retention, Variation or Finance authority exists in Stage A. Later business actions remain separate permissions and Approval Matrix Role checks; technical administration never becomes implicit business approval authority. `projects.access_all` bypasses Project assignment only.


## V0.6-A Supplier Invoice Finance permissions

| Permission | Authority |
| --- | --- |
| `finance.supplier_invoice.view` | View effective Finance Projects, Supplier Invoice register/detail, source options/history and authorized PO/GR forward trace |
| `finance.supplier_invoice.create` | Create Project-scoped Supplier Invoice Drafts |
| `finance.supplier_invoice.edit` | Edit Draft headers/lines only |
| `finance.supplier_invoice.submit` | Submit a Draft to a configured `SUPPLIER_INVOICE` Approval Matrix workflow |
| `finance.supplier_invoice.approve` | Act as a configured approval Role, subject to maker-checker |
| `finance.supplier_invoice.reject` | Reject a Submitted Supplier Invoice as a configured approval Role, retaining reason/history |

All Finance routes enforce explicit permission plus Company and effective Project scope on the backend; `projects.access_all` bypasses Project assignment only and does not grant Finance action authority. Technical `SYS_ADMIN` does not implicitly receive any `finance.supplier_invoice.*` business permission. Approval Matrix Role membership and maker-checker are independent requirements for approve/reject actions. The Stage-A UI hides unavailable actions for usability but cannot authorize them.
