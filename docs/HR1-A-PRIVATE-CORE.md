# HR1-A private-record core — implementation and threat model

This is the first bounded code increment of the approved [HR1-A entry](HR1-A-ENTRY-CONTRACT.md), DEC-039 / #283. Entry #285 merged at `f5f575b0184ea9883670209657dd9dbc77a04c29`; exact-main CI40870435229 passed before implementation began. This increment implements internal cryptographic primitives, not an employee register or completed HR1-A. Its schema and public API are unchanged. No private data, key, grant or retained configuration is created by it.

## Implemented boundary

`apps/api/src/hr/hr-private-crypto.ts` uses Node's built-in authenticated AES-256-GCM, random 96-bit nonces and 128-bit authentication tags. Every seal/open authenticates a fixed ordered binding containing Company, canonical Employee, category, immutable private record identity and positive revision. Moving ciphertext to another Company, employee, category, record or revision fails authentication. The primitive returns bytes only after tag verification; the intermediate unauthenticated buffer is cleared on success and failure. Callers own and must clear returned plaintext when no longer needed.

Externally provided 256-bit root keys are versioned by `HR_PRIVATE_KEYS` (a JSON object mapping key IDs to canonical Base64 keys) and `HR_PRIVATE_ACTIVE_KEY_ID`. There is no default/dev key. HKDF-SHA256 derives separate encryption and replay keys and binds the key identifier. All configured keys are validated on every operation; malformed config fails closed. No configuration is cached across operations. These environment variables are not populated by migration, seed, source control, a generic settings API or this PR. Existing startup does not require HR keys while the primitive is unused; later HR private routes must fail closed when keys are unavailable.

The envelope stores only format/key version, nonce, tag and ciphertext. Keyed replay fingerprints prevent a plain stored digest from becoming a guessing oracle for low-entropy identity/bank inputs. A future durable replay implementation must supply canonical request bytes, actor/Company/operation identity and the original fingerprint key ID on retries. This primitive alone provides neither idempotency nor authorization.

Every format, configuration, missing/wrong/retired key, tamper or binding failure produces the same non-sensitive `HR_PRIVATE_UNAVAILABLE` error without the original exception/cause. Root and derived key buffers are cleared after use. JavaScript strings and the external process environment cannot be reliably wiped; protect the process, environment file and host accordingly. The 16 MiB cryptographic input limit only bounds memory consumption; it does not expand or replace existing upload, field, type or storage-containment rules.

## Threats, guarantees and remaining controls

| Threat | This increment | Required before HR1-A completion |
|---|---|---|
| DB/archive reader obtains private values | No plaintext in an encrypted envelope; keys remain external | Integrate all private fields, private correction reasons/history and attachment bytes before persistence; prove with populated fixtures |
| Ciphertext moved across tenants/workers/categories/history | Authenticated binding rejects substitution | Scoped relational constraints, persisted authorization and version/replay transactions |
| Tampering, wrong key or malformed data | No plaintext returned; one safe failure | Safe HTTP mapping, logs/audit assertions and negative direct-ID tests |
| Key rotation/retirement | Active key seals; retained older key opens history and recomputes original replay fingerprints; removal takes effect immediately | Explicit custody/rotation procedure, paired backup/key recovery proof and authorized historical migration if requested |
| Generic Employee/Document route reveals private data | No new Employee scalar, document association or route in this increment | Explicit projection allowlists; deny every generic HR-private document alias even with mixed/forged Project/source links |
| Private upload reaches plaintext temp/storage | No upload or storage path added | Validated bounded memory/stream encryption before durable storage; cleanup/rollback and canonical encrypted Document associations |
| SYS_ADMIN or role union bypasses privacy | Crypto confers no authority and exposes no route | Persisted action capability AND target-Company/category entitlement, mutation recheck, no self-escalation and Project operational scope |
| Compromised application process/host | Outside envelope confidentiality; it can access environment and authorized plaintext | Existing host/process/file access controls and separately reviewed deployment/key custody |
| Repeated/concurrent correction loses history | No persistence introduced | Append-only reasoned revisions, expected versions and durable request replay/concurrency tests |

For key custody, keep deployment-specific key material outside the database, source, logs, evidence and ordinary document archive. Restrict the external environment file and backup to the authorized operator, keep recoverable old key versions while protected history/replay requires them, and restore the paired database/files with the matching key set only in an explicitly authorized isolated runtime. Loss of the last required key makes those records unrecoverable. No retained backup/restore/key operation is authorized or executed by this increment.

## Validation and acceptance mapping

The API's normal `test` command registers `hr-private-crypto.spec.ts`. The tests prove byte-exact multilingual/binary round-trip, independent nonce/envelope generation, every binding dimension, ciphertext/nonce/tag/key relabelling, rotation with historical replay, key removal, absent/malformed/wrong configuration, strict envelope encoding, resource limits and keyed input fingerprints. Local TypeScript compilation and focused tests are recorded in the PR; pinned CI remains authoritative. These are isolated primitive tests; they do not claim database, HTTP, browser, file custody or retained UAT execution.

This contributes to **HR-004 / HRA-AC-005** and prepares the cryptographic portion of **HR-005 / HRA-AC-008**. Neither criterion is complete until integration proof passes. All remaining HRA-AC-001–014 requirements remain active: canonical employee/history and verified person links; explicit HR-only Company/category access; role matrix and generic-path denial; canonical encrypted Documents; concurrency and immutable corrections; UI/locales/cache; strict bounded HR upgrade/recovery; reusable role UAT; stable-candidate independent review; and separate Owner acceptance. Existing THB/BOQ upgrade/recovery modes are unchanged.

Next implementation is the scoped employee/history/private-record data and service layer, followed by canonical protected-document handling, UI and consolidated assurance. No attendance, payroll, financial posting, retained activation or Production authority is implied. Keep this increment's independent review attached to its stable code; review subsequent authorization/schema/file/UI changes under DEC-022 at their stable candidate.
