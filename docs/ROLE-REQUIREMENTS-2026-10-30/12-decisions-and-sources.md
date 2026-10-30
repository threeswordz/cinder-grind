# Reconciliation decisions, contradictions and sources

> **Current execution precedence — Owner #288 (30 October 2026):** new Accounting work is deferred, approved HR1-A #283 continues under its designated writer; original audit L0/L1/L2 are historical risk flags, not implementation order. See [13-execution-disposition.md](13-execution-disposition.md). No new code scope, Finance/grants change or Production authority.


## Authority and preservation

Repository governance/hard constraints and approved Decision Log govern implementation. Latest owner answers settle the specific recorded business questions; where a supplied summary conflicts with an approved scope/security policy, retain both and require explicit change control. This assessment does not change either source.

Original source files remain untouched. Supplied PDF extracts are included as extracted text, **not original PDF bytes**; the original PDF links below remain the sources. The complete published HR Markdown is preserved byte-for-byte, SHA-256 102d8023e8e8cbe65fd3ee6cb0e99cfd314f2307ba19ff1ed386b1a0786da0cf. Current conversation sources S6/S9 are transparent compilations, not an invented full transcript.

## Resolved changes applied consistently

| Change | Latest answer | Earlier rule replaced / retained boundary |
| --- | --- | --- |
| Stock count | Store Site records actual count/evidence → Khaimook checks/approves physical adjustment; no Foreman variance/proposal/approval | Earlier Store+Foreman+PM count / Nancy physical adjustment in S2/S3; does not settle separate financial write-off |
| Supplier master | Nancy creates/updates/confirms suppliers, including bank information | S1 Jai supplier-master ownership replaced |
| Receiving inspection | Store physically inspects; Jai checks documents/photos/quantities; PM approves | Earlier joint physical inspection every delivery replaced |
| Material requests | Foreman oral/chat → Store ERP request; no Foreman PR | No assumption that the request module exists |
| Daily reports | Before next workday; no-work report only on planned workdays stopped | Normal holidays excluded |
| Progress | Work-plan weights confirmed by Ben | Not direct sums of quantities or assumed BOQ monetary weighting |
| Issue escalation | Asset severity assessed by Khaimook; every stoppage/delivery-delay risk immediately to Ben; phone/message plus ERP | Phone/chat is an external human step, not an implemented connector |
| Budget guard | PO/amendments, agreement/WO/amendments, non-PO/WO expenses; item/category plus Project budgets | PR was not selected in BEN03.1; existing PM03 excess-demand route remains |
| Closure with outstanding items | Joint Ben/Nancy; reason, pending item/amount/quantity, owner and due date mandatory | Warning does not erase liabilities or stock |
| Emergency | Safety, property protection, site stoppage; Ben work review then Nancy finance review | Limit remains unselected; no unlimited permission |

## Genuine remaining conflicts / decisions

| ID | Requirement/source | Disposition | Decision before affected implementation |
| --- | --- | --- | --- |
| C01 | S3 PM05 full cost for Jai/Porn vs approved V1.3 matrix S7 | Preserve approved matrix; no widened grants | Whether broader full-cost access is actually intended; explicit change control, not repeated BOQ UAT |
| C02 | S1 no-extra progress-billing approval vs FIN-013 financial invoice approval; ACC13–17 unanswered | Keep commercial and financial purposes distinct | Controlled billing handoff versus explicitly changed Client Invoice lifecycle |
| C03 | S2/S3 physical count/write-off route vs FM05 | Physical count route settled; disposal separate | Disposal/financial write-off actor; do not repeat Foreman authority question |
| C04 | S5 Nancy payroll self-approval vs maker-checker / HR1-A exclusion | Preserve request; no activated exception | Later narrowly scoped policy/entry change, interval/reason/audit |
| C05 | PUR06 multi-Project PO vs #245/DEC-018/019/020 | Desired outcome captured, implementation deferred | Invoice/payment/cash-flow allocation and scope, or accepted single-Project boundary |
| D01 | BEN02.2 | Unanswered | Emergency cap/category and approved-budget boundary; no zero/unlimited guess |
| D02 | BEN03 technical design | Stages and dual levels confirmed | Budget basis, commitment/actual deduplication, category mapping, VAT/freight, reservation/release and concurrency |
| D03 | SS-PLAN-01 / PM07 / PM09 | Normal plan rule confirmed | Beyond-plan criteria/limits, urgent completion/reviewer and plan versions |
| D04 | PM05 / SS18 | Extra read scope / temporary cover confirmed | Exact warehouse scopes, delegating authority, permitted actions/revocation |
| D05 | ACC09 / ACC11 / ACC12 | Partial answers preserved | AP dates/cutoff/urgent approver, partial-pay approval terms, reconciliation frequency |
| D06 | ACC13–17 | Follow-ups unanswered | Billing actors/support/types, receipt verification and debt follow-up |
| D07 | PM16/BEN04 | Both approvals and four pending-item fields confirmed | Approval order, operational close vs archive, settlement after close |
| D08 | Existing HR source section22 / entry | Settled answers retained | Later-stage formats/settings/formula evidence only; no repeated interview |

