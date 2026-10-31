# GL-09: offline MKE/TCJ onboarding reconciliation

**Scope:** Safe, read-only evidence preparation under Issues #305 and #278, not a Company migration, permission grant, human acceptance, or Production deployment. Historical THB procurement and BOQ UAT must not be repeated.

## Commands (Node standard library; no credentials or external services)

    node deploy/uat/gl09-onboarding-reconcile.mjs --template
    node --test deploy/release-candidate/gl09-onboarding-reconcile.test.mjs
    node deploy/uat/gl09-onboarding-reconcile.mjs --evaluate /secure/private/gl09-evidence.json

Template values are placeholders, never actual MKE/TCJ evidence. An operator may only prepare *aggregated, sanitized metadata* after separate authorization for the actual source and target. Never put employee names, salary, banking, customer costs, document bytes, private IDs, passwords, source rows, or authentication tokens in GitHub/CI. This tool has no HTTP/DB connectivity, write or import mechanism.

## Source-to-target metadata contract

The manifest requires distinct MKE and TCJ business labels. The source and target Company codes must be explicitly supplied by an authorized operator; do not assume database identities. Each Company requires exactly one source row and one target row for each dataset: PROJECTS, WAREHOUSES, UOMS, MATERIALS, SUPPLIERS, ACTIVE_USERS, PROJECT_MEMBERS, APPROVAL_WORKFLOWS, BOQ_BASELINES, DOCUMENTS (20 pairs total across two Companies).

Each dataset row supplies Company label, dataset name, nonnegative count, SHA-256 canonical content digest, and independent rejected-row, duplicate-row and foreign-Company-reference counts. Empty sets use the SHA-256 digest of zero bytes. Source provenance can be a real 40-character ERP commit or an external-register reference; never fabricate a Git commit for spreadsheets. Target provenance requires the actual ERP commit.

The canonicalization marker GL09-CANONICAL-BUSINESS-KEYS-V1 requires the *same agreed stable business identifiers, normalization and byte serialization on both sides*. This tool compares **declared** fingerprints but cannot produce or verify canonical source exports or validate mapping transformations. Different IDs and approved transformations need a separate, explicitly authorized mapping procedure and independent evidence; never force fingerprints to match. A 48-hour metadata freshness check is an advisory technical preflight, not a new Owner-approved business rule.

The tool detects missing/duplicate Company/dataset scope, count/hash differences, cross-Company references, rejected or duplicate records, inconsistent currency declarations, missing opening-balance or external-accountant scope references, training and rollback declaration gaps. New monetary documents must use THB; legacy currency provenance is preserved. Accounting/payroll development remains deferred under #288.

A scopeReference is merely operator-supplied text; it **cannot** approve pilot exclusions. OUTSIDE_APPROVED_SCOPE and OUTSIDE_APPROVED_PILOT can only reflect separate actual Owner decisions, not create them.

## Truth boundary

Even apparently matching inputs produce DECLARED_RECONCILIATION_CONSISTENT_INDEPENDENT_PROOF_PENDING. The output always fixes realCompanyConfigurationsVerified=false, independentEvidenceVerified=false, actualBusinessAcceptance=false, productionAuthorized=false, gl09GateClosed=false; zero network requests, retained data reads and writes. Real role grants/approval steps, actual data comparisons, cutover/backups, training, independent reconciliation, support and Owner go/no-go still require authorized operating evidence.

Nine synthetic regression tests are included through the existing release-candidate test glob. No Production, migration, role, Finance, HR, stock count or CI workflow changes are included.
