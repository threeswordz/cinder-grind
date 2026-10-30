# Koh (คุณโก๊ะ) — HR

> **Current execution precedence — Owner #288, 30 October 2026:** Accounting development is deferred; HR1-A #283 keeps its existing designated writer. The original L0/L1/L2 values below are **historical workflow risk flags**, not a current coding order. Read [13-execution-disposition.md](13-execution-disposition.md) and [11-launch-scope-and-next-package.md](11-launch-scope-and-next-package.md) before selecting new work. Existing BOQ/operational/Finance controls and the approved scoped HR privacy matrix remain intact; this document is not new implementation or Production authority.


**Prepared:** 30 October 2026, Asia/Singapore. **Assessment baseline:** `4fd3635ed06510dc4759e00061cfc92d6cbad2bc`.

This is a reconciled business-requirements and source-assessment record, not a statement that every requirement is implemented, configured, accepted or approved for Production. Named people identify business functions, not hard-coded authorization checks.

- **Intake change:** new / changed / confirmed existing is relative to the 24 October seven-role baseline (S1); it is independent of implementation status. New editorial IDs are traceability labels, not invented original question IDs.
- Existing question IDs and enterprise IDs are retained. Related IDs link shared responsibilities; they are not automatically equivalent implementation contracts.
- **Historical risk flag (not current build priority):** L0 = before relying on the affected financial/stock/security workflow; L1 = before full role workflow use, or a separately accepted pilot workaround; L2 = deferred/conditional next scope. These priorities do not authorize implementation.
- Permission/configuration activation is unverified in this assessment. Accepted V1.2/BOQ evidence stays closed; only materially changed paths need new verification.
- Cross-role authority is in [00-shared-workflows.md](00-shared-workflows.md); sources/contradictions are in [12-decisions-and-sources.md](12-decisions-and-sources.md).

**Historical persona label:** UAT_HR_STAFF is a historical UAT label, not proof of a production HR role. This is not proof of live permissions.

This file is a role index into the existing HR package, not a replacement policy document. The complete unchanged Thai source is included at [sources/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md](sources/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md). Use the pinned [HR1-A entry contract](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md) for the approved current slice; attendance, leave/OT and payroll remain separately gated.

**Stage boundary:** KOH-01/02 are in the approved #283 HR1-A slice; KOH-03–08 are later HR stages, not expansion of HR1-A. The unchanged complete HR requirements document remains authoritative.

## Requirement index

| ID | Requirement | Intake change | Decision | Implementation observation | Original risk flag |
| --- | --- | --- | --- | --- | --- |
| KOH-01 | Canonical employee and employment history | new | confirmed with open detail | partially implemented | L1 |
| KOH-02 | Private data and HR-only Company rights | new | confirmed | partially implemented | L0 |
| KOH-03 | Individual actual-time submission | new | confirmed with open detail | missing | L2 |
| KOH-04 | Leave and OT administration | new | confirmed with open detail | missing | L2 |
| KOH-05 | Payroll calculation and immutable corrections | new | confirmed with open detail | missing | L2 |
| KOH-06 | Payroll fixes and substitution boundary | new | confirmed with open detail | missing | L2 |
| KOH-07 | Actual-hour Project/Company labour cost | new | confirmed with open detail | missing | L2 |
| KOH-08 | Slip, exports, alerts and offboarding | new | confirmed with open detail | missing | L2 |

## KOH-01 — Canonical employee and employment history

- **Stable ID:** KOH-01. **Related existing IDs:** HR-001, HR-002, HR-003
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Canonical employee and employment history.
- **Expected workflow:** Koh records site hires after Khaimook approval and office hires after Ben approval; new employee code on Company transfer/rehire with verified protected person linkage; preserve historical Employee/User/Project references.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L1.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); S8: Pinned HR1-A entry contract / DEC-039 / issue 283.
- **Unresolved questions/design inputs:** Current slice backend exists, attachments/UI/retained activation and separate acceptance are unfinished under existing writer.
- **Implementation classification:** partially implemented. HR1-A canonical employment, encrypted identity/bank history and explicit target-Company/category entitlement backend are merged and CI-tested.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Protected private attachments, full UI/locales/cache/browser, retained activation and separate Owner HR acceptance remain with #283 writer.
- **Recommended action:** Continue existing owner lane; link requirements rather than duplicate HR design or grant access.
- **Pinned implementation/configuration evidence:** [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md); [docs/HR1-A-EMPLOYEE-ACCESS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-EMPLOYEE-ACCESS.md); [apps/api/src/hr/hr.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/hr/hr.service.ts); [apps/api/src/hr/hr.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/hr/hr.integration.spec.ts)

