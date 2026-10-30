# Porn (คุณพร) — Accounting

> **Current execution precedence — Owner #288, 30 October 2026:** Accounting development is deferred; HR1-A #283 keeps its existing designated writer. The original L0/L1/L2 values below are **historical workflow risk flags**, not a current coding order. Read [13-execution-disposition.md](13-execution-disposition.md) and [11-launch-scope-and-next-package.md](11-launch-scope-and-next-package.md) before selecting new work. Existing BOQ/operational/Finance controls and the approved scoped HR privacy matrix remain intact; this document is not new implementation or Production authority.


**Prepared:** 30 October 2026, Asia/Singapore. **Assessment baseline:** `4fd3635ed06510dc4759e00061cfc92d6cbad2bc`.

This is a reconciled business-requirements and source-assessment record, not a statement that every requirement is implemented, configured, accepted or approved for Production. Named people identify business functions, not hard-coded authorization checks.

- **Intake change:** new / changed / confirmed existing is relative to the 24 October seven-role baseline (S1); it is independent of implementation status. New editorial IDs are traceability labels, not invented original question IDs.
- Existing question IDs and enterprise IDs are retained. Related IDs link shared responsibilities; they are not automatically equivalent implementation contracts.
- **Historical risk flag (not current build priority):** L0 = before relying on the affected financial/stock/security workflow; L1 = before full role workflow use, or a separately accepted pilot workaround; L2 = deferred/conditional next scope. These priorities do not authorize implementation.
- Permission/configuration activation is unverified in this assessment. Accepted V1.2/BOQ evidence stays closed; only materially changed paths need new verification.
- Cross-role authority is in [00-shared-workflows.md](00-shared-workflows.md); sources/contradictions are in [12-decisions-and-sources.md](12-decisions-and-sources.md).

**Historical persona label:** FINANCE_OFFICER. This is not proof of live permissions.

**DEFERRED ACCOUNTING REFERENCE under #288.** No new AP/AR, payments, cheques, banking, GL, tax, depreciation or payroll-to-Finance work. Preserve existing subcontract certification and BOQ disclosure plus the approved narrow HR1-A bank-read; no grant change.

## Requirement index

| ID | Requirement | Intake change | Decision | Implementation observation | Original risk flag |
| --- | --- | --- | --- | --- | --- |
| ACC01 | Accounting scope | confirmed existing | confirmed with open detail | missing | L0 |
| ACC02 | AP invoice preparation | confirmed existing | confirmed | partially implemented | L0 |
| ACC03 | Mismatch hold and correction | confirmed existing | confirmed with open detail | partially implemented | L0 |
| ACC04 | Payment preparation/approval/execution | confirmed existing | confirmed with open detail | partially implemented | L0 |
| ACC05 | Payment channels | confirmed existing | confirmed with open detail | partially implemented | L0 |
| ACC06 | Cheque signature | confirmed existing | confirmed | missing | L0 |
| ACC07 | Fund custodians | confirmed existing | confirmed with open detail | missing | L0 |
| ACC08 | Cheque tracking by Porn | confirmed existing | confirmed | missing | L0 |
| ACC09 | Supplier/expense payment schedule | confirmed existing | confirmed with open detail | unverified | L1 |
| ACC10 | Supplier deposits/advances | confirmed existing | confirmed with open detail | partially implemented | L1 |
| ACC11 | Partial AP settlement | confirmed existing | confirmed with open detail | partially implemented | L0 |
| ACC12 | Bank reconciliation | confirmed existing | confirmed with open detail | missing | L0 |
| ACC13 | Customer billing actors | new | pending question / choices not approved | partially implemented | L0 |
| ACC14 | Progress-billing support | new | pending question / choices not approved | partially implemented | L1 |
| ACC15 | Customer collection types | new | pending question / choices not approved | partially implemented | L1 |
| ACC16 | Receipt evidence and AR settlement actors | new | pending question / choices not approved | partially implemented | L0 |
| ACC17 | AR follow-up | new | pending question / choices not approved | partially implemented | L1 |
| PORN-SUB-01 | Subcontract certification preparation | confirmed existing | confirmed | partially implemented | L0 |
| PORN-BOQ-01 | Safe financial totals only | confirmed existing | confirmed core; conflicting disclosure source | implemented | L0 |
| PORN-HR-01 | Payroll transfer preparation and bank visibility | new | confirmed | partially implemented | L2 |

