# M4 exact closure candidate — independent review preparation (25 November 2026)

Status: ISOLATED, STAGED, NOT VALIDATED OR ADMITTED. No self-review approval, retained-role acceptance, merge to protected main, or Production authorization.

- Protected main: `040395bc7b0dedd40207f91f743bc2efc1584622`.
- Frozen FM01 PR #452: `4aab761d8477cfb63ea978af1444865b720d42d5`, full run 45524967848 attempt 2 SUCCESS 46/46; Codex quota failed, not an independent code verdict.
- Isolated candidate: `138ea662094dc50556b1389f0c8144298b9bfcb4`, branch `work-m4-consolidated-closure-candidate-20261125`.
- Parent baseline: `0fe545da4241dacb4201f5cad1bcd8d51502a032`. Exact five changed paths read back from four disjoint parents. No push-only workflow child copied.
- GitHub compare main→candidate: 56 ahead, 0 behind, 184 paths. This is a source inventory, not a declaration that any pending test passed.

## Pending independent focused validation

| Scope | Source | Workflow-only child | Status |
|---|---|---|---|
| PM15 delayed readback | 86015162a1390ff4ee0fa709de16a1fdb1a10d8f | 8d1dbf0362462d5b53a443cdd1fcde0479fe335f | Run ID not exposed |
| Equipment paired DB/Documents | 2a9779b108a68c208f06ce3c9b31b2fa3a515885 | 8c8f9aa922059cccde6fafa40ba6a5c7e317ff06 | Run ID not exposed |
| PUR10/PUR08 deterministic cancellation race | 1b4aba9fbedbc928e9a28c9af38e227fabbd56ff | 6ecaf5960cc05c3b6383b88dfa5c9d47a2952f11 | Run ID not exposed |
| PUR07 browser PDF witness | ff316e21c9001495c3a684715b7310ae4811a06e | e417124cc9b6d3227630d64e49cf5f0fb8177219 | Run ID not exposed |

The connector's commit-run lookup filters to pull-request-triggered runs; empty arrays do not establish that these push-triggered jobs failed or ran. Obtain actual run IDs and job outcomes before accepting runtime proof. Do not open PRs merely to re-run those jobs. The operational exception browser was skipped after the earlier PUR07 failure and remains open.

## Newly consolidated exact blobs (all five verified by readback)

| Path | Blob |
|---|---|
| deploy/uat/m4-pm15-delayed-site-readback-browser.mjs | 12812200540462472de5adae47eb1b78af479788 |
| deploy/release-candidate/equipment-successor-documents.mjs | 01a36359fc34a126dc9e686aab3520a10d10bc43 |
| apps/api/src/procurement/purchase-order.pur10-finalization.integration.spec.ts | fd858ea0e7e8a73abbdb4fe12ceeb11851219e60 |
| apps/api/src/procurement/supplier-delivery-case.service.ts | db3ab35730d753690d8d005424e6cdc59f19b43e |
| deploy/uat/m4-pur07-jai-ben-server-download-browser-native.mjs | 7ee395a7499a517228c8132600658f42961043cf |

## Review ordering

1. Review all eight new forward migrations and historical preservation (no destructive rewrite, no historical fabricated rows, no implicit permission grants).
2. Review company/project and active-session boundaries, PO source locking and stale conflict semantics, canonical stock/Finance ownership, approval separation and evidence-only supplier actions; check supplier transition vs revision separately from cancellation.
3. Review browser state transitions, Thai PDF content, immutable PO lineage, read-only manager and role-specific controls; distinguish synthetic browser fixtures from actual retained roles.
4. Review backup and restore contracts, documents plus HR keys (new equipment fixture is document-only and is not independent HR-key proof), exact-source checks and workflow gates.
5. Carry forward all 112 requirement rows and the six explicit Owner-approved scope boundaries from ecd78e4d and overlay d5c333d8; no deferred requirement disappears. Separate retained eight-role UAT and later Finance/HR/cross-Project work.
6. Recheck protected main and frozen PR452 before independent DEC-022 review, any exact-head validation or merge. Do not self-approve or repeat full CI without applicable authorization. Candidate staged, not approved.

## Complete changed-path inventory

### Workflow governance (1)

| Status | Path | + | − |
|---|---|---:|---:|
| modified | `.github/workflows/validate.yml` | 16 | 10 |

### Migrations (8)

| Status | Path | + | − |
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

| Status | Path | + | − |
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

| Status | Path | + | − |
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

### Recovery and validation (50)

| Status | Path | + | − |
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

### Documentation (6)

| Status | Path | + | − |
|---|---|---:|---:|
| added | `docs/M4-2026-11-25-PUR01-BOUNDED-REBASE.md` | 0 | 0 |
| added | `docs/M4-2026-11-25-PUR04-BOUNDED-REBASE.md` | 0 | 0 |
| added | `docs/M4-2026-11-25-PUR07-BOUNDED-REBASE.md` | 0 | 0 |
| added | `docs/M4-2026-11-25-PUR08-PUR14-BOUNDED-REBASE.md` | 0 | 0 |
| added | `docs/M4-2026-11-25-PUR12-BOUNDED-REBASE.md` | 0 | 0 |
| added | `docs/M4-PM02-PARTIAL-PR-LINES-2026-11-23.md` | 0 | 0 |
