# Owner decisions — 16 November 2026

**BOQ supersession — 21 November 2026 / DEC-054:** Queue 5's Jai/Porn Full Cost answer is retained below as the 16 November source record and is no longer the current BOQ direction. Use [BOQ scope Section 3](../BOQ-COMMERCIAL-SCOPE.md#3-current-owner-confirmed-boq-policy--dec-054). Unaffected decisions in this file remain; no duplicate current matrix is maintained here.

**Status: OWNER-CONFIRMED REQUIREMENTS; ENGLISH PUBLICATION AUTHORIZED.** This is the current business-answer overlay for the original 112-ID role assessment. [DEC-047](../DECISION-LOG.md#dec-047--16-november-owner-requirement-amendments-publication-only) records the publication and the explicit successor-policy differences.

## Authority, evidence and implementation boundary

The Owner supplied the selections and corrections below in the requirements conversation, reviewed an English side-by-side comparison against repository main `1dc8faa33a04834f9b8a3d471c0d7e9e7e170213`, received the concrete requirements-only PR layout, and then instructed: **“in english, update github repo with the latest details as above”**. This file is an English compilation of those answers, not a verbatim full transcript, a fabricated GitHub approval receipt, or a new human-UAT acceptance. Thai names remain in their Owner-confirmed spelling.

This publication changes requirements and traceability only. It changes no application code, schema, migrations, live grants, approval configuration, retained MKE/TCJ data, financial/stock history or deployment. [#288](https://github.com/threeswordz/cinder-grind/issues/288) still governs Accounting implementation sequencing; later Attendance/OT/Leave/Payroll stays separately scoped. Full GL is required when Accounting first launches, not an instruction to displace the current operational prototype work. Existing technical CI/review, DEC-042 comprehensive frozen-prototype UAT and separate Production authorization remain.

Preserve the original 112 IDs, 30 October observations and [frozen execution inventory](data/requirements-execution.json) byte-for-byte. Its older lanes and unresolved labels are historical evidence, not the latest answer state. Queue numbers below are conversation navigation labels, not newly minted enterprise requirement IDs. New financial detail is traced under existing parents without pretending its implementation belongs to the original runtime slice.

## 1. Canonical personnel and staffing

| Person/group | Current title or count | Requirement interpretation |
| --- | --- | --- |
| Ben — คุณเบน | General Manager | Existing business approval functions remain separately configured. |
| Nancy — คุณแนนซี่ | Accounting Manager; also performs system-administration duties | Administrative access closure is separate from financial approval authority; no automatic SYS_ADMIN business bypass or role switch. |
| Porn — คุณพร | Head of Accounting | Title correction does not implicitly grant new actions or approval authority. |
| Koh — คุณโก๊ะ | HR | Existing HR and private-data scope remains explicit. |
| Jai — คุณใจ | Purchasing | Use the Owner-confirmed Thai spelling throughout current descriptions. |
| Khaimook — คุณไข่มุก | Project Manager and Head of Stores | Use this corrected Thai spelling throughout current descriptions. |
| Foremen | Approximately 5 people | Approximate staffing, not five created accounts or a shared role login. |
| Storekeepers | Approximately 5 people | Separate individual identities and site assignments must be configured at onboarding. |

Technical identifiers, existing filenames and historical source links are retained. These names identify business functions; do not hard-code literal names into authorization checks.

## 2. Operational answers

| Conversation question / existing IDs | Latest confirmed requirement | Preserved boundary / remaining input |
| --- | --- | --- |
| BEN02.2 / BEN02 / BEN03 | Before emergency expenditure, Ben must determine the limit for that individual incident. Expenditure may exceed the original approved budget within that incident-specific limit, with reasons/evidence and retrospective Ben work review then Nancy financial review. | No automatic/unlimited cap or automatic original-budget increase. Already selected emergency types are safety, property protection and site stoppage. A scoped implementation must define evidence/document boundaries and retrospective review completion timing, which were not newly specified. DEC-044 synthetic overage rules are not silently bypassed. |
| Queue 1 / NANCY-07 / SS12 | Nancy sets stock-count schedules separately by site or Project. | Actual frequencies/dates are configuration inputs. Store capture/evidence then Khaimook physical-adjustment approval remains; Foreman receives no count-adjustment authority. |
| Queue 2 / PM08 / SS13 / NANCY-07 / C03 | Khaimook checks proposed disposal/write-off of damaged, lost or discarded materials; Nancy approves the disposal and financial consequence. | Separate from the already approved quantity-count adjustment route. No valuation, posting formula, disposal ledger or write-off runtime is introduced by this record. |
| Queue 3 / PM09 / SS-PLAN-01 | For an already permitted urgent material issue with incomplete documents, the preparer supplies all documents/evidence within 48 elapsed hours from actual issue, including holidays. Khaimook checks everything and confirms closure of the outstanding-document item. | This is the urgent ISSUE-document deadline, not the pre-PO RECEIPT link deadline. It does not authorize new early use, unapproved-plan issue or a budget bypass. |
| Queue 4 / SS18 / PM05 | Khaimook assigns temporary Store cover. In the assigned site, the Storekeeper may create material requests/PRs; record receipts/evidence; record issues, returns and transfers including destination receipt; record tool loans/returns; record physical counts/evidence; edit permitted drafts and request submitted-document correction/cancellation through existing routes. | Existing approval routes remain. Access is assigned-site-only and ends with the cover assignment; not broad Company access or substitute approval authority. No grants are activated here. |
| Queue 5 / PM05 / JAI-SCOPE-01 / PORN-BOQ-01 / BUD-011 / BUD-015 / C01 | Both Jai and Porn may read Internal Cost BOQ quantities, unit costs and total budgeted costs within explicitly authorized Company/Project scope. | This amends the former Jai Quantity Only / Porn safe-total-only BOQ direction as a successor requirement. It does not activate grants. Client BOQ/customer prices/margins remain restricted to Ben/Nancy. Cost read authority adds no edit/approval authority. |
| Queue 6 / PUR10 / BEN-BASE-01 | After Jai's coordination, supplier refusal to cancel is decided jointly by Ben and Nancy. For cancellation penalties/expenses, Ben confirms the agreement then Nancy approves the expense. Where goods are already partly received, Ben decides case by case. | Normal Jai request → Khaimook need check → Ben approval remains. No automatic deletion/reversal of received/invoiced/paid history. Supplier refund/return/credit handling must retain canonical sources and the appropriate financial implementation scope. |

### Existing transfer and receiving decisions: reference, do not duplicate

- [#352](https://github.com/threeswordz/cinder-grind/issues/352) and [PR #355](https://github.com/threeswordz/cinder-grind/pull/355) already record: deduct origin on dispatch; credit only actual accepted destination receipt; Khaimook explicitly assigns an eligible active destination-Project Employee if destination Store is unavailable. DEC-046 is reserved by that separate entry. Do not reopen these choices or modify that branch from this publication.
- [DEC-045 / receiving custody](../OP-RECEIVING-CUSTODY-01.md) already requires approved-PO linkage within 48 elapsed hours of original physical receipt and unavailable stock until canonical Khaimook-approved GR. Queue 3's identical duration governs a different event and creates no custody exception. The preserved-data receiving/security operator [PR #356](https://github.com/threeswordz/cinder-grind/pull/356) is a separate active package.

## 3. Accounting answers

These confirmed requirements remain under the Accounting implementation deferral, not an active permission or implementation rollout. Earlier answers reproduced during this conversation identify regular payment dates and reconciliation frequency; they do not establish actual configured schedules. For detail that could not be fully recovered, see Section 7 instead of inventing a selection.

### ACC01.1–ACC01.3 and queue 7 — GL, tax and external accountant

- The first Accounting launch must include chart of accounts, journals, trial balance and period closing, alongside the requested AP/AR and receipt/payment scope.
- **Queue 7 resolves GL responsibility:** Porn prepares and records GL entries in ERP → the external accounting office checks and identifies corrections. Its handling of GL does not remove the ERP GL requirement.
- Export purchase/sale documents, invoices, receipts, payment/receipt vouchers; AP/AR and receipt/payment reports; input/output VAT and WHT data; bank statements and reconciliation reports.
- Selected formats: Excel, PDF reports/supporting documents, and original attachment/image files. Send monthly and additionally on request. CSV/API integration was not selected.
- In ACC01.2, the Owner assigned GL information and the accounting asset/depreciation register to the accountant rather than selecting them in that export checklist. Preserve the queue 7 clarification above; exact GL exchange templates remain design inputs. Jai's existing operational asset-register function is not revoked.
- ERP produces and retains internal input/output tax reports, WHT certificates and WHT summaries, plus the selected tax data/forms for accountant review/filing. The Owner's explanation overrides the checkbox wording that could otherwise mean ERP stores documents only and produces no reports.
- The accountant checks documents/tax amounts, prepares and files monthly/annual returns, calculates and advises tax payable, and advises/corrects tax items. The office remains a file-handoff recipient; no direct ERP login is granted.

### ACC03.3 — Release mismatched supplier invoice hold

Jai coordinates source correction; Porn rechecks and confirms release. Retain all four selected evidence groups:

1. Corrected supplier invoice.
2. PO and GR matching the correction.
3. Hold reason and correction details.
4. Relevant confirmation, such as purchasing confirmation of price or receiver confirmation of quantity.

No new tolerance is inferred. Correct quantity/price against PO/receipt before payment; preserve original and corrected history.

### ACC04.1–ACC04.2 — Payment evidence and failure

| Channel / event | Owner-selected evidence or action |
| --- | --- |
| Bank transfer | Successful transfer slip; bank statement or bank debit confirmation; recipient receipt OR acknowledgment message. |
| Cheque | Copy with number/date/payee; delivery or signed-receipt evidence; bank clearance evidence; recipient receipt. |
| Cash — latest corrected ACC04.1.3 | Signed payment voucher; recipient receipt; recipient name, date, amount and payment details. The signed voucher was explicitly added in the corrected answer. |
| Failed transfer, returned/cancelled cheque | Restore AP to outstanding when Porn checks the evidence and confirms the item; Porn is the confirming actor. Do not add an unselected Nancy approval at this point. |

Evidence is required at its applicable lifecycle stage: cheque-clearance evidence cannot exist at draft preparation. Exact stage enforcement is a design input; approval, actual execution and clearance must remain distinguishable. Existing Ben cheque signature and Porn tracking responsibilities remain.

### ACC05.1 — Reimbursement

Retain receipt/tax invoice; evidence the claimant actually paid; expense details/reason for advancing personal funds; related Project/work; prior purchase/spending approval evidence **if available**.

- Director or office employee → Nancy directly for reimbursement approval.
- Site employee → Khaimook checks → Nancy approves reimbursement.

### ACC07.5–ACC07.6 — Funds and custodian requests

| Custodian / fund | MKE limit, THB | TCJ limit, THB | Limit-change authority |
| --- | ---: | ---: | --- |
| Nancy / main fund | 45,000 | 55,000 | Nancy approves herself. |
| Khaimook / field-central fund | 2,000 | 3,000 | Nancy approves. |

These are separate Company limits, not one pooled MKE+TCJ fund of 5,000 THB. Limits are not evidence of cash on hand or permission to fabricate opening balances.

Site fund limit changes: Khaimook proposes → Nancy approves → Porn is informed. Normal site petty cash: Store prepares → Khaimook checks → Nancy approves. Khaimook's own claim: Nancy checks/approves. Nancy's own claim: Nancy approves herself under the specifically confirmed exception; this is not a blanket self-approval exemption for other workflows.

### ACC09 / ACC10 / ACC11 / ACC12

| ID | Confirmed requirement |
| --- | --- |
| ACC09 | Regular supplier/expense payment on the 15th and month-end, with complete documents 7 working days beforehand. Holiday shifting and out-of-cycle authorization were not specified by this answer. |
| ACC10.1–ACC10.3 | Smaller advances are deducted on first settlement; larger amounts, e.g. piles/steel, may be applied over instalments under each agreement. Jai coordinates the supplier; Porn follows refunds. No numerical small/large threshold was supplied. |
| ACC10.4 | Without PO, retain supplier quotation, deposit request/invoice, purchase contract/agreement evidence such as email/chat, and reason for advance payment plus Project/work. Ben confirms the purchase agreement → Nancy approves payment. |
| ACC11.2 | Agreed instalments: Porn prepares plan → Ben confirms → Porn checks and records → Nancy approves. Retain original contract/PO/agreement, creditor confirmation evidence, instalment amounts/due dates/conditions, and invoice/debt reference. |
| ACC12 | Porn performs bank reconciliation on the 1st of each month → Nancy checks. |

Extra partial-payment requests outside the original agreement are not assigned the same route by implication.

### ACC13.1 / ACC14.7 — Billing, AR and retention

- Ben confirms work/value → Porn issues and sends billing/invoice; no repeated billing approval. The earlier answer reproduced here identifies billing and the AR invoice as the same document, not two receivables.
- **Create AR immediately on Porn's issuance.** This is the Owner-selected successor requirement against FIN-013's existing approval-before-approved-receivable rule. The entry design must reconcile recorded Ben confirmation, issuance, AR recognition and existing financial states explicitly, never silently bypass the deployed approval service.
- Retention deducted from the final instalment uses a **contract-specific base and percentage**. No universal percentage, before/after VAT basis or rounding rule was selected.
- Progress-billing source inputs reproduced here include contract/PO, instalment terms/due dates, Ben-confirmed quantities/value, customer acceptance, prior/cumulative/remaining amounts and approved VO. Ben announces the billing instalment; Store supplies completed-work evidence; Porn collects and prepares billing support. Do not invent the missing full verifier answer.

### ACC15.1 — Other income and borrowing scope

Other income: sale of scrap/surplus materials; rental of tools/machinery/equipment; disposal sale of old assets/equipment; other services outside the construction contract.

Treat company borrowing as a separate scope: the **company borrows/receives funds and repays the lender only**, including directors, finance companies and individuals. Nancy approves borrowing/receipt. Support interest-bearing and interest-free agreements. The latest answer replaces the earlier selection of both borrowing and lending: **company lending to directors/other persons is excluded**. Do not classify borrowed principal as sales/service revenue. Repayment authorization, schedules and interest formulas still need their own scoped detail; no automatic new workflow or employee-loan scope is authorized.

### ACC16.5 — Customer receipt and AR allocation evidence

Retain the six selected groups:

1. Customer transfer slip or payment evidence.
2. Cheque copy and successful clearance evidence, when paid by cheque.
3. Company-issued receipt.
4. WHT certificate, when withheld.
5. Retention/other deduction details, when deducted.
6. Receipt allocation to the applicable invoice/instalment.

Bank statement/credit confirmation was not selected as an additional mandatory ACC16.5 item. Do not copy outbound-transfer evidence requirements into inbound receipts automatically. Receipt/AR verification actors beyond the recovered answers remain explicit in Section 7.

## 4. Queue 15 — Multi-Project purchasing and Finance

Trace to PUR06, FIN-001/002/006/007/010/011 and [#245](https://github.com/threeswordz/cinder-grind/issues/245).

- Support either one supplier invoice combining multiple Projects or separate invoices according to the supplier's actual documents.
- Support either one payment covering several Projects or separate Project payments.
- **Porn verifies Project allocation of purchase amounts/costs before Nancy's financial approval.**

This is an explicit Owner-selected successor direction against DEC-018's one-Project Supplier Invoice, DEC-019's one-Project Payment and DEC-020's whole-Payment single-Project cash-flow attribution. Preserve those decisions as historical/current-runtime evidence; record the successor contract before implementation. Do not split one external invoice into duplicate internal copies to bypass uniqueness, or count supplier commitment, Actual Cost, Paid Cost or cash flow twice.

Still needed for the #245 entry design: invoice-line settlement and partial-payment allocation; tax/discount/freight attribution; unallocated balances; rounding/residuals; restricted-Project visibility/redaction; source lineage and reversal/concurrency behavior. This answer does not authorize cross-Company payments or launch the #245 implementation. Actual delivery destination remains distinct from Project commercial allocation.

## 5. Queue 16 — MKE/TCJ intercompany material transfers

Trace to SS10 / transfer part of PM07 and a separately bounded intercompany Finance successor:

1. Value transferred material at the **origin warehouse's accounting cost**.
2. Record intercompany balances; offset or settle the net balance periodically.
3. **Nancy approves valuation and financial terms.**

The Owner did not specify the settlement interval/date, detailed cost-layer method, journal/tax templates or financial recognition timing. Do not invent them or treat a physical move as automatic Actual/Paid Cost. This financial ownership/valuation scope is separate from #352 / PR #355's same-Company dispatch/receipt entry, which excludes intercompany Finance. No intercompany ledger, GL posting or grant is implemented here.

## 6. Queue 11 and queue 14 — HR answers completed after the initial publication proposal

### Queue 11 / KOH-04 / KOH-08 — Employee self-service

Eligible selected groups: **office employees, Foremen and Storekeepers**. Site workers were not selected for personal ERP access in this scope. Each person sees only their own records and may:

- Submit leave requests and view status.
- Submit OT requests and view status.
- View leave entitlements and remaining balances.
- View attendance and request corrections.
- Request personal-data corrections for HR review.

Correction requests are not direct edits to approved attendance/private data. Existing approval routes remain. Payslip viewing/downloading was not selected; HR document/slip distribution remains as previously specified. This resolves the self-service ambiguity in HR source Section 17 / question 96, not the still-unanswered benefit/leave policy details or an expansion of current HR1-A implementation. Company/employee ownership, masking/history and fixed login roles remain.

### Queue 14 / KOH-08 — Offboarding responsibility and access cutoff

| Item | Latest confirmed responsibility |
| --- | --- |
| Return tools/equipment/assets | Supervisor or the custodian responsible for each asset type checks/confirms → informs Koh. |
| Outstanding money/advances/amounts to return and remaining entitlements | Koh consolidates everything → Nancy checks and approves the final summary. |
| ERP account/access closure | Koh confirms departure and final working day → informs Nancy in her system-administrator function → access ends **at the end of working hours on the employee's final working day**. |

No universal clock time/timezone was selected. A scoped design must resolve each person's confirmed cutoff to an unambiguous timestamp and enforce access/session closure; this publication does not disable accounts. Do not make departure access closure wait indefinitely for unresolved asset/financial items or infer a new salary-withholding policy. Remaining work-handover/offboarding-document checklist owners not covered by these answers must be sourced rather than guessed.

## 7. What remains unanswered versus source recovery/design work

### Five remaining conversation questions

| Queue | Pending topic | No assumed answer |
| --- | --- | --- |
| 8 | Allowances and other additions | Rates, formulas, eligibility and conditions for subsistence/travel allowance, telephone, vehicle care, bonus and other additions. Questions 8.1–8.3 returned “No selection”; that is not a zero amount or “not supported.” |
| 9 | Attendance bonus | Amount and effect of absence, lateness and each leave type. |
| 10 | Leave-policy detail | Evidence, advance notice and retrospective request limits for sick, maternity and unpaid leave. |
| 12 | Cumulative/history data | Employment-start/year-start/ERP-start boundary and treatment of incomplete earlier balances. |
| 13 | HR/Payroll funds | Which funds and whether deduction, remittance, arrears and refund tracking are required. |

Queues 1–7, 11, 14, 15 and 16 are answered to the extent stated; BEN02.2 is answered as above. Do not repeat them merely because October files say “unanswered.” Queue 14 cutoff was subsequently answered explicitly; it is not pending. The original eight-question Accounting follow-up round is completed, not reopened by this table.

### Missing earlier source detail is not an Owner refusal or a new selected answer

Site fund amounts previously said to be answered; complete ACC14 verifier wording; ACC16 actor allocation beyond evidence; ACC17 AR reminder/escalation responsibilities; and approval of additional partial-payment requests outside agreed instalments were not fully recovered in this conversation. Retrieve their actual source before asking again or configuring those paths. Do not replace old questions with invented defaults.

### Design/configuration inputs remain distinct

Actual site count dates, stock minima, warehouse lists, material/UOM conversion examples/effective dates, material-code handover, verified statutory/formula settings, real user/Company/Project membership and export templates remain scoped inputs. This publication settles neither all implementation gaps nor Production readiness.

## 8. Traceability and follow-on implementation

| Requirement family | Current answer disposition | Implementation disposition |
| --- | --- | --- |
| BEN02.2; NANCY-07/SS12; PM09; SS18; PUR10 | Confirmed additions/clarifications in Section 2 | Existing runtime evidence preserved; remaining changed paths need bounded delivery/configuration and applicable review. |
| PM05/JAI-SCOPE-01/PORN-BOQ-01/BUD-011/015 | Confirmed successor disclosure amendment | No activated permissions; accepted V1.3 history stays closed. |
| ACC01–16 selected subquestions | Confirmed as detailed in Section 3 | New Accounting remains deferred under #288; no code/grant or acceptance progress claimed. |
| PUR06 / FIN Project attribution | Confirmed successor direction, detailed entry design still required | #245 remains separately gated. |
| SS10 / PM07 intercompany Finance | Confirmed valuation/settlement direction | Separate intercompany successor, not the current same-Company transfer entry. |
| KOH-04/KOH-08 self-service/offboarding | Queue 11 and queue 14 confirmed | Later HR scope; existing HR1-A privacy/identity controls preserved. |
| Queues 8/9/10/12/13 | Deferred/unanswered | No defaults, formula implementation or completion claim. |

Update the current source notes, not the frozen assessment census. Follow-on technical acceptance must demonstrate actual behavior, denied paths, no duplicate financial effects and preserved history; its exact scope belongs in the future entry contract. This requirements publication itself closes no prototype milestone, GL readiness gate, human acceptance or Production gate.