## ACC01 — Accounting scope

- **Stable ID:** ACC01. **Related existing IDs:** FIN-001, FIN-004
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Accounting scope.
- **Expected workflow:** ERP requested to cover AP, AR, cash receipt/payment and General Ledger; external accounting office checks and prepares financial statements.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** GL/posting/tax/export scope and pilot accounting boundary need explicit approval.
- **Implementation classification:** missing. AP/AR/payments and DirectCostPosting exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No general-ledger chart/journal/period-close/trial-balance or complete statutory accounting handoff in the reviewed model/API surface.
- **Recommended action:** Explicitly choose ERP operational subledger plus reconciled external accounting for pilot, or separately approve GL scope; never label cost posting as GL.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/finance/finance.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.controller.ts); [apps/api/src/cost-control/direct-cost.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/cost-control/direct-cost.service.ts)

## ACC02 — AP invoice preparation

- **Stable ID:** ACC02. **Related existing IDs:** FIN-001, FIN-012
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** AP invoice preparation.
- **Expected workflow:** Jai sends document packet → Porn checks and records supplier invoice/tax invoice to establish AP; Nancy approves under existing recorded route.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. AP invoices retain PO/GR sources, scope, totals, approval and idempotency.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No complete owner-requested mismatch hold → Jai correction → Porn recheck workflow/three-way matching tolerance established.
- **Recommended action:** Map discrepancy items/holds and payment eligibility; preserve existing currency/source validation.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/finance.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## ACC03 — Mismatch hold and correction

- **Stable ID:** ACC03. **Related existing IDs:** FIN-001, FIN-012
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Mismatch hold and correction.
- **Expected workflow:** Hold mismatched quantities/prices against PO/receipt → Jai coordinates correction → Porn rechecks before payment.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** Matching tolerance and hold-release evidence need a scoped design; do not guess tolerance.
- **Implementation classification:** partially implemented. AP invoices retain PO/GR sources, scope, totals, approval and idempotency.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No complete owner-requested mismatch hold → Jai correction → Porn recheck workflow/three-way matching tolerance established.
- **Recommended action:** Map discrepancy items/holds and payment eligibility; preserve existing currency/source validation.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/finance.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## ACC04 — Payment preparation/approval/execution

- **Stable ID:** ACC04. **Related existing IDs:** FIN-006, FIN-007, FIN-014
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Payment preparation/approval/execution.
- **Expected workflow:** Porn prepares payment → Nancy approves; Porn executes cheque handover/payment; Nancy executes bank transfer.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** Actual execution vs approval and channel authorization contract.
- **Implementation classification:** partially implemented. Payments allocate approved AP/AR/subcontract balances, support partial allocation and guarded approval/cancellation.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Approval and actual bank execution/clearance are not separate persisted lifecycles; paymentMethod/reference free text does not establish channel authority.
- **Recommended action:** Define approved vs actually executed/cleared states and evidence before banking replacement; do not reinterpret historic approved payments silently.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## ACC05 — Payment channels

- **Stable ID:** ACC05. **Related existing IDs:** FIN-006, FIN-007, FIN-014
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Payment channels.
- **Expected workflow:** Support bank transfer, cheque, cash/petty cash and director/employee expense reimbursement.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** Per-channel settlement/evidence and reimbursement source contract.
- **Implementation classification:** partially implemented. Payments allocate approved AP/AR/subcontract balances, support partial allocation and guarded approval/cancellation.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Approval and actual bank execution/clearance are not separate persisted lifecycles; paymentMethod/reference free text does not establish channel authority.
- **Recommended action:** Define approved vs actually executed/cleared states and evidence before banking replacement; do not reinterpret historic approved payments silently.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## ACC06 — Cheque signature

