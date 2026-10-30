# Khaimook (คุณไข่มุข) — PM / Head of Store

> **Current execution precedence — Owner #288, 30 October 2026:** Accounting development is deferred; HR1-A #283 keeps its existing designated writer. The original L0/L1/L2 values below are **historical workflow risk flags**, not a current coding order. Read [13-execution-disposition.md](13-execution-disposition.md) and [11-launch-scope-and-next-package.md](11-launch-scope-and-next-package.md) before selecting new work. Existing BOQ/operational/Finance controls and the approved scoped HR privacy matrix remain intact; this document is not new implementation or Production authority.


**Prepared:** 30 October 2026, Asia/Singapore. **Assessment baseline:** `4fd3635ed06510dc4759e00061cfc92d6cbad2bc`.

This is a reconciled business-requirements and source-assessment record, not a statement that every requirement is implemented, configured, accepted or approved for Production. Named people identify business functions, not hard-coded authorization checks.

- **Intake change:** new / changed / confirmed existing is relative to the 24 October seven-role baseline (S1); it is independent of implementation status. New editorial IDs are traceability labels, not invented original question IDs.
- Existing question IDs and enterprise IDs are retained. Related IDs link shared responsibilities; they are not automatically equivalent implementation contracts.
- **Historical risk flag (not current build priority):** L0 = before relying on the affected financial/stock/security workflow; L1 = before full role workflow use, or a separately accepted pilot workaround; L2 = deferred/conditional next scope. These priorities do not authorize implementation.
- Permission/configuration activation is unverified in this assessment. Accepted V1.2/BOQ evidence stays closed; only materially changed paths need new verification.
- Cross-role authority is in [00-shared-workflows.md](00-shared-workflows.md); sources/contradictions are in [12-decisions-and-sources.md](12-decisions-and-sources.md).

**Historical persona label:** PROJECT_MANAGER + STOREKEEPER. This is not proof of live permissions.

## Requirement index

| ID | Requirement | Intake change | Decision | Implementation observation | Original risk flag |
| --- | --- | --- | --- | --- | --- |
| PM01 | PR/usage-plan review | changed | confirmed | partially implemented | L0 |
| PM02 | Partial PR line disposition | changed | confirmed | partially implemented | L0 |
| PM03 | Excess demand/budget revision | changed | confirmed with open detail | partially implemented | L0 |
| PM04 | Internal Cost BOQ initial and revisions | confirmed existing | confirmed | implemented | L0 |
| PM05 | Disclosure and warehouse scope | changed | confirmed core; conflicting disclosure source | partially implemented | L0 |
| PM06 | Receive and decide anomalies | changed | confirmed | partially implemented | L0 |
| PM07 | Transfers and beyond-plan issue authority | changed | confirmed with open detail | partially implemented | L0 |
| PM08 | Stock count and approved adjustment | changed | confirmed with open detail | missing | L0 |
| PM09 | Urgent incomplete-document material handling | changed | confirmed with open detail | partially implemented | L0 |
| PM10 | Subcontract agreement preparation | confirmed existing | confirmed | configuration-only | L0 |
| PM11 | Work Order preparation | confirmed existing | confirmed | configuration-only | L0 |
| PM12 | Physical work and certification handoff | changed | confirmed with open detail | partially implemented | L0 |
| PM13 | Material/work-method changes | changed | confirmed | configuration-only | L1 |
| PM14 | Actual-hour labour allocation | confirmed existing | confirmed with open detail | missing | L2 |
| PM15 | Cross-Project reports and alerts | changed | confirmed with open detail | partially implemented | L1 |
| PM16 | Close-site preparation | changed | confirmed with open detail | missing | L1 |
| PM-HR-01 | PM HR duties | new | confirmed | missing | L2 |
| PM-CASH-01 | Field-central petty cash custody | confirmed existing | confirmed with open detail | missing | L0 |

## PM01 — PR/usage-plan review

