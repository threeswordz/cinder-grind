# Nancy — Accounting Manager

> **Current execution precedence — Owner #288, 30 October 2026:** Accounting development is deferred; HR1-A #283 keeps its existing designated writer. The original L0/L1/L2 values below are **historical workflow risk flags**, not a current coding order. Read [13-execution-disposition.md](13-execution-disposition.md) and [11-launch-scope-and-next-package.md](11-launch-scope-and-next-package.md) before selecting new work. Existing BOQ/operational/Finance controls and the approved scoped HR privacy matrix remain intact; this document is not new implementation or Production authority.


**Prepared:** 30 October 2026, Asia/Singapore. **Assessment baseline:** `4fd3635ed06510dc4759e00061cfc92d6cbad2bc`.

This is a reconciled business-requirements and source-assessment record, not a statement that every requirement is implemented, configured, accepted or approved for Production. Named people identify business functions, not hard-coded authorization checks.

- **Intake change:** new / changed / confirmed existing is relative to the 24 October seven-role baseline (S1); it is independent of implementation status. New editorial IDs are traceability labels, not invented original question IDs.
- Existing question IDs and enterprise IDs are retained. Related IDs link shared responsibilities; they are not automatically equivalent implementation contracts.
- **Historical risk flag (not current build priority):** L0 = before relying on the affected financial/stock/security workflow; L1 = before full role workflow use, or a separately accepted pilot workaround; L2 = deferred/conditional next scope. These priorities do not authorize implementation.
- Permission/configuration activation is unverified in this assessment. Accepted V1.2/BOQ evidence stays closed; only materially changed paths need new verification.
- Cross-role authority is in [00-shared-workflows.md](00-shared-workflows.md); sources/contradictions are in [12-decisions-and-sources.md](12-decisions-and-sources.md).

**Historical persona label:** FINANCE_MANAGER. This is not proof of live permissions.

**Nancy split:** existing BOQ/operational approvals and HR1-A duties persist; new AP/payment, banking, depreciation and other accounting functionality is deferred. Count cadence is not financial write-off permission.

## Requirement index

| ID | Requirement | Intake change | Decision | Implementation observation | Original risk flag |
| --- | --- | --- | --- | --- | --- |
| NANCY-01 | Customer BOQ, VO, budget and quotation approvals | confirmed existing | confirmed | partially implemented | L0 |
| NANCY-02 | AP invoice and supplier payment approval | confirmed existing | confirmed | partially implemented | L0 |
| NANCY-03 | Subcontract payment approval | confirmed existing | confirmed | partially implemented | L0 |
| NANCY-04 | Supplier master ownership | changed | confirmed | partially implemented | L0 |
| NANCY-05 | Material codes at initial rollout | changed | confirmed with open detail | partially implemented | L1 |
| NANCY-06 | Main petty-cash fund and expense approval | confirmed existing | confirmed with open detail | missing | L0 |
| NANCY-07 | Stock-count scheduling and financial write-off boundary | changed | confirmed with open detail | missing | L0 |
| NANCY-08 | Depreciation ownership | confirmed existing | confirmed with open detail | partially implemented | L2 |
| NANCY-09 | Bank reconciliation confirmation | confirmed existing | confirmed with open detail | missing | L0 |
| NANCY-10 | Payroll approvals and actual payment | confirmed existing | confirmed with open detail | missing | L2 |
| NANCY-11 | Narrow HR substitution exception | confirmed existing | confirmed with open detail | configuration-only | L2 |
| NANCY-12 | HR privacy and launch responsibility | confirmed existing | confirmed | partially implemented | L1 |

## NANCY-01 — Customer BOQ, VO, budget and quotation approvals