- **Stable ID:** ACC06. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Cheque signature.
- **Expected workflow:** Ben signs cheques prepared/handled by Porn.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** missing. Payment has generic method/reference and lifecycle states.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No structured cheque number/bank/account/signature/delivery/clearance/return/reissue lifecycle.
- **Recommended action:** Scope cheque instrument and immutable settlement linkage; Ben signature, Porn status maintenance, Nancy financial approval.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts)

## ACC07 — Fund custodians

- **Stable ID:** ACC07. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Fund custodians.
- **Expected workflow:** Nancy main fund; Khaimook field-central fund; Store each site fund. Custodian pays and records evidence after approved route.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** Fund caps/replenishment and review of own-custodian requests.
- **Implementation classification:** missing. Payment exists, but the reviewed schema/Finance surface has no fund/custodian/replenishment/petty-cash request ledger.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Nancy main fund, Khaimook field-central fund, site funds and Store→Khaimook→Nancy route lack dedicated implementation.
- **Recommended action:** Scope fund balance, request/review/approval/payment/evidence and reconciliation together; decide substitute reviewer for Khaimook own requests.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts); [apps/api/src/finance/finance.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.controller.ts)

## ACC08 — Cheque tracking by Porn

- **Stable ID:** ACC08. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Cheque tracking by Porn.
- **Expected workflow:** Porn tracks number/bank/account/amount/date, payee/AP link, prepared-awaiting-signature, signed-awaiting-delivery, delivered with receiver proof, bank-cleared/date, returned/cancelled/reissued with reasons/linkage.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** missing. Payment has generic method/reference and lifecycle states.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No structured cheque number/bank/account/signature/delivery/clearance/return/reissue lifecycle.
- **Recommended action:** Scope cheque instrument and immutable settlement linkage; Ben signature, Porn status maintenance, Nancy financial approval.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts)

## ACC09 — Supplier/expense payment schedule

- **Stable ID:** ACC09. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Supplier/expense payment schedule.
- **Expected workflow:** Use regular cycles plus due-date and urgent payment; specific schedule/cutoff/out-of-cycle approver awaits discussion.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** Regular dates, document cutoff and out-of-cycle/urgent approval remain unanswered; payroll cycles do not answer ACC09.
- **Implementation classification:** unverified. Only historical requirement evidence is available for this specific detail.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No current operational configuration or end-to-end evidence supplied.
- **Recommended action:** Retain as unverified; inspect the named feature/configuration when selecting the implementation package.
- **Pinned implementation/configuration evidence:** [docs/REQUIREMENTS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/REQUIREMENTS.md)

## ACC10 — Supplier deposits/advances

- **Stable ID:** ACC10. **Related existing IDs:** FIN-006, FIN-007, FIN-014
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Supplier deposits/advances.
- **Expected workflow:** Support with/without PO; require reason/reference evidence and track future application/deduction.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** Approval/recovery/refund and single source posting contract.
- **Implementation classification:** partially implemented. Payments allocate approved AP/AR/subcontract balances, support partial allocation and guarded approval/cancellation.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Approval and actual bank execution/clearance are not separate persisted lifecycles; paymentMethod/reference free text does not establish channel authority.
- **Recommended action:** Define approved vs actually executed/cleared states and evidence before banking replacement; do not reinterpret historic approved payments silently.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## ACC11 — Partial AP settlement

- **Stable ID:** ACC11. **Related existing IDs:** FIN-006, FIN-007, FIN-014
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Partial AP settlement.
- **Expected workflow:** Support agreed installments and extra partial-payment requests with distinct approval conditions; display debt, cumulative paid and remaining.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** Installment-vs-additional partial-payment approval conditions/actors remain unanswered.
- **Implementation classification:** partially implemented. Payments allocate approved AP/AR/subcontract balances, support partial allocation and guarded approval/cancellation.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Approval and actual bank execution/clearance are not separate persisted lifecycles; paymentMethod/reference free text does not establish channel authority.
- **Recommended action:** Define approved vs actually executed/cleared states and evidence before banking replacement; do not reinterpret historic approved payments silently.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## ACC12 — Bank reconciliation