## KOH-02 — Private data and HR-only Company rights

- **Stable ID:** KOH-02. **Related existing IDs:** HR-004, HR-005, HR-006, HR-007, HR-008
- **Intake change / decision:** new / confirmed.
- **Business need:** Private data and HR-only Company rights.
- **Expected workflow:** Manage authorized employment/identity/bank categories with reasoned immutable history and masked audited access; Company entitlement and action capability are distinct. Do not change session role or broaden Finance/BOQ scope.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L0.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); S8: Pinned HR1-A entry contract / DEC-039 / issue 283.
- **Unresolved questions/design inputs:** None recorded for the principal business answer; exact operational grants/fixtures still require evidence.
- **Implementation classification:** partially implemented. HR1-A canonical employment, encrypted identity/bank history and explicit target-Company/category entitlement backend are merged and CI-tested.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Protected private attachments, full UI/locales/cache/browser, retained activation and separate Owner HR acceptance remain with #283 writer.
- **Recommended action:** Continue existing owner lane; link requirements rather than duplicate HR design or grant access.
- **Pinned implementation/configuration evidence:** [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md); [docs/HR1-A-EMPLOYEE-ACCESS.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-EMPLOYEE-ACCESS.md); [apps/api/src/hr/hr.service.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/hr/hr.service.ts); [apps/api/src/hr/hr.integration.spec.ts](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/src/hr/hr.integration.spec.ts)

## KOH-03 — Individual actual-time submission

- **Stable ID:** KOH-03. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Individual actual-time submission.
- **Expected workflow:** Record/import office time; verify each site submitted actual work intervals, return/resubmit and reasoned corrections; check cross-site overlaps and small-job assistance.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal).
- **Unresolved questions/design inputs:** Future attendance design, effective dates and actual mapping; no aggregate DPR-to-pay conversion.
- **Implementation classification:** missing. DPR manpower is aggregate headcount, not employee worked hours; ProjectMember is assignment only.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No employee-level time/submission/return/resubmit/overlap contract; outside current HR1-A slice.
- **Recommended action:** Keep current authorized HR1-A sequence; later propose actual-time foundation including small-job hours and non-overlap.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-ENTRY-PREPARATION.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-ENTRY-PREPARATION.md); [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md)

## KOH-04 — Leave and OT administration

- **Stable ID:** KOH-04. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Leave and OT administration.
- **Expected workflow:** Follow confirmed worker/office/Foreman approval routes, actual OT beyond request with reason, leave rights/changes and holiday calendar. Use detailed HR source, not newly guessed policy.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal).
- **Unresolved questions/design inputs:** Self-service boundary; policy evidence, holiday/OT formulas and retrospective leave limits remain open in source.
- **Implementation classification:** missing. Leave/OT policies are recorded in the HR source; explicitly excluded from HR1-A implementation.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No leave/OT request/balance/actual-time ledger in this schema.
- **Recommended action:** Deliver only via subsequent approved HR slice; preserve all confirmed policies and ask only stage-relevant unresolved details.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md); [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md)

## KOH-05 — Payroll calculation and immutable corrections

- **Stable ID:** KOH-05. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Payroll calculation and immutable corrections.
- **Expected workflow:** Use existing full HR source: 1–15 paid20;16–end paid5; full monthly half-period 50%; incomplete salary/30×eligible days; daily8h/partial actual hours; approved rounding/additions/deductions. Koh reviews → Nancy approves → Porn transfer list → Nancy actual transfer/evidence.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal).
- **Unresolved questions/design inputs:** Accountant-verified effective-dated statutory/formula settings, unresolved benefit rules, first period and Finance interface.
- **Implementation classification:** missing. Complete business source records cycles/formulas/rounding; no payroll run/calculation model at pinned main.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Payroll, source freezing, actual-hour labour allocation, payslips and accountant exports are later scope.
- **Recommended action:** Do not replace existing payroll until approved configuration, reproducible calculation/Finance posting and separate acceptance.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-ENTRY-PREPARATION.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-ENTRY-PREPARATION.md); [docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md)

## KOH-06 — Payroll fixes and substitution boundary

