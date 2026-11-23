# M4 parallel coordinator — confirmed source triage (24 Nov 2026 SGT)

**Status:** read-only code inspection / actionable gap handoff; no runtime implementation, CI, retained-account proof, DEC-022 review or Owner acceptance. Refer to [parallel sprint #428](https://github.com/threeswordz/cinder-grind/issues/428).

## Exact source boundary

- Inspected source on consolidated M4 Draft PR #427 **`680bca5767652522ef08f72d4df97b6df2732fca`**. Draft #425 is only the prior integrated base; neither is merged into protected main.
- Four isolated worker branches were created at the exact same source SHA. Parallel worker implementation must not edit another worker's branch or central #427 directly.
- Observations here describe source, not a verified business journey in retained MKE/TCJ.
- Official counters remain prototype 4/8, GL 3/10, M4 technical 20/32, formally accepted M4 0/8; provisional remaining effort 117h M4, 1,847h full ERP (53h was forecast calibration, not timesheets or accepted work).

## SS11: existing equipment Project assignment is not personal loan custody

Inspected:
- `apps/api/src/equipment/equipment.service.ts`
- `apps/api/src/equipment/equipment.controller.ts`
- `apps/api/src/inventory/M4-STORE-PARALLEL-2026-11-24.md`
- `docs/M4-2026-11-24-112-DISPOSITION.csv`, SS11 row.

The current Equipment API already supports register, types, Project assignments/releases, Project equipment listing and usage. `EquipmentService.assign()` creates/ends *Project* assignments. `release()` closes a Project assignment by date. No equivalent checked-out-to-person **borrower/due date/condition/return** workflow was found in these inspected service/controller routes. Equipment Project reassignment must not be repurposed as tool return without explicit source/backward-compatibility proof.

**Important permission test:** `listEquipment()` first reads the Company's equipment list and then maps visible assignment Project records; an inaccessible Project can be represented as `restrictedProject: true`. Verify exact role/permission behavior and whether company-wide equipment fields should be exposed to site-only Storekeeper. Do not assert an information leak without showing actual authorized role contract and response. New custody endpoints must avoid foreign Project/Company metadata and must deny stale/revoked sessions and disabled employee.

SS11 work needs canonical CG##### asset identity, explicit employee/subcontract borrower source, project/site, issue/expected return, actual return/condition, concurrency and immutable audit. Jai asset master ownership, Nancy depreciation GL06 and any late/penalty policy remain distinct. Avoid adding invented charges, finance postings, cross-Company transfer or granting equipment master permissions to Store merely to enable loans.

## SS14/PM15: current source clearly marks remaining alert categories as absent

Inspected:
- `apps/api/src/inventory/stock-minimum.service.ts`
- `apps/api/src/procurement/purchase-order.service.ts` top-level `LineUpdate`
- SS14 / PM15 rows in current 112-ID CSV.

`StockMinimumService.read()` already calculates per-site `available = onHand - reserved` against configured policy, including stale-UOM suppression. It is **advisory only** and does not book future receipts or provisional custody.
`StockMinimumService.planStarts()` already renders latest approved plan revision, `validFrom` window 14/7/0 in Thailand calendar, without inventing daily demand. The response explicitly sets `dayByDayDemandScheduleIncluded: false`, `supplierDueOrLateIndicatorsIncluded: false`, `stockEffect:false` and `financeEffect:false`.

A current Purchasing `LineUpdate` type carries distinct `requiredOnSite` and `expectedDelivery` optional dates. These are promising *source candidates*, not sufficient proof of supplier commitment, receipt completion, rescheduling, PO-approved revision or available stock. Confirm canonical persisted fields and approval/status semantics before using them; missing dates should produce 'unknown' not fabricated 14/7 supplier alerts. Reconcile PO lineage with actual accepted GR quantities; never credit unreceived or damaged goods. Preserve Company/Project/site bounds and pagination.

## Exact test/review handoff

- Lane A build one bounded SS11 personal custody journey and new native negative tests; do not rerun older Equipment assignment acceptance.
- Lane B build supplier due/late/reschedule advisory read only if canonical dates/quantities genuinely exist; retain `planStarts()` semantics.
- Lane C authenticate eight-role source-affected UI/HTTP paths on disposable environment; retained named MKE/TCJ access is separately authorized. Do not claim manual DEC-042 UAT.
- Lane D reconcile exactly 112 IDs and eight M4 packages; distinguish bounded technical, source pending proof, operational target proof, functional gap, Owner policy and future HR/Accounting/#245.
- Release coordinator freeze complete protected-main-to-candidate diff, obtain independent DEC-022, then request fresh Owner #384 authority for mandatory full CI/Ready/merge/M4 signoff. No full CI for branch or docs-only work.

**No tests run for this triage.** Newly confirmed source mismatch and explicit response flags are not package exits, logged engineering hours or revised residual-hour estimates.
