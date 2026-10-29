# HR / Attendance / Payroll — preserved requirements and staged preparation

**Current HR1-A position — 2026-10-29 SGT:** [Owner approved](https://github.com/threeswordz/cinder-grind/issues/283#issuecomment-6495792364) the bounded employee/employment/privacy scope, identity model, HR-only Company access and private-data matrix (DEC-039). [HR1-A entry contract](HR1-A-ENTRY-CONTRACT.md) passed publication #285 and exact-main CI40870435229; the already-authorized implementation is active, starting with the [internal private core](HR1-A-PRIVATE-CORE.md) in #286. No retained activation, payroll/later HR stage or Production authority. The original broader preparation below remains the source-preserving handoff, not a reason to re-ask approved HR1-A decisions.

The owner instructed “proceed building with your recommendation” after BOQ first, HR next in stages was recommended, then explicitly approved publication of the complete HR requirements to this repository ([receipt](https://github.com/threeswordz/cinder-grind/pull/274#issuecomment-6467656281)). The approved BOQ package stays under [#266](https://github.com/threeswordz/cinder-grind/issues/266). Prepare HR documentation during that delivery; do not start two competing feature implementations.

## 1. Source and authority

The complete [Thai requirements compilation dated 2026-10-27](HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md) is preserved byte-for-byte: version4, 61,952 bytes, SHA-256 `102d8023e8e8cbe65fd3ee6cb0e99cfd314f2307ba19ff1ed386b1a0786da0cf`. Its 473 text lines compile 100 answers and later corrections, including revised site submission, actual-hour allocation and payslip naming.

This source was read in full. The original named chat “TCJ UAT Use Cases” was not retrievable; do not claim a complete original-chat review or invent later user decisions. The compilation explicitly distinguishes confirmed answers, unresolved items and implementation/testing. It is requirements evidence, not proof of delivered software or successful payroll UAT. Existing GitHub statements that *all* HR responsibilities/cycles remain unconfirmed predate this newer source and must be interpreted with this addendum.

Project Governance / approved Decision Log remain higher authority. Preserve the recorded answers as requirements inputs; conflicts with existing hard controls need explicit reconciliation and recorded change control before implementation. This document does not itself grant an exception or settle statutory law.

## 2. Settled inputs to carry forward, not ask again

| Topic | Latest recorded business requirement | Source section |
|---|---|---|
| Company and coverage | MKE and TCJ, monthly/daily employees, start after hiring approval; recruiting/interview tracking excluded. Both Companies start together, but no start period has been chosen. | 1/3/20 |
| Payroll roles | Koh checks attendance/payroll; Nancy approves, transfers and records payment evidence; Porn prepares transfer instructions, not another routine wage approval; Ben approves rates/additions/OT and applicable leave. | 2/3/8/10/11 |
| Site time | Each site's Store records, checks and submits its own time on the15th/month-end; sender adds details for temporary small-job help. After submission, correction requires HR return and resubmission. | 4/6 |
| Pay cycle | Work1–15 paid20th; work16–month-end paid5th next month. Monthly complete half-period50%; incomplete period salary÷30×eligible days. Daily full day8 hours, partial day proportional. | 5/7 |
| OT/time | Actual worked OT is used with HR explanation for excess over request; separately specified rounding for OT versus lateness. Working-day/holiday formulas still require accountant verification and Nancy approval. | 8/9/15 |
| Corrections | Returned unpaid payroll is corrected/reapproved; paid errors and retrospective rule/rate differences are adjusted in next period. Failed/partial transfer follows the unpaid balance within the same approved amount. | 11 |
| Salary privacy | Koh/Nancy/Ben/Porn can view/download individual wages for both Companies; Store/Foreman/Khaimook site reports show people/time without wage rates/amounts. View/edit/approve rights are distinct. | 1/12/18 |
| Allocation | Salary/wages, additions and employer contributions allocate by actual project hours, including small jobs. Home Company pays, with cost allocation for cross-Company work. | 4, corrected64/confirmed66 |
| Leave | Recorded office/site/Foreman approval routes and January–December entitlement rules; latest77/87 answers are settled. Preserve explicit remaining policy details rather than re-ask these answers. | 13/14/21/22 |
| Payslips and accountant handoff | Thai, masked identity/bank numbers, itemized amounts, HR distribution, exact source filename convention; approved monthly exports to external accountant. Final file layouts remain to be supplied. | 17/18 |

## 3. Specific reconciliation before coding

| Item | Concrete unresolved design/policy work | Boundary |
|---|---|---|
| Nancy acts for HR | Source11.3 expressly permits preparing and approving with reason and substitution period. Existing maker/checker rules prohibit silently inferring self-approval. | Record an explicit narrowly scoped HR decision and auditable controls, or an agreed alternative, before implementing this exception. Do not silently reject the recorded request or apply it to BOQ/Finance generally. |
| Two-Company salary access and identity | Source permits four business functions across MKE/TCJ and new personnel codes on rehire/Company move. Current Company/Employee/Project security cannot be bypassed. | Design scoped Company access, person/employment-history links and Project work intervals. Payroll visibility does not imply cross-Company business approval or a SYS_ADMIN grant. |
| Actual-hour allocation and accounting | Business allocation percentages are settled. Posting event/date, destination, cross-Company cost handoff, residual rounding, zero-hour treatment and correction links are not fully specified. | One canonical labour expense recognition and one payment trail; no duplication across Payroll, Direct Cost or Subcontracts; Committed/Actual/Paid stay distinct. New Customer BOQ pricing is not a technical prerequisite. |
| Formula/configuration | Holiday/OT distinctions, additions/attendance-bonus details, leave policy particulars and accountant-verified statutory rates/bases/caps/effective dates remain incomplete. | Source's reported1.5 and illustrative875 are not a statutory sign-off. Do not hard-code them as universally valid rules. Version configuration and approvals. |
| Opening/accumulated balances | Source says no pre-ERP opening data, while older fund requirement described accumulation from employment start. | Agree truthful coverage labels/opening treatment; no fabricated historical wages, tax or contributions. |
| Self-service and exports | HR distributes payslips, while older office OT/leave submission and leave-balance access remain; accountant/bank column layouts are not finalized. | Resolve only that boundary and actual formats, not the whole already answered role interview. |

## 4. Recommended staged delivery, not yet an HR release entry

1. **Employee/employment and attendance foundation:** reuse the current Employee/User/Project identity foundation; add only separately approved HR fields, scoped documents, employment/rate history, site/work intervals, submission/return/correction audit and salary-free site views. Avoid a second editable attendance ledger behind DPR manpower.
2. **Leave and OT workflow:** implement the recorded actor routes, entitlements and approved effective rules; resolve the specific self-service/policy edges first. Preserve actual time and reasoned corrections independently of the payroll calculation.
3. **Payroll and financial handoff:** frozen reproducible period inputs/calculation versions; review/approval and explicit substitution controls; Thai payslips; transfer preparation/payment evidence and outstanding-balance handling; approved accountant exports and one labour expense/Project allocation contract.

Stage boundaries and acceptance must be approved and entered through normal governance before runtime/schema work. New tests will target newly delivered HR behavior, privacy, time overlaps, rounding, replay/concurrency and corrections using disposable data. Completed V1.2 THB, historical Mac and recovery UAT stays closed. The source names future HR participants; it does not establish completed HR UAT or authorize immediate rollout. Production remains NOT AUTHORIZED.
