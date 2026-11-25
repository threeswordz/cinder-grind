# M4 exact 190-file source candidate — independent review handoff

**Not a validation PASS or release authorization.** Current source-only successor `a0ce9bf6307a561e6e56e5f6e68bbc2922eca679`, branch `work-m4-ss11-thailand-custody-calendar-20261125`. Compared against protected main `040395bc7b0dedd40207f91f743bc2efc1584622`: **63 commits ahead, zero behind, 190 changed paths**, including eight forward migrations. Every path is listed exactly once below.

Previous [188-file evidence inventory](M4-2026-11-25-CLOSURE-CANDIDATE-188-PATH-REVIEW.md) is historical and superseded for the current source tree. PR #452 at `4aab761d8477cfb63ea978af1444865b720d42d5` still has independent review pending despite full CI `45524967848` attempt 2 PASS 46/46. Do not merge or deploy from this assembly.

## Exact change lineage and outstanding proof

| Layer | Exact SHA | Claim |
|---|---|---|
| Protected main | `040395bc7b0dedd40207f91f743bc2efc1584622` | Unchanged |
| Consolidated four-lane source | `138ea662094dc50556b1389f0c8144298b9bfcb4` | Source blobs only; four push-workflow results unknown |
| Operational browser readiness | `33f301ad9967c3b94cda8b3a12542be5855a1c9c` | Test source not runtime PASS |
| 112 immutable evidence + six approved Owner M4 boundaries | `86e376af957788de15f1a7e315428cdd0d0299b2` | Source/overlay alignment only, formal acceptance NO |
| Supplier-report vs PO-revision regression | `23e83b600ac7d2d2ae0c93c2d374b55571a32a9a` | Actual PG race test source; focused workflow result unverified |
| SS11 Thailand date source + frontend correction | `a0ce9bf6307a561e6e56e5f6e68bbc2922eca679` | Changed four paths; local standalone equivalent six-case boundary check passed, compiled API/web CI unverified |
| SS11 exact-source focused workflow-only child | `98a888d460680a421fafd15eea11c9ffc9dc9d0b` | Result unverified; no full CI |
| PUR08 exact-source focused workflow-only child | `e8af9392db825dd16d97bed2411f6a6fc129b88f` | Result unverified; no full CI |

**SS11 corrected defect:** checkout/return previously compared date-only fields to UTC day, rejecting valid Thai next-day transactions during Bangkok 00:00–06:59. The new API reuses existing reviewed Asia/Bangkok business date; React browser defaults use the same timezone rather than device locale. Standalone Node v22 source-equivalent calendar and UI-format tests passed six UTC/Bangkok/Singapore/leap-day examples plus invalid date; these are NOT the compiled backend test, retained-user UAT or a runtime PASS. Proposed regression `apps/api/src/equipment/equipment-custody-date.spec.ts` remains to execute in exact-source CI.

## Preserved requirements and release gates

Original **112 requirements** exactly preserved, with 70 current-M4 evidence actions and 42 deferred future, six Owner-approved bounded operational slices (not waiver/acceptance), all eight actual actor workflows needing retained UAT, Company/Project denials, previous populated Mac recovery, independent DEC-022 review and explicit Owner release decision. No retained grants, new accounting or stock postings.

## Changed-file inventory (source comparison)

### CI (1)

| Git status | Path | Added | Deleted |
|---|---|---:|---:|
| modified | `.github/workflows/validate.yml` | 16 | 10 |

### Migrations (8)

| Git status | Path | Added | Deleted |
|---|---|---:|---:|
| added | `apps/api/prisma/migrations/20261123143000_pm02_partial_pr_line_review/migration.sql` | 19 | 0 |
| added | `apps/api/prisma/migrations/20261123163500_pm02_review_trigger_scope/migration.sql` | 212 | 0 |
| added | `apps/api/prisma/migrations/20261123181000_pur04_po_commercial_header/migration.sql` | 22 | 0 |
| added | `apps/api/prisma/migrations/20261123185000_pur01_quote_exception_reason/migration.sql` | 4 | 0 |
| added | `apps/api/prisma/migrations/20261123190000_pur12_po_partner_short_names/migration.sql` | 32 | 0 |
| added | `apps/api/prisma/migrations/20261123201500_pur07_po_manual_dispatch_events/migration.sql` | 87 | 0 |
| added | `apps/api/prisma/migrations/20261124023000_ss11_equipment_custody/migration.sql` | 133 | 0 |
| added | `apps/api/prisma/migrations/20261124221500_jai_asset_register/migration.sql` | 56 | 0 |