- **Stable ID:** PM01. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed.
- **Business need:** PR/usage-plan review.
- **Expected workflow:** Review available stock, ordered/outstanding receipts, approved cost quantities, work plan/date, progress and actual usage; approve Store material usage plans.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. PR header/lines, Project scope, submission, record-level approval and rejection exist. approveRequest decides the whole instance.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No independent per-line approval/return disposition or approved usage-plan evaluation in this service/model contract.
- **Recommended action:** Design line dispositions and demand traceability without prematurely sourcing rejected lines.
- **Pinned implementation/configuration evidence:** [apps/api/src/procurement/procurement.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/procurement.service.ts); [apps/api/src/procurement/procurement.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/procurement.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PM02 — Partial PR line disposition

- **Stable ID:** PM02. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed.
- **Business need:** Partial PR line disposition.
- **Expected workflow:** Approve correct PR lines and return other lines for correction without waiting for the whole PR.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. PR header/lines, Project scope, submission, record-level approval and rejection exist. approveRequest decides the whole instance.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No independent per-line approval/return disposition or approved usage-plan evaluation in this service/model contract.
- **Recommended action:** Design line dispositions and demand traceability without prematurely sourcing rejected lines.
- **Pinned implementation/configuration evidence:** [apps/api/src/procurement/procurement.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/procurement.service.ts); [apps/api/src/procurement/procurement.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/procurement.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PM03 — Excess demand/budget revision

- **Stable ID:** PM03. **Related existing IDs:** COST-003, COST-004, COST-005
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Excess demand/budget revision.
- **Expected workflow:** Khaimook records reason → Ben proposes budget change → Nancy approves before buying excess.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** Budget availability and quantity ceiling semantics need a contract; no silently increased original budget.
- **Implementation classification:** partially implemented. Approved budget snapshots and current agreement commercial ceilings exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Reviewed PO/subcontract/direct-cost services do not enforce the requested combined BOQ/category/project budget guard before authorization; agreement ceiling is not a Project budget.
- **Recommended action:** Propose a shared budget-availability contract, reservations/concurrency and explicit approvals for over-budget changes; no invented amount basis.
- **Pinned implementation/configuration evidence:** [apps/api/src/budget/budget.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/budget.service.ts); [apps/api/src/procurement/purchase-order.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.service.ts); [apps/api/src/subcontracts/subcontracts-workflow.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-workflow.service.ts); [apps/api/src/cost-control/direct-cost.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/cost-control/direct-cost.service.ts)

## PM04 — Internal Cost BOQ initial and revisions

- **Stable ID:** PM04. **Related existing IDs:** BUD-011, BUD-012, BUD-013, BUD-014, BUD-015, BUD-016
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Internal Cost BOQ initial and revisions.
- **Expected workflow:** Ben prepares → Khaimook approves; quantity, material/specification, rate or grouping changes require new approval/history.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** implemented. Linked customer versions, cost snapshots and disclosure were delivered/accepted under BUD-011–016. Use release evidence with its retained-fixture limits.
- **Configuration evidence:** accepted V1.3 recorded configuration evidence retained; no new grant or full-current-runtime capture asserted.
- **Observed gap:** Older supplied PDF says full cost for Jai/Porn, conflicting with the approved matrix. No new defect in accepted BOQ behavior is asserted.
- **Recommended action:** Preserve accepted matrix and acceptance; record the broader-access request as a conflict requiring explicit change control.
- **Pinned implementation/configuration evidence:** [docs/V1.3-RELEASE-EXIT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/V1.3-RELEASE-EXIT.md); [docs/BOQ-COMMERCIAL-SCOPE.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/BOQ-COMMERCIAL-SCOPE.md); [apps/api/src/budget/budget.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/budget.service.ts); [apps/api/src/budget/customer-boq.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/customer-boq.service.ts); [apps/api/src/budget/budget-disclosure.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/budget-disclosure.ts)

## PM05 — Disclosure and warehouse scope

- **Stable ID:** PM05. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed core; conflicting disclosure source.
- **Business need:** Disclosure and warehouse scope.
- **Expected workflow:** Transactional authority covers assigned Projects; reports/alerts across authorized MKE/TCJ; extra central/other warehouse access is read only. Preserve BOQ customer-price restrictions.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** View: per the approved BOQ disclosure matrix and authorized Company/Project. Create/edit/approve: only the separate workflow rights explicitly listed for this role; report/warehouse read never adds mutation rights.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** C01: supplied PM PDF gives full cost to Jai/Porn, conflicting with approved BOQ matrix. Additional warehouse list not specified.
- **Implementation classification:** partially implemented. BOQ disclosure, Company/Project read boundaries and salary-free basic HR operational employee projections exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** The exact authorized extra warehouse/report scope is not verified; full time/OT/leave operational screens are later HR scope; C01 broader Jai/Porn costs conflict with approved BOQ.
- **Recommended action:** Keep approved disclosure and source-only warehouse reads; configure only through separate authority and leave attendance/leave views in the HR lane.
- **Pinned implementation/configuration evidence:** [apps/api/src/budget/budget-disclosure.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/budget-disclosure.ts); [apps/api/src/inventory/stock-balance.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/stock-balance.service.ts); [apps/api/src/projects/project-access.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/projects/project-access.service.ts); [apps/api/src/hr/hr.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/hr/hr.service.ts)

## PM06 — Receive and decide anomalies

- **Stable ID:** PM06. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed.
- **Business need:** Receive and decide anomalies.
- **Expected workflow:** Store physically receives good/correct quantities; Jai checks supplied documents/photos/quantities; Khaimook approves GR and considers shortages affecting plan, wrong spec/substitution, excess PO quantities and damage/claim.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Actual partial receipts against current approved PO, configured approval, locked cumulative overreceipt checks and idempotent posting exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Provisional receipt without a PO, mandatory per-delivery evidence and an explicit Jai document-check handoff are not established by this contract.
- **Recommended action:** Separate provisional custody from posted stock; define evidence/completion gates and preserve accepted PO/GR behavior.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/goods-receipt.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/goods-receipt.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PM07 — Transfers and beyond-plan issue authority

- **Stable ID:** PM07. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Transfers and beyond-plan issue authority.
- **Expected workflow:** Approve each transfer; approve beyond-plan issues first level, escalating beyond authority to Ben before issue. Cross-MKE/TCJ transfers are requested.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** Beyond-plan criteria/limits and mixed-level decision rule; cross-Company stock ownership/Finance design.
- **Implementation classification:** partially implemented. Approved transfer atomically posts paired stock movements. validateWarehouses requires both warehouses in auth.companyId.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No separate dispatch/destination acknowledgment or cross-MKE/TCJ transfer contract.
- **Recommended action:** Keep same-Company atomic transfer; separately scope in-transit/receipt state and cross-Company ownership/Finance consequences.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/stock-transfer.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/stock-transfer.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PM08 — Stock count and approved adjustment

- **Stable ID:** PM08. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Stock count and approved adjustment.
- **Expected workflow:** Latest FM05: Store Site records count/evidence → Khaimook checks and approves physical adjustment; Foreman has no variance/proposal/approval authority in this workflow.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create/count evidence: Store Site. View/check/approve physical adjustment: Khaimook. Foreman: no variance entry, adjustment proposal or approval. Nancy: count scheduling; financial disposal authority remains separate.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** Older joint Foreman count / Nancy physical-count adjustment requirement.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal); S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** Financial disposal/write-off is separately unresolved (C03).
- **Implementation classification:** missing. Reviewed complete schema and inventory controller surface have balances/movements/reservations/issues/returns/transfers, without a canonical count session or count-adjustment endpoint.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Requested Store Site count/evidence → Khaimook approved adjustment is not implemented as a dedicated workflow.
- **Recommended action:** Propose a count/variance/append-only adjustment workflow; separate physical count adjustment from financial write-off.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/inventory/inventory.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory.controller.ts); [apps/api/src/inventory/material-movement.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-movement.controller.ts); [apps/api/src/inventory/inventory-report.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory-report.controller.ts)

