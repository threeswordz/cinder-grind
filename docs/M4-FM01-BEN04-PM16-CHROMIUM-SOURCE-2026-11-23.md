# M4-03 FM01/BEN04/PM16: independent authenticated browser evidence candidate

**Stage:** development source only, draft/non-main. **No test execution or pass is claimed.** This package is stacked on M4 operational UI source #407 exact application SHA 62d2ce23810938784caa66aab6e427e49030d7fe, not a Production release.

## New test-only change

Source: deploy/uat/m4-fm01-closeout-browser-native.mjs

One isolated disposable PostgreSQL 17.11 + NestJS + Vite React/MUI + real Chrome CDP script, adapting the already proven browser harness patterns from #410/#416 without re-running those distinct passed workflows. Strict Linux, GITHUB_ACTIONS=true, M4_NON_PRODUCTION_CONFIRMED=YES, localhost port 5432, **exact database basename erp_m4_fm01_closeout_chromium**. Separate ephemeral document storage. Local-only network Fetch interception; error/failure propagation, genuine HttpOnly session/role/CSRF and no bypassed business APIs. The test never targets a retained database/Mac, shared Warehouse, customer records, or Production.

## Intended actual browser workflow (NOT YET EXECUTED)

1. The original Foreman uses an actual authenticated weekly React panel. Source fixture is created by real NestJS CSRF-protected API on a uniquely configured working calendar: zero-work daily report, original Foreman's no-work explanation, submit and a versioned reason correction. The weekly readback must show the corrected reason while the Foreman **does not** render Ben's acknowledgment control.
2. Ben (separate MANAGEMENT identity) loads the same week and **clicks** actual MUI weekly acknowledgment. The API must return CURRENT / MANAGEMENT_REVIEW_ONLY_NOT_APPROVAL; this is not approval of daily work or direct costs.
3. Khaimook (PROJECT_MANAGER) **fills all six** category-specific evidence references and notes on the actual ProjectCloseoutPanel, and **clicks** the MUI append-only preparation button. The real API must show a six-category PREPARED snapshot.
4. Ben and Nancy separately log in with distinct real sessions and **click** their own current-fingerprint Project closeout sign buttons. The readback must show JOINTLY_APPROVED and two signers, while the Project stays active and stock/DirectCost counts remain untouched.
5. Any real browser API error, JavaScript exception or external-network request must fail the script. Earlier standalone native PG proof #409 already tests maker/checker, stale fingerprint, duplicate and cross-Project/Company refusals; **this new test is not a replay of #409 and does not claim those negatives newly passed**.

## Preparation and honest limits

- No source compile, real Chromium run, PDF capture, retained Ben/Nancy/Khaimook/Foreman grant readback, independent DEC-022 exact-head review or human UAT has yet been performed for this source.
- Independently review the synthetic fixture, MUI label selectors, React event dispatch, Company/Project/role restrictions, network guard, error handling, test-only DB protections and absence of test/mock shortcuts.
- After resolving genuine source issues, run **at most one necessary NEW focused, exact-head** isolated Chrome proof with preflight PG17 migrations, built Nest app, Web TS only if newly affected, and the single M4-03 script. Do not dispatch full ERP CI, Mac operators, previously passed #410/#416 browser suites, FM02/PM02/PUR01/PUR04/PUR07/PUR12 native suites or a new recurring workflow. A failure may warrant a narrowly corrected recheck only for the actual changed failure.
- Progress remains M4-03 **1/4 = 25% technical checkpoints**, aggregate **17/32 = 53.125%**, official prototype **4/8**, GL **3/10**, and accepted post-baseline forecast **0 / 1900 hours retired, 1,900h left** until *actual verified test and release acceptance*. Source creation alone earns no new checkpoint.
- Final M4 whole-package acceptance, named retained identities, independent review, guarded integration and a **fresh Owner-specific authorization for mandatory final release CI** remain controlled by #304, #384 and the canonical #414 live clock. **Do not mark Ready, merge, activate grants or deploy Production**.

## Dependencies / original evidence retained

- #399 FM01 sourced weekly calendar/acknowledgment UI, #402 BEN04/PM16 closeout and #407 combined M4 UI.
- #409 independent native FM01/BEN04 test source (scope and limits preserved).
- #410 successful, separately scoped real Chromium Nancy/PM09/SS13 proof, and #416 real PM02 purchasing browser journey: **neither is repeated**.
- #414 central 1,900-hour roadmap; #411 frozen 112-requirement crosswalk.
