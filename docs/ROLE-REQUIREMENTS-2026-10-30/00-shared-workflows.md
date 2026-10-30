# Shared workflows and cross-role rules

> **Current execution precedence — Owner #288, 30 October 2026:** Accounting development is deferred; HR1-A #283 keeps its existing designated writer. The original L0/L1/L2 values below are **historical workflow risk flags**, not a current coding order. Read [13-execution-disposition.md](13-execution-disposition.md) and [11-launch-scope-and-next-package.md](11-launch-scope-and-next-package.md) before selecting new work. Existing BOQ/operational/Finance controls and the approved scoped HR privacy matrix remain intact; this document is not new implementation or Production authority.


**Prepared:** 30 October 2026, Asia/Singapore. **Assessment baseline:** `4fd3635ed06510dc4759e00061cfc92d6cbad2bc`.

This is a reconciled business-requirements and source-assessment record, not a statement that every requirement is implemented, configured, accepted or approved for Production. Named people identify business functions, not hard-coded authorization checks.

- **Intake change:** new / changed / confirmed existing is relative to the 24 October seven-role baseline (S1); it is independent of implementation status. New editorial IDs are traceability labels, not invented original question IDs.
- Existing question IDs and enterprise IDs are retained. Related IDs link shared responsibilities; they are not automatically equivalent implementation contracts.
- **Historical risk flag (not current build priority):** L0 = before relying on the affected financial/stock/security workflow; L1 = before full role workflow use, or a separately accepted pilot workaround; L2 = deferred/conditional next scope. These priorities do not authorize implementation.
- Permission/configuration activation is unverified in this assessment. Accepted V1.2/BOQ evidence stays closed; only materially changed paths need new verification.
- Cross-role authority is in [00-shared-workflows.md](00-shared-workflows.md); sources/contradictions are in [12-decisions-and-sources.md](12-decisions-and-sources.md).

**WF-04 new cross-module budget/expense-first development is deferred under #288; existing approvals are preserved.**

## Workflow matrix

