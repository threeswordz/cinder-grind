# Construction ERP — Production / Go-Live Readiness Register

**Status:** Baseline register for recurring owner-facing live-position reports (not Production deployment authorization).  
**Established:** 2026-10-28 SGT (Product / Business Owner request).  
**Tracker:** [#278](https://github.com/threeswordz/cinder-grind/issues/278)  
**Source hierarchy:** current live GitHub main/CI and accepted decision/release evidence → active issue/PR implementation evidence → this dated register. Never allow stale copied status to overrule live GitHub.

## 0. Later verified gate checkpoint — 2026-10-30 SGT (supersedes the baseline statuses below)

- [#278](https://github.com/threeswordz/cinder-grind/issues/278) records **3/10 verified complete** after V1.3 BOQ acceptance under DEC-038, [#266 closure](https://github.com/threeswordz/cinder-grind/issues/266), and final documentation #284 / exact-main [CI40866079211](https://github.com/threeswordz/cinder-grind/actions/runs/40866079211) SUCCESS31/31. GL-03 is now **VERIFIED COMPLETE**. The `2/10` gate graphic below is the preserved **28 October historical checkpoint**, not the current live result.
- [#283](https://github.com/threeswordz/cinder-grind/issues/283) HR1-A entry is approved and its employee/history/Company-entitlement backend has merged; the encrypted Document/UI/role/business-acceptance work remains active. This does **not** make GL-05 verified or activate retained HR grants.
- [#288](https://github.com/threeswordz/cinder-grind/issues/288) directs **defer new Accounting development**, retain existing Finance/BOQ approvals and scope the next operational workflow separately after HR. [112 source-preserving role requirements](ROLE-REQUIREMENTS-2026-10-30/README.md) were published through #290; that publication is **not** a configured seven-role UAT pass, so GL-04 stays pending.
- [#289](https://github.com/threeswordz/cinder-grind/issues/289) physical stock count is a **proposal only**, awaiting SC-D01–04 scope decisions before coding. [#245](https://github.com/threeswordz/cinder-grind/issues/245) remains separately gated.
- No evidence of real Production host provisioning, HTTPS/security deployment, off-host backups+restore, MKE/TCJ cutover or operational pilot has been asserted. GL-07–10 remain pending/unverified/not started as applicable. **Production deployment is unauthorized.**

**Full-scope gate summary at this checkpoint:** **3 verified (GL-01–03); 7 pending / conditional / unverified**. This is a count of gate categories, *not* engineering completion, forecast or a reason to deploy. Recheck live evidence before reporting any newer status.

## 1. Starting checkpoint — 2026-10-28 SGT

- `main` `0a7040aebc966263737f492c740b01381e230736`; [exact-main CI 40716408188](https://github.com/threeswordz/cinder-grind/actions/runs/40716408188) **SUCCESS, 31/31 steps**; 230 API/41 web tests according to [#275](https://github.com/threeswordz/cinder-grind/issues/275).
- V0.1–V1.2 releases: **COMPLETE + ACCEPTED**, with actual owner decisions and scope limitations preserved; [V1.2 closure](V1.2-RELEASE-EXIT.md). **No re-test of previously accepted V1.2 THB/optional Mac fixtures/recovery.**
- V1.3-A entry COMPLETE. V1.3-B active: pricing [#276](https://github.com/threeswordz/cinder-grind/pull/276) and internal persistence/approval [#277](https://github.com/threeswordz/cinder-grind/pull/277) technically COMPLETE; external API, field disclosures, Documents, exports/report/print/cache, UI/locales, affected browser testing and V1.3-C approval remain outstanding under [#275](https://github.com/threeswordz/cinder-grind/issues/275)/[#266](https://github.com/threeswordz/cinder-grind/issues/266).
- V1.0 Production **engineering** readiness is accepted ([release-exit evidence](V1.0-RELEASE-EXIT-EVIDENCE.md)), **not** proof of a provisioned, operating Production site.
- `main` was **unprotected** at the checkpoint (GitHub branch API); no rulesets observed. Confirm current state at each later check.
- Production hosting, production-environment restore, production data, live-user onboarding, cutover and go-live evidence are **not verified from repository evidence**. Unknown is not a test failure.
- HR requirements are [published](HR-PAYROLL-ENTRY-PREPARATION.md), not implemented. General Ledger/tax/accounting statutory scope is not established as delivered by existing AP/AR/payment functions. [#245](https://github.com/threeswordz/cinder-grind/issues/245) remains design-only/deferred.
- **Production deployment: NOT AUTHORIZED.**

### Historical 2026-10-28 visual baseline (gate categories, not engineering percentage)

```text
PRODUCTION / GO-LIVE GATES — FULL-SCOPE PLANNING VIEW
[■][■][▒][□][□][□][□][□][□][□]
  2 independently verified categories | 1 active | 7 outstanding/unverified
```

`■` verified complete; `▒` active; `□` pending, unverified or conditional. This is **2/10 gate categories**, **not 20% software completion, forecast, a weighted score or permission to launch**. A pilot may explicitly defer certain business features while still requiring mandatory Production safety, data integrity, onboarding, support and a separate go/no-go decision.

## 2. Production / Go-Live gate register

| Gate | Category | Updated verified status (2026-10-30) | Evidence and remaining requirement |
|---|---|---|---|
| **GL-01** | Accepted operational core and THB policy | **VERIFIED COMPLETE** | V0.1–V1.2 accepted release receipts and DEC-036. No repeated human acceptance. |
| **GL-02** | Production-readiness **engineering baseline** | **VERIFIED COMPLETE** | V1.0-A–E accepted [evidence](V1.0-RELEASE-EXIT-EVIDENCE.md); [deployment](../deploy/production/README.md), [recovery](../deploy/recovery/README.md), [operations](OPERATIONS-RUNBOOK.md). Does not verify live host/scheduled backups. |
| **GL-03** | V1.3 linked cost/customer BOQ and disclosure | **VERIFIED COMPLETE (29 October 2026)** | [#275](https://github.com/threeswordz/cinder-grind/issues/275)/[#266](https://github.com/threeswordz/cinder-grind/issues/266) accepted under DEC-038, [final release exit](V1.3-RELEASE-EXIT.md), documentation #284 and exact-main [CI40866079211](https://github.com/threeswordz/cinder-grind/actions/runs/40866079211). Preserve accepted fixture/human limits; no repeated BOQ UAT. |
| **GL-04** | Seven-role workflow fit for **real launch scope** | **PENDING: requirements reconciled, runtime configuration unverified** | [112-ID execution disposition](ROLE-REQUIREMENTS-2026-10-30/13-execution-disposition.md) and [gap register](ROLE-REQUIREMENTS-2026-10-30/10-traceability-gap-register.md) preserve verified-vs-partial-vs-missing/deferred distinctions, but do **not** prove named-user grants. Match actual retained roles/approvals and must-have operational behavior before launch. |
| **GL-05** | HR / Attendance / Payroll | **ACTIVE HR1-A; later stages CONDITIONAL FOR PILOT** | [Approved #283](https://github.com/threeswordz/cinder-grind/issues/283) has integrated employee/access backend. Protected files/UI/role evidence and Owner HR1-A acceptance remain; attendance, leave, OT, payroll and statutory calculations are separately gated. If excluded from a limited pilot, document external-process controls and reconciling handoff. |
| **GL-06** | Full accounting / GL / tax / external-accountant handoff | **DEFERRED DEVELOPMENT — CONDITIONAL FOR PILOT** | [Owner #288](https://github.com/threeswordz/cinder-grind/issues/288) defers new Accounting (AP/AR changes, bank, payment, GL, tax, depreciation, payroll-to-Finance). Existing Finance controls remain. If pilot retains external accounting, explicitly approve operating scope and prove exported/reconciled handoff before go-live; do not imply full GL delivery. |
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

- **Current authorized feature writer:** [HR1-A #283](https://github.com/threeswordz/cinder-grind/issues/283), after V1.3 #275/#266 were closed and separately accepted. Continue only approved employee/history/privacy work through exact-head CI, independent review, normal merge and Owner business acceptance. Reporting changes do not alter the HR implementation branch, grants or dataset.
- **Next successor planning:** [#288](https://github.com/threeswordz/cinder-grind/issues/288) preserves the 112-role implementation assessment and defers Accounting; [#289](https://github.com/threeswordz/cinder-grind/issues/289) physical stock count is the bounded *candidate*, awaiting Owner scope choices before implementation. Material requests and approved-plan issues are alternative separate operational packages. HR1-B/C, leave/OT and payroll are later separately gated work.
- **Production operations:** choose a budget-compliant open-source-first host and prepare using [V1.0 deployment](../deploy/production/README.md) and [recovery](../deploy/recovery/README.md); require actual environment validation rather than disposable CI assertions. Branch protection was not enabled at baseline; it is an actionable security/governance gap.
- **#245:** multi-Project PO remains separate proposed change control; not an automatic first-pilot blocker if separate POs meet the approved launch boundary.
- **Approval boundary:** this is **reporting + gap capture only**. It authorizes no Production deployment, no new runtime/schema/grant changes, no HR payroll production use, no accounting/tax assumptions, and no unapproved scope expansion.
