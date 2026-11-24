# M4 — exact protected-main-to-signed-supplier-custody candidate independent-review manifest
**Date:** 24 Nov 2026 SGT. **Review status: NOT REVIEWED.** This is a source-bound indexed independent review INPUT, not an independent DEC-022 signoff.

## Source identity and complete boundary

- Repository: `threeswordz/cinder-grind`.
- Protected `main` reviewed compare BASE: `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`; unmodified by this preparation.
- Final latest isolated Draft code candidate HEAD: `e8c0b7775e7bde66679db70fb0af992a00ecf91a`, [Draft PR #439](https://github.com/threeswordz/cinder-grind/pull/439); this is a descendant of [combined Draft #438](https://github.com/threeswordz/cinder-grind/pull/438) `c2b406616cbaa2fa3d5095d252e0de3c265c6f24`, with PUR07 Draft #437 and PUR08/PUR14 Draft #436 stacked history.
- **Full GitHub compare:** `ahead`, **305 commits ahead, 0 behind, 180 changed files**, including **143 added, 37 modified**; approximate `18161` changed diff lines, not test coverage.
- Prior exact #438 review manifest of 177 files applies to an **older candidate**. Its independent review would not approve the new supplier-return policy; THIS file supersedes it as reviewer boundary.
- New source-specific focused [GitHub Actions #45386319537](https://github.com/threeswordz/cinder-grind/actions/runs/45386319537) **OVERALL SUCCESS** (PostgreSQL 17.11 fresh forward-only migrations, API build/React typecheck, pure cases, signed physical return native and real role-separated Chrome). Source and test Git blobs verified against CI. **Full release CI, retained named eight-role human UAT, independent DEC-022 and Production are NOT claimed.**

## Specific independent review agenda

1. **Supplier DAMAGED outward return:** inspect `supplier-return-custody-proof.ts`, service/controller, MUI and new native/Chrome. Exact received observed-minus-good quantity, same Company/Project/supplier/approved PO material/line/UOM, not superseded, independently checked and original condition photo verified; *separate* uploaded signed return document checksum + named supplier recipient attestation. Check unauthorized/foreign/forged/stale/conflicting concurrent requests and no duplicate return. This is operator evidence, not a verified third-party supplier statement.
2. **No double stock deduction:** rejected damaged qty is not good posted stock; only outward custody history is recorded. Accepted posted goods must use an explicitly authorized canonical Goods Receipt reversal or other governed future stock-return source, never a second supplier-case debit. Test stockTransaction/GR/approved invoice/stock-reservation boundaries.
3. **Finance:** replacement-only `REPLACEMENT_ONLY_NO_AP_CREDIT`; no automatic supplier AP/credit note/payment source. Future genuine credit requires Porn maker/Nancy independent approval and proper source-scoped Finance posting rules; unfinished GL06 must not be disguised as complete.
4. **SHORT/WRONG_ITEM/EXCESS:** Store discrepancy, PM independent review and Jai claim may be recorded but **terminal physical return/replacement is denied** without explicit quantitative material/PO-line attribution decision. Validate server and React fail-closed, check canonical GR never accepts missing or wrong item.
5. **Approval/tenancy:** Ben approves Jai PO and revision, DEC-054 narrowly scoped BOQ Cost exception, Nancy Client BOQ independent approval, Khaimook receipt and transfer approval, Store and Foreman restrictions, Company and Project enforcement for 8 roles including Koh protected HR records and Porn restricted Finance/BOQ.
6. **Whole current main→head:** all **180 paths**, **305 commits** and forward-only Prisma migration behavior, not just this PR diff. For any subsequent source commit recompute the diff, read exact source, and re-run only truly affected focused checks.
7. **Review and release gate:** independent DEC-022 exact-head review; retained real-user MKE/TCJ eight-role UAT per DEC-042; explicit Owner #384 authorization for genuinely unsatisfied final expensive full CI / Ready transition / protected-main merge / Production. No self-approval, granted roles, unprotected promotion or production deployment.

## 180 source paths grouped by review domain

### Forward-only Prisma schema / database migrations — 8 files

| GitHub status | Diff lines | Path |
|---|---:|---|
| added | 19 | `apps/api/prisma/migrations/20261123143000_pm02_partial_pr_line_review/migration.sql` |
| added | 212 | `apps/api/prisma/migrations/20261123163500_pm02_review_trigger_scope/migration.sql` |
| added | 22 | `apps/api/prisma/migrations/20261123181000_pur04_po_commercial_header/migration.sql` |
| added | 4 | `apps/api/prisma/migrations/20261123185000_pur01_quote_exception_reason/migration.sql` |
| added | 32 | `apps/api/prisma/migrations/20261123190000_pur12_po_partner_short_names/migration.sql` |
| added | 87 | `apps/api/prisma/migrations/20261123201500_pur07_po_manual_dispatch_events/migration.sql` |
| added | 133 | `apps/api/prisma/migrations/20261124023000_ss11_equipment_custody/migration.sql` |
| modified | 57 | `apps/api/prisma/schema.prisma` |

### Procurement, PO, supplier and BOQ — 42 files

| GitHub status | Diff lines | Path |
|---|---:|---|
| modified | 31 | `apps/api/src/budget/boq-http.integration.spec.ts` |
| modified | 55 | `apps/api/src/procurement/procurement.controller.ts` |
| modified | 9 | `apps/api/src/procurement/procurement.module.ts` |
| added | 508 | `apps/api/src/procurement/procurement.pm02.integration.spec.ts` |
| modified | 250 | `apps/api/src/procurement/procurement.service.ts` |
| added | 92 | `apps/api/src/procurement/purchase-order-cancellation-case.controller.ts` |
| added | 418 | `apps/api/src/procurement/purchase-order-cancellation-case.service.ts` |
| added | 49 | `apps/api/src/procurement/purchase-order-cancellation-contract.test.mjs` |
| added | 183 | `apps/api/src/procurement/purchase-order-cancellation-contract.ts` |
| added | 37 | `apps/api/src/procurement/purchase-order-identity.spec.ts` |
| added | 34 | `apps/api/src/procurement/purchase-order-identity.ts` |
| added | 53 | `apps/api/src/procurement/purchase-order-pdf.spec.ts` |
| added | 179 | `apps/api/src/procurement/purchase-order-pdf.ts` |
| added | 49 | `apps/api/src/procurement/purchase-order-pur07-document-link.spec.ts` |
| added | 40 | `apps/api/src/procurement/purchase-order-pur07-source-approval.spec.ts` |
| added | 292 | `apps/api/src/procurement/purchase-order-pur07.service.ts` |
| added | 33 | `apps/api/src/procurement/purchase-order-quote-policy.spec.ts` |
| added | 51 | `apps/api/src/procurement/purchase-order-quote-policy.ts` |
| added | 137 | `apps/api/src/procurement/purchase-order-unicode-pdf.spec.ts` |
| added | 284 | `apps/api/src/procurement/purchase-order-unicode-pdf.ts` |
| modified | 125 | `apps/api/src/procurement/purchase-order.controller.ts` |
| modified | 37 | `apps/api/src/procurement/purchase-order.integration.spec.ts` |
| added | 99 | `apps/api/src/procurement/purchase-order.pm02-source-guard.spec.ts` |
| added | 278 | `apps/api/src/procurement/purchase-order.pur01.integration.spec.ts` |
| added | 338 | `apps/api/src/procurement/purchase-order.pur04-revision.integration.spec.ts` |
| added | 146 | `apps/api/src/procurement/purchase-order.pur04.integration.spec.ts` |
| added | 223 | `apps/api/src/procurement/purchase-order.pur07.integration.spec.ts` |
| added | 572 | `apps/api/src/procurement/purchase-order.pur10-finalization.integration.spec.ts` |
| added | 236 | `apps/api/src/procurement/purchase-order.pur12.integration.spec.ts` |
| modified | 419 | `apps/api/src/procurement/purchase-order.service.ts` |
| modified | 8 | `apps/api/src/procurement/sourcing.service.ts` |
| added | 124 | `apps/api/src/procurement/supplier-delivery-case.controller.ts` |
| added | 248 | `apps/api/src/procurement/supplier-delivery-case.native.integration.spec.ts` |
| added | 584 | `apps/api/src/procurement/supplier-delivery-case.service.ts` |
| added | 90 | `apps/api/src/procurement/supplier-delivery-lifecycle.test.mjs` |
| added | 202 | `apps/api/src/procurement/supplier-delivery-lifecycle.ts` |
| added | 333 | `apps/api/src/procurement/supplier-replacement-posted.native.integration.spec.ts` |
| added | 55 | `apps/api/src/procurement/supplier-replacement-proof.test.mjs` |
| added | 84 | `apps/api/src/procurement/supplier-replacement-proof.ts` |
| added | 59 | `apps/api/src/procurement/supplier-return-custody-proof.test.mjs` |
| added | 86 | `apps/api/src/procurement/supplier-return-custody-proof.ts` |
| added | 168 | `apps/api/src/procurement/supplier-return-custody.native.integration.spec.ts` |

### Warehouse, receiving, inventory and equipment — 33 files

| GitHub status | Diff lines | Path |
|---|---:|---|
| added | 71 | `apps/api/src/equipment/equipment-custody.controller.ts` |
| added | 118 | `apps/api/src/equipment/equipment-custody.integration.spec.ts` |
| added | 198 | `apps/api/src/equipment/equipment-custody.service.ts` |
| modified | 6 | `apps/api/src/equipment/equipment.module.ts` |
| added | 38 | `apps/api/src/inventory/M4-STORE-PARALLEL-2026-11-24.md` |
| added | 40 | `apps/api/src/inventory/approved-plan-start-reminder.spec.ts` |
| added | 50 | `apps/api/src/inventory/approved-plan-start-reminder.ts` |
| modified | 20 | `apps/api/src/inventory/inventory.module.ts` |
| added | 89 | `apps/api/src/inventory/material-code-request-contract.spec.ts` |
| added | 135 | `apps/api/src/inventory/material-code-request-contract.ts` |
| added | 51 | `apps/api/src/inventory/material-code-request.controller.ts` |
| added | 231 | `apps/api/src/inventory/material-code-request.native.integration.spec.ts` |
| added | 198 | `apps/api/src/inventory/material-code-request.service.spec.ts` |
| added | 213 | `apps/api/src/inventory/material-code-request.service.ts` |
| modified | 6 | `apps/api/src/inventory/receiving-test-fixture.ts` |
| added | 129 | `apps/api/src/inventory/stock-count-schedule-contract.ts` |
| added | 53 | `apps/api/src/inventory/stock-count-schedule.controller.ts` |
| added | 151 | `apps/api/src/inventory/stock-count-schedule.service.ts` |
| added | 156 | `apps/api/src/inventory/stock-loss-case-contract.ts` |
| added | 80 | `apps/api/src/inventory/stock-loss-case.controller.ts` |
| added | 248 | `apps/api/src/inventory/stock-loss-case.service.ts` |
| added | 71 | `apps/api/src/inventory/stock-minimum-contract.spec.ts` |
| added | 88 | `apps/api/src/inventory/stock-minimum-contract.ts` |
| added | 102 | `apps/api/src/inventory/stock-minimum.controller.ts` |
| added | 133 | `apps/api/src/inventory/stock-minimum.plan-start.spec.ts` |
| added | 154 | `apps/api/src/inventory/stock-minimum.service.spec.ts` |
| added | 472 | `apps/api/src/inventory/stock-minimum.service.ts` |
| added | 205 | `apps/api/src/inventory/stock-minimum.supplier-indicators.spec.ts` |
| added | 96 | `apps/api/src/inventory/supplier-commitment-indicator.spec.ts` |
| added | 75 | `apps/api/src/inventory/supplier-commitment-indicator.ts` |
| added | 155 | `apps/api/src/inventory/urgent-material-issue-contract.ts` |
| added | 82 | `apps/api/src/inventory/urgent-material-issue-documents.controller.ts` |
| added | 223 | `apps/api/src/inventory/urgent-material-issue-documents.service.ts` |

### Other API, protected record and authorization — 12 files

| GitHub status | Diff lines | Path |
|---|---:|---|
| modified | 12 | `apps/api/src/master-data/master-data.controller.ts` |
| modified | 10 | `apps/api/src/master-data/master-data.service.ts` |
| added | 232 | `apps/api/src/projects/project-closeout-contract.ts` |
| added | 184 | `apps/api/src/projects/project-closeout.service.ts` |
| modified | 57 | `apps/api/src/projects/projects.controller.ts` |
| modified | 3 | `apps/api/src/projects/projects.module.ts` |
| modified | 58 | `apps/api/src/site-execution/site-execution.controller.ts` |
| modified | 342 | `apps/api/src/site-execution/site-execution.service.ts` |
| added | 222 | `apps/api/src/site-execution/site-weekly-operational.ts` |
| modified | 1 | `apps/api/src/site-execution/site-weekly-summary.spec.ts` |
| modified | 2 | `apps/api/src/site-execution/site-weekly-summary.ts` |
| added | 138 | `apps/api/src/site-execution/site-weekly-workday.ts` |

### React/MUI and role surfaces — 30 files

| GitHub status | Diff lines | Path |
|---|---:|---|
| modified | 5 | `apps/web/src/AdminConsole.tsx` |
| modified | 21 | `apps/web/src/api/equipment.ts` |
| modified | 1 | `apps/web/src/api/inventory.ts` |
| added | 141 | `apps/web/src/api/operational-exceptions.ts` |
| added | 62 | `apps/web/src/api/po-cancellation.ts` |
| modified | 29 | `apps/web/src/api/procurement.ts` |
| modified | 45 | `apps/web/src/api/projects.ts` |
| modified | 63 | `apps/web/src/api/purchase-orders.ts` |
| modified | 79 | `apps/web/src/api/site-execution.ts` |
| added | 101 | `apps/web/src/equipment/EquipmentCustodyPanel.tsx` |
| modified | 4 | `apps/web/src/equipment/EquipmentPanel.tsx` |
| modified | 39 | `apps/web/src/inventory/InventoryWorkspace.tsx` |
| added | 205 | `apps/web/src/inventory/MaterialCodeRequestsPanel.tsx` |
| added | 48 | `apps/web/src/inventory/OperationalExceptionsPanel.tsx` |
| modified | 13 | `apps/web/src/inventory/ReceivingPanel.tsx` |
| added | 208 | `apps/web/src/inventory/StockCountSchedulesPanel.tsx` |
| added | 334 | `apps/web/src/inventory/StockLossCasesPanel.tsx` |
| added | 358 | `apps/web/src/inventory/StockMinimumsPanel.tsx` |
| added | 224 | `apps/web/src/inventory/UrgentIssueDocumentsPanel.tsx` |
| modified | 10 | `apps/web/src/master-data/MasterDataPanel.tsx` |
| modified | 2 | `apps/web/src/master-data/StandardMasters.tsx` |
| added | 213 | `apps/web/src/procurement/PurchaseOrderCancellationPanel.tsx` |
| modified | 334 | `apps/web/src/procurement/PurchaseOrdersPanel.tsx` |
| modified | 203 | `apps/web/src/procurement/PurchaseRequestsPanel.tsx` |
| added | 284 | `apps/web/src/procurement/SupplierDeliveryCasePanel.tsx` |
| added | 137 | `apps/web/src/procurement/purchase-order-print.ts` |
| added | 267 | `apps/web/src/projects/ProjectCloseoutPanel.tsx` |
| modified | 8 | `apps/web/src/projects/ProjectsPanel.tsx` |
| modified | 70 | `apps/web/src/site-execution/SiteExecutionPanel.tsx` |
| modified | 107 | `apps/web/src/site-execution/WeeklySiteSummaryPanel.tsx` |

### CI, Chrome, deploy and recovery — 16 files

| GitHub status | Diff lines | Path |
|---|---:|---|
| added | 210 | `deploy/release-candidate/ben04-closeout-contract.test.mjs` |
| added | 167 | `deploy/release-candidate/fm01-operational-focused.test.mjs` |
| added | 87 | `deploy/release-candidate/fm01-workday-preview.test.mjs` |
| added | 85 | `deploy/release-candidate/nancy07-stock-count-schedule-focused.test.mjs` |
| added | 98 | `deploy/release-candidate/pm09-urgent-documents-focused.test.mjs` |
| added | 140 | `deploy/release-candidate/ss13-loss-damage-focused.test.mjs` |
| added | 352 | `deploy/uat/m4-eight-role-journeys-20261124.mjs` |
| added | 145 | `deploy/uat/m4-eight-role-journeys-20261124.test.mjs` |
| added | 0 | `deploy/uat/m4-fm01-closeout-browser-native.mjs` |
| added | 0 | `deploy/uat/m4-operational-browser-native.mjs` |
| added | 0 | `deploy/uat/m4-pm02-purchasing-browser-native.mjs` |
| added | 0 | `deploy/uat/m4-pur01-browser-native.mjs` |
| added | 0 | `deploy/uat/m4-pur07-jai-ben-server-download-browser-native.mjs` |
| added | 0 | `deploy/uat/pur07-thai-approved-po-print-browser.mjs` |
| added | 0 | `deploy/uat/pur08-pur14-browser-native.mjs` |
| added | 0 | `deploy/uat/pur14-replacement-browser-native.mjs` |

### Docs, 112-ID requirements and other — 39 files

| GitHub status | Diff lines | Path |
|---|---:|---|
| added | 0 | `docs/BOQ-M4-PARALLEL-DEC054-2026-11-24.md` |
| added | 0 | `docs/ERP-FULL-USE-HOURLY-1900.csv` |
| added | 0 | `docs/ERP-FULL-USE-LIVE-CLOCK.md` |
| added | 0 | `docs/ERP-FULL-USE-WORKPACKAGES.json` |
| added | 0 | `docs/M4-112-REQUIREMENTS-EVIDENCE-CROSSWALK-2026-11-23.md` |
| added | 0 | `docs/M4-2026-11-24-112-DISPOSITION.csv` |
| added | 0 | `docs/M4-2026-11-24-EIGHT-ROLE-UAT-AND-EXIT.md` |
| added | 0 | `docs/M4-2026-11-24-FOUR-LANE-INTEGRATION-REVIEW.md` |
| added | 0 | `docs/M4-2026-11-24-MAIN-TO-CANDIDATE-DIFF.md` |
| added | 0 | `docs/M4-CONSOLIDATED-REVIEW-MANIFEST-2026-11-23.md` |
| added | 0 | `docs/M4-FM01-BEN04-PM16-CHROMIUM-SOURCE-2026-11-23.md` |
| added | 0 | `docs/M4-OPERATIONAL-EXCEPTIONS-UI-2026-11-23.md` |
| added | 0 | `docs/M4-PM02-PARTIAL-PR-LINES-2026-11-23.md` |
| added | 0 | `docs/M4-PRIVATE-SOURCE-INTEGRATION-2026-11-23.md` |
| added | 0 | `docs/M4-PUR01-QUOTE-THRESHOLD-SOURCE-2026-11-23.md` |
| added | 0 | `docs/M4-PUR01-REAL-BROWSER-2026-11-23.md` |
| added | 0 | `docs/M4-PUR04-APPROVED-REVISION-SCOPE-2026-11-23.md` |
| added | 0 | `docs/M4-PUR04-PO-COMMERCIAL-HEADER-2026-11-23.md` |
| added | 0 | `docs/M4-PUR07-APPROVED-PO-PDF-DISPATCH-2026-11-23.md` |
| added | 0 | `docs/M4-PUR07-REAL-UNICODE-DOWNLOAD-UI-2026-11-23.md` |
| added | 0 | `docs/M4-PUR07-UNICODE-SERVER-RENDERER-2026-11-23.md` |
| added | 0 | `docs/M4-PUR10-CANCELLATION-INTEGRATION-GATES-2026-11-23.md` |
| added | 0 | `docs/M4-PUR12-NEW-PO-COMPANY-DISPLAY-IDENTITY-2026-11-23.md` |
| added | 0 | `docs/M4-REAL-CHROMIUM-OPERATIONAL-PROOF-2026-11-23.md` |
| added | 0 | `docs/M4-SS02-MATERIAL-CODE-REQUEST-2026-11-24.md` |
| added | 0 | `docs/M4-SS14-PM15-APPROVED-PLAN-START-14-7-2026-11-24.md` |
| added | 0 | `docs/M4-SS14-PM15-SUPPLIER-INDICATORS-2026-11-24.md` |
| added | 0 | `docs/OP-PROJECT-CLOSEOUT-01-BEN04-PM16.md` |
| added | 0 | `docs/OP-SITE-REPORT-01-FM01B-CALENDAR-PREVIEW.md` |
| added | 0 | `docs/OP-STOCK-COUNT-SCHEDULE-NANCY07.md` |
| added | 0 | `docs/OP-STOCK-LOSS-CASE-SS13.md` |
| added | 0 | `docs/OP-URGENT-ISSUE-DOCUMENTS-01-PM09.md` |
| added | 0 | `docs/parallel/M4-2026-11-24-COORDINATOR-SOURCE-TRIAGE.md` |
| added | 0 | `docs/parallel/M4-2026-11-24-LANE-C-EIGHT-ROLE-BROWSER-EVIDENCE.md` |
| added | 0 | `docs/parallel/M4-2026-11-24-LANE-D-112-SOURCE-TO-EXIT.md` |
| added | 0 | `docs/parallel/M4-2026-11-24-LANE-D-EIGHT-PACKAGE-EXIT-AND-FORECAST.md` |
| added | 0 | `docs/parallel/M4-2026-11-24-LANE-D-PREFREEZE-FULL-DIFF-DEC022-REVIEW.md` |
| added | 0 | `docs/parallel/M4-2026-11-24-SS11-LANE-A-CUSTODY-HANDOFF.md` |
| added | 0 | `docs/parallel/PUR08-PUR14-INTEGRATION-HANDOFF-2026-11-24.md` |


## Unresolved requirements and acceptance

- [Canonical 112-ID disposition](https://github.com/threeswordz/cinder-grind/blob/e8c0b7775e7bde66679db70fb0af992a00ecf91a/docs/M4-2026-11-24-112-DISPOSITION.csv) and [M4 eight-role scenarios](https://github.com/threeswordz/cinder-grind/blob/e8c0b7775e7bde66679db70fb0af992a00ecf91a/docs/M4-2026-11-24-EIGHT-ROLE-UAT-AND-EXIT.md) remain separate from source-only verification. No 112/112 full-production claim.
- Full ERP provisional remaining forecast **1,850h→0h** (M4 120h, separately priced supplier 9h), prior 1,855h after source-supported reduced work −5h. Actual human working hours **UNKNOWN**, formal prototype **4/8**, GL **3/10**, M4 accepted **0/8**. Deadline 31 Dec 2026 full Production 112 IDs, eight real roles is **RED** under current capacity.
- No code head changed by this docs-only manifest. All future reviewer signatures must bind the **current exact source SHA**, compare to protected main and cite positive/negative evidence, with independent decision not authored by Builder.
