# OP-MATERIAL-PLAN-01 A — plan foundation

Bounded implementation under DEC-044, #318 and [entry contract](OP-MATERIAL-PLAN-01-ENTRY.md). Entry #319 merged at `34e022d5807d3e16458437a02ebba669ba838c6a`; exact-main41450868013 SUCCESS. The current Work session is sole writer of `v1-material-plan-a-foundation-20261102`.

## Behavior and ownership

The candidate adds four Company/Project-owned tables: plan identity, reasoned revision, source/material/UOM lines and immutable action replay/evidence. An approved Cost BOQ quantity basis is pinned. API inputs use exact positive four-place decimal strings and reject unknown fields, invalid dates, scope mismatches and stale versions. Decisions require current explicit grants and an actor independent of original maker, revision maker and submitter; SYS_ADMIN grants no business shortcut. Five permission definitions are added without role grants. Identity administration rejects plan action configurations missing plan view and source quantity access.

Ten guarded routes provide selectors, quantity-only list/detail/history and create/revise/submit/approve/reject. Current persisted sessions/grants and Project access are checked before reads, mutations and replay; write routes require CSRF. Explicit projections exclude monetary BOQ fields. Durable actor/action/request keys bind canonical input, return small action receipts and reject changed-body reuse. Deterministic advisory locks and bounded serializable retries protect revisions and cumulative approved source allocations across work packages/windows and Cost BOQ bases.

PostgreSQL guards seal even Draft lines after their initial operation, preserve all revisions/decisions, enforce independent decisions, source quantity/mapping caps and require complete immutable operation snapshots at commit. Revisions replace their own prior allocation while other plans' latest approved allocations remain counted. Historical source remapping is denied. A rejected replacement leaves the prior approved version available. Rejecting a stale inactive source remains possible.

## Criteria and validation

| Entry criterion | Foundation coverage / limit |
|---|---|
| MP-AC-01–03 | Scoped basis/line validation, cross-plan cap, current rights and independent decisions registered in actual PostgreSQL/HTTP tests. |
| MP-AC-04 | Append-only reasoned revisions, prior approved history and stale version checks. Consumption/reduction guards depend on B; no full criterion completion claimed. |
| MP-AC-05–06 | Concurrency, same-key replay, changed body, revoked grants, quantity-only selectors/detail/history and paginated revision history tests. |
| MP-AC-07–12 | B pending; no enforcement enablement, direct issue, overage or consumption behavior in A. |
| MP-AC-13/15 | Existing suites preserved. Exact four-model/schema/catalog/empty-history contract; five predecessor rehearsals including exact entry main; populated plan revisions preserved by paired dump/restore with authenticated restored-runtime reads/denials. Native CI required. |
| MP-AC-14/16 | C UI/browser assurance pending; human UAT DEFERRED TO PRE-PRODUCTION PROTOTYPE. |

Local API compilation, input validation,35 source-route probes (zero anomalies) and67 release-contract tests pass. The original112-ID requirement census remains unchanged. Local host Node24.22.1 differs from native pinned24.21.0; native CI uses the pinned version. This workspace's root-only user namespace prevents normal non-root PostgreSQL startup; database/HTTP/migration/upgrade/recovery tests have **not** been locally executed. Disposable native CI is the required runtime evidence. No extra runtime dependency or database package is added to the repository.

At publication, exact-head push/PR CI and stable-candidate independent DEC-022 review remain pending. Do not merge or begin B until all gates and exact-main CI pass. Live PR/#318 receipts own final SHA/run/review evidence; this candidate document does not assert unobserved results.

## Explicit limits

No canonical stock/Finance/approval source is replaced. This increment creates no issues, stock transactions, material requests, financial postings, Project policy enablement or real-user grants. Source BOQ commercial privacy, HR privacy, existing signed Material Request receipt ownership and accepted historical UAT remain. Retained MKE/TCJ access/activation, new Accounting, payroll, #245, emergency bypass, transfers/write-off and Production are outside this increment. Administrator-controlled main branch protection remains an unresolved real GL-07 gap.
