# Parallel Builder 2 — M4 BOQ / DEC-054 source and acceptance disposition

**As of:** 24 November 2026 SGT. **Status:** Draft-source evidence only; **not** milestone, role, UAT, release or Production acceptance.

- Source: [Draft PR #425](https://github.com/threeswordz/cinder-grind/pull/425), verified open, draft, unmerged at `8c60e125b57e1081b552ea8f2de87cdfeddadbf0`. The isolated successor is `work-m4-boq-dec054-parallel-20261124`; no protected-main edit or source migration.
- Current Owner policy is [DEC-054](DECISION-LOG.md#dec-054--boq-quantity-disclosure-customer-buffer-and-cost-self-approval) and [BOQ commercial scope §3](BOQ-COMMERCIAL-SCOPE.md#3-current-owner-confirmed-boq-policy--dec-054): **Ben prepares and may approve Cost BOQ using a persisted, narrowly scoped self-approval capability; Nancy independently approves Ben's Client BOQ; Khaimook/Jai/Porn are not Full Cost readers under BOQ policy**.
- **Owner decision conflict, hold this route:** the current Parallel Builder 2 prompt requests **Ben prepares → Khaimook approves Cost BOQ**, contradicting the later DEC-054 owner-confirmed route. DO NOT convert the approval matrix, mint grants, alter historic decisions or treat Khaimook's legacy workflow as current without a new explicit Owner decision. Client BOQ Ben → Nancy remains non-conflicting.
- **Accounting scope conflict/dependency:** `PORN-BOQ-01` currently means safely approved whole-Project contract/billed/received totals via `budget.project_summary.view`; it does not create a customer installment schedule. The new instruction “only approved billing/installment information” requires a specific accounting-view/scope reconciliation with Finance deferral #288 before restricting or expanding other Finance views.

## Precise code/source coverage (not retained acceptance)

| Stable requirement | Verified existing source capability | Residual acceptance / policy boundary |
|---|---|---|
| `BUD-011` | Persisted Cost Full / Quantity Only / No Access in `budget-disclosure.ts`, `quantity-boq.controller.ts`, `budget.controller.ts`, and `BudgetWorkspace.tsx` | Effective named MKE/TCJ roles, unioned grants, full UI and alternate consumer inspection |
| `BUD-012` | Working Cost BOQ and immutable approved revision snapshots; independent linked, versioned Client BOQ in `customer-boq.service.ts` and pricing/integration specs | Retained approved-history/upgrade proof on actual target and user acceptance |
| `BUD-013` | Source-line mapping/UOM validation, manual/markup Decimal pricing and selected absolute raw + buffer quantity snapshots in `customer-boq-pricing.ts` and `customer-boq-validation.ts` | Human validation of selected-line quantities and print presentation; no blanket/default buffer assumption |
| `BUD-014` | Cost-only persisted self-approval capability with audited separate action; Client BOQ creator/editor/submitter cannot approve and checker needs configured step role | New Ben→Khaimook request conflicts with DEC-054; retain DEC-054 implementation until Owner decides; named-user workflow validation |
| `BUD-015` | Quantity allowlist, customer export/attachment guards, report read barriers, no-store server headers, fresh print fetches; `boq-http.integration.spec.ts` and `project-summary.integration.spec.ts` | New cross-Project/partial-union CSV negative test on this branch not yet executed; actual combined grants and browser cache/print UAT pending |
| `BUD-016` | THB-only Customer pricing/source provenance; historical Cost immutable; no stock/payment/direct-cost posting from Client BOQ; associated tests and release schema contract | Exact integrated successor validation, populated original-runtime upgrades/role proof and release gates are separate |
| `BEN-BASE-04` | Ben Cost and Client BOQ source flows exist under DEC-054 | Retained Ben privileges, human UAT; wider non-BOQ obligations not implied |
| `PM04` | Old Ben→Khaimook Cost route is historic V1.3 evidence; DEC-054 instead gives Khaimook quantity-only | **Business conflict**, retained Khaimook role readback; not certified as Ben→Khaimook current policy |
| `NANCY-01` | Client BOQ independent Nancy approval source implemented | Retained Nancy permission/step-role acceptance; unrelated VO/quotation/budget duties unproven here |
| `PORN-BOQ-01` | `project-summary.service.ts` exposes only three approved canonical Project aggregates with dedicated permission and CSV guard; no Client BOQ lines/pricing | Retained Porn access; exact approved-billing/installment requirement and #288 Finance scope unresolved |
| `PM05` / `JAI-SCOPE-01` | BOQ quantity-only source and negative Customer reads | Retained grants and non-BOQ warehouse/Procurement permissions remain separate |

**Interpretation:** `BUD-011`–`BUD-016` are source-backed bounded BOQ capabilities, **not six fully accepted M4 requirements**. None of `BEN-BASE-04`, `PM04`, `NANCY-01`, `PORN-BOQ-01` is newly certified as complete for retained users. No 112-ID census, 32-package technical counter, milestone count or accepted 1,900-hour work-package exit is changed by this branch.

## New narrow negative tests on this branch

Modified only `apps/api/src/budget/boq-http.integration.spec.ts` to assert:

1. An actor authorized for **both** Projects can export a Client BOQ through its owning Project URL, **but cannot** swap its version ID into another authorized same-Company Project URL (404).
2. The same actor cannot request the version through a foreign Company/Project URL (404).
3. Four separate incomplete combinations of quantity, full Cost, Cost BOQ, revision, customer and customer-action permissions each deny Customer CSV export (403) without returning rate/price/source payload.

No runtime code, permission catalog, role administration, frontend, migrations, Procurement/Receiving/Inventory or Finance code was changed. Existing broad negative tests, maker/checker concurrency, immutable history and no-stock/payment evidence are reused, not rewritten.

## Verification and next gate

- **Actual prior source evidence:** [PR #391 #5955](https://github.com/threeswordz/cinder-grind/actions/runs/44918821998) completed **SUCCESS** on `ea6d977850db6a4a9763c97baf3f41fce246296e`, as previously accepted bounded DEC-054 source evidence. This is not a PASS for this branch or the #425 combined head. [M6 #395](https://github.com/threeswordz/cinder-grind/pull/395) documents separately focused 17/17 companion source tests, also not this branch.
- **New tests:** **NOT RUN** in this workstream. The available workspace has no connected disposable PostgreSQL 17.11 + repository runtime/Node24 test runner; no GitHub Actions was started, and prior focused/full runs were not repeated.
- **Static review:** the parent code has server-side Company/Project `load` and all-four-capability `assertRead` checks before Client BOQ export. The new negative tests target exact HTTP behavior missing from the reviewed export evidence, but require one **focused** disposable execution to count as a current PASS.
- **Next bounded work:** have an authorized disposable runner execute only `boq-http.integration.spec.ts` at this branch's exact head; investigate failures without full CI; verify named eight-role effective permissions and DEC-054 browser workflows separately when authorized; resolve Ben/Khaimook and accounting-view conflicts before any corresponding policy changes. Collect independent DEC-022 review at stable integration. Do not Ready/merge, launch repeated full CI, access protected Mac, change retained grants or deploy Production without separate authority.

**Governance:** #384 stop directive honored; #425 remains Draft, no new PR Ready, no automatic or manual full validation requested.
