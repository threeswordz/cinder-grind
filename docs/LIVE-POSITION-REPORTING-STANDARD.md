# Construction ERP — Live Position Reporting Standard

## Effective Owner Format — 2 November 2026 SGT: V1.0-to-pre-production readiness checklist

**Latest controlling owner presentation direction.** This section **supersedes presentation requirements** in the historical mandatory V0.1–V0.8 roadmap display in sections 3–4, the historical eleven-section user-facing order in section 6B, and any earlier instruction to show the whole V0.1–V0.8 history. Preserve the original stage records and evidence in the repository; **do not display V0.1–V0.8** in standard future live-position answers. The developer may use those historical sources internally. This is *not* Change Control or authorization for implementation, retained access, human UAT, production activity, business rules or waived reviews/CI.

**Goal:** answer in one concise, actionable, **dependency-ordered readiness checklist**: What has been accepted? Where is the current successor? What exactly remains to reach a **frozen technically ready integrated pre-production prototype**? Who does each next action and what decision/check closes it? Keep the later path from prototype through UAT to real Production visible but separate.

### Mandatory owner-facing sections and order

1. **Executive checkpoint:** Singapore date/time; freshly verified `main` full SHA, exact-main CI URL/conclusion, open PR count/heads, current active approved successor, current blockers, Production authorization, GL-01–10 verified count and **current pre-production target milestone**. Distinguish implementation progress from deployed operational readiness.
2. **Accepted baseline and current successors — start V1.0:** display V1.0 Production Engineering (A–E), V1.1 Business Workflow/Role UI (A–E), V1.2 THB-only (A–C), V1.3 BOQ (A–C), their COMPLETE/ACCEPTED distinctions and any current bounded successors (HR1-A, physical count, weekly reports, material request, etc.). Only claim COMPLETE or ACCEPTED where actual gates/Owner receipts support it. Mark integrated technical code with **human UAT DEFERRED TO PRE-PRODUCTION PROTOTYPE** as appropriate; do not imply human acceptance. No V0.1–V0.8 release rows.
3. **One prioritized, ordered pre-production readiness checklist:** cover the active PR and code/test/CI/review dependency first, then launch-critical seven-role source fit + actual Company/Project authorization, operational business-rule decisions, security/branch protection, isolated prototype environment/storage/restore, MKE/TCJ safe onboarding data/profiles, integrated regression/security/recovery, and prototype freeze. Avoid reporting the same unresolved requirement in several separate tables. For **every** action row include:
   - **Order and priority** P0/P1/P2 (recommendation, not authorization), work item and relevant stable role requirement IDs / GL gate / Issue or PR;
   - **Status** exactly Done, In progress, Next, Blocked — Owner decision, Blocked — independent Codex/CI, Configuration unverified, Deferred or Future (where applicable);
   - **Required specific next step and predecessor**, **exit evidence** / acceptance criteria, **actor/tool**: Chat + CI, independent Codex (only when DEC-022 requires), Work (periodic read-only audit), repository administrator, or Owner;
   - **Decision status**: already approved / no new decision / specific unanswered Owner input / separately authorized retained action / deferred. Never conflate a tool with human business authority.
4. **Go-live GL-01–GL-10 compact evidence matrix:** show **all ten categories** and verified gate count using real evidence; clearly flag which GL tasks are needed to make an isolated prototype ready and which remain actual Production/pilot requirements. Show GL-04 role coverage and GL-07 security prominently; GL-05 HR1-B/C and GL-06 deferred Accounting must not be marked delivered or omitted. A production engineering baseline does not mean a live host exists. Real MKE/TCJ/host/grants remain UNVERIFIED until specifically authorized, inspected and evidenced.
5. **Current blockers and decisions that really require the Owner:** only unresolved decision points (e.g. BEN02 limits, canonical material plan/within/beyond-plan contract, real retained access/roles/cutover/Production), dependency and whom they block; do not repeat already approved BOQ/THB, #313 receipts or settled role answers. A pending human UAT is *deferred*, not an interim technical-development blocker under DEC-042.
6. **Next 1–3 executable steps and delta since last checkpoint:** lead with what the existing designated Chat builder can do now without asking again to continue, followed by any Codex/Work/administrator/Owner handoff; state exact stop condition and real prior-vs-current changes (main SHA, PR, CI, blockers, GL counts). If no technical work can proceed without a human gate, state that specific gate plainly.

### Governing work-order policy for the checklist

