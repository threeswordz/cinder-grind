# BOQ Disclosure and Linked Customer BOQ Versions

**Status:** OWNER-APPROVED FIRST-PACKAGE SCOPE / ENTRY PREPARATION — 2026-10-25 SGT. This future scope is not an active successor release or a completed release-entry gate.

**Tracker:** [#266](https://github.com/threeswordz/cinder-grind/issues/266) · **Decision:** DEC-034 · **Requirements:** BUD-011–016 · **Acceptance:** BQC-AC-001–014.

The owner replied **“proceed approved”** after the concrete *Construction-ERP-BOQ-Seven-Role-Gap-Assessment-2026-10-25.md* and proposed first package were presented. Its reviewed source was main `bebffb4a7e3edc019e8a6e88e989fffbcc75d53a`. This records package approval and entry preparation, not answers to cells expressly left undecided. No release number is assigned.

V1.2 remains the primary active release: A/B COMPLETE, C targeted owner UAT and separate release exit PENDING under [#246](https://github.com/threeswordz/cinder-grind/issues/246). Future feature coding waits for required predecessor closure, resolved entry inputs and the normal successor entry gates. Scope-record documentation may be prepared without implementing future functionality or changing current grants. Production remains NOT AUTHORIZED.

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

The owner's approval adopts the concrete direction below for the future package. It does not grant live permissions, attest account configuration or resolve the expressly undecided Nancy cell. Exact technical permissions, combined-role behavior and existing-grant reconciliation must be verified against this baseline before activation; unresolved access must not silently become a wider grant.

| Business function | Internal Cost BOQ | Customer line prices / markup / margins | Action/scope boundary |
|---|---|---|---|
| Ben | Full Cost in authorized Projects | Full commercial detail | Prepares/submits; another authorized person approves. |
| Nancy | Cost basis needed for commercial review; **extent of internal line-cost detail remains PENDING** | Full commercial detail | Approves Customer BOQ; no inferred blanket cost/cross-Company grant. |
| Khaimook | Full Cost in assigned approval scope | No customer price detail | Approves Internal Cost BOQ; additional warehouse read remains separate. |
| Jai / Purchasing | Quantity Only in explicitly authorized purchasing Projects | No customer price detail | Procurement prices remain governed by Procurement permissions; no new Company membership. |
| Store Site | Quantity Only in assigned/relevant Projects | No customer price detail | No rates, cost totals or rate-bearing documents through quantity views. |
| Foreman | Quantity Only in assigned/relevant Projects | No customer price detail | Project membership alone adds no commercial authority. |
| Porn | No blanket internal BOQ line-cost grant; separately authorized Finance documents/totals | No customer line-price/margin detail | Safe contract/billing/payment summary fields require the finalized disclosure contract. |

Quantity Only must not carry hidden monetary fields in payloads or expose them through history, direct IDs, alternative reports, attachments, exports or cached data. A rate-bearing document is not made safe merely by hiding a UI link.

Authorized totals and known quantities may reconstruct a price, particularly on a single-item job. Specify permitted aggregate granularity and document access honestly; do not promise complete prevention of human inference while granting reconstructible totals.

## 4. Entry inputs and resolved scope choice

| Input | Current disposition | Concrete preparation |
|---|---|---|
| D1 — Disclosure/actions | Concrete matrix direction approved; Nancy internal line-cost extent, precise Finance summary granularity and effective permission combinations remain open. | Prepare the endpoint/document/export/capability matrix and reconcile existing grants before activation. Do not mutate current roles to make the future matrix appear implemented. |
| D2 — Source mappings | Representative owner cost/customer examples are not supplied or inspected. | Define same-UOM, independent customer quantity/UOM, split/roll-up and L/S cases where relevant. Synthetic test examples may be prepared and labelled as such; they do not establish the owner's mapping policy. |
| D3 — Pricing/precision/revisions | Initial pricing method(s), cost-basis selection, discounts/rejection rules and customer line/total precision remain open. | Distinguish manual price, markup and target gross margin. Preserve current cost precision; no inferred profit percentage or unapproved conversion formula. Define source selection and immutable customer revision behavior before coding it. |
| D4 — First slice | **APPROVED:** disclosure and linked Customer BOQ versions together; broader costing and lifecycle work remain separate. | No repeat approval of this package or the THB scope is needed. Resolve only genuinely open inputs. |

Entry is not COMPLETE until V1.2 owner UAT/release closure, the necessary input decisions and applicable scope/requirements/acceptance/CI/review/merge/main gates are actually satisfied. Publication of this document fulfills preparation only.

## 5. Requirement / acceptance contract

These are future implementation obligations, not PASS claims. Open-input-dependent cases are BLOCKED until their required rules are resolved.

| ID | Required observable evidence | Requirements |
|---|---|---|
| BQC-AC-001 | Full Cost, Quantity Only and No Access produce the authorized fields/actions in Company/Project scope; direct API denial cannot be bypassed by hiding/unhiding controls. | BUD-011 |
| BQC-AC-002 | Customer line prices, markup and margins are available only to the authorized Ben/Nancy functions; internal cost access does not imply customer-price access. Authorized Finance totals use explicit safe fields. | BUD-011, BUD-015 |
| BQC-AC-003 | Lists, direct IDs, old/revised history, summaries, export/print, document bytes/links, source drilldowns and caches preserve the same disclosure boundary. Test permission/user/Company/Project changes. | BUD-015 |
| BQC-AC-004 | Working cost BOQ and first-approved Original Budget remain canonical; all old approved snapshots persist unchanged. Independently approved customer versions retain exact cost-source IDs and never silently resync. | BUD-012 |
| BQC-AC-005 | Ben-function preparation, Khaimook-function Internal approval and Nancy-function Customer approval use real persisted permissions/workflow steps. Maker/checker, action rights and exact actor scope pass; no SYS_ADMIN or self-approval bypass. | BUD-014 |
| BQC-AC-006 | Explicit customer quantity/UOM and the agreed mapping cases preserve same-Company/Project approved THB source lineage. Reject invalid/cyclic/cross-scope/unknown legacy links and undefined conversion assumptions. | BUD-013 |
| BQC-AC-007 | Approved pricing/precision/revision examples match independent Decimal expectations. Distinguish supported methods; unsupported assumptions fail explicitly. This case remains BLOCKED pending D3. | BUD-012, BUD-013 |
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
- **P1 HR / Attendance / Payroll:** policy preparation in parallel remains authorized planning. Employee master and Site manpower headcount are reusable inputs, not payroll. Roles, pay/OT/leave cycles, effective rates, privacy, statutory treatment, accounting/bank/export handoffs and one expense-recognition contract remain unconfirmed. Do not record unconfirmed HR role conclusions as approved rules.
- Separate lifecycle decisions: plan/urgent material issues and thresholds, dispatch/receipt acknowledgment, broader warehouse/Company access, subcontract work acceptance, Customer quotations/progress billing and payment-proposal-versus-execution recognition.
- Outside this first slice: petty cash, fixed assets/depreciation, #245 multi-Project PO/Invoice/Payment, FX/GL/tax, paid dependency/infrastructure and Production.
- No legacy relabel/backfill, approved-history rewrite, destructive migration, force-push, branch deletion or unauthorized live permission/Approval Matrix change.

## 7. Delivery order and authority

1. Record the approved future scope and entry preparation under #266 through one coherent documentation PR; retain V1.2 as primary active release.
2. Complete V1.2-C targeted UAT and its separate owner release exit. Resolve D1–D3 with only the genuinely missing inputs; preparation may proceed in parallel without successor feature coding.
3. Establish the resolved successor entry baseline through existing governance and applicable normal gates. Assign the release coordination number then; do not claim it already entered development.
4. Implement the approved slice with one active writer, meaningful denials/integrity/upgrade tests and stable-candidate DEC-022 review; merge normally and verify exact-main CI.
5. Targeted successor human UAT and separate release exit remain required.

DEC-008/016/022/029/030/033 and [Project Governance](PROJECT-GOVERNANCE.md) remain mandatory. DEC-034 records this new bounded scope; it does not amend predecessor or human gates. See [Current State](CURRENT-STATE.md) and #266 for actual publication/entry status.
