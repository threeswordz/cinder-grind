# PR445 exact review delta — portfolio stock and delivery alerts

Builder handoff, not independent DEC-022 review or retained acceptance.

- Protected main `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`.
- Prior [Draft #444](https://github.com/threeswordz/cinder-grind/pull/444) `463f485c6456f1545cb29108433f8886d56b3a9d`.
- Current [Draft #445](https://github.com/threeswordz/cinder-grind/pull/445) `2e2831eea4badeac84d1b59e3f1b0b5e00d37bc5`.
- Full compare: 332 commits ahead, 0 behind, 184 paths (147 added, 37 modified). Review full protected-main diff using earlier complete inventory and [PR444 delta](M4-2026-11-24-PR444-REVIEW-DELTA.md), not only this overlay.
- Initial focused [45409363228](https://github.com/threeswordz/cinder-grind/actions/runs/45409363228) failed compile due to test fixture assuming revise() returns lines. Changed only test to fetch canonical revision line. Corrected [45409659996](https://github.com/threeswordz/cinder-grind/actions/runs/45409659996) **OVERALL SUCCESS**, fresh PG17.11 migrations, API and React compilation, real authenticated HTTP native proof marker `PM15_NATIVE_MULTI_SITE_MINIMA_RESERVATION_PO_REVISION_PARTIAL_FULL_REVERSE_PASS`; exact workflow-only child `473d9cfbb7a570b5897ccec7ca60178adb52312d`.

| Overlay path | Blob |
|---|---|
| apps/api/src/inventory/stock-minimum.service.ts | `4dfa8b6b1147026ed42f92c9b5264435c9ddc197` |
| apps/web/src/inventory/PortfolioWorkQueuePanel.tsx | `cb813403b30e5108c03fb8ee9fd2faddd9ca76e5` |
| apps/api/src/inventory/pm15-portfolio-stock-delivery.native.integration.spec.ts | `becdee98c5e60d6a4e35758a86a151eb085a1be1` |

Existing canonical site stock threshold and supplier-indicator algorithms reused inside existing PM15 repeatable-read transaction. Active sites and comparable minimum policies make coverage visible; stale or inactive active policy is a review count, paused policies are not shortages. Below-minimum counts are site/material/UOM dimensions, not total quantities. Project PO lines counted once independently of site count using latest approved revision, current posted/unreversed GR quantities across revisions, unknown dates, late/due/within-seven and separate required-on-site passed flags. No supplier acknowledgment inferred. No site allocation inferred for open PO lines. No cross-Company, monetary amount, posting, notification or permission change. Existing selected site receipt attribution preserved; portfolio has no selected site. 100 Project and site limits, 500 total policy limit and existing PO/GR caps; 30-second transaction timeout. Fail closed rather than presenting partial totals as zero. Scale/latency beyond new focused fixture not benchmarked.

New test seeds only disposable canonical PR/RFQ/PO/GR, real minimum thresholds, reservation and approval histories; tests two sites, hidden same-Company site, partial original/revised receipts, paused threshold, unknown date, fully received exclusion and reversal, existing Storekeeper denial and no read effects. No repeated broad suite, retained browser or role configuration, full CI, independent review, Ready transition, merge or Production.
