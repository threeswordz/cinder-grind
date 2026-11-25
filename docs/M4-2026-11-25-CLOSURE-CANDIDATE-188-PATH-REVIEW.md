# M4 exact successor review — 188-path inventory (25 November 2026)

**Not an approval.** Source assembly and metadata verification only. All new runtime browser, supplier concurrency and paired recovery validations remain unobserved, and independent DEC-022 review, retained UAT and production release authority are blocked.

| Pin | Exact SHA |
|---|---|
| Protected main | `040395bc7b0dedd40207f91f743bc2efc1584622` |
| Frozen approved-for-review FM01 PR #452 head | `4aab761d8477cfb63ea978af1444865b720d42d5` (CI 45524967848 attempt 2 46/46 SUCCESS, Codex review could not complete) |
| Original four-lane combined source | `138ea662094dc50556b1389f0c8144298b9bfcb4` |
| Operational browser successor | `33f301ad9967c3b94cda8b3a12542be5855a1c9c` |
| Current exact successor | `86e376af957788de15f1a7e315428cdd0d0299b2` (`work-m4-consolidated-112-gates-20261125`) |

- GitHub compare `main` → successor: **58 commits ahead, zero behind, 188 changed paths**. Full file inventory below.
- Current latest successor adds **exactly four immutable governance paths** atop operational browser successor, with independently verified blob hashes; it does not touch protected main or trigger workflow.
- All 112 original requirement records remain intact. Six and only six Owner-approved M4 bounded scope decisions. Original future scope retained; **no formal M4 acceptance**.
- Current effective gates: 42 deferred future, 33 bounded technical evidence pending retained UAT, 12 source evidence pending, 13 role/source proof pending, six functional gaps open, six approved bounded scope decisions still requiring retained UAT.
- Current all-112 guard is a Node source/CSV consistency verifier; readback and independent V8 projection reconciliation passed, but actual Node CI execution has **not** been observed.

## Unresolved exact tests and decision gates

1. Focused PM15 stale site/Project readback browser, equipment DB+Document paired restore, supplier case vs canonical PUR10 cancellation race, PUR07 actual Thai PDF download. Push-triggered run status is not available via current commit-run API; do not declare PASS from empty results or rerun full CI.
2. Operational Chrome with Nancy07 scheduling, PM09 independent receipt document decision, SS13 four role chain and outsider Project denial. Test source corrected on isolated successor but remains unexecuted.
3. Review company/project/permission revalidation, serializable concurrency and PO commercial revision ordering, signed supplier physical return, no automatic stock/Finance posting, active historical data preservation, no retained permission grants or credit creation.
4. Independently review frozen #452 and current successor separately. M4 46h forecast includes release/retained acceptance; prototype 4/8 and GL 3/10 remain.
5. Eight retained actors in MKE and TCJ with current Company/Project grants, actual Mac populated restore, HR keys and paired document recovery, DEC-022/DEC-042 and explicit Owner go/no-go are not implied by this source inventory.

## Newly added governance paths — byte-identical from the approved documentation branch

| Path | Git blob |
|---|---|
| `docs/M4-2026-11-25-112-CONSOLIDATED-EVIDENCE.csv` | `c3a1cf58546aff1a53f136e513e479e55c637f63` |
| `docs/M4-2026-11-25-112-OWNER-DISPOSITIONS.csv` | `7fc814657437e5ca7154ce22532b4445b2258573` |
| `docs/M4-2026-11-25-112-EFFECTIVE-M4-GATES.csv` | `dec0ad01a54aee69a671290a3e74b7105eae3f1d` |
| `deploy/release-candidate/m4-112-approval-scope-guard.mjs` | `36ed1c91e357c5c78fadeeb71ec0a859ba684e2d` |

## Complete `main` → successor changed path inventory


### CI and workflow (1)

| Status | Path | Added | Removed |
|---|---|---:|---:|
| modified | `.github/workflows/validate.yml` | 16 | 10 |

### Forward migrations (8)

| Status | Path | Added | Removed |
|---|---|---:|---:|
| added | `apps/api/prisma/migrations/20261123143000_pm02_partial_pr_line_review/migration.sql` | 19 | 0 |
| added | `apps/api/prisma/migrations/20261123163500_pm02_review_trigger_scope/migration.sql` | 212 | 0 |
| added | `apps/api/prisma/migrations/20261123181000_pur04_po_commercial_header/migration.sql` | 22 | 0 |
| added | `apps/api/prisma/migrations/20261123185000_pur01_quote_exception_reason/migration.sql` | 4 | 0 |
| added | `apps/api/prisma/migrations/20261123190000_pur12_po_partner_short_names/migration.sql` | 32 | 0 |
| added | `apps/api/prisma/migrations/20261123201500_pur07_po_manual_dispatch_events/migration.sql` | 87 | 0 |
| added | `apps/api/prisma/migrations/20261124023000_ss11_equipment_custody/migration.sql` | 133 | 0 |
| added | `apps/api/prisma/migrations/20261124221500_jai_asset_register/migration.sql` | 56 | 0 |

### API (90)

| Status | Path | Added | Removed |
|---|---|---:|---:|
| modified | `apps/api/prisma/schema.prisma` | 57 | 0 |
| added | `apps/api/src/equipment/equipment-asset-register.controller.ts` | 26 | 0 |
| added | `apps/api/src/equipment/equipment-asset-register.native.integration.spec.ts` | 135 | 0 |
| added | `apps/api/src/equipment/equipment-asset-register.service.ts` | 149 | 0 |
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
| added | `apps/api/src/procurement/purchase-order.pur10-finalization.integration.spec.ts` | 723 | 0 |
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

| Status | Path | Added | Removed |
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
| added | `apps/web/src/equipment/EquipmentCustodyPanel.tsx` | 101 | 0 |
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

### Recovery and validation (51)

| Status | Path | Added | Removed |
|---|---|---:|---:|
| added | `deploy/release-candidate/equipment-successor-documents.mjs` | 75 | 0 |
| added | `deploy/release-candidate/equipment-successor-populated.mjs` | 80 | 0 |
| added | `deploy/release-candidate/equipment-successor-preflight.mjs` | 34 | 0 |
| added | `deploy/release-candidate/equipment-successor-preflight.test.mjs` | 20 | 0 |
| added | `deploy/release-candidate/fm01-operational-focused.test.mjs` | 176 | 0 |
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

### Governance docs (9)

| Status | Path | Added | Removed |
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
