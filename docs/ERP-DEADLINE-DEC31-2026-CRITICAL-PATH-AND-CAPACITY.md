# Construction ERP — hard deadline 31 December 2026, Asia/Singapore

> **Owner confirmed deadline on 24 November 2026:** **31 Dec 2026**. Planning interpretation is **complete 112-requirement, eight-role ERP functioning in authorized Production**, as asked immediately before the Owner supplied the date. The owner has *not* approved a scope reduction, implementation risk waiver, retained-role grants, full CI, PR Ready, main merge, or Production release by supplying the date. **RED: not presently feasible to commit with known capacity and outstanding dependencies.** This document is an execution schedule/risk decision record, not a production approval or technical acceptance.

## Source and honest baseline
- Protected `main`: `3a441b1fa389a9a274e6ca82413740a3ffa2f51b` (reverified 24 Nov). Integrated [Draft PR #427](https://github.com/threeswordz/cinder-grind/pull/427): `435bd8805d5bcd7e0a1a9941668b67860f288b78`, OPEN/DRAFT/unmerged.
- Canonical [#414](https://github.com/threeswordz/cinder-grind/issues/414): original historical 1,900h forecast; 23 Nov provisional remaining **1,847h**, only 53h *estimated future work reduction*, not measured worked or accepted. 60 packages, 112 IDs, M4 technical **20/32 last published**, M4 full packages **0/8 accepted**, prototype **4/8**, go-live **3/10**, productive time logged **unknown**. [84-check synthetic positive-control run](https://github.com/threeswordz/cinder-grind/actions/runs/45326220770) PASS, not retained actor/human UAT. Independent full DEC-022 coverage still pending [#431](https://github.com/threeswordz/cinder-grind/issues/431). No full final #384 authorized CI or release.
- New [60-package optimization proposal](ERP-DEADLINE-FULL-SCOPE-1500H-EXECUTION-2026-11-24.md): **1,500h conditional stretch target** (additional *hypothesized* 347h reduction), not an approved or technically validated replacement for 1,847h.

## Calendar and capacity arithmetic
From 24 Nov to 31 Dec 2026: **37 elapsed calendar days** = **5.286 weeks**. The deadline is at the end of 31 December Singapore time; exact available hours vary with the current time, work calendar, holidays, approvals and staffing.

| Scenario | Effort remaining | Required team productive-hours / week | 35h/week-person equivalents | Assessment |
|---|---:|---:|---:|---|
| Current provisional full-ERP estimate | 1,847h | **349.4h/week** | **10.0** | Not feasible for one Chat-assisted Builder |
| Optimistic still-full-scope target, unvalidated | 1,500h | **283.8h/week** | **8.1** | Only plausible with multiple qualified concurrent contributors, instant domain/Owner decisions, reviewer and UAT capacity, and limited rework |
| One person, 35 productive h/week | **185h capacity** | 35h/week | 1.0 | Insufficient even for the optimized **275h** prototype M4–M8 segment |
| Combined 65 productive h/week capacity | **343.6h capacity** | 65h/week | 1.9 | Still short by **1,156.4h** of 1,500h target |
| Current M4 → 5/8 remaining (provisional) | **117h** | **22.1h/week** to deadline | 0.63 | More plausible, but milestone acceptance remains independently reviewed / Owner-gated |
| Optimized full prototype M4–M8 segment (stretch) | **275h** | **52.0h/week** | 1.49 | Possible with real staffing and timely review; cannot guarantee date |

**No imaginary AI labor capacity:** Chat can analyze/commit through GitHub in active sessions, but cannot autonomously work in the background. Work/Codex currently quota constrained; independent DEC-022 cannot be self-approved. Reviewer business and third-party Thai tax/payroll validation are separate bottlenecks, not solved by raw developer hours. A production-ready outcome requires sustained parallelism across independent domains and approval gates; 8.1/10.0 person equivalents are arithmetic lower bounds, NOT a staffing plan with risk buffer.

## Deadline-first decision — protect correctness

**Track A: full scope by 31 Dec (hard requirement).** Needs at minimum 284–350 proven weekly productive hours **immediately**, qualified parallel HR, Accounting, infrastructure, scope/evidence and frontend/backend teams, a distinct competent independent reviewer, Owner/business users available for decisions and real UAT, working Production target and data import authority, plus defect/rework reserve. This resourcing is **not yet verified**, so status is **RED / not a dependable commitment**. Do not call 1,500h "on track" until per-package savings and actual people/time are verified.

**Track B: fixed 31 Dec, smaller release outcome.** Only if Owner explicitly changes the required outcome. Candidate: deliver existing safe construction-operations flows (Projects, scoped Cost/Client BOQ, PR/RFQ/PO/GR, Material plan/issues/transfers, controlled documents, protected roles, essential source-backed billing export) with independent review, real staging/Production gates, approved human UAT and backups/restore. Never represent this as all 112 requirements or full Accounting/payroll. Record every deferred requirement and its subsequent release date. No scope change was approved merely by offering this option.

**Track C: full scope with a revised calendar date.** Preserve all requirements and independent safeguards, build to real measured productive capacity, and review exact delivery forecast after one week of observed validated work. Not selected by Owner merely through this document.

## Practical stage and ownership calendar (not invented acceptance)

| Window (SGT) | Required result, subject to authorization | Chat can execute now | Other critical authority |
|---|---|---|---|
| **24–27 Nov** | Freeze full-scope target and 112-ID current source-fit; verify 60-row estimates; establish actual weekly capacity, Owner availability and reviewer. Select A/B/C feasibility outcome by **27 Nov** | Exact issue/#427 source crosswalk, clarify historical stale gaps, identify test holes, prepare code/delta handoffs | Owner confirms staffing, accepted scope and necessary policy; independent reviewer booked |
| **28 Nov–4 Dec** | Complete true missing M4 functional defects and current-source closure; simultaneous HR/payroll and Accounting approved-rule/fixtures foundation | Focused isolated coding and issue/evidence updates, no repeated passing suites | Thai payroll/accounting policy owners; release review |
| **5–11 Dec** | M4 exact-head independent review and potential authorized integration; M6/M7 target source readiness; parallel HR/GL source construction | Source review preparation, targeted tests and safe branching | Owner-specific #384 full CI, reviewer; approved target access |
| **12–18 Dec** | Real populated recovery, integration, schema and eight-role scope fit; progress against Accounting/HR/payroll and #245 | Targeted code/CI only if explicitly authorized, evidence mapping | Retained MKE/TCJ authority, real domain staff, reviewer |
| **19–25 Dec** | Consolidated UAT on authorized staging, fix only release blockers; accounting/recovery/security readiness | Defect triage, focused fixes, release notes | Named eight human users, separate Owner policy/signoffs, reviewer |
| **26–31 Dec** | Final justified release checks, actual cutover drill, and explicit go/no-go; release **only if all mandatory gates genuinely pass** | Last source/evidence reconciliation and release coordination | Owner Production authority, operations/rollback roles, acceptance |

These windows show **dependencies and governance**, not proof that 1,500/1,847 engineering hours fit in the available staffing. Running HR, Accounting and Production in parallel without available qualified people is not credible.

## Immediately actionable GitHub sequence — Chat only
1. **Freeze Draft PR #427 at SHA `435bd880...`** except proven release blockers. Old Lane A/B/C/D branch SHAs are already ancestors; do not re-integrate or rerun accepted 84-check browser proof.
2. Reconcile [112-ID current candidate triage](ERP-DEADLINE-M4-112-CANDIDATE-TRIAGE-2026-11-24.csv): SS11 equipment-custody code/migration exists but prepared native PG suite unverified; PUR10 cancellation source exists but exact combined-source race/finance/GR coverage needs evidence; SS14/PM15 supplier date indicators partly source-backed, while supplier acknowledgment/true daily material-demand policy remains missing; PUR08 and PUR14 need dedicated source-gap check. Fix only genuine launch-critical defects.
3. Build a **single M4 release evidence register** with immutable source SHA, affected role/project, new vs reused targeted PASS, unresolved review and business/Owner gates. No new full CI for checks already passed. Formal M4 acceptance remains zero until exit.
4. Obtain distinct independent DEC-022 reviewer capacity and explicit fresh #384 full release CI/Ready/merge authorization when ready. Do not self-approve, alter protected main or grant retained access on deadline pressure.
5. In parallel, open HR/Thai tax/GL/#245 policy and statutory-rule signoff dependencies; missing business decisions are critical calendar-path risk.
6. Daily decision board: **days left**, full scope forecast current/target, observed productive weekly capacity, independently accepted packages, 112 status, release review age, highest owner-gated blocker, and whether the hard deadline remains feasible. RED by default until workforce/capacity and closure prerequisites are demonstrated.

## Owner decisions needed for an honest schedule
1. **Delivery scope at the deadline:** Full all-112 Production ERP assumed; no unilateral reduction.
2. **Available capacity 24 Nov–31 Dec:** number of real engineers and realistic productive hours/week, any Thai payroll/Accounting expert, independent DEC-022 reviewer, human business UAT availability.
3. **Production environment and retained data access:** approval for any future scoped operations must remain explicit and separate. The date itself does not grant authorization.

**No false claims:** A goal date is not a successful release, passed acceptance, working payroll or a source merge; no optimistic milestone/GL/accepted-hour counts have changed. Full 112-ID work remains committed unless Owner explicitly authorizes a scope decision.

## 24 November 2026 — actual staffing answer: ZERO additional software engineers

**Owner confirmed: "none" in response to the exact question "How many qualified software engineers can work on this ERP between now and December 31, excluding ChatGPT?"** No engineer is available to deliver HR/payroll, GL/tax/banking, #245 or infrastructure in parallel.

**Implications (supersedes any implicit staffing assumption above):**
- There is **no demonstrated 35h/week qualified engineering worker** and no verified 65h/week combined capacity. The 185h theoretical 35h/week person capacity is a mathematical illustration, **not available staffing**. Chat may author source in active sessions with user supervision and connected GitHub, but it cannot be counted as an autonomous scheduled engineer, guarantee a throughput rate or perform work between turns.
- The target of **1,500h** remains a *hypothetical effort optimization*, **not feasible as an assured completion-by-31-Dec plan**. The 1,847h current full-scope estimate is also not meetable as a credible engineering capacity forecast given known staffing.
- **Release status: RED.** No unilateral scope cut, security shortcut or deferred statutory requirement permitted. The Owner must explicitly choose whether 31 Dec means a smaller, tested release candidate/pilot, or whether full all-112 Production completion must move after 31 Dec. This is a product tradeoff, not a demand for more AI usage.
- **Realistic unapproved December target:** an exact-source construction-operations **staging demonstration / release candidate** (BOQ, PR/RFQ/PO/GR, inventory/transfers, scoped role readback and documents) with all critical defects enumerated and independent reviewer/retained-user/human acceptance still classified independently. Production pilot is **conditional** on proper independent review, real data/backup/recovery, named user signoff and explicit go-live authorization. Never call this all-112 full ERP or a guaranteed 5/8 signoff.
- **Full ERP remains mandatory future scope:** all 112 IDs, Thai payroll/HR, full Accounting GL/VAT/WHT/bank, cross-Project #245, actual MKE/TCJ UAT, independent DEC-022 and Production readiness are not cancelled.

### Chat-only bounded next work (no unsupported background promises)

1. **Immediate source review done at frozen PR #427 SHA `435bd8805d5bcd7e0a1a9941668b67860f288b78`:** `purchase-order.service.ts` and `procurement.service.ts` have no supplier acknowledgement/reschedule workflow tokens; `purchase-order.controller.ts` exposes PO creation/update/submit/approve/cancel/revise and PDF/dispatch events, not supplier acknowledgment/in-transit/return endpoints. `receiving.controller.ts` exposes capture/evidence/check/GR PO-link/void, not supplier-return processing; `receiving.service.ts` uses "replacement" only for superseded receiving evidence/delivery corrections, **not** supplier return/replacement. `material-return.service.ts` returns unused **issued** stock internally. Therefore PUR08 and PUR14 are confirmed *not evidenced in the inspected services/controllers* and deserve targeted design/implementation triage; no false "all modules completed" claim.
2. **Avoid rebuilding proven features:** SS11 tool/employee custody and PUR10 cancellation implementation already sit in the current candidate; SS14 supplier expected-delivery alerts exist with `supplierAcknowledgment='NOT_VERIFIED'` and `targetSite='NOT_RECORDED_ON_PO'`. Run only new focused tests/migration for uncovered source; do not manufacture supplier acknowledgement, supplier site target or paid/damaged stock ledger effects.
3. Reuse the full 112-ID matrix and 84 real synthetic protected-record checks. Produce one critical-path M4 acceptance exception register, mapping technical source to retained roles/Owner and independent reviewer gates. Do not replace human signoff with synthetic browser proof.
4. The next authorized actual coding should prioritize **PUR08 supplier delivery acknowledgment/state** and **PUR14 supplier discrepancy/return/replacement** only after confirming source model and approval/provenance invariants; do not imply the Owner approved a new supplier-return policy. A narrower technical source-gap audit remains authorized without Owner access.
5. Keep #414 official counters and original/target estimates distinct, no full CI, no Codex/Work, no protected main merge, no retained grants.

### Decision dashboard
| Decision | Current |
|---|---|
| Date | 31 Dec 2026 SGT |
| Additional qualified engineers | **0 verified** |
| Work mode | **Active-session Chat + connected GitHub, no autonomous background execution** |
| Full all-112 Production release by deadline | **Not credible with known resources; RED** |
| December candidate/pilot | **Potential narrower target, NOT approved or guaranteed** |
| Project scope retained | 112 immutable IDs, eight roles, full future HR/Accounting |
| Prototype, GL | 4/8, 3/10 unchanged |
| Existing full-ERP remaining forecast | 1,847h provisional unchanged |
| New planning stretch target | 1,500h *conditional*, **not accepted** |
