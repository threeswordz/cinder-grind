# Store Site — Site Store

> **Current execution precedence — Owner #288, 30 October 2026:** Accounting development is deferred; HR1-A #283 keeps its existing designated writer. The original L0/L1/L2 values below are **historical workflow risk flags**, not a current coding order. Read [13-execution-disposition.md](13-execution-disposition.md) and [11-launch-scope-and-next-package.md](11-launch-scope-and-next-package.md) before selecting new work. Existing BOQ/operational/Finance controls and the approved scoped HR privacy matrix remain intact; this document is not new implementation or Production authority.


**Prepared:** 30 October 2026, Asia/Singapore. **Assessment baseline:** `4fd3635ed06510dc4759e00061cfc92d6cbad2bc`.

This is a reconciled business-requirements and source-assessment record, not a statement that every requirement is implemented, configured, accepted or approved for Production. Named people identify business functions, not hard-coded authorization checks.

- **Intake change:** new / changed / confirmed existing is relative to the 24 October seven-role baseline (S1); it is independent of implementation status. New editorial IDs are traceability labels, not invented original question IDs.
- Existing question IDs and enterprise IDs are retained. Related IDs link shared responsibilities; they are not automatically equivalent implementation contracts.
- **Historical risk flag (not current build priority):** L0 = before relying on the affected financial/stock/security workflow; L1 = before full role workflow use, or a separately accepted pilot workaround; L2 = deferred/conditional next scope. These priorities do not authorize implementation.
- Permission/configuration activation is unverified in this assessment. Accepted V1.2/BOQ evidence stays closed; only materially changed paths need new verification.
- Cross-role authority is in [00-shared-workflows.md](00-shared-workflows.md); sources/contradictions are in [12-decisions-and-sources.md](12-decisions-and-sources.md).

**Historical persona label:** STOREKEEPER. This is not proof of live permissions.

## Requirement index

| ID | Requirement | Intake change | Decision | Implementation observation | Original risk flag |
| --- | --- | --- | --- | --- | --- |
| SS01 | One warehouse per site | new | confirmed with open detail | configuration-only | L1 |
| SS02 | Request new material codes | new | confirmed with open detail | partially implemented | L1 |
| SS03 | Material-specific UOM | new | confirmed with open detail | partially implemented | L0 |
| SS04 | Record actual physical receipt | confirmed existing | confirmed | partially implemented | L0 |
| SS05 | Receive anomalies and provisional custody | new | confirmed with open detail | partially implemented | L0 |
| SS06 | Every-delivery evidence | new | confirmed | partially implemented | L0 |
| SS07 | Foreman requests and receiver signs | changed | confirmed | partially implemented | L0 |
| SS08 | Material issue work dimensions | new | confirmed | partially implemented | L0 |
| SS09 | Return unused good material | confirmed existing | confirmed | partially implemented | L0 |
| SS10 | Approved transfer with destination receipt | confirmed existing | confirmed with open detail | partially implemented | L0 |
| SS11 | Tool/equipment loans | new | confirmed | partially implemented | L1 |
| SS12 | Stock-count responsibility | changed | confirmed with open detail | missing | L0 |
| SS13 | Loss/damage/waste record | new | confirmed with open detail | missing | L1 |
| SS14 | Stock and demand alerts | new | confirmed with open detail | partially implemented | L1 |
| SS15 | Site fund custody and requests | confirmed existing | confirmed with open detail | missing | L0 |
| SS16 | Correct submitted movement documents | new | confirmed with open detail | partially implemented | L0 |
| SS17 | Site operational visibility | confirmed existing | confirmed with open detail | partially implemented | L0 |
| SS18 | Assigned temporary Store cover | new | confirmed with open detail | configuration-only | L0 |
| SS-PLAN-01 | Material usage plan and issue limits | confirmed existing | confirmed with open detail | partially implemented | L0 |
| SS-HR-01 | Site actual time and small-job help | new | confirmed | missing | L2 |
| SS-HR-02 | Site worker leave and moves | new | confirmed | missing | L2 |

## SS01 — One warehouse per site

