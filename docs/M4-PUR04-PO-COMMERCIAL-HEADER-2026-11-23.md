# M4 PUR04 — draft-only PO commercial and delivery header (staged, UNVALIDATED)

## Scope and source
- M4 4/8, GL 3/10. Stacked on [PM02 Draft #412](https://github.com/threeswordz/cinder-grind/pull/412), not main. No Production, retained actor grants, Mac reruns or Finance changes.
- Owner's [Jai PUR04 requirement](../ROLE-REQUIREMENTS-2026-10-30/04-jai.md) includes delivery point/contact/terms, discount, freight, charges, VAT, credit and payment terms on a single-Project award-backed PO.
- This is a **bounded data/UI representation slice**, NOT the full PUR01 quote-compliance gate, PUR07 supplier PDF, PUR12 K-/T- numbering or PUR10 cancellation approval.

## Staged source
1. Forward-only nullable migration `20261123181000_pur04_po_commercial_header` adds five text fields and four numeric columns to `purchase_orders`. Existing rows are untouched; NULL means unknown, not monetary zero. The database checks nonnegative amounts and VAT percent 0–100.
2. Existing `PurchaseOrderService.updateOrder` accepts draft-only edits and records old/new header values in existing append-only audit. `revise` copies the predecessor's exact new terms to the new draft revision; no existing immutable approved row rewritten.
3. POST/submit still uses the existing approval and scope guards, plus a new **discount ≤ current PO line subtotal** check before creating an approval instance. It does **not** pretend the separate 1/2/3 quote policy has been enforced.
4. Existing authenticated, CSRF-protected PO PATCH route validates optional text and nonnegative amounts. Existing web PO header form now supports all nine fields, read-only after draft; no new role permission or SYS_ADMIN business bypass.
5. One **new dedicated** `purchase-order.pur04.integration.spec.ts` isolates a fresh synthetic Company/Project/Supplier/User and checks draft persistence, null clear semantics, VAT-boundary denial and SQL negative-amount denial. Do NOT rerun the historical 2,400-line PO suite just for these fields.

## Unresolved acceptance gates / do not overclaim
- **New code, migration, React and test have NOT BEEN EXECUTED**. Fresh source is for independent review and one truly focused disposable PG17.11/API/Web check when permitted. No full PR CI launched.
- Need actual PostgreSQL migration + Prisma client generation + API/Web typecheck and target-only integration test; inspect exact failures before considering any rerun.
- Need explicit revision-roundtrip plus real actor/UI evidence, field-length/amount precision checks and cross-Company/Project negative access; a source draft is not business acceptance.
- **PUR01 is still missing:** whole-PO net-after-discount + freight/charges ex-VAT basis, 1/2/3 qualifying supplier quotation requirement at THB 10,000/50,000, documented special-supplier exception with Ben review, and immutable approval snapshot. NULL commercial amounts must not be silently treated as quote-compliant zero. Design the integrated quote gate only against complete accurate commercial amounts and source quote coverage, not an invented count.
- **PUR04 remaining:** precise VAT calculation, delivery-specific dates/contact policies, credit terms and retained Ben approval are not yet demonstrated end-to-end. Keep #245 multi-Project PO, tax/accounting posts and existing receipted/approved POs unchanged.
- **PUR07/PUR12/PUR10** remain separate actual gaps; do not bundle speculative financial or supplier action.
- Full release CI requires fresh specific Owner authorization per [#384](https://github.com/threeswordz/cinder-grind/issues/384). Final M4 exit needs consolidated exact-source independent review, required evidence, guarded main merge and Owner technical acceptance.
