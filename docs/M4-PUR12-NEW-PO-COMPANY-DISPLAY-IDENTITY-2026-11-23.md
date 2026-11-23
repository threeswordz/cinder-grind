# M4 PUR12 / DEC-049 — company PO presentation and partner short names

**Status: draft development candidate, NOT released.** Parent is [PUR01 draft #415](https://github.com/threeswordz/cinder-grind/pull/415), preserving its PM02/PUR04 source. No protected-main merge, retained role grant or Production permission.

## Confirmed owner requirement

The 17 November Owner successor [16-owner-decisions](ROLE-REQUIREMENTS-2026-10-30/16-owner-decisions-2026-11-17.md) supersedes the old full-supplier-name filename and generic PO display: new TCJ PO label `T-PO2610-001 ABC`, MKE `K-PO2610-001 ABC`, where `ABC` is the supplier **short name**, never supplier code or full legal name. Partner short name is independent from existing supplier/customer identity. Old POs and revisions retain their immutable canonical identities.

## Bounded proposed implementation, NOT a business policy acceptance

- Add nullable `shortName` to Customer and Supplier separately, exposed only through existing scoped `master.customer.manage` or `master.supplier.manage` APIs and forms; no auto-grants or migration backfill. Current Nancy master ownership still requires real retained-grant confirmation.
- Preserve canonical per-company `POYYMM-###` in `poNumber`, monthly numbering row and all existing source IDs/foreign keys. For **new MKE and TCJ POs only**, save `displayNumber` as `K-<canonical> <supplier short name>` or `T-<canonical> <supplier short name>` and independently capture `supplierShortNameSnapshot`. Other synthetic/legacy companies retain nullable display and UI falls back to historical `poNumber`.
- Missing or blank supplier short name on new MKE/TCJ PO is fail-closed with `PO_SUPPLIER_SHORT_NAME_REQUIRED`; never silently borrow `supplierCode`. The same-Company/Project active Supplier Award and immutable source constraints remain. Short name preflight is ahead of the existing monthly sequence allocator; a concurrent edit is rechecked in the transaction.
- A revision copies the original saved display and short-name snapshot, not the live mutable supplier name. Additive forward-only migration does not update/backfill old POs and a direct-SQL PostgreSQL trigger refuses updates that alter the saved PO display/snapshot pair.
- The existing number sequence formats use UTC calendar months (`NumberSequenceService.formatBusinessNumber`); this prototype **does not change** the established month reset timezone. **Owner/accountant confirmation remains necessary** if TCJ/MKE want Thailand-local midnight instead. Company canonical number versus display/snapshot is a proposed safety implementation choice pending independent review and Owner role acceptance.

## Not implemented / evidence limits

- The requested **actual approved supplier PDF, deterministic safe filename, manual email/LINE dispatch/acknowledgment** is a distinct PUR07 package, not delivered by this draft.
- No migration, API typecheck, web typecheck, live Company/Project actor test, immutability trigger test, pdf/browser test, independent DEC-022 review or human UAT may be marked PASS until actually executed and cited.
- No #245 multi-Project purchase, financial posting, invoice/GR rewrite, Supplier Code change, legacy retroactive renumbering or external messaging integration.
- Possible tradeoff: keeping canonical PO identity unchanged prevents revisions/source references from breaking, while the new displayed business reference carries a frozen prefix and short name. Check downstream screen labels and PDF in final consolidated M4 UI.

## Focused next acceptance

1. Check new Prisma migration and pure `purchase-order-identity.spec.ts` only; compile changed Nest/Web code once on a disposable PostgreSQL 17.11 and never repeat unrelated older suites.
2. Verify real MKE/TCJ Company+Supplier master values, new PO display readback, missing short-name denial, revised snapshot retention, direct SQL immutability and other-company historical compatibility in **one new isolated integration test**.
3. Complete supplier PDF/dispatch under PUR07, then one independent exact-source M4 review, specifically Owner-authorized final release validation and protected integration. Milestone stays 4/8 until real acceptance exits.
