# Material Plan B — canonical issue integration

**Authority:** DEC-044, [entry contract](OP-MATERIAL-PLAN-01-ENTRY.md), #318 and the Owner's existing D1–D5 continuation. A is technically integrated at main `9970150baccbb1a3d3c3079b28ba326f9e3f2b86`, exact-main [41494031446](https://github.com/threeswordz/cinder-grind/actions/runs/41494031446) SUCCESS. No further business-scope approval is requested or inferred. This execution session exclusively owns the B preparation branch.

## B1 — canonical posting extraction (current bounded candidate)

The existing Material Issue approval-completion callback performs one atomic posting operation. Extract its unchanged body into `MaterialIssueService.postInTransaction`, with the same caller-owned Prisma transaction, validation, stock/reservation lock order, availability checks, movement/effect keys, reservation fulfillment, audit and error propagation. The existing approval callback remains its sole caller. No controller route, permission, schema, workflow, dependency or runtime enablement is added.

This gives B's later within-plan and independently approved overage paths one canonical stock owner without duplicating a ledger or impersonating an approver. The extracted method grants no authority itself: any future caller must supply B's independently reviewed authorization and provenance in the same atomic transaction. Do not expose it through a controller as an unchecked posting shortcut.

Mechanical verification compares the de-indented original and extracted bodies byte-for-byte (SHA-256 `9631a30088eeeb27c650272fdf71ced1a5c342863e07fb0462ffad32f3ec58e8`). The immutable PR receipt records the actual digest and native results. Existing registered PostgreSQL/HTTP inventory, approval, reservation, reversal, request/receipt, quantity, Finance non-regression and populated recovery suites remain the behavior checks; no implementation-mirroring unit test replaces them. Local compilation passes; exact-head push/PR CI and stable independent DEC-022 review are pending until verified live. Guarded merge and exact-main SUCCESS remain required.

## Remaining B delivery — not implemented by B1

- MP-AC-07: explicit synthetic Project policy, new-issue provenance and unchanged historical/non-enabled workflows; no real grants or retained activation.
- MP-AC-08–10: exact plan/version/item binding, direct Store within-plan posting without separate issue approval, every beyond-plan quantity through eligible independent Khaimook then Ben, and whole-batch no-plan/mixed-line denial.
- MP-AC-11–12: final atomic allowance/stock evaluation, deterministic lineage/stock/reservation locks, bounded safe retry/idempotency, carried consumption and stale-decision evaluation, canonical returns/reversals without double credit or a stored second consumption balance.
- MP-AC-13/15: full integrated B stock/Finance/history/auth regression and actual predecessor/populated DB/Documents/key restored-runtime proof, independent review, exact CI/merge/main.

**B1 is not full Material Plan B delivery.** B remains active until all applicable approved B criteria and technical gates pass. C's responsive EN/TH/Traditional Chinese UI and consolidated closure remain behind completed B. MP-AC-16 and all prospective human UAT remain DEFERRED TO FROZEN PRE-PRODUCTION PROTOTYPE under DEC-042. Preserve historical accepted THB/BOQ evidence. No new business rules, Accounting/payroll/#245, retained configuration or Production authority.
