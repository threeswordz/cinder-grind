# Full-ERP 8-role × 112-requirement live hour roadmap

> **Canonical planning ledger — initial baseline 23 Nov 2026, 16:17 SGT.** This is a docs-only DRAFT, not a code release. **Future requests 'continue the recommended sequence', 'check the recommended sequence' and 'live position' MUST refresh exact GitHub source/CI/PR evidence first, compare with this ledger and render the current hour-range dashboard**. Evidence may be added only after verifying source and exit. No autonomous background polling is claimed.

## Definition of done

The ERP is complete only if all 112 requirements are implemented and working or explicitly superseded with Owner approval, all eight roles (Ben, Nancy, Khaimook, Jai, Store Site, Foreman, Porn and Koh) can use real MKE/TCJ authenticated workflows, integrated HR/payroll and Accounting/GL/tax/banking work, preserved data, functional cross-module workflows and no material blocking defects, valid backups/restore, business UAT and actual authorized Production go-live. An **8/8 prototype is not 100% ERP**. Accounting/HR and multi-Project scope formerly deferred must receive new authority before implementation.

## Latest execution — 23 Nov 2026, 21:14 SGT: PM02 actual distinct source-negative PASS

- **Genuine focused new #45181742276 SUCCESS** ([Actions](https://github.com/threeswordz/cinder-grind/actions/runs/45181742276)), on application/test source `80c6a541d1e55b89099e1b5798be1e70c0b228a0`, workflow-only exact-source child `06d2c707ddcfefe0fe2fd411f52ab3d1ddf6f060`. PG17.11 disposable forward-only migrations, Nest API compile and exactly **2 changed target files**, **9 tests PASS / 0 fail**. The existing immutable SQL trigger **P0001** correctly refuses forged returned B-line association with approved A supplier award *at INSERT*, with no staged PO line, submittedAt, or ApprovalInstance. A separate service transaction-seam test checks **7 distinct fail-closed states** (RETURNED, cancelled, foreign Company, other Project, rejected, unapproved and missing source) before `ApprovalService.start`, PO write or audit; that *unit seam* is **not misrepresented as a real PostgreSQL service transaction**.
- Previous [#45180688032](https://github.com/threeswordz/cinder-grind/actions/runs/45180688032) overall failed because it tried to insert a forged PO row already forbidden by SQL; [#45181384213](https://github.com/threeswordz/cinder-grind/actions/runs/45181384213) failed at a new test-only TypeScript narrowing; an earlier malformed workflow [#45180588923](https://github.com/threeswordz/cinder-grind/actions/runs/45180588923) was rejected with zero jobs. Explicitly retained as audit, **no production logic change or full CI rerun**.
- Actual PM02 authenticated Chromium [#45147124712](https://github.com/threeswordz/cinder-grind/actions/runs/45147124712) **previously SUCCESS**; no new Chrome rerun. M4-02 **3/4 = 75% technical checkpoints**; final retained real named Store/Khaimook/Jai/Ben role admissions, independent final review and Owner business acceptance OPEN.
- **Current M4 checkpoint aggregate now 20/32 = 62.5% technical**, previously 19/32. M4-03 stays 3/4 75%. 112 immutable IDs unchanged; no broader ERP readiness inferred. Official prototype **4/8**, GL **3/10**, full accepted packages **0/8**, revised-forecast baseline still **0 / 1900 retired, 1900h left** because no entire package accepted. No main merge, Ready, Mac, Production, protected environment, new retained grants or authorized full release CI.
- Next sensible actions: reconcile actual effective retained role/Company/Project evidence with source and approved role matrix **without fabricating user assignments**; complete PUR01/PUR04/PUR07/PUR12 M4 actual distinct functional acceptance, resolve the 59 operational/role dispositions and Owner-gated scope, then single consolidated DEC-022 review and Owner-specific final release CI authorization. Do not repeat passed #45181742276, #45147124712 or #45176454339.

## 23 Nov 2026 forecast audit — corrected presentation (NO estimate rebaseline)

**Issue found:** an earlier Owner-facing graphic filled a green progress bar to each **future cumulative planned hour** (e.g. `1900 / 1900` with `0h remaining at stage exit`). This could be read as **100% actual completion**, which is false. Those are *conditional future milestones*, **not live work completed**. The title "Roadmap after Milestone 5" also misleadingly included M4 / 5/8. Do not repeat either visualization.

**Audited arithmetic, no new estimate evidence:** 60 packages across 12 stages total **1,900 forecast productive engineering hours** in the existing **23 Nov 2026 post-baseline estimate**; (170+120+50+65=405\) hours to finish prototype 8/8, and (300+480+130+120+95+110+110+150=1,495\) **additional hours after prototype 8/8**. **405+1,495=1,900**. Full usable ERP including all 112 requirements and all eight named roles is **NOT** complete at 8/8. The 1,495 hours contain HR/payroll, full Accounting/tax/bank, multi-Project purchasing, real eight-role UAT, security, production hosting/restore, migration/training and cutover.

**No false precision:** 1,900 is an **unvalidated point estimate** allocated by planning judgment, not measured engineering effort and not a guaranteed remaining duration. The existing ledger states an indicative **1,100–3,300 hour range**, with major uncertainty concentrated in Owner-gated HR and Thailand Accounting, open 112-ID role/scope decisions, multi-Project policy and Production readiness. No timesheet or calibrated velocity justifies replacing the 1,900-hour center with a more precise figure; do not silently change its denominator. When business scope, actual effort or revised estimates are available, publish an explicit evidence-backed forecast revision with the delta. Calendar lead time may exceed productive hours because of reviews, approvals, staffing and business UAT.

**Correct live presentation contract (mandatory for future live position):**
1. Lead with **verified accepted packages and actual logged time**, separately: prototype **4/8**, GL **3/10**, M4 checklist **19/32 = 59.375%**, completed post-baseline whole-package budget **0 / 1900 h**, and `actualLoggedHours=null` (**UNKNOWN**). M4 checkpoints are not weighted effort or ERP %.
2. Show **scope allocations**, **NOT green progress bars based on forecast cumulative hours**: prototype remaining plan 405h (21.3% of budget) plus post-prototype full ERP remaining plan 1,495h (78.7%), and the specific stage deltas below.
3. For each future milestone say "**forecast hours required for this stage**" and "**conditional cumulative hours / hours left *if* stage accepted**." Never show `1900/1900 100%` or `0h left` without prominently identifying it as a **hypothetical end state**. A current completed-progress bar may be drawn only from evidence-backed acceptance.
4. Explicitly mark baseline remaining forecast **1,900h as-of 23 Nov 2026 estimate, not re-estimated for partially completed packages**. Do not subtract unlogged wall time or grant 22h merely because M4-03 reached 75% technical checkpoints.
5. Do not use a single "Full usable ERP H0406–H1900" segment with cumulative `1900 / 1900` as though it were an independent 1,900h **after** 8/8. Correct **incremental post-prototype segment** is **H0406–H1900 = 1,495h**, the **total including M4–M8** is 1,900h.

| Work scope | Incremental remaining-work estimate | Conditional running total if all preceding scope completed |
|---|---:|---:|
| M4 / 5/8 | 170h | 170h |
| M6 / 6/8 | 120h | 290h |
| M7 / 7/8 | 50h | 340h |
| M8 / 8/8 | 65h | 405h |
| **Subtotal to prototype 8/8** | **405h** | **405h, leaving another 1,495h** |
| GL-05 full HR/OT/leave/payroll | 300h | 705h |
| GL-06 Accounting/GL/tax/banking | 480h | 1,185h |
| #245 cross-Project purchasing and budgets | 130h | 1,315h |
| GL-04 all eight real role acceptance | 120h | 1,435h |
| GL-07 production security | 95h | 1,530h |
| GL-08 hosting, encrypted backup and restore | 110h | 1,640h |
| GL-09 master data migration, user onboarding | 110h | 1,750h |
| GL-10 final UAT, cutover and stable use | 150h | 1,900h |
| **Subtotal AFTER prototype 8/8** | **1,495h** | **Conditional full ERP 1,900h overall** |

**Scope overlap risks requiring subsequent estimate calibration (NOT proven double-counting):** `ROLE-03` (GL-04 cross-module UAT, 35h) vs `LAUNCH-02` (GL-10 final human UAT, 45h) must clearly distinguish pre-release business qualification from post-migration production-like acceptance; `ROLE-01` (35h preproduction retained grants) vs `DATA-03` (20h actual Production user provisioning) must document differing environments; `M7` prototype restore vs `INF-04` production-like restore (25h) must use distinct target/evidence; and M8 security review vs GL-07 security signoff must not replay exact reviewed work without changed risk. The allocations currently describe separate phases, but these assumptions are **not independently validated**. Until actual acceptance contracts and observed effort confirm separation, do not claim the center estimate is accurate to the hour. Do not silently delete these budgets either; reduce them only when verifiable evidence shows an overlap, and rebaseline visibly.

**Reliability note:** the 1,100–3,300h range is an illustrative scenario interval rather than a statistically calibrated confidence interval. Only scope approval and actual measured work can validate the eventual engineering effort; the planning budget is not an ERP completion percentage or a promise of a specific date. **No GitHub Actions CI or Production deployment is required to correct this forecast display.**

## ERP 1,900-hour completion counter and countdown

**Current evidence-backed position: `0 / 1900` planned hours retired · `1,900h left`.** This is the net remaining-work budget anchored 23 Nov 2026. The actual work-effort timesheet is UNKNOWN, and the 20/32 M4 technical checkpoints are a different metric. **Do not subtract calendar time, CI runtime, commits, or partial checkpoint progress.** Only a fully accepted forecast work package changes the completed numerator and decrements the remaining-hour forecast (or an explicit evidence-backed re-estimate changes the baseline).

**Read the hourly countdown:** [H0001–H1900 CSV](ERP-FULL-USE-HOURLY-1900.csv) now has `hour_out_of_1900` shown as **`1 / 1900`, `2 / 1900`, ... `1900 / 1900`** and `planned_hours_left_if_this_hour_completed` shown as **1899, 1898, ... 0**. Each row is a *hypothetical planned position*, not evidence that the hours before it have been completed. The live actual clock above is authoritative.

| Forecast milestone if that position were fully completed | Hour position / 1900 | Planned hours left after that position |
|---|---:|---:|
| Current verified position | **0 / 1900** | **1,900h** |
| First planned hour | 1 / 1900 | 1,899h |
| M4 complete → prototype 5/8 | 170 / 1900 | 1,730h |
| Prototype milestones 8/8 | 405 / 1900 | 1,495h |
| Whole 8-role ERP and GL-10 complete | 1900 / 1900 | 0h |

### Stage-by-stage forecast countdown (NOT actual acceptance)

| Exit milestone | Planned work interval | If all prior planned hours completed | Hours left at that hypothetical exit |
|---|---:|---:|---:|
| M4 / prototype 5/8 | H0001–H0170 | **170 / 1900** | **1,730h** |
| M6 / prototype 6/8 | H0171–H0290 | **290 / 1900** | **1,610h** |
| M7 / prototype 7/8 | H0291–H0340 | **340 / 1900** | **1,560h** |
| M8 / prototype 8/8 | H0341–H0405 | **405 / 1900** | **1,495h** |
| GL-05 / all HR and payroll | H0406–H0705 | **705 / 1900** | **1,195h** |
| GL-06 / full accounting, tax and banking | H0706–H1185 | **1185 / 1900** | **715h** |
| Cross-Project purchasing, budgets and exceptions | H1186–H1315 | **1315 / 1900** | **585h** |
| GL-04 / eight-role operational acceptance | H1316–H1435 | **1435 / 1900** | **465h** |
| GL-07 / production security and governance | H1436–H1530 | **1530 / 1900** | **370h** |
| GL-08 / real production hosting and recovery | H1531–H1640 | **1640 / 1900** | **260h** |
| GL-09 / data migration and business onboarding | H1641–H1750 | **1750 / 1900** | **150h** |
| GL-10 / full acceptance, cutover and stable usage | H1751–H1900 | **1900 / 1900** | **0h** |

**Update rule for every `live position` / `check recommended sequence` / `continue recommended sequence`:** show `verified completed / 1900`, `forecast hours left`, then the active Hxxxx range and M4 checkpoints. Re-read real GitHub evidence before advancing any counter. Update the JSON `tracking.displayCounter` and `tracking.countdownHoursLeft` together with `verifiedRetiredHours` and `openBudgetHours`; revise hourly positions only if a new approved baseline changes the 1,900-hour denominator. No CI or background timer is required for a display-only refresh.

## Latest live checkpoint — 23 Nov 2026, 20:41 SGT: NEW M4-03 real Chromium SUCCESS

- **One actual distinct successful focused run:** [#45176454339](https://github.com/threeswordz/cinder-grind/actions/runs/45176454339), test-only draft [#419](https://github.com/threeswordz/cinder-grind/pull/419) frozen source `2b66f3a292baaf293b65c2f322267d713e6b9805`, workflow-only child `4800827b7af88778d655a7882a00acbc8d31523a`. PostgreSQL **17.11 forward-only migration PASS**, pinned lockfile and exact source guard PASS, Nest API compile PASS, **real authenticated Chromium/React/MUI business journey PASS**. The new isolated script produced all 6 source-derived markers:
  - `M4_03_FM01_FOREMAN_REAL_WEEKLY_READONLY_PASS` — Foreman sees corrected no-work report without Ben acknowledgment button
  - `M4_03_FM01_BEN_REAL_WEEKLY_ACK_PASS` — independent Ben clicked actual weekly acknowledgment, readback `MANAGEMENT_REVIEW_ONLY_NOT_APPROVAL`
  - `M4_03_BEN04_PM_REAL_SIX_CATEGORY_PREPARE_PASS` — Khaimook entered six real MUI category fields and saved appended preparation
  - `M4_03_BEN04_BEN_REAL_INDEPENDENT_SIGN_PASS` — independent Ben browser signature
  - `M4_03_PM16_BEN_NANCY_REAL_SIGNOFF_NO_FINANCE_STOCK_PASS` — Nancy separate browser signature, joint status, no stock/DirectCost side effects, active Project retained
  - `M4_03_ACTUAL_CHROMIUM_NEST_PG17_SCOPED_PASS` — end marker with no unexpected API/JS/external request
- **Previous rejected workflow [#45176310727](https://github.com/threeswordz/cinder-grind/actions/runs/45176310727):** invalid YAML `name` value with a colon; **zero jobs started**, no app tests executed or repeated. Corrected on a **new isolated workflow-only branch**, never retried prior completed suites or full CI.
- **Conservative checkpoint credit:** M4-03 H0043–H0064 now **3/4 = 75%** (previously 1/4). The actual Ben/Nancy signoff UI did pass, but **Company/Project outsider browser denial and retained MKE/TCJ named user grants remain unverified**. Thus the final D checkpoint and package signoff are OPEN. Total M4 **19/32 = 59.375% technical checkpoints**; these are not earned engineering hours, nor accepted release coverage.
- **No release / hour credit:** official prototype **4/8**, GL **3/10**, accepted M4 packages **0/8**, actual forecast counter **0 / 1900**, **1,900h left**. Protected main unchanged `3a441b1f`. No Ready, protected merge, previous Chrome/Mac/CI replay, real retained grants, Human UAT or Production.
- **Next distinct, no-waste action:** evidence-based **Company/Project denial and named-role admission** for this workflow, then consolidating bounded reviewed M4 functional changes (including purchasing and 112 IDs). Do not rerun successful #45176454339 solely to increment a percentage. Final full release CI requires fresh specific Owner #384 authorization.

## New actual Chromium Thai PO PDF evidence — 23 Nov 2026, 19:08 SGT

**Draft [PUR07 #418](https://github.com/threeswordz/cinder-grind/pull/418) progresses from 2/4 to 3/4 technical checkpoints.** The source now recomputes satang-exact totals and VAT, reloads the exact Company/Project-authorized approved PO revision before browser print, escapes Thai/HTML content and waits for fonts. [**Focused real Chrome CDP #45162334613 SUCCESS**](https://github.com/threeswordz/cinder-grind/actions/runs/45162334613), source SHA `9460eaee3dd0ecd897cc027421ac6b0aedcaf0c3`: generated a **1-page A4 PDF (105,124 bytes)** from a synthetic approved Thai PO; `pdftotext` confirmed searchable Thai supplier text and actual totals **฿2,000.00 subtotal, ฿137.90 VAT, ฿2,107.90 grand total**. Web TS PASS. Negative tests reject unsafe filename and unapproved/cancelled PO, and retain UNKNOWN totals for missing commercial inputs.

**Proof boundary:** This is real *Chrome PDF output*, not a Photoshop/static mock; however it does not test the real authenticated React print button click, retained Jai/Ben credentials or visual human-page-layout acceptance. **Backend automated Thai/Unicode PDF is still unsupported and fails closed**; browser Save-as-PDF is only the temporary Thai operator path. Zero external email/LINE messages were transmitted. Initial focused browser attempts [#45160954962](https://github.com/threeswordz/cinder-grind/actions/runs/45160954962), [#45161259406](https://github.com/threeswordz/cinder-grind/actions/runs/45161259406) failed in prerequisite guards; [#45161447424](https://github.com/threeswordz/cinder-grind/actions/runs/45161447424) reached Chrome CLI but produced no file. All are retained failed diagnostics; final green used the established Chrome debugger protocol and **did not replay older passing API/PG/PM02/PUR01/PUR12/full CI or Mac suites**.

**Live counters:** M4-06 H0121–H0135 **IN_PROGRESS 75% (3/4)**, aggregate M4 **17/32 = 53.125%** technical checkpoints, official prototype **4/8**, GL **3/10**; full work-package exits **0/8** and verified forecast hours **`0 / 1900` retired, `1900h left`**. Real effort is unlogged; no milestone/Owner/Production acceptance inferred.

## Previous PUR07 source checkpoint (superseded by actual Chrome proof) — 23 Nov 2026, 18:28 SGT

**Development:** [Draft #418](https://github.com/threeswordz/cinder-grind/pull/418) stacks on [PUR12 draft #417](https://github.com/threeswordz/cinder-grind/pull/417) (never on protected main). New approved-only exact PO PDF download; frozen short-name filename, historical canonical fallback and revision suffix; immutable award-source supplier legal name; THB totals with NULL shown as unknown; **Thai/Unicode text FAILS CLOSED** in backend PDF rather than disappearing. A separate **browser Print → Save as PDF** UI path uses local Thai-font rendering but must still undergo real browser PDF inspection. New forward-only DB schema/trigger + Jai-only explicit self-reported external email/LINE send/ack source-link evidence, no outbound message integration or fake delivery claims. No retained grants, role broadening or Production.

**Source-bound validation:** Initial isolated [#45155536353](https://github.com/threeswordz/cinder-grind/actions/runs/45155536353) successfully deployed PG17 forward-only migration but the API compile failed on a new optional ack-ref nullability bug; that source error was corrected. Second isolated [#45155841629](https://github.com/threeswordz/cinder-grind/actions/runs/45155841629) **overall SUCCESS**: fresh PG17 migrations PASS, Nest API build PASS, React/Web typecheck PASS, **4 NEW tests PASS / 0 FAIL** including actual approved PR→RFQ→PO and Jai reported send/ack, unauthorized actor denial, forged evidence/ack rejection, immutable SQL event, cross-Company denial, valid PDF bytes, safe filename and Unicode fail-closed. Synthetic only; **no external email/LINE sent**, no prior PUR01/PUR12/PM02/browser/Mac replay, no broad CI.

**Current M4-06 PUR07 H0121–H0135 = 50% (2/4 source/technical checkpoints)**; outstanding **full Thai/Unicode automated PDF rendering, visual/browser acceptance, named retained Jai/Ben grants and independent Owner release acceptance**. Overall **M4 = 16/32 = 50% technical checkpoints**, official prototype **4/8**, GL **3/10**, completed *packages* **0/8**. **Real hour countdown remains `0 / 1900`, `1900h left`** because no full work package exit was accepted, not because no effort occurred. The engineering-hours timesheet is unknown; no calendar-time deduction. Next use the existing drafts to finish truly missing M4 browser/role and Unicode PDF exits, consolidate once and obtain independently approved final M4 release CI authority.

## Latest acceptance evidence — PUR12 genuine MKE/TCJ native journey

[New focused run #45150538123](https://github.com/threeswordz/cinder-grind/actions/runs/45150538123) **overall SUCCESS** on exact child of [draft #417](https://github.com/threeswordz/cinder-grind/pull/417) source `f74a2bbb14cb49047edf3510066c3e4a4f024ebe`. Fresh disposable PostgreSQL17.11 migration PASS, API build PASS, only **1/1 new PUR12 real native actor test PASS**. It proved: distinct TCJ T-/MKE K- new PO display; unmodified canonical numbers; frozen supplier short-name identity after master change and approved PO revision; direct SQL identity edit trigger denial; absent short name rejected without advancing PO sequence; cross-Company PO access denied. No previously passing PUR01/PM02, browser, Mac or release suite was rerun. Named retained business actors/Owner UAT and final independent reviewed release remain open.

**M4-07 H0136–H0150 = 75% (3/4); overall M4 = 14/32 = 43.75% technical checkpoints.** This is technical checklist progress, **not forecast-engineering effort completed**. Accepted complete work packages remain **0/8**, official prototype **4/8**, GL **3/10**, and full-use **`0 / 1900` verified hours retired; `1900h left` forecast**. PUR07 approved PO PDF/manual dispatch is the next functional gap. No Production authorization, main merge, role activation, full CI or self-approval.

## Latest bounded source progress — PUR12 / PO document identity, 23 Nov 2026

**New drafted implementation [#417](https://github.com/threeswordz/cinder-grind/pull/417)** on the private PUR01 stacked source (not `main`): separate Customer/Supplier short names, nullable MKE `K-POYYMM-### <short name>` and TCJ `T-POYYMM-### <short name>` display snapshots, historic canonical PO unchanged and original revision snapshot retained. A forward-only trigger rejects direct DML mutation of a saved snapshot. Missing supplier short name blocks new MKE/TCJ PO, not silently replaced by the supplier code. New buyer/company runtime, real retained role grant and final release acceptance **not tested**.

[Scoped first run #45149778502](https://github.com/threeswordz/cinder-grind/actions/runs/45149778502): real disposable PostgreSQL 17.11 forward-only migrations **PASS**, API compile **PASS**, Web typecheck **PASS**, new standalone identity tests **2 PASS / 0 FAIL**. **Entire GitHub workflow FAILURE** occurred *after* those successes in an optional SQL-catalog inspection due `psql` rejecting a Prisma-specific URL query parameter `?schema=`. Do not report a green overall CI result or rerun passing work to fix a cosmetic diagnostics script. Actual PO create/revision/Company negative and DB trigger behavior are still unproved in native actor acceptance.

**M4-07 H0136–H0150 advanced to 50% (2/4 source/technical checkpoints), aggregate M4 = 13/32 = 40.625%.** This is NOT 40.625% of actual effort or an accepted new milestone. **Official prototype 4/8; GL 3/10; full-ERP hours `0 / 1900` retired; countdown still `1900h left`**, accepted work packages 0/8. PUR07 PDF/manual dispatch and other M4 exits remain outstanding. The documentation-only ledger was updated without full CI, Mac/Production or main merge.

## Latest live M4 execution — 23 November 2026, 17:20 SGT

- [M4-02 new test-only Draft #416](https://github.com/threeswordz/cinder-grind/pull/416) source `cdca52702d93eba53ac8ea1f86244a317ebe2a47` has **actual authenticated MUI React + NestJS + disposable PostgreSQL17.11 Chromium proof**. [#45145803345](https://github.com/threeswordz/cinder-grind/actions/runs/45145803345) **browser test step SUCCESS** with markers `M4_PM02_BROWSER_STORE_REVIEW_DENIED_PASS`, `M4_PM02_BROWSER_REAL_MIXED_DECISION_AND_APPROVAL_BYPASS_DENIED_PASS`, `M4_PM02_BROWSER_MAKER_SINGLE_CORRECTION_DRAFT_PASS`, `M4_PM02_REAL_CHROMIUM_REAL_NEST_PG17_SCOPED_PASS`. The optional trailing `echo '` in its one-time workflow had an unmatched quote and the **overall GitHub job concluded FAILURE** *after* the browser test passed. Do not rerun a successful business journey to clean a no-op echo; acknowledge the failed overall status in release assurance.
- Diagnostic and previous browser outcomes retained: first [#45144016186](https://github.com/threeswordz/cinder-grind/actions/runs/45144016186) FAILED missing multiline TextField; second [#45144561229](https://github.com/threeswordz/cinder-grind/actions/runs/45144561229) FAILED waiting for the same reason; [#45145211839](https://github.com/threeswordz/cinder-grind/actions/runs/45145211839) **FAILED** but isolated stale MUI previous-line portal option causing line1 to receive return selection. Source fix waited for menu close, asserted exact line2 selection and corrected DOM behavior; final [#45145803345](https://github.com/threeswordz/cinder-grind/actions/runs/45145803345) test step PASS. No legacy #410 operational browser rerun.
- **M4-02 H0021–H0042 moved from 1/4 (25%) to 2/4 (50%) functional technical checkpoints**; the distinct new PO-submit service negative path and actual MKE/TCJ retained named grants still unproven. **Total M4 12/32 (37.5%)**, but **0/1,900 forecast hours retired**, official prototype **4/8**, GL **3/10**. This is checklist progress, not 37.5% of remaining engineering hours. All PRs Draft, `main` unchanged. No full CI, reviewed main merge or Production.

## Earlier 23-Nov 16:57 SGT — new PUR01 real PG actor outcome, no full-suite rerun

- [Draft PUR01 #415](https://github.com/threeswordz/cinder-grind/pull/415) now `1b06cd9881400af5dcb6046dddb6575da019108d`. Added **one new genuine disposable PostgreSQL integration test** covering THB 2- and 3-distinct-supplier complete-quotation comparisons, partial bids, failed no-reason exception, buyer/delegated non-Management denials, and independent Ben approval.
- [First isolated new-test #45142379680](https://github.com/threeswordz/cinder-grind/actions/runs/45142379680) failed **before test execution** with `TS2322` in its new fixture sequence tuples. Fix `as const` in **test file only**, no application behavior changes. Previous migration and build proof is not counted as native test PASS.
- [Corrected **new-actor #45142678279 PASS**](https://github.com/threeswordz/cinder-grind/actions/runs/45142678279), exact tested source `1b06cd9881400af5dcb6046dddb6575da019108d`, workflow-only child `c619b1e5bc253c02cfea116c483b7075b8ddcf86`: isolated PG17.11 migrations, API build, only `purchase-order.pur01.integration.spec.ts` **1 pass, 0 fail**; changed-path new tests, no previous PM02/PUR04/Web/Chrome/Mac suites replayed.
- **M4-04 now 3/4 (75%) technical checkpoints**, **total M4 11/32 (34.375%)**, but **no package fully accepted**; 0/1,900 forecast-hours retired. User browser and effective retained role grant are still outside synthetic actor test. Official 4/8 M4 and GL 3/10 unchanged. No full release CI or Production authority.

## Earlier actual evidence — 23 November 2026, 16:45 SGT

- Current main unchanged `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`. All feature candidates #412, #413, #415 remain **Draft and unmerged**.
- [#45140450091](https://github.com/threeswordz/cinder-grind/actions/runs/45140450091) **whole job FAILED** at the new PM02 forged-database test fixture. But its PG forward-only migrations, changed API build, Web typecheck and PUR01 pure threshold/comparability tests each passed. Real PostgreSQL correctly rejected the illegal A-award/B-returned-line linkage; test setup wrongly expected to forge it.
- Exact corrected source `b1ba925836a8da850f38f9f2374ee9334eed54c4` repaired the fixture to **assert the DB denial** without disabling triggers. [Scoped follow-up #45140977184](https://github.com/threeswordz/cinder-grind/actions/runs/45140977184) **SUCCESS**: PM02 changed-PG actor test 1 PASS/0 FAIL; newly staged PUR04 PG header/audit test 1 PASS/0 FAIL. It did not replay the previously successful pure tests, Web typecheck, Mac or Chromium.
- **H0001–H0020 M4-01 remains in progress**, with H0065–H0090 M4-04 and H0091–H0120 M4-05 also in progress. **10/32 source/technical checkpoints**, not 10/32 business UAT exits. **0/1,900 forecast-hours retired, 1,900h still budgeted**: no fully accepted package/official milestone closure.
- New PUR01 real **two-/three-supplier, shortfall/Ben independent approval** actor and browser/retained user evidence, plus PUR04 actual revision/role evidence, remain. Do not re-run completed proof, trigger full CI or claim final acceptance.

## Live checkpoint — 23 November 2026, 16:25 SGT

**M4-01 H0001–H0020 = IN_PROGRESS, not accepted (0 of its 20 forecast-hours retired).** [112-ID gate audit](ERP-M4-01-112-EXIT-AUDIT.md) and [machine-readable source matrix](ERP-M4-01-112-ID-GATES.csv) verify the immutable 112 census and distinguish previously passed scoped native/Chromium cases from unresolved role and functional exits. Draft #412's new PO-submit guard and Draft #413 PUR04 commercial fields are **source only, unrun**, unlike the earlier native #45127724396 and operational Chromium #45132932414 already passed. **Official M4 4/8, GL 3/10; 1,900h remaining forecast unchanged.** Do not subtract elapsed wall time, run broad CI or replay successful Mac/browser cases.

## Newly staged source — PUR01 and PUR04, pending focused proof

- **[Draft PR #415](https://github.com/threeswordz/cinder-grind/pull/415)**, exact head `ee3ca3e1932a96cf3c37339bbf55ba68ff14f37f`, stacked on Draft [PUR04 #413](https://github.com/threeswordz/cinder-grind/pull/413). Net-after-discount-plus-freight/charges ex-VAT thresholds, complete THB supplier bid counts, documented special supplier/Ben exception, immutable source audit. New-currency THB capture is forward-looking; historical unknown is never silently repaired.
- **Only newly affected focused PG/API/Web tests** [#45140450091](https://github.com/threeswordz/cinder-grind/actions/runs/45140450091) were initiated to validate these staged changes. **As of this checkpoint no pass is yet credited**. This is not the full CI/old Mac/previous browser suite.
- **H0065–H0090 M4-04** (PUR01) and **H0091–H0120 M4-05** (PUR04) are now **IN_PROGRESS in parallel with M4-01**, 0 forecast hours retired for either. The sequential cursor remains **H0001–H0020**, and 1,900h is still the honest remaining budget.

## M4 progressive work dashboard — Status then Progress (23 Nov 2026; PUR07 Chrome source updated 19:08 SGT)

Owner-visible progress is **an auditable four-checkpoint completion counter for each of eight M4 work packages**, NOT an estimate of engineering effort or proportion of accepted release hours. Values are `completed checkpoints / 4 × 100%`. A checkpoint may document *source staged*, *prior exact scoped proof*, or *bounded evidence mapping*; the table labels these distinctly. All four checkpoints must meet the package's actual acceptance criteria and required review before showing 100%. An identified additional mandatory acceptance gate changes the denominator with a recorded evidence-backed revision. Never silently mark unrun code as tested, or convert these counters to retired forecast hours.

| Work package | Status | Progress | Completed checkpoint evidence | Unfinished checkpoint outcomes |
|---|---|---:|---|---|
| `M4-01` H0001–H0020 — 112-ID reconciliation | IN_PROGRESS | **50% (2/4)** | A: distinct 112/112 census verified; B: bounded prior evidence mapped to IDs | C: close/currently scope all 59 operational dispositions; D: current retained role/Owner policy evidence or explicit future gate |
| `M4-02` H0021–H0042 — PM02 | IN_PROGRESS | **75% (3/4)** | A: prior native A/B→RFQ→PO #45127724396 PASS. B: new PostgreSQL rejected-line award traceability AND **7-case service guard unit** [#45181742276](https://github.com/threeswordz/cinder-grind/actions/runs/45181742276) PASS (9 tests total, no full CI). C: separate genuine React/Chromium Store/Khaimook mixed A/B and maker correction [#45147124712](https://github.com/threeswordz/cinder-grind/actions/runs/45147124712) overall SUCCESS; prior #45145803345 only step PASS then echo FAIL. | D: effective MKE/TCJ named Store/Khaimook/Jai/Ben grants, independent review and Owner acceptance NOT verified; no package exit |
| `M4-03` H0043–H0064 — FM01/BEN04/PM16 UI | IN_PROGRESS | **75% (3/4)** | A: prior bounded native PG/API source PASS [#45103782289](https://github.com/threeswordz/cinder-grind/actions/runs/45103782289); B: real Foreman/Ben weekly Chrome PASS [#45176454339](https://github.com/threeswordz/cinder-grind/actions/runs/45176454339); C: real Khaimook 6-category closeout Chrome PASS in same one-shot | D: real Ben/Nancy signoff Chrome PASS, but Company/Project outsider denial, retained named-role acceptance and final independent review still OPEN; no package exit |
| `M4-04` H0065–H0090 — PUR01 quotation policy | IN_PROGRESS | **75% (3/4)** | A: existing RFQ module; B: decimal threshold and incomplete-basis pure PASS within otherwise failed [#45140450091](https://github.com/threeswordz/cinder-grind/actions/runs/45140450091); C: [real disposable PG #45142678279 PASS](https://github.com/threeswordz/cinder-grind/actions/runs/45142678279) for 2/3 complete suppliers, partial quotation denial, exceptional reason, non-Management/buyer deny and independent Ben allow | D: real React/HTTP PUR01 user journey, retained named Ben/Jai grants and Owner M4 acceptance (not proven by synthetic test) |
| `M4-05` H0091–H0120 — PUR04 PO fields | IN_PROGRESS | **75% (3/4)** | A: forward-only nullable schema authored #413; B: draft API/React and revision source authored; C: real PG17.11 migration/API/Web TS PASS [#45140450091](https://github.com/threeswordz/cinder-grind/actions/runs/45140450091) (other test failed) and native PUR04 header audit PASS [#45140977184](https://github.com/threeswordz/cinder-grind/actions/runs/45140977184) | D: actual revision/Company scope, browser and retained role acceptance plus final review/merge |
| `M4-06` H0121–H0135 — PUR07 PDF/dispatch | IN_PROGRESS | **75% (3/4)** | A: additive PG17/API/Web/3 PDF source tests [#45155841629](https://github.com/threeswordz/cinder-grind/actions/runs/45155841629) PASS; B: real synthetic PG approved PO/Jai reported dispatch+ack/negative tests [#45155841629](https://github.com/threeswordz/cinder-grind/actions/runs/45155841629) PASS; C: [actual one-page Thai Chrome PDF #45162334613](https://github.com/threeswordz/cinder-grind/actions/runs/45162334613) SUCCESS, searchable Thai and exact subtotal/VAT/grand total | D: backend automated Unicode still unsupported, exact authenticated UI print/download, retained named Jai/Ben permissions, independent review and Owner acceptance remain OPEN |
| `M4-07` H0136–H0150 — PUR12 identity | IN_PROGRESS | **75% (3/4)** | A: monthly canonical sequence; B: scoped source + PG17 migration/API/Web compile/2 pure tests [#45149778502](https://github.com/threeswordz/cinder-grind/actions/runs/45149778502) (overall failed in optional psql URL check); C: [new isolated real PG native #45150538123 SUCCESS](https://github.com/threeswordz/cinder-grind/actions/runs/45150538123) for MKE/TCJ PO, revision, no-name, SQL immutability and Company-denial | D: retained named MKE/TCJ grants, final review and Owner acceptance |
| `M4-08` H0151–H0170 — release acceptance | NOT STARTED | **0% (0/4)** | None | A: frozen consolidated exact candidate; B: independent review clean; C: one justified Owner-authorized full release CI; D: guarded integration and explicit M4 acceptance |

**Aggregate M4 checkpoint counter = 20/32 = 62.5%.** This reflects *evidence-backed checklist progress* only; it is **NOT** 62.5% of remaining 170 productive engineering hours and does not imply full ERP completion. Some checked items were completed before the 1,900-hour post-baseline plan and are not new earned-hour credit. In the canonical forecast ledger, **accepted packages: 0/8; post-baseline estimate retired: 0/1,900h; remaining central forecast: 1,900h (M4: 170h); official milestone 4/8, GL3/10**. Revisit each numerator only on new actual source/CI/retained-role proof. Keep previously accepted Chromium run #45132932414 closed; it covers Nancy schedule, PM09 and SS13, **not** M4-02 or M4-03; M4-02 has a **separate newly executed** actual React/HTTP Chromium test step [#45145803345](https://github.com/threeswordz/cinder-grind/actions/runs/45145803345) that passed but its workflow remains overall failed due a final optional shell-echo syntax error.

**Reporting contract:** For every future "live position", "check", or "continue" include `Status` immediately followed by `Progress` as percentages plus `x/y checkpoints`; show 100% only on actual passed complete package exit, and separately disclose accepted forecast hours. Add or retire checkpoints with citations rather than guessing percentages from elapsed time, commits or agent output.

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

Every single forecast hour H0001…H1900 appears as one row in [the hourly CSV](ERP-FULL-USE-HOURLY-1900.csv). **Read each row as `hour_out_of_1900` → conditional `planned_hours_left_if_this_hour_completed`; this is a forward schedule, not a live earned-credit timer.** Rows are **forecast engineering budget slots**, not scheduled clock appointments, proof of completed effort, or a claim that humans work a fixed continuous 1,900h. A package earns 0 hours until its specific acceptance is verified, then its *remaining-work estimate* is retired; optional real time is logged separately. In-progress stage status may show without converting into false hour-credit.

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