| Editorial ID | Workflow | Preparation / handoff | Approval / review | Shared invariant | Original/related IDs | Observation |
| --- | --- | --- | --- | --- | --- | --- |
| WF-01 | Internal Cost BOQ / revision | Ben | Khaimook | Approved version retained; no customer-price right | BEN-BASE-04,PM04 | implemented |
| WF-02 | Customer BOQ / revision | Ben | Nancy | Approved linked commercial snapshot; no auto-resync | BEN-BASE-04,NANCY-01 | implemented |
| WF-03 | PR / partial correction | Store Site | Khaimook | Only approved demand proceeds to Jai; per-line requested | PM01,PM02 | partially implemented |
| WF-04 | Over-budget demand / commitment | Khaimook reason; Ben revision | Nancy financial budget approval; ordinary document approval remains | Check item/category plus Project; no auto budget rewrite | PM03,BEN03 | partially implemented |
| WF-05 | RFQ / quote-count exception | Jai | Ben with PO | Whole-PO VAT-exclusive amount basis; no invented supplier default | PUR01,PUR02,PUR11 | partially implemented |
| WF-06 | PO / revision | Jai | Ben | Renew approval before sending revised supplier document | PUR04,PUR05 | partially implemented |
| WF-07 | PO cancellation / outstanding balance | Jai | Khaimook need review → Ben approval | Respect received/invoiced obligations; no deletion | PUR10 | partially implemented |
| WF-08 | Physical GR / document check | Store physical receipt; Jai remote evidence check | Khaimook | Post actual correct/good receipt once; preserve partial evidence | SS04,SS06,PUR09,PM06 | partially implemented |
| WF-09 | Usage plan and material issue | Store plan; Foreman oral/chat request; Store ERP entry | Khaimook plan; beyond-plan Khaimook then Ben beyond authority | Within approved plan immediate issue; stock safety still applies | SS-PLAN-01,SS07,SS08,FM04 | partially implemented |
| WF-10 | Stock transfer | Origin Store | Khaimook | Origin dispatch → destination actual acknowledgment; cross-Company separate policy | SS10,PM07 | partially implemented |
| WF-11 | Stock count / physical adjustment | Store Site evidence | Khaimook | No Foreman variance/proposal/approval authority | SS12,PM08,FM05 | missing |
| WF-12 | Supplier claim / replacement | Store actual evidence; Jai supplier coordination | Khaimook anomaly decision | Stock effect and source links remain distinct | PUR14,SS09,PM06 | partially implemented |
| WF-13 | Petty cash | Store / custodian | Khaimook review → Nancy approval | Custodian pays and records; own-request reviewer unresolved | SS15,PM-CASH-01,NANCY-06,ACC07 | missing |
| WF-14 | Subcontract agreement / WO | Khaimook | Ben | WO from approved agreement; no separate Work Request | PM10,PM11,BEN-BASE-02 | configuration-only |
| WF-15 | Subcontract acceptance / certification | Khaimook physical work → Ben acceptance → Porn certification | Nancy payment approval | Reuse canonical claims/assessment; semantic gap remains | PM12,BEN-BASE-03,PORN-SUB-01 | partially implemented |
| WF-16 | Project VO / quotation | Ben | Nancy | Different commercial documents; source revision retained | BEN-BASE-05,BEN-BASE-06 | configuration-only |
| WF-17 | Supplier invoice discrepancy | Porn checks; Jai resolves mismatch | Nancy AP approval | Hold discrepant item → corrected document → Porn recheck | ACC02,ACC03,PUR15 | partially implemented |
| WF-18 | Payments and instruments | Porn prepares | Nancy financial approval | Nancy bank transfer; Ben cheque signature; Porn cheque custody/status | ACC04,ACC05,ACC06,ACC08 | partially implemented |
| WF-19 | Bank reconciliation | Porn | Nancy verification | Frequency still pending; no inferred clearance | ACC12 | missing |
| WF-20 | Customer progress billing | Ben confirms/calculates → Porn issues | No extra commercial billing approval; Finance approval boundary unresolved | Do not bypass Client Invoice approval | BEN-BASE-06,ACC13–ACC17 | partially implemented |
| WF-21 | DPR / corrections | Foreman | Ben review; no formal approval | Before next workday; planned-stopped days; append corrections | FM01 | partially implemented |
| WF-22 | Site issues | Foreman | Khaimook follow-up → Foreman verifies → Khaimook closes | Stoppage/delay risk immediate Ben; asset severity screened by Khaimook | FM03 | partially implemented |
| WF-23 | Weighted physical progress | Foreman reports / plan defines weights | Ben confirms work-plan weights | Quantity/milestone source; never sums heterogeneous units | FM02 | partially implemented |
| WF-24 | Project closure | Khaimook checklist | Ben AND Nancy | Outstanding obligations retained with reason/item/balance/owner/due date | PM16,BEN04 | missing |
| WF-25 | Site time / HR | Each Store own site; Koh checks | HR source routes | Submitted on15/end; return before site edits; actual small-job hours | SS-HR-01,PM14,KOH-03 | missing |
| WF-26 | Leave / OT | Office self / Store leave / PM worker OT | Confirmed HR role chain then Ben where required | No wage/identity disclosure to site roles | SS-HR-02,FM-HR-01,PM-HR-01,KOH-04 | missing |
| WF-27 | Payroll / actual transfer | Koh reviews → Nancy approval → Porn transfer preparation | Nancy execution/evidence | Later HR scope; statutory inputs and substitution exception unresolved | KOH-05,KOH-06,NANCY-10 | missing |

## Shared scope and data rules

1. Company/Project access comes from persisted authority; all-Project report/read permission does not grant create/edit/approval. Additional warehouse read and HR-only Company entitlements stay separate.
2. Approved Internal Cost BOQ reads: Ben/Nancy/Khaimook Full Cost; Jai/Store/Foreman Quantity Only; Porn no blanket internal line-cost grant and only specifically authorized Finance/Project totals. Customer line rates/markup/margins: Ben/Nancy only. C01 records the conflicting PDF request without granting it.
3. Every new monetary transaction uses THB. Historical denomination, amount, NULL provenance, originals, approvals and audit are preserved. Accepted currency tests stay closed.
4. Project → WBS → Activity is canonical; Cost Code is independent. Committed, Actual and Paid Cost stay distinct. No inventory valuation or GL posting is inferred from quantity movements.
5. Cross-Company material transfer is requested but not authorized merely by all-Project scope or HR access. #245 multi-Project purchasing and its Finance implications stay deferred until explicit change control.
6. Retain rejection/return/correction reasons and original versions. Submitted/approved documents do not become editable merely because a user is named as preparer.
7. Names identify functions; server action rights, target ownership and configured step roles enforce authority. Technical SYS_ADMIN is not a business approver. Fixed login roles remain; no role switcher.
8. BEN02 emergency types/reviewers are confirmed; spending limit remains pending. It is not an unlimited, all-document, over-budget or maker-checker bypass.
9. Nancy's recorded payroll self-approval request is a narrow future policy exception, excluded from HR1-A and not implemented by this assessment.
10. Koh role details link the existing complete HR package. A worker need not have an ERP login; Project membership/DPR headcount are not actual attendance.

## Approval route versus configuration proof

All person-to-role mappings above are **desired business routes**. Workflow definitions/step-role engine support several routes, but no fresh retained MKE/TCJ grant or workflow capture is included here. Do not mark a named route active from a seed file, old UAT actor, CI fixture or an approval in conversation.