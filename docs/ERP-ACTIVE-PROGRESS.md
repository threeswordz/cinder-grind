# Construction ERP — Live Remaining-Hours Dashboard

> **Updated 24 November 2026 (SGT). Deadline: 31 December 2026, full 112-requirement and eight-role Production ERP; no pilot substitution. Delivery feasibility: RED.** The ledger is a documented remaining-work FORECAST, not actual time worked or formal acceptance. [Canonical completion index #414](https://github.com/threeswordz/cinder-grind/issues/414).

## Countdown to true completion

| Metric | Current | What it means |
|---|---:|---|
| **Remaining productive engineering work** | **1,845h → 0h** | Provisional recalculated estimate from latest work evidence |
| 23 Nov provisional baseline | 1,847h | Starting point for this incremental ledger |
| Evidence-backed forecast reduction | **2h** | Estimated future work removed, NOT actual hours worked |
| Historical 1,900h net forecast | 1,900h | Earlier planning benchmark, not another balance to add |
| Proposed optimization goal | 1,500h | Unvalidated stretch target, not approved new baseline |
| Formally accepted packages | 0 / 60 | No whole work package formally exited |
| Prototype milestones | 4 / 8 | Official status, independent of partial work |
| Go-live gates | 3 / 10 | Official status, not full Production |
| M4 bounded technical checkpoints | 20 / 32 | Last published, not a whole ERP completion percentage |
| Actual productive hours logged | Unknown | Do not infer from CI/jobs/commits/Chat messages |
| New uncovered gap hours | TBD | PUR08/PUR14 must be priced before adjusting full forecast |

**Display semantics:** a work package may move from 20h→15h→7h as specific source, test or integration work eliminates identifiable remaining tasks; it reaches 0h **only after the package's actual required acceptance exit**. Newly discovered defects and requirements can increase the balance. Partial Chat development is not independently approved Production functionality.

## All milestone balances

| Milestone | Initial hours | Reduction since 23 Nov | Hours still needed | Formal package acceptance |
|---|---:|---:|---:|---:|
| Prototype 5/8 — M4 closure | 117h | 2h | **115h** | 0/8 |
| Prototype 6/8 — integrated workflows | 120h | 0h | **120h** | 0/5 |
| Prototype 7/8 — recovery | 50h | 0h | **50h** | 0/3 |
| Prototype 8/8 — technical freeze | 65h | 0h | **65h** | 0/3 |
| Thai HR and payroll | 300h | 0h | **300h** | 0/6 |
| Accounting / GL / tax / bank | 480h | 0h | **480h** | 0/8 |
| Cross-Project purchasing (#245) | 130h | 0h | **130h** | 0/4 |
| Eight-role acceptance | 120h | 0h | **120h** | 0/4 |
| Security & governance | 95h | 0h | **95h** | 0/5 |
| Production infrastructure | 110h | 0h | **110h** | 0/5 |
| Real data and onboarding | 110h | 0h | **110h** | 0/4 |
| Full go-live and support | 150h | 0h | **150h** | 0/5 |
| **Full ERP** | **1,847h** | **2h** | **1,845h** | **0/60** |

## Each development work package — remaining hours

| ID | Stage | Required deliverable | Starting | Credited reduction | **Remaining** |
|---|---|---|---:|---:|---:|
| M4-01 | M4 | Current-source and all-112 evidence/scope decisions | 32h | 2h | **30h** |
| M4-02 | M4 | PM02 real browser and retained-role authorization | 8h | 0h | **8h** |
| M4-03 | M4 | FM01, BEN04 and PM16 real-browser acceptance | 10h | 0h | **10h** |
| M4-04 | M4 | PUR01 whole-PO supplier-count and commercial rule | 8h | 0h | **8h** |
| M4-05 | M4 | PUR04 core PO commercial/delivery fields | 9h | 0h | **9h** |
| M4-06 | M4 | PUR07 supplier-name PO PDF and manual dispatch evidence | 10h | 0h | **10h** |
| M4-07 | M4 | PUR12 K-/T- company PO document identity | 6h | 0h | **6h** |
| M4-08 | M4 | M4 focused closure, governed integration and Owner decision | 34h | 0h | **34h** |
| M6-01 | M6 | Build deployable preserved-data integrated M4/M6 candidate | 25h | 0h | **25h** |
| M6-02 | M6 | Site, plan, request, issue and document deployed journeys | 25h | 0h | **25h** |
| M6-03 | M6 | Procurement, receiving, transfers and inventory deployed journeys | 30h | 0h | **30h** |
| M6-04 | M6 | Subcontract physical acceptance/certification deployed journey | 20h | 0h | **20h** |
| M6-05 | M6 | HR encrypted/protected-file deployed journey | 20h | 0h | **20h** |
| M7-01 | M7 | Paired populated DB, Documents and external HR-key backup | 20h | 0h | **20h** |
| M7-02 | M7 | Restore to distinct non-overwriting target | 15h | 0h | **15h** |
| M7-03 | M7 | Recovery negative paths and runbook evidence | 15h | 0h | **15h** |
| M8-01 | M8 | Independent exact-head review and security reconciliation | 20h | 0h | **20h** |
| M8-02 | M8 | Frozen integrated candidate and final justified release validation | 25h | 0h | **25h** |
| M8-03 | M8 | Prototype audit evidence and Owner technical freeze acceptance | 20h | 0h | **20h** |
| HR-01 | GL05 | Close HR1-A private records, role and file work | 35h | 0h | **35h** |
| HR-02 | GL05 | Attendance, site time and timesheet handling | 55h | 0h | **55h** |
| HR-03 | GL05 | Leave, overtime and attendance entitlement | 55h | 0h | **55h** |
| HR-04 | GL05 | Payroll computation, Thai statutory contributions and taxes | 80h | 0h | **80h** |
| HR-05 | GL05 | Payroll maker-checker, payslips and period locking | 35h | 0h | **35h** |
| HR-06 | GL05 | HR integrated API/UI/privacy and real-role acceptance | 40h | 0h | **40h** |
| ACC-01 | GL06 | Chart of accounts, posting rules, journal and immutable GL | 80h | 0h | **80h** |
| ACC-02 | GL06 | AP supplier invoices, three-way matching and credits | 70h | 0h | **70h** |
| ACC-03 | GL06 | AR customer billing, receipts, quotation and VO handoff | 60h | 0h | **60h** |
| ACC-04 | GL06 | Supplier/subcontract payments, cash/bank and reconciliation | 80h | 0h | **80h** |
| ACC-05 | GL06 | Thailand VAT, WHT and tax reporting | 65h | 0h | **65h** |
| ACC-06 | GL06 | Asset depreciation, periods and controls | 40h | 0h | **40h** |
| ACC-07 | GL06 | Payroll-to-GL and financial cost attribution | 40h | 0h | **40h** |
| ACC-08 | GL06 | Financial reporting, close, export and accountant handoff | 45h | 0h | **45h** |
| XP-01 | XP | Finalize formerly gated #245, BEN02/BEN03 and PM03 decisions | 20h | 0h | **20h** |
| XP-02 | XP | One supplier PO with multiple Project allocations | 50h | 0h | **50h** |
| XP-03 | XP | Partial/central/direct deliveries and ledger allocation | 35h | 0h | **35h** |
| XP-04 | XP | Budget checks, emergency rules, exception and change control | 25h | 0h | **25h** |
| ROLE-01 | GL04 | Retained MKE/TCJ eight-role permissions and approval settings | 35h | 0h | **35h** |
| ROLE-02 | GL04 | All eight role-specific guided workflow walkthroughs | 35h | 0h | **35h** |
| ROLE-03 | GL04 | Complete cross-module business UAT and exception coverage | 35h | 0h | **35h** |
| ROLE-04 | GL04 | Repair verified role/approval gaps and retain signoffs | 15h | 0h | **15h** |
| SEC-01 | GL07 | Threat model and production-access/authorization negative tests | 30h | 0h | **30h** |
| SEC-02 | GL07 | Enforced GitHub protected-main/review controls | 15h | 0h | **15h** |
| SEC-03 | GL07 | HR/Finance confidential record review | 20h | 0h | **20h** |
| SEC-04 | GL07 | TLS, credentials and secret/key custody | 15h | 0h | **15h** |
| SEC-05 | GL07 | Vulnerability, audit and incident response signoff | 15h | 0h | **15h** |
| INF-01 | GL08 | Approved host, persistent storage, TLS and runtime service | 30h | 0h | **30h** |
| INF-02 | GL08 | Scheduled encrypted offsite DB + Documents backups | 25h | 0h | **25h** |
| INF-03 | GL08 | External HR keys, deploy/rollback and smoke proof | 20h | 0h | **20h** |
| INF-04 | GL08 | Independent populated production-like restore drill | 25h | 0h | **25h** |
| INF-05 | GL08 | Monitoring, alerting, SLO and on-call runbooks | 10h | 0h | **10h** |
| DATA-01 | GL09 | MKE/TCJ Company/Project/warehouse master onboarding | 30h | 0h | **30h** |
| DATA-02 | GL09 | Import suppliers, employees, BOQ and financial opening balances | 30h | 0h | **30h** |
| DATA-03 | GL09 | Real users, role grants and workflow assignment | 20h | 0h | **20h** |
| DATA-04 | GL09 | Controlled source-to-target tie-out, training and SOPs | 30h | 0h | **30h** |
| LAUNCH-01 | GL10 | Frozen staged candidate and no-write production smoke | 30h | 0h | **30h** |
| LAUNCH-02 | GL10 | Comprehensive human UAT across all eight roles | 45h | 0h | **45h** |
| LAUNCH-03 | GL10 | Resolve observed critical defects and affected-path retests | 45h | 0h | **45h** |
| LAUNCH-04 | GL10 | Backup/rollback rehearsal and migration cutover | 15h | 0h | **15h** |
| LAUNCH-05 | GL10 | Explicit Production go-live, support and operational acceptance | 15h | 0h | **15h** |

## Latest recorded progress events

- **2026-11-24: M4-01 — 32h → 30h**. 112 immutable source records were reconciled into a current integrated-source triage with 8 specifically verified delta annotations, eliminating an estimated 2 hours of reclassification/reinspection from M4-01's 32-hour forward-work estimate. This is an estimate reduction; remaining source-check and retained-policy/UAT work stays 30 hours. Do NOT credit 2 actual employee hours or formal package acceptance. [Evidence 1](https://github.com/threeswordz/cinder-grind/blob/49f3319db33441fd409480a39ed334ff2c0782b3/docs/ERP-DEADLINE-M4-112-CANDIDATE-TRIAGE-2026-11-24.csv) [Evidence 2](https://github.com/threeswordz/cinder-grind/blob/435bd8805d5bcd7e0a1a9941668b67860f288b78/docs/M4-2026-11-24-112-DISPOSITION.csv)
- **2026-11-24: unpriced PUR08/PUR14 — technical source advanced; 0h allocated**. Isolated PUR08/PUR14 non-posting transition contract and five focused pure tests committed. Not yet linked to authenticated persistence/API/UI/real GR/Document records; no source-backed estimate allocated in a specific 60-package row, so no invented remaining-hour reduction. [Evidence 1](https://github.com/threeswordz/cinder-grind/tree/3415ccd0eeaf1e544dd2e93a25ee867c0587df98/apps/api/src/procurement)

## Open scope-pricing risk

- **PUR08_PUR14_INTEGRATION, hours TBD**: Persistent supplier acknowledgment, transit and discrepancy/return/replacement audit source, authorizations, genuine GR/document provenance, API/MUI, focused native PG/browser verification and independent review. Budget source must be reconciled rather than silently charged against unrelated packages. [Source](https://github.com/threeswordz/cinder-grind/tree/3415ccd0eeaf1e544dd2e93a25ee867c0587df98/apps/api/src/procurement)

## Update procedure — mandatory at each Chat development handoff

1. **Verify exact GitHub SHA** and evidence against the package's required exit; note any newly found unbudgeted scope.
2. **Re-estimate the work genuinely left** in the affected package (e.g. 20→16). Record both before and after, evidence URL, reviewer/Owner gate status; do not use elapsed time, commit count or CI runtime as credit.
3. **Append one event** to [machine-readable ledger](ERP-ACTIVE-REMAINING-HOURS.json), preserving prior events and validating the baseline against the package total. For unpriced code progress, record a zero-hour technical event and price it before claiming hours saved.
4. **Regenerate this dashboard** with `node tools/erp-progress-report.mjs --write` when a checkout is available (or rederive it directly from the JSON through Chat/GitHub), then update [issue #414](https://github.com/threeswordz/cinder-grind/issues/414) in the same development handoff with old/new totals, package IDs, SHA and blockers.
5. Keep **formal package acceptance and milestone/GL counters separate**; only the authorized independent/human acceptance may close their gates. No redundant broad CI, protected-main merge, retained role grants or Production actions from a progress update.

**Source of truth:** immutable historical 1,900h reference plus 1,847h November reforecast remain as prior snapshots; this JSON is the *current rolling forecast overlay*. An isolated builder session can submit source/evidence in #414, while one designated Release Coordinator reconciles the canonical JSON against the latest GitHub head to avoid concurrent stale writes. No background synchronization is implied.
