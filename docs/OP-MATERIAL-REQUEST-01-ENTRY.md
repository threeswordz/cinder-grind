# OP-MATERIAL-REQUEST-01 — approved request and receipt entry contract

**Authority:** Product / Business Owner approved the bounded [#313](https://github.com/threeswordz/cinder-grind/issues/313) proposal, including the signed paper/photo/scanned receipt method, and authorized implementation on 2 November 2026 SGT. [Approval receipt](https://github.com/threeswordz/cinder-grind/issues/313#issuecomment-6571177864); DEC-043. This entry publication must pass normal exact-head push/PR, governed merge and exact-main CI before runtime/schema implementation begins. It does not activate retained users, grants, data or Production.

## Predecessor and sole writer

Verified source main `62831dde1f99f9fd3890341b7dba6520f52a0e96`, exact-main [41372388076](https://github.com/threeswordz/cinder-grind/actions/runs/41372388076) SUCCESS, zero open PRs at entry. Stock Count, Weekly Reporting, HR1-A and approved offline readiness preparations are integrated. The current Chat is the sole Builder / Release Coordinator for this slice. Independent Codex review remains separate. No repeat scope approval is required after entry; pending human UAT is deferred under DEC-042.

## Requirements and bounded behavior

Trace to **FM04 / SS07 and part of SS08**, without changing the original 112-ID source assessment or claiming full approved-plan/material-dimension completion.

1. Store Site records a Foreman's oral/chat request for an authorized Company, Project and warehouse, with requester, request date, material, UOM, positive requested quantity and relevant existing WBS/Cost Code/Activity dimensions. Existing employees need not have ERP logins. Server-side Company/Project/employee/material/UOM validation is mandatory.
2. Retain actor/time and reasoned request revisions. Link request lines to canonical existing MaterialIssue lines; link operations never create or approve an issue. One issued line cannot be counted twice through duplicate links. Partial deliveries may link several distinct issue lines to one request line. Quantities come from canonical sources, not another editable fulfillment ledger.
3. Derive issued quantities only from linked **posted, non-reversed** MaterialIssues. Draft, rejected or unposted issues contribute zero. Reversal changes the derived current fulfillment while retaining original links/history/receipt evidence. Present requested, issued and acknowledged facts separately. Expose an over-fulfilled amount truthfully if canonical sources exceed a request; do not invent a new issue limit, stock posting or approval rule.
4. Capture actual recipient, issuer and receipt time with explicitly recorded acknowledgment and authorized canonical Document evidence containing signed paper/photo/scan. An uploaded file or issue approval alone does not acknowledge receipt. A file image is not a cryptographic digital signature. Retain original evidence identity/checksum and actor/time; corrections append reasoned history rather than overwriting a past acknowledgment. No automatic or invented historical signature/backfill.
5. Preserve all existing MaterialIssue submission, maker/checker, approval, stock posting, reservation, return and reversal behavior. Requests, links, revisions and receipts have **zero stock/reservation/Actual Cost/Paid Cost/PR/PO side effects**.
6. Provide authorized responsive EN/TH/Traditional Chinese UI with safe request/issue/document navigation, durable retries, expected-version conflicts and explicit permission/context cache invalidation. No paid runtime service or new mandatory dependency.

## Permission and catalog contract

Use explicit action capabilities in the existing inventory module: `inventory.material_request.view`, `.create`, `.edit`, `.link`, `.acknowledge`. Mutating capabilities depend on request view; linking additionally requires existing `inventory.issue.view`; evidence upload/download also requires the existing Documents capability and owning-source authority. New permission definitions never grant a real role or user automatically.

Intended business configuration is Store Site request/receipt recording, independently authorized scoped viewers, and no Foreman PR-maker, issue-approval or stock-posting escalation. Role names are not the security boundary. Every list, choice, direct ID, history, link, receipt and document operation requires the current session Company, persisted Project access and explicit action rights. `projects.access_all` bypasses only assignment filtering; SYS_ADMIN gains no business authority. Real role grants/approval steps remain a separately authorized GL-04 task.

Add the request workspace to the existing inventory navigation/catalog only when its view capability is present. Existing issue navigation remains subject to its own permission. Receipt evidence must not become visible through generic Project/Document/source aliases to an actor lacking request authority, including mixed links and wrong Company/Project. Preserve all HR-private and commercial document restrictions.

## Forward-only relational and API contract

- Add the minimum canonical request header/lines, reasoned append-only revisions/events, unique issue-line associations, explicit receipt records/evidence references and durable operation replay. Reuse Company/Project/Warehouse/Employee/Material/UOM/User, canonical MaterialIssue/Item and Document identities. No parallel stock ledger or employee register.
- Enforce scoped ownership through foreign keys and database guards, positive finite four-place quantities, valid dates/actors, optimistic versions and append-only evidence/history. Preserve referenced request line identity and original context; reasoned revisions must not silently retarget linked issue/evidence history.
- Replay keys are Company/actor/operation scoped. Identical body/key retries return the same durable result; changed-body reuse conflicts. Authorize before replay; serialize competing revisions/links/receipts and retain the committed outcome after lost responses. No duplicate stock effect or history deletion.
- Use existing AuthGuard, CSRF, PermissionGuard, strict unknown-field/UUID/date/quantity validation and safe errors. Never trust Company/Project/actor labels supplied by the browser. Existing source services own issue and Document lifecycle; use explicit DTO allowlists rather than Prisma relation dumps.
- Fresh migration and previous-main upgrade/recovery must preserve existing records/ledgers/currency/history and support populated receipt Documents in paired recovery. New schema must have a separately bounded release-candidate contract; do not relax existing THB/BOQ/HR strict rehearsal contracts to accommodate it.

## Acceptance criteria

| ID | Required observable evidence |
|---|---|
| MR-AC-01 | Store records a Foreman-originated request; no new Foreman PR/issue approval/stock authority; wrong-site actors deny. |
| MR-AC-02 | Request 10, post linked issue 6 then 4: requested and derived issued amounts reconcile without duplicate posting; unposted issues contribute zero. |
| MR-AC-03 | Same-body capture/revision/link/receipt retries produce one durable outcome; changed-key-body reuse and competing expected versions conflict safely with retained history. |
| MR-AC-04 | Wrong Company/Project/warehouse/requester/recipient/material/UOM/dimensions and restricted Documents deny on the server; direct IDs and mixed aliases do not bypass ownership. |
| MR-AC-05 | Actual recipient/issuer/time and signed evidence are explicitly traceable; upload alone is not acknowledgment; unrelated actors cannot view/replace original evidence. |
| MR-AC-06 | Canonical rejection/reversal changes derived fulfillment truthfully without rewriting history or introducing another stock/Finance ledger. |
| MR-AC-07 | Registered applicable API/database/HTTP/browser/locale, denial/retry/concurrency/history, migration/upgrade/populated recovery and prior-module regressions; stable independent DEC-022 review, exact-head PR/push, guarded merge and exact-main CI. |
| MR-AC-08 | Human workflow/usability acceptance remains DEFERRED TO PRE-PRODUCTION PROTOTYPE; trace these criteria into the single integrated UAT, with no historical THB/BOQ replay. |

## Exclusions and execution

No within-plan automatic issue, altered MATERIAL_ISSUE approval bypass, canonical plan/version consumption, emergency limits, cross-MKE/TCJ stock transfer, financial loss/disposal/write-off, #245 multi-Project purchasing, payroll/new Accounting, new paid dependency, retained activation or Production. Full SS08 Cost BOQ/work type/building/floor/work-area coverage, PM01/PM07 plan behavior and other role gaps remain separate rather than being marked delivered by this slice.

Entry PR changes documentation only. After its required merge/main gate, implement the bounded feature on a fresh branch with its applicable tests and affected docs in one coherent PR where predecessor gates permit (DEC-030). Do not request Codex on unstable heads. No technical agent self-approves human UAT, retained activation or Production. Keep #313 open until the real technical and deferred prototype acceptance dispositions are recorded.
