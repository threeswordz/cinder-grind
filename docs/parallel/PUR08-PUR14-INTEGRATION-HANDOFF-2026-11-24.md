# PUR08/PUR14 — source-only authenticated workflow implementation handoff (24 Nov 2026 SGT)

**Owner goal:** complete ALL 112 role requirements in authorized Production by 31 December 2026. This is an implementation handoff on isolated branch `work-m4-pur08-pur14-supplier-lifecycle-contract-20261124` based on frozen integrated Draft PR #427 `435bd8805d5bcd7e0a1a9941668b67860f288b78`. No main merge, new retained grant, full CI, real business UAT or Production authorization.

## Delivered source

- `supplier-delivery-lifecycle.ts`: pure transition contract, evidence-backed human Jai/Store/Khaimook separation, active Company/Project/actor policy inputs, expected revision version, no PO/GR/stock/Finance mutations.
- `supplier-delivery-lifecycle.test.mjs`: seven focused pure business-rule tests. **Local Node 22 `node --experimental-strip-types --test supplier-delivery-lifecycle.test.mjs`: 7/7 PASS** on the original unchanged pure contract; `tsc --noEmit --strict --target ES2022 --module ESNext` PASS on same file.
- `supplier-delivery-case.service.ts`: new auditLog-backed history, explicit previous-event chain and state/action consistency, transaction advisory lock, live DB session/active employee and current Company role grants, Project-access denial, verified active same-Project linked Document and actual posted nonreversed Goods Receipt when replacement recorded. First ACKNOWLEDGE requires existing **PUR07** user-reported external dispatch acknowledgment linked to the correct approved PO. No database schema change or duplicate send.
- `supplier-delivery-case.controller.ts`: GET read, CSRF-guarded POST events, request validation. Supports Store/PM/Jai using their distinct existing permissions, no SYS_ADMIN blanket authority.
- `procurement.module.ts`: registers new Nest service/controller.
- `SupplierDeliveryCasePanel.tsx`, `PurchaseOrdersPanel.tsx`: new non-posting MUI workflow in approved PO view, with stage-aware role actions and clear external-evidence warning. **Store-only users without PO view may require a separate accessible entry point**; don't infer they can navigate to the PO screen.

## Verification status and blockers

**Not executed on integrated branch:** dependency-backed NestJS/Prisma API typecheck/compile, native PostgreSQL 17.11 migrations + transaction race tests, authenticated API/CSRF/session revocation/Company-Project/browser checks, full React build and real retained eight-role proof. Do not mark API/browser PASS or source release-ready. No GitHub Actions was launched for this code.

**Security/behavior constraints requiring focused integration tests:**
- Audit previous-event link must stay single-chain under concurrent Postgres transactions; stale `expectedPreviousEventId` and `expectedVersion` must fail closed.
- All 8 required roles need correct access/denial; Store Site access from actual Store navigation may require a separate UI path if it cannot see PO.
- Document must be active, linked to the same Project and Company; uploading a UUID is **not** independent proof of the actual external message or stored file bytes.
- Existing PUR07 dispatch/ack is a user-reported external event, not proof supplier agreed automatically; no arbitrary acknowledgment merely because a PO has `expectedDelivery`.
- Existing posted GR ID is not proof of a supplier *replacement* by itself; an independent claim/source remains necessary and must be accepted by the business Owner.
- The new return dispatch event does **not** deduct stock or issue a refund/credit. Actual physically posted/approved supplier return and Finance implications require separate source design/policy and proper independent approval; never quietly treat an internal material issue return as supplier return.
- Audit replay validates chain/state and actor IDs but does not cryptographically protect the entire audit log against privileged DB manipulation. Existing repository governance applies.
- No user/account role grants, supplier notifications, auto PO revision, stock postings, Finance postings, migration or Production changes.

## Next smallest verified sequence

1. Execute one **focused** API+React typecheck and the prepared new pure contract test on disposable test source, not full suite. Fix any actual compile findings.
2. Run bounded native PG17/HTTP test of Jai's existing PUR07 ACK → imported case, Store's real short/damage evidence, independent PM decision, Jai claim, Store return/posted replacement GR readback; test stale races, session revocation, foreign Company, wrong Project, wrong Doc/GR, cancellation/revisions, no stock/Finance mutation.
3. Confirm Store UI navigation and the real named actor UAT gate. Distinguish synthetic test proof from retained permission readback.
4. Independent DEC-022 exact integrated source review and Owner #384 release approval; no self-approval, no redundant full CI.

**Estimate ledger:** discovered PUR08/14 scope gross 50h before bounded new source; provisional 40h *still remaining* after this code. Gross/delta are planning judgments, not actual measured engineer hours. Previously existing 60 packages estimated 1,845h after 2h source-triage saving, **excluding** this gap. Accurate provisional full-ERP remaining after pricing = **1,885h**. Formal prototype 4/8, GL3/10, M4 technical 20/32 last recorded, M4 package acceptance 0/8 unchanged.

