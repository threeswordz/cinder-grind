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

ACCEPTED SUCCESSORS (re-verify live status before reporting)
V1.1 Business Workflow & Role UI (A–E)
V1.2 THB-only Monetary Hardening (A–C)
V1.3 BOQ Disclosure and Linked Customer BOQ Versions (A–C)

CURRENT APPROVED IMPLEMENTATION (verify exact PR/CI)
HR1-A Employee / Employment / Privacy

SEPARATELY GATED FUTURE OR DEFERRED
HR1-B / HR1-C / leave / OT / payroll
Operational material/stock workflow candidates — approval-specific
New Accounting development — deferred under Issue #288
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

Within the fixed owner-facing order in §6B, show the following full go-live evidence (the GL-01–10 table remains mandatory):

1. **Go-live gate visual** — verified-complete categories, actively progressing, pending/unknown/conditional categories; count verified categories out of ten in the current **full-scope** planning baseline. Distinguish a limited pilot if separately authorized.
2. **Gap table** — GL-01 through GL-10: area, current evidence-bound status, work missing, priority and relevant existing Issue/PR/decision. Do not count the V1.0 Production *engineering* release as proof of actual hosting, backup scheduling or go-live.
3. **Specific next milestone** — what the existing designated implementation owner does next, which targeted new UAT/acceptance still applies, which operational evidence remains unverified, and whether an actual owner approval is needed.
4. **Latest role requirement-to-code fit** — compare all relevant approved role requirements to implemented, partial, missing, deferred and *retained configuration not verified* status; use the preserved 112-ID [execution disposition](ROLE-REQUIREMENTS-2026-10-30/13-execution-disposition.md), not the earlier accounting-first ranking.
5. **Concrete next actions** — sequence actual current PR/CI/review, authorized feature work, separately gated operational package, and the real Production setup/cutover obligations. Distinguish outstanding technical work from decisions and owner business acceptance.
6. **Standing release and Production protection** — accepted V1.1/V1.2/V1.3 releases remain accepted; never reschedule old UAT as a new blocker. No unauthorized data/grant/schema/Production mutations or hidden salary/commercial exposures.