- **Stable ID:** SS01. **Related existing IDs:** FND-004, FND-005
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** One warehouse per site.
- **Expected workflow:** Keep one site warehouse holding site materials; use properly scoped central warehouse if separately authorized.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Actual warehouse IDs and uniqueness policy need configuration proof.
- **Implementation classification:** configuration-only. Company-scoped configurable workflows and action capabilities exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Named business actors and exact current retained assignments are unverified; seed/demo actors are not operational configuration evidence.
- **Recommended action:** Produce a desired-vs-observed matrix from existing authorized receipts; do not grant/configure during assessment.
- **Pinned implementation/configuration evidence:** [apps/api/src/approval/approval.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/approval/approval.service.ts); [docs/ROLES-PERMISSIONS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/ROLES-PERMISSIONS.md); [deploy/uat/e2-readiness.mjs](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/deploy/uat/e2-readiness.mjs)

## SS02 — Request new material codes

- **Stable ID:** SS02. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Request new material codes.
- **Expected workflow:** Store supplies material details → Khaimook review → Jai creates; Nancy creates initially.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Initial-to-normal owner transition date.
- **Implementation classification:** partially implemented. Material create/update and Company-scoped action permissions exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Initial Nancy versus later Jai code creation can be configured, but the Store request/Khaimook review handoff is not established as a material-master approval record.
- **Recommended action:** Reuse Material identity and management permissions; define the review/creation handoff and explicit rollout transition without another material master.
- **Pinned implementation/configuration evidence:** [apps/api/src/master-data/master-data.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/master-data/master-data.controller.ts); [apps/api/src/master-data/master-data.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/master-data/master-data.service.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## SS03 — Material-specific UOM

- **Stable ID:** SS03. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Material-specific UOM.
- **Expected workflow:** Support identical units or different purchase/receive/issue units with a fixed explicit rate per material.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Actual conversion values and effective dates.
- **Implementation classification:** partially implemented. Company UOMs, material default UOM and explicit movement UOM dimensions exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No effective-dated material-specific fixed purchase/receive/issue conversion definition; a UOM ID is not conversion proof.
- **Recommended action:** Use confirmed same-UOM operations for a bounded pilot; separately implement explicit fixed conversions before mixed-UOM use.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/inventory/material-issue.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-issue.service.ts); [apps/api/src/master-data/master-data.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/master-data/master-data.service.ts)

## SS04 — Record actual physical receipt

- **Stable ID:** SS04. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Record actual physical receipt.
- **Expected workflow:** Inspect against PO, receive only correct/good stock, record actual quantities/evidence → Jai document/photo check → Khaimook approval.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Actual partial receipts against current approved PO, configured approval, locked cumulative overreceipt checks and idempotent posting exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Provisional receipt without a PO, mandatory per-delivery evidence and an explicit Jai document-check handoff are not established by this contract.
- **Recommended action:** Separate provisional custody from posted stock; define evidence/completion gates and preserve accepted PO/GR behavior.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/goods-receipt.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/goods-receipt.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## SS05 — Receive anomalies and provisional custody

- **Stable ID:** SS05. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Receive anomalies and provisional custody.
- **Expected workflow:** Record shortage/excess/wrong/damaged goods; notify Jai and Khaimook. Goods before PO use reasoned/evidenced temporary receipt linked to PO later.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Temporary receipt custody/stock availability and completion deadline.
- **Implementation classification:** partially implemented. Actual partial receipts against current approved PO, configured approval, locked cumulative overreceipt checks and idempotent posting exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Provisional receipt without a PO, mandatory per-delivery evidence and an explicit Jai document-check handoff are not established by this contract.
- **Recommended action:** Separate provisional custody from posted stock; define evidence/completion gates and preserve accepted PO/GR behavior.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/goods-receipt.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/goods-receipt.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## SS06 — Every-delivery evidence

- **Stable ID:** SS06. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed.
- **Business need:** Every-delivery evidence.
- **Expected workflow:** For every delivery including partial receipt, retain delivery note, receiver name/signature, goods/condition photos and quality result where needed.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Actual partial receipts against current approved PO, configured approval, locked cumulative overreceipt checks and idempotent posting exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Provisional receipt without a PO, mandatory per-delivery evidence and an explicit Jai document-check handoff are not established by this contract.
- **Recommended action:** Separate provisional custody from posted stock; define evidence/completion gates and preserve accepted PO/GR behavior.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/goods-receipt.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/goods-receipt.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## SS07 — Foreman requests and receiver signs

