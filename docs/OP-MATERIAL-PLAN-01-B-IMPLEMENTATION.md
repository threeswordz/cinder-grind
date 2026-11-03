# Material Plan B — canonical issue integration

**Authority:** DEC-044, [entry contract](OP-MATERIAL-PLAN-01-ENTRY.md), #318 and the Owner's existing D1–D5 continuation. A is technically integrated at main `9970150baccbb1a3d3c3079b28ba326f9e3f2b86`, exact-main [41494031446](https://github.com/threeswordz/cinder-grind/actions/runs/41494031446) SUCCESS. No further business-scope approval is requested or inferred. This execution session exclusively owns `v1-material-plan-b-issue-controls-20261103`; no competing writer was observed at the B2 preflight.

## B1 — canonical posting extraction (technically integrated)

The existing Material Issue approval-completion callback performs one atomic posting operation. Extract its unchanged body into `MaterialIssueService.postInTransaction`, with the same caller-owned Prisma transaction, validation, stock/reservation lock order, availability checks, movement/effect keys, reservation fulfillment, audit and error propagation. The existing approval callback remains its sole caller. No controller route, permission, schema, workflow, dependency or runtime enablement is added.

This gives B's later within-plan and independently approved overage paths one canonical stock owner without duplicating a ledger or impersonating an approver. The extracted method grants no authority itself: any future caller must supply B's independently reviewed authorization and provenance in the same atomic transaction. Do not expose it through a controller as an unchecked posting shortcut.

Mechanical verification compares the de-indented original and extracted bodies byte-for-byte (SHA-256 `9631a30088eeeb27c650272fdf71ced1a5c342863e07fb0462ffad32f3ec58e8`). The immutable PR receipt records the actual digest and native results. Existing registered PostgreSQL/HTTP inventory, approval, reservation, reversal, request/receipt, quantity, Finance non-regression and populated recovery suites remain the behavior checks; no implementation-mirroring unit test replaces them. B1 #323 reviewed head `10a126425413ae4b0b9e4b7b6a3a891619b40e17` passed push [41496748153](https://github.com/threeswordz/cinder-grind/actions/runs/41496748153) and PR [41496758874](https://github.com/threeswordz/cinder-grind/actions/runs/41496758874), 36/36 each. Independent Codex [6591448665](https://github.com/threeswordz/cinder-grind/pull/323#issuecomment-6591448665) reported CLEAN with zero review threads. Guarded squash merge `5209c30a1b7b282a603ba09d4a5bd82a700a183f` passed exact-main [41548555430](https://github.com/threeswordz/cinder-grind/actions/runs/41548555430), 36/36. Full B remains incomplete until B2 passes its own gates.

## B2 — policy, authorization provenance and canonical consumption (active candidate)

- MP-AC-07: explicit synthetic Project policy, new-issue provenance and unchanged historical/non-enabled workflows; no real grants or retained activation.
- MP-AC-08–10: exact plan/version/item binding, direct Store within-plan posting without separate issue approval, every beyond-plan quantity through eligible independent Khaimook then Ben, and whole-batch no-plan/mixed-line denial.
- MP-AC-11–12: final atomic allowance/stock evaluation, deterministic lineage/stock/reservation locks, bounded safe retry/idempotency, carried consumption and stale-decision evaluation, canonical returns/reversals without double credit or a stored second consumption balance.
- MP-AC-13/15: full integrated B stock/Finance/history/auth regression and actual predecessor/populated DB/Documents/key restored-runtime proof, independent review, exact CI/merge/main.

### Runtime and persistence contract

Five additive tables hold immutable Project policy, capture-on-new-issue binding, versioned authorization, item/source allocation and durable operation receipts. Historical business tables receive no new physical columns. Enablement requires an explicit `ISOLATED_SYNTHETIC` declaration, current scoped capability and an active two-stage workflow; the enable endpoint denies Production mode. No role is granted and no Project is enabled by migration.

| Capability | Purpose / dependencies |
|---|---|
| `inventory.material_plan.issue.post` | Direct Store within-plan posting and overage submission; plan view, issue view and authorized source quantity/revision view |
| `inventory.material_plan.overage.review` | First independent configured workflow stage; same read dependencies |
| `inventory.material_plan.overage.approve` | Distinct final configured workflow stage; same read dependencies |
| `inventory.material_plan.prototype.enable` | Explicit isolated synthetic policy enablement; plan view and authorized source quantity/revision view |

Only issues created after policy enablement are captured. Historical and non-enabled issues keep the legacy canonical approval path. A captured issue must bind every canonical item to a current approved same-Company/Project/warehouse/material/UOM plan line and expected header version, within the issue date's approved validity interval. No caller-supplied quantity, fake approval or implicit administrator authority is accepted. The existing canonical Material Issue posting method owns stock/reservation movements. Within-plan posting needs no separate approval instance. Every beyond-plan quantity uses the configured independent reviewer then final authority, with current persisted grants and role eligibility; original maker, submitter, authorization maker and prior approver cannot self-approve. A fresh evaluation supersedes pending stale authorization while preserving its history.

Net usage is a read over posted, unreversed canonical issues and posted, unreversed returns against effective issues. Plan IDs retain consumption across revisions; posted historical pins never change. A reasoned revision cannot omit or reduce a consumed source below effective usage. A later canonical return reversal may expose negative remaining allowance without rewriting the prior issue; subsequent issues require appropriate overage approval. No stored consumption balance, parallel stock ledger or source-budget inflation is introduced.

Serializable transactions use deterministic issue/plan lineage locks and the existing compatible warehouse/stock/reservation locks, bounded three-attempt retry and scoped same-key/body replay. Final posting rechecks current effective plan/source/permissions/workflow, whole-batch allowance and canonical stock availability atomically. Invalid mixed/no-plan batches roll back all effects. New SQL history/receipt/source/approval guards and same-transaction receipts protect provenance and posting completeness.

### Registered technical evidence and remaining gates

- API contract and authenticated PostgreSQL/HTTP suites cover explicit activation, current Company/Project/source/action rights and CSRF, no SYS_ADMIN authority, historical workflow preservation, direct posting, independent two-step overage, stale revisions, carried consumption, canonical returns/reversals, complete batches, concurrent allowance/revision races, exact replay and revocation.
- Native CI retains all earlier tests and five predecessor rehearsals, and adds actual B1 predecessor `5209c30a1b7b282a603ba09d4a5bd82a700a183f`. Strict contracts admit only five new empty tables and four exact permission definitions while preserving all old table/catalog hashes. Populated paired database/Documents restore proves actual B2 approval/history/policy, canonical request links and signed receipt bytes, authenticated reads and denied outsiders. Existing external HR key/record proof remains required.
- Local compilation, Prisma schema validation, 7 focused API contract tests, 89 release contracts and 13 route/source tests pass. Local PostgreSQL is unavailable; these are not native database or human acceptance claims. Actual exact-head push/PR CI, stable independent DEC-022 review, guarded merge and exact-main SUCCESS remain pending. Actual head/run/review receipts belong to the PR and #318; no self-review substitutes for Codex.

**B1 is not full Material Plan B delivery.** B remains active until all applicable approved B criteria and technical gates pass. C's responsive EN/TH/Traditional Chinese UI and consolidated closure remain behind completed B. MP-AC-16 and all prospective human UAT remain DEFERRED TO FROZEN PRE-PRODUCTION PROTOTYPE under DEC-042. Preserve historical accepted THB/BOQ evidence. No new business rules, Accounting/payroll/#245, retained configuration or Production authority.
