# Material UOM Stage B — canonical stock source integration

**19 November 2026 SGT — implementation IN PROGRESS, draft [#376](https://github.com/threeswordz/cinder-grind/pull/376).** Approved DEC-050 / [#354](https://github.com/threeswordz/cinder-grind/issues/354); Stage A and DEC-051 predecessor main72ec4127/exact-main44455291178 SUCCESS48/48. Earlier alternative #375 is closed unmerged with its branch preserved; do not combine its stock-projection columns with this implementation's normalized canonical ledger.

## Implemented draft boundaries

- Immutable, source-bound entered quantity/UOM, normalized stock quantity/UOM, explicit business date and exact revision/factors for GR, reservations, issues and controlled transfers. Canonical StockTransaction remains the only stock ledger. Commercial PO/GR units, quantities, ceilings and Finance remain owned by their current source.
- Normalized reservation availability/locks; approved reserved/unreserved issues; original-provenance partial returns and exact reversals; canonical physical counts; zero-effect transfer approval, origin deduction on dispatch and actual partial destination receipt.
- Explicit **internal** `activateStock` creates one immutable Company/material activation receipt with current maintainer/Employee/session authority, expected basis version, reason and replay identity. No migration activates a material or grants permissions. Current authorized reads report the persisted active state truthfully.
- SQL independently rejects foreign-unit historical effects even when their net balance is zero; unfinished reservations/receipts/issues/returns/counts/transfers/physical deliveries and unreconciled plan/request history block activation. Source writers share the definition/activation lock; activation is serializable. Activated materials reject unpinned new GR/issue/transfer effects and active reservations. Original same-basis legacy corrections retain their existing exact source guards.
- Prepared definitions alone stay inactive. No public activation route is exposed. Existing internal dated-source test paths are development evidence, not a complete user-operable B journey.

## Validation and known recovery correction

The converted transfer alias defect at c56d821d is reproduced and fixed. Its full PR44545926195 passed workspace, all actual browser gates through material plan, then failed migration rehearsal: the recovery witness asserted that B tables were empty **after** a converted transfer fixture deliberately created seven pins. This was a proof-order defect, not evidence of migration backfill.

The candidate now checks all exact new B tables for emptiness immediately after migration and historical verification, **before** intentional native fixture writes. A separate protect/restore witness hashes populated stock/source/activation/grant rows, verifies exact triggers and denies fabricated effect pins. It requires the earlier pristine receipt. Historical pre-existing table equality and exact schema classifiers stay strict; no assertion or CI gate is waived.

Registered native activation tests cover current actor/Company denial, concurrent identical replay, immutability, stale version, revoked-right retry, unfinished sources, net-zero foreign-unit history, refused unpinned GR/reservation, dated canonical posting and original reversal. Latest execution evidence belongs in #376; authored tests are not a claim of full CI success.

## Remaining B exit

1. Complete public dated GR/reservation inputs and automatic activated source selection for issue/transfer; preserve explicit source dates and reject absent dates before effects. Mixed activated/inactive documents must preserve each source's correct owner and dimension.
2. Prove pre-PO custody → independent evidence check → canonical converted GR with good/damaged quantity separation through authenticated APIs; complete SQL bypass, revocation, multi-material lock and concurrent activation/source tests.
3. Full exact-head PR, stable independent DEC-022 review, guarded integration/tree equality and full exact-main. No early Stage C runtime work or merge of an incomplete B stage.

Stage C owns converted plan/BOQ-compatible limits, requests/fulfillment, reports and complete trilingual operational UI/assurance. No retained material activation, Mac mutation, historical normalization, monetary conversion, mandatory paid dependency or Production authority.

Actual Mac subcontract execution remains separately pending in #353. Completed material/FM03/receiving/transfer operators must not be replayed. Prototype4/8, GL3/10; consolidated human UAT remains deferred under DEC-042 until technical freeze.