- **Stable ID:** SS07. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed.
- **Business need:** Foreman requests and receiver signs.
- **Expected workflow:** Foreman requests orally/chat → Store records request in ERP (not Foreman PR); receiver signs acknowledgment.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal); S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Issues validate quantities, dimensions, available stock and reservations; submit always starts MATERIAL_ISSUE approval and approve posts stock.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No approved-plan within-limit immediate-issue route, beyond-plan escalation thresholds or Foreman request record/signature contract.
- **Recommended action:** Build one approved-plan-to-request-to-issue package, retaining atomic ledger, replay and negative-stock controls.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/material-issue.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-issue.service.ts); [apps/api/src/inventory/material-movement.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-movement.controller.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts)

## SS08 — Material issue work dimensions

- **Stable ID:** SS08. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed.
- **Business need:** Material issue work dimensions.
- **Expected workflow:** Record Project, Cost BOQ item, work type, building/floor/work area, requester, actual recipient/issuer, material and quantity.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Issues validate quantities, dimensions, available stock and reservations; submit always starts MATERIAL_ISSUE approval and approve posts stock.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No approved-plan within-limit immediate-issue route, beyond-plan escalation thresholds or Foreman request record/signature contract.
- **Recommended action:** Build one approved-plan-to-request-to-issue package, retaining atomic ledger, replay and negative-stock controls.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/material-issue.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-issue.service.ts); [apps/api/src/inventory/material-movement.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-movement.controller.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts)

## SS09 — Return unused good material

- **Stable ID:** SS09. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Return unused good material.
- **Expected workflow:** Return reusable unused stock; report damaged goods separately; supplier returns/claims coordinated by Jai; Store records actual outbound/replacement.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Returns link to original issue items, use approval and retain stock/reversal provenance.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Supplier return/claim/replacement lifecycle and unusable-stock separation are not the same as an issue return.
- **Recommended action:** Keep reusable good-material return; add supplier claim tracking only within a defined stock-effect contract.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/material-return.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-return.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts)

## SS10 — Approved transfer with destination receipt

- **Stable ID:** SS10. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Approved transfer with destination receipt.
- **Expected workflow:** Origin Store prepares → Khaimook approves every transfer, including requested cross-MKE/TCJ → origin dispatch → destination Store or assigned receiver acknowledges actual receipt/evidence.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Cross-Company accounting/scope design and assigned receiver identity when no destination Store.
- **Implementation classification:** partially implemented. Approved transfer atomically posts paired stock movements. validateWarehouses requires both warehouses in auth.companyId.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No separate dispatch/destination acknowledgment or cross-MKE/TCJ transfer contract.
- **Recommended action:** Keep same-Company atomic transfer; separately scope in-transit/receipt state and cross-Company ownership/Finance consequences.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/stock-transfer.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/stock-transfer.service.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## SS11 — Tool/equipment loans

- **Stable ID:** SS11. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed.
- **Business need:** Tool/equipment loans.
- **Expected workflow:** Track each tool/equipment item, worker/subcontractor borrower, due date, condition and return.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Equipment registration/site usage exists.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** It is not a verified CG##### fixed-asset/custody/loan/return/depreciation register.
- **Recommended action:** Map reusable Equipment identity first; define asset and custody lifecycle; depreciation remains separate financial scope.
- **Pinned implementation/configuration evidence:** [apps/api/src/equipment/equipment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/equipment/equipment.service.ts); [apps/api/src/equipment/equipment.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/equipment/equipment.controller.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## SS12 — Stock-count responsibility

- **Stable ID:** SS12. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Stock-count responsibility.
- **Expected workflow:** Store Site of each site records actual count and evidence → Khaimook checks/approves physical adjustment; Foreman has no count variance/proposal/approval rights. Nancy sets category-based frequency.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create/count evidence: Store Site. View/check/approve physical adjustment: Khaimook. Foreman: no variance entry, adjustment proposal or approval. Nancy: count scheduling; financial disposal authority remains separate.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** Earlier PDF joint count with Foreman and Nancy count approval.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal); S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** Actual count frequencies; separate financial write-off authority C03.
- **Implementation classification:** missing. Reviewed complete schema and inventory controller surface have balances/movements/reservations/issues/returns/transfers, without a canonical count session or count-adjustment endpoint.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Requested Store Site count/evidence → Khaimook approved adjustment is not implemented as a dedicated workflow.
- **Recommended action:** Propose a count/variance/append-only adjustment workflow; separate physical count adjustment from financial write-off.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/inventory/inventory.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory.controller.ts); [apps/api/src/inventory/material-movement.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-movement.controller.ts); [apps/api/src/inventory/inventory-report.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory-report.controller.ts)