- **Stable ID:** NANCY-01. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Customer BOQ, VO, budget and quotation approvals.
- **Expected workflow:** Approve Ben customer BOQ/revisions, Project VO and budget changes; approve customer quotations/revised prices before sending; full authorized internal BOQ reads do not grant internal BOQ approval.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); S7: Pinned approved repository BOQ scope and DEC-034/037/038.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Customer BOQ, budget and Project VO approval mechanisms exist; Nancy customer BOQ authority belongs to accepted V1.3.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** A separate customer quotation/requotation/dispatch approval lifecycle is not present in the reviewed schema/route contract; live actor configuration is not newly captured.
- **Recommended action:** Preserve accepted BOQ; verify VO/budget actors from existing evidence and scope missing quotation lifecycle separately.
- **Pinned implementation/configuration evidence:** [apps/api/src/budget/customer-boq.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/budget/customer-boq.service.ts); [apps/api/src/cost-control/project-variation.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/cost-control/project-variation.service.ts); [apps/api/src/finance/client-invoice.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/client-invoice.service.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## NANCY-02 — AP invoice and supplier payment approval

- **Stable ID:** NANCY-02. **Related existing IDs:** ACC02, ACC04, FIN-006, FIN-007, FIN-014
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** AP invoice and supplier payment approval.
- **Expected workflow:** Porn records/checks AP invoice and proposes payment → Nancy reviews recipient, amount and evidence and approves; Nancy executes bank transfers.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Payments allocate approved AP/AR/subcontract balances, support partial allocation and guarded approval/cancellation.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Approval and actual bank execution/clearance are not separate persisted lifecycles; paymentMethod/reference free text does not establish channel authority.
- **Recommended action:** Define approved vs actually executed/cleared states and evidence before banking replacement; do not reinterpret historic approved payments silently.
- **Pinned implementation/configuration evidence:** [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts); [apps/api/src/finance/finance.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.integration.spec.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## NANCY-03 — Subcontract payment approval

- **Stable ID:** NANCY-03. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** Subcontract payment approval.
- **Expected workflow:** Khaimook acceptance → Ben work approval → Porn certification → Nancy financial/payment approval.
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

## NANCY-04 — Supplier master ownership

- **Stable ID:** NANCY-04. **Related existing IDs:** PUR03
- **Intake change / decision:** changed / confirmed.
- **Business need:** Supplier master ownership.
- **Expected workflow:** Nancy creates/updates/confirms supplier master, including bank details, replacing older Jai supplier-master ownership; supplier bank schema/authority still need implementation assessment.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** S1 Purchasing supplier master create/update ownership.
- **Source:** [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. Supplier master has Company-scoped create/update/view capabilities and basic contact/tax-registration fields.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Nancy ownership requires observed grant reconciliation; reviewed Supplier schema and create/update contract do not include supplier bank-account history/verification.
- **Recommended action:** Keep Nancy supplier-management authority as the desired matrix; separately scope supplier bank data/protection rather than assume an employee HR bank record covers suppliers.
- **Pinned implementation/configuration evidence:** [apps/api/src/master-data/master-data.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/master-data/master-data.controller.ts); [apps/api/src/master-data/master-data.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/master-data/master-data.service.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## NANCY-05 — Material codes at initial rollout

- **Stable ID:** NANCY-05. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Material codes at initial rollout.
- **Expected workflow:** Nancy creates material codes initially; normal later route Store details → Khaimook review → Jai creates code.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal); [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** Actual handover date from initial to normal material-master owner.
- **Implementation classification:** partially implemented. Material create/update and Company-scoped action permissions exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Initial Nancy versus later Jai code creation can be configured, but the Store request/Khaimook review handoff is not established as a material-master approval record.
- **Recommended action:** Reuse Material identity and management permissions; define the review/creation handoff and explicit rollout transition without another material master.
- **Pinned implementation/configuration evidence:** [apps/api/src/master-data/master-data.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/master-data/master-data.controller.ts); [apps/api/src/master-data/master-data.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/master-data/master-data.service.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## NANCY-06 — Main petty-cash fund and expense approval

- **Stable ID:** NANCY-06. **Related existing IDs:** ACC07, SS15
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Main petty-cash fund and expense approval.
- **Expected workflow:** Nancy holds main fund; field-central fund is Khaimook; each site fund is Store Site. Review route Store → Khaimook → Nancy; each custodian pays and records evidence/balance.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal); S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** Fund limits/replenishment and independent review of requests from Khaimook own fund remain unsettled.
- **Implementation classification:** missing. Payment exists, but the reviewed schema/Finance surface has no fund/custodian/replenishment/petty-cash request ledger.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Nancy main fund, Khaimook field-central fund, site funds and Store→Khaimook→Nancy route lack dedicated implementation.
- **Recommended action:** Scope fund balance, request/review/approval/payment/evidence and reconciliation together; decide substitute reviewer for Khaimook own requests.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts); [apps/api/src/finance/finance.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.controller.ts)

## NANCY-07 — Stock-count scheduling and financial write-off boundary

- **Stable ID:** NANCY-07. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** changed / confirmed with open detail.
- **Business need:** Stock-count scheduling and financial write-off boundary.
- **Expected workflow:** Nancy defines count frequencies by material type. Latest physical stock-count adjustment route is Store Site → Khaimook; financial disposal/write-off authority is not expanded by that answer.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create/count evidence: Store Site. View/check/approve physical adjustment: Khaimook. Foreman: no variance entry, adjustment proposal or approval. Nancy: count scheduling; financial disposal authority remains separate.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** Older S2/S3 count adjustment route through Nancy; only within later FM05 physical-count scope.
- **Source:** [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal); [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal); S6: Owner answers in this conversation, through 30 October 2026.
- **Unresolved questions/design inputs:** C03: determine separately whether the older Nancy write-off step remains for disposal/financial write-off; count adjustment approval itself is settled.
- **Implementation classification:** missing. Reviewed complete schema and inventory controller surface have balances/movements/reservations/issues/returns/transfers, without a canonical count session or count-adjustment endpoint.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Requested Store Site count/evidence → Khaimook approved adjustment is not implemented as a dedicated workflow.
- **Recommended action:** Propose a count/variance/append-only adjustment workflow; separate physical count adjustment from financial write-off.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/inventory/inventory.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory.controller.ts); [apps/api/src/inventory/material-movement.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/material-movement.controller.ts); [apps/api/src/inventory/inventory-report.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/inventory/inventory-report.controller.ts)

## NANCY-08 — Depreciation ownership

- **Stable ID:** NANCY-08. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Depreciation ownership.
- **Expected workflow:** Nancy prepares depreciation initially; Jai maintains asset register.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal); [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal).
- **Unresolved questions/design inputs:** Asset classes, depreciation method/effective dates and financial posting remain separate inputs.
- **Implementation classification:** partially implemented. Equipment registration/site usage exists.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** It is not a verified CG##### fixed-asset/custody/loan/return/depreciation register.
- **Recommended action:** Map reusable Equipment identity first; define asset and custody lifecycle; depreciation remains separate financial scope.
- **Pinned implementation/configuration evidence:** [apps/api/src/equipment/equipment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/equipment/equipment.service.ts); [apps/api/src/equipment/equipment.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/equipment/equipment.controller.ts); [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma)

## NANCY-09 — Bank reconciliation confirmation

- **Stable ID:** NANCY-09. **Related existing IDs:** ACC12, FIN-010
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Bank reconciliation confirmation.
- **Expected workflow:** Porn reconciles → Nancy verifies; no automatic settlement or posting from statement import is assumed.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** S9: Owner accounting answers reproduced in this conversation.
- **Unresolved questions/design inputs:** ACC12 reconciliation frequency is still unanswered.
- **Implementation classification:** missing. Scoped cash-flow/payment data exists.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No bank statement/reconciliation session with Porn preparation and Nancy verification.
- **Recommended action:** Define statement import/matching/differences and accountant boundary; frequency remains an owner decision.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [apps/api/src/finance/finance.controller.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/finance.controller.ts); [apps/api/src/finance/payment.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/finance/payment.service.ts)

## NANCY-10 — Payroll approvals and actual payment

- **Stable ID:** NANCY-10. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Payroll approvals and actual payment.
- **Expected workflow:** ERP calculates → Koh reviews → Nancy approves → Porn prepares transfers → Nancy transfers and records evidence. Closed-period reopening and returned payroll approval require Nancy authority.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); S8: Pinned HR1-A entry contract / DEC-039 / issue 283.
- **Unresolved questions/design inputs:** Later HR payroll slice, statutory settings and source/Finance interfaces remain separately gated.
- **Implementation classification:** missing. Complete business source records cycles/formulas/rounding; no payroll run/calculation model at pinned main.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Payroll, source freezing, actual-hour labour allocation, payslips and accountant exports are later scope.
- **Recommended action:** Do not replace existing payroll until approved configuration, reproducible calculation/Finance posting and separate acceptance.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-ENTRY-PREPARATION.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-ENTRY-PREPARATION.md); [docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md)

