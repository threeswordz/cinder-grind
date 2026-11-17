# Subcontract physical acceptance and partial certification — approved entry

**Owner approved — 17 November 2026 SGT, PA-D01 option A.** The Owner replied **“authorise A”** after reviewing the [concrete proposal](OP-SUBCONTRACT-PHYSICAL-01-ENTRY-PROPOSAL.md). [Durable approval record](https://github.com/threeswordz/cinder-grind/issues/353#issuecomment-6936231129), DEC-048, [#353](https://github.com/threeswordz/cinder-grind/issues/353); stable requirements BEN-BASE-03 / PM12 / PORN-SUB-01. This records approved scope and acceptance, not working code or human acceptance.

## Authorized outcome and responsibilities

Khaimook captures actual work by item/location, measured quantity/UOM or explicit milestone/lump-sum basis, progress, reasons and protected photos/documents. Ben independently accepts work or records rework/rejection against the exact submitted source. **Accepted work may proceed to certification at an explicitly confirmed amount attributable only to that accepted work; unaccepted/rework work stays held.** Porn prepares the canonical certification; Nancy retains the existing financial approval/payment boundary. Principal actors and option A are settled; do not ask again.

Example: ten measured units submitted, eight accepted and two for rework. Ben explicitly confirms the eligible accepted amount. Porn may certify no more than that confirmed canonical assessed amount. The other two create no payable, automatic payment, inferred price, eight-tenths proration or automatic future settlement. A wholly rejected/rework-only source is ineligible. Zero-value accepted work does not become a fabricated positive amount.

## Canonical data and monetary binding

Extend the existing Claim/ClaimLine through attached physical facts and immutable submission/decision history; retain the same claim number, Company/Project/agreement/period, Work Order link and replacement lineage. There is no parallel claim, cost balance, payment or stock ledger. Eight original role functions, fixed login roles, canonical Project/WBS/Activity and independent Cost Code remain.

| Boundary | Exact contract |
|---|---|
| Claim draft | Record item/work description, location/area, explicit basis, measured quantity/UOM when measurable, progress/reason and canonical Claim Document references; retain the separate original commercial amount. |
| Submit | Bind the exact Claim/line version, physical observations and protected evidence IDs/checksums to an immutable submitted source. Subsequent correction cannot rewrite that submission. |
| Independent physical decision | Retain per-line accepted and held/rework/rejected facts, actor/time/reason and exact submission identity. Accepted measured quantities cannot exceed submitted quantities. Milestone/lump-sum acceptance retains its stated basis and reason rather than an invented unit quantity. |
| Accepted monetary allocation | Ben explicitly confirms monetary allocations attributable only to eligible accepted work. Each allocation is nonnegative and within its canonical ClaimLine amount; their exact Decimal sum is the eligible canonical assessed amount. No universal quantity-to-price formula is inferred. |
| Canonical Assessment | Its amount must match that explicit eligible accepted sum for controlled claims. Physical decision and monetary assessment remain distinct retained facts linked atomically under the existing Claim/agreement ownership; no legacy assess endpoint or direct SQL path may bypass source eligibility. |
| Porn certification | Reference the exact active canonical Assessment and accepted physical source. Existing certifiedGross range, agreement/Work Order ceilings, retention, approval and payment rules remain. Recheck eligibility during creation, changes, submission and approval, including retries. |
| Held work | Keep outstanding quantity/basis/reason and originating physical observation visible. Acceptance of another part never silently completes or pays the held portion. |

Use current UOM/quantity and monetary precision with Decimal arithmetic. A representation that exceeds the existing allowed precision must be refused rather than rounded silently. This package does not implement material conversion or invent a subcontract measurement tolerance.

## Rework and correction lineage

The existing one-active-Claim/agreement/period rule and canonical correction paths remain. Before certification exists, use retained submission/rejection/replacement history as applicable; an accepted monetary source cannot be edited into a different physical result. Once certification history controls a correction, follow its existing reversal and linked replacement requirements. Do not introduce an unlinked second claim for the same period to pay the held remainder.

Where a later otherwise eligible canonical claim records completion of held work, it must explicitly reference the original held observation. Under the existing agreement/claim locks, prevent consuming the same held quantity/basis twice and retain the previous accepted portion. Prior/current/cumulative commercial values continue to derive from the canonical non-replaced sources; a replacement and its predecessor cannot both contribute effective acceptance or value. A current acceptance decision supplies its own explicit amount; earlier rates, claimed values or held quantities do not become an automatic payable.

Any correction requiring a policy beyond these existing period/reversal/source rules must be surfaced as a concrete exception, not enabled by resetting dates, deleting history, manufacturing duplicate claims or bypassing certification ownership.

## Scope, security and compatibility

- New enforcement is explicitly enabled and audited for new synthetic claims only. Preserve all historical monetary claims/assessments/certifications and Document bytes; no invented physical backfill, default role grant or retained MKE/TCJ activation.
- Reuse scoped canonical Claim Documents and storage, byte integrity checks, ordinary owning/generic aliases and active same-Company Employee/Project/action rights. Evidence changed after submission cannot inherit the old decision. File upload alone is not acceptance.
- Maker/submission actor cannot approve the same physical source. SYS_ADMIN, read authority and Porn's certification rights grant no Ben decision authority. Configuration is separate from business approval; literal personnel names are never authorization logic.
- Serialize source changes, evidence binding, decisions, assessment, rework consumption, certification and replacement through existing canonical ownership/locks. Stable same-body replay returns one result; changed-body replay, stale source/version, revoked session/grants, concurrent duplicate acceptance and cross-Company/Project references fail closed.
- English/Thai/Traditional Chinese UI presents submitted, accepted and held work and its explicit money separately; show actionable rework reasons, protected evidence and immutable history within the viewer's commercial scope.
- No new AP/AR/payment execution, bank/GL/tax/payroll, financial disposal/write-off, cross-Project #245 or intercompany functionality. Existing #288 Accounting deferral remains; the bounded physical-to-existing-certification gate is the only extension here. No mandatory paid service or dependency.

## Acceptance criteria

| ID | Required observable proof |
|---|---|
| PA-AC01 | Real authenticated Khaimook capture/evidence → independent Ben physical/explicit monetary decision → Porn canonical certification, retaining Nancy's existing financial boundary |
| PA-AC02 | Measured and milestone/lump-sum observations retain basis/location/progress/reason; physical quantities and claimed/assessed/certified money remain distinguishable |
| PA-AC03 | Ten submitted/eight accepted/two held permits only the explicitly confirmed accepted amount to certify; wholly rework/rejected, missing, stale or changed-evidence sources cannot certify |
| PA-AC04 | Active Employee/Company/Project/action rights and both protected Document aliases hold on reads, writes and retries; commercial/private values remain scoped |
| PA-AC05 | Maker self-approval, wrong role, implicit technical admin, inactive/detached Employee and revoked-session attempts fail |
| PA-AC06 | Same-key replay, changed-body conflict and concurrent decision/evidence/replacement/rework/certification preserve exact source lineage, no duplicate quantity/value and one-time effects |
| PA-AC07 | Canonical agreement/Work Order/claim-period/assessment/certification ceilings, retention, reversal/replacement and financial history remain intact; old assessments remain valid under their historical provenance |
| PA-AC08 | Additive migration preserves all historical rows/grants/files; registered actual PostgreSQL/HTTP/trilingual browser and separately populated DB/Documents/restored-application evidence cover accepted and held work |

## Dependency and release gates

The current sole Builder owns execution. Read-only preparation and Owner-decision publication may proceed while transfer #359 finishes; successor runtime/schema work waits for transfer's applicable CI, final independent DEC-022 review, guarded integration/tree equality and exact-main success, plus this approved entry's normal publication/CI/integration/main gates. The selected A requires no repeated scope question after those gates.

Deliver a coherent implementation/API/UI/contract/evidence package. Authorization, schema, immutable history, monetary eligibility and concurrency require stable independent DEC-022 review after applicable exact-head push/PR CI. Guard integration by expected head, verify reviewed/integrated tree equality and successful exact-main CI. A separately reviewed populated-target operator and actual deployment journey remain required for milestone6. Preserve completed startup/actor/material/FM03/receiving receipts; repeat affected paths only where a material change or required release gate warrants it.

Milestone4 still requires all112 dispositions and required gap delivery; milestone6 all agreed deployed journeys; milestone7 final separate populated DB/Documents/external-HR-key recovery; milestone8 technical audit/freeze. Human UAT remains DEFERRED TO PRE-PRODUCTION PROTOTYPE under DEC-042. No prototype/GL category or human acceptance is closed by entry publication, and Production remains separately unauthorized.

## Verified source

The [historical proposal](OP-SUBCONTRACT-PHYSICAL-01-ENTRY-PROPOSAL.md) retains the concrete code comparison at a8dad66f / transfer d32b97f6. Canonical owners remain `subcontracts-claims.service.ts`, `subcontracts-certification.service.ts`, existing claim/agreement workflow services and protected Document services. [#353](https://github.com/threeswordz/cinder-grind/issues/353) owns the approval, delivery and evidence; dated preparation does not override this approved option-A contract.

## Predecessor readback — 17 November 2026 SGT

The Owner's actual populated Mac receiving success is recorded in [#347 receipt6943389339](https://github.com/threeswordz/cinder-grind/issues/347#issuecomment-6943389339). Transfer #359 integrated as1addb385 with exact candidate-tree equality; exact-main44051022363 remains pending. This entry is forward-reconciled with that integrated predecessor, retaining the same six-document scope and PA-D01 option A. No runtime/schema/permission change or repeated Owner decision is introduced. Predecessor main-green and this entry's exact-head push/PR, guarded integration/tree equality and exact-main remain required before subcontract runtime.
