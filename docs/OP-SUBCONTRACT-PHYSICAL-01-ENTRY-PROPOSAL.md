# Subcontract physical acceptance — entry proposal

17 November 2026 SGT. **PREPARATION ONLY; PA-D01 below needs an Owner decision before runtime/schema implementation.** Parent [#353](https://github.com/threeswordz/cinder-grind/issues/353); requirement IDs BEN-BASE-03, PM12 and PORN-SUB-01. Preserve [#288](https://github.com/threeswordz/cinder-grind/issues/288) Accounting deferral and DEC-042 frozen-prototype human UAT. Transfer #352/#359 remains the current implementation lane; this proposal changes no runtime, grants, schema, money or deployment.

## Settled responsibilities and canonical mapping

Khaimook captures actual work by item/location, quantities or milestone/lump-sum basis, progress and protected photos/documents. Ben independently decides physical acceptance or rework. Porn prepares the canonical certification; Nancy retains existing financial approval/payment authority. Do not ask these principal actors again or hard-code names into access checks.

| Canonical record | Proposed extension | Boundary preserved |
|---|---|---|
| SubcontractClaim / ClaimLine | Versioned physical observations attached to the same claim lines: item, work location, quantity/UOM or explicit milestone/lump-sum basis, progress/reason and protected evidence | Existing agreement, Work Order, period, claimed amount, number and replacement lineage |
| Physical submission | Freeze the exact observations and evidence digest; retain maker, submission actor/time and version | No mutable approved history or parallel claim/cost ledger |
| Ben physical decision | Explicit per-line accepted/rework/rejected facts against that frozen source; reason and independent actor/time | Physical quantity is distinct from claimed, assessed and certified money |
| SubcontractClaimAssessment | Retain the canonical explicit assessed amount and monetary ceiling; reference the eligible physical decision | No automatic quantity-times-price, inferred rates, automatic payable or new financial posting |
| SubcontractCertification | Porn references both canonical Assessment and exact eligible physical source | Certified gross remains nonnegative and no greater than retained assessed amount; existing approval, retention and payment rules remain |
| Claim Documents | Reuse SUBCONTRACT_CLAIM protected source, bytes/checksum and Company/Project access | Upload alone is not physical acceptance; owning and generic aliases enforce current rights |

Historical monetary assessments/certifications retain their exact behavior and provenance. New physical enforcement requires explicit audited enablement for new synthetic claims only; no backfill of invented physical facts. Real MKE/TCJ activation remains separately authorized.

## Concrete policy decision — PA-D01, partial acceptance

Example: a submitted claim contains ten measured units. Ben accepts eight; two need rework. Existing code accepts one explicit monetary Assessment per claim and permits certification up to that amount. It has no physical acceptance record, per-accepted-line monetary allocation or automatic later settlement for the other two units. Therefore an implementation must not guess whether the accepted eight can proceed to certification.

| Choice | Effect in the example | Consequence |
|---|---|---|
| A — Recommended: accepted work may proceed; rework stays held | Ben explicitly confirms the accepted eight and the monetary amount attributable only to eligible accepted work; Porn certifies within that amount. The two unaccepted units contribute no automatic payable. | Entry design must retain rejected/rework quantities and their later claim/replacement lineage without duplicate acceptance or value. No automatic rate or proportional amount is inferred. |
| B — Hold the entire claim | No assessment/certification for this controlled claim until its submitted physical scope is accepted through the retained correction path. | Simpler eligibility boundary, but the accepted eight cannot be certified while the other two remain in rework. |

**Owner input needed:** select A or B and authorize that bounded physical-to-certification treatment. This is an eligibility policy, not a request to repeat the settled Khaimook/Ben/Porn/Nancy route. Scope of later same-period rework claims, if required, must preserve the existing one-active-claim/period and certification-reversal rules; a selection does not silently authorize duplicate claims or automatic cumulative value. The final entry must make that source lineage concrete before coding.

## Fixed engineering requirements

- Preserve the modular monolith, PostgreSQL/Prisma, canonical Claim/Assessment/Certification, existing locks/replay/Document storage and zero mandatory new paid dependency.
- Use active same-Company Employee, current scoped Project membership/access and explicit action capabilities. SYS_ADMIN and read authority imply no business decision authority. Physical maker/submission actor cannot approve their own physical submission.
- Measured work retains explicit quantity/UOM and work location; lump-sum/milestone work retains its basis, progress and reason. No fabricated measurable quantity or universal rounding tolerance.
- Submission and decision bind exact versions and immutable evidence checksums. Evidence or observations changed after submission require a new controlled source version; stale approval or certification fails closed.
- Rework/rejection/correction retains submitted and decided observations. Existing approved/reversed certification history follows its canonical reversal and linked replacement path, never in-place rewriting.
- Serialize decisions, evidence changes, monetary assessment, certification and replacement using the existing claim/agreement ownership. Same request replay is stable; changed replays, concurrent over-allocation and revoked authority are denied.
- English/Thai/Traditional Chinese screens show physical acceptance separately from monetary assessment/certification and expose actionable rework reasons without leaking unauthorized commercial values.
- No new payment execution, AP/AR, tax/GL, valuation/write-off, payroll or multi-Project Finance implementation. No retained configuration, silent scope exclusion or Production authority.

## Acceptance and delivery exits

| ID | Required observable proof |
|---|---|
| PA-AC01 | Actual authenticated Khaimook capture/evidence → independent Ben physical decision → Porn canonical certification journey |
| PA-AC02 | Measured and milestone/lump-sum sources retain their basis and exact observations; physical and monetary facts remain distinct |
| PA-AC03 | Missing, stale, rejected or otherwise ineligible physical sources cannot certify; PA-D01's selected partial/rework rule is demonstrated explicitly |
| PA-AC04 | Active Employee/Company/Project/action rights and both protected Document aliases hold on reads, writes and retries |
| PA-AC05 | Maker/self-approval, wrong-role, technical-admin, inactive/detached Employee and revoked-session attempts fail |
| PA-AC06 | Same-key replay, changed-body conflict and simultaneous decision/replacement/certification preserve source lineage and one-time effects |
| PA-AC07 | Existing claimed/assessed/certified ceilings, agreement/Work Order/period rules, retention and financial history are preserved |
| PA-AC08 | Additive migration, historical byte preservation, real trilingual browser and separate populated DB/Documents/restored-application evidence pass |

After PA-D01 and entry/predecessor gates: deliver one coherent implementation/API/UI/evidence increment, complete applicable exact-head push/PR CI, stable independent DEC-022 review, guarded integration/tree equality and exact-main CI. Prepare a separately reviewed populated-target operator and observe its actual execution before claiming milestone6 coverage. Full integrated recovery7 and technical audit/freeze8 remain separate; human UAT follows freeze. No milestone or GL category is closed by this proposal.

## Source verification

Verified against main a8dad66f and the unchanged subcontract source in transfer candidate d32b97f6:

- [Khaimook PM12](ROLE-REQUIREMENTS-2026-10-30/03-khaimook.md#pm12--physical-work-and-certification-handoff), [Ben acceptance](ROLE-REQUIREMENTS-2026-10-30/01-ben.md#ben-base-03--subcontract-physical-work-acceptance), [Porn certification](ROLE-REQUIREMENTS-2026-10-30/07-porn.md#porn-sub-01--subcontract-certification-preparation).
- `apps/api/src/subcontracts/subcontracts-claims.service.ts`: assessClaim records one explicit assessedAmount at or below claimTotal; rejection is constrained by retained certification history; active agreement/period and linked replacement rules remain.
- `apps/api/src/subcontracts/subcontracts-certification.service.ts`: createCertification rechecks eligible Claim/Assessment under claim/agreement locks; certifiedGross cannot exceed assessedAmount; approved/reversed history requires canonical correction.
- [#353](https://github.com/threeswordz/cinder-grind/issues/353) owns the original preparation and PA-AC01–08. This proposal explains the outstanding policy consequence; it is not an approved decision or an implementation receipt.