## PM09 — Urgent incomplete-document material handling

- **Stable ID:** PM09. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Urgent incomplete-document material handling.
- **Expected workflow:** Khaimook may permit urgent material handling within approved budget with reason/evidence and later document completion; excess budget still uses PM03.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** Document completion deadline and specific reviewer. BEN02 general emergency limit remains unanswered and does not widen this route.
- **Implementation classification:** partially implemented. Issues validate quantities, dimensions, available stock and reservations; submit always starts MATERIAL_ISSUE approval and approve posts stock.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No approved-plan within-limit immediate-issue route, beyond-plan escalation thresholds or Foreman request record/signature contract.
- **Recommended action:** Build one approved-plan-to-request-to-issue package, retaining atomic ledger, replay and negative-stock controls.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/material-issue.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-issue.service.ts); [apps/api/src/inventory/material-movement.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-movement.controller.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts)

## PM10 — Subcontract agreement preparation

- **Stable ID:** PM10. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Subcontract agreement preparation.
- **Expected workflow:** Khaimook prepares scope/quantities/UOM/prices, milestones/payment/acceptance terms, start/end/delivery, advance/retention if applicable, delay/change clauses and attachments → Ben approves.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** configuration-only. Agreement and WO create/revise/submit/configured approvals exist; WO reuses an approved agreement and does not require a separate Work Request entity.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Khaimook maker/Ben approver and full requested commercial fields need retained configuration/field comparison.
- **Recommended action:** Reuse lifecycle; verify actor matrix without adding a duplicate Work Request.
- **Pinned implementation/configuration evidence:** [apps/api/src/subcontracts/subcontracts-workflow.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-workflow.service.ts); [apps/api/src/subcontracts/subcontracts-workflow.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-workflow.integration.spec.ts)

