# Ben — GM / Management

> **Current execution precedence — Owner #288, 30 October 2026:** Accounting development is deferred; HR1-A #283 keeps its existing designated writer. The original L0/L1/L2 values below are **historical workflow risk flags**, not a current coding order. Read [13-execution-disposition.md](13-execution-disposition.md) and [11-launch-scope-and-next-package.md](11-launch-scope-and-next-package.md) before selecting new work. Existing BOQ/operational/Finance controls and the approved scoped HR privacy matrix remain intact; this document is not new implementation or Production authority.


**Prepared:** 30 October 2026, Asia/Singapore. **Assessment baseline:** `4fd3635ed06510dc4759e00061cfc92d6cbad2bc`.

This is a reconciled business-requirements and source-assessment record, not a statement that every requirement is implemented, configured, accepted or approved for Production. Named people identify business functions, not hard-coded authorization checks.

- **Intake change:** new / changed / confirmed existing is relative to the 24 October seven-role baseline (S1); it is independent of implementation status. New editorial IDs are traceability labels, not invented original question IDs.
- Existing question IDs and enterprise IDs are retained. Related IDs link shared responsibilities; they are not automatically equivalent implementation contracts.
- **Historical risk flag (not current build priority):** L0 = before relying on the affected financial/stock/security workflow; L1 = before full role workflow use, or a separately accepted pilot workaround; L2 = deferred/conditional next scope. These priorities do not authorize implementation.
- Permission/configuration activation is unverified in this assessment. Accepted V1.2/BOQ evidence stays closed; only materially changed paths need new verification.
- Cross-role authority is in [00-shared-workflows.md](00-shared-workflows.md); sources/contradictions are in [12-decisions-and-sources.md](12-decisions-and-sources.md).

**Historical persona label:** MANAGEMENT. This is not proof of live permissions.

## Requirement index

| ID | Requirement | Intake change | Decision | Implementation observation | Original risk flag |
| --- | --- | --- | --- | --- | --- |
| BEN01 | No delegate approver | changed | confirmed | configuration-only | L0 |
| BEN02 | Emergency before prior approval | changed | confirmed with open detail | unverified | L0 |
| BEN03 | Block over-budget commitments and costs | changed | confirmed with open detail | partially implemented | L0 |
| BEN04 | Joint controlled Project closure | changed | confirmed with open detail | missing | L1 |
| BEN-BASE-01 | PO approval and revised commitments | confirmed existing | confirmed | partially implemented | L0 |
| BEN-BASE-02 | Subcontract agreement and WO approval | confirmed existing | confirmed | configuration-only | L0 |
| BEN-BASE-03 | Subcontract physical work acceptance | confirmed existing | confirmed | partially implemented | L0 |
| BEN-BASE-04 | Separate cost and customer BOQ authority | confirmed existing | confirmed | implemented | L0 |
| BEN-BASE-05 | Project VO and budget revision | confirmed existing | confirmed | configuration-only | L0 |
| BEN-BASE-06 | Customer quotation and progress billing | confirmed existing | confirmed with open detail | partially implemented | L0 |
| BEN-BASE-07 | Management source-derived dashboard | confirmed existing | confirmed | implemented | L1 |
| BEN-HR-01 | Ben HR handoffs | new | confirmed with open detail | missing | L2 |

## BEN01 — No delegate approver

- **Stable ID:** BEN01. **Related existing IDs:** FND-004, FND-005
- **Intake change / decision:** changed / confirmed.
- **Business need:** No delegate approver.
- **Expected workflow:** No alternate approver acts for Ben during absence.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** When Ben is absent, another user receives no approval authority merely because of the absence.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** S1 absence/substitute discussion; does not settle substitute approvers for other roles.
- **Source:** S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** configuration-only. Company-scoped configurable workflows and action capabilities exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Named business actors and exact current retained assignments are unverified; seed/demo actors are not operational configuration evidence.
- **Recommended action:** Produce a desired-vs-observed matrix from existing authorized receipts; do not grant/configure during assessment.
- **Pinned implementation/configuration evidence:** [apps/api/src/approval/approval.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/approval/approval.service.ts); [docs/ROLES-PERMISSIONS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/ROLES-PERMISSIONS.md); [deploy/uat/e2-readiness.mjs](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/deploy/uat/e2-readiness.mjs)

