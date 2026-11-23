# M4 exact main-to-PR425 functional ancestry review manifest — 24 Nov 2026

**Status: draft review index only. Not independent DEC-022 approval.**

Source: main `3a441b1fa389a9a274e6ca82413740a3ffa2f51b` to [Draft PR #425](https://github.com/threeswordz/cinder-grind/pull/425) `8c60e125b57e1081b552ea8f2de87cdfeddadbf0`. [Full comparison](https://github.com/threeswordz/cinder-grind/compare/3a441b1fa389a9a274e6ca82413740a3ffa2f51b...8c60e125b57e1081b552ea8f2de87cdfeddadbf0).

GitHub reports **100 commits ahead, 0 behind, 106 files, +16334 / -50 lines**. Merge base = `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`.

## Why the PR tab is not the release review

PR #425 has a narrower **17-file overlay** because its base is `10a9917f00d53e3c91b999e038113b42f9ab5a42`. The overlay cannot reveal all functional ancestry. The lineage documented in the existing manifest is #406 operational backend → #407 React → #412 PM02 → #413 PUR04 → #415 PUR01 → #417 PUR12 → #418 PUR07 → #423 server Chromium Thai PDF → #424 Jai/Ben UI → #425 bounded tests and forecast documents. Review all 106 changed files compared to main.

## Independent reviewer priorities

1. Validate all **six forward-only SQL migrations** and matching Prisma schema; immutable approvals, historic POs, provenance triggers, audit, populated upgrade and separation of GR/Finance posting.
2. Inspect API Company/Project/actor admission, foreign MKE/TCJ and same-Company wrong-Project denial, revoked actor sessions, maker/checker, and no SYS_ADMIN business privilege expansion.
3. Check PO/PR lifecycle, supplier threshold and exception, commercial fields, immutable revision, K/T display identity, PDF byte hashes and *reported* manual send only; no ERP email/LINE delivery claimed.
4. Check temporary pre-PO custody, independent Jai check, GR goods only, origin dispatch debit/receipt credit, urgent issues, stock count/SS13 non-Finance boundaries, site closeout.
5. Check actual React/MUI user gestures and API denials; BOQ quantities-only price exclusion at API/export/UI, not just hidden fields. PUR10 cancellation is separate and **not** in PR #425.
6. Preserve already-successful source-specific test receipts; the combined final source still needs one changed-head focused compatibility proof, new independent DEC-022 review, and Owner-gated final release workflow.

## Exact exhaustive file register

| Section | Files |
|---|---:|
| 01 Migrations | 6 |
| 02 Prisma schema | 1 |
| 03 Backend | 44 |
| 04 Frontend | 20 |
| 05 Focused runners | 6 |
| 06 Browser operators | 6 |
| 07 Docs and ledgers | 23 |
| **TOTAL** | **106** |

### 01 Migrations

| File | Change | + | − | Review focus |
|---|---|---:|---:|---|
| `apps/api/prisma/migrations/20261123143000_pm02_partial_pr_line_review/migration.sql` | added | 19 | 0 | Forward-only/data preservation/trigger |
| `apps/api/prisma/migrations/20261123163500_pm02_review_trigger_scope/migration.sql` | added | 212 | 0 | Forward-only/data preservation/trigger |
| `apps/api/prisma/migrations/20261123181000_pur04_po_commercial_header/migration.sql` | added | 22 | 0 | Forward-only/data preservation/trigger |
| `apps/api/prisma/migrations/20261123185000_pur01_quote_exception_reason/migration.sql` | added | 4 | 0 | Forward-only/data preservation/trigger |
| `apps/api/prisma/migrations/20261123190000_pur12_po_partner_short_names/migration.sql` | added | 32 | 0 | Forward-only/data preservation/trigger |
| `apps/api/prisma/migrations/20261123201500_pur07_po_manual_dispatch_events/migration.sql` | added | 87 | 0 | Forward-only/data preservation/trigger |

### 02 Prisma schema

| File | Change | + | − | Review focus |
|---|---|---:|---:|---|
| `apps/api/prisma/schema.prisma` | modified | 57 | 0 | Schema/migration compatibility |

### 03 Backend

| File | Change | + | − | Review focus |
|---|---|---:|---:|---|
| `apps/api/src/inventory/inventory.module.ts` | modified | 12 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/inventory/stock-count-schedule-contract.ts` | added | 129 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/inventory/stock-count-schedule.controller.ts` | added | 53 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/inventory/stock-count-schedule.service.ts` | added | 151 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/inventory/stock-loss-case-contract.ts` | added | 156 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/inventory/stock-loss-case.controller.ts` | added | 80 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/inventory/stock-loss-case.service.ts` | added | 248 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/inventory/urgent-material-issue-contract.ts` | added | 155 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/inventory/urgent-material-issue-documents.controller.ts` | added | 82 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/inventory/urgent-material-issue-documents.service.ts` | added | 223 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/master-data/master-data.controller.ts` | modified | 12 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/master-data/master-data.service.ts` | modified | 10 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/procurement.controller.ts` | modified | 55 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/procurement.module.ts` | modified | 2 | 1 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/procurement.pm02.integration.spec.ts` | added | 508 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/procurement.service.ts` | modified | 244 | 6 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order-identity.spec.ts` | added | 37 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order-identity.ts` | added | 34 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order-pdf.spec.ts` | added | 53 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order-pdf.ts` | added | 179 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order-pur07.service.ts` | added | 275 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order-quote-policy.spec.ts` | added | 33 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order-quote-policy.ts` | added | 51 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order-unicode-pdf.spec.ts` | added | 137 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order-unicode-pdf.ts` | added | 284 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order.controller.ts` | modified | 103 | 1 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order.pm02-source-guard.spec.ts` | added | 99 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order.pur01.integration.spec.ts` | added | 278 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order.pur04-revision.integration.spec.ts` | added | 338 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order.pur04.integration.spec.ts` | added | 146 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order.pur07.integration.spec.ts` | added | 223 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order.pur12.integration.spec.ts` | added | 236 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/purchase-order.service.ts` | modified | 299 | 1 | Auth, scope, service behavior and tests |
| `apps/api/src/procurement/sourcing.service.ts` | modified | 8 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/projects/project-closeout-contract.ts` | added | 232 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/projects/project-closeout.service.ts` | added | 184 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/projects/projects.controller.ts` | modified | 56 | 1 | Auth, scope, service behavior and tests |
| `apps/api/src/projects/projects.module.ts` | modified | 2 | 1 | Auth, scope, service behavior and tests |
| `apps/api/src/site-execution/site-execution.controller.ts` | modified | 58 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/site-execution/site-execution.service.ts` | modified | 334 | 8 | Auth, scope, service behavior and tests |
| `apps/api/src/site-execution/site-weekly-operational.ts` | added | 222 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/site-execution/site-weekly-summary.spec.ts` | modified | 1 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/site-execution/site-weekly-summary.ts` | modified | 2 | 0 | Auth, scope, service behavior and tests |
| `apps/api/src/site-execution/site-weekly-workday.ts` | added | 138 | 0 | Auth, scope, service behavior and tests |

### 04 Frontend

| File | Change | + | − | Review focus |
|---|---|---:|---:|---|
| `apps/web/src/AdminConsole.tsx` | modified | 2 | 0 | UI behavior plus server enforcement |
| `apps/web/src/api/inventory.ts` | modified | 1 | 0 | UI behavior plus server enforcement |
| `apps/web/src/api/operational-exceptions.ts` | added | 141 | 0 | UI behavior plus server enforcement |
| `apps/web/src/api/procurement.ts` | modified | 29 | 0 | UI behavior plus server enforcement |
| `apps/web/src/api/projects.ts` | modified | 45 | 0 | UI behavior plus server enforcement |
| `apps/web/src/api/purchase-orders.ts` | modified | 62 | 1 | UI behavior plus server enforcement |
| `apps/web/src/api/site-execution.ts` | modified | 79 | 0 | UI behavior plus server enforcement |
| `apps/web/src/inventory/InventoryWorkspace.tsx` | modified | 18 | 3 | UI behavior plus server enforcement |
| `apps/web/src/inventory/OperationalExceptionsPanel.tsx` | added | 48 | 0 | UI behavior plus server enforcement |
| `apps/web/src/inventory/StockCountSchedulesPanel.tsx` | added | 208 | 0 | UI behavior plus server enforcement |
| `apps/web/src/inventory/StockLossCasesPanel.tsx` | added | 334 | 0 | UI behavior plus server enforcement |
| `apps/web/src/inventory/UrgentIssueDocumentsPanel.tsx` | added | 224 | 0 | UI behavior plus server enforcement |
| `apps/web/src/master-data/StandardMasters.tsx` | modified | 2 | 0 | UI behavior plus server enforcement |
| `apps/web/src/procurement/PurchaseOrdersPanel.tsx` | modified | 282 | 4 | UI behavior plus server enforcement |
| `apps/web/src/procurement/PurchaseRequestsPanel.tsx` | modified | 189 | 14 | UI behavior plus server enforcement |
| `apps/web/src/procurement/purchase-order-print.ts` | added | 137 | 0 | UI behavior plus server enforcement |
| `apps/web/src/projects/ProjectCloseoutPanel.tsx` | added | 267 | 0 | UI behavior plus server enforcement |
| `apps/web/src/projects/ProjectsPanel.tsx` | modified | 8 | 0 | UI behavior plus server enforcement |
| `apps/web/src/site-execution/SiteExecutionPanel.tsx` | modified | 70 | 0 | UI behavior plus server enforcement |
| `apps/web/src/site-execution/WeeklySiteSummaryPanel.tsx` | modified | 98 | 9 | UI behavior plus server enforcement |

### 05 Focused runners

| File | Change | + | − | Review focus |
|---|---|---:|---:|---|
| `deploy/release-candidate/ben04-closeout-contract.test.mjs` | added | 210 | 0 | Runnable test source, not a green receipt |
| `deploy/release-candidate/fm01-operational-focused.test.mjs` | added | 167 | 0 | Runnable test source, not a green receipt |
| `deploy/release-candidate/fm01-workday-preview.test.mjs` | added | 87 | 0 | Runnable test source, not a green receipt |
| `deploy/release-candidate/nancy07-stock-count-schedule-focused.test.mjs` | added | 85 | 0 | Runnable test source, not a green receipt |
| `deploy/release-candidate/pm09-urgent-documents-focused.test.mjs` | added | 98 | 0 | Runnable test source, not a green receipt |
| `deploy/release-candidate/ss13-loss-damage-focused.test.mjs` | added | 140 | 0 | Runnable test source, not a green receipt |

### 06 Browser operators

| File | Change | + | − | Review focus |
|---|---|---:|---:|---|
| `deploy/uat/m4-fm01-closeout-browser-native.mjs` | added | 364 | 0 | Synthetic Chrome evidence provenance |
| `deploy/uat/m4-operational-browser-native.mjs` | added | 526 | 0 | Synthetic Chrome evidence provenance |
| `deploy/uat/m4-pm02-purchasing-browser-native.mjs` | added | 407 | 0 | Synthetic Chrome evidence provenance |
| `deploy/uat/m4-pur01-browser-native.mjs` | added | 467 | 0 | Synthetic Chrome evidence provenance |
| `deploy/uat/m4-pur07-jai-ben-server-download-browser-native.mjs` | added | 448 | 0 | Synthetic Chrome evidence provenance |
| `deploy/uat/pur07-thai-approved-po-print-browser.mjs` | added | 171 | 0 | Synthetic Chrome evidence provenance |

### 07 Docs and ledgers

| File | Change | + | − | Review focus |
|---|---|---:|---:|---|
| `docs/ERP-FULL-USE-HOURLY-1900.csv` | added | 1901 | 0 | Scope, receipt and acceptance accuracy |
| `docs/ERP-FULL-USE-LIVE-CLOCK.md` | added | 330 | 0 | Scope, receipt and acceptance accuracy |
| `docs/ERP-FULL-USE-WORKPACKAGES.json` | added | 1275 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-112-REQUIREMENTS-EVIDENCE-CROSSWALK-2026-11-23.md` | added | 283 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-CONSOLIDATED-REVIEW-MANIFEST-2026-11-23.md` | added | 33 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-FM01-BEN04-PM16-CHROMIUM-SOURCE-2026-11-23.md` | added | 32 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-OPERATIONAL-EXCEPTIONS-UI-2026-11-23.md` | added | 44 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-PM02-PARTIAL-PR-LINES-2026-11-23.md` | added | 48 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-PRIVATE-SOURCE-INTEGRATION-2026-11-23.md` | added | 21 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-PUR01-QUOTE-THRESHOLD-SOURCE-2026-11-23.md` | added | 9 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-PUR01-REAL-BROWSER-2026-11-23.md` | added | 15 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-PUR04-APPROVED-REVISION-SCOPE-2026-11-23.md` | added | 13 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-PUR04-PO-COMMERCIAL-HEADER-2026-11-23.md` | added | 22 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-PUR07-APPROVED-PO-PDF-DISPATCH-2026-11-23.md` | added | 34 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-PUR07-REAL-UNICODE-DOWNLOAD-UI-2026-11-23.md` | added | 9 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-PUR07-UNICODE-SERVER-RENDERER-2026-11-23.md` | added | 15 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-PUR12-NEW-PO-COMPANY-DISPLAY-IDENTITY-2026-11-23.md` | added | 28 | 0 | Scope, receipt and acceptance accuracy |
| `docs/M4-REAL-CHROMIUM-OPERATIONAL-PROOF-2026-11-23.md` | added | 22 | 0 | Scope, receipt and acceptance accuracy |
| `docs/OP-PROJECT-CLOSEOUT-01-BEN04-PM16.md` | added | 23 | 0 | Scope, receipt and acceptance accuracy |
| `docs/OP-SITE-REPORT-01-FM01B-CALENDAR-PREVIEW.md` | added | 88 | 0 | Scope, receipt and acceptance accuracy |
| `docs/OP-STOCK-COUNT-SCHEDULE-NANCY07.md` | added | 21 | 0 | Scope, receipt and acceptance accuracy |
| `docs/OP-STOCK-LOSS-CASE-SS13.md` | added | 31 | 0 | Scope, receipt and acceptance accuracy |
| `docs/OP-URGENT-ISSUE-DOCUMENTS-01-PM09.md` | added | 28 | 0 | Scope, receipt and acceptance accuracy |

## Mandatory recomputation after other parallel branches

Builder 1 PUR10 uses `work-m4-pur10-cancellation-policy-no-ci-20261123` and is not contained in the displayed #425 ancestry. Builder 2 BOQ/DEC-054 and Builder 3 inventory must be inspected by exact future SHA; do not assume any unobserved branch exists. Review branch merge-bases, overlapping source and DB migrations, and rebuild the full main-to-final-candidate file list **again after integration**. This list is exact only for the frozen #425 SHA.

Docs branch `docs-m4-112-role-exit-parallel-20261124` descends from #425 and is nonruntime; no protected main, deploy, retained grants, Ready conversion, merge or new CI implied.

Reference: [central hour clock #414](https://github.com/threeswordz/cinder-grind/issues/414), [M4 issue #304](https://github.com/threeswordz/cinder-grind/issues/304), [review rule DEC-022](https://github.com/threeswordz/cinder-grind/blob/main/docs/DECISION-LOG.md).
