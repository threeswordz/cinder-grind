# Jai (คุณใจ) — Purchasing

> **Current execution precedence — Owner #288, 30 October 2026:** Accounting development is deferred; HR1-A #283 keeps its existing designated writer. The original L0/L1/L2 values below are **historical workflow risk flags**, not a current coding order. Read [13-execution-disposition.md](13-execution-disposition.md) and [11-launch-scope-and-next-package.md](11-launch-scope-and-next-package.md) before selecting new work. Existing BOQ/operational/Finance controls and the approved scoped HR privacy matrix remain intact; this document is not new implementation or Production authority.


**Prepared:** 30 October 2026, Asia/Singapore. **Assessment baseline:** `4fd3635ed06510dc4759e00061cfc92d6cbad2bc`.

This is a reconciled business-requirements and source-assessment record, not a statement that every requirement is implemented, configured, accepted or approved for Production. Named people identify business functions, not hard-coded authorization checks.

- **Intake change:** new / changed / confirmed existing is relative to the 24 October seven-role baseline (S1); it is independent of implementation status. New editorial IDs are traceability labels, not invented original question IDs.
- Existing question IDs and enterprise IDs are retained. Related IDs link shared responsibilities; they are not automatically equivalent implementation contracts.
- **Historical risk flag (not current build priority):** L0 = before relying on the affected financial/stock/security workflow; L1 = before full role workflow use, or a separately accepted pilot workaround; L2 = deferred/conditional next scope. These priorities do not authorize implementation.
- Permission/configuration activation is unverified in this assessment. Accepted V1.2/BOQ evidence stays closed; only materially changed paths need new verification.
- Cross-role authority is in [00-shared-workflows.md](00-shared-workflows.md); sources/contradictions are in [12-decisions-and-sources.md](12-decisions-and-sources.md).

**Historical persona label:** PROCUREMENT_OFFICER. This is not proof of live permissions.

## Requirement index

| ID | Requirement | Intake change | Decision | Implementation observation | Original risk flag |
| --- | --- | --- | --- | --- | --- |
| PUR01 | Quote comparison and selection | changed | confirmed | partially implemented | L0 |
| PUR03 | Supplier master handoff | changed | confirmed | partially implemented | L0 |
| PUR04 | PO business fields | changed | confirmed | partially implemented | L0 |
| PUR05 | Approved PO amendments | confirmed existing | confirmed | partially implemented | L0 |
| PUR06 | Combined PR and multi-Project PO | new | confirmed with open detail | partially implemented | L2 |
| PUR07 | Approved PO dispatch and filename | changed | confirmed | partially implemented | L1 |
| PUR08 | Supplier delivery tracking | new | confirmed | partially implemented | L1 |
| PUR09 | Document-based receipt verification | changed | confirmed | partially implemented | L0 |
| PUR10 | Cancel PO/outstanding delivery | new | confirmed with open detail | partially implemented | L0 |
| PUR12 | Company monthly PO identity | changed | confirmed | partially implemented | L1 |
| PUR13 | Normal material-code creation | new | confirmed with open detail | partially implemented | L1 |
| PUR14 | Supplier discrepancy, return and replacement | confirmed existing | confirmed | partially implemented | L0 |
| PUR15 | Accounting document packet | confirmed existing | confirmed with open detail | partially implemented | L0 |
| JAI-ASSET-01 | Asset register | confirmed existing | confirmed | partially implemented | L2 |
| JAI-SCOPE-01 | Purchasing across Projects | confirmed existing | confirmed with open detail | configuration-only | L0 |

## PUR01 — Quote comparison and selection