## BEN02 — Emergency before prior approval

- **Stable ID:** BEN02. **Related existing IDs:** BEN02.1, BEN02.2, BEN02.3
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Emergency before prior approval.
- **Expected workflow:** Allow safety protection, prevention of asset/material/machinery damage, and site stoppage response with reasons/evidence; Ben checks work retrospectively, then Nancy checks finance.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** An emergency reason preserves the record and both retrospective checks; an unanswered cap is never treated as unlimited authority.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** BEN02.2: per-event/category spending limit and whether exceeding the approved budget is permitted remain unselected. Document-type boundaries and audit completion deadline need a bounded implementation contract.
- **Implementation classification:** unverified. Only historical requirement evidence is available for this specific detail.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No current operational configuration or end-to-end evidence supplied.
- **Recommended action:** Retain as unverified; inspect the named feature/configuration when selecting the implementation package.
- **Pinned implementation/configuration evidence:** [docs/REQUIREMENTS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/REQUIREMENTS.md)

## BEN03 — Block over-budget commitments and costs

- **Stable ID:** BEN03. **Related existing IDs:** BEN03.1, BEN03.2, COST-003, COST-004, COST-005
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Block over-budget commitments and costs.
- **Expected workflow:** Warn and block over-budget PO/revisions, subcontract/WO/revisions and expenses without PO/WO until approved; compare both BOQ/category/item and whole-Project budgets; never auto-change original budget.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** A PO within total Project budget but over its item/category allowance is blocked; two concurrent commitments cannot both consume the same headroom.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S6: Owner answers in this conversation, through 30 October 2026; [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** Confirm budget-availability basis, cost-code/BOQ category mapping, VAT/freight basis, reservation/release and exception decision semantics. The selected stages/dual levels are already settled.
- **Implementation classification:** partially implemented. Approved budget snapshots and current agreement commercial ceilings exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Reviewed PO/subcontract/direct-cost services do not enforce the requested combined BOQ/category/project budget guard before authorization; agreement ceiling is not a Project budget.
- **Recommended action:** Propose a shared budget-availability contract, reservations/concurrency and explicit approvals for over-budget changes; no invented amount basis.
- **Pinned implementation/configuration evidence:** [apps/api/src/budget/budget.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/budget.service.ts); [apps/api/src/procurement/purchase-order.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.service.ts); [apps/api/src/subcontracts/subcontracts-workflow.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-workflow.service.ts); [apps/api/src/cost-control/direct-cost.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/cost-control/direct-cost.service.ts)

## BEN04 — Joint controlled Project closure

- **Stable ID:** BEN04. **Related existing IDs:** BEN04.1
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Joint controlled Project closure.
- **Expected workflow:** Khaimook checks completion; Ben and Nancy jointly approve. Check work/acceptance, PO/contracts, AP/AR/payments, stock/tools/assets, BOQ/VO/cost, and handover documents. Warnings permit closure with reason, remaining item/amount/quantity, owner and due date.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** A Project with an unpaid invoice can close only with warning acknowledgment, reason, outstanding amount, follow-up owner, due date and both approvals; debt is not erased.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S6: Owner answers in this conversation, through 30 October 2026; [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** Sequence of joint approval and relationship between operational closure, archive and later settlement of outstanding obligations remain design inputs.
- **Implementation classification:** missing. Project archive/reactivate changes isActive with audit.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Archive is not the six-category checklist, outstanding-item register and joint Ben/Nancy closure.
- **Recommended action:** Build an operational closure record, preserving unsettled Finance/stock obligations; decide whether archive should be separate.
- **Pinned implementation/configuration evidence:** [apps/api/src/projects/projects.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/projects/projects.service.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/projects/projects.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/projects/projects.controller.ts)

## BEN-BASE-01 — PO approval and revised commitments

- **Stable ID:** BEN-BASE-01. **Related existing IDs:** PUR05, PUR10
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** PO approval and revised commitments.
- **Expected workflow:** Jai prepares PO → Ben approves; revised PO has reason/history and renewed approval before dispatch; cancellation request Jai → Khaimook review → Ben.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Award-backed POs have one projectId, immutable revisions, configured approval and downstream receipt/invoice guards.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Multi-Project allocation, full commercial charge/credit/delivery amendments and routed cancellation review exceed the present contract.
- **Recommended action:** Preserve single-Project workflow; assess bounded commercial/revision work; keep #245 explicitly deferred until Finance change control.
- **Pinned implementation/configuration evidence:** [apps/api/src/procurement/purchase-order.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## BEN-BASE-02 — Subcontract agreement and WO approval

- **Stable ID:** BEN-BASE-02. **Related existing IDs:** PM10, PM11
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Subcontract agreement and WO approval.
- **Expected workflow:** Khaimook prepares agreement and WO from approved agreement → Ben approves each; no separate prerequisite Work Request.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** Earlier proposal assigning subcontract preparation to Purchasing and requiring Work Request.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** configuration-only. Agreement and WO create/revise/submit/configured approvals exist; WO reuses an approved agreement and does not require a separate Work Request entity.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Khaimook maker/Ben approver and full requested commercial fields need retained configuration/field comparison.
- **Recommended action:** Reuse lifecycle; verify actor matrix without adding a duplicate Work Request.
- **Pinned implementation/configuration evidence:** [apps/api/src/subcontracts/subcontracts-workflow.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-workflow.service.ts); [apps/api/src/subcontracts/subcontracts-workflow.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-workflow.integration.spec.ts)

## BEN-BASE-03 — Subcontract physical work acceptance

- **Stable ID:** BEN-BASE-03. **Related existing IDs:** PM12
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Subcontract physical work acceptance.
- **Expected workflow:** Khaimook verifies quantities/evidence and prepares acceptance → Ben approves → Porn prepares certification → Nancy approves payment.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Claims, retained monetary assessment and linked certifications exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No proven exact mapping of physical quantities/area acceptance by Khaimook → Ben approval → Porn certification. Assessment is not automatically that physical acceptance record.
- **Recommended action:** Publish a semantic mapping and extend canonical claims only as required; never create a parallel cost/claim ledger.
- **Pinned implementation/configuration evidence:** [apps/api/src/subcontracts/subcontracts-claims.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-claims.service.ts); [apps/api/src/subcontracts/subcontracts-certification.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-certification.service.ts); [apps/api/src/subcontracts/subcontracts-certification.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/subcontracts/subcontracts-certification.integration.spec.ts)

## BEN-BASE-04 — Separate cost and customer BOQ authority

- **Stable ID:** BEN-BASE-04. **Related existing IDs:** BUD-011, BUD-012, BUD-013, BUD-014, BUD-015, BUD-016, BUD-011, BUD-012, BUD-013, BUD-014, BUD-015, BUD-016
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Separate cost and customer BOQ authority.
- **Expected workflow:** Ben prepares initial/revised Internal Cost BOQ → Khaimook approves; Ben prepares Customer BOQ → Nancy approves. Preserve original/revision/source history and approved commercial calculations.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); S7: Pinned approved repository BOQ scope and DEC-034/037/038.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** implemented. Linked customer versions, cost snapshots and disclosure were delivered/accepted under BUD-011–016. Use release evidence with its retained-fixture limits.
- **Configuration evidence:** accepted V1.3 recorded configuration evidence retained; no new grant or full-current-runtime capture asserted.
- **Observed gap:** Older supplied PDF says full cost for Jai/Porn, conflicting with the approved matrix. No new defect in accepted BOQ behavior is asserted.
- **Recommended action:** Preserve accepted matrix and acceptance; record the broader-access request as a conflict requiring explicit change control.
- **Pinned implementation/configuration evidence:** [docs/V1.3-RELEASE-EXIT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/V1.3-RELEASE-EXIT.md); [docs/BOQ-COMMERCIAL-SCOPE.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/BOQ-COMMERCIAL-SCOPE.md); [apps/api/src/budget/budget.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/budget.service.ts); [apps/api/src/budget/customer-boq.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/customer-boq.service.ts); [apps/api/src/budget/budget-disclosure.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/budget-disclosure.ts)

## BEN-BASE-05 — Project VO and budget revision

- **Stable ID:** BEN-BASE-05. **Related existing IDs:** FND-004, FND-005
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Project VO and budget revision.
- **Expected workflow:** Ben prepares Project VO/budget revision → Nancy approves under the appropriate canonical lifecycle.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** Historical UAT arrangement Khaimook → Ben for VO is not the latest business route.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** configuration-only. Company-scoped configurable workflows and action capabilities exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Named business actors and exact current retained assignments are unverified; seed/demo actors are not operational configuration evidence.
- **Recommended action:** Produce a desired-vs-observed matrix from existing authorized receipts; do not grant/configure during assessment.
- **Pinned implementation/configuration evidence:** [apps/api/src/approval/approval.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/approval/approval.service.ts); [docs/ROLES-PERMISSIONS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/ROLES-PERMISSIONS.md); [deploy/uat/e2-readiness.mjs](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/deploy/uat/e2-readiness.mjs)

## BEN-BASE-06 — Customer quotation and progress billing

- **Stable ID:** BEN-BASE-06. **Related existing IDs:** FIN-004, FIN-013
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Customer quotation and progress billing.
- **Expected workflow:** Ben prepares quotation/revised price/discount → Nancy approves before dispatch. Ben confirms performed work and calculates progress billing → Porn issues/sends billing document without a separate billing approval.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal).
- **Unresolved questions/design inputs:** C02: distinguish commercial billing document from financial Client Invoice approval; ACC13–17 remain open.
- **Implementation classification:** partially implemented. Client Invoice has draft/submission/financial approval and AR balances.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No distinct Ben-confirmed progress billing handoff/dispatch or customer quotation lifecycle; no-extra billing approval cannot silently bypass Finance approval.
- **Recommended action:** Separate commercial billing confirmation from financial posting, reconcile ACC13–17 before new billing behavior.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/client-invoice.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/client-invoice.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## BEN-BASE-07 — Management source-derived dashboard

- **Stable ID:** BEN-BASE-07. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Management source-derived dashboard.
- **Expected workflow:** View budgets, commitments, Actual Cost, Paid Cost, contract values and approved changes; review Foreman reports without formal approval.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Budget, commitment, actual and paid remain distinct; a site progress entry does not post a financial cost.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** implemented. Management projectSummary/projectReport derive budget, commitments, Actual, Paid and commercial measures from canonical sources; finance-safe Project summary is distinct from BOQ detail.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Actual role assignments remain outside this source-only assessment; no new defect in accepted source-derived dashboards is asserted.
- **Recommended action:** Reuse accepted reporting with its disclosure/scope policies; assess only newly changed consumers.
- **Pinned implementation/configuration evidence:** [apps/api/src/management/management.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/management/management.service.ts); [apps/api/src/management/management.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/management/management.integration.spec.ts); [apps/api/src/budget/project-summary.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/project-summary.service.ts)

## BEN-HR-01 — Ben HR handoffs

- **Stable ID:** BEN-HR-01. **Related existing IDs:** HR-001
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Ben HR handoffs.
- **Expected workflow:** Approve office hires, effective-dated wage/rate/addition/leave-right changes and OT/leave along confirmed HR routes; wage visibility is a later HR-stage requirement, not identity/bank access.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); S8: Pinned HR1-A entry contract / DEC-039 / issue 283.
- **Unresolved questions/design inputs:** Implement later compensation/OT/leave slices only after their scope gates; do not broaden current HR1-A private-data matrix.
- **Implementation classification:** missing. Leave/OT policies are recorded in the HR source; explicitly excluded from HR1-A implementation.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No leave/OT request/balance/actual-time ledger in this schema.
- **Recommended action:** Deliver only via subsequent approved HR slice; preserve all confirmed policies and ask only stage-relevant unresolved details.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md); [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md)