# BOQ Disclosure and Linked Customer BOQ Versions

**2026-10-29 integrated BOQ checkpoint:** Runtime increments #276/#277/#280/#281 are technically COMPLETE on main `826edaadb7efdea0ed85720cf006c244a9402dd2`, [CI40811812549](https://github.com/threeswordz/cinder-grind/actions/runs/40811812549) SUCCESS31/31,255 API/44 web and three fresh browser profiles; final independent Codex clean. [Consolidated evidence/decision preparation](V1.3-BOQ-CLOSURE-PACKET.md) maps every criterion. [Read-only access reconciliation](V1.3-B-ACCESS-RECONCILIATION.md) is prepared; fresh retained configuration and runtime identity remain UNVERIFIED because this workspace has no retained-runtime connection. #275/#266 remain OPEN; no configuration activation, human acceptance, next-stage start or Production authority is inferred.

**Status:** V1.3-A COMPLETE; B runtime implementation technically COMPLETE; integrated closure ACTIVE under #275. Retained activation and human/business acceptance are not attested. Approved rules/examples/acceptance criteria remain unchanged.

**Tracker:** [#266](https://github.com/threeswordz/cinder-grind/issues/266) · **Decision:** DEC-034 · **Requirements:** BUD-011–016 · **Acceptance:** BQC-AC-001–014.

The owner replied **“proceed approved”** after the concrete *Construction-ERP-BOQ-Seven-Role-Gap-Assessment-2026-10-25.md* and proposed first package were presented. Its reviewed source was main `bebffb4a7e3edc019e8a6e88e989fffbcc75d53a`. This records package approval and entry preparation, not answers to cells expressly left undecided. V1.3 is the coordination label assigned to this approved package; it does not change its scope.

V1.2 is COMPLETE + ACCEPTED, [#246 CLOSED / COMPLETED](https://github.com/threeswordz/cinder-grind/issues/246#issuecomment-6465837484), final main `b8bfd798967d61d9d312f790db5912fb572ce851`, exact-main CI40666561990 SUCCESS. No repeat owner THB UAT is needed. The predecessor gate is satisfied; the owner has resolved the remaining BOQ business inputs; normal entry publication gates still precede feature coding. Scope-record documentation may be prepared without implementing future functionality or changing current grants. Production remains NOT AUTHORIZED.

## 1. Reuse and verified gaps

The existing working BOQ and immutable BudgetRevision/Original Budget are the cost authority. Reuse Project → WBS → Activity, independent Cost Code, Company/Project authorization, existing approval roles/steps, numbering, Decimal arithmetic and audit.

| Existing source | Consequence for this package |
|---|---|
| [BOQ and BudgetRevision models](../apps/api/prisma/schema.prisma), [Budget service](../apps/api/src/budget/budget.service.ts) | Current item quantity × rate, UOM, section and WBS/Cost Code snapshots are reusable. Do not create another editable cost ledger or overwrite approved Original Budget. |
| [Budget controller](../apps/api/src/budget/budget.controller.ts) and [BOQ UI](../apps/web/src/budget/BudgetPanel.tsx) | Existing read paths return/render monetary fields; they do not implement the new Quantity Only contract. This is a source gap, not proof of unauthorized access by a current user. |
| [Approval service](../apps/api/src/approval/approval.service.ts) | Actor changes can use Company-scoped configured roles, subject to verified effective permissions. Named actors are business functions, not hard-coded names or attested private-Mac assignments. |
| [Client Invoice model and UI](../apps/web/src/finance/ClientFinanceWorkspace.tsx) | Generic Invoice descriptions/amounts and Finance approval are not Customer BOQ, quotation or progress-billing lifecycles. Do not bypass financial approval to implement a new commercial document. |
| [Bounded schema classifier](../deploy/release-candidate/schema-contract.mjs) | V1.2's four-provenance-field/default allowance does not authorize arbitrary successor schemas. Extend only the separately reviewed Customer BOQ contract; retain existing rehearsal guards/modes. |

The focused assessment also found separate lifecycle differences in plan/urgent material issues, dispatch/receipt acknowledgment, subcontract acceptance and progress billing. They are outside this first package. No exhaustive code, security, private database or browser audit is claimed.

## 2. Approved first-package boundary

1. Preserve the working cost BOQ and immutable approved BudgetRevision snapshots. Map requested Internal Cost BOQ approval to this canonical lifecycle where feasible.
2. Introduce independently approved Customer BOQ versions linked by durable IDs to selected approved cost revisions/items. Retain quantity, UOM, pricing rationale and source identity; approved commercial versions never silently resync after cost changes.
3. Implement Full Cost / Quantity Only / No Access and a separate customer-price capability across relevant APIs, UI, history, summaries, export/print, documents, drilldowns and caches. Read disclosure and create/edit/submit/approve rights remain separate.
4. Support explicitly entered customer quantities/UOM and reviewed source mappings for agreed examples. Printed Excel row numbers or matching descriptions are not source identity. Block undefined conversions/assembly assumptions; no inferred L/S conversion.
5. Ben function prepares/submits Internal and Customer BOQs; Khaimook function approves Internal Cost BOQ; Nancy function approves Customer BOQ. Use Company-scoped roles and existing maker/checker. No self-approval exception, SYS_ADMIN implicit business authority or literal person-name checks.
6. Preserve THB-only new monetary activity, Decimal precision, original historical denominations/NULLs, approved budgets, audit and stock/Finance ledgers. Use minimum forward-only schema changes with actual previous-release upgrade and compatible paired database/Documents recovery.
7. Update affected canonical Cost/Management/source consumers and disclosures. Estimates/customer pricing create no Actual/Paid posting or second financial ledger.
8. Deliver focused regression, stable-candidate DEC-022 review, exact-head push/PR/main CI and targeted human UAT with a separate release-exit decision.

## 3. Role-visibility baseline

The owner's approval and [recorded selections](https://github.com/threeswordz/cinder-grind/issues/266#issuecomment-6398077094) adopt the direction below. Nancy's extent and Porn's summary granularity are resolved. This does not grant live permissions or attest account configuration. Exact technical permissions, combined-role behavior and existing-grant reconciliation must be verified before activation; unresolved access must not silently become a wider grant.

| Business function | Internal Cost BOQ | Customer line prices / markup / margins | Action/scope boundary |
|---|---|---|---|
| Ben | Full Cost in authorized Projects | Full commercial detail | Prepares/submits; another authorized person approves. |
| Nancy | Full working and approved Internal Cost BOQs in authorized Projects | Full commercial detail | Approves Customer BOQ; no inferred cross-Company, Internal edit/approval or self-approval right. |
| Khaimook | Full Cost in assigned approval scope | No customer price detail | Approves Internal Cost BOQ; additional warehouse read remains separate. |
| Jai / Purchasing | Quantity Only in explicitly authorized purchasing Projects | No customer price detail | Procurement prices remain governed by Procurement permissions; no new Company membership. |
| Store Site | Quantity Only in assigned/relevant Projects | No customer price detail | No rates, cost totals or rate-bearing documents through quantity views. |
| Foreman | Quantity Only in assigned/relevant Projects | No customer price detail | Project membership alone adds no commercial authority. |
| Porn | No blanket internal BOQ line-cost grant; separately authorized Finance documents/totals | No customer line quantities/prices, source-cost breakdown or margins | New BOQ-related summary: authorized Project-level contract/billed/paid totals only; no BOQ WBS/line filters. Existing Finance authority remains separately reconciled. |

Quantity Only must not carry hidden monetary fields in payloads or expose them through history, direct IDs, alternative reports, attachments, exports or cached data. A rate-bearing document is not made safe merely by hiding a UI link.

Authorized totals and known quantities may reconstruct a price, particularly on a single-item job. Specify permitted aggregate granularity and document access honestly; do not promise complete prevention of human inference while granting reconstructible totals.

## 4. Entry inputs and resolved scope choice

| Input | Current disposition | Concrete preparation |
|---|---|---|
| D1 — Disclosure/actions | Nancy full working/approved cost reads in authorized Projects and Porn Project-only totals are owner selected. Effective combined permissions and existing-grant reconciliation remain technical work. | Use the [entry surface map](BOQ-ENTRY-PREPARATION.md). Do not mutate current roles to make the future matrix appear implemented. |
| D2 — Source mappings | C1/C2 and E1–E3 in [entry baseline](BOQ-ENTRY-PREPARATION.md) are OWNER APPROVED under DEC-037; synthetic values are adopted business examples, not actual owner prices. | Explicit source IDs, independent quantity/UOM and split/roll-up shares; no inferred conversions. Keep synthetic values distinct from actual owner prices and runtime PASS evidence; the owner has adopted the examples as expected business outcomes. |
| D3 — Pricing/precision/revisions | Manual rates and percentage markup, up-to-four-place quantities/rates, half-up two-place lines, summed rounded lines and newly approved revisions are owner selected. C3–C5/E4–E8 resolve source basis, derived-rate rounding, discount/zero/fractional edges under DEC-037. | Implement the exact adopted examples in [entry baseline](BOQ-ENTRY-PREPARATION.md). Target gross margin remains deferred; no actual rate/percentage is assumed. |
| D4 — First slice | **APPROVED:** disclosure and linked Customer BOQ versions together; broader costing and lifecycle work remain separate. | No repeat approval of this package or the THB scope is needed. Resolve only genuinely open inputs. |

V1.2 owner UAT/release closure is COMPLETE. BOQ business-input decisions are OWNER APPROVED. Entry publication/CI/review/merge/main gates are COMPLETE through #274/main CI40680993646, as recorded in #266. V1.3-B implementation is tracked by #275.

## 5. Requirement / acceptance contract

The criteria below remain the unchanged acceptance contract. Actual software technical evidence, retained-configuration limitations and separate human gates are mapped in the [consolidated packet](V1.3-BOQ-CLOSURE-PACKET.md); technical PASS does not self-approve business acceptance.

| ID | Required observable evidence | Requirements |
|---|---|---|
| BQC-AC-001 | Full Cost, Quantity Only and No Access produce the authorized fields/actions in Company/Project scope; direct API denial cannot be bypassed by hiding/unhiding controls. | BUD-011 |
| BQC-AC-002 | Customer line prices, markup and margins are available only to the authorized Ben/Nancy functions; internal cost access does not imply customer-price access. Authorized Finance totals use explicit safe fields. | BUD-011, BUD-015 |
| BQC-AC-003 | Lists, direct IDs, old/revised history, summaries, export/print, document bytes/links, source drilldowns and caches preserve the same disclosure boundary. Test permission/user/Company/Project changes. | BUD-015 |
| BQC-AC-004 | Working cost BOQ and first-approved Original Budget remain canonical; all old approved snapshots persist unchanged. Independently approved customer versions retain exact cost-source IDs and never silently resync. | BUD-012 |
| BQC-AC-005 | Ben-function preparation, Khaimook-function Internal approval and Nancy-function Customer approval use real persisted permissions/workflow steps. Maker/checker, action rights and exact actor scope pass; no SYS_ADMIN or self-approval bypass. | BUD-014 |
| BQC-AC-006 | Explicit customer quantity/UOM and the agreed mapping cases preserve same-Company/Project approved THB source lineage. Reject invalid/cyclic/cross-scope/unknown legacy links and undefined conversion assumptions. | BUD-013 |
| BQC-AC-007 | Approved C1–C5/E1–E8 pricing/precision/revision examples match independent Decimal expectations. Distinguish supported methods; unsupported assumptions fail explicitly. No runtime PASS is claimed at entry. | BUD-012, BUD-013 |
| BQC-AC-008 | New money is THB-only through API/database/source handoffs; historical SGD/NULL/approved records and exact supported corrections remain truthful and immutable. No backfill or replacement evades V1.2 guards. | BUD-016, SYS-009–011 |
| BQC-AC-009 | Estimates and Customer BOQ pricing create no duplicate commitment, Actual/Paid posting, stock effect or editable financial ledger. Affected canonical read models keep recognition semantics. | BUD-016 |
| BQC-AC-010 | Wrong Company/Project/user/action, confidential source/document and conflicting effective-access paths fail. Project-wide access does not imply Company or business approval authority. | BUD-011, BUD-014–015 |
| BQC-AC-011 | Retries, changed-payload replays, competing edits/approvals, rejection and transaction rollback preserve version identity and history without duplicate effects. | BUD-012–014, BUD-016 |
| BQC-AC-012 | Minimum forward-only schema and reviewed bounded rehearsal extension pass fresh/actual previous-release upgrades, migration/schema consistency and strict paired database/Documents restore with a compatible runtime. Existing application-only/SQL-only guards remain. | BUD-016, SYS-011 |
| BQC-AC-013 | Applicable pinned isolated regression and exact-head push/PR CI pass; stable-candidate DEC-022 review is complete with findings resolved; normal merge and exact-main CI verified. | BUD-011–016 |
| BQC-AC-014 | Targeted affected-role/source/export/locale UAT passes; separate owner UAT acceptance and release exit are recorded. Technical tests do not self-approve either. | BUD-011–016 |

Use disposable isolated PostgreSQL/Documents for full suites. Do not replay unchanged V1.1 human tests without an affected path. Preserve EN/Thai/Traditional Chinese monetary/disclosure meaning, accepted V1.1 limitations and DEC-032's exact old exception; it never waives successor or Production recovery.

## 6. Separate P1 work and exclusions

- **P1 costing increment:** Detailed/Lump Sum/Hybrid cost components/coverage, automatic UOM/assembly formulas and their representative calculation/precision decisions.
- **P1 HR / Attendance / Payroll:** the owner instructed BOQ first, HR next in stages, and explicitly authorized publication of the complete [Thai requirements](HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md). [HR entry preparation](HR-PAYROLL-ENTRY-PREPARATION.md) preserves settled answers and specific remaining policy/design work. HR runtime, payroll calculations, grants, policy exceptions and rollout remain outside V1.3.
- Separate lifecycle decisions: plan/urgent material issues and thresholds, dispatch/receipt acknowledgment, broader warehouse/Company access, subcontract work acceptance, Customer quotations/progress billing and payment-proposal-versus-execution recognition.
- Outside this first slice: petty cash, fixed assets/depreciation, #245 multi-Project PO/Invoice/Payment, FX/GL/tax, paid dependency/infrastructure and Production.
- No legacy relabel/backfill, approved-history rewrite, destructive migration, force-push, branch deletion or unauthorized live permission/Approval Matrix change.

## 7. Delivery order and authority

1. Preserve published DEC-034 scope and the verified V1.2 COMPLETE + ACCEPTED closure. The owner instructed progressing BOQ first, HR next in stages.
2. C1–C5/E1–E8 and HR publication are owner approved under DEC-037. Publish the resolved V1.3-A baseline and complete its normal entry gates. No completed V1.2 UAT is reopened.
3. Establish the resolved successor entry baseline through existing governance and applicable normal gates. Use V1.3 as the coordination label; do not claim runtime implementation has started until entry publication gates pass.
4. Implement the approved slice with one active writer, meaningful denials/integrity/upgrade tests and stable-candidate DEC-022 review; merge normally and verify exact-main CI.
5. Targeted successor human UAT and separate release exit remain required.

DEC-008/016/022/029/030/033 and [Project Governance](PROJECT-GOVERNANCE.md) remain mandatory. DEC-034 records this new bounded scope; it does not amend predecessor or human gates. See [Current State](CURRENT-STATE.md) and #266 for actual publication/entry status.