## SS13 — Loss/damage/waste record

- **Stable ID:** SS13. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Loss/damage/waste record.
- **Expected workflow:** Record material/code/quantity/UOM, issue type, Project/place/date, cause/evidence, finder/reporter and proposed repair/return/disposal. Khaimook screens property severity before Ben escalation.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal); S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** Disposal/write-off authority and cost recognition remain separate.
- **Implementation classification:** missing. Reviewed complete schema and inventory controller surface have balances/movements/reservations/issues/returns/transfers, without a canonical count session or count-adjustment endpoint.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Requested Store Site count/evidence → Khaimook approved adjustment is not implemented as a dedicated workflow.
- **Recommended action:** Propose a count/variance/append-only adjustment workflow; separate physical count adjustment from financial write-off.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/inventory/inventory.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory.controller.ts); [apps/api/src/inventory/material-movement.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-movement.controller.ts); [apps/api/src/inventory/inventory-report.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory-report.controller.ts)

## SS14 — Stock and demand alerts

- **Stable ID:** SS14. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Stock and demand alerts.
- **Expected workflow:** Khaimook sets minimum per material/site; alert approved-plan demand at 14 and 7 days; show orders/outstanding/due/late/rescheduled deliveries.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Actual minimum values and notification recipients/settings.
- **Implementation classification:** partially implemented. Scoped quantity/movement and scheduling/lookahead read models exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Material/site minimum thresholds and approved-plan 14/7-day material demand alerts are not established.
- **Recommended action:** Define canonical thresholds and plan-driven notifications; avoid using schedule lookahead as stock availability proof.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/inventory-report.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory-report.service.ts); [apps/api/src/inventory/stock-balance.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/stock-balance.service.ts); [apps/api/src/scheduling/scheduling-progress.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/scheduling/scheduling-progress.service.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## SS15 — Site fund custody and requests

- **Stable ID:** SS15. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Site fund custody and requests.
- **Expected workflow:** Store holds own site petty cash, records expense/evidence → Khaimook review → Nancy approval; custodian pays/records receipts, change/returns and balance; expense certification if receipt unavailable.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Fund limits/replenishment and settlement details.
- **Implementation classification:** missing. Payment exists, but the reviewed schema/Finance surface has no fund/custodian/replenishment/petty-cash request ledger.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Nancy main fund, Khaimook field-central fund, site funds and Store→Khaimook→Nancy route lack dedicated implementation.
- **Recommended action:** Scope fund balance, request/review/approval/payment/evidence and reconciliation together; decide substitute reviewer for Khaimook own requests.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts); [apps/api/src/finance/finance.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.controller.ts)

## SS16 — Correct submitted movement documents

- **Stable ID:** SS16. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Correct submitted movement documents.
- **Expected workflow:** Khaimook reviews/approves correction/cancellation of received/issued/returned/transferred documents with reason/history; stock effect must be linked reversal/correction, not overwrite.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Map amendment/reversal policy to each source lifecycle; physical-count adjustments use SS12.
- **Implementation classification:** partially implemented. Issues validate quantities, dimensions, available stock and reservations; submit always starts MATERIAL_ISSUE approval and approve posts stock.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No approved-plan within-limit immediate-issue route, beyond-plan escalation thresholds or Foreman request record/signature contract.
- **Recommended action:** Build one approved-plan-to-request-to-issue package, retaining atomic ledger, replay and negative-stock controls.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/material-issue.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-issue.service.ts); [apps/api/src/inventory/material-movement.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-movement.controller.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts)

## SS17 — Site operational visibility

