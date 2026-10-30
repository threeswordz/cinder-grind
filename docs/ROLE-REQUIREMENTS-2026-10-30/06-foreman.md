# Foreman — Site Foreman

> **Current execution precedence — Owner #288, 30 October 2026:** Accounting development is deferred; HR1-A #283 keeps its existing designated writer. The original L0/L1/L2 values below are **historical workflow risk flags**, not a current coding order. Read [13-execution-disposition.md](13-execution-disposition.md) and [11-launch-scope-and-next-package.md](11-launch-scope-and-next-package.md) before selecting new work. Existing BOQ/operational/Finance controls and the approved scoped HR privacy matrix remain intact; this document is not new implementation or Production authority.


**Prepared:** 30 October 2026, Asia/Singapore. **Assessment baseline:** `4fd3635ed06510dc4759e00061cfc92d6cbad2bc`.

This is a reconciled business-requirements and source-assessment record, not a statement that every requirement is implemented, configured, accepted or approved for Production. Named people identify business functions, not hard-coded authorization checks.

- **Intake change:** new / changed / confirmed existing is relative to the 24 October seven-role baseline (S1); it is independent of implementation status. New editorial IDs are traceability labels, not invented original question IDs.
- Existing question IDs and enterprise IDs are retained. Related IDs link shared responsibilities; they are not automatically equivalent implementation contracts.
- **Historical risk flag (not current build priority):** L0 = before relying on the affected financial/stock/security workflow; L1 = before full role workflow use, or a separately accepted pilot workaround; L2 = deferred/conditional next scope. These priorities do not authorize implementation.
- Permission/configuration activation is unverified in this assessment. Accepted V1.2/BOQ evidence stays closed; only materially changed paths need new verification.
- Cross-role authority is in [00-shared-workflows.md](00-shared-workflows.md); sources/contradictions are in [12-decisions-and-sources.md](12-decisions-and-sources.md).

**Historical persona label:** PROJECT_ENGINEER. This is not proof of live permissions.

## Requirement index

| ID | Requirement | Intake change | Decision | Implementation observation | Original risk flag |
| --- | --- | --- | --- | --- | --- |
| FM01 | Daily work reports and weekly summary | changed | confirmed | partially implemented | L1 |
| FM02 | Measurable and milestone progress | changed | confirmed with open detail | partially implemented | L1 |
| FM03 | Issue ownership and severe escalation | changed | confirmed | partially implemented | L1 |
| FM04 | Material request through Store | changed | confirmed | partially implemented | L0 |
| FM05 | No stock-count adjustment authority | changed | confirmed | missing | L0 |
| FM-HR-01 | Foreman leave role and salary-free view | confirmed existing | confirmed | missing | L2 |

## FM01 — Daily work reports and weekly summary