## PM11 — Work Order preparation

- **Stable ID:** PM11. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Work Order preparation.
- **Expected workflow:** Prepare WO from approved agreement → Ben approves; no separate Work Request prerequisite.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** configuration-only. Agreement and WO create/revise/submit/configured approvals exist; WO reuses an approved agreement and does not require a separate Work Request entity.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Khaimook maker/Ben approver and full requested commercial fields need retained configuration/field comparison.
- **Recommended action:** Reuse lifecycle; verify actor matrix without adding a duplicate Work Request.
- **Pinned implementation/configuration evidence:** [apps/api/src/subcontracts/subcontracts-workflow.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-workflow.service.ts); [apps/api/src/subcontracts/subcontracts-workflow.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-workflow.integration.spec.ts)

## PM12 — Physical work and certification handoff

- **Stable ID:** PM12. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Physical work and certification handoff.
- **Expected workflow:** Confirm actual quantities by item/area, progress, photos, acceptance/rework, prior/current/cumulative amounts → Ben approval → Porn certification → Nancy payment approval.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** Mapping to canonical Claim/Assessment/Certification must be agreed without a duplicate acceptance ledger.
- **Implementation classification:** partially implemented. Claims, retained monetary assessment and linked certifications exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No proven exact mapping of physical quantities/area acceptance by Khaimook → Ben approval → Porn certification. Assessment is not automatically that physical acceptance record.
- **Recommended action:** Publish a semantic mapping and extend canonical claims only as required; never create a parallel cost/claim ledger.
- **Pinned implementation/configuration evidence:** [apps/api/src/subcontracts/subcontracts-claims.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-claims.service.ts); [apps/api/src/subcontracts/subcontracts-certification.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-certification.service.ts); [apps/api/src/subcontracts/subcontracts-certification.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-certification.integration.spec.ts)

## PM13 — Material/work-method changes

- **Stable ID:** PM13. **Related existing IDs:** FND-004, FND-005
- **Intake change / decision:** changed / confirmed.
- **Business need:** Material/work-method changes.
- **Expected workflow:** Submit old-vs-new specification/quantity/price/cost difference, drawings/photos and schedule impact. Material to Jai; budget/scope to Ben; excess uses PM03; Project VO Ben → Nancy.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** configuration-only. Company-scoped configurable workflows and action capabilities exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Named business actors and exact current retained assignments are unverified; seed/demo actors are not operational configuration evidence.
- **Recommended action:** Produce a desired-vs-observed matrix from existing authorized receipts; do not grant/configure during assessment.
- **Pinned implementation/configuration evidence:** [apps/api/src/approval/approval.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/approval/approval.service.ts); [docs/ROLES-PERMISSIONS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/ROLES-PERMISSIONS.md); [deploy/uat/e2-readiness.mjs](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/deploy/uat/e2-readiness.mjs)

