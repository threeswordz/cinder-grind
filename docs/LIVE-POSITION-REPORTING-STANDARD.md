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
9. applicable release scope / acceptance criteria / business rules.

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

FINAL DESTINATION
V1.0 Production
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
V1.0 Production       ░░░░░░░░░░  ENTRY PACKAGE PROPOSED — OWNER DECISION
  V1.0 Entry Gate      ░░░░░░░░░░  BLOCKED — OWNER DECISION
  V1.0-A Environment   ░░░░░░░░░░  PROPOSED / NOT AUTHORIZED
  V1.0-B Recovery      ░░░░░░░░░░  PROPOSED / NOT AUTHORIZED
  V1.0-C Security      ░░░░░░░░░░  PROPOSED / NOT AUTHORIZED
  V1.0-D Operations    ░░░░░░░░░░  PROPOSED / NOT AUTHORIZED
  V1.0-E Release       ░░░░░░░░░░  PROPOSED / NOT AUTHORIZED
```

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
- **AFTER V0.8** — use for the V1.0 Production / production-readiness destination while V0.8 release exit is still incomplete. Once V0.8 is COMPLETE + ACCEPTED, report the live V1.0 entry-decision state from GitHub. While Issue #187 / draft PR #188 are active and unapproved, show **ENTRY PACKAGE PROPOSED / BLOCKED — OWNER DECISION** and keep V1.0-A–E explicitly NOT AUTHORIZED.

Do not label something COMPLETE merely because code exists. Apply the actual repository gates.

## 6. Mandatory follow-up summary

Immediately after the roadmap visual, show:

- **Current exact position** — release/stage and relevant live branch/Issue/PR state;
- **Current blocker** — state `None` when there is no blocker;
- **Immediate next action** — the next governance-valid action;
- **Latest verified main** — current `main` SHA when useful for implementation coordination.

Keep this summary concise unless the Product / Business Owner asks for more detail.

## 7. Current roadmap destination

The approved Development Roadmap currently ends functionally at **V0.8 Management**.

The reporting view should therefore show **V1.0 Production** as the destination after V0.8, representing production-readiness/hardening and release decision work rather than inventing a V0.9 feature release.

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
