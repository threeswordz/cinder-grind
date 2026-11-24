# M4 PUR10 — staged cancellation policy, integration and acceptance boundaries

**Status:** nonposting API/service and purchasing UI are now staged on the isolated branch; exact integrated TypeScript/Prisma/React validation and native behavior are **unverified**. No actual PO cancellation, rollout, UAT or M4 acceptance.
**Base:** consolidated M4 Draft #425 at `8c60e125b57e1081b552ea8f2de87cdfeddadbf0`.
**Branch:** `work-m4-pur10-cancellation-policy-no-ci-20261123`.
**Implementation:** `apps/api/src/procurement/purchase-order-cancellation-contract.ts`; focused test: `apps/api/src/procurement/purchase-order-cancellation-contract.test.mjs`.

## Owner-confirmed canonical workflow

Jai proposes cancellation with explicit reason → Khaimook checks continuing Project need → Ben independently approves or rejects. No substitute Ben/implicit SYS_ADMIN authority. The 16-Nov Owner PUR10/DEC-047 overlay further requires supplier refusal to be resolved jointly by Ben and Nancy; Ben confirms any cancellation penalty agreement and Nancy approves the expense; Ben decides partially received cases individually. Accounting execution remains separately deferred by #288. No automatic reversal of received/invoiced history and no implicit multi-Project #245 scope.

## What this branch actually adds

- Pure, statically typed transition rules for PROPOSE, PM_FORWARD, PM_RETURN, BEN_APPROVE and BEN_REJECT.
- Explicit named Jai, Khaimook and Ben ID binding from trusted **retained configuration** (must be supplied by service from current DB, never a request body). Current live session/employee, correct role + permission, Company/Project access and three distinct actors required.
- Monotonic optimistic versions and exact PO revision/update-source pins; stale or changed source blocked.
- Nonposting decisions. Final deny-only precondition rejects unapproved reviews, posted unreversed GR, approved AP source, supplier refusal, unresolved deposit/penalty, or partial delivery/invoice.
- Local isolated Node 22 type-strip test **3/3 passed**, and standalone TS5.8 strict typecheck passed. No full ERP compile, DB test, real-browser test or GitHub CI is claimed.


## Incremental backend and UI implementation after initial contract

- `PurchaseOrderCancellationCaseService`: audit-backed, ordered-by-previous-event replay; transaction-scoped advisory lock; explicit current live user session/active employee/role/permission/Company/Project checks; exact named actor IDs from `system_settings.PUR10_NAMED_ACTORS_V1` (must be authorized separately, never preseeded here). Duplicate/stale request and PO revision/change checks; append-only nonposting history.
- `PurchaseOrderCancellationCaseController` exposes scoped GET and POST decision events with Auth/CSRF/Permission guards. No order/stock/Finance write from the decision API; BEN_APPROVE is review-only.
- Old one-step `POST /procurement/purchase-orders/:orderId/cancel` now **fails closed** with `PUR10_INDEPENDENT_CANCELLATION_REVIEW_REQUIRED` on this unmerged branch. Old `PurchaseOrderService.cancel` is not itself refactored, therefore **service-level finalization and call-site audit remain release blockers**.
- The `PurchaseOrdersPanel` unilateral Cancel Revision control is removed; `PurchaseOrderCancellationPanel` renders the Jai proposal, Khaimook review or Ben decision depending on the current role and case status. Actual roles and server permissions are independently enforced; no effective retained grant claims. Ben review reuses existing `procurement.po.approve` permission; no new role grants.
- On this branch, no new Prisma schema is required for nonposting case decisions because the current append-only `audit_logs` model is used. This does **not** by itself prove immutable persisted-event semantics or migration/recovery integrity; focused PG tests remain needed.
- The existing 3/3 local policy tests were performed on the initial pure policy before the backend/UI increment; current integrated source has **not** been compiled or executed, so no false PASS is recorded for the new code.

## Next implementation sequence — explicitly NOT complete