- **Stable ID:** KOH-06. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Payroll fixes and substitution boundary.
- **Expected workflow:** Closed payroll needs Nancy reopening; approved-not-paid return/reapprove; paid errors and retrospective rate differences adjust next run with Nancy approval. Recorded Nancy substitute preparation/self-approval needs narrowly governed later exception.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal); S8: Pinned HR1-A entry contract / DEC-039 / issue 283.
- **Unresolved questions/design inputs:** C04 exception is not approved for implementation by HR1-A; do not bypass current maker-checker.
- **Implementation classification:** missing. Complete business source records cycles/formulas/rounding; no payroll run/calculation model at pinned main.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Payroll, source freezing, actual-hour labour allocation, payslips and accountant exports are later scope.
- **Recommended action:** Do not replace existing payroll until approved configuration, reproducible calculation/Finance posting and separate acceptance.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-ENTRY-PREPARATION.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-ENTRY-PREPARATION.md); [docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md)

## KOH-07 — Actual-hour Project/Company labour cost

- **Stable ID:** KOH-07. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Actual-hour Project/Company labour cost.
- **Expected workflow:** Allocate wages, additions and employer contribution by each person actual Project-hour proportion including small jobs; employing Company pays and costs split to benefited Company/Project.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal).
- **Unresolved questions/design inputs:** Zero-hour denominator, residual rounding, recognition/correction/cross-Company Finance contract.
- **Implementation classification:** missing. DPR manpower is aggregate headcount, not employee worked hours; ProjectMember is assignment only.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** No employee-level time/submission/return/resubmit/overlap contract; outside current HR1-A slice.
- **Recommended action:** Keep current authorized HR1-A sequence; later propose actual-time foundation including small-job hours and non-overlap.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-ENTRY-PREPARATION.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-ENTRY-PREPARATION.md); [docs/HR1-A-ENTRY-CONTRACT.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR1-A-ENTRY-CONTRACT.md)

## KOH-08 — Slip, exports, alerts and offboarding

- **Stable ID:** KOH-08. **Related existing IDs:** None; editorial ID assigned for this consolidation.
- **Intake change / decision:** new / confirmed with open detail.
- **Business need:** Slip, exports, alerts and offboarding.
- **Expected workflow:** Distribute Thai masked slips Slip-YYMMDD-employeeCode-ThaiName; approved accountant Excel/PDF/template exports;10/7/3-day HR document/insurance/tenure alerts; offboarding checklist and controlled access closure.
- **Company/Project scope:** MKE/TCJ only where Company and Project access is explicitly authorized; no implicit cross-Company right.
- **Create/view/edit/approve rights:** Create: only the preparer named in this workflow. View: authorized source records in scope. Edit: permitted draft/correction actions only, retaining history. Approve: only the named business function and configured step; viewing does not grant approval.
- **Exceptions:** No blanket emergency, SYS_ADMIN, substitute or self-approval right is inferred. Existing audit/Company/Project and immutable-history rules remain.
- **Acceptance example (expected, not executed):** Exercise the stated workflow with an authorized actor; verify the stated result and retained history, then deny an unauthorized actor or out-of-scope reference.
- **Original assessment risk flag (not active sequencing):** L2.
- **Previous requirement replaced:** No specific earlier requirement revoked by this item.
- **Source:** [S5: Complete Thai HR requirements, 27 October 2026, version 4](https://chatgpt.com/library?file_id=libfile_97d5830c36f481919b34ccbedfcebe3f&account_id=personal).
- **Unresolved questions/design inputs:** Source section22 outstanding formats/cumulative data/self-service and offboarding owners remain unresolved; bulk private export excluded from HR1-A.
- **Implementation classification:** missing. Complete business source records cycles/formulas/rounding; no payroll run/calculation model at pinned main.
- **Configuration evidence:** unverified (no retained configuration captured in this assessment).
- **Observed gap:** Payroll, source freezing, actual-hour labour allocation, payslips and accountant exports are later scope.
- **Recommended action:** Do not replace existing payroll until approved configuration, reproducible calculation/Finance posting and separate acceptance.
- **Pinned implementation/configuration evidence:** [apps/api/prisma/schema.prisma](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/apps/api/prisma/schema.prisma); [docs/HR-PAYROLL-ENTRY-PREPARATION.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-ENTRY-PREPARATION.md); [docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md](https://github.com/threeswordz/cinder-grind/blob/4fd3635ed06510dc4759e00061cfc92d6cbad2bc/docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md)