# Full-ERP 8-role × 112-requirement live hour roadmap

> **Canonical planning ledger — initial baseline 23 Nov 2026, 16:17 SGT.** This is a docs-only DRAFT, not a code release. **Future requests 'continue the recommended sequence', 'check the recommended sequence' and 'live position' MUST refresh exact GitHub source/CI/PR evidence first, compare with this ledger and render the current hour-range dashboard**. Evidence may be added only after verifying source and exit. No autonomous background polling is claimed.

## Definition of done

The ERP is complete only if all 112 requirements are implemented and working or explicitly superseded with Owner approval, all eight roles (Ben, Nancy, Khaimook, Jai, Store Site, Foreman, Porn and Koh) can use real MKE/TCJ authenticated workflows, integrated HR/payroll and Accounting/GL/tax/banking work, preserved data, functional cross-module workflows and no material blocking defects, valid backups/restore, business UAT and actual authorized Production go-live. An **8/8 prototype is not 100% ERP**. Accounting/HR and multi-Project scope formerly deferred must receive new authority before implementation.

## Live checkpoint — 23 November 2026, 16:25 SGT

**M4-01 H0001–H0020 = IN_PROGRESS, not accepted (0 of its 20 forecast-hours retired).** [112-ID gate audit](ERP-M4-01-112-EXIT-AUDIT.md) and [machine-readable source matrix](ERP-M4-01-112-ID-GATES.csv) verify the immutable 112 census and distinguish previously passed scoped native/Chromium cases from unresolved role and functional exits. Draft #412's new PO-submit guard and Draft #413 PUR04 commercial fields are **source only, unrun**, unlike the earlier native #45127724396 and operational Chromium #45132932414 already passed. **Official M4 4/8, GL 3/10; 1,900h remaining forecast unchanged.** Do not subtract elapsed wall time, run broad CI or replay successful Mac/browser cases.

## Newly staged source — PUR01 and PUR04, pending focused proof

