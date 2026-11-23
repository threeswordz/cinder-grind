# ERP forward-work reforecast — 23 November 2026 (SGT)

> **Provisional planning revision, not measured timesheet or Owner milestone signoff.** This is an assessment-only documentation change on the existing docs branch. No main merge, CI, Mac operation, role grant or Production authorization.

## Why the 1,900-hour counter did not move

Existing JSON `verifiedRetiredHours` requires an entire package to pass acceptance. As of 23-Nov, no one of the eight M4 packages has released from draft plus independent review, effective retained named roles and Owner gate. Nonetheless, technical source/evidence progress grew from about 10/32 at initial afternoon baseline to 20/32 (62.5%) across M4. Thus 0/1900 accepted hours is true but is a poor proxy for how much forward engineering remains. The 1,900 figure was a net *estimate at 16:17 SGT*, not a record of engineering time worked.

## Dual-counter live progress

| Metric | Current | Meaning |
|---|---:|---|
| Original net forward-work estimate at 16:17 SGT | **1,900 h** | Remains historical baseline |
| Provisional revised remaining productive effort | **1,847 h** | 117 h to finish M4 plus unchanged 1,730 h for other 11 stages |
| Reduction in planned work since baseline | **53 h-equivalent / 1,900 = 2.8%** | Re-estimated future work, **not** 53 actual hours spent and **not** earned final acceptance |
| Accepted complete M4 work packages | **0 / 8** | All final Owner/review/role gates remain open |
| Official prototype milestones | **4 / 8** | No milestone increment |
| Official production readiness gates | **3 / 10** | No go-live increment |
| M4 bounded technical checkpoints | **20 / 32 (62.5%)** | Technical, non-effort-weighted and not full UAT |
| Actual timesheet/engineer labor | **UNKNOWN** | No time tracking evidence |

**Reconciliation:** original 1,900 h − reforecasted M4 reduction 53 h − formally accepted whole-package retirements 0 h = **1,847 h current indicative remaining**. This is a new *estimate*, not a transfer of the 53h to the accepted-hours ledger. A future release acceptance must not double-count this forecast adjustment.

## The eight M4 remaining-work estimates

| Package | Original M4 allocation | Newly estimated still needed | Why |
|---|---:|---:|---|
| M4-01 | 20 h | **32 h** | 59 current-source dispositions; classify to verified / missing / future lane, name protected proof blockers |
| M4-02 | 22 h | **8 h** | Retained named Store/Khaimook/Jai/Ben grant evidence; independent review, exact-branch consistency |
| M4-03 | 22 h | **10 h** | Company/Project outsider denials, actor separation, real-role acceptance |
| M4-04 | 26 h | **8 h** | Retained Jai/Ben permissions; final business rules/denials |
| M4-05 | 30 h | **9 h** | Retained roles and last integrated change-path compatibility |
| M4-06 | 15 h | **10 h** | Target host sandbox/Thai font, supplier PDF visual readback, named Jai/Ben rights |
| M4-07 | 15 h | **6 h** | Retained permission readback and final frozen-source signoff |
| M4-08 | 20 h | **34 h** | One focused integrated compile, defect corrections, independent exact-head review; fresh Owner full-CI authorization; guarded merge + Owner acceptance |
| **Total to 5/8** | **170 h** | **117 h** | Difference **−53h** is forecast calibration, not a timesheet |

Original allocation is from GitHub issue #414 and the machine-readable 60-package ledger. The M4-01 and M4-08 estimates **increase** because actual 59-ID disposition effort and 30-open-PR integration/review costs were understated; the six coding/proof packages **decrease** because focused actual PG17/React/Chrome evidence now exists. Combined package deltas are net −53h. These hours assume role evidence, reviewer and Owner decisions are eventually available; approvals can elongate calendar duration without increasing productive effort.

## All 60 packages accounted for by original stage scope