- **Stable ID:** FM01. **Related existing IDs:** FM01.1, FM01.2
- **Intake change / decision:** changed / confirmed.
- **Business need:** Daily work reports and weekly summary.
- **Expected workflow:** Record dates/work/activity/actual progress and evidence, send before next workday starts; ERP weekly summary; Ben reviews without formal approval. Report a no-work day only if it was planned as a workday, not ordinary site holidays. Append reasoned corrections retaining original/actor/time.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** A planned day stopped by rain needs a no-work reason; ordinary weekly site holiday does not need a no-work report.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. DPR stores dated work/progress/evidence, submits without a business approval, and appends corrections.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Before-next-workday deadline, stopped-planned-day reporting and weekly summary/Ben review acknowledgment are not a complete configured workflow.
- **Recommended action:** Preserve immutable DPR/corrections; add bounded operational deadline/summary behavior without financial posting.
- **Pinned implementation/configuration evidence:** [apps/api/src/site-execution/site-execution.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/site-execution/site-execution.service.ts); [apps/api/src/site-execution/site-execution.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/site-execution/site-execution.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## FM02 — Measurable and milestone progress

- **Stable ID:** FM02. **Related existing IDs:** FM02.1
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Measurable and milestone progress.
- **Expected workflow:** Use actual quantities vs BOQ where measurable, otherwise milestones/reasoned assessment. Define each work weight in the work plan, confirmed by Ben, for whole-Project progress.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Works with Ben-confirmed weights 60/40 and progress 50%/25% yield 40% overall; m2 and kg are never directly summed.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** Versioned weight total, source mapping/duplicate-contribution and missing-progress treatment require design, not a repeat of the weighting-method question.
- **Implementation classification:** partially implemented. Append-only Activity percentComplete/progress and schedule baselines exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Owner-confirmed plan work weights, Ben confirmation and project roll-up are not established; quantity-vs-milestone source mapping needs a bounded design.
- **Recommended action:** Version approved weights; prevent mixed-unit sums and duplicate contribution; leave accepted BOQ calculations untouched.
- **Pinned implementation/configuration evidence:** [apps/api/src/scheduling/scheduling-progress.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/scheduling/scheduling-progress.service.ts); [apps/api/src/site-execution/site-execution.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/site-execution/site-execution.service.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## FM03 — Issue ownership and severe escalation

- **Stable ID:** FM03. **Related existing IDs:** FM03.1, FM03.2, FM03.3, FM03.4
- **Intake change / decision:** changed / confirmed.
- **Business need:** Issue ownership and severe escalation.
- **Expected workflow:** Foreman reports → Khaimook follows up → Foreman verifies result → Khaimook closes. Safety and quality issues affecting cost/delivery are severe. Khaimook assesses asset loss/damage severity before Ben escalation. Every work stoppage or delivery-delay risk goes to Ben immediately by phone/message plus ERP alert.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** A short stoppage is escalated immediately; an asset loss first reaches Khaimook for severity assessment. Closing requires the recorded Foreman verification then Khaimook closure.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. SiteIssueInput and DailySiteReportIssue store activity, issue text and remarks.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No explicit Khaimook owner/follow-up → Foreman verification → Khaimook close state machine or ERP severity notifications in that contract.
- **Recommended action:** Reuse report linkage and evidence; add auditable issue state/notification behavior; physical phone/chat remains outside ERP.
- **Pinned implementation/configuration evidence:** [apps/api/src/site-execution/site-execution.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/site-execution/site-execution.service.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## FM04 — Material request through Store

- **Stable ID:** FM04. **Related existing IDs:** FM04.1
- **Intake change / decision:** changed / confirmed.
- **Business need:** Material request through Store.
- **Expected workflow:** Foreman requests orally/chat → Store Site records request in ERP; receiver signs; Foreman does not create PR.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** A chat request becomes one Store-recorded material request linked to actual issue, not a second Foreman PR.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S6: Owner answers in this conversation, through 30 October 2026; [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Issues validate quantities, dimensions, available stock and reservations; submit always starts MATERIAL_ISSUE approval and approve posts stock.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No approved-plan within-limit immediate-issue route, beyond-plan escalation thresholds or Foreman request record/signature contract.
- **Recommended action:** Build one approved-plan-to-request-to-issue package, retaining atomic ledger, replay and negative-stock controls.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/material-issue.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-issue.service.ts); [apps/api/src/inventory/material-movement.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-movement.controller.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts)

## FM05 — No stock-count adjustment authority

- **Stable ID:** FM05. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed.
- **Business need:** No stock-count adjustment authority.
- **Expected workflow:** Store Site owns count recording/evidence and Khaimook physical-adjustment approval. Foreman cannot record variances, propose adjustments or approve adjustments in that workflow.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create/count evidence: Store Site. View/check/approve physical adjustment: Khaimook. Foreman: no variance entry, adjustment proposal or approval. Nancy: count scheduling; financial disposal authority remains separate.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** A Foreman calling the count variance or approval route is denied even if the UI button is manually exposed.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** Earlier S2/S3 joint count with Foreman / Nancy physical-adjustment route.
- **Source:** S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** missing. Reviewed complete schema and inventory controller surface have balances/movements/reservations/issues/returns/transfers, without a canonical count session or count-adjustment endpoint.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Requested Store Site count/evidence → Khaimook approved adjustment is not implemented as a dedicated workflow.
- **Recommended action:** Propose a count/variance/append-only adjustment workflow; separate physical count adjustment from financial write-off.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/inventory/inventory.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory.controller.ts); [apps/api/src/inventory/material-movement.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-movement.controller.ts); [apps/api/src/inventory/inventory-report.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory-report.controller.ts)

## FM-HR-01 — Foreman leave role and salary-free view

- **Stable ID:** FM-HR-01. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Foreman leave role and salary-free view.
- **Expected workflow:** Approve ordinary worker leave from Store before Koh final approval. Foreman own leave goes Khaimook → Koh → Ben. Read authorized site headcount/time without wages or private identity/bank data.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); S8: Pinned HR1-A entry contract / DEC-039 / issue 283.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** missing. Leave/OT policies are recorded in the HR source; explicitly excluded from HR1-A implementation.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No leave/OT request/balance/actual-time ledger in this schema.
- **Recommended action:** Deliver only via subsequent approved HR slice; preserve all confirmed policies and ask only stage-relevant unresolved details.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md); [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md)