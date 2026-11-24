# Lane D — complete main-to-branch pre-freeze DEC-022 review register

**Document state: REVIEW PREPARATION / NOT a release approval.** Created on 24 Nov 2026 SGT for [#428](https://github.com/threeswordz/cinder-grind/issues/428). The per-file register below is an exact GitHub compare of protected main to Lane D parent HEAD, with this newly added document explicitly included as a final predictable file. **It is not the eventual final A+B+C+D integrated candidate**; the Release Coordinator MUST rerun the full diff **after** consuming the three remaining lane branches.

## Verified comparison anchors (before adding this one documentation file)

| Comparison | Main/base | Head | GitHub ancestry and exact result |
|---|---|---|---|
| Initial integrated source | `3a441b1fa389a9a274e6ca82413740a3ffa2f51b` | `680bca5767652522ef08f72d4df97b6df2732fca` (#427) | `205` ahead, `0` behind, **141 files**; merge-base `3a441b1fa389a9a274e6ca82413740a3ffa2f51b` |
| Verified Lane D pre-manifest parent | `3a441b1fa389a9a274e6ca82413740a3ffa2f51b` | `30bd3e8cb36adaeb09c38605dc0bb6d40a36265b` | `208` ahead, `0` behind, **144 files**, merge-base `3a441b1fa389a9a274e6ca82413740a3ffa2f51b` |
| This documentation commit after creation | `3a441b1fa389a9a274e6ca82413740a3ffa2f51b` | **new Lane D HEAD — re-read after commit** | Expected **209** ahead, **145** file paths including this manifest (verify; not self-certified) |

- The **pre-manifest** branch has two new docs added by Lane D after the prior `COORDINATOR-SOURCE-TRIAGE.md`; there are no application changes relative to #427 in this lane.
- [Full exact compare baseline](https://github.com/threeswordz/cinder-grind/compare/3a441b1fa389a9a274e6ca82413740a3ffa2f51b...680bca5767652522ef08f72d4df97b6df2732fca); [full current Lane D comparison](https://github.com/threeswordz/cinder-grind/compare/3a441b1fa389a9a274e6ca82413740a3ffa2f51b...30bd3e8cb36adaeb09c38605dc0bb6d40a36265b).
- **DO NOT substitute the pull request overlay:** #427 targets #425, and #425 itself is narrower than its ancestor main diff. Only main-to-final-candidate catches all newly introduced migrations, security paths, frontend and proof operators.
- Full file category count *including this document* (to verify after create): 01 SQL migrations: **6**; 02 Prisma schema: **1**; 03 API and focused tests: **66**; 04 React/MUI client: **25**; 05 Runners and browser: **12**; 06 Governance/docs: **35**; **TOTAL 145 paths**.

## Reviewer worklist and acceptance matrix

| Review family | Exact required independent examination | Must be rejected / kept OPEN when |
|---|---|---|
| **SQL & Prisma** | All 6 SQL files, 1 Prisma schema; additive/forward-only migration and all preexisting populated data; unique locks and race behavior for PO cancellation/revisions, GR and audit | Destructive wipe, legacy PO/GR/document loss, missing type/DB alignment, unexpected financial posting, unsigned reviewer |
| **Purchase/BOQ/DEC-054** | Jai→Khaimook→Ben cancellation/approval and policy conflict behavior, Rev0 immutable Rev1, project-scoped commercial prices/API/export, supplier receipt; Cost BOQ Ben-only narrowly audited self-approval, Client Nancy independent, Khaimook quantities-only | Broad Ben self-approval, maker/checker bypass, unauthorized price bytes/CSV, Company scope used as all-Projects grant, invented supplier refund policy |
| **Store/receiving/transfers/site** | Pre-PO temporary custody unavailable until approved PO/GR; independent Jai verification and 48h late link; origin dispatch debit, destination receipt credit; reserved/UOM adjustment; urgent issue actor/job/issuer audit; equipment CG##### person-custody separately | Premature stock credit, damaged goods posted, unreadable audit, wrong warehouse/Project, staff disabled session succeeds, equipment assignment mistaken for person loan |
| **SS02 & supplier/plan-start alerts** | SS02 canonical authorized master create evidence, Store→PM→creator sequence; SS14/PM15 advisory stock minimum vs approved plan validFrom; supplier due/late only from authoritative live PO/GR | Treats validFrom as actual daily demand or supplier delivery date, canceled delivery counted received, supplier alert writes stock/Finance, broad material manage granted to Store |
| **Eight-role authenticated UI/API** | Real Nancy, Ben, Khaimook, Jai, Store Site, Foreman, Porn and Koh actual Company+Project scopes; positive and wrong-Project same-Company/foreign-Company/disabled/independent checker negatives; API, UI, export/bytes independent | Synthetic fixture misrepresented as retained MKE/TCJ proof, SYS_ADMIN business substitute, unauthorized retained grant, missing negative receipt |
| **Operators/reports/docs** | Confirm source SHA of each test receipt (passing and known failed) including exact file/program; no duplicate full CI. Reconcile immutable 112 IDs and eight packages; no speculative time credits | PR/branch assumed passed CI, historical failed run called pass, acceptance changed absent Owner, HR/GL06/#245 added silently |
| **Final release / 5-of-8** | Freeze *full* head, inspect exact non-force merge provenance and cross-lane overlaps; ONE external independent DEC-022 review; new **Owner #384 specific authority before full release CI, Ready or protected-main merge**; explicit Owner M4 package exits | Self-review, protected main write, missing signed acceptance, Production operation or retained-role activation without authorization |

### Risk-first sequence

1. **P0:** changed SQL and Prisma, Company/Project+actor filtering and security-sensitive service tests, supplier/GR/Finance boundary, BOQ/export and DEC-054. New Lane A/B modules must enter this review when integrated, although they are **not yet in the source file register below**.
2. **P1:** React/MUI role-driven page/actions; API adapter and authorized proof; special attention to returning denied metadata/CSV and data bytes. Synthetic browser evidence must be source-bound to merged head.
3. **P2:** 112 immutable ID statuses, M4-01…08 exits, forecast-hourogram and previous Actions run receipts. A documentation change is not technical or business acceptance.
4. Freeze exact merged SHA after all A/B/C and Lane D branches; compare **protected main to frozen final SHA** and verify file list/count/commits/merge base **again**. Independent reviewer decides, Builder cannot. No full CI or merge until Owner #384 authority.

## Exhaustive per-file comparison register (main → Lane D, not final four-lane merge)

| Path | GitHub change | Lines (GitHub compare) | Review family | Evidence/risk focus |
|---|---|---|---|---|
| `apps/api/prisma/migrations/20261123143000_pm02_partial_pr_line_review/migration.sql` | added | +19 / −0 | 01 SQL migrations | P0 forward-only SQL, approval-history immutability, rollback/upgrade |
| `apps/api/prisma/migrations/20261123163500_pm02_review_trigger_scope/migration.sql` | added | +212 / −0 | 01 SQL migrations | P0 forward-only SQL, approval-history immutability, rollback/upgrade |
| `apps/api/prisma/migrations/20261123181000_pur04_po_commercial_header/migration.sql` | added | +22 / −0 | 01 SQL migrations | P0 forward-only SQL, approval-history immutability, rollback/upgrade |
| `apps/api/prisma/migrations/20261123185000_pur01_quote_exception_reason/migration.sql` | added | +4 / −0 | 01 SQL migrations | P0 forward-only SQL, approval-history immutability, rollback/upgrade |
| `apps/api/prisma/migrations/20261123190000_pur12_po_partner_short_names/migration.sql` | added | +32 / −0 | 01 SQL migrations | P0 forward-only SQL, approval-history immutability, rollback/upgrade |
| `apps/api/prisma/migrations/20261123201500_pur07_po_manual_dispatch_events/migration.sql` | added | +87 / −0 | 01 SQL migrations | P0 forward-only SQL, approval-history immutability, rollback/upgrade |
| `apps/api/prisma/schema.prisma` | modified | +57 / −0 | 02 Prisma schema | P0 DB schema/SQL and safe generated client |
| `apps/api/src/budget/boq-http.integration.spec.ts` | modified | +31 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/approved-plan-start-reminder.spec.ts` | added | +40 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/approved-plan-start-reminder.ts` | added | +50 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/inventory.module.ts` | modified | +20 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/M4-STORE-PARALLEL-2026-11-24.md` | added | +38 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/material-code-request-contract.spec.ts` | added | +89 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/material-code-request-contract.ts` | added | +135 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/material-code-request.controller.ts` | added | +51 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/material-code-request.native.integration.spec.ts` | added | +231 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/material-code-request.service.spec.ts` | added | +198 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/material-code-request.service.ts` | added | +213 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-count-schedule-contract.ts` | added | +129 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-count-schedule.controller.ts` | added | +53 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-count-schedule.service.ts` | added | +151 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-loss-case-contract.ts` | added | +156 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-loss-case.controller.ts` | added | +80 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-loss-case.service.ts` | added | +248 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-minimum-contract.spec.ts` | added | +71 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-minimum-contract.ts` | added | +88 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-minimum.controller.ts` | added | +89 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-minimum.plan-start.spec.ts` | added | +133 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-minimum.service.spec.ts` | added | +154 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/stock-minimum.service.ts` | added | +293 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/urgent-material-issue-contract.ts` | added | +155 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/urgent-material-issue-documents.controller.ts` | added | +82 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/inventory/urgent-material-issue-documents.service.ts` | added | +223 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/master-data/master-data.controller.ts` | modified | +12 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/master-data/master-data.service.ts` | modified | +10 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/procurement.controller.ts` | modified | +55 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/procurement.module.ts` | modified | +5 / −2 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/procurement.pm02.integration.spec.ts` | added | +508 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/procurement.service.ts` | modified | +244 / −6 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-cancellation-case.controller.ts` | added | +92 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-cancellation-case.service.ts` | added | +418 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-cancellation-contract.test.mjs` | added | +49 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-cancellation-contract.ts` | added | +183 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-identity.spec.ts` | added | +37 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-identity.ts` | added | +34 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-pdf.spec.ts` | added | +53 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-pdf.ts` | added | +179 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-pur07.service.ts` | added | +275 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-quote-policy.spec.ts` | added | +33 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-quote-policy.ts` | added | +51 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-unicode-pdf.spec.ts` | added | +137 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order-unicode-pdf.ts` | added | +284 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order.controller.ts` | modified | +114 / −11 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order.integration.spec.ts` | modified | +24 / −13 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order.pm02-source-guard.spec.ts` | added | +99 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order.pur01.integration.spec.ts` | added | +278 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order.pur04-revision.integration.spec.ts` | added | +338 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order.pur04.integration.spec.ts` | added | +146 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order.pur07.integration.spec.ts` | added | +223 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order.pur10-finalization.integration.spec.ts` | added | +572 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order.pur12.integration.spec.ts` | added | +236 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/purchase-order.service.ts` | modified | +404 / −15 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/procurement/sourcing.service.ts` | modified | +8 / −0 | 03 API and focused tests | P0 role+Company/Project, audit, GR/Finance boundary |
| `apps/api/src/projects/project-closeout-contract.ts` | added | +232 / −0 | 03 API and focused tests | P1 API contracts, role/Company/Project and audit |
| `apps/api/src/projects/project-closeout.service.ts` | added | +184 / −0 | 03 API and focused tests | P1 API contracts, role/Company/Project and audit |
| `apps/api/src/projects/projects.controller.ts` | modified | +56 / −1 | 03 API and focused tests | P1 API contracts, role/Company/Project and audit |
| `apps/api/src/projects/projects.module.ts` | modified | +2 / −1 | 03 API and focused tests | P1 API contracts, role/Company/Project and audit |
| `apps/api/src/site-execution/site-execution.controller.ts` | modified | +58 / −0 | 03 API and focused tests | P1 API contracts, role/Company/Project and audit |
| `apps/api/src/site-execution/site-execution.service.ts` | modified | +334 / −8 | 03 API and focused tests | P1 API contracts, role/Company/Project and audit |
| `apps/api/src/site-execution/site-weekly-operational.ts` | added | +222 / −0 | 03 API and focused tests | P1 API contracts, role/Company/Project and audit |
| `apps/api/src/site-execution/site-weekly-summary.spec.ts` | modified | +1 / −0 | 03 API and focused tests | P1 API contracts, role/Company/Project and audit |
| `apps/api/src/site-execution/site-weekly-summary.ts` | modified | +2 / −0 | 03 API and focused tests | P1 API contracts, role/Company/Project and audit |
| `apps/api/src/site-execution/site-weekly-workday.ts` | added | +138 / −0 | 03 API and focused tests | P1 API contracts, role/Company/Project and audit |
| `apps/web/src/AdminConsole.tsx` | modified | +4 / −1 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/api/inventory.ts` | modified | +1 / −0 | 04 React/MUI client | P1 API/export negative and authenticated UI |
| `apps/web/src/api/operational-exceptions.ts` | added | +141 / −0 | 04 React/MUI client | P1 API/export negative and authenticated UI |
| `apps/web/src/api/po-cancellation.ts` | added | +62 / −0 | 04 React/MUI client | P1 API/export negative and authenticated UI |
| `apps/web/src/api/procurement.ts` | modified | +29 / −0 | 04 React/MUI client | P1 API/export negative and authenticated UI |
| `apps/web/src/api/projects.ts` | modified | +45 / −0 | 04 React/MUI client | P1 API/export negative and authenticated UI |
| `apps/web/src/api/purchase-orders.ts` | modified | +62 / −1 | 04 React/MUI client | P1 API/export negative and authenticated UI |
| `apps/web/src/api/site-execution.ts` | modified | +79 / −0 | 04 React/MUI client | P1 API/export negative and authenticated UI |
| `apps/web/src/inventory/InventoryWorkspace.tsx` | modified | +34 / −3 | 04 React/MUI client | P1 API/export negative and authenticated UI |
| `apps/web/src/inventory/MaterialCodeRequestsPanel.tsx` | added | +205 / −0 | 04 React/MUI client | P1 API/export negative and authenticated UI |
| `apps/web/src/inventory/OperationalExceptionsPanel.tsx` | added | +48 / −0 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/inventory/StockCountSchedulesPanel.tsx` | added | +208 / −0 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/inventory/StockLossCasesPanel.tsx` | added | +334 / −0 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/inventory/StockMinimumsPanel.tsx` | added | +259 / −0 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/inventory/UrgentIssueDocumentsPanel.tsx` | added | +224 / −0 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/master-data/MasterDataPanel.tsx` | modified | +8 / −2 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/master-data/StandardMasters.tsx` | modified | +2 / −0 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/procurement/purchase-order-print.ts` | added | +137 / −0 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/procurement/PurchaseOrderCancellationPanel.tsx` | added | +213 / −0 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/procurement/PurchaseOrdersPanel.tsx` | modified | +291 / −35 | 04 React/MUI client | P1 API/export negative and authenticated UI |
| `apps/web/src/procurement/PurchaseRequestsPanel.tsx` | modified | +189 / −14 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/projects/ProjectCloseoutPanel.tsx` | added | +267 / −0 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/projects/ProjectsPanel.tsx` | modified | +8 / −0 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/site-execution/SiteExecutionPanel.tsx` | modified | +70 / −0 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `apps/web/src/site-execution/WeeklySiteSummaryPanel.tsx` | modified | +98 / −9 | 04 React/MUI client | P1 permission-limited gestures, denied UI |
| `deploy/release-candidate/ben04-closeout-contract.test.mjs` | added | +210 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `deploy/release-candidate/fm01-operational-focused.test.mjs` | added | +167 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `deploy/release-candidate/fm01-workday-preview.test.mjs` | added | +87 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `deploy/release-candidate/nancy07-stock-count-schedule-focused.test.mjs` | added | +85 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `deploy/release-candidate/pm09-urgent-documents-focused.test.mjs` | added | +98 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `deploy/release-candidate/ss13-loss-damage-focused.test.mjs` | added | +140 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `deploy/uat/m4-fm01-closeout-browser-native.mjs` | added | +364 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `deploy/uat/m4-operational-browser-native.mjs` | added | +526 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `deploy/uat/m4-pm02-purchasing-browser-native.mjs` | added | +407 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `deploy/uat/m4-pur01-browser-native.mjs` | added | +467 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `deploy/uat/m4-pur07-jai-ben-server-download-browser-native.mjs` | added | +448 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `deploy/uat/pur07-thai-approved-po-print-browser.mjs` | added | +171 / −0 | 05 Runners and browser | P1 runnable fixture provenance, synthetic/retained and not a PASS by itself |
| `docs/BOQ-M4-PARALLEL-DEC054-2026-11-24.md` | added | +45 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/ERP-FULL-USE-HOURLY-1900.csv` | added | +1901 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/ERP-FULL-USE-LIVE-CLOCK.md` | added | +330 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/ERP-FULL-USE-WORKPACKAGES.json` | added | +1275 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-112-REQUIREMENTS-EVIDENCE-CROSSWALK-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-2026-11-24-112-DISPOSITION.csv` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-2026-11-24-EIGHT-ROLE-UAT-AND-EXIT.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-2026-11-24-FOUR-LANE-INTEGRATION-REVIEW.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-2026-11-24-MAIN-TO-CANDIDATE-DIFF.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-CONSOLIDATED-REVIEW-MANIFEST-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-FM01-BEN04-PM16-CHROMIUM-SOURCE-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-OPERATIONAL-EXCEPTIONS-UI-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-PM02-PARTIAL-PR-LINES-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-PRIVATE-SOURCE-INTEGRATION-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-PUR01-QUOTE-THRESHOLD-SOURCE-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-PUR01-REAL-BROWSER-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-PUR04-APPROVED-REVISION-SCOPE-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-PUR04-PO-COMMERCIAL-HEADER-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-PUR07-APPROVED-PO-PDF-DISPATCH-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-PUR07-REAL-UNICODE-DOWNLOAD-UI-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-PUR07-UNICODE-SERVER-RENDERER-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-PUR10-CANCELLATION-INTEGRATION-GATES-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-PUR12-NEW-PO-COMPANY-DISPLAY-IDENTITY-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-REAL-CHROMIUM-OPERATIONAL-PROOF-2026-11-23.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-SS02-MATERIAL-CODE-REQUEST-2026-11-24.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/M4-SS14-PM15-APPROVED-PLAN-START-14-7-2026-11-24.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/OP-PROJECT-CLOSEOUT-01-BEN04-PM16.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/OP-SITE-REPORT-01-FM01B-CALENDAR-PREVIEW.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/OP-STOCK-COUNT-SCHEDULE-NANCY07.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/OP-STOCK-LOSS-CASE-SS13.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/OP-URGENT-ISSUE-DOCUMENTS-01-PM09.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/parallel/M4-2026-11-24-COORDINATOR-SOURCE-TRIAGE.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/parallel/M4-2026-11-24-LANE-D-112-SOURCE-TO-EXIT.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/parallel/M4-2026-11-24-LANE-D-EIGHT-PACKAGE-EXIT-AND-FORECAST.md` | added | +0 / −0 | 06 Governance/docs | P2 source SHA, scope, receipt truth and package acceptance |
| `docs/parallel/M4-2026-11-24-LANE-D-PREFREEZE-FULL-DIFF-DEC022-REVIEW.md` | **added by this review manifest commit** | +manifest / −0 | 06 Governance/docs | P2 self-inclusion; document is a review index, NOT DEC-022 approval |

## Signoff fields intentionally NOT populated by the Builder

| Required independent control | Evidence location | Status |
|---|---|---|
| Final integrated full diff *after A+B+C+D* | Coordinator-frozen SHA, regenerated compare, branch ancestry | **PENDING** |
| Focused changed-head compile / native negative evidence | New source-specific run ID and SHA only if authorized/necessary | **PENDING integration; prior receipts reusable but not fungible** |
| Retained MKE/TCJ configured role+Company/Project and document/CSV denies | Private approved target readback and named actor | **BLOCKED_CONFIGURATION / OWNER AUTHORITY** |
| DEC-022 external reviewer | Reviewer identity, reviewed SHA and finding resolution | **PENDING — not self-approved** |
| #384 final CI / Ready / main merge authority | Fresh specific Owner consent | **BLOCKED_AUTHORIZATION** |
| M4 8/8 packages / transition prototype 4→5 | Business Owner signed exit per M4-01…08 | **PENDING: 0/8** |

**This Lane D branch runs no CI, opens no approval, changes no roles and does not touch protected main or Production.**
