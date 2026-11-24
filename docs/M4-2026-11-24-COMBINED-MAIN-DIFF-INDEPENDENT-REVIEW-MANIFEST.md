# Construction ERP — whole protected-main-to-combined-M4 source inventory (review-preparation only)

> **Source freeze for THIS inventory:** protected `main` `3a441b1fa389a9a274e6ca82413740a3ffa2f51b` → isolated *unmerged Draft* PR #438 code head `c2b406616cbaa2fa3d5095d252e0de3c265c6f24` on 24 November 2026 (Singapore). This document is on a separate docs branch; its own new file is **not** part of the source commit/diff below. Recompute against any newly changed head before independent DEC-022 review, CI, or Owner release decision. **No independent approval, real retained-user UAT, Production or full CI is implied.**

## Exact full source boundary

- **Repository:** threeswordz/cinder-grind. Main is the verified protected source at `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`, not a source to modify.
- **Combined code:** [unmerged Draft #438](https://github.com/threeswordz/cinder-grind/pull/438), `c2b406616cbaa2fa3d5095d252e0de3c265c6f24`, tree `15927db4f06aaebad7f0f9b22a35ca7eda707b6c`.
- **Parents:** supplier Draft [#436](https://github.com/threeswordz/cinder-grind/pull/436) `a10b99e8a3ad11737e258f987fb97ce4f57a9e38`; disjoint PUR07 Draft [#437](https://github.com/threeswordz/cinder-grind/pull/437) `08beb187bdfdc54b71edc0fdc6e2e14d1b9e52fc`. Shared predecessor integrated four-lane [Draft #427](https://github.com/threeswordz/cinder-grind/pull/427) `435bd8805d5bcd7e0a1a9941668b67860f288b78`.
- **GitHub compare result:** `ahead`, **295** commits ahead of protected main, 0 behind, **177** changed files: **140 added, 37 modified, 0 removed**. Approximate compare additions **17885**, deletions **129**, combined changed lines **18014** (file-diff line totals, *not tested code coverage*).
- **No overlapping integration paths**: PUR07 had exactly 3 new/modified files and supplier stack 17 changed paths relative to #427; the three Git blob hashes were unchanged when assembling merge tree. A successful Git merge is **not** proof of approved implementation/tenancy/security.

## Known passing narrow evidence (not an integrated acceptance substitute)

| Work | Evidence at isolated exact source | What it DOES NOT prove |
|---|---|---|
| Four-lane M4 source | [Draft #427](https://github.com/threeswordz/cinder-grind/pull/427) and prior focused published receipts | Retained eight-role UAT, closure of 112 IDs, Owner acceptance |
| Supplier native role/Project/receiving negatives | [focused PostgreSQL 17.11 SUCCESS #45370305802](https://github.com/threeswordz/cinder-grind/actions/runs/45370305802) | Physical outbound supplier-return stock/accounting treatment |
| Actual authentic Chrome posted replacement | [SUCCESS #45371800181](https://github.com/threeswordz/cinder-grind/actions/runs/45371800181) | Supplier external acknowledgment, independently approved Finance credit |
| Canonical GR reversal | native test step **1/1 PASS** in overall **failed** combined run [#45373701925](https://github.com/threeswordz/cinder-grind/actions/runs/45373701925); corrected actual Chrome [SUCCESS #45374163626](https://github.com/threeswordz/cinder-grind/actions/runs/45374163626) | Formal retained-user approval, full CI; original combined run not globally green |
| PUR07 signed approved PDF and safe Document linkage | focused [SUCCESS #45375009267](https://github.com/threeswordz/cinder-grind/actions/runs/45375009267) and [SUCCESS #45375637651](https://github.com/threeswordz/cinder-grind/actions/runs/45375637651) | Actual supplier email/LINE transmission (NEVER ERP-originated) or target host Thai-font proof |
| NEW combined source compatibility | [source-only API + React TypeScript SUCCESS #45376511209](https://github.com/threeswordz/cinder-grind/actions/runs/45376511209), seven relevant Git blobs equal to Draft #438 | Independent DEC-022, full native+browser combined acceptance or release gate |

## Reviewer priorities — independently inspect, do not inherit Builder approval

1. All full 177-path differences against the **protected-main** SHA, including 295-commit provenance and all forward-only Prisma migrations; review latest branch head, not just three-file #437 or 17-file supplier overlays.
2. Company/Project deny-by-default for Store, Khaimook, Jai, Ben, Nancy, Porn, Foreman and Koh across API, Export, Document bytes, related object, temporal revocation and React entry. Synthetic Company fixture is not retained MKE/TCJ actor proof; no extra SYS_ADMIN, no retained grants.
3. Maker/checker: Ben PO approvals and amendments, Nancy Client BOQ, narrow DEC-054 Ben Cost BOQ exception, original Store→Khaimook/Jai receiving, stock transfer source/destination timing and PUR10 cancellation Jira→PM→Ben proof. Do not silently update approved policy.
4. Supplier source lineage: original checked damaged condition photo and checksum; independent Jai claim; new checked approved canonical GR/item with actual posted stock; subsequent canonical GR reversal changes **read-only status**, leaves immutable supplier-case event and does not post duplicate inventory/AP.
5. PUR07 PDF: supplier legal name and independent completed approval; Thai Unicode local sandbox, no placeholder or spoofed legal PDF. Document link requires real read authorization; reported external send/ack **does not send** email or LINE.
6. Outstanding business decisions: physical outward return quantity/warehouse/stock posting vs damage custody; credit note/AP adjustment vs replacement-only Finance; unsupported SHORT/WRONG/EXCESS quantity attribution. Do **not** invent posting behavior.
7. Complete [112-ID disposition](https://github.com/threeswordz/cinder-grind/blob/c2b406616cbaa2fa3d5095d252e0de3c265c6f24/docs/M4-2026-11-24-112-DISPOSITION.csv), immutable requirement ledger, historical manifest and eight named actor role checks. Defer genuine retained-user UAT until DEC-042 authorized setup and stable candidate.
8. **Release gate**: DEC-022 independent exact HEAD review + Owner issue #384 permission for expensive full CI, protected main merge and Production separately. Draft sources and source-only checks authorize none of these.

## Entire main→candidate path inventory (GitHub source compare)

Each line is a changed path returned by GitHub compare `3a441b1fa389a9a274e6ca82413740a3ffa2f51b...c2b406616cbaa2fa3d5095d252e0de3c265c6f24`. Status is added or modified as reported, not a judgment on feature acceptance. Recompute on any new candidate SHA.

### Schema and forward-only migrations — 8 files

| Status | Changes | Path |
|---|---:|---|
| added | 19 | `apps/api/prisma/migrations/20261123143000_pm02_partial_pr_line_review/migration.sql` |
| added | 212 | `apps/api/prisma/migrations/20261123163500_pm02_review_trigger_scope/migration.sql` |
| added | 22 | `apps/api/prisma/migrations/20261123181000_pur04_po_commercial_header/migration.sql` |
| added | 4 | `apps/api/prisma/migrations/20261123185000_pur01_quote_exception_reason/migration.sql` |
| added | 32 | `apps/api/prisma/migrations/20261123190000_pur12_po_partner_short_names/migration.sql` |
| added | 87 | `apps/api/prisma/migrations/20261123201500_pur07_po_manual_dispatch_events/migration.sql` |
| added | 133 | `apps/api/prisma/migrations/20261124023000_ss11_equipment_custody/migration.sql` |
| modified | 57 | `apps/api/prisma/schema.prisma` |

### Procurement, supplier, PO, BOQ and approval — 39 files

| Status | Changes | Path |
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
| added | 106 | `apps/api/src/procurement/supplier-delivery-case.controller.ts` |
| added | 244 | `apps/api/src/procurement/supplier-delivery-case.native.integration.spec.ts` |
| added | 482 | `apps/api/src/procurement/supplier-delivery-case.service.ts` |
| added | 81 | `apps/api/src/procurement/supplier-delivery-lifecycle.test.mjs` |
| added | 198 | `apps/api/src/procurement/supplier-delivery-lifecycle.ts` |
| added | 333 | `apps/api/src/procurement/supplier-replacement-posted.native.integration.spec.ts` |
| added | 55 | `apps/api/src/procurement/supplier-replacement-proof.test.mjs` |
| added | 84 | `apps/api/src/procurement/supplier-replacement-proof.ts` |

### Receiving, inventory, equipment and Store — 33 files

| Status | Changes | Path |
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

### Other backend/API/auth/protected sources — 12 files

| Status | Changes | Path |
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

### React/MUI frontend and role controls — 30 files

| Status | Changes | Path |
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
| added | 223 | `apps/web/src/procurement/SupplierDeliveryCasePanel.tsx` |
| added | 137 | `apps/web/src/procurement/purchase-order-print.ts` |
| added | 267 | `apps/web/src/projects/ProjectCloseoutPanel.tsx` |
| modified | 8 | `apps/web/src/projects/ProjectsPanel.tsx` |
| modified | 70 | `apps/web/src/site-execution/SiteExecutionPanel.tsx` |
| modified | 107 | `apps/web/src/site-execution/WeeklySiteSummaryPanel.tsx` |

### Deployment, real Chrome, recovery and CI — 16 files

| Status | Changes | Path |
|---|---:|---|
| added | 210 | `deploy/release-candidate/ben04-closeout-contract.test.mjs` |
| added | 167 | `deploy/release-candidate/fm01-operational-focused.test.mjs` |
| added | 87 | `deploy/release-candidate/fm01-workday-preview.test.mjs` |
| added | 85 | `deploy/release-candidate/nancy07-stock-count-schedule-focused.test.mjs` |
| added | 98 | `deploy/release-candidate/pm09-urgent-documents-focused.test.mjs` |
| added | 140 | `deploy/release-candidate/ss13-loss-damage-focused.test.mjs` |
| added | 352 | `deploy/uat/m4-eight-role-journeys-20261124.mjs` |
| added | 145 | `deploy/uat/m4-eight-role-journeys-20261124.test.mjs` |
| added | 364 | `deploy/uat/m4-fm01-closeout-browser-native.mjs` |
| added | 0 | `deploy/uat/m4-operational-browser-native.mjs` |
| added | 0 | `deploy/uat/m4-pm02-purchasing-browser-native.mjs` |
| added | 0 | `deploy/uat/m4-pur01-browser-native.mjs` |
| added | 0 | `deploy/uat/m4-pur07-jai-ben-server-download-browser-native.mjs` |
| added | 0 | `deploy/uat/pur07-thai-approved-po-print-browser.mjs` |
| added | 0 | `deploy/uat/pur08-pur14-browser-native.mjs` |
| added | 0 | `deploy/uat/pur14-replacement-browser-native.mjs` |

### Requirements, docs and other source — 39 files

| Status | Changes | Path |
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


## Maintainer disposition

- Prototype is **4/8**, go-live gates **3/10**, M4 accepted **0/8**, 60-package formally accepted **0/60**, actual human logged engineering hours **UNKNOWN**. No source-file count, commit count or green TypeScript check changes formal counters.
- This reference file intentionally lives outside protected main and outside the code-head SHA being inventoried; do not silently claim review complete.
- For any new code head, run **GitHub main→new-head compare** again and revalidate the review boundary before independent review. Owner real-world deadline is **31 December 2026**, full 112-ID eight-person Production feasibility RED under current capacity.
