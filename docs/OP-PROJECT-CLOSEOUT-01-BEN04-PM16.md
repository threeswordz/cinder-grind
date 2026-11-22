# BEN04 / PM16 — governed operational Project closeout

**Status:** development candidate on an isolated branch. **Not integrated, not Production-approved, not a substitute for Finance settlement or independent source reconciliation.** The currently verified `main` remains `3a441b1f` (FM02); Project milestone M4 remains open.

## Authorized business model
Khaimook (PROJECT_MANAGER) prepares the six-category operational readiness assessment. Ben (MANAGEMENT) and Nancy (FINANCE_MANAGER) each sign the **exact same immutable preparation** independently. This records an **operational** closure assessment, NOT an unconditional financial clearance, Project archive, stock movement, debt waiver or customer acceptance.

The six categories are work/customer acceptance; POs/subcontracts; AP/AR/payments; material/tools/assets; Cost BOQ/VO/project cost; and handover/supporting documents. Each demands a source reference and a reasoned evidence note. A WARNING must have one or more surviving follow-up items with explanation, same-Company active Employee owner, due date, and remaining amount, quantity with UOM or explicit explanation why neither is measurable. A CLEAR category must not contain unresolved items. Pending supplier invoices/stock obligations are **not settled by signing**. THB amounts are recorded as references and are NOT posted.

## Source/authorization control
- Existing `ProjectAccessService` requires active Company Employee and assigned Project (or specific independently authorized all-Project capability). No unrestricted Company cross-scope listing.
- Prepare: active Project, `PROJECT_MANAGER` role and existing `projects.project.edit` permission. Sign: Ben / Nancy separately using their existing signed roles and `projects.project.view`; simultaneous Ben+Nancy actor is not silently authorized. The preparer cannot sign. CSRF mandatory on all writes.
- Preparation and signs are append-only, keyed to Company and Project in the existing audited source; transactions serialize writes with Project row lock. Source SHA256 binds normalized 6-check content, version and preparer. Revisions need an explicit reason and invalidate the prior signatures without deleting prior events.
- The result `JOINTLY_APPROVED` is an **operational control state**. `projects/:id/archive` remains an entirely independent administrative action; no automation calls it.
- Neither source verification against every Finance/Inventory/Document record nor a new actual stock, AP/AR, subcontract or asset state change is claimed. Six references are human-attested and need risk-based source review and integrated browser evidence before milestone closure.
- UI exposes English/Thai/Traditional Chinese forms with owner choice and warning register. No assumed financial limit, monetary conversion, ability to reverse approved transactions or implicit SYS_ADMIN override.

## Technical evidence and remaining gates
Pure source/authorization contract tests cover exact categories, warnings, reason/date/owner/amount/quantity, deterministic digest, versioned preparation, two independent signatures, actor separation, tampered/stale evidence and append-only invalidation. [Focused #45042067905](https://github.com/threeswordz/cinder-grind/actions/runs/45042067905) **SUCCESS**: affected-source tests and NestJS API/React web typechecks. Single-use workflow deleted from candidate. No database, browser, full release CI, Mac or Production executed.

**Before release:** independent DEC-022 exact-head security review; address any P1/P2; add native Postgres integration proof for authenticated actor, Project/Company scope, append-only event ordering/concurrency, stale source and no Finance/stock side effects; one authorized stable full release gate and guarded integration. This is only one M4 functional gap; **all 112 requirements, FM01 and emergency/stock governance remain**.

**Do not close M4 or change GL counts from this isolated package.**
