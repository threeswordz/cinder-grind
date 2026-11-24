# M4 Store / Inventory Parallel Builder 3 — 2026-11-24

## Exact source and governance

- Base: Draft PR #425, head `8c60e125b57e1081b552ea8f2de87cdfeddadbf0` verified before branch creation.
- Branch: `work-m4-inventory-store-parallel-20261124`; all implementation edits confined to `apps/api/src/inventory/**` and `apps/web/src/inventory/**`.
- No schema/migration, Procurement/Finance/Projects/shared authorization modifications; no main/PR Ready, full CI, Mac receiving/transfer upgrade replay, Production deployment, or permission grants.
- #384 Owner emergency CI pause applies: any future full release validation requires fresh specific authorization. This evidence note is **not** an M4 acceptance or retained-role receipt.

## Reconciled requirement dispositions

| ID | Integrated source and reusable evidence | This branch and unfinished acceptance |
| --- | --- | --- |
| SS02 | Company material master create/manage exists under `master-data`; no Store request → Khaimook review → Jai/Nancy creation handoff. | **Not implemented**; shared Master Data/role workflow owner dependency; Owner rollout date and authentic role grants due. |
| SS10 | #352 controlled same-Company transfer: approval, dispatch debit, independent actual receipt credit, partial receipt and alternate assigned employee. | **Reused**, not rerun; intercompany MKE↔TCJ ownership and Finance valuation not authorized. Named users and UAT due. |
| SS11 | Equipment registry, assignment/release and usage exist under `equipment/**`. | **Not equivalent** to worker/subcontractor tool loan, due date, condition, return and CG##### asset register. Equipment/Jai asset ownership, Finance depreciation and operational role decisions due. |
| SS12 | #300 canonical Store count/evidence → independent PM quantity adjustment; Foreman denied; #45132932414 confirms separate NANCY-07 schedule browser. | **Reused**; financial write-off/disposal separate; retained Store/PM role evidence due. |
| SS14 | Scoped balances and plan/schedule models existed, but no configured per-site material minimum alert. | **Partially advanced:** audit-backed active/paused stock minimum, live PM-only configuration, scoped Store/PM view, available-stock quantity, stale canonical UOM warning, optimistic event history. **Still missing** approved material-plan 14/7-day alerts, supplier outstanding/due/late/rescheduled delivery indicators, recipient/notification policy and retained-user UAT. |
| PM07 | #352 transfer portion and material-plan-issue authority already represented. | **Reused**; quantitative beyond-plan PM→Ben escalation criteria and intercompany movements require Owner/Purchasing/Finance decision and scoped acceptance. |
| PM08 | #300 quantity-only physical adjustments. | **Reused**; separate financial disposal/valuation and named retained-role UAT due. |
| PM15 | Existing scoped inventory reports, stock counts and read models; no full cross-Project operational exceptions dashboard. | **Partially advanced** with scoped site minimum-stock warnings. Still missing aggregated PR corrections, stock shortages/late receipts, count adjustments, WO/certification, tools due/overdue. Reads must remain scoped to granted projects and must not imply transaction access. |

## New bounded implementation contract

- `StockMinimumController`: GET projects/sites/material choices and per-site alerts; POST site threshold with authenticated session, CSRF and `inventory.stock.view` outer permission.
- `StockMinimumService`: live database session+employee+role-permission recheck; only `PROJECT_MANAGER` may set thresholds; `STOREKEEPER` and `PROJECT_MANAGER` may view; `ProjectAccessService` + company-owned active site warehouse checks on read/write.
- Append-only threshold updates use `audit_logs` with explicit previous event ID, version and Company/Site scope, serializable transaction and per-policy advisory lock. Neither this source nor any response writes stock, reservation, Finance, or purchasing documents.
- Alert quantity is `available = onHand - activeReserved`; `belowMinimum` strictly compares available against configured stock UOM, without crediting unreceived transfers or provisional custody. A materially changed canonical stock UOM suppresses the old threshold warning until reconfigured.
- New focused tests: `stock-minimum-contract.spec.ts` checks validation, chain tamper/fork/gap, material/scope separation; `stock-minimum.service.spec.ts` checks scoped reserved-adjusted read, inactive session, Storekeeper set denial, Project denial, stale UOM/no posting.
- **Test execution status:** test source committed; no authenticated disposable native runner was available in this chat, so no new native/test/TypeScript/browser **PASS** is claimed. Run focused source checks and tests once on a permitted runner and record exact SHA + output. Existing #352/#300/#45132932414 receipts stand; no repetition justified.

## Integration dependencies, without editing sibling code

1. **Master Data / Purchasing (SS02):** material code request/approve/create split and Nancy→Jai maker transition; forbid privileged `master.material.manage` grant to Store just to shortcut request.
2. **Equipment / Jai / Finance (SS11, PM15):** canonical CG##### asset identity, checked-out borrower, due/return/condition handling and separately controlled depreciation.
3. **Purchasing / Projects (SS14, PM15):** approved plan demand 14/7-day dates and supplier outstanding/due/late/rescheduled delivery source contract; confirm notification recipients, no external messaging assumption.
4. **Owner / Finance (SS10, PM07, PM08):** MKE↔TCJ ownership and posting decisions, beyond-plan escalation thresholds, separate loss/disposal valuation. Cross-Company stock movement is **not** enabled by this branch.
5. **Release Coordinator (all):** retained MKE/TCJ actor assignments for eight named roles, actual scope and revocation tests, exact-head independent DEC-022 review, draft integration, Owner-authorized final CI and formal milestone acceptance. Prototype remains **4/8** until these gates close.
