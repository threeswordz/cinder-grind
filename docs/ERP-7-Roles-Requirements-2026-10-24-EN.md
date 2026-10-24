# Construction ERP — Requirements Record for Seven Roles
Prepared: 24 October 2026 (Asia/Taipei)

## Scope and Status
- Source: The user's answers and corrections in this conversation. Where answers conflict, the latest answer supersedes the earlier one.
- Saved at the user's instruction to retain the requirements for roles other than HR.
- Excludes the latest HR, payroll and external accounting-office document workflow conclusions, which the user has not confirmed and instructed not to save.
- This is a business requirements record. It does not establish that the system already supports these requirements, constitute UAT results, or authorize permission changes, system configuration changes or release scope expansion.
- Unresolved items remain pending discussion. Do not invent responsible people, approval limits or rules on the user's behalf.
- The Purchasing person's name appears in Thai as both “คุณจ๋าย” and, in later messages, “คุณใจ.” This record primarily identifies the person by the Purchasing role; the spelling for formal documents remains to be confirmed.

## 1. Ben — General Manager
### Confirmed
- Purchasing prepares the PO → Ben approves.
- Changes to an approved PO: Purchasing prepares a revised version with a reason → Ben approves it again before it is sent to the supplier. Preserve the original version and history.
- Khaimook prepares Subcontract Agreements and Work Orders → Ben approves both document types.
- Khaimook prepares the subcontractor work acceptance document → Ben approves work acceptance → Porn prepares the payment certification → Nancy approves payment.
- Internal Cost BOQ: Ben prepares/submits → Khaimook approves, for both the initial version and revisions.
- Customer BOQ: Ben prepares/submits → Nancy approves, for both the initial version and revisions.
- The Customer BOQ includes a profit markup, and some items may use different units from the Internal Cost BOQ. Preserve the original budget and revision history.
- Project VO: Ben prepares → Nancy approves.
- Foreman submits progress reports → Ben reviews without a formal approval action. Retain correction history.
- Ben's dashboard: Budgets, purchase commitments, actual costs, amounts paid, contract value and approved variations.
- Customer quotations: Ben prepares → Nancy approves before sending. Price changes or discounts require a revised quotation and renewed approval.
- Customer progress billing: Ben confirms the work performed and calculates the progress billing amount → Porn prepares and sends the billing document, with no separate approval.
- Material issues beyond Khaimook's first-level approval authority → Ben approves before materials are issued.
### Pending Discussion
- Substitute approvers during absences and detailed urgent-request procedures. No authorization has been given for preparers to approve their own transactions.
- Linking the two BOQ types, matching different units, calculating profit markups and controlling access to internal costs.

## 2. Nancy — Accounting Manager
### Confirmed
- Approves the Customer BOQ, both initial and revised versions. Khaimook approves the Internal Cost BOQ.
- Approves Project VOs prepared by Ben.
- Approves subcontractor payments after Ben approves work acceptance and Porn prepares the payment certification.
- Porn records supplier invoices for goods, referencing the PO/goods receipt evidence → Nancy reviews and approves before payment preparation.
- Porn prepares proposed supplier payments → Nancy checks the recipient, amount and supporting documents, then approves.
- Nancy performs the actual bank transfers.
- Approves customer quotations and revised quotations prepared by Ben before they are sent to customers.
- Petty cash: Store Site prepares the request with evidence → Khaimook reviews → Nancy approves.
- Prepares depreciation initially, replacing the earlier proposed assignment to Purchasing. Purchasing maintains the asset register.
- Customer progress billing uses the amount confirmed by Ben, with Porn issuing the document. There is no separate billing-document approval step.

## 3. Khaimook — Project Manager / Head of Store
### Confirmed
- Approves the Internal Cost BOQ prepared by Ben, both initial and revised versions.
- Prepares Subcontract Agreements and Work Orders → Ben approves.
- Checks subcontractor work and prepares the work acceptance document → Ben approves.
- Store Site prepares the PR → Khaimook checks the need, items and quantities, then approves → Purchasing proceeds.
- Store Site and Purchasing jointly inspect deliveries against the PO → Store Site records the actual goods received and attaches evidence → Khaimook reviews and approves.
- Checks petty cash requests and their relevance to the project before submission to Nancy for approval.
- Material transfers: Store Site at the origin prepares the transfer → Khaimook approves → The origin records dispatch and the destination confirms receipt, with evidence from both sides.
- Project Manager scope covers assigned projects, with additional access to stock balances and movement history for the central warehouse/other warehouses.
- The confirmed additional central/other-warehouse access is read access. This answer does not confirm additional transaction preparation or approval rights.
- Store Site prepares a material usage plan based on quantities in the approved Internal Cost BOQ → Khaimook approves the plan.
- Provides first-level approval for material issues exceeding the plan. Requests beyond that authority go to Ben.
### Pending Discussion
- The specific additional warehouses or warehouse groups accessible.
- Criteria and thresholds for material issues exceeding the plan, and the person responsible for reviewing urgent issues afterward.

