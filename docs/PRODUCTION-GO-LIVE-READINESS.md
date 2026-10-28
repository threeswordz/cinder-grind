# Construction ERP — Production / Go-Live Readiness Register

**Status:** Baseline register for recurring owner-facing live-position reports (not Production deployment authorization).  
**Established:** 2026-10-28 SGT (Product / Business Owner request).  
**Tracker:** [#278](https://github.com/threeswordz/cinder-grind/issues/278)  
**Source hierarchy:** current live GitHub main/CI and accepted decision/release evidence → active issue/PR implementation evidence → this dated register. Never allow stale copied status to overrule live GitHub.

## 1. Starting checkpoint — 2026-10-28 SGT

- `main` `0a7040aebc966263737f492c740b01381e230736`; [exact-main CI 40716408188](https://github.com/threeswordz/cinder-grind/actions/runs/40716408188) **SUCCESS, 31/31 steps**; 230 API/41 web tests according to [#275](https://github.com/threeswordz/cinder-grind/issues/275).
- V0.1–V1.2 releases: **COMPLETE + ACCEPTED**, with actual owner decisions and scope limitations preserved; [V1.2 closure](V1.2-RELEASE-EXIT.md). **No re-test of previously accepted V1.2 THB/optional Mac fixtures/recovery.**
- V1.3-A entry COMPLETE. V1.3-B active: pricing [#276](https://github.com/threeswordz/cinder-grind/pull/276) and internal persistence/approval [#277](https://github.com/threeswordz/cinder-grind/pull/277) technically COMPLETE; external API, field disclosures, Documents, exports/report/print/cache, UI/locales, affected browser testing and V1.3-C approval remain outstanding under [#275](https://github.com/threeswordz/cinder-grind/issues/275)/[#266](https://github.com/threeswordz/cinder-grind/issues/266).
- V1.0 Production **engineering** readiness is accepted ([release-exit evidence](V1.0-RELEASE-EXIT-EVIDENCE.md)), **not** proof of a provisioned, operating Production site.
- `main` was **unprotected** at the checkpoint (GitHub branch API); no rulesets observed. Confirm current state at each later check.
- Production hosting, production-environment restore, production data, live-user onboarding, cutover and go-live evidence are **not verified from repository evidence**. Unknown is not a test failure.
- HR requirements are [published](HR-PAYROLL-ENTRY-PREPARATION.md), not implemented. General Ledger/tax/accounting statutory scope is not established as delivered by existing AP/AR/payment functions. [#245](https://github.com/threeswordz/cinder-grind/issues/245) remains design-only/deferred.
- **Production deployment: NOT AUTHORIZED.**

### Visual baseline (gate categories, not engineering percentage)

```text
PRODUCTION / GO-LIVE GATES — FULL-SCOPE PLANNING VIEW
[■][■][▒][□][□][□][□][□][□][□]
  2 independently verified categories | 1 active | 7 outstanding/unverified
```

`■` verified complete; `▒` active; `□` pending, unverified or conditional. This is **2/10 gate categories**, **not 20% software completion, forecast, a weighted score or permission to launch**. A pilot may explicitly defer certain business features while still requiring mandatory Production safety, data integrity, onboarding, support and a separate go/no-go decision.

## 2. Production / Go-Live gate register

| Gate | Category | Baseline status | Evidence required to change status |
|---|---|---|---|
| **GL-01** | Accepted operational core and THB policy | **VERIFIED COMPLETE** | V0.1–V1.2 accepted release receipts and DEC-036. No repeated human acceptance. |
| **GL-02** | Production-readiness **engineering baseline** | **VERIFIED COMPLETE** | V1.0-A–E accepted [evidence](V1.0-RELEASE-EXIT-EVIDENCE.md); [deployment](../deploy/production/README.md), [recovery](../deploy/recovery/README.md), [operations](OPERATIONS-RUNBOOK.md). Does not verify live host/scheduled backups. |
| **GL-03** | V1.3 linked cost/customer BOQ and disclosure | **ACTIVE** | [#275](https://github.com/threeswordz/cinder-grind/issues/275)/[#266](https://github.com/threeswordz/cinder-grind/issues/266) BQC-AC-001–014 including API/Docs/exports/UI/locale authorization, exact review/CI, new affected-role UAT and separate release exit. |
| **GL-04** | Seven-role workflow fit for **real launch scope** | **PENDING GAP ASSESSMENT** | [Seven-role requirements](ERP-7-Roles-Requirements-2026-10-24-EN.md) traced to actual runtime/configured approvals with `existing / partial / missing / deferred` classifications; targeted action on must-haves, not broad re-UAT. |
| **GL-05** | HR / Attendance / Payroll | **NOT IMPLEMENTED — CONDITIONAL FOR PILOT** | Published [HR handoff](HR-PAYROLL-ENTRY-PREPARATION.md) → separate approved implementation and privacy/statutory/approval/cost tests **if replacing payroll**; otherwise named external process, evidence and boundary for limited pilot. |
| **GL-06** | Full accounting / GL / tax / external-accountant handoff | **GAP ASSESSMENT — CONDITIONAL FOR PILOT** | Prove required GL/tax/cash/bank/export/reconciliation from actual code and verified requirements; implement approved must-haves **if ERP becomes accounting authority**, or explicitly retain external accounting with reconciled evidence and handoff. Finance AP/AR/payment baseline is not full GL acceptance. |
| **GL-07** | Security and release governance | **PENDING** | Enforce suitable GitHub `main` protection/rulesets and required checks/reviews; production identities, Company/Project grants, maker/checker, confidential salary/customer-cost access, secrets, TLS, vulnerabilities and independent review recorded. |
| **GL-08** | **Real Production** infrastructure and recovery | **UNVERIFIED** | Approved host/storage/db, domain/TLS, runtime supervisor, protected credentials, verified file mount identity, off-host scheduled DB + Documents backups, isolated restore with compatible runtime, startup/HTTPS smoke, logging/alerting/on-call and evidenced RPO/RTO (targets: 24h/8h). Reuse existing scripts; CI rehearsal is not a production-site drill. |
| **GL-09** | MKE/TCJ data migration and onboarding | **UNVERIFIED** | Actual authorized Company/Project/user/role and approval records, masters, applicable opening balances, legacy currency provenance, data reconciliation, staff training, owner/support assignments and tested cutover. Do not fabricate historic data. |
| **GL-10** | Pilot, production candidate and owner go/no-go | **NOT STARTED** | Exact approved release freeze, new affected-path UAT, non-destructive production-like business/readiness smoke, backup and recovery, launch runbook/cutover/rollback/support owners, explicit owner authorization and documented production deployment verification. |

**Pilot boundary:** GL-01, GL-02, GL-07, GL-08, GL-09 and GL-10 remain mandatory for any real production use. GL-03/04 depend on which business processes pilot users are permitted to operate; unimplemented paths must be disabled or excluded. GL-05/06 may be deferred only if payroll/accounting remain in existing controlled systems with defined handoff/reconciliation. Do not quietly shrink the full-scope denominator or claim those features are complete.

## 3. What to report with every “live position”

1. Re-check exact live `main` SHA, branch, open PRs/issues, latest applicable CI, [Current State](CURRENT-STATE.md), [Roadmap](DEVELOPMENT-ROADMAP.md), scope/acceptance/decision receipts and this tracker; prefer newer verified receipts to historical dated snapshots.
2. First show the full accepted roadmap, including V0.6-A–E and all later active/current stages, then **a separate go-live readiness visual** and the gate table. Do not replace the release roadmap with this tracker.
3. State `N/10 verified gate categories; A active; U pending/unverified/conditional` only from the explicit evidence table. Never use invented engineering percentages, elapsed-time completion or false precision. If a gate has progressed but is incomplete, retain its correct status and explain the real increment.
4. Give the **next uncompleted gate**, concrete work item, authoritative Issue/PR, owner decision required (if any), and blockers. Distinguish pending decisions from technical work and from unknown real-world operational evidence.
5. An item changes to `VERIFIED COMPLETE` only with its real release/production evidence. Link actual code/CI/owner/prod proof. Do not self-approve UAT, release exit or go-live. Use `UNVERIFIED` when records are missing; do not call it `FAILED`.
6. Keep accepted V1.1/V1.2 tests closed; test only affected successor behavior, new production-specific configuration and fresh cutover facts. Old fixture gaps are not reopened.
7. Reconcile register and [#278](https://github.com/threeswordz/cinder-grind/issues/278) through normal reviewed updates when a substantive gate state changes, preferably in the related implementation/closure PR. Avoid repetitive status-only PRs.
8. Never publish actual salary/personnel data, credentials, private bank details or unredacted business records to the public GitHub repository.

## 4. Work order and explicit limits

- **Current authorized feature writer:** complete V1.3-B [#275](https://github.com/threeswordz/cinder-grind/issues/275) then V1.3-C targeted acceptance and separate exit; retain one-writer/DEC-016 control. Reporting changes do not alter its implementation branch, grants or dataset.
- **Next successor planning:** staged HR (requirements available but statutory exceptions and actors need specific reconciliation); accounting and seven-role gap assessment; scope/release approval before new implementation.
- **Production operations:** choose a budget-compliant open-source-first host and prepare using [V1.0 deployment](../deploy/production/README.md) and [recovery](../deploy/recovery/README.md); require actual environment validation rather than disposable CI assertions. Branch protection was not enabled at baseline; it is an actionable security/governance gap.
- **#245:** multi-Project PO remains separate proposed change control; not an automatic first-pilot blocker if separate POs meet the approved launch boundary.
- **Approval boundary:** this is **reporting + gap capture only**. It authorizes no Production deployment, no new runtime/schema/grant changes, no HR payroll production use, no accounting/tax assumptions, and no unapproved scope expansion.