Gate statuses are **VERIFIED COMPLETE / ACTIVE / PENDING / UNVERIFIED / CONDITIONAL FOR PILOT**. A lack of hosted-environment evidence is **UNVERIFIED, not FAILED**. A green CI result is technical evidence, not deployment evidence; an accepted release is not automatically a live Production site. [Issue #278](https://github.com/threeswordz/cinder-grind/issues/278) documents a later **3/10 verified** checkpoint after V1.3 business acceptance; its earlier **2/10** snapshot is historical. Always recalculate from current evidence. These are gate counts, **not engineering percentages**. For limited pilots, identify explicitly approved exclusions and controlled external handoffs; never mark deferred features delivered.

Future updates to this presentation standard do **not** approve new implementation scope, business permission grants, HR/statutory policy, paid infrastructure, data migration, release exit or deployment. The approved HR1-A single writer is tracked under [#283](https://github.com/threeswordz/cinder-grind/issues/283). The corrected execution order is [#288](https://github.com/threeswordz/cinder-grind/issues/288): Accounting deferred; the physical-count [#289](https://github.com/threeswordz/cinder-grind/issues/289) and [#300](https://github.com/threeswordz/cinder-grind/pull/300) records supply its live scope/integration evidence. Reporting does not start competing coding or new UAT.


## 6B. Fixed owner-facing live-position order (approved 2026-10-31 SGT)

**Owner direction:** Whenever the Owner asks for "live position", preserve the following **same section order**, while independently fetching and updating all live values. This is a formatting/traceability commitment, not a freeze of current SHA, feature status, counts, or execution order. A concise question may use fewer details, but the full status request uses this order.

1. **Executive dashboard:** source time (SGT), verified exact `main` SHA and main CI, open implementation PR count, 3/10-style verified GL category count (recalculated), accepted release baseline and production authorization.
2. **Full chronological implementation roadmap:** V0.1–V0.8, always expose V0.6-A–E; V1.0-A–E; V1.1-A–E; V1.2-A–C; V1.3-A–C; HR1-A and any later explicitly approved operational slices. Indicate accepted/complete versus draft, blocked, deferred or future, *not* invented percentages.
3. **What is in progress:** all active implementation Issues, PRs, exact HEAD SHAs, draft/ready/merged state, exact-HEAD push and PR CI conclusions, mandatory review findings/gates, dependency order and predecessor health. Separate complete code from completed release.
4. **Production/go-live readiness GL-01 through GL-10:** gate visual and full table, exact evidence, real-runtime unknowns, mandatory pilot controls, latest actual verified 3/10-style count. No claim that CI is hosting/UAT.
5. **Seven-role requirements and exact gap fit:** use all 112 source-stable IDs, show frozen source assessment versus new implementation/integration deltas, each relevant actor, configured/unverified grants and required operational acceptance. Preserve Porn as a distinct deferred Accounting role where the eight source role files are relevant.
6. **Critical pending business rules and future modules:** named FM/BEN/PM/SS/PUR gaps, HR1-B/C, Accounting and #245 deferrals, unknown decisions; do not promote unapproved scopes into active coding.
7. **Tool/authority matrix:** what Chat can build/test/review; which exact PRs require independent Codex (DEC-022); what Work can audit; and Owner-only scope, live grant/data, Production and UAT decisions. Distinguish quota error from code failure, and a technical green build from approval.
8. **Chat-only work currently possible:** existing-scope defects/tests, focused review/evidence, GL-04/07/08/09/10 read-only preparedness and next-stage proposal only when scope is not approved.
9. **Numbered, evidence-bound execution queue:** P0 release/review and true launch gates first, then *proposed* P1 operational scopes and deferred/future features. Identify owner/tool/predecessor and exact exit condition; label P0/P1/P2 as recommendations, not an authorization.
10. **Decisions actually needed from the Owner:** no reasking past approved scope/THB/BOQ UAT, no merged/retained/Production changes implied by a status request.
11. **Final checkpoint comparison:** exact `main`, open PR numbers+SHA+review/CI, GL counts, deployment status and what changed versus previous live report.

**Strictness:** No static gate count, open-PR count, CI conclusion, branch-protection status or frozen 112-ID classification may be presented as newly verified without reading its source. The 2026-10-30 assessment is historical; count a later implementation as on-main only after its actual governed merge and verified CI, and never infer retained grants or Owner acceptance from it. Mark unavailable sources UNVERIFIED. Retain the GL-01–10 table, accepted release stages, blockers and next action.

**Execution priorities and tool boundary:** Follow the latest explicit Owner instruction and live Issues/PRs. At the 1 November 2026 checkpoint Stock Count #300 and Weekly Reporting #302 are technically integrated, with affected-path Owner acceptance still separate; HR #297/#298/#299 follow in dependency-safe order, then approved readiness preparation #303/#306–309. #288 continues to defer Accounting. Chat/CI handle approved implementation; DEC-022 governs stable-candidate independent Codex review; Work remains the optional broad auditor. Re-check actual tool availability, rather than copying an old quota hold. Neither a general continue instruction nor green CI waives required review, human acceptance, retained activation or Production authorization. Do not repeat accepted THB/BOQ UAT.

**Supporting controlled handoffs:** [GL04 launch-role verification plan](GL04-LAUNCH-ROLE-VERIFICATION-PLAN.md) and [GL07–GL10 production evidence plan](GL07-GL10-LAUNCH-EVIDENCE-PLAN.md). They are evidence templates only, not proof of activated role configuration or actual Production readiness.

## 7. Current roadmap destination

The original functional core ends at **V0.8 Management**, followed by **V1.0 Production Readiness**. These engineering releases and V1.1/V1.2/V1.3 were accepted at their individual gates. At the **2026-10-30** checkpoint, V1.3 #266/#275 are closed and accepted under DEC-038; the bounded **HR1-A** implementation is active under #283 (not yet Owner business accepted), while new Accounting is deferred under #288. Every later report must derive exact current main, stage, PR, CI and gates from live `docs/DEVELOPMENT-ROADMAP.md`, `docs/CURRENT-STATE.md`, #278/#283/#288 and GitHub evidence. Older checkpoints in this document are illustrations only. Actual Production deployment remains NOT AUTHORIZED without a separate go/no-go and real Production evidence.

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