- **Stable ID:** ACC12. **Related existing IDs:** FIN-010
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Bank reconciliation.
- **Expected workflow:** Porn reconciles ERP receipts/payments to bank statements → Nancy verifies.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** Frequency remains unanswered.
- **Implementation classification:** missing. Scoped cash-flow/payment data exists.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No bank statement/reconciliation session with Porn preparation and Nancy verification.
- **Recommended action:** Define statement import/matching/differences and accountant boundary; frequency remains an owner decision.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/finance/finance.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.controller.ts); [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts)

## ACC13 — Customer billing actors

- **Stable ID:** ACC13. **Related existing IDs:** FIN-004, FIN-013
- **Intake change / decision:** new / pending question / choices not approved.
- **Business need:** Customer billing actors.
- **Expected workflow:** Unanswered follow-up about preparer, approver and dispatcher of customer billing/invoices. Keep S1 Ben confirms → Porn issues without additional billing approval as an existing recorded rule until reconciled.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation; [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal).
- **Unresolved questions/design inputs:** ACC13 has not been answered; resolve C02 commercial billing vs financial invoice approval.
- **Implementation classification:** partially implemented. Client Invoice has draft/submission/financial approval and AR balances.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No distinct Ben-confirmed progress billing handoff/dispatch or customer quotation lifecycle; no-extra billing approval cannot silently bypass Finance approval.
- **Recommended action:** Separate commercial billing confirmation from financial posting, reconcile ACC13–17 before new billing behavior.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/client-invoice.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/client-invoice.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## ACC14 — Progress-billing support

- **Stable ID:** ACC14. **Related existing IDs:** FIN-004, FIN-013
- **Intake change / decision:** new / pending question / choices not approved.
- **Business need:** Progress-billing support.
- **Expected workflow:** Unanswered choices: approved contract/customer PO, installment terms/due date, current work quantities/value, customer acceptance, prior/cumulative/balance, advance/retention deductions and approved VO; data collector/verifier not selected.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** All ACC14 selections and responsible collector/verifier remain unanswered.
- **Implementation classification:** partially implemented. Client Invoice has draft/submission/financial approval and AR balances.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No distinct Ben-confirmed progress billing handoff/dispatch or customer quotation lifecycle; no-extra billing approval cannot silently bypass Finance approval.
- **Recommended action:** Separate commercial billing confirmation from financial posting, reconcile ACC13–17 before new billing behavior.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/client-invoice.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/client-invoice.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## ACC15 — Customer collection types

- **Stable ID:** ACC15. **Related existing IDs:** FIN-004, FIN-013
- **Intake change / decision:** new / pending question / choices not approved.
- **Business need:** Customer collection types.
- **Expected workflow:** Unanswered choices: deposit/advance, actual progress, fixed installment, approved VO, final installment, retention recovery or other revenue.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** ACC15 selection not supplied; do not treat choices as approved scope.
- **Implementation classification:** partially implemented. Client Invoice has draft/submission/financial approval and AR balances.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No distinct Ben-confirmed progress billing handoff/dispatch or customer quotation lifecycle; no-extra billing approval cannot silently bypass Finance approval.
- **Recommended action:** Separate commercial billing confirmation from financial posting, reconcile ACC13–17 before new billing behavior.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/client-invoice.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/client-invoice.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## ACC16 — Receipt evidence and AR settlement actors

- **Stable ID:** ACC16. **Related existing IDs:** FIN-006, FIN-007, FIN-014
- **Intake change / decision:** new / pending question / choices not approved.
- **Business need:** Receipt evidence and AR settlement actors.
- **Expected workflow:** Unanswered who checks customer payment, records receipt, settles AR, issues receipt document and verifies.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** ACC16 actors/checks remain unanswered.
- **Implementation classification:** partially implemented. Payments allocate approved AP/AR/subcontract balances, support partial allocation and guarded approval/cancellation.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Approval and actual bank execution/clearance are not separate persisted lifecycles; paymentMethod/reference free text does not establish channel authority.
- **Recommended action:** Define approved vs actually executed/cleared states and evidence before banking replacement; do not reinterpret historic approved payments silently.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## ACC17 — AR follow-up

