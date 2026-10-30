# HR1-A — Canonical private Document custody / schema increment

**Status:** implementation candidate on #295, *not* complete HR attachment functionality, Owner business acceptance or Production activation.

**Predecessor gate:** #293 merged to main `032ceab30c8af0dc701851ccdd2a8c4b77d082ae`; [exact-main push CI41083230338](https://github.com/threeswordz/cinder-grind/actions/runs/41083230338) **SUCCESS31/31**. #293's PR-only push-run waiver DEC-040 is not reused here.

## Purpose and security properties

This is the minimum forward-only relational foundation to tie **one immutable private attachment version** to a canonical Document byte record and **one Company-owned Employee**. No second file store, employee ledger or automatic role grants:

- `HrDocumentAttachment` points to `Document` and `Employee` through composite `(companyId,id)` foreign keys. `Document` receives the required additive `@@unique([companyId,id])` index; existing Document data is not rewritten.
- Versions are append-only `(Company,Employee,version)`, beginning at 1; SQL locks the Employee when validating the next version, rejecting concurrent duplicate/stale versions.
- The referenced canonical `Document` must have `hr-private.enc`, `application/octet-stream`, positive **ciphertext** size, LOCAL storage and a SHA-256-shaped **ciphertext** checksum. Its generic Document Type must be active and owned by the **same target Company**; a foreign or inactive type fails at both HR-link and custody boundaries. The original filename, original MIME and plaintext bytes must appear *only* inside the existing reviewed authenticated encrypted envelope and private metadata, never in generic file columns.
- At commit, every attachment must have exactly its HR source association `HR_ATTACHMENT` → the same Employee. A forged or mixed `PROJECT`/WBS/transaction link makes the database transaction fail, including attempts to add a generic source after the private record exists. Private source links cannot be removed/rewritten.
- The `HR_ATTACHMENT` exception to generic same-Company linker rules requires the actor's active native role with `hr.documents.manage` **and** a persisted active target-Company `documents` entitlement; Company status and user status must also be active. Generic `PROJECT` and all other source links **retain** the legacy native Company equality rule. Direct SQL custody-row writes recheck the same authority, including revocation between link and custody creation.
- Private attachment actor, canonical Document uploader and HR source-link creator must be the **same actual user**; a second authorized HR user cannot forge attribution. The client/service must additionally recheck the live session and target grant in its serializable transaction.
- Private attachment history and the canonical Document record become immutable, preserving old ciphertext/key provenance. Referenced Employee code/Company changes are additionally blocked. Unreferenced Employee edit behavior is unchanged.
- No private Document Type is seeded. A later dedicated HR adapter must select an already authorized, active, generic, Company-owned Document Type without exposing special HR-private type existence via generic type-list endpoints.

## Synthetic executable evidence

`apps/api/src/hr/hr-document-ownership.integration.spec.ts` is added to `apps/api/package.json`'s normal API test command. It exercises Company/Employee/Document FK mismatch, missing/private vs forged Project links, version skips/duplicate ownership, canonical generic-name validation, immutable Document/HR source links/private metadata/employee code, deferred commit rejection and rollback. The fixture is **schema-only with synthetic placeholder metadata**, not a real encrypted upload/download, byte-equal recovery drill or retained role UAT.

The existing CI migration, prior-release upgrade/preservation/rollback, Prisma generation, API tests and disposable recovery stages remain mandatory. Any failures on those gates must be corrected before review/merge.

## Next governed increment within approved #295

Implement dedicated CSRF-protected memory-only upload, protected metadata list/history and authorized no-store file download, using:
- the already reviewed `HrPrivateCrypto` / `sealHrPrivateAttachment` / `openHrPrivateAttachment` with exact `(companyId,employeeId,documentId,version)` bindings;
- `HrService` persisted live session/role/category action and target-Company grant checks **inside** serializable transactions;
- `DocumentStorage.put(ciphertextBuffer)/read/remove`, **never** generic `DocumentsService.uploadProjectDocument` or plaintext disk tempfile;
- durable request-id/keyed replay, concurrency/rollback/orphan cleanup and explicit audit pointers without private values;
- actual encrypted-byte + external-key isolated restore, alias/metadata/CSRF/browser/role negative tests and final independent review.

**Out of scope:** actual upload/download routes and UI in this schema increment; attendance/OT/payroll, new Accounting, retained grants/data, Production infrastructure changes, customer BOQ UAT repetition, or a PR-specific Codex/CI waiver. The parent #283 Owner HR business acceptance and a later real Production go/no-go remain separate.
