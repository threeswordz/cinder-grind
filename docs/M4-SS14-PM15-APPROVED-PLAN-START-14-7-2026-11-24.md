# M4 SS14 / PM15 — approved-plan 14/7-day read-only reminder increment

**Status:** isolated development branch, **unmerged**, not accepted, no retained user access or real browser proof. Based on combined four-lane Draft [#427](https://github.com/threeswordz/cinder-grind/pull/427) at `da16faf77768d8d3d531c0fd1c8cb9a03071d4e7`.

## Scope added

- For one real, active, authorized site, Storekeeper/Project Manager **current live DB session, active employee, persisted role permission, and Project-scope checks** are reused from `StockMinimumService`.
- New read-only endpoint: `GET /api/v1/inventory/stock-minimums/projects/:projectId/sites/:warehouseId/plan-starts`. Cache-Control private/no-store. No new role grant.
- Select **latest approved material-usage-plan revision only** per scoped plan. Show per-line material identity, work package, planned quantity in **source entered plan UOM**, and 14/7-day reminders based solely on `validFrom`. Dates computed in **Asia/Bangkok** calendar, including exact days 14, 7 and 0, not local server/UTC offset. Do not leak foreign-Company material or UOM.
- UI presents reminder list under existing site minimum-stock warning component, distinctly labeled as **approved plan start, not daily material need or supplier delivery date**.
- Read-only; no inventory on-hand credits, reservation, PR/PO, GR/Finance posting or external notifications; over-limit output fails closed instead of silently implying there is no demand.
- Existing site minimum-stock behavior, 9/9 historical focused contract/service checks, and approved plan/PO/transfer journeys remain untouched.

## Gaps deliberately NOT claimed

**SS14 and PM15 remain partially implemented.** Exact 14/7-day **material delivery requirement dates** are not modelled by this plan: a revision has only validFrom/validTo. Explicit per-day material requirement with approved source provenance, reservation allocation, linked PO delivery/quantity due/late, supplier reschedule/late indicators, actual recipient notifications, and potential escalation thresholds remain outstanding. Never infer these from plan validFrom, a PO's project delivery, or an external document without Owner scope policy.

SS02 Store→Khaimook→Jai/Nancy material master creation, SS11 CG##### tool/worker loan and return, Owner pending beyond-plan escalation and intercompany Finance handling are separate gaps. This increment does not unblock retained Company/Project UAT or revise GL gates.

## Focused acceptance planned

1. Exact source Prisma/TypeScript/backend and frontend compatibility from this branch.
2. Only new `approved-plan-start-reminder.spec.ts` (Bangkok time, date boundaries, leap-year, invalid) and `stock-minimum.plan-start.spec.ts` (actual guard/service source fixture, Company/Project/actor revocation, over-limit, zero writes).
3. Real authenticated React/MUI Store + Khaimook user journeys in authorized disposable or retained scope before formal SS14 role acceptance.
4. Independent DEC-022 frozen full source review and Owner #384 specific final CI authorization at M4 release; no full CI or Ready/merge from this branch.

## Planning counter

Historical full-ERP baseline **1,900h**, provisional task-by-task residual forecast **1,847h** including **117h to M4 / 5/8** as last published. This increment is new **partial SS14/PM15 source progress** and is not an accepted whole M4 package, earned hour credit, or evidence-based quantified reforecast. No recorded worker timesheet. Prototype remains **4/8**, GL **3/10**, M4 technical **20/32** until a gate is explicitly verified and accepted.