- **Stable ID:** PUR01. **Related existing IDs:** PUR02, PUR11
- **Intake change / decision:** changed / confirmed.
- **Business need:** Quote comparison and selection.
- **Expected workflow:** Request/retain quotes and selection rationale; Ben considers recommendation with PO approval. At PO total ≤10,000 THB need 1 vendor; >10,000–50,000 need 2; >50,000 need 3. Basis: whole PO after discount plus freight/additional charges, excluding VAT; single/special supplier exception requires reason and Ben review.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** At 10,000 need 1; at 10,000.01 need 2; at 50,000 need 2; at 50,000.01 need 3. Whole-PO basis applies even if multiple PRs.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. RFQ, supplier invitations, quotations, comparisons, reasoned award and source immutability exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No reviewed PO-level 1/2/3-supplier rule based on discounted, freight-inclusive, VAT-exclusive total.
- **Recommended action:** Add one PO-level quote-count/exception gate and amount basis after approved scope; reuse existing RFQ records.
- **Pinned implementation/configuration evidence:** [apps/api/src/procurement/sourcing.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/sourcing.service.ts); [apps/api/src/procurement/sourcing.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/sourcing.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PUR03 — Supplier master handoff

- **Stable ID:** PUR03. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed.
- **Business need:** Supplier master handoff.
- **Expected workflow:** Use Nancy-created/confirmed suppliers and bank data; Jai no longer owns supplier master creation/edit under the latest supplied rule.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** S1 Purchasing creates/updates suppliers.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Supplier master has Company-scoped create/update/view capabilities and basic contact/tax-registration fields.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Nancy ownership requires observed grant reconciliation; reviewed Supplier schema and create/update contract do not include supplier bank-account history/verification.
- **Recommended action:** Keep Nancy supplier-management authority as the desired matrix; separately scope supplier bank data/protection rather than assume an employee HR bank record covers suppliers.
- **Pinned implementation/configuration evidence:** [apps/api/src/master-data/master-data.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/master-data/master-data.controller.ts); [apps/api/src/master-data/master-data.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/master-data/master-data.service.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PUR04 — PO business fields

- **Stable ID:** PUR04. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed.
- **Business need:** PO business fields.
- **Expected workflow:** Prepare PO from approved PR/award with material/specification/quantity/UOM/THB prices; delivery point/contact/dates/partial terms; discount/freight/charges, VAT/credit/payment terms → Ben.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Award-backed POs have one projectId, immutable revisions, configured approval and downstream receipt/invoice guards.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Multi-Project allocation, full commercial charge/credit/delivery amendments and routed cancellation review exceed the present contract.
- **Recommended action:** Preserve single-Project workflow; assess bounded commercial/revision work; keep #245 explicitly deferred until Finance change control.
- **Pinned implementation/configuration evidence:** [apps/api/src/procurement/purchase-order.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PUR05 — Approved PO amendments

- **Stable ID:** PUR05. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Approved PO amendments.
- **Expected workflow:** Reasoned version → Ben renewed approval before dispatch for vendor/material/specification, price/discount/charges, quantity, credit/payment terms or delivery date/place changes. Preserve original history; excess still uses PM03.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Changing delivery date on an approved PO creates a reviewed revision; it never silently edits the approved snapshot.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Award-backed POs have one projectId, immutable revisions, configured approval and downstream receipt/invoice guards.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Multi-Project allocation, full commercial charge/credit/delivery amendments and routed cancellation review exceed the present contract.
- **Recommended action:** Preserve single-Project workflow; assess bounded commercial/revision work; keep #245 explicitly deferred until Finance change control.
- **Pinned implementation/configuration evidence:** [apps/api/src/procurement/purchase-order.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PUR06 — Combined PR and multi-Project PO

- **Stable ID:** PUR06. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Combined PR and multi-Project PO.
- **Expected workflow:** One supplier PO may combine approved PRs and requested Project allocations; retain quantity/cost allocation.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Requested example A18/B2 totals 20 once; do not split one external supplier invoice into duplicated Project invoices.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** C05: requested multi-Project PO remains unapproved implementation under #245/DEC-018/019/020; explicit Finance allocation decisions required.
- **Implementation classification:** partially implemented. Award-backed POs have one projectId, immutable revisions, configured approval and downstream receipt/invoice guards.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Multi-Project allocation, full commercial charge/credit/delivery amendments and routed cancellation review exceed the present contract.
- **Recommended action:** Preserve single-Project workflow; assess bounded commercial/revision work; keep #245 explicitly deferred until Finance change control.
- **Pinned implementation/configuration evidence:** [apps/api/src/procurement/purchase-order.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PUR07 — Approved PO dispatch and filename

- **Stable ID:** PUR07. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed.
- **Business need:** Approved PO dispatch and filename.
- **Expected workflow:** After Ben approval, download PDF and send email/LINE outside ERP; store dispatch/acknowledgment evidence. PDF filename appends supplier/contractor name to PO number, e.g. T-PO2610-001 บ.เซมิคอนกรีต จำกัด.pdf.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Approved PDF has the requested supplier filename; dispatch stays manual outside ERP unless a later integration is approved.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal); S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. assertApprovedNumbering explicitly requires POYYMM-### with MONTHLY reset; tests expect an unprefixed PO number.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Requested K-/T- prefix and supplier-name PDF delivery are not simply a sequence configuration change; no PO PDF export action found in inspected PO UI.
- **Recommended action:** Propose forward-only new-document formatting and a safe filename exporter; preserve historical numbers and dates.
- **Pinned implementation/configuration evidence:** [apps/api/src/procurement/purchase-order.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.service.ts); [apps/api/src/administration/number-sequence.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/administration/number-sequence.service.ts); [apps/web/src/procurement/PurchaseOrdersPanel.tsx](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/web/src/procurement/PurchaseOrdersPanel.tsx)

## PUR08 — Supplier delivery tracking

- **Stable ID:** PUR08. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed.
- **Business need:** Supplier delivery tracking.
- **Expected workflow:** Track acknowledged PO, awaiting/confirmed delivery, in transit, partial/outstanding, complete, delayed/rescheduled, return/claim/replacement and cancelled balance.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Award-backed POs have one projectId, immutable revisions, configured approval and downstream receipt/invoice guards.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Multi-Project allocation, full commercial charge/credit/delivery amendments and routed cancellation review exceed the present contract.
- **Recommended action:** Preserve single-Project workflow; assess bounded commercial/revision work; keep #245 explicitly deferred until Finance change control.
- **Pinned implementation/configuration evidence:** [apps/api/src/procurement/purchase-order.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PUR09 — Document-based receipt verification

- **Stable ID:** PUR09. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed.
- **Business need:** Document-based receipt verification.
- **Expected workflow:** Jai checks delivery documents/photos/received quantities from Store Site; physical inspection is Store responsibility; Khaimook approves GR. Jai need not attend every delivery.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** S1 requirement interpreted as joint physical inspection every delivery.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Actual partial receipts against current approved PO, configured approval, locked cumulative overreceipt checks and idempotent posting exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Provisional receipt without a PO, mandatory per-delivery evidence and an explicit Jai document-check handoff are not established by this contract.
- **Recommended action:** Separate provisional custody from posted stock; define evidence/completion gates and preserve accepted PO/GR behavior.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/goods-receipt.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/goods-receipt.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PUR10 — Cancel PO/outstanding delivery

- **Stable ID:** PUR10. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Cancel PO/outstanding delivery.
- **Expected workflow:** Jai proposes with reason → Khaimook checks continuing site need → Ben approves.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** Supplier refusal, penalty, deposit refund and already received/invoiced cancellation require explicit handling.
- **Implementation classification:** partially implemented. Award-backed POs have one projectId, immutable revisions, configured approval and downstream receipt/invoice guards.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Multi-Project allocation, full commercial charge/credit/delivery amendments and routed cancellation review exceed the present contract.
- **Recommended action:** Preserve single-Project workflow; assess bounded commercial/revision work; keep #245 explicitly deferred until Finance change control.
- **Pinned implementation/configuration evidence:** [apps/api/src/procurement/purchase-order.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## PUR12 — Company monthly PO identity

- **Stable ID:** PUR12. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed.
- **Business need:** Company monthly PO identity.
- **Expected workflow:** Generate K-POYYMM-NNN or T-POYYMM-NNN, 001 reset monthly, YY Gregorian creation year/month; approval in next month does not change the original creation-period number.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** PO created 31 October, approved 1 November retains YYMM 2610; historical unprefixed POs remain untouched.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. assertApprovedNumbering explicitly requires POYYMM-### with MONTHLY reset; tests expect an unprefixed PO number.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Requested K-/T- prefix and supplier-name PDF delivery are not simply a sequence configuration change; no PO PDF export action found in inspected PO UI.
- **Recommended action:** Propose forward-only new-document formatting and a safe filename exporter; preserve historical numbers and dates.
- **Pinned implementation/configuration evidence:** [apps/api/src/procurement/purchase-order.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.service.ts); [apps/api/src/administration/number-sequence.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/administration/number-sequence.service.ts); [apps/web/src/procurement/PurchaseOrdersPanel.tsx](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/web/src/procurement/PurchaseOrdersPanel.tsx)

## PUR13 — Normal material-code creation

- **Stable ID:** PUR13. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Normal material-code creation.
- **Expected workflow:** Store gives details → Khaimook checks → Jai creates code; initial rollout uses Nancy creation. Fixed UOM conversion per material when units differ.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal); [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Handover date and actual material/UOM conversion examples.
- **Implementation classification:** partially implemented. Company UOMs, material default UOM and explicit movement UOM dimensions exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No effective-dated material-specific fixed purchase/receive/issue conversion definition; a UOM ID is not conversion proof.
- **Recommended action:** Use confirmed same-UOM operations for a bounded pilot; separately implement explicit fixed conversions before mixed-UOM use.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/inventory/material-issue.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-issue.service.ts); [apps/api/src/master-data/master-data.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/master-data/master-data.service.ts)

## PUR14 — Supplier discrepancy, return and replacement

- **Stable ID:** PUR14. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Supplier discrepancy, return and replacement.
- **Expected workflow:** Coordinate supplier after Store evidence/Khaimook decision; follow short/wrong/excess/damaged delivery through return/claim/replacement. Store records actual outbound/inbound.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Returns link to original issue items, use approval and retain stock/reversal provenance.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Supplier return/claim/replacement lifecycle and unusable-stock separation are not the same as an issue return.
- **Recommended action:** Keep reusable good-material return; add supplier claim tracking only within a defined stock-effect contract.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/material-return.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-return.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts)

## PUR15 — Accounting document packet

- **Stable ID:** PUR15. **Related existing IDs:** ACC02, ACC03, FIN-001, FIN-012
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Accounting document packet.
- **Expected workflow:** Send Porn latest approved PO/revisions, delivery/GR links, supplier invoice/tax invoice, inspection/quality evidence, discrepancies, and return/claim/credit notes. If mismatch, coordinate corrections then Porn rechecks before pay.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal); S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** Purchase-document submission deadline; provisional receipt completion deadline.
- **Implementation classification:** partially implemented. AP invoices retain PO/GR sources, scope, totals, approval and idempotency.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No complete owner-requested mismatch hold → Jai correction → Porn recheck workflow/three-way matching tolerance established.
- **Recommended action:** Map discrepancy items/holds and payment eligibility; preserve existing currency/source validation.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/finance.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## JAI-ASSET-01 — Asset register

- **Stable ID:** JAI-ASSET-01. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Asset register.
- **Expected workflow:** Maintain CG##### register including purchase date/value/location/custodian; Nancy handles depreciation initially.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Equipment registration/site usage exists.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** It is not a verified CG##### fixed-asset/custody/loan/return/depreciation register.
- **Recommended action:** Map reusable Equipment identity first; define asset and custody lifecycle; depreciation remains separate financial scope.
- **Pinned implementation/configuration evidence:** [apps/api/src/equipment/equipment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/equipment/equipment.service.ts); [apps/api/src/equipment/equipment.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/equipment/equipment.controller.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## JAI-SCOPE-01 — Purchasing across Projects

- **Stable ID:** JAI-SCOPE-01. **Related existing IDs:** FND-004, FND-005
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Purchasing across Projects.
- **Expected workflow:** Handle purchasing for all Projects of explicitly authorized Companies, with Project distinctions; quantity-only BOQ and separate procurement price authority per approved matrix.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** View: per the approved BOQ disclosure matrix and authorized Company/Project. Create/edit/approve: only the separate workflow rights explicitly listed for this role; report/warehouse read never adds mutation rights.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal); S7: Pinned approved repository BOQ scope and DEC-034/037/038.
- **Unresolved questions/design inputs:** Actual MKE/TCJ membership/grants and substitute scope require evidence.
- **Implementation classification:** configuration-only. Company-scoped configurable workflows and action capabilities exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Named business actors and exact current retained assignments are unverified; seed/demo actors are not operational configuration evidence.
- **Recommended action:** Produce a desired-vs-observed matrix from existing authorized receipts; do not grant/configure during assessment.
- **Pinned implementation/configuration evidence:** [apps/api/src/approval/approval.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/approval/approval.service.ts); [docs/ROLES-PERMISSIONS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/ROLES-PERMISSIONS.md); [deploy/uat/e2-readiness.mjs](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/deploy/uat/e2-readiness.mjs)