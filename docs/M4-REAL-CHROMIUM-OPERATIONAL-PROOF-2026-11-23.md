# M4 real Chromium + authenticated NestJS/PG operational UI proof

Status: **SOURCE PREPARED, NOT YET EXECUTED**. Parent of this independent test-only candidate: integrated M4 UI [Draft PR #407](https://github.com/threeswordz/cinder-grind/pull/407) head `62d2ce23810938784caa66aab6e427e49030d7fe`.

## Scope, execution, safety

`deploy/uat/m4-operational-browser-native.mjs` is an isolated **real Linux Chromium headless debugging-pipe** journey through the actual React/MUI operational-exceptions components mounted in a dedicated Vite test entry; API requests are not mocked: Vite proxies same-origin `/api/v1` to real compiled NestJS with AuthGuard/CSRF and PostgreSQL 17.11. Each actor uses a separate real, **HTTP-only** `erp_session` browser cookie set in an isolated Chromium browser context; `GET /auth/me` must confirm identity. This is focused component-navigation with real network, not a proof of the entire application login page/sidebar/dashboard routing.

Guards: requires `GITHUB_ACTIONS=true`, Linux, `M4_NON_PRODUCTION_CONFIRMED=YES`, localhost/127.0.0.1, port 5432 and **exact database name `erp_m4_chromium`**. Fresh migration-only service DB; synthetic Company, 2 Project IDs, 1 site/material/uom, 5 disposable business actors. Runs only on GitHub ephemeral runner. Upload evidence is real PDF bytes through actual scoped Document route, stored only inside an owned temporary OS directory and deleted on exit. **Never points to retained Mac, live Company, UAT personnel, Production, or external targets.** No migrations/schemas/permission grants to application; test fixtures assign fake roles solely within throwaway DB.

## Exact browser journeys

- Store Site: actual authenticated operational UI shows urgent/schedule/SS13 tabs, assigned Project and site choices, but **no Nancy editing control**.
- Nancy: actual `Count schedules` UI uses allowed Project/site lookup, types material category, first due date, 7-day cadence and reason, submits via React/MUI → actual CSRF/PG; independent HTTP read confirms canonical persisted category and cadence.
- Khaimook PM09: actual posted issue selection, source-linked PDF already uploaded/registered/submitted with **real API** fixture; browser displays independent review, sends decision with fingerprint and CSRF and reads canonical CLOSED result. Browser does **not** repeat the prior whole PM09 source test.
- SS13: real source-backed case created through API fixture with Project document and valid UOM. Separate authenticated Chromium contexts for Khaimook (forward to Ben), Ben (severity acknowledgement), Nancy (approval of proposal **not execution**). Canonical DB stock transaction and Direct Cost posting counts remain unchanged.
- Outsider Store Site: assigned only to second Project, must not see the first Project in React options; direct real browser request against forbidden Project API must return 403/404.
- Other actor roles/languages/mobile-size, Client/Cost BOQ, native full daily report, physical receipt/transfer, retained data, full source evidence recovery, full eight-role UAT, complete browser navigation, bench/load, and financial settlement are **not** exercised.

This browser journey is separate from accepted exact-source native API proof [#45101879795](https://github.com/threeswordz/cinder-grind/actions/runs/45101879795) and [#45103782289](https://github.com/threeswordz/cinder-grind/actions/runs/45103782289): **do not rerun either**. One narrow GitHub Actions job may install frozen dependencies, Prisma generate/deploy to fresh disposable service, API build, execute only this one script, and report observed browser evidence. No full CI, no Mac, no Ready/merge, no Production.

On completed browser success: proceed with 112-ID source disposition and actual retained role grants, verify completed browser/native proof gap matrix, freeze final M4 candidate. Owner #384 demands **fresh specific approval** before mandatory full release CI. Owner #288 defers financial BEN02/BEN03 package. DEC-042 human UAT deferred. Official M4 **4/8**, GL **3/10** until governed acceptance.