- **Stable ID:** ACC17. **Related existing IDs:** FIN-004, FIN-013
- **Intake change / decision:** new / pending question / choices not approved.
- **Business need:** AR follow-up.
- **Expected workflow:** Unanswered who monitors due/overdue AR, contacts customers, receives alerts and escalates to management.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** ACC17 actors, reminder timing and escalation threshold remain unanswered.
- **Implementation classification:** partially implemented. Client Invoice has draft/submission/financial approval and AR balances.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No distinct Ben-confirmed progress billing handoff/dispatch or customer quotation lifecycle; no-extra billing approval cannot silently bypass Finance approval.
- **Recommended action:** Separate commercial billing confirmation from financial posting, reconcile ACC13–17 before new billing behavior.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/client-invoice.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/client-invoice.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PORN-SUB-01 — Subcontract certification preparation

- **Stable ID:** PORN-SUB-01. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Subcontract certification preparation.
- **Expected workflow:** After Khaimook physical acceptance and Ben approval, Porn prepares certification and supporting documents → Nancy financial approval/payment.
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

## PORN-BOQ-01 — Safe financial totals only

- **Stable ID:** PORN-BOQ-01. **Related existing IDs:** BUD-011, BUD-012, BUD-013, BUD-014, BUD-015, BUD-016
- **Intake change / decision:** confirmed existing / confirmed core; conflicting disclosure source.
- **Business need:** Safe financial totals only.
- **Expected workflow:** View authorized Project contract/billed/paid totals and permitted Finance sources; no blanket internal cost or customer line-price/quantity/margin access.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** View: per the approved BOQ disclosure matrix and authorized Company/Project. Create/edit/approve: only the separate workflow rights explicitly listed for this role; report/warehouse read never adds mutation rights.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S7: Pinned approved repository BOQ scope and DEC-034/037/038.
- **Unresolved questions/design inputs:** C01 broader PDF cost access conflicts; existing Finance-source rights remain separately scoped.
- **Implementation classification:** implemented. Linked customer versions, cost snapshots and disclosure were delivered/accepted under BUD-011–016. Use release evidence with its retained-fixture limits.
- **Configuration evidence:** accepted V1.3 recorded configuration evidence retained; no new grant or full-current-runtime capture asserted.
- **Observed gap:** Older supplied PDF says full cost for Jai/Porn, conflicting with the approved matrix. No new defect in accepted BOQ behavior is asserted.
- **Recommended action:** Preserve accepted matrix and acceptance; record the broader-access request as a conflict requiring explicit change control.
- **Pinned implementation/configuration evidence:** [docs/V1.3-RELEASE-EXIT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/V1.3-RELEASE-EXIT.md); [docs/BOQ-COMMERCIAL-SCOPE.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/BOQ-COMMERCIAL-SCOPE.md); [apps/api/src/budget/budget.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/budget.service.ts); [apps/api/src/budget/customer-boq.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/customer-boq.service.ts); [apps/api/src/budget/budget-disclosure.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/budget-disclosure.ts)

## PORN-HR-01 — Payroll transfer preparation and bank visibility

- **Stable ID:** PORN-HR-01. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed.
- **Business need:** Payroll transfer preparation and bank visibility.
- **Expected workflow:** Receive Koh-approved bank detail updates; prepare transfer list from Nancy-approved payroll. No normal payroll review/approval stage for Porn; HR1-A bank read needs explicit target-Company/category access.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); S8: Pinned HR1-A entry contract / DEC-039 / issue 283.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. HR1-A canonical employment, encrypted identity/bank history and explicit target-Company/category entitlement backend are merged and CI-tested.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Protected private attachments, full UI/locales/cache/browser, retained activation and separate Owner HR acceptance remain with #283 writer.
- **Recommended action:** Continue existing owner lane; link requirements rather than duplicate HR design or grant access.
- **Pinned implementation/configuration evidence:** [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md); [docs/HR1-A-EMPLOYEE-ACCESS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-EMPLOYEE-ACCESS.md); [apps/api/src/hr/hr.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/hr/hr.service.ts); [apps/api/src/hr/hr.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/hr/hr.integration.spec.ts)