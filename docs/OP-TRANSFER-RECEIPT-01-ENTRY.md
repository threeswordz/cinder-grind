# Same-Company transfer dispatch and destination receipt

**Owner-approved decisions:** 16 November 2026 SGT, [#352 receipt](https://github.com/threeswordz/cinder-grind/issues/352#issuecomment-6909284115), DEC-046. Requirements: SS10 and the transfer part of PM07 within the original112-ID census. This is entry preparation, not implemented behavior or technical acceptance.

The confirmed workflow is origin Store preparation → configured independent Khaimook approval → origin dispatch → destination receipt with actual quantities and evidence. The Owner explicitly chose:

1. Deduct origin on dispatch; credit destination only on actual receipt. Approval alone does not move stock. Unreceived quantities remain unavailable to either site.
2. When destination Store is unavailable, Khaimook explicitly assigns an active destination-Project Employee. Assignment grants no automatic role, broader Project access or business approval authority; eligibility and the narrow receive capability are checked at action time.

Do not ask these decisions or the confirmed principal actors again. Cross-MKE/TCJ ownership and Finance remain separately gated. Human UAT follows the frozen integrated prototype under DEC-042.

## Entry and implementation gates

The predecessor #351 has completed exact-head push/PR CI, clean stable independent DEC-022 review, guarded merge/tree equality and exact-main CI; [Current State](CURRENT-STATE.md) records the exact receipts. This entry does not start successor runtime/schema work. Publish this approved decision/scope/acceptance entry through its normal applicable gates before implementation. No new Owner scope question is needed for the two adopted choices.

The Owner is away from the Mac. Prepare and verify code on disposable targets; a separately reviewed preserved-data operator and actual Mac journey follow later. Keep completed startup, actor, material and FM03 executions closed.

## Canonical source and compatibility

The existing StockTransfer/StockTransferItem, configured ApprovalService, InventoryQuantityService locks, StockTransaction and scoped Documents remain authoritative. There is no second stock or financial ledger. Existing paired-on-approval transfers retain their exact history, stock effects, reversal identity and behavior; no historical backfill or inferred physical acknowledgment.

New dispatch/receipt behavior needs an explicit, audited synthetic-only enablement and durable new-transfer provenance. Approval retains the canonical independent decision but creates no new stock effect. Dispatch rechecks approval, current source scope, source dimensions and available stock/reservations, then deducts exactly once. Availability consumed after approval causes dispatch to fail safely; approval is not a promise of reserved stock.

Receipts are append-only, line-linked facts with actual actor/time, accepted quantity and protected evidence. A partial receipt credits only its accepted quantity. Dispatched minus accepted is derived outstanding custody; short, damaged or disputed quantities cannot be silently received, written off or restored to origin. Any unresolved disposition remains visible and unavailable until a separately authorized physical resolution. Expiry or an exception note never posts stock.

Illustrative quantity timeline, with no unrelated stock or reservations:

| Event | Origin on-hand | Destination on-hand | Unreceived |
|---|---:|---:|---:|
| Approve transfer5 from origin20 |20|0|0|
| Dispatch5 |15|0|5|
| Accept4 |15|4|1|
| Accept remaining1 |15|5|0|

All quantities use canonical material/UOM dimensions and Decimal arithmetic. Mixed-UOM conversion belongs to its separate SS03 contract. No stock valuation, AP, Actual Cost, Payment, write-off or new Accounting effect is introduced.

## Source-backed implementation consequences

- Current approval immediately posts both movements. Separate the controlled new path without changing legacy approval/posting semantics or weakening immutable transfer fields.
- The existing unique transfer-item/movement index permits only one IN per item. Partial receipts need durable receipt-line provenance and appropriately scoped uniqueness; immutable stock rows cannot be updated into cumulative totals. Preserve legacy uniqueness and exact source-family checks.
- The canonical stock-source trigger currently requires the full transfer-item quantity. Extend only the controlled receipt branch to prove its immutable accepted quantity, dimensions, actor and matching receipt event. All other source families and legacy checks remain intact.
- Existing reverse expects exactly two movements per item. Reconcile controlled complete-receipt reversal with all actual canonical movements and current destination availability/reservations. Never treat partial/unreceived custody as returned goods. Do not expose a correction action whose physical/stock contract has not been established and tested.
- Existing transfer details and STOCK_TRANSFER Documents require access to both source and destination Projects. A destination-only receiver needs a minimal destination-scoped projection and a protected receipt-specific Document target; granting origin access is not a receiving implementation.
- Existing multi-line/multi-Project same-Company transfer dimensions remain explicit. A receipt must bind its authorized destination Project and lines; it must not expose or acknowledge other destination allocations.

## Authorization, history and UI

Use explicit dispatch, receipt-view/receive and receiver-assignment capabilities without automatic grants. Session, active same-Company Employee and action-specific persisted Project scope precede reads, mutations and replay. Khaimook assignment/reassignment requires explicit authority, reason/history and a currently eligible destination Employee; no automatic substitute or SYS_ADMIN action authority.

Operation keys and expected versions protect uncertain-response retries and stale clients. Same-key same-body retry returns the committed result after current authorization checks; changed replay conflicts. Serialize dispatch/receipt quantities and stock dimensions consistently. Database guards retain Company/Project/material/UOM identity, approval lineage, immutable events/evidence and exact stock-source effects. Documents' owning and generic aliases must share the same receipt scope.

English/Thai/Traditional Chinese UI must distinguish approval, dispatch, partial/full receipt, outstanding quantities, exceptions and legacy history. A posted legacy transfer is not proof of a new physical acknowledgment. Show only eligible actions and destination-safe facts; backend enforcement remains the security boundary.

## Observable technical exits

| ID | Required outcome |
|---|---|
| TR-AC01 | Origin Store → independent Khaimook → dispatch → eligible destination receipt retains separate actual actor/time/history. |
| TR-AC02 | Approval creates zero stock effect; dispatch deducts once; only actual accepted receipt credits destination. Reservation contention and insufficient source stock fail safely. |
| TR-AC03 | Partial quantities/evidence and derived outstanding state reconcile; overreceipt and silent shortage/damage completion are denied. |
| TR-AC04 | Destination Store or explicitly assigned active destination Employee can receive; source-only, inactive/unlinked, wrong Company/Project and implicit technical-admin actions are denied. |
| TR-AC05 | Destination-only projections and owning/generic Document aliases reveal only authorized receipt facts and exact evidence bytes. |
| TR-AC06 | Same-key retry, changed replay, stale version, concurrent receipt/dispatch and source/grant/evidence drift preserve one-time effects and history. |
| TR-AC07 | Established correction/reversal paths preserve stock/reservations and original events; partial/unreceived custody cannot be fabricated as returned stock. |
| TR-AC08 | Forward-only migration preserves all historical transfers, paired effects, grants, protected files and completed material/FM03/receiving records. |
| TR-AC09 | Registered disposable PostgreSQL/authenticated HTTP/real-browser and populated separate restored-runtime proof covers the changed lifecycle and denials. |
| TR-AC10 | Applicable exact-head push/PR CI, stable independent DEC-022 review, guarded merge/tree equality, exact-main, then separately reviewed preserved-data Mac deployment. |

Implement one coherent domain/API/UI/test/contract package after the predecessor and entry gates. A green local test, published entry or implemented slice does not close all112 requirements or whole milestones4/6. Prototype4/8 and GL3/10 remain until their actual exits. Retained MKE/TCJ activation, cross-Company #245, new Accounting #288, payroll, emergency bypass and Production remain separately gated.
