# M4 Lane B — SS14 / PM15 supplier and demand indicators (24 Nov 2026 SGT)

**Source base:** #427 exact integrated starting SHA `680bca5767652522ef08f72d4df97b6df2732fca`.
**Branch:** `work-m4-ss14-pm15-supplier-alerts-20261124`.
**Status:** isolated development source. No protected-main merge, Owner acceptance, retained-user signoff or Production deployment.

## Implemented source

- `apps/api/src/inventory/supplier-commitment-indicator.ts` classifies *actual approved PO-line* `expectedDelivery` and `requiredOnSite` dates in the Thailand business-day calendar. Boundaries 14 / 7 / 0 and lateness are inclusive and deterministic. Null is `DATE_UNKNOWN`, never derived from material-plan `validFrom`.
- `StockMinimumService.supplierCommitments()`: uses the existing live session/active employee/persisted inventory-stock permission/Company/Project/site guards; bounded, repeatable-read queries; considers latest **approved** PO revision for each Project PO number, preserving an older approved commitment while a newer revision is still draft/rejected. A cancelled approved revision is labelled `CANCELLED`, not a pending obligation.
- Reconciles **posted, unreversed GR items** across all revisions by PO number + original quotation-award identity. This prevents double counting historical revision quantities. GR items from other authorized Project sites count toward total delivered, but only posted GR rows at the selected site count toward **received at this site**. All quantities remain in the original PO-line UOM, with no stock-conversion assumption. Cross-Company/project/source/UOM inconsistencies and over-receipts fail closed.
- An approved revised PO-line expected date differing from a previous approved expected date is marked `dateRevisedFromPreviousApproved`, **not** a confirmed supplier reschedule; supplier acknowledgement is `NOT_VERIFIED`.
- `GET /api/v1/inventory/stock-minimums/projects/:projectId/sites/:warehouseId/supplier-indicators` is `inventory.stock.view` guarded and `Cache-Control: private, no-store`. React/MUI `StockMinimumsPanel` displays the approved Project PO date, ordered/posted received/selected-site received/outstanding quantities, cancellation, unknown, due, late and revised-date indicators.
- No new schema/migration, retained role grant, automatic PR/PO/GR, supplier message, Finance/stock posting, background job or external notification.

## Non-inferable site and supplier facts

PurchaseOrder / PurchaseOrderLine has **no structured destination warehouse ID**; `deliveryLocation` is free text and cannot safely establish a site identity. Thus this readback is **Project-wide** for authenticated users who have access to the selected site. The selected site is used for authorization and actual posted-GR attribution only. It would be misleading to label an unreceived PO line as contracted specifically for that site. New site-target allocation is a separate policy/schema scope.

An approved PO `expectedDelivery` is an internally entered expected date; it is **not proven supplier acknowledgement**. No daily item-demand dates can be obtained from material-plan `validFrom`; exact daily needs and delivery escalation/recipient/channel/threshold decisions remain Owner-policy-gated. This lane does not claim to have delivered push messages, supplier-confirmed rescheduling, or future-day availability.

## Focused tests and execution limitations

- `supplier-commitment-indicator.spec.ts`: 14/7/0/late, unknown date, partial receipts, changed approved revision, cancellation, malformed dates/over-receipt.
- `stock-minimum.supplier-indicators.spec.ts`: live session and employee deactivation, foreign Project/supplier, correct Company/Project query boundary, latest approved revision, posted GR site split, cancellation, absence of dates, invalid UOM and bounded limits.
- Intended command on isolated runner after `pnpm --filter @construction-erp/api prisma:generate` and `pnpm --filter @construction-erp/api build`:
  `node --test apps/api/dist/inventory/supplier-commitment-indicator.spec.js apps/api/dist/inventory/stock-minimum.supplier-indicators.spec.js`
- This coding session has repository write/read access through the GitHub integration, **not** a checkout with dependencies or an authorized PostgreSQL runner. New focused tests are committed but are **not claimed PASS** without the runner result. Do **not** repeat full CI or previously sealed native/Mac evidence merely for reassurance.

## Release Coordinator handoff

Review the branch diff exclusively against `680bca5767652522ef08f72d4df97b6df2732fca`; rerun only the two new focused suites once in an authorized disposable runner and evaluate a scoped real PostgreSQL readback with multiple revision/receipt cases if available. Confirm the Store Site/Khaimook authenticated React journeys separately with genuine scope and denials. Resolve any review finding before bringing Lane B into frozen #427. Coordinate with Lane C/D; do not edit their branch, publish counters or grant retained roles.

**Unaccepted status:** 4/8 prototype, GL 3/10, M4 technical 20/32 and packages 0/8; this branch alone does not change accepted hours, milestone or release authority. DEC-022 independent full-diff review and #384 explicit Owner approval remain with the Release Coordinator.
