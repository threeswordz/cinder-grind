# Construction ERP — item-by-item roadmap to full Production (60 packages)

**As of:** 24 Nov 2026, SGT. **User-confirmed hard deadline:** 31 Dec 2026, full 112 immutable requirement IDs and eight retained role workflows operational in Production. **No reduced pilot** was approved; no qualified additional software engineers are available. Reconfirmed integrated Draft [#427](https://github.com/threeswordz/cinder-grind/pull/427) exact SHA `435bd8805d5bcd7e0a1a9941668b67860f288b78`, main `3a441b1fa389a9a274e6ca82413740a3ffa2f51b` unchanged.

**Important status boundaries:**
- Official prototype outcomes **4/8** (historically completed milestones 1, 2, 3 and 5). Go-live gates **GL-01, GL-02, GL-03 = 3/10** completed. Next target is M4 acceptance to reach prototype **5/8**, then M6/M7/M8 to 8/8. This ledger labels milestones by remaining work stream; it does **not** imply chronological milestone numbers.
- Last published M4 technical checks **20/32**; whole M4 packages accepted **0/8**; actual logged productive worker-hours **UNKNOWN**; formal retrospective estimate credit **0/1900**. The new two-file PUR08/PUR14 pure contract on branch `work-m4-pur08-pur14-supplier-lifecycle-contract-20261124` is **not** persistent/API/UI integrated, and has no accepted hours.
- The old original `1,900h` is a historical 23-Nov remaining-effort estimate. Provisional current remaining-work reforecast **1,847h** (117h M4 and 1,730h later), reduction of 53h estimated future work; not a 53h timesheet. The **1,500h optimized plan** is a **conditional/unvalidated proposal**, a further 347h hypothetical saving. Do NOT call the optimized figure officially accepted or imply 1,500h can fit the calendar with zero additional engineers.
- 37 calendar days 24 Nov→31 Dec = 5.286 weeks. Meeting the 1,847h current full-scope forecast would require 349.4 verified productive team-hours/week; even 1,500h requires 283.8/week plus independent review, Thai policy experts, live business UAT and Owner authorization. **Feasibility status RED**, not on track.
- This roadmap is an additive work budget, not a strictly serial dependency schedule; parallel planning is possible when real capacity exists. Every stage must meet its own exit. Codes/commits/tests do not self-approve, create real MKE/TCJ role grants or authorize Production.
- **Sources:** [#414 clock](https://github.com/threeswordz/cinder-grind/issues/414), [original 60-package JSON ledger](https://github.com/threeswordz/cinder-grind/blob/docs-erp-full-use-1900h-hourly-ledger-20261123/docs/ERP-FULL-USE-WORKPACKAGES.json), [provisional reforecast](https://github.com/threeswordz/cinder-grind/blob/docs-erp-full-use-1900h-hourly-ledger-20261123/docs/ERP-FULL-USE-REFORECAST-2026-11-23.md), [60-row optimization estimates](ERP-DEADLINE-FULL-SCOPE-1500H-PACKAGES-2026-11-24.csv), [Dec31 hard-deadline decision](ERP-DEADLINE-DEC31-2026-CRITICAL-PATH-AND-CAPACITY.md). No extra CI for this planning-only work.

## Summary — all remaining milestones

| Delivery stage in recommended order | Current estimated remaining | Optimized *proposal* | Cumulative current | Cumulative optimized |
|---|---:|---:|---:|---:|
| Prototype 5/8 — M4 final requirements/workflow closure | 117h | 94h | 117h | 94h |
| Prototype 6/8 — deployed end-to-end journeys | 120h | 95h | 237h | 189h |
| Prototype 7/8 — populated backup and restore | 50h | 36h | 287h | 225h |
| Prototype 8/8 — reviewed and frozen technical candidate | 65h | 50h | 352h | 275h |
| GL-05 — complete Thai HR, attendance and payroll | 300h | 265h | 652h | 540h |
| GL-06 — full Thailand Accounting, GL, banking and tax | 480h | 425h | 1132h | 965h |
| Cross-Project purchasing and financial allocation (#245) | 130h | 110h | 1262h | 1075h |
| GL-04 — eight genuine named-role operational signoff | 120h | 80h | 1382h | 1155h |
| GL-07 — production security and governance | 95h | 75h | 1477h | 1230h |
| GL-08 — authorized Production hosting, backup and recovery | 110h | 85h | 1587h | 1315h |
| GL-09 — real data, role onboarding and training | 110h | 85h | 1697h | 1400h |
| GL-10 — final full-scope Production go-live | 150h | 100h | 1847h | 1500h |
| **ALL 60 packages / full 112-ID ERP** | **1,847h** | **1,500h** | **1,847h** | **1,500h** |

## Prototype 5/8 — M4 final requirements/workflow closure
**Current:** 117h · **Optimized target:** 94h · **Cumulative if all preceding stages are accepted:** 117h current / 94h optimized

**Exit condition:** Complete every current-scope M4 business workflow, scoped named-role evidence, independent reviewed integration and specific Owner-authorized CI/merge and milestone acceptance; no Production authorization implied.

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| M4-01 | Current-source and all-112 evidence/scope decisions | 32h | 24h | 112 unique IDs classified; genuine gaps resolved or scoped; no inferred approval |
| M4-02 | PM02 real browser and retained-role authorization | 8h | 6h | Store/Khaimook approved A / returned B / correction lifecycle in actual UI |
| M4-03 | FM01, BEN04 and PM16 real-browser acceptance | 10h | 8h | Three distinct authenticated scenarios and denials, with no redundant previous browser probes |
| M4-04 | PUR01 whole-PO supplier-count and commercial rule | 8h | 6h | 1/2/3 suppliers by THB net total; Ben-approved reasoned exception; limits accepted |
| M4-05 | PUR04 core PO commercial/delivery fields | 9h | 7h | Company-scoped terms and source-linked immutable approvals, no implicit cross-Project |
| M4-06 | PUR07 supplier-name PO PDF and manual dispatch evidence | 10h | 8h | PDF name and recorded handoff; email/LINE sending stays external |
| M4-07 | PUR12 K-/T- company PO document identity | 6h | 5h | New-doc format with preserved historical numbers and no cross-Company confusion |
| M4-08 | M4 focused closure, governed integration and Owner decision | 34h | 30h | Exact candidate, linked evidence, independent review; owner-gated final CI/merge, no Production |
| **Subtotal** | | **117h** | **94h** | Must satisfy actual stage exit, not just code present |

## Prototype 6/8 — deployed end-to-end journeys
**Current:** 120h · **Optimized target:** 95h · **Cumulative if all preceding stages are accepted:** 237h current / 189h optimized

**Exit condition:** Run preserved-data integrated application and confirm source-backed site/material/procurement/receiving/transfer/subcontract/HR protected-file journeys without double posting.

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| M6-01 | Build deployable preserved-data integrated M4/M6 candidate | 25h | 20h | Exact approved source, additive schema and records preserved |
| M6-02 | Site, plan, request, issue and document deployed journeys | 25h | 20h | Eight-role boundary tests with actual API/browser where needed |
| M6-03 | Procurement, receiving, transfers and inventory deployed journeys | 30h | 25h | Canonical source-to-GR/stock, no duplicate posting, no replay of past Mac checks |
| M6-04 | Subcontract physical acceptance/certification deployed journey | 20h | 15h | Independent accepted quantity to certification, no new Finance implied |
| M6-05 | HR encrypted/protected-file deployed journey | 20h | 15h | Authorized bytes and denial proof with safe private-key custody |
| **Subtotal** | | **120h** | **95h** | Must satisfy actual stage exit, not just code present |

## Prototype 7/8 — populated backup and restore
**Current:** 50h · **Optimized target:** 36h · **Cumulative if all preceding stages are accepted:** 287h current / 225h optimized

**Exit condition:** Prove paired database/Documents/HR-key backup and separate non-overwriting restore, authenticated restored reads and fail-closed negative recovery evidence.

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| M7-01 | Paired populated DB, Documents and external HR-key backup | 20h | 15h | Immutable verified copy with provenance and secret isolation |
| M7-02 | Restore to distinct non-overwriting target | 15h | 11h | Matching data/files/keys, restored application startup and authenticated reads |
| M7-03 | Recovery negative paths and runbook evidence | 15h | 10h | Wrong key/missing document/unauthorized actor fail closed; records preserved |
| **Subtotal** | | **50h** | **36h** | Must satisfy actual stage exit, not just code present |

## Prototype 8/8 — reviewed and frozen technical candidate
**Current:** 65h · **Optimized target:** 50h · **Cumulative if all preceding stages are accepted:** 352h current / 275h optimized

**Exit condition:** Complete exact-source independent DEC-022/security review, authorized final validation, issue traceability and explicit Owner technical freeze (not full Production release).

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| M8-01 | Independent exact-head review and security reconciliation | 20h | 18h | No unresolved P1/P2; no builder self-approval |
| M8-02 | Frozen integrated candidate and final justified release validation | 25h | 18h | Owner-authorized mandatory final CI only; actual reviewed-tree identity |
| M8-03 | Prototype audit evidence and Owner technical freeze acceptance | 20h | 14h | Milestones 4,6,7 observed; user UAT remains separate |
| **Subtotal** | | **65h** | **50h** | Must satisfy actual stage exit, not just code present |

## GL-05 — complete Thai HR, attendance and payroll
**Current:** 300h · **Optimized target:** 265h · **Cumulative if all preceding stages are accepted:** 652h current / 540h optimized

**Exit condition:** Correct and policy-approved staff records, site time, leave/OT, Thai payroll/statutory calculations, private payslips and integrated approvals.

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| HR-01 | Close HR1-A private records, role and file work | 35h | 30h | Retained sensitive-data matrix and protected history verified |
| HR-02 | Attendance, site time and timesheet handling | 55h | 50h | Employment/Project periods, correction and immutable approval |
| HR-03 | Leave, overtime and attendance entitlement | 55h | 50h | Approved Thailand-specific policy and controlled calculations |
| HR-04 | Payroll computation, Thai statutory contributions and taxes | 80h | 75h | Validated pay rules, allowances, deduction and legislation-specific fixtures |
| HR-05 | Payroll maker-checker, payslips and period locking | 35h | 30h | Koh/Nancy/Ben/Porn boundary and approved bank/payment interface |
| HR-06 | HR integrated API/UI/privacy and real-role acceptance | 40h | 30h | HR-to-Finance postings reconciled without salary disclosures |
| **Subtotal** | | **300h** | **265h** | Must satisfy actual stage exit, not just code present |

## GL-06 — full Thailand Accounting, GL, banking and tax
**Current:** 480h · **Optimized target:** 425h · **Cumulative if all preceding stages are accepted:** 1132h current / 965h optimized

**Exit condition:** Correct balanced journal and trial balance, source-backed AP/AR, supplier/subcontract payments, VAT/WHT, depreciation, cash/bank reconciliation, payroll→GL and closing reports.

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| ACC-01 | Chart of accounts, posting rules, journal and immutable GL | 80h | 72h | Double-entry audit, THB, periods, trial balance |
| ACC-02 | AP supplier invoices, three-way matching and credits | 70h | 63h | PO/GR/quantity source and Nancy maker/checker; no duplicate liability |
| ACC-03 | AR customer billing, receipts, quotation and VO handoff | 60h | 55h | Ben work confirmation → Porn billing; Nancy controls where assigned |
| ACC-04 | Supplier/subcontract payments, cash/bank and reconciliation | 80h | 75h | Approval limits, payment runs, bank reconciliations and idempotency |
| ACC-05 | Thailand VAT, WHT and tax reporting | 65h | 60h | Reviewed local tax rules, test vectors and accountable signoff |
| ACC-06 | Asset depreciation, periods and controls | 40h | 36h | Jai register → Nancy depreciation, append-only asset/audit evidence |
| ACC-07 | Payroll-to-GL and financial cost attribution | 40h | 30h | Balanced GL and P&L with confidential salary boundaries |
| ACC-08 | Financial reporting, close, export and accountant handoff | 45h | 34h | Trial balance, audit trail, statement/export and close validation |
| **Subtotal** | | **480h** | **425h** | Must satisfy actual stage exit, not just code present |

## Cross-Project purchasing and financial allocation (#245)
**Current:** 130h · **Optimized target:** 110h · **Cumulative if all preceding stages are accepted:** 1262h current / 1075h optimized

**Exit condition:** Approved multi-Project allocations with single PO commitment, GR/Finance lineage, budget/emergency threshold decisions, all Company/Project isolation preserved.

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| XP-01 | Finalize formerly gated #245, BEN02/BEN03 and PM03 decisions | 20h | 16h | Signed allocation/exception contract, no guessed thresholds |
| XP-02 | One supplier PO with multiple Project allocations | 50h | 44h | A18/B2 source links, price and single commitment, cross-Company isolation |
| XP-03 | Partial/central/direct deliveries and ledger allocation | 35h | 30h | No duplicate PO/GR/stock/Finance; preserved outstanding per Project |
| XP-04 | Budget checks, emergency rules, exception and change control | 25h | 20h | Owner-approved limits, approval ancestry and out-of-plan audit |
| **Subtotal** | | **130h** | **110h** | Must satisfy actual stage exit, not just code present |

## GL-04 — eight genuine named-role operational signoff
**Current:** 120h · **Optimized target:** 80h · **Cumulative if all preceding stages are accepted:** 1382h current / 1155h optimized

**Exit condition:** Actual MKE/TCJ access, effective scoped permissions, Ben/Nancy/Khaimook/Jai/Store/Foreman/Porn/Koh workflow UAT and accountable acceptance for 112 requirements.

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| ROLE-01 | Retained MKE/TCJ eight-role permissions and approval settings | 35h | 26h | Real Company/Project roles, no synthetic grants mistaken for live |
| ROLE-02 | All eight role-specific guided workflow walkthroughs | 35h | 21h | Named Ben/Nancy/Khaimook/Jai/Store/Foreman/Porn/Koh separation |
| ROLE-03 | Complete cross-module business UAT and exception coverage | 35h | 24h | All 112 current requirements signed by accountable users |
| ROLE-04 | Repair verified role/approval gaps and retain signoffs | 15h | 9h | Open critical user defects closed, access still least privilege |
| **Subtotal** | | **120h** | **80h** | Must satisfy actual stage exit, not just code present |

## GL-07 — production security and governance
**Current:** 95h · **Optimized target:** 75h · **Cumulative if all preceding stages are accepted:** 1477h current / 1230h optimized

**Exit condition:** Source-bound independent security clearance, access/secret protections, audit/incident readiness and enforceable protected-main controls.

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| SEC-01 | Threat model and production-access/authorization negative tests | 30h | 25h | Tenant/Project, CSRF, session, maker/checker and authorization denies |
| SEC-02 | Enforced GitHub protected-main/review controls | 15h | 12h | Actual active ruleset status plus non-bypass evidence |
| SEC-03 | HR/Finance confidential record review | 20h | 16h | No salary, customer profit or banking cross-role exposure |
| SEC-04 | TLS, credentials and secret/key custody | 15h | 12h | Protected runtime/rotation, no credentials in repo/logs |
| SEC-05 | Vulnerability, audit and incident response signoff | 15h | 10h | No release-blocking findings and escalation owners |
| **Subtotal** | | **95h** | **75h** | Must satisfy actual stage exit, not just code present |

## GL-08 — authorized Production hosting, backup and recovery
**Current:** 110h · **Optimized target:** 85h · **Cumulative if all preceding stages are accepted:** 1587h current / 1315h optimized

**Exit condition:** Approved live host, persistent storage/TLS, encrypted paired backup, HR key custody, rollback, measured recovery, monitoring and runbooks.

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| INF-01 | Approved host, persistent storage, TLS and runtime service | 30h | 24h | Production-only authorization and reviewed release artifact |
| INF-02 | Scheduled encrypted offsite DB + Documents backups | 25h | 20h | Paired point-in-time backups and 24h RPO proof |
| INF-03 | External HR keys, deploy/rollback and smoke proof | 20h | 16h | No overwrite of actual data; 8h recovery target measured |
| INF-04 | Independent populated production-like restore drill | 25h | 20h | Authenticated restored app, matching bytes and key ownership |
| INF-05 | Monitoring, alerting, SLO and on-call runbooks | 10h | 5h | Incident owner and health/restore alert proof |
| **Subtotal** | | **110h** | **85h** | Must satisfy actual stage exit, not just code present |

## GL-09 — real data, role onboarding and training
**Current:** 110h · **Optimized target:** 85h · **Cumulative if all preceding stages are accepted:** 1697h current / 1400h optimized

**Exit condition:** Approved MKE/TCJ master records and opening balances, user provisioning by explicit authority, reconciled imports, training and readiness signoff.

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| DATA-01 | MKE/TCJ Company/Project/warehouse master onboarding | 30h | 23h | Approved mappings and no guessed retained Company IDs |
| DATA-02 | Import suppliers, employees, BOQ and financial opening balances | 30h | 23h | THB/currency provenance, references and reconciliation |
| DATA-03 | Real users, role grants and workflow assignment | 20h | 15h | Named user approvals and effective permission readback |
| DATA-04 | Controlled source-to-target tie-out, training and SOPs | 30h | 24h | Signed migration variances, training records and cutover owner |
| **Subtotal** | | **110h** | **85h** | Must satisfy actual stage exit, not just code present |

## GL-10 — final full-scope Production go-live
**Current:** 150h · **Optimized target:** 100h · **Cumulative if all preceding stages are accepted:** 1847h current / 1500h optimized

**Exit condition:** All-role UAT, release-blocking defect closure, exact source smoke, rollback/cutover rehearsal and explicit Owner go/no-go followed by stable authorized Production use.

| ID | Required work item | Remaining current | Proposed optimized | Completion test / acceptance condition |
|---|---|---:|---:|---|
| LAUNCH-01 | Frozen staged candidate and no-write production smoke | 30h | 20h | End-to-end source/secret/storage/permission identity checked |
| LAUNCH-02 | Comprehensive human UAT across all eight roles | 45h | 31h | All required workflows pass, no missed source/role obligation |
| LAUNCH-03 | Resolve observed critical defects and affected-path retests | 45h | 27h | No repeated all-suites without changed risk; all P0/P1 closed |
| LAUNCH-04 | Backup/rollback rehearsal and migration cutover | 15h | 10h | Owner-approved go/no-go inputs; no production before authority |
| LAUNCH-05 | Explicit Production go-live, support and operational acceptance | 15h | 12h | Eight roles can use live system, stable support and signoff |
| **Subtotal** | | **150h** | **100h** | Must satisfy actual stage exit, not just code present |

## Cross-cutting dependencies and unbudgeted risk before a fixed date
**The package rows are not yet a source-verified bottom-up work estimate.** The existing M4 package work budget for M4-01…M4-08 has **no independent PUR08/PUR14 implementation bucket**. The new PUR08/PUR14 supplier tracking / supplier-return contract is only the pure rules slice; a full production workflow requires DB migration, persistent events, authenticated HTTP, source-backed document/GR validation, React UI, focused native Postgres/browser tests and independent review. If the scope does not fit within M4-01/M4-08 or a later explicit package, revise the forecast upward or transfer a justified existing allocation; do **not** pretend these extra features cost zero. Similar risks apply to complex Thai payroll/tax/bank rules and unapproved #245 emergency thresholds.

**Required human/external gates:** signed Thai HR/payroll/tax and accounting rules; approved Company/Project and real eight-role grants; distinct independent DEC-022 code/security reviewer; #384 specific authorization for one final full release CI and protected-main release; data migration/onboarding; human DEC-042 UAT and separate explicit Production go/no-go. Date 31 Dec grants none of these approvals.

**Next task with no new CI or access:** read-only reconciliation of the 112-ID matrix against the current #427 head; prove actual missing source versus stale gap descriptions, update closure checklist, finish genuinely new targeted features. Keep full scope, exact SHA and acceptance evidence separate.

**Executive conclusion:** the itemized current effort is 1,847h; proposed 1,500h is a stretch planning optimization, not a safe full-ERP-by-Dec31 commitment with zero additional engineers. No milestone should advance until its explicit acceptance exit genuinely passes.