## NANCY-11 — Narrow HR substitution exception

- **Stable ID:** NANCY-11. **Related existing IDs:** FND-004, FND-005
- **Intake change / decision:** confirmed existing / confirmed with open detail.
- **Business need:** Narrow HR substitution exception.
- **Expected workflow:** Recorded business request permits Nancy to prepare and approve a payroll run while substituting for Koh with reason and interval. It is not a general self-approval exemption.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); S8: Pinned HR1-A entry contract / DEC-039 / issue 283.
- **Unresolved questions/design inputs:** C04: repository maker-checker rules and HR1-A exclusions require explicit later-stage exception change control before implementation.
- **Implementation classification:** configuration-only. Company-scoped configurable workflows and action capabilities exist.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Named business actors and exact current retained assignments are unverified; seed/demo actors are not operational configuration evidence.
- **Recommended action:** Produce a desired-vs-observed matrix from existing authorized receipts; do not grant/configure during assessment.
- **Pinned implementation/configuration evidence:** [apps/api/src/approval/approval.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/approval/approval.service.ts); [docs/ROLES-PERMISSIONS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/ROLES-PERMISSIONS.md); [deploy/uat/e2-readiness.mjs](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/deploy/uat/e2-readiness.mjs)

## NANCY-12 — HR privacy and launch responsibility

- **Stable ID:** NANCY-12. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** confirmed existing / confirmed.
- **Business need:** HR privacy and launch responsibility.
- **Expected workflow:** Use only approved HR1-A read categories/Companies; approve verified future payroll settings and insurance premiums; confirm HR start only after appropriate testing and separate acceptance.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); S8: Pinned HR1-A entry contract / DEC-039 / issue 283.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. HR1-A canonical employment, encrypted identity/bank history and explicit target-Company/category entitlement backend are merged and CI-tested.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Protected private attachments, full UI/locales/cache/browser, retained activation and separate Owner HR acceptance remain with #283 writer.
- **Recommended action:** Continue existing owner lane; link requirements rather than duplicate HR design or grant access.
- **Pinned implementation/configuration evidence:** [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md); [docs/HR1-A-EMPLOYEE-ACCESS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-EMPLOYEE-ACCESS.md); [apps/api/src/hr/hr.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/hr/hr.service.ts); [apps/api/src/hr/hr.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/hr/hr.integration.spec.ts)