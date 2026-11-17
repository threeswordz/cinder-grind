# Transfer creation failure — candidate correction and preserved Mac continuation

18 November 2026 SGT. Owner-reported first actual Mac transfer deployment on integrated 97db9151 returned PROBE_TR_CREATE_HTTP_500 at SOURCE_API. Read-only diagnostics confirmed the preserved dump and configuration exist, no source/ready receipt, and exactly one PostgreSQL error TRANSFER_NEW_PROVENANCE_REQUIRED in erp_transfer_custody_guard. Existing receiving receipt remains complete. Do not retry the original launcher.

## Bounded candidate

In 20261117001000 the custody creation guard rejects header.created_at earlier than transaction_timestamp(); 20261117002000 uses the same clock boundary to require new-source provenance. The header has TIMESTAMPTZ(6) storage, while ORM-generated timestamps can be supplied from a different clock or with lower precision. The specific failed row rolled back; its exact timestamp is not available from the sanitized Mac receipt. Clock mismatch is the leading hypothesis, not an independently reproduced Mac predicate.

Use parameterized SQL only for the new controlled header inside the existing serializable application transaction, with exact database transaction timestamps and the original database UUID default. Legacy Prisma creation, scope, approval, event, ledger, historical and database guards stay unchanged. No migration, grant, financial logic, sequence reset, prior receipt or data rewrite. Existing separate sequence allocation may consume a number on failed creation; preserve this gap and verify actual state before any continuation.

The registered native HTTP suite includes a deterministic backdated-header guard rejection with rollback/count proof, an exact database-clock comparison of the candidate insert, then the actual existing HTTP journey. This is pending native execution; no local PostgreSQL/browser validation or Mac success is claimed. Independent DEC-022 review, exact-head push/PR, guarded integration and exact-main validation precede deployment. Do not deploy this patch alone to a partially upgraded Mac.

## One continuation contract (not yet executable)

Read the existing failure, source and build identities, preserved dump and inventory, exact five applied migrations, committed configuration and policy enablement; compare current database/file state against the pre-upgrade snapshot and verify every admitted partial delta, including number sequence allocation and revoked sessions. Use a separately owned populated rehearsal before one reviewed continuation. Do not replay configuration, receiving, FM03 or material; do not reset the failed stage or roll back schema. Record actual successful creation/submit/approval/assignment/dispatch/receipt and final preservation proof only after observed evidence. Stop on unexpected partial state. No retained MKE/TCJ or Production authority.

Prototype4/8, GL3/10; no milestone closure.