- **[Draft PR #415](https://github.com/threeswordz/cinder-grind/pull/415)**, exact head `ee3ca3e1932a96cf3c37339bbf55ba68ff14f37f`, stacked on Draft [PUR04 #413](https://github.com/threeswordz/cinder-grind/pull/413). Net-after-discount-plus-freight/charges ex-VAT thresholds, complete THB supplier bid counts, documented special supplier/Ben exception, immutable source audit. New-currency THB capture is forward-looking; historical unknown is never silently repaired.
- **Only newly affected focused PG/API/Web tests** [#45140450091](https://github.com/threeswordz/cinder-grind/actions/runs/45140450091) were initiated to validate these staged changes. **As of this checkpoint no pass is yet credited**. This is not the full CI/old Mac/previous browser suite.
- **H0065–H0090 M4-04** (PUR01) and **H0091–H0120 M4-05** (PUR04) are now **IN_PROGRESS in parallel with M4-01**, 0 forecast hours retired for either. The sequential cursor remains **H0001–H0020**, and 1,900h is still the honest remaining budget.

## Baseline counters (DO NOT imply earned progress)

| Counter | Value | Meaning |
|---|---:|---|
| Official prototype outcomes | **4/8** | From #305; milestone count is not work percent |
| Official production go-live gates | **3/10** | From #278; gate count is not work percent |
| Additional forecast hours at baseline | **1,900 h** | Illustrative central estimate; rough range 1,100–3,300 h |
| Hours retired with new post-baseline verified package acceptance | **0 h** | Deliberate initial reset; earlier progress is already included in the 1,900 h *remaining* baseline |
| Forecast still open at baseline | **1,900 h** | Can change only with evidence/estimate revision |
| Actual human/agent effort hours logged | **UNKNOWN** | Git commit timestamps and tool/CI duration do not equal engineering hours |
| One-worker planning productivity | **35 productive h/week** | Explicit modeling assumption; calendar dates are forecasts, not commitments |
| Combined two-workstream scenario | **65 productive h/week** | Requires genuine parallel capacity, otherwise not attainable |
| Baseline freeze source | `3a441b1fa389a9a274e6ca82413740a3ffa2f51b` | Recheck latest main, staged PRs and issue receipts each query |

**Starting work-progress convention:** exactly 0/1,900 *new remaining-hours retired*, **not** ERP 0% implemented. No past receipts are replayed or double-counted. Existing PM02 focused proof, browser #45132932414 and accepted Mac/CI evidence are already reflected in the definition of remaining baseline scope.

## Cumulative progress clock — estimates only

| Completion gate | Planned hour block | Increment | Cumulative budget | Verified retired now | Expected future work done at exit | Baseline finish if serial, 35 h/week |
|---|---:|---:|---:|---:|---:|---|
| M4 / prototype 5/8 | H0001–H0170 | 170 h | 170 h | **0 h** | 8.9% | 27 Dec 2026 |
| M6 / prototype 6/8 | H0171–H0290 | 120 h | 290 h | **0 h** | 15.3% | 20 Jan 2027 |
| M7 / prototype 7/8 | H0291–H0340 | 50 h | 340 h | **0 h** | 17.9% | 30 Jan 2027 |
| M8 / prototype 8/8 | H0341–H0405 | 65 h | 405 h | **0 h** | 21.3% | 12 Feb 2027 |
| GL-05 / all HR and payroll | H0406–H0705 | 300 h | 705 h | **0 h** | 37.1% | 13 Apr 2027 |
| GL-06 / full accounting, tax and banking | H0706–H1185 | 480 h | 1,185 h | **0 h** | 62.4% | 18 Jul 2027 |
| Cross-Project purchasing, budgets and exceptions | H1186–H1315 | 130 h | 1,315 h | **0 h** | 69.2% | 13 Aug 2027 |
| GL-04 / eight-role operational acceptance | H1316–H1435 | 120 h | 1,435 h | **0 h** | 75.5% | 06 Sept 2027 |
| GL-07 / production security and governance | H1436–H1530 | 95 h | 1,530 h | **0 h** | 80.5% | 25 Sept 2027 |
| GL-08 / real production hosting and recovery | H1531–H1640 | 110 h | 1,640 h | **0 h** | 86.3% | 17 Oct 2027 |
| GL-09 / data migration and business onboarding | H1641–H1750 | 110 h | 1,750 h | **0 h** | 92.1% | 08 Nov 2027 |
| GL-10 / full acceptance, cutover and stable usage | H1751–H1900 | 150 h | 1,900 h | **0 h** | 100.0% | 08 Dec 2027 |

**ETA logic:** remaining-hour budget ÷ verified productive h/week gives work weeks, then add actual waiting/approval/seasonal/calendar constraints. All calendar endpoints recalculated **from the current Singapore date** at each live request; do not leave the baseline dates fixed forever. The late-2027 baseline assumes every needed business policy/approval, independent review, host, people and migration data is ready without delay. Model uncertainty is substantial, especially Thailand Accounting, payroll and 112-ID scope.

## Hour-by-hour plan — exact work packages (all 1,900 numbered hour slots)

Every single forecast hour H0001…H1900 appears as one row in [the hourly CSV](ERP-FULL-USE-HOURLY-1900.csv). Rows are **forecast engineering budget slots**, not scheduled clock appointments, proof of completed effort, or a claim that humans work a fixed continuous 1,900h. A package earns 0 hours until its specific acceptance is verified, then its *remaining-work estimate* is retired; optional real time is logged separately. In-progress stage status may show without converting into false hour-credit.

| Package | Hour range | Budget | Work and acceptance | Current evidence / credit |
|---|---:|---:|---|---|
| `M4-01` | H0001–H0020 | 20 h | Current-source and all-112 evidence/scope decisions; **exit:** 112 unique IDs classified; genuine gaps resolved or scoped; no inferred approval | Pending post-baseline evidence; **0 h credited** |
| `M4-02` | H0021–H0042 | 22 h | PM02 real browser and retained-role authorization; **exit:** Store/Khaimook approved A / returned B / correction lifecycle in actual UI | Pending post-baseline evidence; **0 h credited** |
| `M4-03` | H0043–H0064 | 22 h | FM01, BEN04 and PM16 real-browser acceptance; **exit:** Three distinct authenticated scenarios and denials, with no redundant previous browser probes | Pending post-baseline evidence; **0 h credited** |
| `M4-04` | H0065–H0090 | 26 h | PUR01 whole-PO supplier-count and commercial rule; **exit:** 1/2/3 suppliers by THB net total; Ben-approved reasoned exception; limits accepted | Pending post-baseline evidence; **0 h credited** |
| `M4-05` | H0091–H0120 | 30 h | PUR04 core PO commercial/delivery fields; **exit:** Company-scoped terms and source-linked immutable approvals, no implicit cross-Project | Pending post-baseline evidence; **0 h credited** |
| `M4-06` | H0121–H0135 | 15 h | PUR07 supplier-name PO PDF and manual dispatch evidence; **exit:** PDF name and recorded handoff; email/LINE sending stays external | Pending post-baseline evidence; **0 h credited** |
| `M4-07` | H0136–H0150 | 15 h | PUR12 K-/T- company PO document identity; **exit:** New-doc format with preserved historical numbers and no cross-Company confusion | Pending post-baseline evidence; **0 h credited** |
| `M4-08` | H0151–H0170 | 20 h | M4 focused closure, governed integration and Owner decision; **exit:** Exact candidate, linked evidence, independent review; owner-gated final CI/merge, no Production | Pending post-baseline evidence; **0 h credited** |
| `M6-01` | H0171–H0195 | 25 h | Build deployable preserved-data integrated M4/M6 candidate; **exit:** Exact approved source, additive schema and records preserved | Pending post-baseline evidence; **0 h credited** |
| `M6-02` | H0196–H0220 | 25 h | Site, plan, request, issue and document deployed journeys; **exit:** Eight-role boundary tests with actual API/browser where needed | Pending post-baseline evidence; **0 h credited** |
| `M6-03` | H0221–H0250 | 30 h | Procurement, receiving, transfers and inventory deployed journeys; **exit:** Canonical source-to-GR/stock, no duplicate posting, no replay of past Mac checks | Pending post-baseline evidence; **0 h credited** |
| `M6-04` | H0251–H0270 | 20 h | Subcontract physical acceptance/certification deployed journey; **exit:** Independent accepted quantity to certification, no new Finance implied | Pending post-baseline evidence; **0 h credited** |
| `M6-05` | H0271–H0290 | 20 h | HR encrypted/protected-file deployed journey; **exit:** Authorized bytes and denial proof with safe private-key custody | Pending post-baseline evidence; **0 h credited** |
| `M7-01` | H0291–H0310 | 20 h | Paired populated DB, Documents and external HR-key backup; **exit:** Immutable verified copy with provenance and secret isolation | Pending post-baseline evidence; **0 h credited** |
| `M7-02` | H0311–H0325 | 15 h | Restore to distinct non-overwriting target; **exit:** Matching data/files/keys, restored application startup and authenticated reads | Pending post-baseline evidence; **0 h credited** |
| `M7-03` | H0326–H0340 | 15 h | Recovery negative paths and runbook evidence; **exit:** Wrong key/missing document/unauthorized actor fail closed; records preserved | Pending post-baseline evidence; **0 h credited** |
| `M8-01` | H0341–H0360 | 20 h | Independent exact-head review and security reconciliation; **exit:** No unresolved P1/P2; no builder self-approval | Pending post-baseline evidence; **0 h credited** |
| `M8-02` | H0361–H0385 | 25 h | Frozen integrated candidate and final justified release validation; **exit:** Owner-authorized mandatory final CI only; actual reviewed-tree identity | Pending post-baseline evidence; **0 h credited** |
| `M8-03` | H0386–H0405 | 20 h | Prototype audit evidence and Owner technical freeze acceptance; **exit:** Milestones 4,6,7 observed; user UAT remains separate | Pending post-baseline evidence; **0 h credited** |
| `HR-01` | H0406–H0440 | 35 h | Close HR1-A private records, role and file work; **exit:** Retained sensitive-data matrix and protected history verified | Pending post-baseline evidence; **0 h credited** |
| `HR-02` | H0441–H0495 | 55 h | Attendance, site time and timesheet handling; **exit:** Employment/Project periods, correction and immutable approval | Pending post-baseline evidence; **0 h credited** |
| `HR-03` | H0496–H0550 | 55 h | Leave, overtime and attendance entitlement; **exit:** Approved Thailand-specific policy and controlled calculations | Pending post-baseline evidence; **0 h credited** |
| `HR-04` | H0551–H0630 | 80 h | Payroll computation, Thai statutory contributions and taxes; **exit:** Validated pay rules, allowances, deduction and legislation-specific fixtures | Pending post-baseline evidence; **0 h credited** |
| `HR-05` | H0631–H0665 | 35 h | Payroll maker-checker, payslips and period locking; **exit:** Koh/Nancy/Ben/Porn boundary and approved bank/payment interface | Pending post-baseline evidence; **0 h credited** |
| `HR-06` | H0666–H0705 | 40 h | HR integrated API/UI/privacy and real-role acceptance; **exit:** HR-to-Finance postings reconciled without salary disclosures | Pending post-baseline evidence; **0 h credited** |
| `ACC-01` | H0706–H0785 | 80 h | Chart of accounts, posting rules, journal and immutable GL; **exit:** Double-entry audit, THB, periods, trial balance | Pending post-baseline evidence; **0 h credited** |
| `ACC-02` | H0786–H0855 | 70 h | AP supplier invoices, three-way matching and credits; **exit:** PO/GR/quantity source and Nancy maker/checker; no duplicate liability | Pending post-baseline evidence; **0 h credited** |
| `ACC-03` | H0856–H0915 | 60 h | AR customer billing, receipts, quotation and VO handoff; **exit:** Ben work confirmation → Porn billing; Nancy controls where assigned | Pending post-baseline evidence; **0 h credited** |
| `ACC-04` | H0916–H0995 | 80 h | Supplier/subcontract payments, cash/bank and reconciliation; **exit:** Approval limits, payment runs, bank reconciliations and idempotency | Pending post-baseline evidence; **0 h credited** |
| `ACC-05` | H0996–H1060 | 65 h | Thailand VAT, WHT and tax reporting; **exit:** Reviewed local tax rules, test vectors and accountable signoff | Pending post-baseline evidence; **0 h credited** |
| `ACC-06` | H1061–H1100 | 40 h | Asset depreciation, periods and controls; **exit:** Jai register → Nancy depreciation, append-only asset/audit evidence | Pending post-baseline evidence; **0 h credited** |
| `ACC-07` | H1101–H1140 | 40 h | Payroll-to-GL and financial cost attribution; **exit:** Balanced GL and P&L with confidential salary boundaries | Pending post-baseline evidence; **0 h credited** |
| `ACC-08` | H1141–H1185 | 45 h | Financial reporting, close, export and accountant handoff; **exit:** Trial balance, audit trail, statement/export and close validation | Pending post-baseline evidence; **0 h credited** |
| `XP-01` | H1186–H1205 | 20 h | Finalize formerly gated #245, BEN02/BEN03 and PM03 decisions; **exit:** Signed allocation/exception contract, no guessed thresholds | Pending post-baseline evidence; **0 h credited** |
| `XP-02` | H1206–H1255 | 50 h | One supplier PO with multiple Project allocations; **exit:** A18/B2 source links, price and single commitment, cross-Company isolation | Pending post-baseline evidence; **0 h credited** |
| `XP-03` | H1256–H1290 | 35 h | Partial/central/direct deliveries and ledger allocation; **exit:** No duplicate PO/GR/stock/Finance; preserved outstanding per Project | Pending post-baseline evidence; **0 h credited** |
| `XP-04` | H1291–H1315 | 25 h | Budget checks, emergency rules, exception and change control; **exit:** Owner-approved limits, approval ancestry and out-of-plan audit | Pending post-baseline evidence; **0 h credited** |
| `ROLE-01` | H1316–H1350 | 35 h | Retained MKE/TCJ eight-role permissions and approval settings; **exit:** Real Company/Project roles, no synthetic grants mistaken for live | Pending post-baseline evidence; **0 h credited** |
| `ROLE-02` | H1351–H1385 | 35 h | All eight role-specific guided workflow walkthroughs; **exit:** Named Ben/Nancy/Khaimook/Jai/Store/Foreman/Porn/Koh separation | Pending post-baseline evidence; **0 h credited** |
| `ROLE-03` | H1386–H1420 | 35 h | Complete cross-module business UAT and exception coverage; **exit:** All 112 current requirements signed by accountable users | Pending post-baseline evidence; **0 h credited** |
| `ROLE-04` | H1421–H1435 | 15 h | Repair verified role/approval gaps and retain signoffs; **exit:** Open critical user defects closed, access still least privilege | Pending post-baseline evidence; **0 h credited** |
| `SEC-01` | H1436–H1465 | 30 h | Threat model and production-access/authorization negative tests; **exit:** Tenant/Project, CSRF, session, maker/checker and authorization denies | Pending post-baseline evidence; **0 h credited** |
| `SEC-02` | H1466–H1480 | 15 h | Enforced GitHub protected-main/review controls; **exit:** Actual active ruleset status plus non-bypass evidence | Pending post-baseline evidence; **0 h credited** |
| `SEC-03` | H1481–H1500 | 20 h | HR/Finance confidential record review; **exit:** No salary, customer profit or banking cross-role exposure | Pending post-baseline evidence; **0 h credited** |
| `SEC-04` | H1501–H1515 | 15 h | TLS, credentials and secret/key custody; **exit:** Protected runtime/rotation, no credentials in repo/logs | Pending post-baseline evidence; **0 h credited** |
| `SEC-05` | H1516–H1530 | 15 h | Vulnerability, audit and incident response signoff; **exit:** No release-blocking findings and escalation owners | Pending post-baseline evidence; **0 h credited** |
| `INF-01` | H1531–H1560 | 30 h | Approved host, persistent storage, TLS and runtime service; **exit:** Production-only authorization and reviewed release artifact | Pending post-baseline evidence; **0 h credited** |
| `INF-02` | H1561–H1585 | 25 h | Scheduled encrypted offsite DB + Documents backups; **exit:** Paired point-in-time backups and 24h RPO proof | Pending post-baseline evidence; **0 h credited** |
| `INF-03` | H1586–H1605 | 20 h | External HR keys, deploy/rollback and smoke proof; **exit:** No overwrite of actual data; 8h recovery target measured | Pending post-baseline evidence; **0 h credited** |
| `INF-04` | H1606–H1630 | 25 h | Independent populated production-like restore drill; **exit:** Authenticated restored app, matching bytes and key ownership | Pending post-baseline evidence; **0 h credited** |
| `INF-05` | H1631–H1640 | 10 h | Monitoring, alerting, SLO and on-call runbooks; **exit:** Incident owner and health/restore alert proof | Pending post-baseline evidence; **0 h credited** |
| `DATA-01` | H1641–H1670 | 30 h | MKE/TCJ Company/Project/warehouse master onboarding; **exit:** Approved mappings and no guessed retained Company IDs | Pending post-baseline evidence; **0 h credited** |
| `DATA-02` | H1671–H1700 | 30 h | Import suppliers, employees, BOQ and financial opening balances; **exit:** THB/currency provenance, references and reconciliation | Pending post-baseline evidence; **0 h credited** |
| `DATA-03` | H1701–H1720 | 20 h | Real users, role grants and workflow assignment; **exit:** Named user approvals and effective permission readback | Pending post-baseline evidence; **0 h credited** |
| `DATA-04` | H1721–H1750 | 30 h | Controlled source-to-target tie-out, training and SOPs; **exit:** Signed migration variances, training records and cutover owner | Pending post-baseline evidence; **0 h credited** |
| `LAUNCH-01` | H1751–H1780 | 30 h | Frozen staged candidate and no-write production smoke; **exit:** End-to-end source/secret/storage/permission identity checked | Pending post-baseline evidence; **0 h credited** |
| `LAUNCH-02` | H1781–H1825 | 45 h | Comprehensive human UAT across all eight roles; **exit:** All required workflows pass, no missed source/role obligation | Pending post-baseline evidence; **0 h credited** |
| `LAUNCH-03` | H1826–H1870 | 45 h | Resolve observed critical defects and affected-path retests; **exit:** No repeated all-suites without changed risk; all P0/P1 closed | Pending post-baseline evidence; **0 h credited** |
| `LAUNCH-04` | H1871–H1885 | 15 h | Backup/rollback rehearsal and migration cutover; **exit:** Owner-approved go/no-go inputs; no production before authority | Pending post-baseline evidence; **0 h credited** |
| `LAUNCH-05` | H1886–H1900 | 15 h | Explicit Production go-live, support and operational acceptance; **exit:** Eight roles can use live system, stable support and signoff | Pending post-baseline evidence; **0 h credited** |

## Protocol for every 'continue recommended sequence', 'check recommended sequence', or 'live position'

1. **Read live reality first.** Retrieve exact GitHub `main`, latest source heads, draft/unmerged PRs, last applicable test/CI conclusions, #305 milestone statuses, #278 GL statuses, #304 112-ID scope evidence, and recent authorized Owner decisions; compare with this ledger's last accepted evidence. Do not infer source from old chat. A test run alone does not close a gate.
2. **Show the same visual dashboard near the top:** exact SGT timestamp, current official prototype M?/8 and GL?/10; numbered cursor or currently active H-range by package; **verified retired planned hours / forecast remaining**, progress bar and estimated finish for 35h/week (plus 65h/week comparison); blocked approvals and unchanged previous evidence. Label work-progress % clearly and never present it as functional completion.
3. **During 'continue': do the next authorized unblocked code/evidence action**, after rechecking whether it already passed; no repeated full CI, Mac operator or completed browser. If real work advances, record exact PR/SHA/CI evidence and mark the package `IN_PROGRESS` or `VERIFIED`. Only an exit satisfying the listed acceptance can retire hours. If a package partially advances, annotate factual substeps and optionally revise *remaining estimate* with justification; do not earn 100% from a partial test.
4. **After every substantive verification**, update package `status`, `verifiedHours`, `evidence`, `verifiedAt` in [machine-readable ledger](ERP-FULL-USE-WORKPACKAGES.json) and append a dated update to #304 or #278 as appropriate. If the 112 requirements or business scope changes, publish an explicitly approved rebaseline (not silent percentage changes). No need to push a docs-only commit just to state unchanged facts.
5. **Project ETA from now**, not from start: `remainingForecastHours / productiveHoursPerWeek` plus calendar and authorization delays. Provide optimistic / baseline / conservative scenario if they materially diverge. **Actual work hours remain UNKNOWN unless someone supplies time records**; neither GitHub Action duration nor elapsed wall-clock time is a timesheet. Never infer exact progress from `commit count`.
6. **State clear next action, owner dependency and blocked gates**. Protected main merge, production retained roles, Finance/HR scope authority and final full CI still require their applicable approvals; do not self-approve. Issue #384 explicitly forbids broad/full CI without fresh specific authorization.

## Existing verified baseline reused (not forecast hours to charge twice)

- M4 source-and-evidence crosswalk currently [#411](https://github.com/threeswordz/cinder-grind/pull/411) (all 112 IDs represented; not all UAT accepted).
- PM02 native Store→Khaimook A/B→Jai RFQ/award/PO→Ben approval [#45127724396](https://github.com/threeswordz/cinder-grind/actions/runs/45127724396), source Draft [#412](https://github.com/threeswordz/cinder-grind/pull/412). PM02 real UI and effective retained roles still unverified.
- Corrected real-browser scoped operational work [#45132932414](https://github.com/threeswordz/cinder-grind/actions/runs/45132932414) PASS; does not cover PM02, FM01/BEN04/PM16 browser paths.
- Existing FM02, FM03, receiving, transfers, UOM, subcontract, stock count, material-plan and V1.2/V1.3 accepted receipts must be reused with their demonstrated limits. No CI, preserved Mac, production or human UAT rerun from tracker creation.

## Change control and estimation accuracy

Package hours are **explicit planning allocations**, not calibrated measured durations; realistic total uncertainty is **1,100–3,300 additional productive engineering hours**. This is a lower confidence forecast until Finance/HR/accounting-country policies, supplier quotation commercial basis, real role grants and #245 are frozen. A completed prototype M8 does not close GL-05/06/07/08/09/10. External user training, infrastructure access and review waits can push calendar ETA later without consuming engineering hours. If an approved scope change increases hours, show the revised forecast, delta and evidence rather than concealing schedule slippage. Rebaseline by delta, never silently edit prior time entries.
