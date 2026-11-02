# OP-MATERIAL-PLAN-01 — bounded synthetic prototype entry

**Authority:** #318, DEC-044 and the [Owner continuation receipt](https://github.com/threeswordz/cinder-grind/issues/318#issuecomment-6577545946), proceeding with the published [D1–D5 contract](https://github.com/threeswordz/cinder-grind/issues/318#issuecomment-6577344012). The receipt quotes the Owner's actual instruction; it is not a claim that the Owner separately quoted each numeric rule. This is the recommended **synthetic prototype** contract, not real MKE/TCJ activation or a Production authority limit.

## Predecessor, scope and ownership

Entry source main `715423ec324656545a2b28e8434e12a02d07de13`, exact-main [41443532945](https://github.com/threeswordz/cinder-grind/actions/runs/41443532945) SUCCESS, zero open PRs. #317 source assurance is integrated after clean independent review. This Work session is the exclusive execution writer of branches it creates; no competing writer was observed. Requirements: **PM01, PM07, SS-PLAN-01**, preserving FM04/SS07/SS08 and the original112-ID assessment. No assertion that this completes all of those broad requirements.

The documentation-only entry must complete exact-head push/PR CI, guarded merge and exact-main CI before runtime/schema work. Each following technical increment must complete its predecessor gates. Pending human UAT is deferred under DEC-042; it is not an interim development gate.

## D1 — approved plan basis

- Store Site prepares a Company/Project-owned plan; Khaimook is the independent plan checker through explicit configured capabilities/eligible workflow, never a hard-coded name check or SYS_ADMIN shortcut.
- Pin an approved Cost BOQ revision and explicit source-line/material/UOM quantity mapping. A monetary BOQ value or a Material Request is not automatically a material allowance. Only approved source quantities are eligible; reject wrong Company/Project, inactive/mismatched material/UOM or ambiguous mappings.
- Allowance scope is one Company, Project, warehouse, work package and validity interval. Same-UOM quantities only; four decimal places, positive finite quantities. No conversion engine, shared warehouse pool or overlapping independent allowance that would multiply the same source quantity.
- A plan version allocates a bounded portion of its mapped approved source quantity. Multiple allocations must not exceed the source quantity merely because they use different work packages/windows. Revisions preserve allocation lineage; no duplicate source budget or silent source remapping.
- Store receives authorized quantity-only projections. Existing BOQ commercial/cost disclosure, HR privacy and source ownership remain unchanged.

## D2 — consumption and physical availability

- Consumption is derived from canonical posted, non-reversed issue quantities linked to the approved allowance lineage, minus canonical posted, non-reversed returns against effective source issues. Unposted/rejected/draft requests or returns contribute zero.
- A canonical issue reversal removes that issue's effective consumption once. A return against that reversed source must not credit it again; cumulative return credit cannot exceed the effective source quantity. Preserve canonical return/reversal prerequisites rather than bypassing them.
- Reservations continue to control physical stock availability. They do not separately consume plan usage before issue posting. Request capture, evidence upload, signed acknowledgment and plan approval alone never post stock.
- At final posting, recheck the plan version, eligibility/window, allowance, current effective approvals and physical availability in one atomic transaction. Lock allocation/plan lineage and stock/reservation dimensions in deterministic order; protect concurrent combined overconsumption. Durable operation keys and bounded serialization retries must not duplicate effects.

## D3 — direct issue and beyond-plan authority

- In explicitly enabled synthetic prototype Projects, within-plan Store issue recording/posting requires its explicit action capability and valid approved plan, **without a separate issue approval**. Use the canonical posting operation; do not fabricate a Khaimook/Ben approval or call an approver endpoint as the maker.
- Temporary prototype Khaimook independent overage allowance is **zero**: every beyond-plan quantity requires Khaimook review then Ben approval using configured eligible independent actors. No delegate, emergency shortcut, spending ceiling or self-approval exception is introduced.
- Block absent/unmatched/no-plan issues in enabled scope. Hold an entire mixed-line batch until every line is eligible or carries the necessary approvals; no partial stock posting or silent split. Recheck the actual approved payload/version at posting.
- Enforcement starts only for new issues in explicitly enabled disposable synthetic Projects. No automatic enablement, real role grant, retained user mutation or historical backfill. Other Projects retain their existing MATERIAL_ISSUE workflow. Retained activation needs its separate authority and readback.

## D4 — versioned changes

Store prepares a reasoned new revision and Khaimook reapproves it. Retain prior approved versions, mappings, decisions and issue links. Consumption and source allocations carry across revisions of one lineage; a revision cannot reset usage. Reject reductions below effective consumed quantity. Pin in-flight decisions to their approved version; once a replacement becomes effective, stale unposted decisions must be re-evaluated and receive fresh applicable overage approvals. Never retroactively relabel posted issue decisions.

## D5 — prototype scope and exclusions

Include this bounded plan/issue control before prototype freeze. Keep BEN02 emergency bypass, transfers (including cross-Company), loss/disposal/write-off, financial posting, new Accounting, payroll/later HR and #245 outside the package. Preserve existing historical workflows and accepted THB/BOQ UAT. No paid runtime, external identity platform or new stock ledger. Actual host activation, retained Company/Project enablement, grants/data and Production remain separately unauthorized.

## Technical increments and gates

| Increment | Bounded delivery | Predecessor / exit |
|---|---|---|
| Entry | This scope, decisions, permission/data/API contract and acceptance map | Documentation exact-head push/PR CI, guarded merge, exact-main SUCCESS |
| A — plan foundation | Forward-only plan/revision/lineage/source mapping and immutable decision/replay storage; scoped quantity-only API; create/revise/submit/independent approve/reject; no stock posting changes or Project enforcement activation | Entry complete; registered database/HTTP/negative/concurrency/migration/upgrade/recovery tests, bounded schema contract and independent stable-candidate Codex review; guarded merge/exact-main SUCCESS |
| B — canonical issue integration | Explicit synthetic enablement; exact plan/version issue links, direct within-plan path, Khaimook→Ben overage, canonical atomic allowance/stock posting and return/reversal derivation | A complete; final-post/race/replay/history/stock/Finance-unchanged evidence, independent review and exact CI/merge/main |
| C — integrated UI and closure | Responsive EN/TH/Traditional Chinese plan/issue UI with cache/revocation protection, existing request/receipt links, real Chromium gates, populated predecessor and restored-runtime evidence, consolidated criteria/freeze disposition | B complete; applicable full CI, independent material review, guarded integration and exact-main; human UAT remains deferred |

Do not mark A as within-plan direct-issue delivery, B as a completed user workflow, or C as full human acceptance. DEC-030 favors coherent code/test/docs inside each increment; no repetitive status-only PR is required. Technical boundaries may be combined only if their existing predecessor gates permit it.

## Permission and data/API contract

- Define separate `inventory.material_plan.view`, `.create`, `.revise`, `.submit`, `.approve` and, for B, explicitly distinct issue-post/overage-review/overage-approve and prototype-enable capabilities. Actions depend on view and applicable existing source rights; do not grant these capabilities to real roles automatically. Names alone never establish eligibility. Final exact names/dependencies must be included in each bounded migration/catalog contract and tests.
- Use existing Company, Project, Warehouse, Material, UOM, BudgetRevision/Line, User, Approval and canonical Inventory sources. Persist plan identities, immutable approved revisions/mappings/decision history, allowance lineage and durable replay; no authoritative duplicated consumption balance. Persist final issue authorization provenance without changing historical stock records.
- Each list, selector, detail, history and action verifies current persisted session/action grants and Company/Project access. AuthGuard, PermissionGuard and CSRF on writes; strict UUID/date/quantity/version/unknown-field checks and explicit DTO projections. Unauthorized callers must not obtain source values through selectors, replay, aliases or generic Documents.
- Use additive Prisma/PostgreSQL migrations and database integrity/history guards. Schema rehearsal must explicitly admit only the new package; never weaken THB/BOQ/HR/count/request predecessor or historical table/catalog checks.

## Acceptance criteria

| ID | Observable technical / deferred evidence |
|---|---|
| MP-AC-01 | Store creates scoped plan; correct source quantities only; same-UOM positive finite lines; wrong Company/Project/warehouse/material/source/version denies. |
| MP-AC-02 | Source allocation is bounded across work packages/windows and revisions; no duplicate mapping, overlapping allowance multiplication or silent remapping. |
| MP-AC-03 | Independent eligible Khaimook function approves/rejects submitted version; maker/self/admin/unauthorized/revoked roles deny. |
| MP-AC-04 | Reasoned append-only revisions preserve prior approved mappings/decisions, carry consumption and block reductions below consumption; stale expected versions deny. |
| MP-AC-05 | Durable same-key/body replay returns one committed result after lost response; changed body, racing revisions and unauthorized replay deny. |
| MP-AC-06 | Quantity-only projections preserve BOQ commercial/cost restrictions and HR privacy across list/detail/selectors/history/aliases/cache changes. |
| MP-AC-07 | Only explicitly enabled synthetic Projects use the new policy; no automatic real grants/enablement or historical rewrite; non-enabled Projects retain existing behavior. |
| MP-AC-08 | Within-plan Store posting has no separate approval and produces one canonical stock effect; availability, expiry, plan version and current rights are rechecked at posting. |
| MP-AC-09 | Every beyond-plan quantity requires Khaimook then Ben with zero independent prototype overage authority; no delegate/self-approval/emergency bypass or fabricated approval. |
| MP-AC-10 | Missing/unmatched/no-plan and mixed ineligible batch block atomically; no hidden split, partial stock effect or request/receipt-as-approval shortcut. |
| MP-AC-11 | Concurrent combined usage cannot overconsume allowance; deterministic plan/stock/reservation locks, safe serialization/retry and duplicate posting protection. |
| MP-AC-12 | Canonical posted returns/reversals derive net consumption exactly once; no excess credit, draft return credit, double reversal credit or source history change. |
| MP-AC-13 | Stock, reservation, request/receipt, Procurement/BOQ/HR and Finance regressions remain intact; no financial write-off/posting or parallel quantity source. |
| MP-AC-14 | Registered EN/TH/Traditional Chinese UI/API/browser authorization/cache/retry/history paths; distinguish synthetic transport from actual authenticated runtime evidence. |
| MP-AC-15 | Fresh migration, actual predecessor upgrade, preserved tables/catalogs/history and populated paired DB/Documents/external-HR-key restored compatible runtime; exact-head push/PR, clean independent review, guarded merge and exact-main CI. |
| MP-AC-16 | Full human workflow/usability/business acceptance DEFERRED TO FROZEN PRE-PRODUCTION PROTOTYPE under DEC-042; no technical self-acceptance, repeated historical THB/BOQ UAT or Production authorization. |

Criteria1–6 and the applicable foundation parts of13/15 apply to A;7–13 to B;14–16 and consolidated prior criteria to C. Keep every criterion visible if only one increment is complete. No full package or real GL gate closes merely from an entry document or foundation migration.
