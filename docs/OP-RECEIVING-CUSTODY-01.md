# Receiving custody, evidence and canonical GR handoff

Owner-approved successor [#347](https://github.com/threeswordz/cinder-grind/issues/347), DEC-045, implements SS04–06 / PM06 / PUR09 within the original112-ID scope. Store records physical delivery and evidence; Jai checks documents/quantities; the configured Khaimook function approves the existing GR. No principal policy answer is reopened.

Pre-PO goods are held outside usable stock until linked to a valid approved PO **and** posted by the canonical Khaimook-approved GR. The approved-PO link is due48elapsed hours after original physical receipt, including overdue receipts entered late. Revisions and replacement records cannot extend that original deadline. Expiry changes no approval, stock, budget or financial record. No emergency/early-use path exists.

## Canonical boundary

`ReceivingDelivery` records physical custody; its quantities are not a second stock ledger. `GoodsReceipt` and `StockTransaction` remain the sole stock source. Typed custody lines retain observed and good quantities plus shortage/excess/wrong/damaged reasons; only good quantities can map to matching material/UOM lines of the current approved PO. Held/unaccepted differences remain explicit, without supplier-return/credit/write-off accounting. Existing masters and same-UOM mappings are used; master creation and mixed-UOM conversion retain their separate112-ID gaps.

Each new controlled delivery retains a delivery note, receiver name/signature evidence, condition photos and a quality result when marked required. Evidence uses canonical scoped Documents and immutable checksums; a paper/photo acknowledgment is not a cryptographic signature. Jai's independent check is versioned. A physical correction/evidence/PO change invalidates that check. A delivery already attached to a GR cannot silently change its source quantities. Unposted rejected/draft sources may be voided with a reason and retained history; replacement capture references the voided source and inherits its original receipt/deadline. Posted corrections use the canonical GR reversal, never deletion/reset.

New explicit capabilities have no automatic role grants. Project custody enforcement is enabled explicitly for authorized **non-Production synthetic** technical execution only, with an immutable audited policy record; no retained MKE/TCJ activation is implied. Activation refuses pending legacy GR drafts so they are not silently backfilled or grandfathered into a bypass. After activation, every new GR must reference a checked delivery. Existing posted/reversed receipts and all historical stock/Finance/HR/Documents remain unchanged. The application remains generic by Company/Project and effective permissions, without hard-coded user names.

All reads and writes require a live session, active same-Company Employee and current effective role rights; projects.access_all bypasses assignment filtering only. Receiving Documents enforce that same prerequisite through owning-target and generic aliases. Writes additionally use persisted Project access, operation keys, expected versions and serializable transactions. Source dimensions, PO/grant/evidence integrity, custody state/history and canonical GR posting are also constrained in PostgreSQL. Technical administrators gain no capture/check/approval rights implicitly.

## Observable exits

| ID | Required technical outcome |
|---|---|
| RC-AC01 | Scoped physical capture without PO creates no available stock, reservation, plan consumption, AP or financial effect. |
| RC-AC02 | Original receipt timestamp and48h due time survive revisions, late linkage and replacement; due/overdue/linked-late are distinct. |
| RC-AC03 | Delivery note, actual receiver/signature and condition-photo evidence are required for independent check; conditional quality evidence is enforced. |
| RC-AC04 | Only a current approved same-Company/Project/vendor PO and matching material/UOM mappings can be linked; held/bad quantities cannot post. |
| RC-AC05 | Store capture → independent Jai document check → existing configured Khaimook GR approval; no self-check or technical-admin business bypass. |
| RC-AC06 | Custody-bound GR uses canonical approval, cumulative PO limits, exactly-once stock posting and reversal; no parallel ledger. |
| RC-AC07 | Replays, stale versions, concurrent commands and source/evidence/grant drift fail safely without duplicate effects or lost history. |
| RC-AC08 | Company/Project/actor/active-Employee/session/CSRF and protected-document denials hold server-side, with bounded privacy-safe API projections. |
| RC-AC09 | Real trilingual responsive capture/link/evidence/check/GR navigation, including reopening the same GR after tab unmount, uncertainty retries and stale-draft refusal. |
| RC-AC10 | Additive predecessor migration preserves every prior row/grant/file; populated custody and evidence survive separate restore with authenticated readback/denials. |
| RC-AC11 | Exact-head applicable CI, independent stable DEC-022 review, guarded integration/tree equality and exact-main CI. |
| RC-AC12 | Separate reviewed post-FM03 populated Mac deployment/journey; comprehensive human UAT deferred to the frozen prototype. |

One coherent implementation/test/UI/release-evidence PR delivers this outcome. Local/disposable evidence and actual Mac results remain distinct. No new Accounting #288, supplier-credit accounting, cross-Company stock ownership, payroll/#245, paid dependencies, retained grants/imports or Production. FM03/startup/actor/material runs stay closed. Prototype4/8 and GL3/10 until actual broader milestone exits are met.