- **First close the current governed increment:** exact-head push + PR CI, applicable clean independent review on stable high-risk code, guarded expected-head merge, exact-main CI, technical disposition. No re-review for proven docs-only changes unless a separate gate or real finding requires it. Never bypass DEC-022.
- **Then reconcile approved integrated launch-critical code:** use the 112 preserved stable requirement IDs (seven operational roles Ben, Nancy, Khaimook, Jai, Store Site, Foreman, Koh, and Porn's distinct deferred Accounting boundary). Report source-on-main vs partially delivered vs required configuration/Owner human UAT. Do not misrepresent the frozen 2026-10-30 census as current coverage.
- **Then finish required business policies only as authorized:** within-plan vs beyond-plan stock issue, PM01/PM07/SS-PLAN-01, BEN02 emergencies and BEN03 budget enforcement are separate approval-gated work. A technical preparation or proposed scope is not approved runtime coding. New Accounting #288, HR1-B/C/leave/OT/payroll and multi-Project PO #245 stay Deferred/Future unless specifically changed through governance.
- **Then make an isolated non-Production prototype ready:** documented exact built main, controlled environment/Company/Project fixture, approved non-retained role and permission configuration, non-sensitive sample data, integrated automated/browser/security/upgrade/recovery evidence, user-visible multilingual workflows, rollback/restore plan, and a documented freeze candidate. GL-04, GL-07, GL-08/09 evidence must distinguish disposable prototype from actual retained Production onboarding/recovery.
- **Only after prototype freeze:** execute **one full cross-role/cross-module human UAT** and Owner business acceptance under DEC-042; defects return to governed fixes/refreeze and affected rechecks. Production GL-07–10 and explicit go/no-go/deployment approval follow separately. Do not count the prototype or synthetic CI as actual Production readiness.

### Status and authority guardrails

- Show **real verified GitHub facts**, not historical statuses, changing-run guesses, or speculative numeric completeness. Cite current CI/PR/Issue evidence. Use UNVERIFIED for unavailable real-host/grant facts and identify blockers versus nonblocking future work.
- V1.0/V1.1/V1.2/V1.3 accepted Owner evidence stays accepted; no replay of accepted THB/BOQ human UAT. Full-scope GL category denominator stays ten, even if a limited pilot is separately proposed.
- **Chat is the continuing Builder/Release Coordinator** for approved technical work; do not repeatedly request “continue.” **Codex** independently reviews when DEC-022 requires; **Work** can audit broadly; **Owner** decides policy, UAT, real retained data/grants and Production; an eligible **administrator** applies protected-main settings, subject to actual access/approved safeguards.
- Owner-facing readability matters more than document chronology: group connected role gaps, decisions, next implementation, required test and accountable actor **on one ordered row**; relegate noncritical Future and Deferred work to a short clearly marked tail.
- The older sections below are retained for historical provenance and unchanged technical constraints. **If they contradict this new reporting display or section order, follow this section.**

---

**DEC-042 prospective UAT reporting:** During technical development, show all pending manual/Owner/module/role UAT as **DEFERRED TO PRE-PRODUCTION PROTOTYPE**, not an immediate coding/technical-integration blocker, PASS or OWNER ACCEPTED. Show one full integrated pre-Production UAT as future mandatory prototype-exit gate before Production go/no-go; report unchanged automated CI, Codex, non-UAT Owner decisions, GL-01–GL-10 and explicit deployment authorization separately. DEC-042 supersedes DEC-041's interim cadence; do not rewrite historical accepted release evidence.

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

Future updates to this presentation standard do **not** approve new implementation scope, business permission grants, HR/statutory policy, paid infrastructure, data migration, release exit or deployment. The approved HR1-A single writer is tracked under [#283](https://github.com/threeswordz/cinder-grind/issues/283). The corrected execution order is [#288](https://github.com/threeswordz/cinder-grind/issues/288): Accounting deferred; physical-count [#289](https://github.com/threeswordz/cinder-grind/issues/289) and [#300](https://github.com/threeswordz/cinder-grind/pull/300) supply its scope/integration evidence. Reporting does not start competing coding or new UAT.

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

**Execution priorities and tool boundary:** Follow the latest explicit Owner instruction and live Issues/PRs. At the 2 November 2026 checkpoint Stock Count #300, Weekly Reporting #302 and HR #297/#298/#299 are merged; technical completion requires applicable exact-main CI. Approved readiness preparation follows #303 → #306 → #307 → #308 → #309. All pending human UAT/acceptance is DEFERRED TO PRE-PRODUCTION PROTOTYPE under DEC-042; no interim UAT blocks approved technical progression. #288 continues to defer Accounting. Chat/CI handle approved implementation; DEC-022 governs stable-candidate independent Codex review; Work remains the optional broad auditor. Re-check actual tool availability, rather than copying an old quota hold. Neither a general continue instruction nor green CI waives required review, human acceptance, retained activation or Production authorization. Do not repeat accepted THB/BOQ UAT.

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
