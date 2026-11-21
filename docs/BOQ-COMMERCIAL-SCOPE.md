# BOQ Disclosure and Linked Customer BOQ Versions

**Current Owner-confirmed BOQ successor — 21 November 2026 / DEC-054:** Section 3 is the single current policy for BOQ visibility, raw/customer quantities and approvals. It supersedes only the affected DEC-034/037/047 directions. This is a requirements publication: existing runtime, grants, workflow configuration and accepted V1.3 history remain unchanged until bounded successor delivery. [Decision record](DECISION-LOG.md#dec-054--boq-quantity-disclosure-customer-buffer-and-cost-self-approval).

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
4. Support explicitly entered customer quantities/UOM and reviewed source mappings for agreed examples. Section 3 records the later selected-line quantity-buffer requirement; it is distinct from price markup and not delivered by the historical V1.3 contract. Printed Excel row numbers or matching descriptions are not source identity. Block undefined conversions/assembly assumptions; no inferred L/S conversion.
5. Current successor approval: Ben function prepares and approves its own Cost BOQ; Ben prepares Customer BOQ and Nancy approves it. Section 3 bounds the Cost BOQ-only self-approval exception. The former Ben-to-Khaimook Cost approval remains historical V1.3 evidence. Company/Project authority, audit and other maker/checker controls remain; no implicit SYS_ADMIN business authority or literal person-name checks.
6. Preserve THB-only new monetary activity, Decimal precision, original historical denominations/NULLs, approved budgets, audit and stock/Finance ledgers. Use minimum forward-only schema changes with actual previous-release upgrade and compatible paired database/Documents recovery.
7. Update affected canonical Cost/Management/source consumers and disclosures. Estimates/customer pricing create no Actual/Paid posting or second financial ledger.
8. Deliver focused regression, stable-candidate DEC-022 review, exact-head push/PR/main CI and targeted human UAT with a separate release-exit decision.

## 3. Current Owner-confirmed BOQ policy — DEC-054

This section is the single current requirements source for the decisions below. It replaces the former Khaimook Full Cost/Cost-approval route and DEC-047's Jai/Porn Full Cost successor direction. Historical observations, original 112 IDs, accepted V1.3 criteria/evidence and earlier decision records are retained. Publication does not attest effective user grants or implemented behavior.

### 3.1 Visibility

| Business function | Cost BOQ | Client BOQ |
|---|---|---|
| Ben and Nancy | Raw material quantities, unit costs, line amounts and total costs in authorized Company/Project scope | Authorized full commercial detail |
| Khaimook, Jai, Porn and other employees with existing BOQ access | Material/item description, UOM and raw quantity before buffer only; no unit costs, line amounts or aggregate cost totals | No Client BOQ access |

Quantity-only policy does not give every employee BOQ access. Existing Company/Project boundaries remain, as do separately authorized Procurement/Finance actions. BOQ confidentiality does not itself revoke ordinary PO/invoice amount access required by those separate workflows.

Enforce this matrix through persisted backend authority and safe response projections, as well as UI, summaries, history, direct IDs, source drilldowns, reports, print/export, attachments and caches. A hidden column/link is insufficient. Reconcile combined-role permission unions and rate-bearing documents so another route cannot disclose BOQ money or customer buffers to quantity-only readers. Ben/Nancy's business functions must use configured scoped capabilities, not hard-coded personal names or technical-admin privileges.

### 3.2 Raw and customer-facing quantities

- Cost BOQ contains the raw material quantity before any customer buffer.
- Only selected Client BOQ lines may include additional material quantity buffer; it is not mandatory on every line.
- Keep raw quantity, buffer quantity and final customer-facing quantity separately traceable for each affected line, with compatible UOM/source mapping.
- Illustrative same-UOM case only: raw 100 units plus buffer 10 units gives customer quantity 110 units; Cost BOQ remains 100 units.
- Client buffer must never update raw Cost BOQ quantity, approved Original Budget, historical cost snapshots, stock, commitments or actual/paid costs.
- Reuse the canonical approved cost revision, durable source IDs and independently versioned Client BOQ. Preserve immutable approved versions; do not create a second editable cost ledger or silently resync history.
- Quantity buffer is separate from price markup. No standard buffer value, percentage formula, automatic uplift to prices or change to the accepted MANUAL/MARKUP pricing contract has been selected.

Before buffer implementation, specify absolute-versus-percentage entry, precision/rounding, mixed-UOM/split/roll-up mappings, interaction with manual/markup pricing and customer print presentation. Source/customer quantity differences alone must not be retrospectively classified as buffer. These are design inputs, not a reason to re-ask the already confirmed visibility or approval choices.

### 3.3 Approval

| BOQ | Preparer | Approver |
|---|---|---|
| Cost BOQ | Ben function | The same Ben function/user may approve its own Cost BOQ |
| Client BOQ | Ben function | Nancy function; existing separate-approver controls remain |

Khaimook is removed from the intended Cost BOQ approval route. Ben's self-approval is an explicit Cost BOQ-only exception, not a global maker/checker removal or permission to self-approve other budget, Finance, Procurement or Client BOQ records. The implementation must bind the exception to the correct scoped BOQ action, retain separate preparation/approval audit events and still verify actual actor, Company/Project authority, state, revision and concurrency. It must not bypass approval or mark a draft approved merely on creation.

### 3.4 Delivery boundary and verification

Publication records the Owner's policy change; it does not activate roles, edit live approval workflows, migrate/backfill data, rename historical approvals or reopen accepted V1.3 work. Active UOM/prototype work keeps its current writer and priority.

A bounded successor must reconcile BUD-011–015 / BQC-AC-001–007/010–011 with this section and the existing approval/disclosure surfaces before coding. Reuse quantity-only projection and linked-version mechanisms. Prove the revised positive/negative role matrix including combined roles and alternate money paths; raw/customer/buffer isolation and approved-history preservation; Cost-only self-approval plus continued denial for unrelated self-approval; and unchanged Ben-to-Nancy Client approval. Applicable schema/auth/history changes require stable independent DEC-022 review and the current CI policy. Human UAT follows the frozen integrated prototype under DEC-042. No new default buffer, review waiver, milestone closure or Production authority is inferred.

## 4. Entry inputs and resolved scope choice

| Input | Current disposition | Concrete preparation |
|---|---|---|
| D1 — Disclosure/actions | Historical V1.3 and DEC-047 decisions remain source evidence; DEC-054 / Section 3 is now the successor visibility and approval policy. Effective permissions and scoped Cost self-approval remain governed implementation work. | Use the [entry surface map](BOQ-ENTRY-PREPARATION.md). Do not mutate current roles to make the future matrix appear implemented. |
| D2 — Source mappings | C1/C2 and E1–E3 in [entry baseline](BOQ-ENTRY-PREPARATION.md) are OWNER APPROVED under DEC-037; synthetic values are adopted business examples, not actual owner prices. | Explicit source IDs, independent quantity/UOM and split/roll-up shares; no inferred conversions. Keep synthetic values distinct from actual owner prices and runtime PASS evidence; the owner has adopted the examples as expected business outcomes. |
| D3 — Pricing/precision/revisions | Manual rates and percentage markup, up-to-four-place quantities/rates, half-up two-place lines, summed rounded lines and newly approved revisions are owner selected. C3–C5/E4–E8 resolve source basis, derived-rate rounding, discount/zero/fractional edges under DEC-037. | Implement the exact adopted examples in [entry baseline](BOQ-ENTRY-PREPARATION.md). Target gross margin remains deferred; no actual rate/percentage is assumed. |
| D4 — First slice | **APPROVED:** disclosure and linked Customer BOQ versions together; broader costing and lifecycle work remain separate. | No repeat approval of this package or the THB scope is needed. Resolve only genuinely open inputs. |

V1.2 owner UAT/release closure is COMPLETE. BOQ business-input decisions are OWNER APPROVED. Entry publication/CI/review/merge/main gates are COMPLETE through #274/main CI40680993646, as recorded in #266. V1.3-B implementation is tracked by #275.

## 5. Historical V1.3 requirement / acceptance contract

The criteria below retain the accepted V1.3 contract as historical evidence. DEC-054 / Section 3 defines the later successor changes and verification boundary; do not apply this historical Ben-to-Khaimook route or blanket no-self-approval wording as the current requested Cost BOQ policy. The remaining criteria below stay unchanged for their historical scope. Actual software technical evidence, retained-configuration limitations and separate human gates are mapped in the [consolidated packet](V1.3-BOQ-CLOSURE-PACKET.md); technical PASS does not self-approve business acceptance. DEC-038 and the [V1.3 release-exit record](V1.3-RELEASE-EXIT.md) now record both actual separate Owner decisions and the resolved retained-evidence disposition; final publication gates remain live in #266. No requirement or historical observation is changed.

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

## 7. Historical V1.3 delivery order and authority

1. Preserve published DEC-034 scope and the verified V1.2 COMPLETE + ACCEPTED closure. The owner instructed progressing BOQ first, HR next in stages.
2. C1–C5/E1–E8 and HR publication are owner approved under DEC-037. Publish the resolved V1.3-A baseline and complete its normal entry gates. No completed V1.2 UAT is reopened.
3. Establish the resolved successor entry baseline through existing governance and applicable normal gates. Use V1.3 as the coordination label; do not claim runtime implementation has started until entry publication gates pass.
4. Implement the approved slice with one active writer, meaningful denials/integrity/upgrade tests and stable-candidate DEC-022 review; merge normally and verify exact-main CI.
5. Targeted successor human UAT and separate release exit remain required.

DEC-008/016/022/029/030/033 and [Project Governance](PROJECT-GOVERNANCE.md) remain mandatory. DEC-034 records this new bounded scope; it does not amend predecessor or human gates. See [Current State](CURRENT-STATE.md) and #266 for actual publication/entry status.

