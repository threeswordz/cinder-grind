# Lane A SS11 Employee Tool/Equipment Custody — integration handoff (24 Nov 2026)

Issue #428 / branch work-m4-ss11-equipment-custody-20261124 / verified starting source 680bca5767652522ef08f72d4df97b6df2732fca (Draft #427).

## Delivered candidate
- Separate employee custody loan, not the existing Project equipment assignment or equipment usage / stock / Finance.
- Existing CG##### Equipment identity required, no asset creation/sync and no depreciation change. Borrower must be an active scoped Employee/Project member; caller needs active employee identity plus equipment.custody permission.
- Site description, issue/due dates, condition-out, actual return date/condition-in and actor captured. Project access enforced on list, borrower discovery, checkout and return; reads bounded.
- Unique one-open-loan index, equipment row locks, project assignment guard, DB deletion/identity rewrite guard, synchronous CHECKOUT/RETURN audit records.
- Equipment custody view/manager permissions seeded WITHOUT any retained role grants. Authenticated MUI panel and API service wired.

## Focused proof status
apps/api/src/equipment/equipment-custody.integration.spec.ts is a *prepared*, not yet executed, native PostgreSQL test: permission denial, inactive borrower, same/foreign-Project, checkout/return contention/replay, assignment freeze, audit and no-delete history. This connector-only worker does NOT have a local PostgreSQL 17 runner or installed node workspace, so migration, TypeScript compile, native HTTP, browser, full CI and retained-role UAT are NOT reported PASS. Coordinator should execute one focused runner after integration.

## BLOCKED_POLICY / BLOCKED_CONFIGURATION
- **BLOCKED_POLICY subcontract worker**: existing Subcontractor entity identifies a Company organization, not a named person and Project-membership authority. Do not fabricate person IDs, contractor eligibility or custody liability.
- **BLOCKED_POLICY asset master**: Jai owns CG##### registration. Equipment table currently has a code, but there is no verified canonical asset-master link. Must reconcile with Jai; this lane refuses non-CG##### checkout and does not mint a code.
- **BLOCKED_CONFIGURATION role mapping**: permission definitions exist; no retained Store Site/Khaimook/Jai production grants have been authorized.
- **BLOCKED_CONFIGURATION retained browser**: original Mac, retained user credentials and Owner DEC-042 acceptance still require separate evidence.

No shared Prisma schema, auth, or asset-master changes were made. Forward-only migration is equipment-scoped; test migration ordering/trigger coexistence during integration. No Owner milestone/hour counter advanced just for source code. Preserve 4/8, GL 3/10, M4 20/32, 0/8 accepted packages and 0/1,900 formally retired until acceptance.

Coordinator: compare to exact 680bca57, run focused migration/PG/role API/browser checks, obtain independent DEC-022 review of final integrated diff, then secure explicit #384 release authorization. Do not auto-merge or self-approve.
