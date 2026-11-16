# Transfer dispatch and destination receipt — implementation candidate

17 November 2026 SGT. Implements the approved [DEC-046 entry](OP-TRANSFER-RECEIPT-01-ENTRY.md), SS10 / the transfer part of PM07, [#352](https://github.com/threeswordz/cinder-grind/issues/352). Entry #355 is integrated at bf1b0d84, exact-main43870018232 SUCCESS. Candidate starts from main a8dad66fbcef22079060efe0105225e29260a411, exact-main43899632473 SUCCESS. The current session is sole writer of `vproto-transfer-receipt-20261117`.

## Delivered candidate behavior

New transfers in explicitly enabled synthetic source Projects retain the canonical transfer and independent configured approval. Approval moves no stock. Origin dispatch rechecks current available stock and reservations, deducts exactly once and records the actual actor/time/reason. Destination acknowledgment credits only actual accepted quantities. Partial receipts leave the remainder unavailable and visible; no automatic receipt, write-off, Finance posting or return to origin is inferred.

Legacy transfers keep their existing paired posting, immutable history and exact reversal identity. No transfer is backfilled into the new custody model. The additive schema adds eight policy/provenance/event/receipt/assignment/replay models and one nullable receipt-line stock-source link. Partial indexes preserve legacy movement uniqueness while allowing independently sourced receipt installments. All migrations are forward-only; later integrity corrections retain each earlier exercised checksum. Posted receipt lines are bound to their original posting transaction so a committed acknowledgment cannot acquire new lines later.

Destination-only users receive a bounded projection of their destination lines, quantities, receipt facts and protected receipt Documents. They gain no origin Project access, source remarks, commercial data or approval authority. The owning Document target and generic Project aliases share current session/active Employee/Company/Project/capability checks and byte integrity checks. Evidence bindings and posted history cannot be rewritten.

Configured destination Store capability permits ordinary receipt. An absent-Store substitute additionally needs the narrow assigned-receipt capability, an explicit latest Khaimook assignment, active same-Company Employee, active destination membership and pre-existing Document authority. Assignment creates no role or permission grant. Eligibility is rechecked when receiving; reassignment preserves prior receipts and assignment history. UI selectors show eligible Employee names within the destination Project.

Origin approval, dispatch, assignment, receipt preparation and receipt confirmation have retained provenance. New commands bind operation keys to their canonical request, current authorization and expected custody version. Same-body retries preserve one result; changed replays and stale clients fail closed. Approval never reserves stock: availability consumed before dispatch blocks dispatch safely.

The existing canonical reversal is available only after all dispatched quantities are received. It reverses every exact original OUT and partial IN movement, checks destination availability/reservations, retains receipt/evidence history and cannot fabricate a return of outstanding goods. No new cancellation, shortage resolution, cross-Company ownership or financial correction policy is introduced.

The English/Thai/Traditional Chinese destination inbox supports scoped delivery selection, partial quantities, canonical evidence upload/download and stable uncertain-response retries. Origin controls distinguish approval from actual dispatch and preserve legacy labels. No role switcher or retained grants are added.

## Evidence and remaining gates

| Acceptance | Evidence / boundary |
| --- | --- |
| TR-AC01–03 | Actual PostgreSQL17.11/authenticated HTTP covers independent approval, zero approval effect, dispatch5, partial receipt4, outstanding1, remainder1, duplicate/changed retries, overreceipt denial and exact completed reversal. |
| TR-AC04–05 | Actual HTTP covers destination-only source-detail denial, explicit assignment, revoked membership/session denial, canonical multipart evidence and owning/generic source protection; native browser also requires those boundaries. |
| TR-AC06 | Actual HTTP includes simultaneous same-key receipt, changed-body conflict, current membership/session checks and insufficient-stock dispatch denial. Normal CI and independent review remain required for the complete concurrency/security boundary. |
| TR-AC07–08 | Actual HTTP preserves legacy paired posting/reversal and refuses partial reversal. Exact historical-table/catalog/schema contracts extend existing upgrade rehearsals; no old migration or old stock row is rewritten. |
| TR-AC09 | Registered HTTP test, new native Chromium journey and separate populated DB/Documents/restored-application recovery are mandatory. Local Chromium is blocked by workspace Unix-socket permissions; no local browser PASS is claimed. CI recovery and native execution are pending. |
| TR-AC10 | Exact-head push/PR CI, stable independent DEC-022 review, guarded merge/tree equality and exact-main remain pending. A separately reviewed post-receiving preserved-data Mac operator is a later deployment package. |

The local affected schema/contract suite and HTTP evidence do not certify GitHub CI, Mac deployment or milestone closure. A broader local API run passed370/373; three historical SGD/NULL-currency checks require the genuine previous-release fixture owned by `validate-isolated.mjs`, which was not constructed by that local invocation. Their assertions remain unchanged and must pass in the standard CI harness. Web tests62/62 and both workspace typechecks pass. Prototype remains4/8 (1/2/3/5 complete), GL3/10. Milestone4 still requires all112 dispositions and required gap delivery;6 requires actual integrated deployed journeys;7 requires final populated DB/Documents/external-HR-key recovery;8 requires technical audit/freeze. Human UAT is DEFERRED TO PRE-PRODUCTION PROTOTYPE under DEC-042. Retained MKE/TCJ activation, Accounting #288, payroll, #245, financial valuation/write-off and Production remain separately gated.

## Receiving Mac handoff

The earlier receiving/security script's `EXACT_MAIN_CI_NOT_GREEN` blocker is cleared: its exact pinned main a8dad66f and run43899632473 are unchanged and SUCCESS. That earlier attempt stopped before creating its receiving stage or changing the populated target. One first actual Mac receiving execution is still required; do not replay completed material/FM03 operators or retry a partially created receiving stage. This transfer candidate is not permission to run it on that Mac or to skip the receiving predecessor receipt.
