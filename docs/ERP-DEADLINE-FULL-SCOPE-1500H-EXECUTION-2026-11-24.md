# Construction ERP — human-deadline delivery execution and proposed 1,500h full-scope reforecast

> **Planning proposal prepared 24 November 2026 SGT; not accepted scope, actual worker time, new UAT authority, verified hours retired or release authorization.** GitHub source snapshot: protected main `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`; integrated Draft PR [#427](https://github.com/threeswordz/cinder-grind/pull/427) at `435bd8805d5bcd7e0a1a9941668b67860f288b78`. The official [#414](https://github.com/threeswordz/cinder-grind/issues/414) and existing ledger still carry the **1,900h baseline / 1,847h provisional current forecast**. This document proposes **1,500h**, *not* a silently applied replacement.

## Executive decision — what is and is not achievable

- **Keep full scope:** 112 immutable requirement IDs and all eight named roles, Thai HR/payroll, full GL/AP/AR/VAT/WHT/banking, #245 cross-Project, secure host/recovery, independent DEC-022, DEC-042 human UAT and authorized Production.
- **Propose full-scope remaining-work optimization:** original baseline **1,900h**, current provisional estimate **1,847h**, additional proposed reduction **347h**, target **1,500h**. Savings are **hypotheses at package level** requiring source-fit and actual defect observations, not earned productivity. The planning target is about **21.1% below 1,900h**.
- **Confidence:** target 1,500h = stretch planning goal; maintain **1,750h risk-aware capacity scenario** until actual cadence and Thai statutory/Accounting complexity are measured. No guarantee of 1,500h or calendar date. The old 1,100–3,300h uncertainty range has not been statistically replaced.
- **Time requirement:** the Owner has a hard real-world deadline **not yet supplied**. Record exact date/time, timezone, mandatory-live subset, and minimum working staff capacity before making promises. Required effective weekly capacity = remaining hours / calendar weeks available, then add independent-review/authorization critical-path delay. AI tools cannot be assumed to contribute scheduled productive hours.
- **Do not skip:** Company/Project isolation, source provenance, maker/checker, retained access authority, real backup/restore, Thai payroll/tax review, independent DEC-022, final justified #384 authorized CI, DEC-042 and explicit Owner Production go/no-go.
- **Zero extra Work/Codex usage now:** Chat+GitHub for read-only reconciliation, bounded functional fixes and isolated focused tests. Reserve independent review for independent human/Codex when genuinely available; Builder cannot sign itself off. No background processing assumed.

## Program forecast by workstream

| Workstream | Current provisional hours | Proposed optimized hours | Proposed saving | Confidence |
|---|---:|---:|---:|---|
| Prototype 5/8 (M4) | 117 | 94 | 23 | Medium |
| Prototype 6/8 (M6) | 120 | 95 | 25 | Medium |
| Prototype 7/8 recovery (M7) | 50 | 36 | 14 | Medium |
| Prototype 8/8 freeze (M8) | 65 | 50 | 15 | Medium |
| Thai HR/payroll | 300 | 265 | 35 | Low |
| Thai Accounting/GL/tax/banking | 480 | 425 | 55 | Low |
| Cross-Project purchasing (#245) | 130 | 110 | 20 | Low |
| Eight-role operational acceptance | 120 | 80 | 40 | Medium |
| Security and governance | 95 | 75 | 20 | Medium |
| Production hosting/recovery | 110 | 85 | 25 | Medium |
| Data migration/onboarding | 110 | 85 | 25 | Medium |
| Final UAT/cutover | 150 | 100 | 50 | Low |
| **Full 60-package scope** | **1,847** | **1,500** | **347** | **Conditional** |

**Forecast safeguards:** the 53h already shaved from 1,900 to 1,847 is NOT counted among the 347h further saving; baseline `verifiedRetiredHours=0`, `actualLoggedHours=null`, prototype `4/8`, GL `3/10`, formal M4 packages `0/8`, and last published M4 `20/32` technical remain unchanged. The recent real 84-check synthetic document/Client BOQ proof [#45326220770](https://github.com/threeswordz/cinder-grind/actions/runs/45326220770) is supporting **bounded** evidence, not human UAT or new accepted package counts.

## Every package — source-bound optimization hypothesis

See [machine-readable 60-row proposal](ERP-DEADLINE-FULL-SCOPE-1500H-PACKAGES-2026-11-24.csv). An accepted estimate change requires a per-row source/evidence crosswalk. The rightmost description is an **action to validate**, not proof that savings have already occurred.

| Package | Stage | Current | Target | Saving | Reuse or execution hypothesis |
|---|---|---:|---:|---:|---|
| M4-01 | M4 | 32h | 24h | 8h | Reuse 112-ID source mapping; reconcile exact frozen candidate, unknown role/policy gaps only |
| M4-02 | M4 | 8h | 6h | 2h | Reuse PM02 native and real Chromium evidence; do only unmet retained role checks |
| M4-03 | M4 | 10h | 8h | 2h | Reuse FM01/BEN04/PM16 real UI proof; target missing outsider scope and actor admissions |
| M4-04 | M4 | 8h | 6h | 2h | Reuse supplier-count native/Jai-Ben browser receipts; resolve only commercial exceptions |
| M4-05 | M4 | 9h | 7h | 2h | Reuse PUR04 source and PUR05 approved-revision evidence; prove final delta |
| M4-06 | M4 | 10h | 8h | 2h | Reuse Thai Unicode server PDF and actual Jai/Ben browser; verify target font/visual/role only |
| M4-07 | M4 | 6h | 5h | 1h | Reuse PO-prefix native SQL immutability receipts; verify final permissions |
| M4-08 | M4 | 34h | 30h | 4h | Single exact-source integration dossier, independent review and authorized final CI/merge gate |
| M6-01 | M6 | 25h | 20h | 5h | Build from frozen source, additive migration delta only; preserve existing populated data |
| M6-02 | M6 | 25h | 20h | 5h | Reuse prior Mac material/foreman journeys; target only uncovered current-source paths |
| M6-03 | M6 | 30h | 25h | 5h | Reuse proven receiving/transfer/stock count tests; validate changed integration links only |
| M6-04 | M6 | 20h | 15h | 5h | Reuse physical subcontract accepted quantity flow; avoid second Finance posting path |
| M6-05 | M6 | 20h | 15h | 5h | Reuse 84-check synthetic encrypted HR and project files; run real target custody proof once |
| M7-01 | M7 | 20h | 15h | 5h | Reuse backup operator patterns, but actually back up matching DB/Documents/external keys |
| M7-02 | M7 | 15h | 11h | 4h | Restore once to genuinely separate non-overwriting target; avoid repeated historical rehearsal |
| M7-03 | M7 | 15h | 10h | 5h | Focus changed failure paths and immutable receipt evidence, not whole CI |
| M8-01 | M8 | 20h | 18h | 2h | One frozen exact-SHA independent DEC-022 coverage map, no repeated preliminary reviews |
| M8-02 | M8 | 25h | 18h | 7h | Use source-bound prior CI and one new Owner-authorized full-release validation only |
| M8-03 | M8 | 20h | 14h | 6h | Single 112-ID audit index and explicit Owner freeze acceptance, no redundant copies |
| HR-01 | GL05 | 35h | 30h | 5h | Extend existing HR1-A privacy and employee source instead of rebuilding record/role layer |
| HR-02 | GL05 | 55h | 50h | 5h | Shared site/employee time and corrections engine; avoid duplicate time models |
| HR-03 | GL05 | 55h | 50h | 5h | Shared approved leave/OT entitlement calculator; only signed Thai policy variants |
| HR-04 | GL05 | 80h | 75h | 5h | Single effective-dated Thailand payroll rules engine with verified statutory examples |
| HR-05 | GL05 | 35h | 30h | 5h | Reuse existing approval/audit/document frameworks; no payroll shortcut to bank |
| HR-06 | GL05 | 40h | 30h | 10h | One role-aware payroll→Finance integration acceptance; preserve confidential salary views |
| ACC-01 | GL06 | 80h | 72h | 8h | Reuse audit, immutable event and THB provenance primitives, implement real double-entry GL |
| ACC-02 | GL06 | 70h | 63h | 7h | Reuse approved PO/GR source IDs and matching rules; do not create shadow liabilities |
| ACC-03 | GL06 | 60h | 55h | 5h | Reuse Ben progress confirmation/Client BOQ and documented invoice workflow |
| ACC-04 | GL06 | 80h | 75h | 5h | Shared controlled payment approval and reconciliation primitives across AP/subcontracts |
| ACC-05 | GL06 | 65h | 60h | 5h | One reusable tax/WHT calculation/report engine; validate Thai regulations independently |
| ACC-06 | GL06 | 40h | 36h | 4h | Reuse CG##### asset register and shared period/ledger rules; Nancy depreciation |
| ACC-07 | GL06 | 40h | 30h | 10h | Shared ledger mapping from payroll and Projects; retain salary access boundaries |
| ACC-08 | GL06 | 45h | 34h | 11h | Reuse trial balance, export and period-close evidence from actual journal source |
| XP-01 | XP | 20h | 16h | 4h | Resolve Owner #245 allocation/exception contract once before building |
| XP-02 | XP | 50h | 44h | 6h | Extend source-linked PO line allocations; avoid second purchasing workflow |
| XP-03 | XP | 35h | 30h | 5h | Reuse GR/transfer transactions to allocate actual receipts by Project once |
| XP-04 | XP | 25h | 20h | 5h | Reuse budget/approval engine with approved policy thresholds only |
| ROLE-01 | GL04 | 35h | 26h | 9h | One controlled real eight-user effective-permission readback with no retained blind grants |
| ROLE-02 | GL04 | 35h | 21h | 14h | One cross-role walkthrough matrix; reuse 84-check synthetic as prior risk evidence |
| ROLE-03 | GL04 | 35h | 24h | 11h | One consolidated integrated eight-role UAT; reuse accepted unchanged source checks |
| ROLE-04 | GL04 | 15h | 9h | 6h | Fix only observed named-user authorization defects, focused regression |
| SEC-01 | GL07 | 30h | 25h | 5h | Extend existing cross Company/Project, CSRF and maker-checker negatives; threat-driven gaps |
| SEC-02 | GL07 | 15h | 12h | 3h | Verify actual branch protection once and retain evidence, no repeated CI experiments |
| SEC-03 | GL07 | 20h | 16h | 4h | Cross-check HR/Finance Client BOQ restrictions from source and authenticated principals |
| SEC-04 | GL07 | 15h | 12h | 3h | Reuse secret/key custody design; prove real TLS/rotation on target |
| SEC-05 | GL07 | 15h | 10h | 5h | One dependency scan/audit/incident response signoff at frozen release source |
| INF-01 | GL08 | 30h | 24h | 6h | Repeatable approved hosting template; no private app data in repo |
| INF-02 | GL08 | 25h | 20h | 5h | Share paired DB/Documents/external-key backup automation with M7, but prove production schedule |
| INF-03 | GL08 | 20h | 16h | 4h | Reuse non-overwriting deploy/rollback scripts and prove real recovery within target |
| INF-04 | GL08 | 25h | 20h | 5h | Run actual independent populated production-like restore, source checksum parity |
| INF-05 | GL08 | 10h | 5h | 5h | Minimal real health/restore alert and incident runbook, not an observability rebuild |
| DATA-01 | GL09 | 30h | 23h | 7h | Use existing MKE/TCJ master data templates and validated lookup/import rules |
| DATA-02 | GL09 | 30h | 23h | 7h | Reuse THB source references and import validators with actual financial tie-outs |
| DATA-03 | GL09 | 20h | 15h | 5h | Reuse role/access mapping; provision only explicitly authorized real identities |
| DATA-04 | GL09 | 30h | 24h | 6h | One authoritative reconciliation and role-specific short SOP set |
| LAUNCH-01 | GL10 | 30h | 20h | 10h | Reuse frozen candidate and read-only smoke script; no duplicate full CI |
| LAUNCH-02 | GL10 | 45h | 31h | 14h | One human UAT plan covering all roles/112 IDs with distinct business signoffs |
| LAUNCH-03 | GL10 | 45h | 27h | 18h | Budget focused defects and affected-path retests only; no broad rerun |
| LAUNCH-04 | GL10 | 15h | 10h | 5h | Re-use already-proven recovery plans but conduct actual approved cutover rehearsal |
| LAUNCH-05 | GL10 | 15h | 12h | 3h | Explicit Owner go/no-go, live support and acceptance; no implicit auto-release |
| **TOTAL** | | **1,847h** | **1,500h** | **347h** | **Pending verification** |

## Deadline-first execution queue — do not spend effort on duplicate evidence

### Critical path 0: Owner's calendar date
The Owner must provide one actual deadline (SGT date and whether ERP must be live or only prototype/UAT-ready). **No deadline was provided with the execution authorization.** Report projected feasible date only after mapping remaining labor, actual engineer hours/week, reviewer availability and access lead time.

### Critical path 1: M4 exact-source acceptance closure
1. Maintain frozen Draft PR #427 `435bd880...`; no additional business source changes except confirmed blocking defects. **Verified on 24 Nov:** four historical Lane A/B/C/D branch heads `a20d9e8`, `54c0bf1`, `6c862db`, `783dca9` are each Git ancestors of current PR #427 HEAD (ahead 0, behind 38/29/35/37 respectively); **do not merge them again**. Check final diff for preserved effective behavior instead of equating ancestry with acceptance.
2. M4-01 classify all 112 IDs into working+source proven, actual missing function, real retained-role/Company/Project evidence missing, Owner policy blocked, and legitimately future GL work; preserve source IDs, risk and actor. Existing synthetic role proof covers **84 focused checks** and four real positive protected record types, NOT retained roles.
3. Close only critical functional source gaps discovered by this classification, including #428 SS11 custody/SS14 supplier alert and other exact M4 actor gaps if genuinely uncovered. Avoid repeating receiving, transfer, Thai PDF and Client BOQ tests already passed on compatible source.
4. One consolidated DEC-022 **independent reviewer** on relevant exact candidate/diff, explicit security scope and closure of findings. Current limited Codex P0 no-major-findings was on predecessor SHA `4819d794...`; exact current `435bd880...` and all 161 main-diff paths not independently cleared. Reviewer must be distinct from the Builder.
5. Request **specific Owner authorization** under #384 for the **one justified final** full release CI/Ready/protected main merge. Do not use full CI to debug. No retained MKE/TCJ scope changes or Production operations without distinct authorization. Explicit M4 Owner acceptance then moves 4/8→5/8.

### Critical path 2: Finish preserved-data prototype
M6 reuse actual validated material/receiving/subcontract/doc flow where the source and target match. M7 prove populated DB+file+external-HR-key restore to a separate host (never overwrite source). M8 independent exact source audit/freeze. This remains a **required 8/8 prototype, not live ERP**.

### Critical path 3: Full business functionality — start policy/data design in parallel when authorized
HR/payroll, Accounting/GL/VAT/WHT/bank, and #245 cross-Project allocation drive the highest estimate and statutory/policy risks. Obtain documented decision owners and reviewed Thailand-specific pay/tax rules early; do not invent thresholds or payroll policy. Reuse existing approval/audit/access/provenance infrastructure, but require genuinely balanced journal, proper withholding/VAT and confidential salary boundaries.

### Critical path 4: Real environment and go-live
Authorized named user provisioning (no blind grants), real full-workflow UAT, independent security clearance, protected deployment/backup/restore, Thai supplier/PDF host support, reconciled financial opening data, named operation/support owners and explicit release decision. Reuse unchanged prior evidence **only** where source, target, actor and acceptance criterion genuinely match.

## Stage exit and deadline policy
- Every progress report: exact **main/candidate/review SHA**, 112-ID coverage split, prototype outcomes, GL gates, technical vs formal M4 counts, completed packages/60, actual logged productive hours (or UNKNOWN), current verified baseline 1,847h, separate **1,500h target gap**, top blocker by accountable party and one next authorized action.
- Count technical progress on verified requirement/subcheck evidence; count formal package hours only after that package exit; estimate remaining productive effort on a fresh work-remaining basis to avoid double-credit. Track acceptance-wait days separately from productive development.
- Assign explicit owner, reviewer and business approver. Automation/CI cannot sign a human business or security review.
- Use a **weekly reality check**: after actual accepted work and observed defect rate, revise package estimates. If the implied deadline capacity exceeds real available engineers/reviewers, present a specific staffing, calendar or Owner-approved scope decision instead of disguising the gap.
- Stop generating more isolated browser fixtures unless a genuinely new invariant needs proof. One exact-source CI after necessary independent review/Owner authorization; zero routine redundant full suite runs.

## Immediate unblocked work and handoff
**Executor now: Chat only.** Reconcile M4-01 against the final #427 candidate and existing 112-ID matrix; turn remaining unmet acceptance gates into a signed priority list. #414 is canonical. This documentation proposal is isolated and does not itself change official forecasts, PR readiness, protected main, user grants or release status. **Next Owner input:** hard deadline as exact date (and whether Production live is compulsory).