### API (92)

| Git status | Path | Added | Deleted |
|---|---|---:|---:|
| modified | `apps/api/prisma/schema.prisma` | 57 | 0 |
| added | `apps/api/src/equipment/equipment-asset-register.controller.ts` | 26 | 0 |
| added | `apps/api/src/equipment/equipment-asset-register.native.integration.spec.ts` | 135 | 0 |
| added | `apps/api/src/equipment/equipment-asset-register.service.ts` | 149 | 0 |
| added | `apps/api/src/equipment/equipment-custody-date.spec.ts` | 28 | 0 |
| added | `apps/api/src/equipment/equipment-custody-date.ts` | 9 | 0 |
| added | `apps/api/src/equipment/equipment-custody.controller.ts` | 71 | 0 |
| added | `apps/api/src/equipment/equipment-custody.integration.spec.ts` | 118 | 0 |
| added | `apps/api/src/equipment/equipment-custody.service.ts` | 198 | 0 |
| modified | `apps/api/src/equipment/equipment.module.ts` | 6 | 2 |
| added | `apps/api/src/inventory/approved-plan-start-reminder.spec.ts` | 40 | 0 |
| added | `apps/api/src/inventory/approved-plan-start-reminder.ts` | 50 | 0 |
| modified | `apps/api/src/inventory/inventory.module.ts` | 20 | 0 |
| added | `apps/api/src/inventory/material-code-request-contract.spec.ts` | 89 | 0 |
| added | `apps/api/src/inventory/material-code-request-contract.ts` | 135 | 0 |
| added | `apps/api/src/inventory/material-code-request.controller.ts` | 51 | 0 |
| added | `apps/api/src/inventory/material-code-request.native.integration.spec.ts` | 231 | 0 |
| added | `apps/api/src/inventory/material-code-request.service.spec.ts` | 198 | 0 |
| added | `apps/api/src/inventory/material-code-request.service.ts` | 213 | 0 |
| added | `apps/api/src/inventory/pm15-portfolio-pending.native.integration.spec.ts` | 108 | 0 |
| added | `apps/api/src/inventory/pm15-portfolio-stock-delivery.native.integration.spec.ts` | 132 | 0 |
| added | `apps/api/src/inventory/pm15-portfolio-work-queue.native.integration.spec.ts` | 159 | 0 |
| modified | `apps/api/src/inventory/receiving-test-fixture.ts` | 6 | 0 |
| added | `apps/api/src/inventory/stock-count-schedule-contract.ts` | 129 | 0 |
| added | `apps/api/src/inventory/stock-count-schedule.controller.ts` | 53 | 0 |
| added | `apps/api/src/inventory/stock-count-schedule.service.ts` | 151 | 0 |
| added | `apps/api/src/inventory/stock-loss-case-contract.ts` | 156 | 0 |
| added | `apps/api/src/inventory/stock-loss-case.controller.ts` | 80 | 0 |
| added | `apps/api/src/inventory/stock-loss-case.service.ts` | 248 | 0 |
| added | `apps/api/src/inventory/stock-minimum-contract.spec.ts` | 71 | 0 |
| added | `apps/api/src/inventory/stock-minimum-contract.ts` | 88 | 0 |
| added | `apps/api/src/inventory/stock-minimum.controller.ts` | 110 | 0 |
| added | `apps/api/src/inventory/stock-minimum.plan-start.spec.ts` | 133 | 0 |
| added | `apps/api/src/inventory/stock-minimum.service.spec.ts` | 154 | 0 |
| added | `apps/api/src/inventory/stock-minimum.service.ts` | 660 | 0 |
| added | `apps/api/src/inventory/stock-minimum.supplier-indicators.spec.ts` | 205 | 0 |
| added | `apps/api/src/inventory/supplier-commitment-indicator.spec.ts` | 96 | 0 |
| added | `apps/api/src/inventory/supplier-commitment-indicator.ts` | 75 | 0 |
| added | `apps/api/src/inventory/urgent-material-issue-contract.ts` | 155 | 0 |
| added | `apps/api/src/inventory/urgent-material-issue-documents.controller.ts` | 82 | 0 |
| added | `apps/api/src/inventory/urgent-material-issue-documents.service.ts` | 223 | 0 |
| modified | `apps/api/src/master-data/master-data.controller.ts` | 12 | 0 |
| modified | `apps/api/src/master-data/master-data.service.ts` | 10 | 0 |
| modified | `apps/api/src/procurement/procurement.controller.ts` | 55 | 0 |
| modified | `apps/api/src/procurement/procurement.module.ts` | 7 | 2 |
| added | `apps/api/src/procurement/procurement.pm02.integration.spec.ts` | 551 | 0 |
| modified | `apps/api/src/procurement/procurement.service.ts` | 244 | 6 |
| added | `apps/api/src/procurement/purchase-order-cancellation-case.controller.ts` | 92 | 0 |
| added | `apps/api/src/procurement/purchase-order-cancellation-case.service.ts` | 434 | 0 |
| added | `apps/api/src/procurement/purchase-order-cancellation-contract.test.mjs` | 49 | 0 |
| added | `apps/api/src/procurement/purchase-order-cancellation-contract.ts` | 183 | 0 |
| added | `apps/api/src/procurement/purchase-order-identity.spec.ts` | 37 | 0 |
| added | `apps/api/src/procurement/purchase-order-identity.ts` | 34 | 0 |
| added | `apps/api/src/procurement/purchase-order-pdf.spec.ts` | 53 | 0 |
| added | `apps/api/src/procurement/purchase-order-pdf.ts` | 179 | 0 |
| added | `apps/api/src/procurement/purchase-order-pur07-document-link.spec.ts` | 49 | 0 |
| added | `apps/api/src/procurement/purchase-order-pur07-source-approval.spec.ts` | 40 | 0 |
| added | `apps/api/src/procurement/purchase-order-pur07.service.ts` | 292 | 0 |
| added | `apps/api/src/procurement/purchase-order-quote-policy.spec.ts` | 33 | 0 |
| added | `apps/api/src/procurement/purchase-order-quote-policy.ts` | 51 | 0 |
| added | `apps/api/src/procurement/purchase-order-unicode-pdf.spec.ts` | 137 | 0 |
| added | `apps/api/src/procurement/purchase-order-unicode-pdf.ts` | 284 | 0 |
| modified | `apps/api/src/procurement/purchase-order.controller.ts` | 114 | 11 |
| modified | `apps/api/src/procurement/purchase-order.integration.spec.ts` | 24 | 13 |
| added | `apps/api/src/procurement/purchase-order.pm02-source-guard.spec.ts` | 180 | 0 |
| added | `apps/api/src/procurement/purchase-order.pur01.integration.spec.ts` | 300 | 0 |
| added | `apps/api/src/procurement/purchase-order.pur04-revision.integration.spec.ts` | 339 | 0 |
| added | `apps/api/src/procurement/purchase-order.pur04.integration.spec.ts` | 146 | 0 |
| added | `apps/api/src/procurement/purchase-order.pur07.integration.spec.ts` | 229 | 0 |
| added | `apps/api/src/procurement/purchase-order.pur10-finalization.integration.spec.ts` | 824 | 0 |
| added | `apps/api/src/procurement/purchase-order.pur12.integration.spec.ts` | 269 | 0 |
| modified | `apps/api/src/procurement/purchase-order.service.ts` | 464 | 50 |
| modified | `apps/api/src/procurement/sourcing.service.ts` | 8 | 0 |
| added | `apps/api/src/procurement/supplier-delivery-case.controller.ts` | 124 | 0 |
| added | `apps/api/src/procurement/supplier-delivery-case.native.integration.spec.ts` | 248 | 0 |
| added | `apps/api/src/procurement/supplier-delivery-case.service.ts` | 609 | 0 |
| added | `apps/api/src/procurement/supplier-delivery-lifecycle.test.mjs` | 90 | 0 |
| added | `apps/api/src/procurement/supplier-delivery-lifecycle.ts` | 202 | 0 |
| added | `apps/api/src/procurement/supplier-replacement-posted.native.integration.spec.ts` | 333 | 0 |
| added | `apps/api/src/procurement/supplier-replacement-proof.test.mjs` | 55 | 0 |
| added | `apps/api/src/procurement/supplier-replacement-proof.ts` | 84 | 0 |
| added | `apps/api/src/procurement/supplier-return-custody-proof.test.mjs` | 64 | 0 |
| added | `apps/api/src/procurement/supplier-return-custody-proof.ts` | 89 | 0 |
| added | `apps/api/src/procurement/supplier-return-custody.native.integration.spec.ts` | 193 | 0 |
| modified | `apps/api/src/projects/project-closeout-stale.native.integration.spec.ts` | 35 | 0 |
| modified | `apps/api/src/projects/project-closeout.service.ts` | 19 | 4 |
| modified | `apps/api/src/site-execution/site-execution.controller.ts` | 58 | 0 |
| modified | `apps/api/src/site-execution/site-execution.service.ts` | 358 | 8 |
| added | `apps/api/src/site-execution/site-weekly-operational.ts` | 222 | 0 |
| modified | `apps/api/src/site-execution/site-weekly-summary.spec.ts` | 1 | 0 |
| modified | `apps/api/src/site-execution/site-weekly-summary.ts` | 2 | 0 |
| added | `apps/api/src/site-execution/site-weekly-workday.ts` | 138 | 0 |