**No release claim:** source only, untested integrated API/UI, no independent or Owner business acceptance.


## Focused correction — discrepancy without supplier acknowledgment

- Store Site may record actual short/wrong/excess/damaged receiving evidence (on already-approved/linked PO) before Jai receives a supplier acknowledgment. The supplier's acknowledgment is a separate PUR07 evidence event; lack of acknowledgment must not block legitimate Store observations.
- Supplier DELAY and IN_TRANSIT still require a prior recorded acknowledgment: no fabricated supplier status from a PO expected date.
- Exact pure policy and 7 focused tests rechecked locally, source blob SHA `3d52eea77e198f48c0e4c1d931723340b830bb66`, test blob SHA `ad578d968eb633feea57cc3fd9725266fc19d06e`; both match GitHub blobs. Local strict TypeScript source `tsc --noEmit --strict` PASS. **No claims of Nest/Prisma/React compile or real database execution.**
- Source-audited supplier lifecycle remaining estimate provisionally **39h** (previously **40h**), 1h of likely future defect triage/rework eliminated by the verified source correction. This is **estimated future work**, not measured labor or acceptance.

## 24 November 2026 SGT — focused verification and Store site access update

**Source evidence exact matching:** Nine relevant API/UI/test Git blob SHAs compared between the isolated source branch and the disposable CI branch; all nine are byte-for-byte identical. The workflow YAML differs only on CI branch (not part of production source). No protected main / PR #427 source edits, retained roles, external notification, inventory or Finance posting, or Production operations.

**Verified focused runs (not full release CI):**
- [#45349257055](https://github.com/threeswordz/cinder-grind/actions/runs/45349257055): **PASS API TypeScript, PASS React TypeScript, PASS seven pure policy tests, PASS Prisma migration, PASS native test compilation**. Overall run **FAILED** at native fixture creation because two synthetic Store principals had a duplicate disposable Company role. This was *test setup*, not business code. Earlier #45348954124 exposed one strict optional TS controller error that was fixed; #45348770341 had invalid YAML and created no test jobs.
- [#45349684998](https://github.com/threeswordz/cinder-grind/actions/runs/45349684998): **SUCCESS**, actual PostgreSQL **17.11**, corrected synthetic-role fixture, native supplier-case **1/1 PASS**, including live session/role Company/Project authorization, actual PUR07 linked acknowledgment, authenticated service stage readback, Store-first discrepancy, independent PM/Jai chain, concurrent PM version conflict, foreign-Company/Project document denials, session revocation and no unwanted stock/AP/Finance posting. This is *synthetic native PG service testing*, not real retained human UAT or full HTTP/Chrome.
- [#45350220558](https://github.com/threeswordz/cinder-grind/actions/runs/45350220558): **SUCCESS**, isolated **React TypeScript PASS** after Store receiving integration. New Store Site UI entry is in `apps/web/src/inventory/ReceivingPanel.tsx` via existing `InventoryWorkspace` roleCodes and prefilled authorized linked receiving evidence `documentId`. Retained-user Chrome/browser execution is still NOT performed.
- No redundant full suite, no full CI, no protected merge. The initial malformed YAML was fixed; later retries reused passing steps and ran only the newly unproven native or UI target. The disposable test workflow is deliberately restricted to the isolated CI branch; not merged.

**Remaining critical work for actual PUR08/PUR14 acceptance:** verify real HTTP CSRF/cookies and Chrome with scoped Jai/Store/Khaimook, right Project and wrong Company/Project, actual uploaded evidence bytes, reliable supplier acknowledgment/return/physical stock and Finance credit treatment under Owner-approved policy, true return-to-supplier packing/quantity/dispatch and replacement item traceability, positive posted replacement GR path, re-run targeted tests only for code changed by further implementation, independent DEC-022 review, named human UAT and explicit Owner integration/release decision.

**Progress reconciliation:** newly priced original supplier scope gross 50h -> 39h after earlier policy/initial source; after source-bound API+React typechecks, 7 pure contract PASS, native PostgreSQL 1/1 PASS and Store UI typecheck, coordinator re-estimates remaining supplier scope **39h→32h**, a provisional **7h reduction in *future work still required***, not actual worked staff hours nor a formally accepted package. The canonical main 60-package ledger 1,845h is otherwise unchanged, so the updated total becomes **1,877h → 0h**, M4 becomes **147h remaining**. Estimated reduction is low confidence and can change if business return policy needs more implementation. Remaining 32h is not a delivery guarantee.

**Do not assign formal acceptance:** prototype 4/8, GL 3/10, M4 full packages 0/8, DEC-022 independent still open.
