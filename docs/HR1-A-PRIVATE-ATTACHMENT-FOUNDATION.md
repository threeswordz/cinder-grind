# HR1-A private attachment foundation — encrypted custody and generic-route barrier

**Scope:** approved HR1-A #283 / DEC-039, HRA-AC-004–006/012–014. This is a bounded **implementation increment**, not completed employee attachment APIs, retained activation, HR Owner acceptance or Production readiness. Source base main `8ff9a6362244951ea77acb9812e508520538ba0f`, exact-main CI [41035261568](https://github.com/threeswordz/cinder-grind/actions/runs/41035261568) SUCCESS31/31. Single implementation writer remains the Owner-authorized Chat.

## Implemented boundary

- `hr-private-attachment-codec.ts` wraps the existing approved authenticated HR encryption (category `document`, external versioned keys, fresh GCM nonces and authenticated Company/Employee/record/version binding). It encrypts both file bytes and the original filename/MIME/size metadata.
- Only `hr-private.enc`, `application/octet-stream`, the **ciphertext** byte size and ciphertext checksum are permissible generic canonical Document metadata outputs. Do not persist original filename, MIME, plaintext checksum or raw bytes in general Document storage/audit.
- The codec has no temporary plaintext file path, introduces no mandatory paid service and reuses the canonical `DocumentPolicyService` MIME/filename policy without widening it. Initial maximum plaintext size is **8 MiB** to stay within the existing 16 MiB HR authenticated encryption bound and limit memory use; larger-file handling needs separate design/performance tests, not an exception.
- Generic Document list, direct download, archive/reactivate and target alias rendering fail closed for documents having **any** `HR_...` source link, even with a mixed `PROJECT`/`WBS`/Finance source link, `projects.access_all`, documents permissions or HR capability. Tests cover generic metadata, bytes, WBS mixed alias, archive and zero source-storage reads or audit writes.
- The source classifier is a generic-path **deny-only** primitive. It grants no dedicated HR read access, does not create HR sources or grant private documents to Project roles. Future dedicated HR routes must independently revalidate current persisted action capability plus target Company/document category entitlement within transactions.

## Explicit remaining application work

This increment intentionally **does not** add a schema table, document type, upload route, dedicated download/reveal endpoint, retained grant, configuration change, final file audit, idempotent replay, durable cleanup/rollback or restore proof. Implement those together in the subsequent governed canonical document integration, ensuring:

1. Server-side authorization before treating an employee/document as accessible; no generic ID enumeration or private metadata leakage.
2. Multipart memory-only custody, no plaintext temp file, bounded body and MIME/extension policy; clear upload buffers on all exits.
3. Canonical Document + immutable protected HR document/employee link using scoped DB constraints, no alternative ledger or unprotected Project links; no private document type being disclosed via generic Document Type routes.
4. One atomic replay/version receipt, fail-safe rollback/cleanup after storage or DB failure; no duplicate ciphertext/posting under concurrency.
5. Real nonempty encrypted bytes and externally held key versions survive a **disposable** dump/restore; missing/retired keys and mixed generic/direct aliases deny safely.
6. Disposable role-focused HTTP/browser and independent Codex privacy/schema review, exact-head PR CI and exact-main CI. Retained activation, full HR business acceptance and Production remain separately gated.

Existing BOQ/THB business acceptance is unchanged; this release-candidate regression does not reopen or repeat human UAT. All new accounting, attendance, leave/OT, payroll/Finance posting and multi-Project Finance remain deferred/outside scope.
