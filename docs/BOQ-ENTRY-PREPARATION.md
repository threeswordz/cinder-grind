# BOQ successor — implementation entry preparation

**Date:** 2026-10-28 SGT · **Tracker:** [#266](https://github.com/threeswordz/cinder-grind/issues/266) · **Scope:** [BOQ Disclosure and Linked Customer BOQ Versions](BOQ-COMMERCIAL-SCOPE.md), BUD-011–016 / BQC-AC-001–014.

**Position: entry preparation IN PROGRESS; feature coding NOT STARTED.** The owner instructed “proceed building with your recommendation” after the recommendation BOQ first, HR next in stages, with HR documentation preparation during BOQ delivery. This authorizes progressing that sequence, not inventing the pricing/mapping answers explicitly left open in DEC-034/#266. Sections 4–5 below are a concrete **PROPOSAL requiring owner decision**, not implemented or approved business behavior. No successor release number is assigned yet.

## 1. Verified predecessor, authority and writer

- Live starting main: `b8bfd798967d61d9d312f790db5912fb572ce851`; [exact-main CI40666561990](https://github.com/threeswordz/cinder-grind/actions/runs/40666561990) SUCCESS. [#246](https://github.com/threeswordz/cinder-grind/issues/246) CLOSED / COMPLETED; V1.2 UAT and separate release exit ACCEPTED under DEC-036. That predecessor gate is satisfied. Never reopen its completed tests.
- No open PRs at the entry check. This work uses a fresh isolated documentation branch; no existing implementation branch is modified. Chat remains the normal Builder under DEC-016. This preparation does not claim another session has been stopped merely because no PR is open; confirm the single writer when activating implementation.
- DEC-008/016/022/029/030/033/034/036 remain applicable. Modular monolith, PostgreSQL/Prisma, Project → WBS → Activity and independent Cost Code remain. No paid dependency, grant/configuration, retained database, migration, Production or business-record change.
- Entry is not COMPLETE until the necessary business inputs are decided, canonical entry documents are reconciled, and the applicable documentation PR/CI/review/merge/exact-main gates pass. Runtime changes wait for that gate.

## 2. Carry forward decisions already made

The [2026-10-25 owner selections](https://github.com/threeswordz/cinder-grind/issues/266#issuecomment-6398077094) resolve these points; do not ask for them again:

| Topic | Recorded decision |
|---|---|
| Nancy | Full working and approved Internal Cost BOQs in authorized Projects; Customer BOQ approval. No inferred cross-Company access, Internal edit/approval or self-approval. |
| Porn | New BOQ-related Finance view exposes authorized Project-level contract/billed/paid totals only; no customer line quantities/prices, source-cost breakdown, margins or WBS/line filters. Existing Finance-document authority remains separately governed. Totals can permit inference on a single-item job. |
| Pricing methods | Manual customer rates and percentage markup; target gross margin deferred. No actual rate or percentage has been selected. |
| Precision and revisions | Quantity/rate up to four decimal places; half-up two-decimal line amounts; totals sum stored rounded lines. Approved changes require a newly approved revision; preserve internal cost precision and immutable history. |
| Approval functions | Ben prepares/submits both; Khaimook approves Internal Cost; Nancy approves Customer. Persisted Company-scoped permissions and workflow actors, never literal names. |

## 3. Remaining source-example gap

The existing [owner-selection receipt](https://github.com/threeswordz/cinder-grind/issues/266#issuecomment-6398077094) explicitly leaves representative mapping and calculation edges unresolved. The synthetic examples below complete a concrete proposal for adoption or correction; they are not actual owner prices, an assertion that an owner fixture exists, or completed ERP acceptance evidence. No private HR document or owner workbook content is included in this publication. No new Mac transactions or repeated V1.2 tests are requested.

## 4. Proposed completion of the open mapping/calculation contract

**All choices in this section remain PROPOSED.** They make the missing business decision reviewable instead of asking the owner to generate new ERP transactions or repeat UAT. They neither narrow nor expand the approved scope until explicitly accepted and recorded.

| ID | Proposed rule | Reason / boundary |
|---|---|---|
| C1 — Source and mapping | Maker selects one approved, verified-THB Internal Budget revision per Customer version; every priced customer line retains selected revision-line IDs. Customer quantity/UOM are independently entered. Different-UOM/L/S, split and roll-up links require an explicit mapping rationale; no automatic conversion. | Stable source basis, reproducibility and Company/Project isolation. A later cost revision never changes an approved customer version. One source revision per version is a proposed simplification, not an existing restriction. |
| C2 — Split/roll-up basis | Each mapping states an explicit share of its selected source line's stored approved amount, with at most four decimal percentage places, greater than 0 and at most 100%. Across customer lines in that version, shares for a source line must total at most 100%; unused cost coverage is allowed and visible to authorized cost reviewers. Roll-ups sum the explicitly allocated source amounts without intermediate monetary rounding. | Prevent accidental duplicated source cost. Shares allocate a commercial pricing basis only; they do not post or reallocate Actual/Paid, create quantity conversions or promise physical-progress coverage. |
| C3 — Markup and derived rate | Markup is nonnegative with at most four decimal percentage places. Cost basis = sum(source stored amount × allocation percentage ÷ 100). Derived rate = basis × (1 + markup ÷ 100) ÷ customer quantity, rounded half-up to four decimals. Line amount = customer quantity × that stored final rate, rounded half-up to two decimals. Preserve inputs, exact basis, stored rate and result. | Explicitly adopts a rate-first result, which can differ from rounding a target total. Existing internal amount precision remains unchanged. No target-gross-margin method. |
| C4 — Quantities and zero lines | Quantity must be positive and obey the selected UOM's supported decimal precision, capped at four places. Final rate must be nonnegative, up to four places. Zero-priced included/free lines require an explicit reason and normal approval; blank rate is never zero. A zero-cost markup line requires the same explicit zero-price reason or a manual rate. | Fractional quantities are allowed only for a compatible UOM; no zero-quantity division or implicit free line. |
| C5 — Discounts | In Draft, an explicit final manual rate plus reason represents a discounted/negotiated price; keep prior calculation/rationale in audit. No separate percentage-discount engine, negative line, tax/VAT or silent override. Approved changes use a new Customer revision and normal approval. | Reuses the already selected manual-rate method and keeps price history truthful. |

Once approved, implementation must reject unsupported mappings or missing rationale rather than guess. A cost source excluded for foreign/NULL provenance cannot be made eligible by copying numeric amounts or relabelling it THB.

## 5. Concrete examples for the decision

**All quantities, rates, cost amounts, markup and shares below are synthetic decision examples, not owner workbook content, actual prices or ERP PASS claims.** No new Mac data or owner UAT exercise is requested. These become the representative business examples only if the owner explicitly adopts them and C1–C5.

| Example | Proposed inputs | Expected result under C1–C5 |
|---|---|---|
| E1 — Same UOM | Selected approved source: 10 EA at synthetic cost100; stored source amount1,000; 100% share. Customer10 EA, markup20%. | Basis1,000; final rate120.0000; line1,200.00 THB. Manual rate120 gives the same line result. |
| E2 — Independent L/S quantity / roll-up | Two source amounts1,000 and500 with different original UOMs; each allocated100%; customer1 L/S, markup20%, explicit rationale. | Basis1,500; rate1,800.0000; amount1,800.00. Original quantities/UOM remain retained; no dimensional conversion is claimed. |
| E3 — Split coverage | One source amount1,000, allocated60% and40% to two customer lines; customer quantities6 and4, markup20%. | Bases600/400; rate120.0000 each; amounts720.00/480.00; total1,200.00. A further share from that source exceeding100% is rejected within this version. |
| E4 — Derived-rate rounding | Basis100, customer quantity3, markup0%. | Stored rate33.3333; line100.00. Preserve the rate-first rule rather than assert the unrounded rate was stored. |
| E5 — Rate-first discrepancy | Basis1, customer quantity300, markup0%. | Rate0.0033; line0.99, not1.00. Show the difference to the maker before submission; approval accepts the stored-rate result. This business choice is explicitly awaiting owner approval. |
| E6 — Fractional / half-up | UOM permits four decimal quantity places; manual quantity0.1250, rate10.0400. | Exact product1.25500000; line1.26. If that UOM only permits integers, reject the quantity instead. |
| E7 — Zero / missing | Quantity1, rate0 with an included/free-line reason. | Amount0.00, normal approval. Reject the same line with missing reason, missing rate, zero quantity or negative price. |
| E8 — Discount | Draft quantity10; former rate120; explicit negotiated manual rate115 with reason. | Line1,150.00; retain price-change audit. No approved version is edited in place. |

Python Decimal independently checks the proposed arithmetic during preparation. This is not ERP runtime, browser or BQC acceptance evidence. The Builder must later encode approved examples as meaningful isolated regressions.

## 6. Source-verified implementation obligations

Inspected at the starting main above; these are future implementation contracts, not findings of unauthorized access by a current user.

| Surface | Verified starting behavior | Required treatment / acceptance |
|---|---|---|
| [SessionService](../apps/api/src/auth/session.service.ts), [AuthorizationService](../apps/api/src/authorization/authorization.service.ts), [ProjectAccessService](../apps/api/src/projects/project-access.service.ts) | Session resolves the union of active-role permission codes; Company/active Employee/Project membership derive scope; all-project capability remains Company-bound. | Compute effective disclosure/action capabilities on the server; client role names/modes cannot grant them. Test combined-role escalation and inactive memberships. Keep approval and commercial access separate. BQC-AC-001/002/005/010. |
| [Budget controller](../apps/api/src/budget/budget.controller.ts), [service](../apps/api/src/budget/budget.service.ts) | Separate BOQ/revision permissions guard routes; current BOQ includes item rates/amounts; revision detail/approved/summary expose historical source and money. Mutations can return those reads. | Explicit Quantity Only response projection on every applicable read and mutation response; authorization before returning data. Preserve original/current semantics and approved-zero versus missing. No broad grants to make tests pass. BQC-AC-001/003/004/008/010. |
| [Schema](../apps/api/prisma/schema.prisma) | Cost item/revision quantity/rate Decimal(18,4), amount Decimal(20,4); immutable revision-line identities and source references available. | Reuse these cost records. Add only reviewed Customer version/line/mapping/replay persistence and constraints necessary for approved behavior; no edits to old migrations or approved snapshots. BQC-AC-004/006/007/008/011/012. |
| [Documents source policy](../apps/api/src/documents/document-source-permissions.ts), [generic Documents](../apps/api/src/documents/documents.service.ts), [target paths](../apps/api/src/documents/document-targets.service.ts) | Shared source permission map protects current sources; there is no new Customer BOQ source contract yet. | Cover metadata, list/search, bytes, alternate links and multi-source documents. Financial attachments are not safe Quantity Only documents because a UI link is hidden. Do not silently classify arbitrary old files as sanitized. BQC-AC-003/010. |
| [Cost Control](../apps/api/src/cost-control/cost-control.controller.ts), [Management](../apps/api/src/management/management.controller.ts), [Project](../apps/api/src/projects/projects.controller.ts) | Independent permissions and existing financial fields/reports apply. | Trace every affected source/aggregate/CSV/print/drilldown and reconcile combined grants against the new disclosure contract. Porn's approved Project totals are not permission for customer line data. Preserve existing Finance authority and canonical recognition. BQC-AC-002/003/009/010. |
| [BudgetPanel](../apps/web/src/budget/BudgetPanel.tsx), [AdminConsole](../apps/web/src/AdminConsole.tsx) | Budget keys include Project but not a future disclosure capability; AdminConsole logout resets current-user queries. These observations alone do not prove a reachable cross-user leak. | Verify root cache lifecycle as well as these components; prevent prior identity/Company/disclosure payload reuse and already-loaded display after permission changes. UI/API denial and real-browser tests must agree. BQC-AC-003/010/014. |
| [Schema classifier](../deploy/release-candidate/schema-contract.mjs), [workflow](../.github/workflows/validate.yml) | Existing bounded classifier accepts only the DEC-033 provenance/default delta or unchanged schema. Current CI has isolated upgrade/recovery/runtime gates. | Define and review a separate narrow Customer BOQ schema contract against actual previous accepted main; keep fail-closed unrelated-schema, strict paired nonempty bytes and compatible runtime proof. Do not remove old guards. BQC-AC-012/013. |

Private retained role assignments and Approval Matrix rows have not been inspected or changed. Automated disposable role fixtures can prove policy behavior without asking the owner to mutate Mac configuration. Before any future activation, reconcile actual persisted grants explicitly; a seed file or persona label is not attestation of live effective access.

## 7. Delivery after entry closes

1. Record the owner decision on C1–C5/E1–E8 (or the exact requested alternatives), update scope/requirements/acceptance and this entry status, publish through normal entry gates, then assign successor coordination label. Preserve scope approval and all prior owner choices.
2. Builder verifies exact green main and sole implementation writer, then delivers one coherent package in reviewable increments: scoped disclosure and source contracts; Customer versions/mappings/calculation/approval/history; affected consumers/documents/cache/exports/locales; integrated integrity/upgrade/recovery evidence.
3. During implementation, Chat + CI provide continuous focused review. Run Codex once at the stable green candidate under DEC-022; batch genuine findings and re-review only when warranted. Normal PR/merge/exact-main gates remain.
4. Successor human review is limited to the new affected BOQ behavior, with separate UAT acceptance and release exit. Do not restart completed V1.2 scenarios or require another Mac recovery/fixture exercise.
5. HR documentation preparation may proceed during BOQ delivery; HR feature coding follows this BOQ package and its gates. Private HR materials are not included in this PR. Advanced costing, customer quotation/progress billing, payroll, #245 and Production remain outside this package.

**Owner decision still needed:** approval or corrections to the concrete C1–C5/E1–E8 mapping/calculation contract. No repeat BOQ-package approval, THB approval or completed V1.2 UAT is requested. Production remains NOT AUTHORIZED.
