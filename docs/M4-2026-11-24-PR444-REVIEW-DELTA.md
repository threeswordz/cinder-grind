# PR444 exact candidate review delta — PM15 operational work queue

Builder preparation only, not independent DEC-022 review or retained acceptance.

- Protected main `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`.
- Prior [Draft #443](https://github.com/threeswordz/cinder-grind/pull/443) `0143eaf7876f46aff9c81353ae4a0e0656d32622`.
- Current [Draft #444](https://github.com/threeswordz/cinder-grind/pull/444) `463f485c6456f1545cb29108433f8886d56b3a9d`.
- Full compare: 327 commits ahead, 0 behind, 183 paths (146 added, 37 modified). Use previous full inventory and [PR443 delta](M4-2026-11-24-PR443-REVIEW-DELTA.md), reviewing full main-to-current-head diff.
- Initial focused [45406911890](https://github.com/threeswordz/cinder-grind/actions/runs/45406911890) FAILED compilation (Prisma groupBy contextual inference), native test skipped. Corrected group query typing; [45407269180](https://github.com/threeswordz/cinder-grind/actions/runs/45407269180) **OVERALL SUCCESS** verified: fresh PG17.11 migrations, API and React compilation, actual HTTP native test marker `PM15_NATIVE_PORTFOLIO_SCOPE_PR_CORRECTION_TOOLS_AND_REVOCATION_PASS`. Exact CI workflow-only child `45dd99040246568758dbf476ba88d06a8c25667c` verified.

| Path | Blob |
|---|---|
| apps/api/src/inventory/stock-minimum.service.ts | `f6ff589d5a80b5d5899d0ae2ddd4344334dce2ad` |
| apps/api/src/inventory/stock-minimum.controller.ts | `7d4b8dc766d7fe0b404d0137dae5e965d2242116` |
| apps/web/src/inventory/PortfolioWorkQueuePanel.tsx | `fd7afe63b2f740d8d0b6d81418315e7873f95d3b` |
| apps/web/src/inventory/StockMinimumsPanel.tsx | `a1392d158a6640893bd23e904260243dabf15323` |
| apps/api/src/inventory/pm15-portfolio-work-queue.native.integration.spec.ts | `fbac4c69a0e7b7622104b3ef2e3de30c23f01dab` |

PM15 actual source increment: a same-Company authorized active-Project work queue, explicit PROJECT_MANAGER role plus stock view and live session/Employee/permission refresh. Each domain has existing source view capability, unauthorized metrics are null, not zero. Repeatable-read snapshot; 100-project fail-closed cap. Counts only; no financial amounts or actions. Submitted PR, returned lines without a captured correction, correction PR not approved, submitted stock count, tool due today/overdue, submitted WO/claim/certification. Counts are source records, not distinct outstanding obligations; rejected correction records can remain visible. No inferred daily demand, supplier promise, cross-Company or stock/Finance effects. Existing site-level minimum, plan-start and supplier delivery panels remain the drill-down rather than an invented portfolio sum.

Native test intentionally exercises nonzero actual PR and equipment custody facts with HTTP sessions, returned/corrected PR, excluded returned tool, scope, Storekeeper denial, per-capability revocation, Project assignment and session revocation. Stock count/subcontract categories are tested for zero-state readback only; positive source records and retained browser acceptance remain open. No new browser, full CI, retained grants, independent review, merge or Production.
