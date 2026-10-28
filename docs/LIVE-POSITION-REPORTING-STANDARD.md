# Construction ERP — Live Position Reporting Standard

**Status:** APPROVED — Product / Business Owner, 2026-10-01 (Singapore time)  
**Purpose:** Keep Construction ERP project-position reporting consistent and recoverable across new Chat sessions.

## 1. Trigger

When the Product / Business Owner asks for **"live position"**, **"current position"**, **"where are we"**, **"project status"**, or equivalent wording for the Construction ERP, Chat should use this standard unless the user explicitly requests another format.

## 2. Source-of-truth and freshness rule

Before reporting implementation status, re-fetch live GitHub state. At minimum reconcile:

1. `main` / default branch head;
2. active release and stage;
3. active Issue;
4. active branch;
5. open PRs;
6. latest applicable exact-head / PR / post-merge CI;
7. `docs/CURRENT-STATE.md`;
8. `docs/DEVELOPMENT-ROADMAP.md`;
9. applicable release scope / acceptance criteria / business rules;
10. [Production / Go-Live Readiness Register](PRODUCTION-GO-LIVE-READINESS.md) and its [cross-release Issue #278](https://github.com/threeswordz/cinder-grind/issues/278), with *fresh* security/hosting/cutover evidence when available.

Conversation memory may help with presentation preference, but it must not override live repository state.

## 3. Mandatory roadmap view

The first status visual should show the whole approved journey, not only the current stage:

```text
CONSTRUCTION ERP — LIVE POSITION

OPERATIONAL CORE
V0.1 Foundation
V0.2 Scheduling
V0.3 Procurement
V0.4 Inventory
V0.5 Subcontracts

FINANCIAL CORE
V0.6 Finance

  V0.6-A Supplier Invoice / PO-GR Traceability
  V0.6-B Client Invoice / AP-AR
  V0.6-C Payments / Allocations
  V0.6-D Subcontract Payment / Retention
  V0.6-E Cash Flow / Finance Reporting

COMMERCIAL CONTROL
V0.7 Cost Control

MANAGEMENT LAYER
V0.8 Management

PRODUCTION READINESS
V1.0 Production Readiness

ACTIVE APPROVED SUCCESSOR
V1.1 Business Workflow & Role UI (stages/status from live GitHub)
```

The labels for V0.6-A through V0.6-E are concise presentation labels for the approved V0.6 build stages. If the approved V0.6 scope changes through Change Control, the reporting labels must be updated to match the repository.

Always keep V0.6-A through V0.6-E visible individually, including after V0.6 is complete, so the Product / Business Owner can see exactly which Finance stages were delivered.

For later releases, when source-controlled stage definitions exist, include their stage breakdown in the same style without removing the full-roadmap view.

## 4. Visual convention

Use a plain-text progress visual similar to:

```text
V0.5 Subcontracts     ██████████  COMPLETE + ACCEPTED
V0.6 Finance          ██████████  COMPLETE + ACCEPTED
V0.7 Cost Control     ██████████  COMPLETE + ACCEPTED
  V0.7-A Read Model   ██████████  COMPLETE
  V0.7-B Direct Cost  ██████████  COMPLETE
  V0.7-C Forecast     ██████████  COMPLETE
  V0.7-D Variations   ██████████  COMPLETE
  V0.7-E Reporting    ██████████  COMPLETE
  Release Exit        ██████████  COMPLETE + ACCEPTED
V0.8 Management       ██████████  COMPLETE + ACCEPTED
  V0.8 Entry Gate     ██████████  COMPLETE
  V0.8-A Read Model   ██████████  COMPLETE
  V0.8-B Dashboards   ██████████  COMPLETE
  V0.8-C Executive    ██████████  COMPLETE
  V0.8-D Domain Views ██████████  COMPLETE
  V0.8-E Reporting    ██████████  COMPLETE
  Release Exit        ██████████  COMPLETE + ACCEPTED
V1.0 Production       ░░░░░░░░░░  ENTRY PACKAGE APPROVED — CLOSURE ACTIVE
  V1.0 Entry Gate      ░░░░░░░░░░  OWNER-APPROVED / CLOSURE ACTIVE
  V1.0-A Environment   ░░░░░░░░░░  NOT AUTHORIZED UNTIL CLOSURE
  V1.0-B Recovery      ░░░░░░░░░░  FUTURE
  V1.0-C Security      ░░░░░░░░░░  FUTURE
  V1.0-D Operations    ░░░░░░░░░░  FUTURE
  V1.0-E Release       ░░░░░░░░░░  FUTURE
```

**Historical illustration only:** The V1.0 entry status in the example above shows an earlier checkpoint; it is not today's live position. For V1.1 and any later approved release, use the real source-controlled stage breakdown and status from `docs/CURRENT-STATE.md` and `docs/DEVELOPMENT-ROADMAP.md` without altering the full-roadmap, V0.6-A–E and status-vocabulary requirements.

Progress bars are qualitative status indicators, not calculated engineering percentages:

- `██████████` = completed applicable gates for that displayed unit;
- `░░░░░░░░░░` = not yet complete;
- a mixed bar may be used for an actively implemented/validated stage, but must not be presented as a precise percentage unless the repository contains an approved quantitative measure.

## 5. Status vocabulary

Use these terms consistently:

- **COMPLETE** — the displayed stage/release work is technically complete and its applicable merge/CI/closure gates are satisfied.
- **ACCEPTED** — required Product / Business Owner human UAT/business acceptance for the release has been explicitly completed and durably recorded.
- **ENTRY APPROVED** — the release entry baseline is approved and closed, but implementation has not yet started.
- **ACTIVE** — implementation is currently in progress.
- **PRE-FLIGHT ACTIVE** — an approved stage is in documentation/status pre-flight or review reconciliation; the implementation gate is not cleared. Any provisional work that exists must remain frozen/unpackaged until the pre-flight CI/review/merge/post-merge evidence is complete.
- **UNDER VALIDATION** — implementation exists, but one or more required technical gates remain before completion.
- **BLOCKED — CODEX** — use only when a required Codex review is the actual remaining blocker.
- **BLOCKED — OWNER DECISION** — a Product / Business Owner decision is required before proceeding.
- **BLOCKED — UAT** — required human UAT/business acceptance is the actual remaining blocker.
- **NEXT** — the next authorized implementation stage once all required predecessor conditions are satisfied.
- **FUTURE** — planned in the approved roadmap but not the current/next authorized stage.
- **AFTER V0.8** — use for the V1.0 Production / production-readiness destination while V0.8 release exit is still incomplete. Once V0.8 is COMPLETE + ACCEPTED, report the live V1.0 entry-decision state from GitHub. While an entry proposal is unapproved, show **ENTRY PACKAGE PROPOSED / BLOCKED — OWNER DECISION**. After owner approval but before merge/post-merge closure, show **ENTRY PACKAGE APPROVED / CLOSURE ACTIVE** and keep V1.0-A NOT AUTHORIZED. After entry closure completes, show the Entry Gate COMPLETE and V1.0-A as NEXT or ACTIVE according to live GitHub.

Do not label something COMPLETE merely because code exists. Apply the actual repository gates.

## 6. Mandatory follow-up summary

Immediately after the roadmap visual, show:

- **Current exact position** — release/stage and relevant live branch/Issue/PR state;
- **Current blocker** — state `None` when there is no blocker;
- **Immediate next action** — the next governance-valid action;
- **Latest verified main** — current `main` SHA when useful for implementation coordination.

Keep this summary concise unless the Product / Business Owner asks for more detail.

## 6A. Mandatory Production / Go-Live dashboard (owner addition, 2026-10-28)

The owner explicitly requested that **from now on** every Construction ERP live-position report show the **remaining path to actual Production/go-live**, visually, **in addition to** the complete feature/release roadmap. The durable gate definitions, evidence, initial state and safe pilot interpretation are in [Production / Go-Live Readiness Register](PRODUCTION-GO-LIVE-READINESS.md), tracked through [#278](https://github.com/threeswordz/cinder-grind/issues/278).

After the mandatory roadmap, show:

1. **Go-live gate visual** — verified-complete categories, actively progressing, pending/unknown/conditional categories; count verified categories out of ten in the current **full-scope** planning baseline. Distinguish a limited pilot if separately authorized.
2. **Gap table** — GL-01 through GL-10: area, current evidence-bound status, work missing, priority and relevant existing Issue/PR/decision. Do not count the V1.0 Production *engineering* release as proof of actual hosting, backup scheduling or go-live.
3. **Specific next milestone** — what the existing designated implementation owner does next, which targeted new UAT/acceptance still applies, which operational evidence remains unverified, and whether an actual owner approval is needed.
4. **Standing release and Production protection** — accepted V1.1/V1.2 THB work remains accepted; never reschedule old UAT as a new blocker. No unauthorized data/grant/schema/Production mutations or hidden salary/commercial exposures.

Gate statuses are **VERIFIED COMPLETE / ACTIVE / PENDING / UNVERIFIED / CONDITIONAL FOR PILOT**. A lack of hosted-environment evidence is **UNVERIFIED, not FAILED**. A green CI result is technical evidence, not deployment evidence; an accepted release is not automatically a live Production site. Count `2/10` only where all ten categories and their specific evidence remain applicable and confirmed; it is **not 20% code completion** and must be recalculated when evidence changes. For limited pilots, identify explicitly approved exclusions and controlled external handoffs; never mark deferred features delivered.

Future updates to this presentation standard do **not** approve new implementation scope, business permission grants, HR/statutory policy, paid infrastructure, data migration, release exit or deployment. The designated Builder owns #275 BOQ implementation; this dashboard must not start a competing writer, branch or test run.

## 7. Current roadmap destination

The original functional core ends at **V0.8 Management**, followed by **V1.0 Production Readiness**. Both are COMPLETE + ACCEPTED. **At the 2026-10-28 checkpoint, V1.1 and V1.2 are also COMPLETE + ACCEPTED, and V1.3-B BOQ is ACTIVE under #275**; the accepted #276/#277 internal increments are not full user-facing BOQ completion. For every later report derive the current destination, stage and gates from live `docs/DEVELOPMENT-ROADMAP.md`, `docs/CURRENT-STATE.md`, linked #266/#275 and GitHub evidence; never treat this dated checkpoint or the older historical examples as current. Actual Production remains NOT AUTHORIZED unless a new explicit go/no-go exists.

If the approved roadmap later adds V0.9 or changes the production destination, follow the newer approved repository baseline.

## 8. Governance preservation

This reporting standard controls presentation only. It does **not** change or waive:

- release/stage sequencing;
- predecessor completion rules;
- exact-head / PR / post-merge CI requirements;
- review requirements or explicit one-time waivers;
- human UAT/business acceptance ownership;
- DEC-008 open-source / zero-cost-first;
- DEC-016 Chat / Work / GitHub operating model;
- approved scope / deferrals;
- Project security / authorization rules;
- forward-only migration discipline;
- Change Control.

Live GitHub remains the durable source of truth.