The Ben/Foreman follow-up questionnaire has **one unselected business answer, BEN02.2**. Design/configuration/other-role inputs above are separate, not reopened answered questions.

## Sources

- **S1** — [S1: Seven-role requirements, 24 October 2026](https://chatgpt.com/library?file_id=libfile_cc0e06e35548819195efe1d94ec3af41&account_id=personal). Baseline; no runtime implementation claim.
- **S2** — [S2: Store Site duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_fd3fadc170d8819187c641c3ed48e23a&account_id=personal). Text extraction preserved; later FM05 answer supersedes its count actors/adjustment route.
- **S3** — [S3: Khaimook duties PDF, 28 October 2026](https://chatgpt.com/library?file_id=libfile_dee6229548148191aca6944fbe1afdf0&account_id=personal). Text extraction preserved; later stock-count answer supersedes count-adjustment route.
- **S4** — [S4: Jai duties PDF, updated 29 October 2026](https://chatgpt.com/library?file_id=libfile_330992b76b608191bc04b9fd9c64f2ea&account_id=personal). Version 1; vendor ownership, remote receipt check and PO filename correction.
- **S5** — [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal). Detailed HR source; also published unchanged in the repository.
- **S6** — S6: Owner answers in this conversation, through 30 October 2026. BEN01–04/FM01–05 and their follow-ups; latest direct selections govern their specific questions.
- **S7** — S7: Pinned approved repository BOQ scope and DEC-034/037/038. Approved disclosure matrix, BUD-011–016, BQC-AC-001–014; accepted work stays closed.
- **S8** — S8: Pinned HR1-A entry contract / DEC-039 / issue 283. HR-001–008, HRA-AC-001–014; later attendance/payroll and policy exceptions excluded.
- **S9** — S9: Owner accounting answers reproduced in this conversation. ACC01–12 plus residual decisions; ACC13–17 unanswered, not revocations of earlier confirmed routes.
- **S10** — S10: Owner assessment handoff and Koh inclusion, 30 October 2026. Assessment/documentation authority only; eight roles plus shared workflows.

## Stable-ID rules

- Preserve BEN01–04/follow-ups, FM01–05, SS01–18, PM01–16, PUR01–15 and ACC01–17 where sourced.
- PUR01/PUR02/PUR11 were grouped in the supplied comparison source; canonical row PUR01 keeps PUR02/PUR11 as related IDs. No original wording is invented for separate grouped questions.
- BEN-BASE-*, NANCY-*, JAI-*, SS-PLAN-*, SS-HR-*, PM-HR-*, PM-CASH-*, FM-HR-*, PORN-* and KOH-* are new editorial tracking IDs for previously unnumbered/cross-package duties.
- BUD-011–016, FIN-* and HR-001–008 stay with their original approved contracts; role summaries are not scope amendments.
- New/changed/existing describes intake versus S1, not running software.