- **Stable ID:** SS17. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Site operational visibility.
- **Expected workflow:** View quantities/status only, no material rates/cost/budget amounts. See site worker/time/OT/leave data without wage rates/totals.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** View: per the approved BOQ disclosure matrix and authorized Company/Project. Create/edit/approve: only the separate workflow rights explicitly listed for this role; report/warehouse read never adds mutation rights.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Later HR time/leave views remain outside current HR1-A.
- **Implementation classification:** partially implemented. BOQ disclosure, Company/Project read boundaries and salary-free basic HR operational employee projections exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** The exact authorized extra warehouse/report scope is not verified; full time/OT/leave operational screens are later HR scope; C01 broader Jai/Porn costs conflict with approved BOQ.
- **Recommended action:** Keep approved disclosure and source-only warehouse reads; configure only through separate authority and leave attendance/leave views in the HR lane.
- **Pinned implementation/configuration evidence:** [apps/api/src/budget/budget-disclosure.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/budget-disclosure.ts); [apps/api/src/inventory/stock-balance.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/stock-balance.service.ts); [apps/api/src/projects/project-access.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/projects/project-access.service.ts); [apps/api/src/hr/hr.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/hr/hr.service.ts)

## SS18 — Assigned temporary Store cover

- **Stable ID:** SS18. **Related existing IDs:** FND-004, FND-005
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Assigned temporary Store cover.
- **Expected workflow:** Store from another site gains additional access only to assigned cover site until assignment is revoked; no broad role switch.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Who assigns cover and which create/edit/approval actions are allowed.
- **Implementation classification:** configuration-only. Company-scoped configurable workflows and action capabilities exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Named business actors and exact current retained assignments are unverified; seed/demo actors are not operational configuration evidence.
- **Recommended action:** Produce a desired-vs-observed matrix from existing authorized receipts; do not grant/configure during assessment.
- **Pinned implementation/configuration evidence:** [apps/api/src/approval/approval.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/approval/approval.service.ts); [docs/ROLES-PERMISSIONS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/ROLES-PERMISSIONS.md); [deploy/uat/e2-readiness.mjs](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/deploy/uat/e2-readiness.mjs)

## SS-PLAN-01 — Material usage plan and issue limits

- **Stable ID:** SS-PLAN-01. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Material usage plan and issue limits.
- **Expected workflow:** Prepare usage plan from approved cost quantities → Khaimook approves. Within-plan issue records can proceed; beyond-plan requires Khaimook then Ben beyond authority.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** Beyond-plan criteria, numerical limits and mixed-level escalation decision.
- **Implementation classification:** partially implemented. Issues validate quantities, dimensions, available stock and reservations; submit always starts MATERIAL_ISSUE approval and approve posts stock.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No approved-plan within-limit immediate-issue route, beyond-plan escalation thresholds or Foreman request record/signature contract.
- **Recommended action:** Build one approved-plan-to-request-to-issue package, retaining atomic ledger, replay and negative-stock controls.
- **Pinned implementation/configuration evidence:** [apps/api/src/inventory/material-issue.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-issue.service.ts); [apps/api/src/inventory/material-movement.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-movement.controller.ts); [apps/api/src/procurement/purchase-order.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/procurement/purchase-order.integration.spec.ts)

## SS-HR-01 — Site actual time and small-job help

- **Stable ID:** SS-HR-01. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed.
- **Business need:** Site actual time and small-job help.
- **Expected workflow:** Enter/check own site actual in/out/Project/work type directly; submit on 15th/month-end to Koh with no extra site confirmer. Sending site records small-job work/persons/date/interval. After submission edit only after Koh returns it.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** A worker at site and small job has nonoverlapping actual intervals; the home site does not silently collect every other site ledger.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** missing. DPR manpower is aggregate headcount, not employee worked hours; ProjectMember is assignment only.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No employee-level time/submission/return/resubmit/overlap contract; outside current HR1-A slice.
- **Recommended action:** Keep current authorized HR1-A sequence; later propose actual-time foundation including small-job hours and non-overlap.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-ENTRY-PREPARATION.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-ENTRY-PREPARATION.md); [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md)

## SS-HR-02 — Site worker leave and moves

- **Stable ID:** SS-HR-02. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed.
- **Business need:** Site worker leave and moves.
- **Expected workflow:** Store prepares general worker leave → Foreman approval → Koh final approval. Foreman/heads/management require Ben under HR source. Record actual move after Khaimook confirms and Koh updates register.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** missing. Leave/OT policies are recorded in the HR source; explicitly excluded from HR1-A implementation.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No leave/OT request/balance/actual-time ledger in this schema.
- **Recommended action:** Deliver only via subsequent approved HR slice; preserve all confirmed policies and ask only stage-relevant unresolved details.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md); [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md)