| Remaining stage | Estimated hours now | Package IDs |
|---|---:|---|
| M4 → 5/8 | **117** | M4-01..08 |
| Prototype M6 — deploy actual scoped procurement/material/subcontract/HR journeys | **120** | M6-01..05 |
| Prototype M7 — paired backup/independent restored app and negative checks | **50** | M7-01..03 |
| Prototype M8 — audit, exact-source freeze and authorized prototype technical acceptance | **65** | M8-01..03 |
| GL-05 — HR master, time, OT/leave, Thai payroll, controls and UAT | **300** | HR-01..06 |
| GL-06 — double-entry GL, AP, AR, bank/payments, Thai VAT/WHT, assets and reports | **480** | ACC-01..08 |
| Cross-Project purchase/deliveries/budget exceptions (#245; approvals required) | **130** | XP-01..04 |
| GL-04 — effective MKE/TCJ eight-role configuration, pilot UAT and permissions | **120** | ROLE-01..04 |
| GL-07 — security and reviewed access controls | **95** | SEC-01..05 |
| GL-08 — authorized Production hosting, backup, restore, monitoring | **110** | INF-01..05 |
| GL-09 — real master imports, opening balances, users and training | **110** | DATA-01..04 |
| GL-10 — complete eight-persona UAT, defect fixes, authorized cutover | **150** | LAUNCH-01..05 |
| **Reforecast full 8-role ERP** | **1847** | **60 packages across 12 stages** |

**Other 52 packages have not received measured-work re-estimates; 1,730h stays unchanged pending scope and source-level audit.** This 1,847h center is therefore indicative rather than independently costed to a reliable precision of one hour.

## Priority sequence to actually reduce further residual effort

1. Inspect frozen consolidated Draft PR #425 `8c60e125` with one focused TypeScript/Prisma/changed-path compatibility pass, not broad CI, and repair only confirmed integration defects.
2. Resolve the 59 unfinished source/permission/scope dispositions from the 112-ID ledger. Record what is implemented and proven, what is a real M4 gap, and what belongs to explicitly gated later HR/Accounting/#245; avoid rebuilding earlier closed Receiving, Transfer, FM03 and FM02 work.
3. Obtain **read-only**, explicitly permitted MKE/TCJ retained named-role admission and Company/Project denial evidence for each genuinely affected path; otherwise mark BLOCKED and don't fake synthetic proof as real staff UAT.
4. Check PUR07 Thai PDF nonroot Chromium, local font availability, pagination and safe download on the **approved target** only. No automatic outbound email/LINE claims.
5. Independently review one frozen consolidated exact head via DEC-022 (Codex if available) and fix only legitimate findings.
6. Require **fresh specific Owner approval** for the ONE final mandatory 50-step release CI per #384; no full Actions runs merely to refresh this dashboard.
7. Governed merge into protected main, preserve data, and obtain explicit Owner M4 acceptance. Only then mark milestone 5/8. Do not treat this as Production authorization.
8. Continue M6 deployed missing journeys, M7 independent populated restore, M8 technical audit, then the post-prototype HR, Accounting, #245, eight-role fit, security, hosting, data onboarding and comprehensive GL-10 acceptance packages.

## Estimate confidence and double-count safeguards

- Current 1,847h is a **working midpoint**; the original 1,100–3,300h wide planning envelope remains applicable. Engineering effort is not synonymous with calendar delay.
- 300h for Thai HR/payroll, 480h for Accounting/GL/tax/bank and 130h for gated cross-Project/exception scope are substantial but not validated estimates; missing statutory rules or new business decisions can materially increase scope.
- Separate prototype M7 restore from live GL-08 disaster recovery; preproduction GL-04 role admission from GL-09 production provisioning; early business qualification from final GL-10 production-like acceptance. Reuse exact unchanged evidence; don't charge twice for duplicated checks.
- Future updates should keep (a) actual logged labor, (b) remaining estimated effort, (c) earned technical checklists, and (d) acceptance milestones separate. Reforecast from outstanding tasks whenever a source/role/gate changes, not only after all four package checkpoints are accepted.

**Evidence:** [baseline #414](https://github.com/threeswordz/cinder-grind/issues/414), [integrated source #425](https://github.com/threeswordz/cinder-grind/pull/425), [112-ID crosswalk #411](https://github.com/threeswordz/cinder-grind/pull/411), [M4 owner/risk #304](https://github.com/threeswordz/cinder-grind/issues/304), [review/CI gate #384](https://github.com/threeswordz/cinder-grind/issues/384).