## PM14 — Actual-hour labour allocation

- **Stable ID:** PM14. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Actual-hour labour allocation.
- **Expected workflow:** Each site submits own time; sending site records small-job persons/work/date/interval. Allocate wages, additions and employer contributions by actual Project hours; employing Company pays then allocates across MKE/TCJ.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** Zero-hour basis, residual rounding, recognition/reversal and cross-Company posting are later design inputs; actual-hour principle is already confirmed.
- **Implementation classification:** missing. DPR manpower is aggregate headcount, not employee worked hours; ProjectMember is assignment only.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No employee-level time/submission/return/resubmit/overlap contract; outside current HR1-A slice.
- **Recommended action:** Keep current authorized HR1-A sequence; later propose actual-time foundation including small-job hours and non-overlap.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-ENTRY-PREPARATION.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-ENTRY-PREPARATION.md); [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md)

## PM15 — Cross-Project reports and alerts

- **Stable ID:** PM15. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Cross-Project reports and alerts.
- **Expected workflow:** Read PR pending/correction, stock shortage/late receipt/count adjustment, subcontract progress/WO/certification and tool due/overdue status across authorized MKE/TCJ Projects; this does not add transaction rights.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** Exact extra warehouses and actual grants.
- **Implementation classification:** partially implemented. Scoped quantity/movement and scheduling/lookahead read models exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Material/site minimum thresholds and approved-plan 14/7-day material demand alerts are not established.
- **Recommended action:** Define canonical thresholds and plan-driven notifications; avoid using schedule lookahead as stock availability proof.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/inventory-report.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory-report.service.ts); [apps/api/src/inventory/stock-balance.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/stock-balance.service.ts); [apps/api/src/scheduling/scheduling-progress.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/scheduling/scheduling-progress.service.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PM16 — Close-site preparation

- **Stable ID:** PM16. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Close-site preparation.
- **Expected workflow:** Check remaining material/returns/transfers, tool custody/condition, pending documents, subcontract/rework, petty cash and handover → joint Ben/Nancy closure per BEN04.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal); S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** Approval ordering and settlement-after-closure behavior.
- **Implementation classification:** missing. Project archive/reactivate changes isActive with audit.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Archive is not the six-category checklist, outstanding-item register and joint Ben/Nancy closure.
- **Recommended action:** Build an operational closure record, preserving unsettled Finance/stock obligations; decide whether archive should be separate.
- **Pinned implementation/configuration evidence:** [apps/api/src/projects/projects.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/projects/projects.service.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/projects/projects.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/projects/projects.controller.ts)

## PM-HR-01 — PM HR duties

- **Stable ID:** PM-HR-01. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed.
- **Business need:** PM HR duties.
- **Expected workflow:** Approve site-worker hiring; confirm site moves; create worker OT request → Koh → Ben; for Foreman own leave act in Foreman approval position → Koh → Ben. Site reports show headcount/time without wage rates.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal); S8: Pinned HR1-A entry contract / DEC-039 / issue 283.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** missing. Leave/OT policies are recorded in the HR source; explicitly excluded from HR1-A implementation.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No leave/OT request/balance/actual-time ledger in this schema.
- **Recommended action:** Deliver only via subsequent approved HR slice; preserve all confirmed policies and ask only stage-relevant unresolved details.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md); [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md)

## PM-CASH-01 — Field-central petty cash custody

- **Stable ID:** PM-CASH-01. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Field-central petty cash custody.
- **Expected workflow:** Hold field-central fund, pay/record approved expenses, review site requests for Project relevance before Nancy approval.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal); S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** Alternate reviewer for Khaimook own requests and fund replenishment/limits.
- **Implementation classification:** missing. Payment exists, but the reviewed schema/Finance surface has no fund/custodian/replenishment/petty-cash request ledger.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Nancy main fund, Khaimook field-central fund, site funds and Store→Khaimook→Nancy route lack dedicated implementation.
- **Recommended action:** Scope fund balance, request/review/approval/payment/evidence and reconciliation together; decide substitute reviewer for Khaimook own requests.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts); [apps/api/src/finance/finance.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.controller.ts)