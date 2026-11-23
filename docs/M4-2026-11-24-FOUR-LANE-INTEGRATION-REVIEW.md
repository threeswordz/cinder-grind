# M4 four-lane integrated Draft — exact-source reconciliation (24 November 2026 SGT)

> **NOT RELEASE-ACCEPTED.** This document captures the inspected **pre-manifest application/source SHA** `6b9154be215c44b336ffd548e8d1244d44351b97`. The manifest commit itself adds this documentation file to the final tree and therefore changes HEAD and the full diff count; recompute `main...frozen HEAD` before an independent DEC-022 review. No Production or protected-main operation is authorized here.

## Immutable source and integration ancestry

- Repo: `threeswordz/cinder-grind`.
- Protected `main` at inspection: `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`.
- Original consolidated M4 candidate PR [#425](https://github.com/threeswordz/cinder-grind/pull/425) head `8c60e125b57e1081b552ea8f2de87cdfeddadbf0` remains **Draft, unmerged**.
- Isolated combined branch: `work-m4-four-lane-integrated-draft-20261124` source `6b9154be215c44b336ffd548e8d1244d44351b97`.
- Original branch parents are preserved as **real, non-force, two-parent merge commits**, so there are no flattened synthetic cherry-picks or source overwrites:
  - PUR10 [`work-m4-pur10-cancellation-policy-no-ci-20261123`](https://github.com/threeswordz/cinder-grind/tree/work-m4-pur10-cancellation-policy-no-ci-20261123) source `292f7ea9a53210c1e486d67459e3bb69506deab6`; integration merge `deb648b393f4e381fe73a88c7f0bc5d6a1ddce08`.
  - BOQ [`work-m4-boq-dec054-parallel-20261124`](https://github.com/threeswordz/cinder-grind/tree/work-m4-boq-dec054-parallel-20261124) source `a46029f173bfe088f35c4c79ba41671c64d29436`; merge `e2211ee3a9f2f56ca7c2e997d7e98d6c75fd0b73`.
  - Inventory [`work-m4-inventory-store-parallel-20261124`](https://github.com/threeswordz/cinder-grind/tree/work-m4-inventory-store-parallel-20261124) source `748052747fef279bc7a7dffff3e23ce9de500e2a`; merge `b6ed78d5e02fc320de693a5eccc3d6d1eb2a00bc`.
  - Assurance [`docs-m4-112-role-exit-parallel-20261124`](https://github.com/threeswordz/cinder-grind/tree/docs-m4-112-role-exit-parallel-20261124) source `8cbf225c14d22c5012c0a4a436d20daf1e39e3ea`; merge `38f2553492197415a7a34b3b9e5b899844d02221`.
- All four branches were descendants of original #425 HEAD, **zero behind**, and touched **disjoint relative-to-#425 paths**: 14 PUR10, 2 BOQ, 9 Inventory, 3 Assurance = **28 new/modified files** before the central DEC-054 UAT correction. No new Prisma migration in these four branches.
- Comparison original `main...` combined exact source: **127 changed files**, **170 commits ahead**, **0 behind**. Comparison #425... combined exact source: **28 changed files**, **70 ahead**, **0 behind**. This is a full main-to-source list, **not the narrow PR #425 overlay**.

## Conservative verification classification

1. **PUR10:** Original focused [PostgreSQL 17.11 run #45214476040](https://github.com/threeswordz/cinder-grind/actions/runs/45214476040) **SUCCESS 1/1** for the then-tested approved PO and synthetic Jai→PM→Ben cancel case; original branch subsequently added further concurrency, receipt/Finance, Company/Project and revocation negatives which are **not yet credited as executed** on this integrated source. The direct API/service bypass is blocked in branch code. Retained roles and browser not accepted.
2. **BOQ / DEC-054:** *Only tests and documentation changed* in parallel branch. New Company/Project-swapped CSV and partial-capability negatives **have no passing run yet**. Do not claim a new role policy or implementation. DEC-054 is explicitly **Owner-confirmed 21 November**: narrowly scoped *audited Ben self-approval for Cost BOQ*, Nancy independent Client BOQ approval and Khaimook Quantity Only. This **supersedes** older Ben→Khaimook Cost approval language; central UAT plan was reconciled to the current rule without changing runtime permissions.
3. **Inventory SS14/PM15 partial:** New scoped configurable material/site minimum-threshold and advisory alerts, reservation-adjusted availability, stale-UOM warning, UI and focused contract/service tests. **Test sources not executed** by Builder 3; **14/7 day approved-plan and supplier due/late alerts remain missing**, as do SS02 and SS11 shared-service dependencies and later PM15 wider exceptions. No stock/Finance postings from threshold setup.
4. **Assurance:** 112 immutable IDs fully enumerated in docs matrix, classified conservatively as **32 bounded implemented+evidenced, 11 source implemented proof due, 14 current evidence unresolved, 7 functional/workflow gaps, 6 Owner/mixed-scope splits, 42 deferred** (sum 112); all rows mark formal M4 acceptance NO. Historical 59 active dispositions are a separate task/census lens, *not* 59 missing features. Eight-persona UAT scenarios, exact main-to-original-candidate manifest, and M4-01..08 exits exist. Source manifest from Builder 4 was frozen BEFORE 4-lane combination and **must not be mistaken for the full new diff**.

## New integrated source and native verification receipts (24 Nov 2026)

**Source-sensitive PASS, no full CI**:

| Check | Exact tested SHA | Evidence | Result / boundary |
|---|---|---|---|
| Four-lane combined Prisma + TypeScript + role UI focused | `560f559d9f1a440854923a383bf5657e1e119d9e` | [GitHub Actions #45221614973](https://github.com/threeswordz/cinder-grind/actions/runs/45221614973) | **SUCCESS**: locked install, Prisma generate/validate, workspace TypeScript, role UI, routing and read-only tests; **not** full PR CI |
| Inventory SS14/PM15 new contract + mocked service | `31bd0fa998ac66375a57fddc87b5c2e9892a5fcc` | [GitHub Actions #45221962033](https://github.com/threeswordz/cinder-grind/actions/runs/45221962033) | **9/9 PASS**; run overall **FAILED later** during expanded PUR10 fixture; Inventory results are focused code/mocked service proof, **not actual inventory Postgres, retained-role or browser UAT** |
| Corrected PUR10 GR/AP/concurrent finalization/actor revocation | `639deb555dddf08d71bf5d4b0dd23616d0d3dd02` | [GitHub Actions #45222979381](https://github.com/threeswordz/cinder-grind/actions/runs/45222979381) | **1/1 native PostgreSQL 17.11 PASS**; real disposable approved PO and atomic finalize, GR/AP negative, actor revocation and two racing finalizers |
| BOQ new project-swapped/partial grants HTTP CSV negatives and existing bounded subtests | Same `639deb555dddf08d71bf5d4b0dd23616d0d3dd02` | Same [#45222979381](https://github.com/threeswordz/cinder-grind/actions/runs/45222979381) | **11/11 Nest HTTP subtests PASS**, including the new cross-Project and partial-capability CSV export denial |

**Exact code provenance:** The native PASS run's `639deb55...` branch differs from integration application source `1cbfb0645503b202240caf14e5f9a114cc9ecc26` **only by** `.github/workflows/m4-four-lane-native-final-focused.yml`; all application and test source files are byte-identical. The early full-source focused PASS predates a *test-only* PUR10 fixture correction; the final native run rebuilt the full API after that correction.

**Transparent first attempts:** [#45221962033](https://github.com/threeswordz/cinder-grind/actions/runs/45221962033) FAILED because the PUR10 test attempted to **delete a Goods Receipt** and PostgreSQL correctly enforced immutable GR history. The test was fixed to create separate authentic approved POs for GR and AP negatives, retaining their source history. [#45222560237](https://github.com/threeswordz/cinder-grind/actions/runs/45222560237) FAILED because the new negative-case PO test helper lacked a valid commercial-quote header; the fixture was corrected to use the same approved commercial basis. **Neither failure is evidence of a failed application cancellation business transaction.** The corrected #45222979381 is PASS. No redundant full CI or previously sealed Mac journey was run.

**Acceptance limitation:** These are synthetic, bounded engineering receipts. No retained named MKE/TCJ user or human UAT has passed, the full 14/7 inventory alert scope is incomplete, the one-off integration branch is unmerged, no DEC-022 independent reviewer has approved this final source, and #384's Owner-specific final full CI/merge authority has not been granted. Current 4/8, GL3/10, M4 20/32, accepted packages 0/8, retired hours 0/1900 remain unchanged.

## Exact next gates without wasting Codex

- **Gate A: one focused combined-source TypeScript/Prisma/role UI check** on an immutable integration descendant, with no full PR CI or Mac rerun. Verify result at exact commit.
- **Gate B: new focused disposable PostgreSQL tests** for changed PUR10 contention/GR/AP/actor revocation, BOQ negative HTTP, and Inventory minimum-stock contract/service, not a replay of previously accepted PM02, PUR01, PUR07 or receiving journeys.
- **Gate C: retained MKE/TCJ effective eight-role Company/Project/browser/Thai PDF evidence**, Owner-controlled business exceptions, and site/Store dependencies; no SYS_ADMIN fallback.
- **Gate D: once source/evidence stable, regenerate this exhaustive exact `main...frozen SHA` diff; one independent DEC-022 review with actual full diff; then specific Owner #384 approval for mandatory release CI, guarded Ready/merge and M4 acceptance.** A branch merge into this unprotected staging branch is not protected-main integration or an acceptance signoff.

## Clock (unchanged; no false hour retirement)

Prototype **4/8**; go-live gates **3/10** (GL-01–03); M4 bounded technical **20/32 = 62.5%**; M4 fully accepted packages **0/8**; formal retired forecast hours **0/1,900**, remaining **1,900 net productive engineering hours** to all-eight-role full-use ERP, not solely M4. Actual hours worked not accurately measured. M4 forecast segment H0001–H0170 remains entirely unretired until verified package exits.

## Original main-to-combined-source changed-file inventory

| Path | Status | + | - |
|---|---|---:|---:|
| `apps/api/prisma/migrations/20261123143000_pm02_partial_pr_line_review/migration.sql` | added | 19 | 0 |
| `apps/api/prisma/migrations/20261123163500_pm02_review_trigger_scope/migration.sql` | added | 212 | 0 |
| `apps/api/prisma/migrations/20261123181000_pur04_po_commercial_header/migration.sql` | added | 22 | 0 |
| `apps/api/prisma/migrations/20261123185000_pur01_quote_exception_reason/migration.sql` | added | 4 | 0 |
| `apps/api/prisma/migrations/20261123190000_pur12_po_partner_short_names/migration.sql` | added | 32 | 0 |
| `apps/api/prisma/migrations/20261123201500_pur07_po_manual_dispatch_events/migration.sql` | added | 87 | 0 |
| `apps/api/prisma/schema.prisma` | modified | 57 | 0 |
| `apps/api/src/budget/boq-http.integration.spec.ts` | modified | 31 | 0 |
| `apps/api/src/inventory/M4-STORE-PARALLEL-2026-11-24.md` | added | 38 | 0 |
| `apps/api/src/inventory/inventory.module.ts` | modified | 16 | 0 |
| `apps/api/src/inventory/stock-count-schedule-contract.ts` | added | 129 | 0 |
| `apps/api/src/inventory/stock-count-schedule.controller.ts` | added | 53 | 0 |
| `apps/api/src/inventory/stock-count-schedule.service.ts` | added | 151 | 0 |
| `apps/api/src/inventory/stock-loss-case-contract.ts` | added | 156 | 0 |
| `apps/api/src/inventory/stock-loss-case.controller.ts` | added | 80 | 0 |
| `apps/api/src/inventory/stock-loss-case.service.ts` | added | 248 | 0 |
| `apps/api/src/inventory/stock-minimum-contract.spec.ts` | added | 71 | 0 |
| `apps/api/src/inventory/stock-minimum-contract.ts` | added | 88 | 0 |
| `apps/api/src/inventory/stock-minimum.controller.ts` | added | 77 | 0 |
| `apps/api/src/inventory/stock-minimum.service.spec.ts` | added | 154 | 0 |
| `apps/api/src/inventory/stock-minimum.service.ts` | added | 196 | 0 |
| `apps/api/src/inventory/urgent-material-issue-contract.ts` | added | 155 | 0 |
| `apps/api/src/inventory/urgent-material-issue-documents.controller.ts` | added | 82 | 0 |
| `apps/api/src/inventory/urgent-material-issue-documents.service.ts` | added | 223 | 0 |
| `apps/api/src/master-data/master-data.controller.ts` | modified | 12 | 0 |
| `apps/api/src/master-data/master-data.service.ts` | modified | 10 | 0 |
| `apps/api/src/procurement/procurement.controller.ts` | modified | 55 | 0 |
| `apps/api/src/procurement/procurement.module.ts` | modified | 5 | 2 |
| `apps/api/src/procurement/procurement.pm02.integration.spec.ts` | added | 508 | 0 |
| `apps/api/src/procurement/procurement.service.ts` | modified | 244 | 6 |
| `apps/api/src/procurement/purchase-order-cancellation-case.controller.ts` | added | 92 | 0 |
| `apps/api/src/procurement/purchase-order-cancellation-case.service.ts` | added | 418 | 0 |
| `apps/api/src/procurement/purchase-order-cancellation-contract.test.mjs` | added | 49 | 0 |
| `apps/api/src/procurement/purchase-order-cancellation-contract.ts` | added | 183 | 0 |
| `apps/api/src/procurement/purchase-order-identity.spec.ts` | added | 37 | 0 |
| `apps/api/src/procurement/purchase-order-identity.ts` | added | 34 | 0 |
| `apps/api/src/procurement/purchase-order-pdf.spec.ts` | added | 53 | 0 |
| `apps/api/src/procurement/purchase-order-pdf.ts` | added | 179 | 0 |
| `apps/api/src/procurement/purchase-order-pur07.service.ts` | added | 275 | 0 |
| `apps/api/src/procurement/purchase-order-quote-policy.spec.ts` | added | 33 | 0 |
| `apps/api/src/procurement/purchase-order-quote-policy.ts` | added | 51 | 0 |
| `apps/api/src/procurement/purchase-order-unicode-pdf.spec.ts` | added | 137 | 0 |
| `apps/api/src/procurement/purchase-order-unicode-pdf.ts` | added | 284 | 0 |
| `apps/api/src/procurement/purchase-order.controller.ts` | modified | 114 | 11 |
| `apps/api/src/procurement/purchase-order.integration.spec.ts` | modified | 24 | 13 |
| `apps/api/src/procurement/purchase-order.pm02-source-guard.spec.ts` | added | 99 | 0 |
| `apps/api/src/procurement/purchase-order.pur01.integration.spec.ts` | added | 278 | 0 |
| `apps/api/src/procurement/purchase-order.pur04-revision.integration.spec.ts` | added | 338 | 0 |
| `apps/api/src/procurement/purchase-order.pur04.integration.spec.ts` | added | 146 | 0 |
| `apps/api/src/procurement/purchase-order.pur07.integration.spec.ts` | added | 223 | 0 |
| `apps/api/src/procurement/purchase-order.pur10-finalization.integration.spec.ts` | added | 515 | 0 |
| `apps/api/src/procurement/purchase-order.pur12.integration.spec.ts` | added | 236 | 0 |
| `apps/api/src/procurement/purchase-order.service.ts` | modified | 404 | 15 |
| `apps/api/src/procurement/sourcing.service.ts` | modified | 8 | 0 |
| `apps/api/src/projects/project-closeout-contract.ts` | added | 232 | 0 |
| `apps/api/src/projects/project-closeout.service.ts` | added | 184 | 0 |
| `apps/api/src/projects/projects.controller.ts` | modified | 56 | 1 |
| `apps/api/src/projects/projects.module.ts` | modified | 2 | 1 |
| `apps/api/src/site-execution/site-execution.controller.ts` | modified | 58 | 0 |
| `apps/api/src/site-execution/site-execution.service.ts` | modified | 334 | 8 |
| `apps/api/src/site-execution/site-weekly-operational.ts` | added | 222 | 0 |
| `apps/api/src/site-execution/site-weekly-summary.spec.ts` | modified | 1 | 0 |
| `apps/api/src/site-execution/site-weekly-summary.ts` | modified | 2 | 0 |
| `apps/api/src/site-execution/site-weekly-workday.ts` | added | 138 | 0 |
| `apps/web/src/AdminConsole.tsx` | modified | 3 | 0 |
| `apps/web/src/api/inventory.ts` | modified | 1 | 0 |
| `apps/web/src/api/operational-exceptions.ts` | added | 141 | 0 |
| `apps/web/src/api/po-cancellation.ts` | added | 62 | 0 |
| `apps/web/src/api/procurement.ts` | modified | 29 | 0 |
| `apps/web/src/api/projects.ts` | modified | 45 | 0 |
| `apps/web/src/api/purchase-orders.ts` | modified | 62 | 1 |
| `apps/web/src/api/site-execution.ts` | modified | 79 | 0 |
| `apps/web/src/inventory/InventoryWorkspace.tsx` | modified | 26 | 3 |
| `apps/web/src/inventory/OperationalExceptionsPanel.tsx` | added | 48 | 0 |
| `apps/web/src/inventory/StockCountSchedulesPanel.tsx` | added | 208 | 0 |
| `apps/web/src/inventory/StockLossCasesPanel.tsx` | added | 334 | 0 |
| `apps/web/src/inventory/StockMinimumsPanel.tsx` | added | 196 | 0 |
| `apps/web/src/inventory/UrgentIssueDocumentsPanel.tsx` | added | 224 | 0 |
| `apps/web/src/master-data/StandardMasters.tsx` | modified | 2 | 0 |
| `apps/web/src/procurement/PurchaseOrderCancellationPanel.tsx` | added | 213 | 0 |
| `apps/web/src/procurement/PurchaseOrdersPanel.tsx` | modified | 291 | 35 |
| `apps/web/src/procurement/PurchaseRequestsPanel.tsx` | modified | 189 | 14 |
| `apps/web/src/procurement/purchase-order-print.ts` | added | 137 | 0 |
| `apps/web/src/projects/ProjectCloseoutPanel.tsx` | added | 267 | 0 |
| `apps/web/src/projects/ProjectsPanel.tsx` | modified | 8 | 0 |
| `apps/web/src/site-execution/SiteExecutionPanel.tsx` | modified | 70 | 0 |
| `apps/web/src/site-execution/WeeklySiteSummaryPanel.tsx` | modified | 98 | 9 |
| `deploy/release-candidate/ben04-closeout-contract.test.mjs` | added | 210 | 0 |
| `deploy/release-candidate/fm01-operational-focused.test.mjs` | added | 167 | 0 |
| `deploy/release-candidate/fm01-workday-preview.test.mjs` | added | 87 | 0 |
| `deploy/release-candidate/nancy07-stock-count-schedule-focused.test.mjs` | added | 85 | 0 |
| `deploy/release-candidate/pm09-urgent-documents-focused.test.mjs` | added | 98 | 0 |
| `deploy/release-candidate/ss13-loss-damage-focused.test.mjs` | added | 140 | 0 |
| `deploy/uat/m4-fm01-closeout-browser-native.mjs` | added | 364 | 0 |
| `deploy/uat/m4-operational-browser-native.mjs` | added | 526 | 0 |
| `deploy/uat/m4-pm02-purchasing-browser-native.mjs` | added | 407 | 0 |
| `deploy/uat/m4-pur01-browser-native.mjs` | added | 467 | 0 |
| `deploy/uat/m4-pur07-jai-ben-server-download-browser-native.mjs` | added | 448 | 0 |
| `deploy/uat/pur07-thai-approved-po-print-browser.mjs` | added | 171 | 0 |
| `docs/BOQ-M4-PARALLEL-DEC054-2026-11-24.md` | added | 45 | 0 |
| `docs/ERP-FULL-USE-HOURLY-1900.csv` | added | 1901 | 0 |
| `docs/ERP-FULL-USE-LIVE-CLOCK.md` | added | 330 | 0 |
| `docs/ERP-FULL-USE-WORKPACKAGES.json` | added | 1275 | 0 |
| `docs/M4-112-REQUIREMENTS-EVIDENCE-CROSSWALK-2026-11-23.md` | added | 283 | 0 |
| `docs/M4-2026-11-24-112-DISPOSITION.csv` | added | 0 | 0 |
| `docs/M4-2026-11-24-EIGHT-ROLE-UAT-AND-EXIT.md` | added | 0 | 0 |
| `docs/M4-2026-11-24-MAIN-TO-CANDIDATE-DIFF.md` | added | 0 | 0 |
| `docs/M4-CONSOLIDATED-REVIEW-MANIFEST-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-FM01-BEN04-PM16-CHROMIUM-SOURCE-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-OPERATIONAL-EXCEPTIONS-UI-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-PM02-PARTIAL-PR-LINES-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-PRIVATE-SOURCE-INTEGRATION-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-PUR01-QUOTE-THRESHOLD-SOURCE-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-PUR01-REAL-BROWSER-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-PUR04-APPROVED-REVISION-SCOPE-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-PUR04-PO-COMMERCIAL-HEADER-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-PUR07-APPROVED-PO-PDF-DISPATCH-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-PUR07-REAL-UNICODE-DOWNLOAD-UI-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-PUR07-UNICODE-SERVER-RENDERER-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-PUR10-CANCELLATION-INTEGRATION-GATES-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-PUR12-NEW-PO-COMPANY-DISPLAY-IDENTITY-2026-11-23.md` | added | 0 | 0 |
| `docs/M4-REAL-CHROMIUM-OPERATIONAL-PROOF-2026-11-23.md` | added | 0 | 0 |
| `docs/OP-PROJECT-CLOSEOUT-01-BEN04-PM16.md` | added | 0 | 0 |
| `docs/OP-SITE-REPORT-01-FM01B-CALENDAR-PREVIEW.md` | added | 0 | 0 |
| `docs/OP-STOCK-COUNT-SCHEDULE-NANCY07.md` | added | 0 | 0 |
| `docs/OP-STOCK-LOSS-CASE-SS13.md` | added | 0 | 0 |
| `docs/OP-URGENT-ISSUE-DOCUMENTS-01-PM09.md` | added | 0 | 0 |

## Additional SS14/PM15 approved-plan 14/7-day start reminders — 24 Nov 2026

- New isolated worker source `work-m4-ss14-approved-plan-14-7-readonly-20261124` HEAD `a8f23c1c87bc56ccc8bb2c855852a0d2a2fc4258`, based on this integration PR #427's former HEAD `da16faf77768d8d3d531c0fd1c8cb9a03071d4e7`.
- Incorporated into PR #427 by **non-force, two-parent development-only merge** `1632dc3f48aaa02191d005d279636c73aed4892c`. GitHub comparison of this merge against the source branch shows **zero changed files**, proving exact application/test content preserved by integration.
- [Focused source/test #45226701089](https://github.com/threeswordz/cinder-grind/actions/runs/45226701089) **COMPLETED SUCCESS**, exact runner HEAD `89444ab5f49d608bf754a8ee3a4cebc2fa1e27c9`; runner source differs from implemented branch HEAD **only** by the one-off focused workflow. Prisma generate/validate, full workspace TS typecheck, API build and **8/8 new SS14 tests PASS**, 0 fail; no previous 9/9 Inventory tests rerun. No full PR CI or real-browser/retained-role acceptance.
- The added GET `/inventory/stock-minimums/projects/:projectId/sites/:warehouseId/plan-starts` and Store/PM UI report scoped **latest approved material-usage-plan start dates** at 14/7/0-day Thai-calendar boundaries, with source-entered planned quantities. Current DB user/role/session, Company/Project/site checks, malformed plan source and over-limit handling fail closed. No stock, GR, AP, Finance, external notifications or purchase writes.
- **Critical scope limitation:** `validFrom` is a plan period's starting date, **not** supplier delivery, exact day-by-day material requirement, actual shortage, or physically received stock. SS14/PM15 full material-demand and supplier overdue alerts remain OPEN. SS02 material-master request and SS11 CG##### borrower/tool-loan flow remain OPEN.
- After this merge, GitHub exact `main` comparison **132 changed files / 183 ancestry commits**; from original #425 head **33 changed files / 83 commits**. These counts were taken **before this evidence-only manifest update**, so regenerate the final frozen full diff for independent DEC-022 review. Protected main unchanged `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`; PR #427 stays Draft/unmerged and no new Actions triggered by its development merge.
- **No formal hour/checkpoint promotion:** prototype 4/8, GL3/10, M4 technical published 20/32, M4 accepted packages 0/8, hours formally retired 0/1900. Last published provisional remaining-work estimate 1847h incl 117h to 5/8 remains un-reforecasted after this specific increment; worker timesheets remain UNKNOWN.