1. **Persistence:** introduce append-only, Company/Project-scoped cancellation-case events (e.g. canonical AuditLog event chain, or forward-only persisted model), with unique active proposal invariant, previous-event/version guard, replay checking and write serialization. Bind request ID and PO source to actual DB records, never client-supplied trust flags. Preserve historic POs and event records.
2. **Live actor admission:** query current UserSession, Employee, UserRole/RolePermission, authorized Project access and the approved MKE/TCJ named role assignments under the same protected transaction; fail closed if any naming/configuration is absent, expired, inactive or ambiguous. Do not seed or auto-grant privileges.
3. **HTTP and UI:** add Jai proposal, PM forward/return, Ben approve/reject and read/history endpoints; React screens with exact actor controls, correction/refresh workflow, no direct cancel button for Jai. Avoid introducing another bypass through the existing `POST /procurement/purchase-orders/:orderId/cancel` route.
4. **Atomic finalization:** refactor `PurchaseOrderService.cancel` to admit final cancellation **only after the verified Ben decision**. Re-evaluate the original posted-GR, approved-invoice, revision, source/Company/Project and advisory lock guards in the **same** transaction as any final `CANCEL` write and audit. Do not record Ben approved if actual finalization fails. Existing direct-cancel behavior MUST NOT remain an alternate authorized route.
5. **Exception policy:** supplier refusal, deposit/penalty and partial received or paid cases stay nonposting/policy-gated until Ben/Nancy decisions and separate Accounting authority; never infer a financial credit, payment or reversal.
6. **Targeted acceptance:** focused native disposable PostgreSQL 17.11 state/lock/trigger tests, current named-user/scope denials, genuine UI progression, negative concurrency and receipt/Finance-source tests, no repeat of previously successful PO/Receiving/PM02/Thai-PDF runs.
7. **Release:** freeze full main-to-candidate source diff, one independent DEC-022 exact-head review, Owner-specific #384 authorization for required final CI, guarded integration and M4 acceptance. No Production approval.

## CI economy and scope

The `work-m4-*` branch does not match existing `v*` focused-push routing and is not a PR to `main`; no full suite, Ready transition, protected merge or Mac/retained environment actions were initiated for this package.

**Completion clock remains unchanged:** prototype 4/8; GL3/10; M4 20/32 bounded technical; M4 accepted packages 0/8; 0/1900 planned hours retired; baseline remaining 1900h (actual engineering hours not measured). This is real partial code progress, not an accepted work-package exit.


## Actual 24-Nov-2026 00:16 SGT targeted native evidence — now verified

- [Corrected **targeted** PostgreSQL 17.11 workflow #45214476040](https://github.com/threeswordz/cinder-grind/actions/runs/45214476040): **COMPLETED SUCCESS**, `1 native test PASS / 0 FAIL`, at exact SHA `d4deca9cf37cef292d755d20b84f3deebb7fb7da`. Disposable, fresh database; **full ordered Prisma migrations PASS**, actual API build PASS, synthetic PR→RFQ→approved PO→Jai proposal→Khaimook review→Ben approval→Ben finalization PASS, audit replay and stale/duplicate denial PASS, no receipt or Finance posting. All original GR/AP/revision guards reused in the same transaction.
- [First targeted run #45213874160](https://github.com/threeswordz/cinder-grind/actions/runs/45213874160) **FAILED at compile**, not at business test, with exactly two TypeScript prior-state narrowing errors. The original fresh PostgreSQL migration chain PASS. These two source errors were fixed, with no redundant full release CI.
- [Source comparison](https://github.com/threeswordz/cinder-grind/compare/cecf606be2e0ab30df0416ec19190e12e9d2f996...d4deca9cf37cef292d755d20b84f3deebb7fb7da): corrected PASS run differs from the development branch source commit `cecf606be2e0ab30df0416ec19190e12e9d2f996` **only by the dedicated one-off workflow file**. No tested application, migration or native test source differed.
- Source code now enforces `PurchaseOrderService.cancel()` **direct-service DENIAL** and API direct-cancel denial; `cancelForReviewedCase` requires an exact Ben audit event and PO source lock. The existing `revise()` rechecks cancelled status after its advisory lock to close a queued-revision race.
- The finalization UI uses **unchecked-by-default** supplier agreement, no penalty/deposit and no prior delivery/invoice attestations, plus supplier evidence text. The service rechecks source history and denies **any** existing GR, supplier invoice line, or linked receiving delivery regardless of posting status. These are conservative restrictions, not an Owner authorization for financial exception handling.
- **Unproven**: actual named retained MKE/TCJ accounts and permissions, real authenticated React/MUI browser progression, simultaneous-finalization contention test (stale/sequential duplicate *was* tested), supplier dispute/penalty/partial receipt exception handling, independent DEC-022 exact-source review, final release gate and Production. No grants, supplier messages, receipt reversals, or financial postings were performed.

**Forecast accounting unchanged:** prototype 4/8, GL 3/10, M4 bounded technical 20/32; 0/8 M4 packages formally accepted; 0/1900 forecast productive hours retired, remaining 1900h, actual productive hours not logged. Focused source/native proof is meaningful development progress but not formal package exit.