## 4. Purchasing — Jai (Thai name variants: คุณใจ / คุณจ๋าย)
### Confirmed
- After PR approval, requests quotations, compares prices/terms, and selects the supplier and proposed price. Retain quotations and the selection rationale.
- Prepares the PO from the approved purchase request and selected price → Ben approves → Sends it to the supplier and follows up on delivery dates.
- Jointly inspects item descriptions, quantities and condition against the PO with Store Site before the goods receipt is submitted to Khaimook for approval.
- Revises approved POs with a reason and obtains Ben's renewed approval before sending, while preserving history.
- Short, damaged or incorrect deliveries: Jointly records the actual findings with evidence, coordinates missing deliveries, replacements or returns with the supplier, and follows up until resolved.
- Creates and updates supplier information, including name, address, tax identification number and contact details.
- Maintains the asset register using code CG#####, including purchase date, value, location of use and responsible person.
- Nancy is responsible for preparing depreciation initially.
- Views and handles purchasing for all projects in companies the person is authorized to access, with PRs, POs and goods receipts distinguished by project.
- Under the latest answers, Khaimook prepares Subcontract Agreements/Work Orders, replacing the earlier proposed assignment to Purchasing.

## 5. Store Site — Site Store Staff
### Confirmed
- Prepares PRs specifying the project, items, quantities and required-use date → Khaimook approves → Purchasing proceeds.
- Jointly inspects deliveries against the PO with Purchasing, records actual quantities received and attaches evidence → Khaimook approves.
- Prepares a material usage plan based on quantities in the approved Internal Cost BOQ → Khaimook approves the plan.
- Issues within the approved plan: Materials can be issued immediately, recording the requester, work/use, items, quantities and person issuing them.
- Issues exceeding the plan: Multiple criteria determine the approval level. Khaimook provides first-level approval; Ben approves requests beyond Khaimook's authority.
- Urgent issues: Materials may be issued first, with a recorded reason and subsequent review by the responsible person.
- Prepares transfers at the origin → Khaimook approves → Dispatch is recorded and the destination confirms receipt, with evidence.
- Prepares petty cash requests with evidence → Khaimook reviews → Nancy approves.
### Pending Discussion
- The actual combined criteria, numerical thresholds and decision rule when criteria indicate different approval levels.
- The person responsible for subsequent urgent-issue review and detailed exception conditions.
- Do not interpret the urgent material issue arrangement as an exception for all document types.

## 6. Foreman — Site Foreman
### Confirmed
- Records work performed, dates, activities and actual progress, then submits to Ben for review without a formal approval action.
- Corrects submitted reports with a recorded reason, retaining the original, the person making the correction and the timestamp for traceability.
- Records issues, causes, impacts and photos/evidence → Notifies Khaimook to follow up on resolution, with Ben able to view status.

## 7. Porn — Accounting Staff
### Confirmed
- Records supplier invoices for goods, referencing PO/goods receipt evidence, and checks amounts and supporting documents → Nancy reviews and approves.
- After Ben approves the work acceptance prepared by Khaimook, prepares subcontractor payment certification and supporting documents → Nancy approves payment.
- Ben confirms the work performed and calculates the customer progress billing amount → Porn prepares and sends the billing document without separate approval.
- Prepares proposed payments for goods from approved invoices → Nancy approves and performs the actual bank transfer.

## Shared Conclusions and Changes to Preserve
- Return for correction with a reason → The preparer corrects and resubmits → Retain revision/review history. This is a confirmed requirement, not a claim that every module already supports it.
- Remove the requirement for a separate Work Request before the Work Order, following Khaimook's latest answer. This supersedes Ben's earlier Item 11 answer; it is not an instruction to delete historical system documents.
- Latest Project VO workflow: Ben prepares → Nancy approves. This replaces the earlier test arrangement where Khaimook prepared and Ben approved.
- Khaimook approves the Internal Cost BOQ; Nancy approves the Customer BOQ. This replaces the earlier description assigning all BOQ approvals to Nancy.
- Ben's approval of subcontractor work acceptance is separate from Porn's preparation of payment certification.
- The latest normal material issue rule permits immediate issue within an approved plan. It is not a blanket exemption from approval for all normal material issues.
- Saving this record does not confirm the latest HR/payroll requirements and does not change GitHub or the ERP system.