### Web (29)

| Git status | Path | Added | Deleted |
|---|---|---:|---:|
| modified | `apps/web/src/AdminConsole.tsx` | 4 | 2 |
| modified | `apps/web/src/api/equipment.ts` | 21 | 0 |
| modified | `apps/web/src/api/inventory.ts` | 1 | 0 |
| added | `apps/web/src/api/operational-exceptions.ts` | 141 | 0 |
| added | `apps/web/src/api/po-cancellation.ts` | 62 | 0 |
| modified | `apps/web/src/api/procurement.ts` | 29 | 0 |
| modified | `apps/web/src/api/purchase-orders.ts` | 62 | 1 |
| modified | `apps/web/src/api/site-execution.ts` | 79 | 0 |
| added | `apps/web/src/equipment/EquipmentAssetRegisterPanel.tsx` | 57 | 0 |
| added | `apps/web/src/equipment/EquipmentCustodyPanel.tsx` | 106 | 0 |
| modified | `apps/web/src/equipment/EquipmentPanel.tsx` | 10 | 2 |
| modified | `apps/web/src/inventory/InventoryWorkspace.tsx` | 35 | 4 |
| added | `apps/web/src/inventory/MaterialCodeRequestsPanel.tsx` | 205 | 0 |
| added | `apps/web/src/inventory/OperationalExceptionsPanel.tsx` | 48 | 0 |
| added | `apps/web/src/inventory/PortfolioWorkQueuePanel.tsx` | 76 | 0 |
| modified | `apps/web/src/inventory/ReceivingPanel.tsx` | 9 | 4 |
| added | `apps/web/src/inventory/StockCountSchedulesPanel.tsx` | 208 | 0 |
| added | `apps/web/src/inventory/StockLossCasesPanel.tsx` | 334 | 0 |
| added | `apps/web/src/inventory/StockMinimumsPanel.tsx` | 391 | 0 |
| added | `apps/web/src/inventory/UrgentIssueDocumentsPanel.tsx` | 224 | 0 |
| modified | `apps/web/src/master-data/MasterDataPanel.tsx` | 8 | 2 |
| modified | `apps/web/src/master-data/StandardMasters.tsx` | 2 | 0 |
| added | `apps/web/src/procurement/PurchaseOrderCancellationPanel.tsx` | 213 | 0 |
| modified | `apps/web/src/procurement/PurchaseOrdersPanel.tsx` | 292 | 35 |
| modified | `apps/web/src/procurement/PurchaseRequestsPanel.tsx` | 189 | 14 |
| added | `apps/web/src/procurement/SupplierDeliveryCasePanel.tsx` | 284 | 0 |
| added | `apps/web/src/procurement/purchase-order-print.ts` | 137 | 0 |
| modified | `apps/web/src/site-execution/SiteExecutionPanel.tsx` | 70 | 0 |
| modified | `apps/web/src/site-execution/WeeklySiteSummaryPanel.tsx` | 98 | 9 |

