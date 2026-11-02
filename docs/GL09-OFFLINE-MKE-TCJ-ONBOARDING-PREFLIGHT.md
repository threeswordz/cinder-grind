# GL-09: offline MKE/TCJ onboarding reconciliation

**Scope:** Safe, read-only evidence preparation under Issues #305 and #278, not a Company migration, permission grant, human acceptance, or Production deployment. Historical THB procurement and BOQ UAT must not be repeated.

## Commands (Node standard library; no credentials or external services)

    node deploy/uat/gl09-onboarding-reconcile.mjs --template
    node --test deploy/release-candidate/gl09-onboarding-reconcile.test.mjs
    node deploy/uat/gl09-onboarding-reconcile.mjs --evaluate /secure/private/gl09-evidence.json
    node deploy/uat/gl09-onboarding-reconcile.mjs --fingerprint /secure/private/one-dataset-business-keys.json

Template values are placeholders, never actual MKE/TCJ evidence. An operator may only prepare *aggregated, sanitized metadata* after separate authorization for the actual source and target. Never put employee names, salary, banking, customer costs, document bytes, private IDs, passwords, source rows, or authentication tokens in GitHub/CI. This tool has no HTTP/DB connectivity, write or import mechanism.

## Source-to-target metadata contract

The manifest requires distinct MKE and TCJ business labels. The source and target Company codes must be explicitly supplied by an authorized operator; do not assume database identities. Each Company requires exactly one source row and one target row for each dataset: PROJECTS, WAREHOUSES, UOMS, MATERIALS, SUPPLIERS, ACTIVE_USERS, PROJECT_MEMBERS, APPROVAL_WORKFLOWS, BOQ_BASELINES, DOCUMENTS (20 pairs total across two Companies).

Each dataset row supplies Company label, dataset name, nonnegative count, SHA-256 canonical content digest, and independent rejected-row, duplicate-row and foreign-Company-reference counts. Empty sets use the SHA-256 digest of zero bytes; **nonempty sets must not use that empty-set digest**. A positive count with the empty fingerprint is rejected even when the source and target claim the same invalid fingerprint. Source provenance can be a real 40-character ERP commit or an external-register reference; never fabricate a Git commit for spreadsheets. Target provenance requires the actual ERP commit.

The canonicalization marker GL09-CANONICAL-BUSINESS-KEYS-V1 requires the *same agreed stable business identifiers, normalization and byte serialization on both sides*. This tool compares **declared** fingerprints but cannot produce or verify canonical source exports or validate mapping transformations. Different IDs and approved transformations need a separate, explicitly authorized mapping procedure and independent evidence; never force fingerprints to match. A 48-hour metadata freshness check is an advisory technical preflight, not a new Owner-approved business rule.

The tool detects missing/duplicate Company/dataset scope, count/hash differences, cross-Company references, rejected or duplicate records, inconsistent currency declarations, missing opening-balance or external-accountant scope references, training and rollback declaration gaps. New monetary documents must use THB; legacy currency provenance is preserved. Accounting/payroll development remains deferred under #288.

A scopeReference is merely operator-supplied text; it **cannot** approve pilot exclusions. OUTSIDE_APPROVED_SCOPE and OUTSIDE_APPROVED_PILOT can only reflect separate actual Owner decisions, not create them.

## Truth boundary

Even apparently matching inputs produce DECLARED_RECONCILIATION_CONSISTENT_INDEPENDENT_PROOF_PENDING. The output always fixes realCompanyConfigurationsVerified=false, independentEvidenceVerified=false, actualBusinessAcceptance=false, productionAuthorized=false, gl09GateClosed=false; zero network requests, retained data reads and writes. Real role grants/approval steps, actual data comparisons, cutover/backups, training, independent reconciliation, support and Owner go/no-go still require authorized operating evidence.

Fourteen synthetic regression tests are included through the existing release-candidate test glob. No Production, migration, role, Finance, HR, stock count or CI workflow changes are included.

## Repeatable business-key fingerprint generation (additional GL09 preparation)

The new `--fingerprint` mode reads **only a locally supplied private JSON file** with exactly three fields: `companyKey` (MKE or TCJ), `dataset` (one of the ten declared kinds) and `keys` (array of already mapped stable business identifiers). No HTTP/API/DB calls. It never prints business identifiers, credentials, or file contents. The returned metadata contains Company, dataset, row count, SHA-256, marker, and `dataQualityChecks: NOT_RUN`; independent rejected/duplicate/foreign-Company counts are NOT automatically zero or approved.

Canonical business-key hashing v1: each key must be NFC Unicode, trimmed, nonempty, without ASCII control/DEL characters, <=256 UTF-8 bytes. Duplicates fail closed. Keys are sorted by raw UTF-8 byte order. For nonempty sets, the hash input starts with the canonicalization marker, Company and dataset, each followed by LF; each business key is then encoded as decimal UTF-8 byte length + colon + UTF-8 bytes + LF. Empty sets use SHA-256 of zero bytes, as before. The result is **reproducible for the same mapped keys regardless of row order**.

This is **business-key equality only**, not reconciliation of financial amounts, approval-step grants, employee status, documents' contents, or full business records. The operator must independently verify source/target key mapping, field-level values, external-accountant handoff, and all real Company configuration with explicit retained access authorization. Matching fingerprints cannot authorize cutover, prove identities or close GL-09.

Business keys must also be well-formed Unicode. Unpaired UTF-16 surrogates are rejected with the existing generic `NONCANONICAL_BUSINESS_KEY` error before UTF-8 conversion; otherwise distinct invalid strings would both be replaced by the same U+FFFD bytes and yield an identical digest. A failing-before regression covers that collision and preserves valid surrogate pairs and literal U+FFFD characters. Valid canonical v1 key fingerprints remain unchanged.

**Independent P2 correction:** source and target snapshot freshness is measured against the actual evaluation clock, in addition to ordering each snapshot before the top-level capture. A nearly 48-hour-old wrapper cannot extend a snapshot to nearly 96 hours. The reproduced stale-wrapper regression failed before and passes after; exactly 48 hours remains valid and 48 hours plus one second fails. The declared freshness window and non-attestation limits are unchanged.