## Repository Intake and Implementation Boundary — 24 October 2026

**Status:** Owner-confirmed business requirements recorded for seven roles; implementation/configuration reconciliation is pending. The owner explicitly requested this GitHub update using the named English source file. The source text above is retained unchanged, including its original snapshot caveats; this repository intake records the requirements without changing ERP behavior. HR/payroll remains excluded.

**Authority:** [Project Governance](PROJECT-GOVERNANCE.md), DEC-008/016/022/028–030 in the [Decision Log](DECISION-LOG.md), the [approved V1.1 scope](V1.1-SCOPE.md) and [business-rule guardrails](V1.1-BUSINESS-RULES.md). This intake does not supersede those implementation boundaries or add work to V1.1-E2. It provides the latest named-person business responsibility input for subsequent scoped design/configuration decisions. Existing controller permissions, active roles, approval steps, source state machines and Company/Project access remain authoritative for current execution.

### Reconciliation Before Any Implementation

| Requirement area | Relationship to existing baseline | Required follow-up / boundary |
|---|---|---|
| PR, sourcing, PO and supplier records | PROC-001–020 and MST-002 provide existing source families | Verify the exact actor permissions and workflow steps. PO corrections must use supported controlled revision/state rules, preserving executed receipts and approvals. |
| Two BOQ types and different approvers | BUD-001–006 preserve the first approved Original Budget and revision history | Design the relationship between Internal Cost and Customer BOQs, units and markup; verify Khaimook/Nancy approval routing. Do not relabel historical budgets, grant new rights or assume two separately approved BOQ models already exist. |
| Subcontract preparer and work acceptance | Existing agreement/WO/claim/assessment/certification source models | Khaimook is the requested agreement/WO preparer. Ben's work acceptance approval is a distinct requested responsibility; it is not evidence of an independent implemented acceptance document or authority to remove an existing certification approval step. Preserve SUB-009 and Finance handoff rules. |
| Project VO: Ben prepares, Nancy approves | Existing Project Variation source and approval configuration | Reconcile permissions, distinct maker/checker and future workflow selection before configuration changes. Earlier Khaimook-maker/Ben-checker UAT observations remain historical evidence for that arrangement, not a pass for this new assignment. |
| Joint goods receipt inspection and Khaimook approval | BR-V11-08 and existing Inventory receipt states | Verify supported inspection evidence and routing. No new Jai confirmation/return/partial-receipt transition is introduced by this document. |
| Plan-based material issues and urgent exceptions | BR-V11-12 and existing approved issue/return lifecycles | Multi-criteria thresholds, conflict resolution and the later urgent-issue reviewer remain unspecified. Design and approve any changed approval/posting behavior before implementation; no implicit approval bypass. |
| Transfers and destination acknowledgment | Existing source/destination stock posting under BR-V11-12 | Design any separate receipt acknowledgment without posting stock twice or changing existing atomic movement/reversal semantics. |
| Extra warehouse read access | Existing Company/Project/source permission boundaries | Confirm the exact warehouses and permitted read paths. No implicit cross-Project write/approval grant or new warehouse-scoping capability is claimed. |
| Customer quotations, progress billing, petty cash, fixed assets and depreciation | DEC-028 broader-module deferrals / BR-V11-16 | Capture for separately approved scope/design. Customer billing without a separate document approval must not bypass existing FIN-013 Client Invoice approval; determine the document boundary before implementation. Asset code CG##### does not amend live numbering rules. |
| Return for correction and source documents | Existing owning-module state machines and immutable history | Map each document's supported correction/replacement path. Do not assume rejected agreements can be edited/resubmitted, or infer a new transition from the general requirement. |

### UAT and Next Action

Keep [Issue #233](https://github.com/threeswordz/cinder-grind/issues/233) open and retain existing evidence with its original candidate/configuration. Unchanged technical/role checks may still be useful; cases affected by changed actors or workflows require a scoped comparison and, after authorized changes, retesting. AC-V11-023–030 and human owner acceptance are not completed by this requirements intake. Reconcile against the [current documented checkpoint](CURRENT-STATE.md) and fresh GitHub before future material writes. Do not rewrite historical test records or apply the unconfirmed HR/payroll discussion.