### Recovery and tests (51)

| Git status | Path | Added | Deleted |
|---|---|---:|---:|
| added | `deploy/release-candidate/equipment-successor-documents.mjs` | 75 | 0 |
| added | `deploy/release-candidate/equipment-successor-populated.mjs` | 80 | 0 |
| added | `deploy/release-candidate/equipment-successor-preflight.mjs` | 34 | 0 |
| added | `deploy/release-candidate/equipment-successor-preflight.test.mjs` | 20 | 0 |
| added | `deploy/release-candidate/fm01-operational-focused.test.mjs` | 0 | 0 |
| added | `deploy/release-candidate/fm01-workday-preview.test.mjs` | 0 | 0 |
| modified | `deploy/release-candidate/historical-snapshot.mjs` | 0 | 0 |
| modified | `deploy/release-candidate/historical-snapshot.test.mjs` | 0 | 0 |
| modified | `deploy/release-candidate/hr-upgrade.mjs` | 0 | 0 |
| modified | `deploy/release-candidate/legacy-fixture.mjs` | 0 | 0 |
| added | `deploy/release-candidate/m4-112-approval-scope-guard.mjs` | 0 | 0 |
| added | `deploy/release-candidate/nancy07-stock-count-schedule-focused.test.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pm02-historical-columns.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pm02-historical-columns.test.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pm02-populated-upgrade-preparation.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pm02-schema-preparation.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pm02-schema-preparation.test.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pm09-urgent-documents-focused.test.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pur01-historical-columns.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pur01-populated-upgrade-preparation.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pur01-schema-preparation.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pur01-schema-preparation.test.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pur04-historical-columns.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pur04-populated-upgrade-preparation.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pur04-schema-preparation.mjs` | 0 | 0 |
| added | `deploy/release-candidate/pur04-schema-preparation.test.mjs` | 0 | 0 |
| added | `deploy/release-candidate/purchasing-historical-columns.mjs` | 0 | 0 |
| added | `deploy/release-candidate/purchasing-historical-columns.test.mjs` | 0 | 0 |
| added | `deploy/release-candidate/purchasing-release-mode.mjs` | 0 | 0 |
| added | `deploy/release-candidate/purchasing-successor-historical.mjs` | 0 | 0 |
| added | `deploy/release-candidate/purchasing-successor-historical.test.mjs` | 0 | 0 |
| added | `deploy/release-candidate/purchasing-successor-populated.mjs` | 0 | 0 |
| added | `deploy/release-candidate/purchasing-successor-schema-preparation.mjs` | 0 | 0 |
| added | `deploy/release-candidate/purchasing-successor-schema-preparation.test.mjs` | 0 | 0 |
| modified | `deploy/release-candidate/receiving-predecessor.mjs` | 0 | 0 |
| modified | `deploy/release-candidate/rehearse-migration.sh` | 0 | 0 |
| modified | `deploy/release-candidate/schema-contract.mjs` | 0 | 0 |
| modified | `deploy/release-candidate/schema-contract.test.mjs` | 0 | 0 |
| modified | `deploy/release-candidate/site-issue-predecessor.mjs` | 0 | 0 |
| added | `deploy/release-candidate/ss13-loss-damage-focused.test.mjs` | 0 | 0 |
| modified | `deploy/release-candidate/verify-evidence.mjs` | 0 | 0 |
| modified | `deploy/release-candidate/verify-evidence.test.mjs` | 0 | 0 |
| added | `deploy/uat/m4-fm01-closeout-browser-native.mjs` | 0 | 0 |
| added | `deploy/uat/m4-operational-browser-native.mjs` | 0 | 0 |
| added | `deploy/uat/m4-pm02-purchasing-browser-native.mjs` | 0 | 0 |
| added | `deploy/uat/m4-pm15-delayed-site-readback-browser.mjs` | 0 | 0 |
| added | `deploy/uat/m4-pur07-jai-ben-server-download-browser-native.mjs` | 0 | 0 |
| added | `deploy/uat/pur07-thai-approved-po-print-browser.mjs` | 0 | 0 |
| added | `deploy/uat/pur08-pur14-browser-native.mjs` | 0 | 0 |
| added | `deploy/uat/pur14-replacement-browser-native.mjs` | 0 | 0 |
| modified | `deploy/uat/runtime-acceptance.mjs` | 0 | 0 |

### Governance (9)

| Git status | Path | Added | Deleted |
|---|---|---:|---:|
| added | `docs/M4-2026-11-25-112-CONSOLIDATED-EVIDENCE.csv` | 0 | 0 |
| added | `docs/M4-2026-11-25-112-EFFECTIVE-M4-GATES.csv` | 0 | 0 |
| added | `docs/M4-2026-11-25-112-OWNER-DISPOSITIONS.csv` | 0 | 0 |
| added | `docs/M4-2026-11-25-PUR01-BOUNDED-REBASE.md` | 0 | 0 |
| added | `docs/M4-2026-11-25-PUR04-BOUNDED-REBASE.md` | 0 | 0 |
| added | `docs/M4-2026-11-25-PUR07-BOUNDED-REBASE.md` | 0 | 0 |
| added | `docs/M4-2026-11-25-PUR08-PUR14-BOUNDED-REBASE.md` | 0 | 0 |
| added | `docs/M4-2026-11-25-PUR12-BOUNDED-REBASE.md` | 0 | 0 |
| added | `docs/M4-PM02-PARTIAL-PR-LINES-2026-11-23.md` | 0 | 0 |
