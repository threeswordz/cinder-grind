# OP-MATERIAL-REQUEST-01 implementation and assurance

**Authority:** [approved entry](OP-MATERIAL-REQUEST-01-ENTRY.md), DEC-043, FM04/SS07/partial SS08 and [#313](https://github.com/threeswordz/cinder-grind/issues/313). Entry #314 merged as `3a5ae8a92083a2bd03f4159b1e84d0565e7e78ec`; exact-main CI41405779758 SUCCESS. This feature is UNDER VALIDATION until its actual PR/review/merge/main receipts are recorded in #313. Human UAT remains DEFERRED TO PRE-PRODUCTION PROTOTYPE (DEC-042).

## Delivered candidate boundary

Store captures a scoped Foreman request with one to one hundred material lines, existing UOM and optional existing WBS/Cost Code/Activity dimensions. Quantities and notes may be revised with reasons and pinned versions; original request/line context and immutable snapshots remain traceable. New lines/context are not silently substituted into referenced history. The UI offers active material default units; the API also validates an existing posted warehouse/material/UOM dimension. Full SS08 Cost BOQ/work type/building/floor/work-area modeling remains separate.

Explicit request capabilities are view/create/edit/link/acknowledge. The controller enforces authentication, CSRF for writes, capability requirements and strict input allowlists; the service re-reads live session/user/role permissions and persisted Project access, including before replay. New definitions grant no retained roles. `projects.access_all` is assignment scope only, and SYS_ADMIN has no implicit request or receipt authority.

Only **posted, non-reversed** canonical MaterialIssue lines may be newly linked. One source issue line has at most one request association; multiple distinct source lines can fulfill one request line. Current issued amounts derive from canonical quantities/states, so an unposted/rejected source contributes zero and reversal removes its current contribution. Original links and receipt history remain. Requests do not reserve stock or create PR/PO/Finance/stock movements. Existing returns remain their own source behavior, not a new request-owned net inventory ledger.

Signed paper/photo/PDF/scan evidence uses canonical Documents with a MATERIAL_REQUEST source and matching Project. Uploading a file does not acknowledge receipt. Recording an acknowledgment explicitly identifies actual receiver/issuer/time, requires signed-evidence confirmation and pins the Document checksum. Where a canonical issue identifies a recipient, the receipt must identify that recipient. Subsequent receipt corrections append a new record pointing to the latest prior receipt; the original cannot be replaced/deleted. Original Document identity, file metadata/bytes identity and source links become immutable after acknowledgment; existing archive state remains an explicit canonical Document lifecycle fact. Signed imagery is not a cryptographic digital signature.

The request API shows current requested/issued/acknowledged quantities separately and retains historical receipt facts even after reversal. Over-fulfillment is displayed truthfully without inventing an issue limit or changing approval/posting policy. Record/actor IDs and public Project-operational names are not HR identity/bank data. Source issue details require issue view; evidence identifiers/checksums require Documents view. Generic Project/target paths enforce the request source, including mixed inaccessible Project links; HR-private and commercial restrictions remain.

## API and persistence

All routes are under `/inventory/material-requests`: projects, scoped paged choices/lists/detail, issue choices, capture, reasoned revisions, issue links and receipts. Every write has a durable actor/Company/action-scoped request key and body digest. Same-body retries return the original command result even when a later version exists; changed-body reuse conflicts. Request locks and pinned expected versions serialize competing edits/links/receipts. Lost-response UI retries retain the original action/payload/key; background revalidation never silently upgrades a pending action's expected version.

The forward-only migration adds six request/line/revision/link/receipt/operation tables and five permission definitions, with no retained grant and no stock source column. Scoped foreign keys/guards, positive four-place quantities, append-only records, immutable signed evidence, exact snapshot/replay evidence and unique source links protect direct database paths. No previous executed migration is edited. The canonical Document-link guard is carried forward unchanged except for one explicitly owned request target branch.

## Registered technical evidence

| Criterion | Candidate evidence and boundary |
|---|---|
| MR-AC-01 | Registered HTTP/database suite: real session/CSRF/permission denial, Store capture, no Foreman PR/issue/count grant, SYS_ADMIN denial. Actual retained role configuration remains unverified. |
| MR-AC-02 | Existing canonical physical-count stock seed and independently approved issue 6 then 4; exact linked totals, no effect from capture/link/retry and unposted source denied. |
| MR-AC-03 | Same-key concurrent capture/revision replay, changed body and stale version conflicts, immutable original facts; browser committed-response-loss recovery and stale-background-version controls. Native PostgreSQL concurrency proof remains separate from supplemental PGlite execution. |
| MR-AC-04 | Wrong warehouse/requester and Company/body/dates/quantity cases, unassigned actor and forged access-all denial; canonical source checks and mixed inaccessible Project evidence rejection. |
| MR-AC-05 | Upload alone leaves acknowledgment zero; explicit actual actors/confirmation, same-key receipt retry, immutable Document/checksum/link/receipt, append-only correction and byte-equal authorized download. |
| MR-AC-06 | Canonical issue reversal changes current fulfillment and retains signed original/corrected receipt history. |
| MR-AC-07 | API test command, real Chromium synthetic-transport fixture, inherited web/release regressions, exact six-model/catalog/history contract, all existing predecessor rehearsals plus exact entry-main upgrade, populated DB+signed-file restored HTTP proof; actual final CI/Codex/merge/main receipts stay in #313. |
| MR-AC-08 | One full integrated prototype human UAT remains deferred; no historical THB/BOQ UAT repetition, retained activation or Production inference. |

Local supplemental development checks use TypeScript5.9.3 and disposable PGlite18.6 with synthetic records/files. PGlite's single-engine multiplexer is **not** PostgreSQL17.11 concurrency/recovery evidence. The host has only uid0 mapped and no native PostgreSQL/container engine; native PostgreSQL17.11, actual binary restore and CI-provided Chromium are mandatory GitHub gates. The local browser download was unavailable; no local browser PASS is claimed. No PGlite/browser helper package is added to ERP dependencies or required at runtime.

Exact-main historical releases remain accepted. Accounting/payroll, approved-plan immediate issue, emergency limits, financial write-off, cross-Company stock transfer, #245, real grants/data/host and Production remain outside this increment. This candidate does not complete every material-plan requirement or close GL-04–10.
